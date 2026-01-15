import React, { useEffect, useState } from 'react';
import { api } from '../api';

const Settings: React.FC = () => {
    const [info, setInfo] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    const refresh = () => {
        api.getAppInfo().then(setInfo);
        api.getSettings().then(setSettings);
        api.doctor().then(res => console.log('Doctor:', res));
    };

    useEffect(() => {
        refresh();
    }, []);

    const updateSettings = (section: string, key: string, value: any) => {
        setSettings((prev: any) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    const save = async () => {
        setSaving(true);
        try {
            await api.saveSettings(settings);
            setMsg('Settings saved!');
            setTimeout(() => setMsg(''), 3000);
        } catch (e) {
            setMsg('Failed to save settings');
        }
        setSaving(false);
    };

    const handleAuth = async (provider: 'gmail' | 'dropbox') => {
        setLoading(true);
        setMsg(`Authenticating ${provider}... check browser.`);
        try {
            const res = provider === 'gmail' 
                ? await api.authGmailStart() 
                : await api.authDropboxStart();
            
            if (res.ok) {
                setMsg('Success!');
                refresh();
            } else {
                setMsg('Error: ' + (res as any).error);
            }
        } catch (e) {
            setMsg('Failed to call helper');
        }
        setLoading(false);
    };

    if (!info) return <div>Loading settings...</div>;

    return (
        <div>
            <h1>Settings</h1>
            
            <div className="card">
                <h3>Authentication</h3>
                {msg && <div style={{ padding: 10, background: '#eef', marginBottom: 10, borderRadius: 4 }}>{msg}</div>}

                <div style={{ display: 'flex', gap: 20 }}>
                    <div>
                        <h4>Gmail</h4>
                        <p>Status: {info.auth.gmail ? '✅ Connected' : '❌ Not Token Found'}</p>
                        <button className="btn" disabled={loading} onClick={() => handleAuth('gmail')}>
                            {info.auth.gmail ? 'Re-Authenticate' : 'Authenticate Gmail'}
                        </button>
                    </div>

                    <div>
                        <h4>Dropbox</h4>
                        <p>Status: {info.auth.dropbox ? '✅ Connected' : '❌ Not Token Found'}</p>
                        <button className="btn" disabled={loading} onClick={() => handleAuth('dropbox')}>
                            {info.auth.dropbox ? 'Re-Authenticate' : 'Authenticate Dropbox'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="card">
                <h3>Export Configuration</h3>
                {!settings ? <div>Loading settings...</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Dropbox Base Folder</label>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <input 
                                    type="text" 
                                    value={settings.export.dropboxPath} 
                                    onChange={e => updateSettings('export', 'dropboxPath', e.target.value)}
                                    placeholder="/FetchExpanse"
                                    style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
                                />
                            </div>
                            <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>
                                Folder where exports will be created. E.g. <code>/Tax</code> or <code>/Company/Expenses</code>.
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Organization Scheme</label>
                            <select 
                                value={settings.export.scheme} 
                                onChange={e => updateSettings('export', 'scheme', e.target.value)}
                                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
                            >
                                <option value="MONTH_VENDOR">Year/Month &gt; Vendor &gt; Type</option>
                                <option value="VENDOR_MONTH">Vendor &gt; Year/Month &gt; Type</option>
                                <option value="TYPE_MONTH">Type &gt; Year/Month &gt; Vendor</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                            <button className="btn btn-primary" onClick={save} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="card">
                <h3>Gmail Helper</h3>
                {!settings ? <div>Loading...</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                            <input 
                                type="checkbox" 
                                checked={settings.gmail.labelOnDecision} 
                                onChange={e => updateSettings('gmail', 'labelOnDecision', e.target.checked)}
                            />
                            Apply labels when I mark items (Expense/Not Expense)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                            <input 
                                type="checkbox" 
                                checked={settings.gmail.labelOnExport} 
                                onChange={e => updateSettings('gmail', 'labelOnExport', e.target.checked)}
                            />
                            Apply "Exported" label after successful export
                        </label>
                         <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                            <button className="btn btn-primary" onClick={save} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="card">
                <h3>System</h3>
                <p>Data Directory: <code>{info.dataDir}</code></p>
                <p>DB Path: <code>{info.dbPath}</code></p>
                <button className="btn" style={{background: '#666'}} onClick={() => api.doctor().then(d => alert(JSON.stringify(d, null, 2)))}>
                    Run Doctor (View JSON)
                </button>
            </div>
        </div>
    );
};

export default Settings;
