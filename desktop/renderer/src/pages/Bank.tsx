
import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { BankAccount } from '../../../../src/types/bank';
import { CsvMappingWizard } from '../components/CsvMappingWizard';
import { Page } from '../App';

interface Props {
    onNavigate: (page: Page, params?: any) => void;
}

export const BankPage: React.FC<Props> = ({ onNavigate }) => {
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCurrency, setNewCurrency] = useState('ILS');
    const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
    const [showImport, setShowImport] = useState(false);

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        const list = await api.bank.listAccounts();
        setAccounts(list);
    };

    const handleCreate = async () => {
        if (!newName) return;
        await api.bank.createAccount(newName, newCurrency);
        setNewName('');
        setShowCreate(false);
        loadAccounts();
    };

    const handleImportComplete = (stats: any) => {
        alert(`Import Complete!\nImported: ${stats.imported}\nSkipped: ${stats.skipped}`);
        loadAccounts(); // Refresh? Import doesn't change account list, but maybe status if we showed it.
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Bank Accounts</h1>
                <button 
                    onClick={() => setShowCreate(true)}
                    className="px-4 py-2 bg-green-600 rounded hover:bg-green-500"
                >
                    + Add Account
                </button>
            </div>

            {showCreate && (
                <div className="mb-6 p-4 bg-gray-800 rounded border border-gray-700">
                    <h3 className="font-semibold mb-2">New Account</h3>
                    <div className="flex gap-2">
                        <input 
                            className="bg-gray-700 p-2 rounded flex-1"
                            placeholder="Account Name (e.g. Poalim 1234)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                        />
                        <select 
                            className="bg-gray-700 p-2 rounded w-24"
                            value={newCurrency}
                            onChange={e => setNewCurrency(e.target.value)}
                        >
                            <option value="ILS">ILS</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                        </select>
                        <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 rounded">Create</button>
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                    </div>
                </div>
            )}

            <div className="grid gap-4">
                {accounts.length === 0 && (
                    <div className="text-gray-400 text-center py-10">
                        No bank accounts found. Create one to get started.
                    </div>
                )}
                
                {accounts.map(acc => (
                    <div key={acc.id} className="bg-gray-800 p-4 rounded border border-gray-700 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-white">{acc.name}</h3>
                            <span className="text-sm text-gray-400">Currency: {acc.currency || 'N/A'}</span>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => { setSelectedAccount(acc.id); setShowImport(true); }}
                                className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded border border-blue-500/30 hover:bg-blue-600/40"
                            >
                                Import CSV
                            </button>
                            <button 
                                onClick={() => onNavigate('reconciliation', { accountId: acc.id })}
                                className="px-3 py-1 bg-purple-600/20 text-purple-300 rounded border border-purple-500/30 hover:bg-purple-600/40"
                            >
                                Reconciliation
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {showImport && selectedAccount && (
                <CsvMappingWizard 
                    accountId={selectedAccount}
                    onClose={() => setShowImport(false)}
                    onImportComplete={handleImportComplete}
                />
            )}
        </div>
    );
};
