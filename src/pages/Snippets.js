import React, { useState, useEffect } from 'react';
import { Code, Database, Search, Filter, Plus, Terminal, Trash2, Edit2, Copy, Check, MoreVertical } from 'lucide-react';
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

    const fetchSnippets = async () => {
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
    };

    useEffect(() => {
        fetchSnippets();
    }, [user]);

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.5px' }}>My Library</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Store and manage your most used code fragments.</p>
                </div>
                <button
                    onClick={() => openModal('create')}
                    style={primaryButtonStyle}
                >
                    <Plus size={20} /> New Snippet
                </button>
            </div>

            <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                padding: '32px',
                minHeight: '500px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', gap: '20px' }}>
                    <div style={searchContainerStyle}>
                        <Search size={18} color="var(--text-muted)" />
                        <input
                            placeholder="Search in snippets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={searchInputStyle}
                        />
                    </div>
                </div>

                {loading ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        Organizing your collection...
                    </div>
                ) : filteredSnippets.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                        {filteredSnippets.map((snippet) => (
                            <div key={snippet.id} style={snippetCardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={langBadgeStyle}>{snippet.language}</div>
                                        <h4 style={{ fontWeight: '700', fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{snippet.title}</h4>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => copyToClipboard(snippet.id, snippet.code)} style={iconButtonStyle}>
                                            {copiedId === snippet.id ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                                        </button>
                                        <button onClick={() => openModal('edit', snippet)} style={iconButtonStyle}><Edit2 size={16} /></button>
                                        <button onClick={() => openModal('delete', snippet)} style={{ ...iconButtonStyle, color: '#f87171' }}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <div style={codePreviewStyle}>
                                    <code>{snippet.code.substring(0, 150)}{snippet.code.length > 150 ? '...' : ''}</code>
                                </div>
                                <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} /> Last updated: {new Date(snippet.updated_at).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                        <div style={emptyIconContainerStyle}><Database size={40} /></div>
                        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>Your library is empty</h3>
                        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', marginBottom: '32px' }}>
                            Start saving reusable logic to speed up your development workflow.
                        </p>
                        <button onClick={() => openModal('create')} style={secondaryButtonStyle}>Create First Snippet</button>
                    </div>
                )}
            </div>

            {/* Modals */}
            {(showModal === 'create' || showModal === 'edit') && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '32px' }}>
                            {showModal === 'create' ? 'Create New Snippet' : 'Edit Snippet'}
                        </h3>
                        <form onSubmit={handleAction} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div>
                                <label style={labelStyle}>Title</label>
                                <input
                                    required
                                    style={modalInputStyle}
                                    placeholder="e.g. Auth Guard Middleware"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                                <div>
                                    <label style={labelStyle}>Language</label>
                                    <select
                                        style={modalInputStyle}
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
                            <div>
                                <label style={labelStyle}>Code Block</label>
                                <textarea
                                    required
                                    style={{ ...modalInputStyle, height: '200px', fontFamily: 'monospace', fontSize: '13px' }}
                                    placeholder="Paste your code here..."
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '16px' }}>
                                <button type="button" onClick={closeModal} style={cancelButtonStyle}>Discard</button>
                                <button type="submit" style={confirmButtonStyle}>
                                    {showModal === 'create' ? 'Save Snippet' : 'Update Content'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showModal === 'delete' && (
                <div style={modalOverlayStyle}>
                    <div style={{ ...modalContentStyle, maxWidth: '420px', textAlign: 'center' }}>
                        <div style={{ color: '#f87171', marginBottom: '20px' }}><Trash2 size={48} /></div>
                        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '12px' }}>Remove Snippet?</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6' }}>
                            Are you sure you want to delete <b>{activeSnippet.title}</b>? This cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={closeModal} style={{ ...cancelButtonStyle, flex: 1 }}>Cancel</button>
                            <button onClick={handleAction} style={{ ...confirmButtonStyle, backgroundColor: '#f87171', flex: 1 }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
};

// Styles
const primaryButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 24px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 8px 16px rgba(0, 59, 251, 0.2)'
};

const secondaryButtonStyle = {
    padding: '12px 24px',
    backgroundColor: 'var(--bg-dark)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    fontWeight: '700',
    cursor: 'pointer'
};

const searchContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'var(--bg-dark)',
    padding: '10px 16px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    width: '100%',
    maxWidth: '400px'
};

const searchInputStyle = {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-main)',
    fontSize: '14px',
    width: '100%'
};

const snippetCardStyle = {
    padding: '20px',
    backgroundColor: 'var(--bg-dark)',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column'
};

const langBadgeStyle = {
    padding: '4px 8px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: 'var(--primary)',
    borderRadius: '6px',
    fontSize: '10px',
    fontWeight: '800',
    textTransform: 'uppercase'
};

const iconButtonStyle = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s'
};

const codePreviewStyle = {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: '16px',
    borderRadius: '12px',
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    overflow: 'hidden',
    marginTop: '4px'
};

const emptyIconContainerStyle = {
    width: '80px',
    height: '80px',
    borderRadius: '24px',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '24px',
    color: 'var(--border-color)'
};

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '24px'
};

const modalContentStyle = {
    backgroundColor: 'var(--bg-card)',
    padding: '40px',
    borderRadius: '24px',
    border: '1px solid var(--border-color)',
    width: '100%',
    maxWidth: '600px'
};

const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    marginBottom: '8px',
    textTransform: 'uppercase'
};

const modalInputStyle = {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    color: 'var(--text-main)',
    fontSize: '15px'
};

const cancelButtonStyle = {
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    color: 'var(--text-muted)',
    fontWeight: '600',
    cursor: 'pointer'
};

const confirmButtonStyle = {
    padding: '12px 24px',
    backgroundColor: 'var(--primary)',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontWeight: '700',
    cursor: 'pointer'
};

const Clock = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);

export default Snippets;
