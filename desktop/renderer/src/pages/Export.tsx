import React, { useState, useEffect } from 'react';
import { api } from '../api';
import DateRangePicker, { DateRangeState, DateRangePreset } from '../components/DateRangePicker';
import ProgressBar from '../components/ProgressBar';
import { useDateRange } from '../context/DateRangeContext';

interface KeyConfig {
    export: {
        dropboxPath: string;
        scheme: string;
    }
}

interface TreeNode {
    name: string;
    children: TreeNode[];
    isFile: boolean;
}

function buildTree(paths: string[], basePath: string): TreeNode[] {
    const root: TreeNode[] = [];
    
    // Sort paths for consistency
    paths.sort();

    for (const p of paths) {
        // Remove basePath to show relative structure or show full?
        // Let's show relative to dropBoxPath for clarity, but the API returns full path.
        // We will just split the whole path.
        // If basePath is present, maybe strip it?
        let cleanPath = p;
        if (basePath && p.startsWith(basePath)) {
            cleanPath = p.replace(basePath, '').replace(/^\//, ''); // Strip base
        }
        
        const parts = cleanPath.split('/').filter(x => x);
        let currentLevel = root;
        
        parts.forEach((part, index) => {
            let existing = currentLevel.find(n => n.name === part);
            const isFile = index === parts.length - 1;
            
            if (!existing) {
                existing = { name: part, children: [], isFile };
                currentLevel.push(existing);
            }
            // Sort folders first, then files
            
            currentLevel = existing.children;
        });
    }
    return root;
}

const TreeView: React.FC<{ nodes: TreeNode[], level?: number }> = ({ nodes, level = 0 }) => {
    return (
        <div style={{ paddingLeft: level === 0 ? 0 : 20 }}>
            {nodes.map((node, i) => (
                <div key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0' }}>
                        <span>{node.isFile ? '📄' : '📁'}</span>
                        <span style={{ 
                            fontWeight: node.isFile ? 'normal' : 'bold',
                            color: node.isFile ? '#333' : '#2b6cb0'
                        }}>{node.name}</span>
                    </div>
                    {node.children.length > 0 && <TreeView nodes={node.children} level={level + 1} />}
                </div>
            ))}
        </div>
    );
};

const Export: React.FC = () => {
    const { range, setRange } = useDateRange();
    const [exporting, setExporting] = useState(false);
    const [progress, setProgress] = useState<any>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [mock, setMock] = useState(false);
    
    // Preview State
    const [previewPaths, setPreviewPaths] = useState<string[] | null>(null);
    const [settings, setSettings] = useState<KeyConfig | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    useEffect(() => {
        api.onExportProgress((data) => {
            setProgress(data);
            if (data.message) setLogs(prev => [...prev.slice(-4), data.message]);
        });
        
        // Fetch settings for display
        api.getSettings().then(res => setSettings(res as any));
    }, []);

    const runPreview = async () => {
        setLoadingPreview(true);
        setPreviewPaths(null);
        try {
            const paths = await api.previewExport(range);
            setPreviewPaths(paths);
        } catch (e) {
            console.error(e);
            alert('Failed to preview export');
        }
        setLoadingPreview(false);
    };

    const runExport = async () => {
        if (!confirm('Start export to Dropbox? This checks for duplicates but will upload new files.')) return;
        setExporting(true);
        setLogs([]);
        setProgress(null);
        try {
            const res = await api.export(range, { mock });
            if (res.ok) {
                setLogs(prev => [...prev, 'Export Completed Successfully!']);
            } else {
                setLogs(prev => [...prev, 'Error: ' + res.error]);
            }
        } catch (e) {
            console.error(e);
            setLogs(prev => [...prev, 'Error occurred calling export']);
        }
        setExporting(false);
    };

    const tree = previewPaths && settings ? buildTree(previewPaths, settings.export.dropboxPath) : [];

    return (
        <div>
            <h1>Export</h1>
            <div className="card">
                <p>Export captured evidence to Dropbox.</p>
                <div style={{ background: '#f7fafc', padding: 10, borderRadius: 4, marginBottom: 15, fontSize: 13 }}>
                    <strong>Configuration (via Settings):</strong><br/>
                    Base Path: <code>{settings?.export?.dropboxPath || '...'}</code><br/>
                    Scheme: <code>{settings?.export?.scheme || '...'}</code>
                </div>

                <DateRangePicker value={range} onChange={setRange} />
                
                <div style={{ margin: '20px 0', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button className="btn" disabled={loadingPreview || exporting} onClick={runPreview}>
                         {loadingPreview ? 'Analyzing...' : 'Preview Folder Tree'}
                    </button>
                    
                    {previewPaths && (
                        <div style={{ marginLeft: 'auto' }}>
                            <span style={{ fontWeight: 'bold' }}>{previewPaths.length}</span> items to export
                        </div>
                    )}
                </div>

                {previewPaths && (
                    <div style={{ 
                        border: '1px solid #ddd', borderRadius: 4, padding: 10, 
                        maxHeight: 300, overflowY: 'auto', background: '#fff', marginBottom: 20 
                    }}>
                        {previewPaths.length === 0 ? (
                            <div style={{ fontStyle: 'italic', color: '#666' }}>No items found to export in this range.</div>
                        ) : (
                            <TreeView nodes={tree} />
                        )}
                    </div>
                )}
                
                <div style={{ marginBottom: 20 }}>
                     <label>
                         <input type="checkbox" checked={mock} onChange={e => setMock(e.target.checked)} />
                         Run in Mock Mode (Simulate upload)
                     </label>
                 </div>

                <button className="btn btn-primary" disabled={exporting || !previewPaths || previewPaths.length === 0} onClick={runExport}>
                    {exporting ? 'Exporting...' : 'Start Export'}
                </button>
            </div>

            <div className="card" style={{ marginTop: 20, borderTop: '4px solid #2b6cb0' }}>
               <h3>Accountant Pack</h3>
               <p>Generate a single ZIP file with all evidence, a summary CSV, and bank reconciliation data (if available), structured for your accountant.</p>
               <button className="btn" style={{ background: '#2b6cb0', color: 'white' }} onClick={async () => {
                   if (confirm('Generate Accountant Pack (ZIP)?')) {
                       setLogs(prev => [...prev, 'Starting Accountant Pack generation...']);
                       try {
                           const res = await api.exportAccountantPack(range);
                           setLogs(prev => [...prev, `Success! Created: ${res.filename}`]);
                           alert(`Accountant Pack created at: ${res.path}`);
                       } catch (e: any) {
                           console.error(e);
                           setLogs(prev => [...prev, `Error: ${e.message}`]);
                           alert('Error creating pack: ' + e.message);
                       }
                   }
               }}>
                   Generate Accountant Pack (ZIP)
               </button>
            </div>

            {(exporting || progress) && (
                <div className="card">
                    <h3>Progress</h3>
                    {progress && <ProgressBar current={progress.current} total={progress.total} label={progress.stage} />}
                    <div style={{ background: '#222', color: '#0f0', padding: 10, borderRadius: 4, fontFamily: 'monospace', fontSize: 12 }}>
                        {logs.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Export;
