
import React, { useState } from 'react';
import { api } from '../api';

interface Props {
    accountId: number;
    onClose: () => void;
    onImportComplete: (stats: any) => void;
}

export const CsvMappingWizard: React.FC<Props> = ({ accountId, onClose, onImportComplete }) => {
    const [filePath, setFilePath] = useState<string>('');
    const [previewRows, setPreviewRows] = useState<string[][]>([]);
    const [mapping, setMapping] = useState({
        dateIndex: 0,
        amountIndex: 1,
        descIndex: 2
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // Electron exposes 'path' on File object
        const path = (file as any).path;
        setFilePath(path);
        setLoading(true);
        setError('');
        
        try {
            const rows = await api.bank.previewCsv(path);
            setPreviewRows(rows);
            // Auto-guess? (optional)
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        setLoading(true);
        try {
            const result = await api.bank.importCsv(accountId, filePath, mapping);
            if (result.error) throw new Error(result.error);
            onImportComplete(result);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Import Bank Transactions</h2>
                
                <div className="mb-4">
                    <label className="block mb-2 text-sm font-medium">Select CSV File</label>
                    <input 
                        type="file" 
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                    />
                </div>

                {error && (
                    <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4">
                        {error}
                    </div>
                )}

                {previewRows.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-md font-semibold mb-2">Column Mapping</h3>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs mb-1">Date Column</label>
                                <select 
                                    className="w-full bg-gray-700 rounded p-2 text-sm"
                                    value={mapping.dateIndex}
                                    onChange={e => setMapping({...mapping, dateIndex: Number(e.target.value)})}
                                >
                                    {previewRows[0].map((_, i) => <option key={i} value={i}>Column {i + 1}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs mb-1">Amount Column</label>
                                <select 
                                    className="w-full bg-gray-700 rounded p-2 text-sm"
                                    value={mapping.amountIndex}
                                    onChange={e => setMapping({...mapping, amountIndex: Number(e.target.value)})}
                                >
                                    {previewRows[0].map((_, i) => <option key={i} value={i}>Column {i + 1}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs mb-1">Description Column</label>
                                <select 
                                    className="w-full bg-gray-700 rounded p-2 text-sm"
                                    value={mapping.descIndex}
                                    onChange={e => setMapping({...mapping, descIndex: Number(e.target.value)})}
                                >
                                    {previewRows[0].map((_, i) => <option key={i} value={i}>Column {i + 1}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-gray-700 rounded">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-700/50 text-gray-300">
                                    <tr>
                                        {previewRows[0].map((_, i) => (
                                            <th key={i} className={`p-2 ${Object.values(mapping).includes(i) ? 'bg-blue-900/30 text-blue-200' : ''}`}>
                                                Col {i + 1}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewRows.slice(0, 5).map((row, rIdx) => (
                                        <tr key={rIdx} className="border-b border-gray-700/50">
                                            {row.map((cell, cIdx) => (
                                                <td key={cIdx} className="p-2 max-w-[200px] truncate">
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={onClose} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600">Cancel</button>
                    <button 
                        onClick={handleImport} 
                        disabled={!filePath || loading}
                        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                    >
                        {loading ? 'Importing...' : 'Import'}
                    </button>
                </div>
            </div>
        </div>
    );
};
