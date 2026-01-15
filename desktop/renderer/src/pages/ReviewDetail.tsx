
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useDateRange } from '../context/DateRangeContext';
import DOMPurify from 'dompurify';

interface Props {
  id: number;
  onBack: () => void;
  onNext: (id: number) => void;
}

import { resolveVendorName } from '../../../../src/vendors/vendorResolver';
import { formatAmount } from '../utils/displayFormat';
import { useWindowSize } from '../hooks/useWindowSize';

// DOMPurify is used as a fresh instance per render or static call.
// We removed the global hook to allow per-email toggling.


const ReviewDetail: React.FC<Props> = ({ id, onBack, onNext }) => {
  const { range } = useDateRange();
  const { width, height } = useWindowSize();
  const isStacked = width < 1200 || height < 760;

  const [data, setData] = useState<any>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Vendor Editing State
  const [vendorName, setVendorName] = useState('');
  const [isEditingVendor, setIsEditingVendor] = useState(false);
  // Feedback Toast State
  const [showFeedback, setShowFeedback] = useState<string | null>(null);
  
  // Remote Images State (Reset every message load)

  const [allowRemoteImages, setAllowRemoteImages] = useState(false);


  const loadData = async () => {
      setPendingStatus(null);
      setIsEditingVendor(false);
      setAllowRemoteImages(false); // Reset on message load
      const res = await api.getReviewDetail(id);
      
      // Inject Virtual Body Item
      const bodyItem = {
          id: -1, // Virtual ID
          kind: 'EMAIL_BODY',
          filename: 'Email Body',
          message_id: res.message.id,
          content: null, 
          loading: false,
          error: false
      };
      const evidence = [bodyItem, ...res.evidence];
      
      setData({ ...res, evidence, links: res.links || [] });
      setVendorName(resolveVendorName(res.message)); // Initialize with resolved name

      if (res.message.label && res.message.label !== 'TO_REVIEW') {
          setPendingStatus(res.message.label);
      }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
     // Auto-select first evidence or preserve selection
     if (data) {
         const evidence = data.evidence || [];
         const links = (data.links || []).map((l: any) => ({ ...l, kind: 'LINK_EVIDENCE', id: `link_${l.id}` }));
         const allCandidates = [...evidence, ...links];

         if (allCandidates.length > 0) {
             let candidate = allCandidates[0];
             if (selectedEvidence) {
                 const match = allCandidates.find((e: any) => e.id === selectedEvidence.id);
                 if (match) candidate = match;
             }
             setSelectedEvidence(candidate);
         } else {
             setSelectedEvidence(null);
         }
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const renderStatusPill = (status: string) => {
      const colors: any = {
          'DOWNLOADED': { bg: '#c6f6d5', color: '#22543d' },
          'NEEDS_LOGIN': { bg: '#feebc8', color: '#744210' },
          'FAILED': { bg: '#fed7d7', color: '#822727' },
          'DOWNLOADING': { bg: '#e2e8f0', color: '#2d3748' },
          'DETECTED': { bg: '#edf2f7', color: '#4a5568' }
      };
      const style = colors[status] || { bg: '#eee', color: '#333' };
      return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 'bold', ...style }}>{status}</span>;
  };

  useEffect(() => {
      // Fetch Body Content
      if (selectedEvidence?.kind === 'EMAIL_BODY' && !selectedEvidence.content && !selectedEvidence.error) {
           console.log(`[ReviewDetail] Fetching body for message_id: ${selectedEvidence.message_id}`);
           
           // Ensure it knows it's loading
           if (!selectedEvidence.loading) {
               setSelectedEvidence((prev: any) => ({ ...prev, loading: true }));
           }
           
           let isMounted = true;
           const timer = setTimeout(() => {
               if (!isMounted) return;
               console.error(`[ReviewDetail] Body fetch timeout for ${selectedEvidence.message_id}`);
               setSelectedEvidence((prev: any) => {
                   if (prev?.id !== selectedEvidence.id) return prev;
                   return { ...prev, loading: false, error: true, errorMessage: 'Timeout' };
               });
           }, 5000); // Match VERIFIER.MD criteria of 5s

           api.getEmailBody(selectedEvidence.message_id).then(res => {
               if (!isMounted) return;
               clearTimeout(timer);
               console.log(`[ReviewDetail] Body fetch SUCCESS for ${selectedEvidence.message_id}`);
               
               const content = res.html || res.text ? { html: res.html, text: res.text, diag: res.diag } : null;
               const diag = res.diag;
               
               setSelectedEvidence((prev: any) => {
                   if (prev?.id !== selectedEvidence.id) return prev;
                   // CRITICAL: Always set loading: false
                   return { ...prev, loading: false, content: content, diag: diag, error: false };
               });
               
               // Also sync back to the master evidence list so it doesn't refetch on re-select
               setData((prev: any) => {
                   if (!prev) return prev;
                   return {
                       ...prev,
                       evidence: prev.evidence.map((e: any) => 
                           e.id === selectedEvidence.id ? { ...e, content: content, diag: diag, loading: false, error: false } : e
                       )
                   };
               });
           }).catch(err => {
               if (!isMounted) return;
               clearTimeout(timer);
               console.error(`[ReviewDetail] Body fetch FAILED for ${selectedEvidence.message_id}:`, err);
               setSelectedEvidence((prev: any) => {
                   if (prev?.id !== selectedEvidence.id) return prev;
                   return { ...prev, loading: false, error: true };
               });
           });

           return () => { isMounted = false; clearTimeout(timer); };
      }
  }, [selectedEvidence?.id, selectedEvidence?.kind, selectedEvidence?.content, selectedEvidence?.error]);

  useEffect(() => {
     // Vendor Auto-fill / Suggestion
     if (data && data.message.status === 'NEW' && !pendingStatus) {
         api.getSuggestedDecision(id).then(suggestion => {
             if (suggestion && suggestion.status) {
                 setPendingStatus(suggestion.status);
             }
         });
     }
  }, [data]);

  const applyDecision = async (status: string) => {
      setPendingStatus(status);
      setSaving(true);
      try {
          const nextId = await api.getNextReviewItem(id, range, 'TO_REVIEW');
          await api.setDecision(id, status, vendorName);
          setShowFeedback(`Marked as ${status}`);
          setTimeout(() => setShowFeedback(null), 2000);
          
          if (nextId) {
              onNext(nextId);
          } else {
              alert("All items reviewed!");
              onBack();
          }
      } catch (err: any) {
          console.error("Save failed:", err);
          alert("Failed to save decision: " + (err.message || String(err)));
      } finally {
          setSaving(false);
      }
  };

  const handleSaveAndNext = useCallback(async () => {
      if (!pendingStatus) return;
      await applyDecision(pendingStatus);
  }, [pendingStatus, applyDecision]);


  const handleKeyDown = useCallback((e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      switch(e.key) {
          case '1': applyDecision('EXPENSE'); break;
          case '2': applyDecision('TO_REVIEW'); break;
          case '3': applyDecision('NOT_EXPENSE'); break;
          case 'Enter': handleSaveAndNext(); break;
          case 'j': 
              api.getNextReviewItem(id, range, 'ALL').then(nid => nid && onNext(nid));
              break;
          case 'o':
              if (data?.evidence?.[0]?.local_path) api.openEvidence(data.evidence[0].local_path);
              break;
          case 'f':
              if (data?.evidence?.[0]?.local_path) api.revealEvidence(data.evidence[0].local_path);
              break;
          case 'Escape': onBack(); break;
      }
  }, [data, handleSaveAndNext, onBack, id, range, onNext]);

  useEffect(() => {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!data) return <div>Loading...</div>;

  const { message, evidence } = data;
  const amount = formatAmount(message.subject + ' ' + message.snippet);

  const handleOpenOriginal = () => {
      if (message.gmail_message_id) {
          api.openExternal(`https://mail.google.com/mail/u/0/#inbox/${message.gmail_message_id}`);
      }
  };

  return (
      <div style={{ height: '100vh', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
             <button className="btn" style={{ background: '#666' }} onClick={onBack}>&larr; Back (Esc)</button>
             <button className="btn" style={{ background: 'transparent', border: '1px solid #ccc', color: '#666' }} onClick={handleOpenOriginal}>
                 View Original Email ↗
             </button>
             
             {showFeedback && (
                 <div style={{ 
                     position: 'absolute', 
                     top: 60, 
                     left: '50%', 
                     transform: 'translateX(-50%)', 
                     background: '#2d3748', 
                     color: '#fff', 
                     padding: '6px 16px', 
                     borderRadius: 20, 
                     fontSize: 12, 
                     fontWeight: 'bold',
                     zIndex: 1000,
                     boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                 }}>
                     ✓ {showFeedback}
                 </div>
             )}

             {isStacked && (
                 <span style={{ 
                     marginLeft: 15, 
                     padding: '2px 8px', 
                     borderRadius: 12, 
                     background: '#edf2f7', 
                     color: '#4a5568', 
                     fontSize: 10, 
                     fontWeight: 'bold',
                     textTransform: 'uppercase',
                     letterSpacing: '0.05em'
                 }}>
                     Compact View
                 </span>
             )}
          </div>
          
          {/* Main Content Split: Authority Grid */}
          <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isStacked ? '1fr' : 'minmax(360px, 440px) minmax(0, 1fr)', 
              gridTemplateRows: isStacked ? 'minmax(300px, 45vh) 1fr' : '1fr',
              overflow: 'hidden' 
          }}>
            
            {/* Left/Top: Metadata & Evidence List */}
            <div style={{ 
                overflowY: 'auto', 
                padding: 20, 
                borderRight: isStacked ? 'none' : '1px solid #e2e8f0', 
                borderBottom: isStacked ? '1px solid #e2e8f0' : 'none',
                background: '#f7fafc',
                minWidth: 0 // Prevent flex/grid breakout
            }}>
                {/* EXPENSE CARD */}
                <div className="card" style={{ padding: 20, marginBottom: 20, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    {/* ... (Header content same as before) ... */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {isEditingVendor ? (
                                <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                                    <input 
                                        type="text" 
                                        value={vendorName} 
                                        onChange={e => setVendorName(e.target.value)}
                                        style={{ fontSize: 18, padding: 5, width: '100%' }}
                                        autoFocus
                                    />
                                    <button className="btn btn-success" onClick={() => setIsEditingVendor(false)}>✓</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <h2 style={{ margin: '0 0 5px 0', fontSize: 24, cursor: 'pointer', borderBottom: '1px dashed #ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => setIsEditingVendor(true)} title={vendorName}>
                                        {vendorName}
                                    </h2>
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#999' }} onClick={() => setIsEditingVendor(true)}>✎</button>
                                </div>
                            )}
                            <div style={{ color: '#666', fontSize: 13 }}>
                                {new Date(message.date_iso).toLocaleString()} &bull; {message.from_domain}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: 10 }}>
                            <div style={{ fontSize: 24, fontWeight: 'bold', color: amount ? '#2d3748' : '#cbd5e0' }}>
                                {amount || '—'}
                            </div>
                            <span style={{ 
                                padding: '2px 8px', 
                                borderRadius: 12, 
                                background: message.label === 'EXPENSE' ? '#e6fffa' : message.label === 'NOT_EXPENSE' ? '#fff5f5' : '#fffbea',
                                color: message.label === 'EXPENSE' ? '#2c7a7b' : message.label === 'NOT_EXPENSE' ? '#c53030' : '#d69e2e',
                                fontSize: 11,
                                fontWeight: 'bold'
                            }}>
                                {message.label}
                            </span>
                        </div>
                    </div>

                    <div style={{ marginTop: 20, padding: 10, background: '#f8f9fa', borderRadius: 4 }}>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                            <button 
                                className={`btn ${pendingStatus === 'EXPENSE' ? 'btn-success' : 'btn-secondary'}`} 
                                onClick={() => applyDecision('EXPENSE')} 
                                style={{
                                    flex: 1, 
                                    opacity: pendingStatus && pendingStatus !== 'EXPENSE' ? 0.6 : 1,
                                    border: pendingStatus === 'EXPENSE' ? '2px solid #285e61' : '1px solid transparent',
                                    fontWeight: pendingStatus === 'EXPENSE' ? 'bold' : 'normal',
                                    boxShadow: pendingStatus === 'EXPENSE' ? 'inset 0 2px 4px rgba(0,0,0,0.2)' : 'none'
                                }}
                            >
                                Expense (1)
                            </button>
                            <button 
                                className={`btn ${pendingStatus === 'TO_REVIEW' ? 'btn-warning' : 'btn-secondary'}`} 
                                onClick={() => applyDecision('TO_REVIEW')} 
                                style={{
                                    flex: 1,
                                    opacity: pendingStatus && pendingStatus !== 'TO_REVIEW' ? 0.6 : 1,
                                    border: pendingStatus === 'TO_REVIEW' ? '2px solid #b7791f' : '1px solid transparent',
                                    fontWeight: pendingStatus === 'TO_REVIEW' ? 'bold' : 'normal',
                                    boxShadow: pendingStatus === 'TO_REVIEW' ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                                }}
                            >
                                Review (2)
                            </button>
                            <button 
                                className={`btn ${pendingStatus === 'NOT_EXPENSE' ? 'btn-danger' : 'btn-secondary'}`} 
                                onClick={() => applyDecision('NOT_EXPENSE')} 
                                style={{
                                    flex: 1,
                                    opacity: pendingStatus && pendingStatus !== 'NOT_EXPENSE' ? 0.6 : 1,
                                    border: pendingStatus === 'NOT_EXPENSE' ? '2px solid #9b2c2c' : '1px solid transparent',
                                    fontWeight: pendingStatus === 'NOT_EXPENSE' ? 'bold' : 'normal',
                                    boxShadow: pendingStatus === 'NOT_EXPENSE' ? 'inset 0 2px 4px rgba(0,0,0,0.2)' : 'none'
                                }}
                            >
                                Not (3)
                            </button>
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSaveAndNext} disabled={!pendingStatus || saving}>
                            {saving ? 'Saving...' : 'Approve & Next (Enter)'}
                        </button>
                    </div>
                </div>

                {/* EVIDENCE LIST */}
                <h4 style={{ margin: '0 0 10px 0', color: '#4a5568' }}>Evidence Items</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                        ...data.evidence, 
                        ...(data.links || []).map((l: any) => ({ ...l, kind: 'LINK_EVIDENCE', id: `link_${l.id}` }))
                    ].map((ev: any) => {
                        const isBody = ev.kind === 'EMAIL_BODY';
                        const isLink = ev.kind === 'LINK_EVIDENCE' || ev.kind === 'LINK_FILE';
                        const icon = isBody ? '📧' : (isLink ? '🔗' : '📄');
                        const typeLabel = isBody ? 'Email Content' : (ev.kind === 'LINK_EVIDENCE' ? 'Invoice Link' : 'Attachment');
                        
                        return (
                        <div 
                            key={ev.id} 
                            style={{ 
                                border: selectedEvidence?.id === ev.id ? '2px solid #3182ce' : '1px solid #e2e8f0', 
                                padding: 12, 
                                borderRadius: 6, 
                                cursor: 'pointer',
                                background: selectedEvidence?.id === ev.id ? '#ebf8ff' : '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12
                            }}
                            onClick={() => setSelectedEvidence(ev)}
                        >
                            <div style={{ fontSize: 20 }}>{icon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 'bold', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.filename || ev.anchor_text}>
                                    {isLink ? (ev.anchor_text || new URL(ev.url_original).hostname) : (ev.filename || 'Unnamed File')}
                                </div>
                                <div style={{ fontSize: 11, color: '#718096', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    {typeLabel}
                                    {ev.kind === 'LINK_EVIDENCE' && renderStatusPill(ev.status)}
                                </div>
                            </div>
                        </div>
                    )})}
                </div>
                
                {/* DEBUG / RAW */}
                <details style={{ marginTop: 30, color: '#718096' }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12 }}>Raw Email (Debug)</summary>
                    <div className="card" style={{ marginTop: 10, fontSize: 11 }}>
                        <div style={{ fontWeight: 'bold' }}>Subject: {message.subject}</div>
                        <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 10, marginTop: 5, fontSize: 10, maxHeight: 200, overflow: 'auto' }}>{message.snippet}</pre>
                    </div>
                </details>
            </div>

            {/* Right Pane: Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', background: '#edf2f7', overflow: 'hidden' }}>
                {selectedEvidence ? (
                    <>
                        {/* Sticky Action Toolbar */}
                        <div style={{ padding: '10px 15px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                             <div style={{ fontWeight: 'bold', fontSize: 13, color: '#2d3748' }}>
                                 {selectedEvidence.filename || 'Evidence Preview'}
                             </div>
                             <div style={{ display: 'flex', gap: 10 }}>
                                {selectedEvidence.local_path ? (
                                    <>
                                        <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => api.openEvidence(selectedEvidence.local_path)}>Open</button>
                                        <button className="btn" style={{ fontSize: 12, padding: '4px 10px', background: '#cbd5e0', color: '#333' }} onClick={() => api.revealEvidence(selectedEvidence.local_path)}>Reveal</button>
                                    </>
                                ) : selectedEvidence.kind === 'EMAIL_BODY' ? (
                                    <span style={{ fontSize: 11, color: '#aaa' }}>Live Preview</span>
                                ) : (
                                    <button 
                                        className="btn" 
                                        style={{ fontSize: 12, padding: '6px 14px', background: '#3182ce', color: 'white', fontWeight: 'bold' }} 
                                        onClick={async (e) => {
                                            try {
                                                await api.downloadEvidence(selectedEvidence.id);
                                                await loadData();
                                            } catch (err: any) {
                                                console.error(err);
                                                alert('Download failed: ' + (err.message || String(err)));
                                            }
                                        }}
                                    >
                                        Download Now
                                    </button>
                                )}
                             </div>
                        </div>

                        {/* Preview Content Area */}
                        <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                             {selectedEvidence.kind === 'EMAIL_BODY' ? (
                                 <div style={{ width: '100%', background: '#fff', padding: 40, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                     {selectedEvidence.loading ? (
                                         <div style={{ textAlign: 'center', color: '#718096' }}>Loading email content...</div>
                                     ) : selectedEvidence.error ? (
                                          <div style={{ textAlign: 'center', color: '#e53e3e' }}>
                                              <div style={{ fontSize: 24, marginBottom: 10 }}>⚠️</div>
                                              <div>Failed to load email body</div>
                                              <button className="btn" style={{ marginTop: 10 }} onClick={() => setSelectedEvidence({...selectedEvidence, error: false})}>Retry</button>
                                          </div>
                                     ) : !selectedEvidence.content ? (
                                          <div style={{ textAlign: 'center', color: '#718096', maxWidth: 400, margin: '0 auto' }}>
                                              <div style={{ fontSize: 24, marginBottom: 15 }}>
                                                  {selectedEvidence.diag?.reasonIfEmpty === 'ONLY_ATTACHMENTS' ? '📎' : '📭'}
                                              </div>
                                              
                                              <h3 style={{ fontSize: 16, marginBottom: 5, color: '#2d3748' }}>
                                                 {selectedEvidence.diag?.reasonIfEmpty === 'ONLY_ATTACHMENTS' ? 'Attachments Only' : 'No Body Content'}
                                              </h3>
                                              
                                              <div style={{ fontSize: 13, marginBottom: 20, color: '#a0aec0' }}>
                                                  {selectedEvidence.diag?.reasonIfEmpty === 'ONLY_ATTACHMENTS' 
                                                      ? "This email contains only attachments and no body text."
                                                      : "We couldn't extract any displayable text from this email structure."}
                                              </div>
                                              
                                              <button className="btn" style={{ background: 'transparent', border: '1px solid #cbd5e0', color: '#4a5568' }} onClick={handleOpenOriginal}>
                                                  View Original Email
                                              </button>
                                          </div>
                                     ) : (
                                         <div style={{ width: '100%' }}>
                                             {/* Diagnostics Hint */}
                                             {selectedEvidence.diag?.blockedRemoteImages > 0 && (
                                                 <div style={{ 
                                                     marginBottom: 20, 
                                                     padding: '8px 12px', 
                                                     background: allowRemoteImages ? '#f0fff4' : '#fffaf0', 
                                                     border: allowRemoteImages ? '1px solid #c6f6d5' : '1px solid #fbd38d', 
                                                     borderRadius: 4, 
                                                     fontSize: 12, 
                                                     color: allowRemoteImages ? '#22543d' : '#744210',
                                                     display: 'flex',
                                                     justifyContent: 'space-between',
                                                     alignItems: 'center'
                                                 }}>
                                                     <div>
                                                         <strong>{selectedEvidence.diag.blockedRemoteImages} remote images {allowRemoteImages ? 'loaded' : 'blocked'}.</strong>
                                                         <button 
                                                             style={{ marginLeft: 10, background: 'none', border: 'none', textDecoration: 'underline', color: 'inherit', cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}
                                                             onClick={() => setAllowRemoteImages(!allowRemoteImages)}
                                                         >
                                                             {allowRemoteImages ? 'Disable' : 'Load remote images (this email)'}
                                                         </button>
                                                     </div>
                                                     <button 
                                                         style={{ background: 'none', border: 'none', textDecoration: 'underline', color: 'inherit', cursor: 'pointer', fontSize: 11 }}
                                                         onClick={handleOpenOriginal}
                                                     >
                                                         View Original
                                                     </button>
                                                 </div>
                                             )}

                                             <div 
                                                 dangerouslySetInnerHTML={{ 
                                                     __html: (() => {
                                                         const rawHtml = selectedEvidence.content.html || selectedEvidence.content.text || '';
                                                         const clean = DOMPurify.sanitize(rawHtml, { 
                                                             USE_PROFILES: { html: true },
                                                             FORBID_TAGS: ['script', 'iframe', 'form'],
                                                         });
                                                         
                                                         if (allowRemoteImages) return clean;
                                                         
                                                         // If blocked, we MUST strip src to prevent network requests
                                                         const parser = new DOMParser();
                                                         const doc = parser.parseFromString(clean, 'text/html');
                                                         const imgs = doc.querySelectorAll('img');
                                                         imgs.forEach(img => {
                                                             const src = img.getAttribute('src');
                                                             if (src && !src.startsWith('data:')) {
                                                                 img.setAttribute('data-blocked-src', src);
                                                                 img.removeAttribute('src');
                                                                 img.setAttribute('alt', '[Remote Image Blocked]');
                                                                 img.style.border = '1px dashed #cbd5e0';
                                                                 img.style.padding = '10px';
                                                                 img.style.display = 'inline-block';
                                                                 img.style.minWidth = '100px';
                                                                 img.style.textAlign = 'center';
                                                                 img.style.color = '#a0aec0';
                                                                 img.style.fontSize = '11px';
                                                             }
                                                         });
                                                         return doc.body.innerHTML;
                                                     })()
                                                 }} 
                                                 style={{ lineHeight: 1.5, fontSize: 14, fontFamily: 'system-ui, sans-serif' }}
                                             />
                                         </div>
                                     )}
                                 </div>
                             ) : selectedEvidence.kind === 'LINK_EVIDENCE' ? (
                                <div style={{ width: '100%', maxWidth: 600, background: '#fff', padding: 40, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 40, marginBottom: 20 }}>🔗</div>
                                        <h3 style={{ fontSize: 20, marginBottom: 10 }}>Invoice Link Analysis</h3>
                                        <div style={{ marginBottom: 30 }}>{renderStatusPill(selectedEvidence.status)}</div>
                                        
                                        <div style={{ textAlign: 'left', background: '#f7fafc', padding: 20, borderRadius: 6, fontSize: 13, color: '#4a5568', marginBottom: 20 }}>
                                            <div style={{ marginBottom: 10 }}><strong>Original:</strong> <span style={{ wordBreak: 'break-all' }}>{selectedEvidence.url_original}</span></div>
                                            {selectedEvidence.url_resolved && (
                                                <div style={{ marginBottom: 10 }}><strong>Resolved:</strong> <span style={{ wordBreak: 'break-all' }}>{selectedEvidence.url_resolved}</span></div>
                                            )}
                                            {selectedEvidence.anchor_text && (
                                                <div style={{ marginBottom: 10 }}><strong>Link Text:</strong> "{selectedEvidence.anchor_text}"</div>
                                            )}
                                            {selectedEvidence.failure_reason && (
                                                <div style={{ marginTop: 15, padding: 10, background: '#fff5f5', color: '#c53030', borderLeft: '4px solid #f56565', fontWeight: 'bold' }}>
                                                    Reason: {selectedEvidence.failure_reason}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', gap: 15, justifyContent: 'center' }}>
                                            <button className="btn btn-primary" onClick={() => api.openExternal(selectedEvidence.url_original)}>
                                                Open in Browser
                                            </button>
                                            {selectedEvidence.status === 'FAILED' && (
                                                <button className="btn btn-secondary" onClick={loadData}>
                                                    Retry Check
                                                </button>
                                            )}
                                        </div>

                                        {selectedEvidence.status === 'NEEDS_LOGIN' && (
                                            <div style={{ marginTop: 20, fontSize: 13, color: '#718096' }}>
                                                💡 This link requires you to sign in to the vendor portal to access the invoice.
                                            </div>
                                        )}
                                    </div>
                                </div>
                             ) : selectedEvidence.local_path ? (

                                selectedEvidence.mime_type === 'application/pdf' ? (
                                    <iframe 
                                        src={`evidence://${selectedEvidence.local_path}`} 
                                        style={{ width: '100%', height: '100%', border: 'none', background: '#fff', minHeight: 500 }}
                                    />
                                ) : selectedEvidence.mime_type?.startsWith('image/') ? (
                                    <img 
                                        src={`evidence://${selectedEvidence.local_path}`} 
                                        style={{ maxWidth: '100%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} 
                                    />
                                ) : (
                                    <div style={{ padding: 40, textAlign: 'center', color: '#718096', background: '#fff', borderRadius: 8 }}>
                                        No preview available for this file type.<br/>
                                        Use 'Open' button above.
                                    </div>
                                )
                            ) : (
                                <div style={{ textAlign: 'center', color: '#718096', padding: 40, background: '#fff', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                    <div style={{ fontSize: 32, marginBottom: 15 }}>⬇️</div>
                                    <div style={{ fontWeight: 'bold', marginBottom: 5 }}>Evidence Not Downloaded</div>
                                    <div>Click "Download Now" in the toolbar above.</div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0' }}>
                        Select an item on the left to preview
                    </div>
                )}
            </div>
          </div>

          {/* Footer Shortcuts */}
          <div style={{ background: '#2d3748', color: '#fff', padding: '8px 20px', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                  <span style={{ opacity: 0.7 }}>Shortcuts:</span> 
                  <strong style={{ marginLeft: 10 }}>(1)</strong> Expense 
                  <strong style={{ marginLeft: 10 }}>(2)</strong> Review 
                  <strong style={{ marginLeft: 10 }}>(3)</strong> Not
              </div>
              <div>
                   <strong>Enter</strong> Save & Next &bull; <strong>j</strong> Skip &bull; <strong>o</strong> Open &bull; <strong>Esc</strong> Back
              </div>
          </div>
      </div>
  );
};

export default ReviewDetail;
