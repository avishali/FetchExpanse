import React, { useState } from 'react';
import { api } from '../api';
import DateRangePicker, { DateRangeState, DateRangePreset } from '../components/DateRangePicker';
import { useDateRange } from '../context/DateRangeContext';

const Recurring: React.FC = () => {
    const { range, setRange } = useDateRange();
    const [report, setReport] = useState<{ patterns: any[], reportPath: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const generate = async () => {
        setLoading(true);
        try {
            const res = await api.getRecurring(range);
            setReport(res);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <div>
            <h1>Recurring Expenses</h1>
            <div className="card">
                <DateRangePicker value={range} onChange={setRange} />
                <button className="btn" onClick={generate} disabled={loading}>
                    {loading ? 'Analyzing...' : 'Generate Report'}
                </button>
            </div>

            {report && (
                <div className="card">
                    <h3>Report Generated</h3>
                    <p>Saved to: <code>{report.reportPath}</code></p>
                    <button className="btn" style={{ background: '#666', fontSize: 12 }} onClick={() => api.revealEvidence(report.reportPath)}>
                        Show in Finder
                    </button>
                    
                    <div style={{ marginTop: 20 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#eee', textAlign: 'left' }}>
                                    <th style={{ padding: 8 }}>Vendor</th>
                                    <th style={{ padding: 8 }}>Count</th>
                                    <th style={{ padding: 8 }}>Months</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.patterns.map((p: any, i: number) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: 8 }}>{p.vendor}</td>
                                        <td style={{ padding: 8 }}>{p.count_months}</td>
                                        <td style={{ padding: 8, fontSize: 12, color: '#666' }}>
                                            {JSON.parse(p.months_json).join(', ')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Recurring;
