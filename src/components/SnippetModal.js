import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Save } from 'lucide-react';
import { Modal } from './ux/primitives';
import { SNIPPET_LANGS } from '../utils/languages';
import { getBackendUrl } from '../utils/api';
import toast from 'react-hot-toast';

const SnippetModal = ({ isOpen, onClose, onImport, userId, code: currentCode, language: currentLanguage }) => {
    const [snippets, setSnippets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('import'); // 'import' | 'save'
    const [saveData, setSaveData] = useState({ title: '', language: currentLanguage || 'javascript', tags: '' });
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
        e?.preventDefault?.();
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
                    language: saveData.language,
                    tags: saveData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
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
                    language: snippet.language,
                    tags: snippet.tags || []
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
        s.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.tags && s.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    if (!isOpen) return null;

    const tagList = (saveData.tags || '').split(',').map((t) => t.trim()).filter(Boolean);

    return (
        <Modal
            open
            onClose={onClose}
            wide
            label="Snippets"
            title={activeTab === 'import' ? 'Insert a snippet' : 'Save this code'}
            onSubmit={activeTab === 'save' ? handleSave : undefined}
            footer={activeTab === 'save' ? <>
                <button type="button" className="u-btn u-btn--ghost" onClick={() => setActiveTab('import')}>Back</button>
                <button type="submit" className="u-btn u-btn--solid" disabled={isSaving || !currentCode}><Save size={15} /> {isSaving ? 'Saving…' : 'Save snippet'}</button>
            </> : null}
        >
            <div className="u-seg" role="tablist" style={{ alignSelf: 'flex-start' }}>
                <button type="button" className={activeTab === 'import' ? 'on' : ''} onClick={() => setActiveTab('import')}>Browse</button>
                <button type="button" className={activeTab === 'save' ? 'on' : ''} onClick={() => setActiveTab('save')}>Save current code</button>
            </div>

            {activeTab === 'import' ? (
                <>
                    <label className="u-search">
                        <Search size={15} />
                        <input autoFocus placeholder="Search by title, language or tag" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search snippets" />
                    </label>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map((i) => <div key={i} className="u-skel" style={{ height: 56 }} />)}</div>
                    ) : filteredSnippets.length === 0 ? (
                        <div className="u-empty" style={{ padding: '32px 0' }}>
                            <span className="u-display">{searchTerm ? 'No match' : 'Empty'}</span>
                            <p>{searchTerm ? 'Try a different search.' : 'Save code from a room and it shows up here.'}</p>
                        </div>
                    ) : (
                        <ul className="u-rows" style={{ maxHeight: '46vh', overflowY: 'auto' }}>
                            {filteredSnippets.map((snippet) => (
                                <li key={snippet.id} className="u-row s-item" style={{ cursor: 'default' }}>
                                    <span className="s-lang">{(snippet.language || '?').slice(0, 3)}</span>
                                    <div className="u-row-main">
                                        <span className="u-row-title u-ellipsis" style={{ fontSize: 15 }}>{snippet.title}</span>
                                        <span className="u-row-meta">
                                            <span className="u-mono u-ellipsis" style={{ maxWidth: 320 }}>{snippet.code.split('\n')[0].slice(0, 60)}</span>
                                            {(snippet.tags || []).slice(0, 2).map((t) => <span key={t} className="u-mono">#{t}</span>)}
                                        </span>
                                    </div>
                                    <div className="u-row-side">
                                        <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => handleSync(snippet)} disabled={isSaving} title="Overwrite this snippet with the room's code">Update</button>
                                        <button type="button" className="u-btn u-btn--solid u-btn--sm" onClick={() => onImport(snippet.code, 'insert')}>Insert</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            ) : (
                <>
                    <div className="g-two s-formrow">
                        <div className="u-field">
                            <label htmlFor="sm-title">Title</label>
                            <input id="sm-title" className="u-input" autoFocus placeholder="e.g. Binary search" value={saveData.title} onChange={(e) => setSaveData({ ...saveData, title: e.target.value })} />
                        </div>
                        <div className="u-field">
                            <label htmlFor="sm-lang">Language</label>
                            <select id="sm-lang" className="u-select" value={saveData.language} onChange={(e) => setSaveData({ ...saveData, language: e.target.value })}>
                                {SNIPPET_LANGS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="u-field">
                        <label htmlFor="sm-tags">Tags <span className="u-faint">— Enter or comma to add</span></label>
                        <div className="u-tagbox">
                            {tagList.map((tag) => (
                                <span key={tag} className="u-chip u-chip--mono">#{tag}
                                    <button type="button" aria-label={`Remove ${tag}`} onClick={() => setSaveData({ ...saveData, tags: tagList.filter((t) => t !== tag).join(',') })}><X size={11} /></button>
                                </span>
                            ))}
                            <input id="sm-tags" placeholder={tagList.length ? '' : 'react, hooks'}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                        e.preventDefault();
                                        const val = e.target.value.trim();
                                        if (val && !tagList.includes(val)) setSaveData({ ...saveData, tags: [...tagList, val].join(',') });
                                        e.target.value = '';
                                    }
                                }} />
                        </div>
                    </div>
                    <div className="u-pane" style={{ maxHeight: 200, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <pre className="u-code" style={{ padding: '12px 0' }}>
                            {(currentCode || '// Nothing to save yet').split('\n').slice(0, 12).map((l, i) => <span key={i}>{l || ' '}</span>)}
                        </pre>
                    </div>
                </>
            )}
        </Modal>
    );
};

export default SnippetModal;
