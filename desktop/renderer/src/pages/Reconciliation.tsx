
import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useDateRange } from '../context/DateRangeContext';

interface Props {
    accountId: number;
    onBack: () => void;
}

export const ReconciliationPage: React.FC<Props> = ({ accountId, onBack }) => {
    const { range } = useDateRange();
    
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<{ matched: any[], unmatched: any[], orphans: any[] } | null>(null);
    const [tab, setTab] = useState<'unmatched' | 'matched' | 'orphans'>('unmatched');

    useEffect(() => {
        loadData();
    }, [accountId, range]);

    const loadData = async () => {
        if (!accountId) return;
        setLoading(true);
        try {
            // First run reconcile to ensure matches are up to date
            await api.bank.reconcile(accountId, range);
            // Then fetch views
            const result = await api.bank.getReconciliation(accountId, range);
            setData(result);
        } catch (e: any) {
            console.error(e);
            alert('Error loading reconciliation: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const res = await api.bank.exportReconciliation(accountId, range);
            alert(`Exported to: ${res.path}`);
        } catch (e: any) {
            alert('Export failed: ' + e.message);
        }
    };

    if (!data) return <div className="p-6">Loading...</div>;

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="text-gray-400 hover:text-white">&larr; Back</button>
                        <h1 className="text-2xl font-bold">Reconciliation</h1>
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                        Total Bank Txns: {data.matched.length + data.unmatched.length} | 
                        Matched: {data.matched.length} | 
                        Unmatched: <span className="text-red-400 font-bold">{data.unmatched.length}</span> | 
                        Orphans: <span className="text-yellow-400 font-bold">{data.orphans.length}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                     <button onClick={loadData} className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600">Refresh</button>
                     <button onClick={handleExport} className="px-3 py-1 bg-green-600 rounded hover:bg-green-500">Export Report</button>
                </div>
            </div>

            <div className="flex gap-2 mb-4 border-b border-gray-700">
                <TabButton active={tab === 'unmatched'} onClick={() => setTab('unmatched')} label={`Unmatched Bank (${data.unmatched.length})`} />
                <TabButton active={tab === 'orphans'} onClick={() => setTab('orphans')} label={`Orphan Expenses (${data.orphans.length})`} />
                <TabButton active={tab === 'matched'} onClick={() => setTab('matched')} label={`Matched (${data.matched.length})`} />
            </div>

            <div className="flex-1 overflow-auto bg-gray-900/50 border border-gray-700 rounded-lg">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-800 text-gray-400 sticky top-0 z-10">
                        <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Amount</th>
                            <th className="p-3">Description / Info</th>
                            {tab === 'matched' && <th className="p-3">Matched With</th>}
                            {tab === 'matched' && <th className="p-3">Score</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {tab === 'unmatched' && data.unmatched.map(t => (
                            <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                <td className="p-3 font-mono text-sm">{t.txn_date}</td>
                                <td className="p-3 font-mono">{t.amount.toFixed(2)}</td>
                                <td className="p-3 text-sm">{t.description}</td>
                            </tr>
                        ))}
                        
                        {tab === 'orphans' && data.orphans.map(o => (
                            <tr key={o.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                <td className="p-3 font-mono text-sm">{o.date_iso.split('T')[0]}</td>
                                <td className="p-3 font-mono">--</td>
                                <td className="p-3 text-sm">
                                    <div className="font-semibold text-white">{o.vendor_override || o.from_domain}</div>
                                    <div className="text-gray-500 text-xs">{o.subject}</div>
                                </td>
                            </tr>
                        ))}

                        {tab === 'matched' && data.matched.map(m => (
                            <tr key={m.txn_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                <td className="p-3 font-mono text-sm">{m.txn_date}</td>
                                <td className="p-3 font-mono">{m.amount.toFixed(2)}</td>
                                <td className="p-3 text-sm text-gray-400">{m.description}</td>
                                <td className="p-3 text-sm">
                                    <div className="text-green-300 font-semibold">{m.subject}</div>
                                    <div className="text-xs text-gray-500">{m.match_reason}</div>
                                </td>
                                <td className="p-3 text-sm">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${m.match_score >= 80 ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                                        {m.match_score}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {((tab === 'unmatched' && data.unmatched.length === 0) || 
                   (tab === 'orphans' && data.orphans.length === 0) || 
                   (tab === 'matched' && data.matched.length === 0)) && (
                     <div className="p-8 text-center text-gray-500">List is empty</div>
                 )}
            </div>
        </div>
    );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, label: string }> = ({ active, onClick, label }) => (
    <button 
        onClick={onClick}
        className={`px-4 py-2 border-b-2 font-medium transition-colors ${active ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
    >
        {label}
    </button>
);
