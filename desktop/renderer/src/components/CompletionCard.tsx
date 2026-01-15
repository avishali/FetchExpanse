
import React from 'react';

interface CoverageSummary {
    total_scanned: number;
    count_expense: number;
    count_to_review: number;
    count_not_expense: number;
    missing_evidence: number; 
    missing_amount: number;
    unmatched_txns?: number;
}

interface Props {
    summary: CoverageSummary;
    periodLabel: string;
    onContinue: () => void;
    onExport: () => void;
    onExportAccountantPack: () => void;
}

export const CompletionCard: React.FC<Props> = ({ summary, periodLabel, onContinue, onExport, onExportAccountantPack }) => {
    
    // Readiness Logic (Deterministic)
    // Red: TO_REVIEW > 0 OR MissingEvidence > 0
    // Yellow: TO_REVIEW == 0 AND MissingEvidence == 0 AND MissingAmount > 0
    // Green: TO_REVIEW == 0 AND MissingEvidence == 0 AND MissingAmount == 0
    
    let status = 'GREEN';
    if (summary.count_to_review > 0 || summary.missing_evidence > 0) {
        status = 'RED';
    } else if (summary.missing_amount > 0) {
        status = 'YELLOW';
    }

    const alerts = [];
    if (summary.count_to_review > 0) alerts.push(`${summary.count_to_review} items still TO_REVIEW`);
    if (summary.missing_evidence > 0) alerts.push(`${summary.missing_evidence} expenses missing evidence`);
    if (summary.missing_amount > 0) alerts.push(`${summary.missing_amount} expenses missing amount`);

    return (
        <div className="card" style={{ borderTop: `4px solid ${status === 'RED' ? '#e53e3e' : status === 'YELLOW' ? '#d69e2e' : '#38a169'}`, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ margin: '0 0 10px 0' }}>Completion Cockpit <small style={{ fontWeight: 'normal', color: '#666' }}>({periodLabel})</small></h2>
                    <div style={{ display: 'flex', gap: 15, marginBottom: 15 }}>
                        <div style={{ fontSize: 24, fontWeight: 'bold', color: status === 'RED' ? '#e53e3e' : status === 'YELLOW' ? '#d69e2e' : '#38a169' }}>
                            {status === 'GREEN' ? 'READY' : status === 'YELLOW' ? 'ALMOST READY' : 'NOT READY'}
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 30, fontSize: 14, color: '#555' }}>
                        <div><strong>{summary.total_scanned}</strong> Total</div>
                        <div><strong>{summary.count_expense}</strong> Expenses</div>
                        <div><strong>{summary.count_not_expense}</strong> Not Expense</div>
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ marginBottom: 15 }}>
                        {alerts.slice(0, 3).map((alert, i) => (
                            <div key={i} style={{ color: '#e53e3e', marginBottom: 4, fontWeight: '500' }}>• {alert}</div>
                        ))}
                        {alerts.length === 0 && <div style={{ color: '#38a169' }}>✓ All clear</div>}
                        
                        {(summary.unmatched_txns !== undefined && summary.unmatched_txns > 0) && (
                            <div style={{ color: '#d69e2e', marginTop: 8, fontWeight: '500', fontSize: '0.9em' }}>
                                ⚠️ Bank cross-check: {summary.unmatched_txns} unmatched
                            </div>
                        )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={onContinue}>
                            Continue Review &rarr;
                        </button>
                        <button className="btn" style={{ background: '#eee', color: '#333' }} onClick={onExport}>
                            Export Page
                        </button>
                        <button className="btn" style={{ background: '#2b6cb0', color: 'white' }} onClick={onExportAccountantPack}>
                            📦 Accountant Pack
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
