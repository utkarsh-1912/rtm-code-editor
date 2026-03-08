import React, { useState, useEffect, useCallback } from 'react';
import { Database, Search, Plus, Trash2, Edit2, Copy, Check } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../utils/api';
import toast from 'react-hot-toast';

const Snippets = () => {
    const { user } = useAuth();
    const [snippets, setSnippets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedId, setCopiedId] = useState(null);

    // Modal States
    const [showModal, setShowModal] = useState(null); // 'create' | 'edit' | 'delete'
    const [activeSnippet, setActiveSnippet] = useState(null);
    const [formData, setFormData] = useState({ title: '', code: '', language: 'javascript' });

    const fetchSnippets = useCallback(async () => {
        if (!user) return;
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/snippets?userId=${user.uid}`);
            const data = await response.json();
            setSnippets(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error("Failed to load snippets");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchSnippets();
    }, [fetchSnippets]);

    const handleAction = async (e) => {
        e.preventDefault();
        const backendUrl = getBackendUrl();
        try {
            if (showModal === 'create') {
                await fetch(`${backendUrl}/api/snippets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...formData, userId: user.uid })
                });
                toast.success("Snippet saved");
            } else if (showModal === 'edit') {
                await fetch(`${backendUrl}/api/snippets/${activeSnippet.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                toast.success("Snippet updated");
            } else if (showModal === 'delete') {
                await fetch(`${backendUrl}/api/snippets/${activeSnippet.id}`, {
                    method: 'DELETE'
                });
                toast.success("Snippet removed");
            }
            fetchSnippets();
            closeModal();
        } catch (err) {
            toast.error("Operation failed");
        }
    };

    const openModal = (type, snippet = null) => {
        setShowModal(type);
        if (snippet) {
            setActiveSnippet(snippet);
            setFormData({ title: snippet.title, code: snippet.code, language: snippet.language });
        } else {
            setFormData({ title: '', code: '', language: 'javascript' });
        }
    };

    const closeModal = () => {
        setShowModal(null);
        setActiveSnippet(null);
        setFormData({ title: '', code: '', language: 'javascript' });
    };

    const copyToClipboard = (id, code) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredSnippets = snippets.filter(s =>
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.language.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppLayout>
            <div className="snippets-page">
                <div className="snippets-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '32px',
                    gap: '20px',
                    flexWrap: 'wrap'
                }}>
                    <div>
                        <h1 style={{
                            fontSize: '28px',
                            fontWeight: '700',
                            margin: '0 0 4px',
                            color: 'var(--text-main)'
                        }}>
                            Snippet Library
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            Store and manage your reusable logic blocks.
                        </p>
                    </div>
                    <button
                        onClick={() => openModal('create')}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s'
                        }}
                    >
                        <Plus size={18} /> New Snippet
                    </button>
                </div>

                <div style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '20px'
                    }}>
                        <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>All Fragments</h2>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            width: '100%',
                            maxWidth: '300px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-dark)'
                        }}>
                            <Search size={14} color="var(--text-muted)" />
                            <input
                                type="text"
                                placeholder="Search snippets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '13px',
                                    width: '100%',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ padding: '24px' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
                        ) : filteredSnippets.length > 0 ? (
                            <div className="snippets-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                                gap: '16px'
                            }}>
                                {filteredSnippets.map((snippet) => (
                                    <div key={snippet.id} style={{
                                        padding: '20px',
                                        backgroundColor: 'var(--bg-dark)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '16px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    padding: '4px 8px',
                                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                                    color: 'var(--primary)',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {snippet.language}
                                                </div>
                                                <h4 style={{
                                                    margin: 0,
                                                    fontWeight: '600',
                                                    fontSize: '15px',
                                                    maxWidth: '160px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    color: 'var(--text-main)'
                                                }}>
                                                    {snippet.title}
                                                </h4>
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button onClick={() => copyToClipboard(snippet.id, snippet.code)} style={iconButtonStyle}>
                                                    {copiedId === snippet.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                                </button>
                                                <button onClick={() => openModal('edit', snippet)} style={iconButtonStyle}><Edit2 size={14} /></button>
                                                <button onClick={() => openModal('delete', snippet)} style={{ ...iconButtonStyle, color: '#f87171' }}><Trash2 size={14} /></button>
                                            </div>
                                        </div>

                                        <div style={{
                                            backgroundColor: 'rgba(0,0,0,0.2)',
                                            borderRadius: '6px',
                                            padding: '12px',
                                            fontSize: '12px',
                                            fontFamily: 'monospace',
                                            color: 'rgba(255,255,255,0.6)',
                                            height: '100px',
                                            overflow: 'hidden',
                                            border: '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <code style={{ whiteSpace: 'pre-wrap' }}>
                                                {snippet.code.substring(0, 150)}{snippet.code.length > 150 ? '...' : ''}
                                            </code>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontSize: '11px',
                                            color: 'var(--text-muted)'
                                        }}>
                                            <span>{new Date(snippet.updated_at || snippet.created_at).toLocaleDateString()}</span>
                                            <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: '600' }} onClick={() => openModal('edit', snippet)}>
                                                Expand
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '60px 0', textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>No fragments in your library.</p>
                                <button onClick={() => openModal('create')} style={{
                                    padding: '8px 16px',
                                    backgroundColor: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: 'var(--text-main)',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}>
                                    Create Snippet
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {(showModal === 'create' || showModal === 'edit') && (
                <div style={modalOverlayStyle} onClick={closeModal}>
                    <div className="glass-effect premium-card" style={{ ...modalContentStyle, maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '26px', fontWeight: '900', margin: 0 }}>
                                {showModal === 'create' ? 'Create Snippet' : 'Update Content'}
                            </h3>
                            <div style={{ color: 'var(--primary)' }}><Plus size={28} /></div>
                        </div>

                        <form onSubmit={handleAction} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px' }}>
                                <div>
                                    <label style={labelStyle}>Snippet Title</label>
                                    <input
                                        required
                                        style={modalInputStyle}
                                        placeholder="e.g. JWT Authentication Hook"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Language</label>
                                    <div className="glass-effect" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                        <select
                                            style={{ ...modalInputStyle, border: 'none' }}
                                            value={formData.language}
                                            onChange={e => setFormData({ ...formData, language: e.target.value })}
                                        >
                                            <option value="javascript">JavaScript</option>
                                            <option value="python">Python</option>
                                            <option value="css">CSS</option>
                                            <option value="html">HTML</option>
                                            <option value="cpp">C++</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Code Block</label>
                                <textarea
                                    required
                                    style={{
                                        ...modalInputStyle,
                                        height: '320px',
                                        fontFamily: 'monospace',
                                        fontSize: '14px',
                                        lineHeight: 1.6,
                                        resize: 'none'
                                    }}
                                    placeholder="// Paste your code fragment here..."
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '12px' }}>
                                <button type="button" onClick={closeModal} style={secondaryButtonStyle}>Discard</button>
                                <button type="submit" style={primaryButtonStyle}>
                                    {showModal === 'create' ? 'Save to Vault' : 'Sync Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showModal === 'delete' && (
                <div style={modalOverlayStyle} onClick={closeModal}>
                    <div className="glass-effect premium-card" style={{ ...modalContentStyle, maxWidth: '420px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ color: '#f43f5e', marginBottom: '24px' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(244, 63, 94, 0.1)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Trash2 size={40} />
                            </div>
                        </div>
                        <h3 style={{ fontSize: '22px', fontWeight: '900', marginBottom: '12px' }}>Remove Snippet?</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '15px', lineHeight: 1.6 }}>
                            Are you certain about deleting <b>{activeSnippet?.title}</b>? This action is irreversible.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={closeModal} style={{ ...secondaryButtonStyle, flex: 1 }}>Not Now</button>
                            <button onClick={handleAction} style={{ ...primaryButtonStyle, backgroundColor: '#f43f5e', flex: 1, boxShadow: '0 8px 25px rgba(244, 63, 94, 0.3)' }}>Delete Legacy</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .loader {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(59, 130, 246, 0.1);
                    border-top: 3px solid var(--primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @media (max-width: 640px) {
                    .snippets-header { margin-bottom: 32px !important; }
                    .snippets-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
                    .premium-card { padding: 24px !important; }
                }
            `}</style>
        </AppLayout>
    );
};

// Styles
const primaryButtonStyle = {
    padding: '10px 20px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
};

const secondaryButtonStyle = {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer'
};

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '24px',
    backdropFilter: 'blur(4px)'
};

const modalContentStyle = {
    backgroundColor: 'var(--bg-card)',
    padding: '32px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    width: '100%',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
};

const modalInputStyle = {
    width: '100%',
    padding: '12px 14px',
    backgroundColor: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-main)',
    fontSize: '14px',
    outline: 'none'
};

const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    marginBottom: '8px',
    textTransform: 'uppercase'
};

const iconButtonStyle = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    transition: 'all 0.2s'
};

export default Snippets;
