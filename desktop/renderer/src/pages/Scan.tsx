import React, { useState, useEffect } from 'react';
import { api } from '../api';
import DateRangePicker, { DateRangeState, DateRangePreset } from '../components/DateRangePicker';
import ProgressBar from '../components/ProgressBar';
import { useDateRange } from '../context/DateRangeContext';

const Scan: React.FC = () => {
    const { range, setRange } = useDateRange();
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState<any>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [mock, setMock] = useState(false);
    
    // New Options
    const [recall, setRecall] = useState<'normal' | 'high'>('normal');
    const [includeSpam, setIncludeSpam] = useState(false);
    const [includeTrash, setIncludeTrash] = useState(false);

    useEffect(() => {
        // Setup listener
        api.onScanProgress((data) => {
           setProgress(data); // { stage, current, total, message }
           if (data.message) {
               setLogs(prev => [...prev.slice(-4), data.message]);
           }
        });

        return () => {
            // api.removeListeners('scan:progress'); // If implemented
        };
    }, []);

    const [scanResult, setScanResult] = useState<any>(null);

    const runScan = async () => {
        setScanning(true);
        setLogs([]);
        setProgress(null);
        setScanResult(null);
        try {
            const res = await api.scan(range, { mock, recall, includeSpam, includeTrash });
            if (res.ok && res.stats) {
                setScanResult(res.stats);
                setLogs(prev => [...prev, 'Scan Complete!']);
            } else {
                 setLogs(prev => [...prev, 'Done (No stats returned)']);
            }
        } catch (e) {
            console.error(e);
            setLogs(prev => [...prev, 'Error occurred']);
        }
        setScanning(false);
    };

    return (
        <div>
            <h1>Scan</h1>
            <div className="card">
                 <DateRangePicker value={range} onChange={setRange} />
                 
                 <div style={{ marginBottom: 20 }}>
                     <label>
                         <input type="checkbox" checked={mock} onChange={e => setMock(e.target.checked)} />
                         Run in Mock Mode (No API calls)
                     </label>
                 </div>
                 
                 <div style={{ marginBottom: 20, border: '1px solid #444', padding: 10, borderRadius: 4 }}>
                     <h4 style={{marginTop:0}}>Advanced Scope</h4>
                     <div style={{ marginBottom: 10 }}>
                         <label style={{ marginRight: 15 }}>Recall Mode:</label>
                         <label style={{ marginRight: 10 }}>
                            <input 
                                type="radio" 
                                name="recall" 
                                value="normal" 
                                checked={recall === 'normal'} 
                                onChange={() => setRecall('normal')} 
                            /> Normal
                         </label>
                         <label style={{ marginRight: 10 }}>
                            <input 
                                type="radio" 
                                name="recall" 
                                value="high" 
                                checked={recall === 'high'} 
                                onChange={() => setRecall('high')} 
                            /> High Recall
                         </label>
                     </div>
                     <div>
                         <label style={{ marginRight: 15 }}>Include:</label>
                         <label style={{ marginRight: 10 }}>
                             <input type="checkbox" checked={includeSpam} onChange={e => setIncludeSpam(e.target.checked)} />
                             Spam
                         </label>
                         <label>
                             <input type="checkbox" checked={includeTrash} onChange={e => setIncludeTrash(e.target.checked)} />
                             Trash
                         </label>
                     </div>
                 </div>

                 <button className="btn" disabled={scanning} onClick={runScan}>
                     {scanning ? 'Scanning...' : 'Start Scan'}
                 </button>
            </div>

            {(scanning || progress) && (
                <div className="card">
                    <h3>Progress</h3>
                    {progress && (
                        <ProgressBar 
                            current={progress.current} 
                            total={progress.total} 
                            label={`Stage: ${progress.stage}`}
                        />
                    )}
                    <div style={{ background: '#222', color: '#0f0', padding: 10, borderRadius: 4, fontFamily: 'monospace', fontSize: 12, maxHeight: 100, overflowY: 'auto' }}>
                        {logs.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                </div>
            )}

            {scanResult && (
                <div className="card" style={{ borderLeft: scanResult.truncated ? '4px solid orange' : '4px solid green' }}>
                    <h3>Scan Completeness Report</h3>
                    {scanResult.truncated && (
                        <div style={{ background: '#fff3cd', color: '#856404', padding: 10, marginBottom: 15, borderRadius: 4 }}>
                            <strong>⚠️ Limit Hit:</strong> {scanResult.truncationReason}. Some messages may have been missed. Try narrowing data range.
                        </div>
                    )}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 15 }}>
                        <div style={{ background: '#eee', padding: 10, borderRadius: 4, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{scanResult.totalFound}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>Messages Found</div>
                        </div>
                        <div style={{ background: '#eee', padding: 10, borderRadius: 4, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{scanResult.totalInserted}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>New Items Added</div>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#eee', textAlign: 'left' }}>
                                <th style={{ padding: 8 }}>Bucket Strategy</th>
                                <th style={{ padding: 8 }}>Found</th>
                                <th style={{ padding: 8 }}>New</th>
                                <th style={{ padding: 8 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scanResult.buckets.map((b: any, i: number) => (
                                <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                                    <td style={{ padding: 8 }}>
                                        <strong>{b.name}</strong>
                                        <div style={{ fontSize: 10, color: '#999', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.query}>{b.query}</div>
                                    </td>
                                    <td style={{ padding: 8 }}>{b.found}</td>
                                    <td style={{ padding: 8 }}>{b.inserted}</td>
                                    <td style={{ padding: 8 }}>
                                        {b.truncated ? <span style={{ color: 'orange', fontWeight: 'bold' }}>TRUNCATED</span> : <span style={{ color: 'green' }}>OK</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Scan;
