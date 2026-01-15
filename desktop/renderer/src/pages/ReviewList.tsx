import React, { useState, useEffect } from 'react';
import { api } from '../api';
import DateRangePicker, { DateRangeState, DateRangePreset } from '../components/DateRangePicker';
import { useDateRange } from '../context/DateRangeContext';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatAmount, formatDate } from '../utils/displayFormat';
import { resolveVendorName } from '../../../../src/vendors/vendorResolver';
import { getReviewReason } from '../utils/reviewReason';
import { EvidenceIcon } from '../components/EvidenceIcon';
import { useWindowSize } from '../hooks/useWindowSize';

interface Props {
  onSelect: (id: number) => void;
  filter: string;
  onFilterChange: (f: string) => void;
}

type ReadFilter = 'UNREAD' | 'READ' | 'ALL';

const ReviewList: React.FC<Props> = ({ onSelect, filter, onFilterChange }) => {
  const { range, setRange } = useDateRange();
  const { width } = useWindowSize();
  const isNarrow = width < 1200;
  
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [readFilter, setReadFilter] = useState<ReadFilter>('UNREAD');
  
  // Batch State
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [batchAction, setBatchAction] = useState<'EXPENSE' | 'NOT_EXPENSE' | 'READ' | 'UNREAD' | null>(null);

  useEffect(() => {
    loadItems();
    setSelectedIds([]); // Clear selection on filter change
  }, [range, filter]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await api.getReviewList(range, filter);
      setItems(res || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const filteredItems = items.filter(item => {
    if (readFilter === 'UNREAD') return item.is_read === 0;
    if (readFilter === 'READ') return item.is_read === 1;
    return true;
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredItems.map(i => i.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      // Add missing visible ids
      const newSelected = [...selectedIds, ...visibleIds.filter(id => !selectedIds.includes(id))];
      setSelectedIds(newSelected);
    }
  };

  const handleBatchClick = (action: 'EXPENSE' | 'NOT_EXPENSE' | 'READ' | 'UNREAD') => {
      setBatchAction(action);
      if (action === 'READ' || action === 'UNREAD') {
          // No confirm needed for read status? Or minimal confirm?
          // Let's execute immediately for read status to be snappy like Gmail
          executeBatchForce(action);
      } else {
          setShowConfirm(true);
      }
  };

  const executeBatchForce = async (action: 'READ' | 'UNREAD') => {
      try {
          if (action === 'READ') await api.markRead(selectedIds);
          if (action === 'UNREAD') await api.markUnread(selectedIds);
          setSelectedIds([]);
          loadItems();
      } catch (e) {
          console.error(e);
          alert('Update failed');
      }
  };

  const executeBatch = async () => {
      if (!batchAction || batchAction === 'READ' || batchAction === 'UNREAD') return;
      try {
          await api.applyBatchDecision(selectedIds, batchAction);
          setShowConfirm(false);
          setBatchAction(null);
          setSelectedIds([]);
          loadItems(); // Refresh
      } catch (e) {
          console.error(e);
          alert('Batch update failed');
      }
  };

  return (
      <div>
          <h1>Organize</h1>
          <div className="card">
              <DateRangePicker value={range} onChange={setRange} />
              
              <div style={{ marginBottom: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="tabs" style={{ display: 'flex', gap: 10 }}>
                    {[
                      { id: 'TO_REVIEW', label: 'To Review' },
                      { id: 'EXPENSE', label: 'Expense' },
                      { id: 'NOT_EXPENSE', label: 'Not Expense' },
                      { id: 'MISSING_EVIDENCE', label: 'Issues' },
                      { id: 'ALL', label: 'All' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        className={`tab-btn ${filter === tab.id ? 'active' : ''}`}
                        onClick={() => onFilterChange(tab.id)}
                        style={{
                          padding: '8px 16px',
                          border: 'none',
                          borderBottom: filter === tab.id ? '2px solid #3182ce' : '2px solid transparent',
                          background: 'transparent',
                          fontWeight: filter === tab.id ? 600 : 400,
                          color: filter === tab.id ? '#2d3748' : '#718096',
                          cursor: 'pointer',
                          fontSize: 14
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Read Filter Toggles */}
                  <div style={{ display: 'flex', background: '#edf2f7', borderRadius: 20, padding: 2 }}>
                      {(['UNREAD', 'READ', 'ALL'] as ReadFilter[]).map(rf => (
                          <button
                            key={rf}
                            onClick={() => setReadFilter(rf)}
                            style={{
                                background: readFilter === rf ? '#fff' : 'transparent',
                                borderRadius: 18,
                                border: 'none',
                                padding: '4px 12px',
                                fontSize: 12,
                                fontWeight: readFilter === rf ? 600 : 400,
                                color: readFilter === rf ? '#2b6cb0' : '#4a5568',
                                boxShadow: readFilter === rf ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer'
                            }}
                          >
                            {rf.charAt(0) + rf.slice(1).toLowerCase()}
                          </button>
                      ))}
                  </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                     <label style={{ fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <input type="checkbox" 
                            checked={filteredItems.length > 0 && selectedIds.length > 0} 
                            // Simple indeterminate check logic omitted for brevity
                            onChange={toggleSelectAll}
                        />
                        Select Visible ({filteredItems.length})
                    </label>

                   <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                     <button className="btn" onClick={loadItems}>Refresh</button>
                   </div>
              </div>

               {selectedIds.length > 0 && (
                   <div style={{ display: 'flex', gap: 10, background: '#eef', padding: '5px 10px', borderRadius: 4, marginBottom: 15, alignItems: 'center' }}>
                       <span style={{ fontWeight: 'bold' }}>{selectedIds.length} selected</span>
                       <div style={{ width: 1, height: 20, background: '#ccc', margin: '0 5px' }} />
                       <button className="btn btn-success" onClick={() => handleBatchClick('EXPENSE')}>Expense</button>
                       <button className="btn btn-danger" onClick={() => handleBatchClick('NOT_EXPENSE')}>Not Expense</button>
                       <div style={{ width: 1, height: 20, background: '#ccc', margin: '0 5px' }} />
                       <button className="btn" style={{ background: '#fff', border: '1px solid #ccc', color: '#333' }} onClick={() => handleBatchClick('READ')}>Mark Read</button>
                       <button className="btn" style={{ background: '#fff', border: '1px solid #ccc', color: '#333' }} onClick={() => handleBatchClick('UNREAD')}>Mark Unread</button>
                   </div>
               )}

              {loading ? <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div> : (
                  isNarrow ? (
                      /* CARD VIEW */
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 15 }}>
                          {filteredItems.map(item => {
                              const vendor = resolveVendorName(item);
                              const amount = formatAmount(item.subject + ' ' + item.snippet);
                              const isSelected = selectedIds.includes(item.id);
                              const isUnread = item.is_read === 0;
                              
                              return (
                                  <div 
                                      key={item.id} 
                                      className="card" 
                                      style={{ 
                                          padding: 15, 
                                          margin: 0, 
                                          border: isSelected ? '2px solid #3182ce' : '1px solid #e2e8f0',
                                          background: isSelected ? '#f9f9ff' : '#fff',
                                          borderLeft: isUnread ? '4px solid #2b6cb0' : undefined,
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: 10,
                                          position: 'relative'
                                      }}
                                  >
                                      {/* Selection Checkbox */}
                                      <div style={{ position: 'absolute', top: 10, left: 10 }}>
                                          <input 
                                              type="checkbox" 
                                              checked={isSelected}
                                              onChange={() => toggleSelect(item.id)}
                                          />
                                      </div>

                                      {/* Header: Vendor + Status */}
                                      <div style={{ paddingLeft: 25, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                                          <div style={{ fontWeight: isUnread ? '800' : 'bold', fontSize: 14, color: '#2C3E50', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={vendor}>
                                              {vendor}
                                          </div>
                                          <span style={{ 
                                              padding: '1px 6px', 
                                              borderRadius: 10, 
                                              background: item.label === 'EXPENSE' ? '#e6fffa' : item.label === 'NOT_EXPENSE' ? '#fff5f5' : '#fffbea',
                                              color: item.label === 'EXPENSE' ? '#2c7a7b' : item.label === 'NOT_EXPENSE' ? '#c53030' : '#d69e2e',
                                              fontSize: 10,
                                              fontWeight: 'bold',
                                              flexShrink: 0
                                          }}>
                                              {item.label === 'TO_REVIEW' ? 'REVIEW' : item.label}
                                          </span>
                                      </div>

                                      {/* Subheader: Date + Amount */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#718096' }}>
                                          <span>{formatDate(item.date_iso)}</span>
                                          <span style={{ fontWeight: isUnread ? '700' : '600', color: '#2d3748' }}>
                                              {amount || <span style={{ color: '#cbd5e0' }}>—</span>}
                                          </span>
                                      </div>

                                      {/* Evidence & Reason */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, background: '#f8f9fa', padding: '6px 10px', borderRadius: 4 }}>
                                          <EvidenceIcon hasAttachment={item.has_attachment} linksJson={item.links_json} />
                                          <div style={{ color: '#4a5568', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                              {getReviewReason(item)}
                                          </div>
                                      </div>

                                      {/* Snippet */}
                                      <div style={{ fontWeight: isUnread ? 500 : 400, fontSize: 11, color: isUnread ? '#2d3748' : '#718096', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: 32 }}>
                                          {item.snippet}
                                      </div>

                                      {/* Actions */}
                                      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #edf2f7' }}>
                                          <button 
                                              className="btn" 
                                              style={{ width: '100%', fontSize: 12, padding: '6px 0' }} 
                                              onClick={() => onSelect(item.id)}
                                          >
                                              View Details
                                          </button>
                                      </div>
                                  </div>
                              );
                          })}
                          {filteredItems.length === 0 && <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: '#a0aec0' }}>No items found</div>}
                      </div>
                  ) : (
                      /* TABLE VIEW */
                      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                          <thead>
                              <tr style={{ textAlign: 'left', background: '#eee', fontSize: 13 }}>
                                  <th style={{ padding: '8px 12px', width: 40 }}>
                                      <input type="checkbox" 
                                        checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
                                        onChange={toggleSelectAll}
                                      />
                                  </th>
                                  <th style={{ padding: '8px 12px' }}>Vendor & Snippet</th>
                                  <th style={{ padding: '8px 12px', width: 100 }}>Date</th>
                                  <th style={{ padding: '8px 12px', width: 100, textAlign: 'right' }}>Amount</th>
                                  <th style={{ padding: '8px 12px', width: 80, textAlign: 'center' }}>Evidence</th>
                                  <th style={{ padding: '8px 12px', width: 120 }}>Status</th>
                                  <th style={{ padding: '8px 12px', width: 80 }}></th>
                              </tr>
                          </thead>
                          <tbody>
                              {filteredItems.map(item => {
                                  const isUnread = item.is_read === 0;
                                  return (
                                  <tr key={item.id} style={{ borderBottom: '1px solid #eee', background: selectedIds.includes(item.id) ? '#f9f9ff' : 'transparent', fontSize: 13 }}>
                                      <td style={{ padding: '8px 12px' }}>
                                          <input type="checkbox" 
                                            checked={selectedIds.includes(item.id)}
                                            onChange={() => toggleSelect(item.id)}
                                          />
                                      </td>
                                      <td style={{ padding: '8px 12px', minWidth: 0, overflow: 'hidden' }}>
                                          <div style={{ fontWeight: isUnread ? '800' : '500', fontSize: 13, color: isUnread ? '#000' : '#2C3E50', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                                              {isUnread && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2b6cb0', flexShrink: 0 }}></div>}
                                              <span title={resolveVendorName(item)}>{resolveVendorName(item)}</span>
                                          </div>
                                          <div style={{ fontSize: 11, color: isUnread ? '#4a5568' : '#7f8c8d', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isUnread ? 500 : 400 }}>
                                              {item.snippet}
                                          </div>
                                      </td>
                                      <td style={{ padding: '8px 12px', color: '#555' }}>
                                          {formatDate(item.date_iso)}
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: isUnread ? 'bold' : '500' }}>
                                          {formatAmount(item.subject + ' ' + item.snippet) || <span style={{ color: '#ccc' }}>—</span>}
                                      </td>
    
                                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                          <EvidenceIcon hasAttachment={item.has_attachment} linksJson={item.links_json} />
                                      </td>
                                      <td style={{ padding: '8px 12px' }}>
                                          <span style={{ 
                                              padding: '2px 8px', 
                                              borderRadius: 12, 
                                              background: item.label === 'EXPENSE' ? '#e6fffa' : item.label === 'NOT_EXPENSE' ? '#fff5f5' : '#fffbea',
                                              color: item.label === 'EXPENSE' ? '#2c7a7b' : item.label === 'NOT_EXPENSE' ? '#c53030' : '#d69e2e',
                                              fontSize: 11,
                                              fontWeight: 'bold',
                                              display: 'inline-block',
                                              minWidth: 80,
                                              textAlign: 'center'
                                          }}>
                                              {item.label === 'TO_REVIEW' ? 'REVIEW' : item.label}
                                          </span>
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                          <button className="btn" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => onSelect(item.id)}>
                                              View
                                          </button>
                                      </td>
                                  </tr>
                              )})}
                              {filteredItems.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#888' }}>No items found</td></tr>}
                          </tbody>
                      </table>
                  )
              )}
          </div>

          <ConfirmDialog 
            isOpen={showConfirm}
            title="Batch Update"
            message={`Are you sure you want to mark ${selectedIds.length} items as ${batchAction}?`}
            onConfirm={executeBatch}
            onCancel={() => setShowConfirm(false)}
          />
      </div>
  );
};

export default ReviewList;
