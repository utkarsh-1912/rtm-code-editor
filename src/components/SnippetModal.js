import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Import, ClipboardList } from 'lucide-react';
import { getBackendUrl } from '../utils/api';
import toast from 'react-hot-toast';

const SnippetModal = ({ isOpen, onClose, onImport, userId }) => {
    const [snippets, setSnippets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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
        fetchSnippets();
    }, [fetchSnippets]);

    const filteredSnippets = snippets.filter(s =>
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.language.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
        }} onClick={onClose}>
            <div style={{
                backgroundColor: 'var(--bg-card)',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '80vh',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)'
                        }}>
                            <ClipboardList size={22} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>Import Snippet</h3>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Choose a snippet to insert into the editor</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '8px',
                        transition: '0.2s'
                    }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: '16px 24px', backgroundColor: 'var(--bg-dark)' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 16px',
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <Search size={18} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="Search your snippets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                fontSize: '14px',
                                width: '100%',
                                outline: 'none'
                            }}
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading snippets...</div>
                    ) : filteredSnippets.length > 0 ? (
                        filteredSnippets.map(snippet => (
                            <div key={snippet.id} style={{
                                padding: '16px',
                                backgroundColor: 'var(--bg-dark)',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: '0.2s',
                                cursor: 'default'
                            }}>
                                <div style={{ overflow: 'hidden' }}>
                                    <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{snippet.title}</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            padding: '2px 6px',
                                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                            color: 'var(--primary)',
                                            borderRadius: '4px',
                                            textTransform: 'uppercase'
                                        }}>{snippet.language}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{snippet.code.length} chars</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => onImport(snippet.code, 'replace')}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'transparent',
                                            color: 'var(--text-main)',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: '0.2s'
                                        }}
                                        title="Replace all current code with this snippet"
                                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                    >
                                        Replace All
                                    </button>
                                    <button
                                        onClick={() => onImport(snippet.code, 'insert')}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            backgroundColor: 'var(--primary)',
                                            color: 'white',
                                            border: 'none',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                        title="Insert snippet at cursor position"
                                    >
                                        <Import size={14} /> Insert
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>No snippets found.</p>
                            <a href="/snippets" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>Create one now →</a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SnippetModal;
