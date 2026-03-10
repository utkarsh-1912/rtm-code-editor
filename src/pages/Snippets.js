import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Trash2, Edit2, Copy, Check, X, Users } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../utils/api';
import toast from 'react-hot-toast';
import OrganizationSettings from '../components/OrganizationSettings';

const Snippets = () => {
    const { user } = useAuth();
    const [snippets, setSnippets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedId, setCopiedId] = useState(null);

    const [showModal, setShowModal] = useState(null); // 'create' | 'edit' | 'delete' | 'view'
    const [activeSnippet, setActiveSnippet] = useState(null);
    const [formData, setFormData] = useState({ title: '', code: '', language: 'javascript', tags: '', organizationId: null });
    const [selectedTag, setSelectedTag] = useState(null);
    const [organizations, setOrganizations] = useState([]);
    const [selectedVault, setSelectedVault] = useState('personal'); // 'personal' | orgId
    const [showOrgSettings, setShowOrgSettings] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const fetchOrgs = useCallback(async () => {
        if (!user) return;
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/organizations?userId=${user.uid}`);
            const data = await response.json();
            setOrganizations(data);
        } catch (err) { }
    }, [user]);

    const fetchSnippets = useCallback(async () => {
        if (!user) return;
        try {
            const backendUrl = getBackendUrl();
            const url = selectedVault === 'personal'
                ? `${backendUrl}/api/snippets?userId=${user.uid}`
                : `${backendUrl}/api/snippets?orgId=${selectedVault}`;
            const response = await fetch(url);
            const data = await response.json();
            setSnippets(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error("Failed to load snippets");
        } finally {
            setLoading(false);
        }
    }, [user, selectedVault]);

    useEffect(() => {
        fetchSnippets();
        fetchOrgs();
    }, [fetchSnippets, fetchOrgs]);

    const handleAction = async (e) => {
        if (e) e.preventDefault();
        const backendUrl = getBackendUrl();
        try {
            if (showModal === 'create') {
                await fetch(`${backendUrl}/api/snippets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...formData,
                        userId: user.uid,
                        tags: formData.tags.split(',').map(tag => tag.trim()).filter(t => t !== '')
                    })
                });
                toast.success("Snippet saved");
            } else if (showModal === 'edit') {
                await fetch(`${backendUrl}/api/snippets/${activeSnippet.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...formData,
                        tags: formData.tags.split(',').map(tag => tag.trim()).filter(t => t !== '')
                    })
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
            setFormData({
                title: snippet.title,
                code: snippet.code,
                language: snippet.language,
                tags: (snippet.tags || []).join(', '),
                organizationId: snippet.organization_id || null
            });
        } else {
            setFormData({
                title: '',
                code: '',
                language: 'javascript',
                tags: '',
                organizationId: selectedVault !== 'personal' ? selectedVault : null
            });
        }
    };

    const closeModal = () => {
        setShowModal(null);
        setActiveSnippet(null);
        setFormData({ title: '', code: '', language: 'javascript', tags: '', organizationId: null });
    };

    const copyToClipboard = (id, code) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredSnippets = snippets.filter(s => {
        const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.tags && s.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));

        const matchesTag = !selectedTag || (s.tags && s.tags.includes(selectedTag));

        return matchesSearch && matchesTag;
    });

    const allTags = Array.from(new Set(snippets.flatMap(s => s.tags || []))).sort();

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
                            fontSize: isMobile ? '24px' : '28px',
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
                    <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                        <button
                            onClick={() => setShowOrgSettings(true)}
                            style={{ ...secondaryButtonStyle, display: 'flex', alignItems: 'center', gap: '8px', flex: isMobile ? 1 : 'none' }}
                        >
                            <Users size={18} /> Teams
                        </button>
                        <button
                            onClick={() => openModal('create')}
                            style={{ ...primaryButtonStyle, display: 'flex', alignItems: 'center', gap: '8px', flex: isMobile ? 1 : 'none' }}
                        >
                            <Plus size={18} /> New Snippet
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
                    <button
                        onClick={() => setSelectedVault('personal')}
                        style={vaultButtonStyle(selectedVault === 'personal')}
                    >
                        My Vault
                    </button>
                    {organizations.map(org => (
                        <button
                            key={org.id}
                            onClick={() => setSelectedVault(org.id)}
                            style={vaultButtonStyle(selectedVault === org.id)}
                        >
                            {org.name}
                        </button>
                    ))}
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
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1, justifyContent: 'center' }}>
                            {allTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '20px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: selectedTag === tag ? 'var(--primary)' : 'var(--bg-dark)',
                                        color: selectedTag === tag ? 'white' : 'var(--text-muted)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    #{tag}
                                </button>
                            ))}
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            width: '100%',
                            maxWidth: isMobile ? '100%' : '300px',
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

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {snippet.tags && snippet.tags.map(tag => (
                                                <span key={tag} style={{
                                                    fontSize: '9px',
                                                    color: 'var(--text-muted)',
                                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px'
                                                }}>#{tag}</span>
                                            ))}
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
                                            <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: '600' }} onClick={() => openModal('view', snippet)}>
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
            {showModal === 'view' && activeSnippet && (
                <div style={modalOverlayStyle} onClick={closeModal}>
                    <div className="glass-effect premium-card" style={{ ...modalContentStyle, maxWidth: '900px', padding: '0', margin: isMobile ? '10px' : '0' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: isMobile ? '20px' : '32px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <h3 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '900', margin: 0 }}>{activeSnippet.title}</h3>
                                    <span style={{
                                        padding: '4px 10px', borderRadius: '6px',
                                        backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)',
                                        fontSize: '11px', fontWeight: '800', textTransform: 'uppercase'
                                    }}>{activeSnippet.language}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                                    <button onClick={() => copyToClipboard(activeSnippet.id, activeSnippet.code)} style={{ ...premiumButtonStyle, backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', flex: isMobile ? 1 : 'none', padding: isMobile ? '8px 12px' : '10px 16px' }}>
                                        {copiedId === activeSnippet.id ? <Check size={18} /> : <Copy size={18} />} {isMobile ? '' : 'Copy'}
                                    </button>
                                    <button onClick={() => openModal('edit', activeSnippet)} style={{ ...premiumButtonStyle, flex: isMobile ? 1 : 'none', padding: isMobile ? '8px 12px' : '10px 16px' }}>
                                        <Edit2 size={18} /> {isMobile ? '' : 'Edit'}
                                    </button>
                                    <button onClick={closeModal} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: isMobile ? '4px' : '8px' }}>
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>
                            <div style={{
                                flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '16px',
                                border: '1px solid var(--border-color)', padding: isMobile ? '16px' : '24px',
                                overflow: 'auto', maxHeight: '60vh'
                            }}>
                                <pre style={{ margin: 0, fontSize: isMobile ? '13px' : '14px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap' }}>
                                    <code>{activeSnippet.code}</code>
                                </pre>
                            </div>
                            {activeSnippet.tags && activeSnippet.tags.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {activeSnippet.tags.map(tag => (
                                        <span key={tag} style={{
                                            padding: '4px 12px', borderRadius: '20px',
                                            backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border-color)',
                                            color: 'var(--text-muted)', fontSize: '12px'
                                        }}>#{tag}</span>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span>Vault Fragment ID: {activeSnippet.id}</span>
                                <span>Last Secured: {new Date(activeSnippet.updated_at || activeSnippet.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                <label style={labelStyle}>Tags (Press Enter to add)</label>
                                <div style={{ ...modalInputStyle, display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', padding: '8px 12px' }}>
                                    {(formData.tags || "").split(',').filter(t => t.trim()).map((tag, i) => (
                                        <span key={i} style={{
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            backgroundColor: 'var(--primary)',
                                            color: 'white',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            #{tag.trim()}
                                            <X size={10} style={{ cursor: 'pointer' }} onClick={() => {
                                                const tags = formData.tags.split(',').filter(t => t.trim());
                                                tags.splice(i, 1);
                                                setFormData({ ...formData, tags: tags.join(', ') });
                                            }} />
                                        </span>
                                    ))}
                                    <input
                                        style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '14px', outline: 'none', flex: 1, minWidth: '100px' }}
                                        placeholder={formData.tags ? "" : "e.g. react, api"}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ',') {
                                                e.preventDefault();
                                                const val = e.target.value.trim();
                                                if (val && !formData.tags.includes(val)) {
                                                    setFormData({ ...formData, tags: formData.tags ? `${formData.tags}, ${val}` : val });
                                                    e.target.value = '';
                                                }
                                            }
                                        }}
                                    />
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

            <OrganizationSettings
                isOpen={showOrgSettings}
                onClose={() => { setShowOrgSettings(false); fetchOrgs(); }}
                userId={user?.uid}
            />

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

const premiumButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: 'white',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const vaultButtonStyle = (active) => ({
    padding: '8px 16px',
    borderRadius: '20px',
    backgroundColor: active ? 'var(--primary)' : 'var(--bg-card)',
    color: active ? 'white' : 'var(--text-muted)',
    border: `1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s'
});

export default Snippets;
