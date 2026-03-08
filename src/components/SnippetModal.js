import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Import, Save, Shield, Code } from 'lucide-react';
import { getBackendUrl } from '../utils/api';
import toast from 'react-hot-toast';

const SnippetModal = ({ isOpen, onClose, onImport, userId, code: currentCode, language: currentLanguage }) => {
    const [snippets, setSnippets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('import'); // 'import' | 'save'
    const [saveData, setSaveData] = useState({ title: '', language: currentLanguage || 'javascript' });
    const [isSaving, setIsSaving] = useState(false);

    const fetchSnippets = useCallback(async () => {
        if (!userId || !isOpen) return;
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/snippets?userId=${userId}`);
            const data = await response.json();
            setSnippets(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error("Failed to load snippets");
        } finally {
            setLoading(false);
        }
    }, [userId, isOpen]);

    useEffect(() => {
        if (isOpen && activeTab === 'import') {
            fetchSnippets();
        }
    }, [fetchSnippets, isOpen, activeTab]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!saveData.title.trim()) return toast.error("Please enter a title");

        setIsSaving(true);
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/snippets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    title: saveData.title,
                    code: currentCode,
                    language: saveData.language
                })
            });

            if (response.ok) {
                toast.success("Snippet saved to Vault");
                setActiveTab('import');
                fetchSnippets();
            } else {
                throw new Error("Failed to save");
            }
        } catch (err) {
            toast.error("Operation failed");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSync = async (snippet) => {
        if (!currentCode) return toast.error("No code to sync");

        setIsSaving(true);
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/snippets/${snippet.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: snippet.title,
                    code: currentCode,
                    language: snippet.language
                })
            });

            if (response.ok) {
                toast.success(`Synced with ${snippet.title}`);
                fetchSnippets();
            } else {
                throw new Error("Failed to sync");
            }
        } catch (err) {
            toast.error("Sync failed");
        } finally {
            setIsSaving(false);
        }
    };

    const filteredSnippets = snippets.filter(s =>
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.language.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '20px'
        }} onClick={onClose}>
            <div style={{
                backgroundColor: 'var(--bg-card)', width: '100%', maxWidth: '640px',
                maxHeight: '85vh', borderRadius: '24px', border: '1px solid var(--border-color)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{
                            padding: '10px', borderRadius: '12px',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)'
                        }}>
                            <Shield size={22} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>Snippet Vault</h3>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Securely manage your reusable logic blocks</p>
                        </div>
                        <button onClick={onClose} style={{
                            position: 'absolute', top: '24px', right: '24px',
                            background: 'transparent', border: 'none', color: 'var(--text-muted)',
                            cursor: 'pointer', padding: '8px'
                        }}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-dark)', padding: '4px', borderRadius: '12px' }}>
                        <button
                            onClick={() => setActiveTab('import')}
                            style={tabStyle(activeTab === 'import')}
                        >
                            Browse Vault
                        </button>
                        <button
                            onClick={() => setActiveTab('save')}
                            style={tabStyle(activeTab === 'save')}
                        >
                            Save Current
                        </button>
                    </div>
                </div>

                {activeTab === 'import' ? (
                    <>
                        <div style={{ padding: '16px 24px' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '12px 16px', backgroundColor: 'var(--bg-dark)',
                                borderRadius: '12px', border: '1px solid var(--border-color)'
                            }}>
                                <Search size={18} color="var(--text-muted)" />
                                <input
                                    type="text" placeholder="Search snippets..."
                                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '14px', width: '100%', outline: 'none' }}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
                            ) : filteredSnippets.length > 0 ? (
                                filteredSnippets.map(snippet => (
                                    <div key={snippet.id} style={snippetCardStyle}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{snippet.title}</h4>
                                                <span style={langBadgeStyle}>{snippet.language}</span>
                                            </div>
                                            <div style={previewStyle}>
                                                <code>{snippet.code.slice(0, 80)}{snippet.code.length > 80 ? '...' : ''}</code>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <button
                                                onClick={() => onImport(snippet.code, 'insert')}
                                                style={actionButtonStyle(true)}
                                            >
                                                Add Snippet
                                            </button>
                                            <button
                                                onClick={() => handleSync(snippet)}
                                                disabled={isSaving}
                                                style={actionButtonStyle(false)}
                                            >
                                                Sync Changes
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Vault is empty or no matches found.</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)' }}>SNIPPET TITLE</label>
                            <input
                                placeholder="e.g. Binary Search implementation"
                                value={saveData.title}
                                onChange={e => setSaveData({ ...saveData, title: e.target.value })}
                                style={inputStyle}
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)' }}>LANGUAGE</label>
                            <select
                                value={saveData.language}
                                onChange={e => setSaveData({ ...saveData, language: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="cpp">C++</option>
                                <option value="java">Java</option>
                                <option value="html">HTML</option>
                                <option value="css">CSS</option>
                            </select>
                        </div>
                        <div style={{ backgroundColor: 'var(--bg-dark)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-muted)' }}>
                                <Code size={14} /> <span style={{ fontSize: '12px', fontWeight: '600' }}>CURRENT CODE PREVIEW</span>
                            </div>
                            <pre style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', whiteSpace: 'pre-wrap', maxHeight: '100px' }}>
                                {currentCode || '// No code to save'}
                            </pre>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !currentCode}
                            style={{
                                padding: '16px', borderRadius: '12px',
                                backgroundColor: 'var(--primary)', color: 'white',
                                border: 'none', fontWeight: '700', fontSize: '16px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                cursor: 'pointer', transition: 'all 0.2s',
                                opacity: (isSaving || !currentCode) ? 0.6 : 1
                            }}
                        >
                            {isSaving ? 'Securing...' : <><Save size={20} /> Save to Vault</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const tabStyle = (active) => ({
    flex: 1, padding: '10px', border: 'none', borderRadius: '10px',
    backgroundColor: active ? 'var(--bg-card)' : 'transparent',
    color: active ? 'var(--text-main)' : 'var(--text-muted)',
    fontSize: '13px', fontWeight: '700', cursor: 'pointer',
    transition: 'all 0.2s', boxShadow: active ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
});

const snippetCardStyle = {
    padding: '16px', backgroundColor: 'var(--bg-dark)', borderRadius: '16px',
    border: '1px solid var(--border-color)', display: 'flex', gap: '16px',
    alignItems: 'center', transition: 'all 0.2s'
};

const langBadgeStyle = {
    fontSize: '9px', fontWeight: '800', padding: '2px 6px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)',
    borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
};

const previewStyle = {
    backgroundColor: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px',
    fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace',
    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
};

const actionButtonStyle = (isPrimary) => ({
    padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '700',
    cursor: 'pointer', transition: 'all 0.2s', border: 'none',
    backgroundColor: isPrimary ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
    color: isPrimary ? 'white' : 'var(--text-main)',
    display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
});

const inputStyle = {
    padding: '14px 16px', backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border-color)',
    borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none'
};

export default SnippetModal;
