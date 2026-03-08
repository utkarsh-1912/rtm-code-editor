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
            <div className="snippets-page" style={{ padding: '0 20px', maxWidth: '1400px', margin: '0 auto' }}>
                <div className="snippets-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '64px',
                    padding: '20px 0',
                    borderBottom: '1px solid var(--border-color)',
                    flexWrap: 'wrap',
                    gap: '24px'
                }}>
                    <div>
                        <h1 style={{
                            fontSize: 'clamp(32px, 5vw, 42px)',
                            fontWeight: '900',
                            margin: '0 0 12px',
                            background: 'linear-gradient(135deg, #fff 0%, var(--text-muted) 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-1px'
                        }}>
                            Snippet Library
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '16px', fontWeight: '500' }}>
                            Store and manage your reusable logic blocks.
                        </p>
                    </div>
                    <button
                        onClick={() => openModal('create')}
                        className="glass-effect premium-button"
                        style={{
                            padding: '14px 28px',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '16px',
                            fontWeight: '750',
                            fontSize: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            boxShadow: '0 8px 30px rgba(59, 130, 246, 0.4)',
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        <Plus size={20} strokeWidth={3} />
                        New Snippet
                    </button>
                </div>

                <div className="glass-effect" style={{
                    borderRadius: '32px',
                    border: '1px solid var(--border-color)',
                    padding: '40px',
                    minHeight: '600px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 30px 60px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>All Fragments</h2>
                        <div className="glass-effect" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '14px 24px',
                            borderRadius: '18px',
                            width: '100%',
                            maxWidth: '440px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)'
                        }}>
                            <Search size={20} color="var(--text-muted)" />
                            <input
                                type="text"
                                placeholder="Search by title, code or language..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '15px',
                                    width: '100%',
                                    outline: 'none',
                                    fontWeight: '500'
                                }}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            <div className="loader" style={{ marginBottom: '20px' }}></div>
                            <p style={{ fontWeight: '600' }}>Organizing your collection...</p>
                        </div>
                    ) : filteredSnippets.length > 0 ? (
                        <div className="snippets-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                            gap: '32px'
                        }}>
                            {filteredSnippets.map((snippet) => (
                                <div key={snippet.id} className="premium-card glass-effect" style={{
                                    padding: '28px',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '20px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                padding: '6px 12px',
                                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                                color: 'var(--primary)',
                                                borderRadius: '8px',
                                                fontSize: '11px',
                                                fontWeight: '800',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em'
                                            }}>
                                                {snippet.language}
                                            </div>
                                            <h4 style={{
                                                margin: 0,
                                                fontWeight: '800',
                                                fontSize: '18px',
                                                maxWidth: '180px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {snippet.title}
                                            </h4>
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button onClick={() => copyToClipboard(snippet.id, snippet.code)} style={iconButtonStyle} title="Copy Code">
                                                {copiedId === snippet.id ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
                                            </button>
                                            <button onClick={() => openModal('edit', snippet)} style={iconButtonStyle} title="Edit Snippet"><Edit2 size={18} /></button>
                                            <button onClick={() => openModal('delete', snippet)} style={{ ...iconButtonStyle, color: '#f43f5e' }} title="Delete Snippet"><Trash2 size={18} /></button>
                                        </div>
                                    </div>

                                    <div className="glass-effect" style={{
                                        backgroundColor: 'rgba(0,0,0,0.4)',
                                        borderRadius: '16px',
                                        padding: '20px',
                                        fontSize: '13px',
                                        fontFamily: 'monospace',
                                        color: 'rgba(255,255,255,0.7)',
                                        height: '140px',
                                        overflow: 'hidden',
                                        position: 'relative'
                                    }}>
                                        <code style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                            {snippet.code.substring(0, 200)}{snippet.code.length > 200 ? '...' : ''}
                                        </code>
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            height: '40px',
                                            background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                                            pointerEvents: 'none'
                                        }}></div>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '12px',
                                        color: 'var(--text-muted)',
                                        fontWeight: '600'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '14px', height: '14px' }}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                            </div>
                                            {new Date(snippet.updated_at || snippet.created_at).toLocaleDateString()}
                                        </div>
                                        <div style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: '800' }} onClick={() => openModal('edit', snippet)}>
                                            View Full Content
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                            <div style={{
                                width: '100px',
                                height: '100px',
                                borderRadius: '32px',
                                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                                color: 'var(--text-muted)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '32px'
                            }}>
                                <Database size={48} />
                            </div>
                            <h3 style={{ fontSize: '26px', fontWeight: '900', marginBottom: '16px' }}>Library is empty</h3>
                            <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 40px', fontSize: '16px', lineHeight: 1.6 }}>
                                Start building your personal vault of reusable code fragments to accelerate your daily workflow.
                            </p>
                            <button onClick={() => openModal('create')} className="premium-button" style={{
                                padding: '14px 32px',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: '14px',
                                color: 'var(--text-main)',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}>
                                Create First Snippet
                            </button>
                        </div>
                    )}
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
    padding: '14px 28px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    fontWeight: '800',
    fontSize: '15px',
    cursor: 'pointer',
    boxShadow: '0 8px 25px rgba(59, 130, 246, 0.3)',
    transition: 'all 0.2s'
};

const secondaryButtonStyle = {
    padding: '14px 28px',
    backgroundColor: 'transparent',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    fontWeight: '700',
    fontSize: '15px',
    cursor: 'pointer'
};

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '24px'
};

const modalContentStyle = {
    backgroundColor: 'var(--bg-card)',
    padding: '48px',
    borderRadius: '32px',
    border: '1px solid var(--border-color)',
    width: '100%',
    boxShadow: '0 30px 60px rgba(0,0,0,0.5)'
};

const modalInputStyle = {
    width: '100%',
    padding: '16px 20px',
    backgroundColor: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    color: 'var(--text-main)',
    fontSize: '15px',
    outline: 'none'
};

const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '800',
    color: 'var(--text-muted)',
    marginBottom: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
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
