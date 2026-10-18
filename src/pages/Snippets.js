import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Trash2, Pencil, Copy, Check, X, Users, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '../components/AppLayout';
import OrganizationSettings from '../components/OrganizationSettings';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../utils/api';
import { Modal, timeAgo, pad2 } from '../components/ux/primitives';
import { SNIPPET_LANGS } from '../utils/languages';

const LANGS = SNIPPET_LANGS;
const langShort = (l) => (LANGS.find(([v]) => v === l)?.[2]) || (l || '?').slice(0, 3);
const langName = (l) => (LANGS.find(([v]) => v === l)?.[1]) || l;
const EMPTY = { title: '', code: '', language: 'javascript', tags: [], organizationId: null };

function useIsNarrow(px = 980) {
    const [narrow, setNarrow] = useState(() => window.innerWidth <= px);
    useEffect(() => {
        const onResize = () => setNarrow(window.innerWidth <= px);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [px]);
    return narrow;
}

function CodeBlock({ code }) {
    return (
        <pre className="u-code">
            {(code || '').split('\n').map((line, i) => <span key={i}>{line || ' '}</span>)}
        </pre>
    );
}

function SnippetView({ snippet, copied, onCopy, onEdit, onDelete, onClose }) {
    const when = snippet.updated_at || snippet.created_at;
    return (
        <>
            <div className="s-view-head">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span className="u-label">{langName(snippet.language)} · {when ? timeAgo(when) : '—'}</span>
                    {onClose && <button className="u-icon" style={{ color: 'inherit' }} onClick={onClose} aria-label="Close"><X size={18} /></button>}
                </div>
                <h3>{snippet.title}</h3>
                {snippet.tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {snippet.tags.map((t) => <span key={t} className="u-chip u-chip--mono">#{t}</span>)}
                    </div>
                )}
                <div className="s-view-actions">
                    <button className="u-btn u-btn--solid u-btn--sm" onClick={onCopy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button>
                    <button className="u-btn u-btn--quiet u-btn--sm" onClick={onEdit}><Pencil size={14} /> Edit</button>
                    <button className="u-btn u-btn--quiet u-btn--sm" onClick={onDelete}><Trash2 size={14} /> Delete</button>
                </div>
            </div>
            <CodeBlock code={snippet.code} key={snippet.id} />
            <div className="s-view-foot">
                <span>{(snippet.code || '').split('\n').length} lines · {(snippet.code || '').length} chars</span>
                <span>id {String(snippet.id).slice(0, 12)}</span>
            </div>
        </>
    );
}

const Snippets = () => {
    const { user } = useAuth();
    const narrow = useIsNarrow();
    const [snippets, setSnippets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [tag, setTag] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [organizations, setOrganizations] = useState([]);
    const [vault, setVault] = useState('personal');
    const [showOrgSettings, setShowOrgSettings] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [mode, setMode] = useState(null); // create | edit | delete | view
    const [target, setTarget] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [tagDraft, setTagDraft] = useState('');
    const [busy, setBusy] = useState(false);

    const fetchOrgs = useCallback(async () => {
        if (!user) return;
        try {
            const res = await fetch(`${getBackendUrl()}/api/organizations?userId=${user.uid}`);
            const data = await res.json();
            setOrganizations(Array.isArray(data) ? data : []);
        } catch (err) { /* teams are optional */ }
    }, [user]);

    const fetchSnippets = useCallback(async () => {
        if (!user) return;
        try {
            const backendUrl = getBackendUrl();
            const url = vault === 'personal'
                ? `${backendUrl}/api/snippets?userId=${user.uid}`
                : `${backendUrl}/api/snippets?orgId=${vault}`;
            const res = await fetch(url);
            const data = await res.json();
            setSnippets(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error('Failed to load snippets');
        } finally {
            setLoading(false);
        }
    }, [user, vault]);

    useEffect(() => { fetchSnippets(); fetchOrgs(); }, [fetchSnippets, fetchOrgs]);

    const allTags = useMemo(() => Array.from(new Set(snippets.flatMap((s) => s.tags || []))).sort(), [snippets]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return snippets.filter((s) => {
            const matches = !q || [s.title, s.code, s.language].some((v) => (v || '').toLowerCase().includes(q))
                || (s.tags || []).some((t) => t.toLowerCase().includes(q));
            return matches && (!tag || (s.tags || []).includes(tag));
        });
    }, [snippets, query, tag]);

    const selected = filtered.find((s) => s.id === selectedId) || filtered[0] || null;

    const copy = (s) => {
        navigator.clipboard.writeText(s.code);
        setCopiedId(s.id);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const open = (type, snippet = null) => {
        setMode(type);
        setTarget(snippet);
        setTagDraft('');
        setForm(snippet
            ? { title: snippet.title, code: snippet.code, language: snippet.language, tags: snippet.tags || [], organizationId: snippet.organization_id || null }
            : { ...EMPTY, organizationId: vault !== 'personal' ? vault : null });
    };
    const close = () => { setMode(null); setTarget(null); setForm(EMPTY); };

    const addTag = () => {
        const v = tagDraft.trim().replace(/^#/, '').replace(/,$/, '');
        if (v && !form.tags.includes(v)) setForm({ ...form, tags: [...form.tags, v] });
        setTagDraft('');
    };

    const save = async () => {
        if (!form.title.trim() || !form.code.trim()) return toast.error('Add a title and some code.');
        const tags = tagDraft.trim() ? [...form.tags, tagDraft.trim()] : form.tags;
        setBusy(true);
        try {
            const backendUrl = getBackendUrl();
            const res = mode === 'create'
                ? await fetch(`${backendUrl}/api/snippets`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...form, tags, userId: user.uid }),
                })
                : await fetch(`${backendUrl}/api/snippets/${target.id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...form, tags }),
                });
            if (!res.ok) throw new Error('save failed');
            toast.success(mode === 'create' ? 'Snippet saved' : 'Snippet updated');
            if (mode === 'edit') setSelectedId(target.id);
            close();
            fetchSnippets();
        } catch {
            toast.error('Could not save the snippet');
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        setBusy(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/snippets/${target.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('delete failed');
            toast.success('Snippet removed');
            close();
            setSelectedId(null);
            fetchSnippets();
        } catch {
            toast.error('Could not delete the snippet');
        } finally {
            setBusy(false);
        }
    };

    const vaultName = vault === 'personal' ? 'My vault' : organizations.find((o) => o.id === vault)?.name || 'Team';

    return (
        <AppLayout>
            <div className="u-head">
                <span className="u-label" data-rise>02 — Library</span>
                <div className="u-head-body">
                    <h1 className="u-lede" data-rise style={{ '--d': '60ms' }}>
                        <b>Code worth keeping.</b> Save a snippet once and drop it into any room.
                    </h1>
                    <div className="u-head-actions" data-rise style={{ '--d': '120ms' }}>
                        <button className="u-btn u-btn--solid" onClick={() => open('create')}><Plus size={16} /> New snippet</button>
                        <button className="u-btn u-btn--ghost" onClick={() => setShowOrgSettings(true)}><Users size={16} /> Teams</button>
                    </div>
                </div>
            </div>

            <div className="s-vaults" data-rise style={{ marginBottom: 14 }}>
                <button className={`u-chip${vault === 'personal' ? ' on' : ''}`} onClick={() => { setVault('personal'); setTag(null); setLoading(true); }}>My vault</button>
                {organizations.map((org) => (
                    <button key={org.id} className={`u-chip${vault === org.id ? ' on' : ''}`} onClick={() => { setVault(org.id); setTag(null); setLoading(true); }}>{org.name}</button>
                ))}
            </div>

            <div className="u-sheetbox" data-rise style={{ '--d': '80ms' }}>
                <div className="s-lib">
                    <div className="u-card s-list">
                        <div className="d-toolbar">
                            <label className="u-search" style={{ flex: 1, maxWidth: 'none' }}>
                                <Search size={15} />
                                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${vaultName.toLowerCase()}`} aria-label="Search snippets" />
                            </label>
                            <span className="u-label">{filtered.length} / {snippets.length}</span>
                        </div>

                        {allTags.length > 0 && (
                            <div className="s-tags">
                                {allTags.map((t) => (
                                    <button key={t} className={`u-chip u-chip--mono${tag === t ? ' on' : ''}`} onClick={() => setTag(tag === t ? null : t)}><Hash size={11} />{t}</button>
                                ))}
                            </div>
                        )}

                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[0, 1, 2, 3].map((i) => <div key={i} className="u-skel" style={{ height: 56 }} />)}
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="u-empty">
                                <span className="u-display">{query || tag ? 'No match' : 'Empty'}</span>
                                <p>{query || tag ? 'Try another search or clear the tag.' : `Nothing in ${vaultName.toLowerCase()} yet.`}</p>
                                {!query && !tag && <button className="u-btn u-btn--solid" onClick={() => open('create')}><Plus size={16} /> New snippet</button>}
                            </div>
                        ) : (
                            <ul className="u-rows" style={{ borderTop: 0 }}>
                                {filtered.map((s, i) => {
                                    const isOn = !narrow && selected?.id === s.id;
                                    const pick = () => (narrow ? open('view', s) : setSelectedId(s.id));
                                    return (
                                        <li key={s.id} className={`u-row s-item${isOn ? ' on' : ''}`} tabIndex={0} onClick={pick} onKeyDown={(e) => e.key === 'Enter' && pick()}>
                                            <span className="s-lang">{langShort(s.language)}</span>
                                            <div className="u-row-main">
                                                <span className="u-row-title u-ellipsis" style={{ fontSize: 15.5 }}>{s.title}</span>
                                                <span className="u-row-meta">
                                                    <span className="u-mono">{pad2(i + 1)}</span>
                                                    {(s.tags || []).slice(0, 3).map((t) => <span key={t} className="u-mono">#{t}</span>)}
                                                    <span className="u-mono">{timeAgo(s.updated_at || s.created_at)}</span>
                                                </span>
                                            </div>
                                            <button className="u-icon" onClick={(e) => { e.stopPropagation(); copy(s); }} aria-label={`Copy ${s.title}`}>
                                                {copiedId === s.id ? <Check size={16} /> : <Copy size={16} />}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <section className="u-pane s-view" aria-label="Snippet preview">
                        {selected ? (
                            <SnippetView
                                snippet={selected}
                                copied={copiedId === selected.id}
                                onCopy={() => copy(selected)}
                                onEdit={() => open('edit', selected)}
                                onDelete={() => open('delete', selected)}
                            />
                        ) : (
                            <div className="u-empty" style={{ margin: 'auto', color: 'var(--u-pane-ink-2)' }}>
                                <span className="u-display" style={{ color: 'var(--u-pane-ink-2)' }}>Preview</span>
                                <p>Pick a snippet to read it here.</p>
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {mode === 'view' && target && (
                <div className="u-modal-back" onMouseDown={(e) => e.target === e.currentTarget && close()}>
                    <div className="u-modal u-modal--wide u-pane s-view" style={{ display: 'flex', position: 'relative', top: 0, maxHeight: '88vh' }} role="dialog" aria-modal="true" aria-label={target.title}>
                        <SnippetView
                            snippet={target}
                            copied={copiedId === target.id}
                            onCopy={() => copy(target)}
                            onEdit={() => open('edit', target)}
                            onDelete={() => open('delete', target)}
                            onClose={close}
                        />
                    </div>
                </div>
            )}

            <Modal
                open={mode === 'create' || mode === 'edit'}
                onClose={close}
                wide
                label={mode === 'create' ? `New snippet · ${vaultName}` : 'Edit snippet'}
                title={mode === 'create' ? 'Save a snippet' : form.title || 'Edit snippet'}
                onSubmit={save}
                footer={<>
                    <button type="button" className="u-btn u-btn--ghost" onClick={close}>Discard</button>
                    <button type="submit" className="u-btn u-btn--solid" disabled={busy}>{busy ? 'Saving…' : mode === 'create' ? 'Save snippet' : 'Save changes'}</button>
                </>}
            >
                <div className="g-two s-formrow">
                    <div className="u-field">
                        <label htmlFor="sn-title">Title</label>
                        <input id="sn-title" className="u-input" autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Debounce hook" />
                    </div>
                    <div className="u-field">
                        <label htmlFor="sn-lang">Language</label>
                        <select id="sn-lang" className="u-select" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                            {LANGS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                        </select>
                    </div>
                </div>
                <div className="u-field">
                    <label htmlFor="sn-tags">Tags <span className="u-faint">— Enter or comma to add</span></label>
                    <div className="u-tagbox">
                        {form.tags.map((t) => (
                            <span key={t} className="u-chip u-chip--mono">#{t}
                                <button type="button" onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })} aria-label={`Remove ${t}`}><X size={11} /></button>
                            </span>
                        ))}
                        <input id="sn-tags" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder={form.tags.length ? '' : 'react, hooks'}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
                                if (e.key === 'Backspace' && !tagDraft && form.tags.length) setForm({ ...form, tags: form.tags.slice(0, -1) });
                            }} />
                    </div>
                </div>
                <div className="u-field">
                    <label htmlFor="sn-code">Code</label>
                    <textarea id="sn-code" className="u-textarea u-textarea--code" spellCheck={false} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="// paste your code here" />
                </div>
            </Modal>

            <Modal
                open={mode === 'delete'}
                onClose={close}
                label="Delete snippet"
                title={`Delete “${target?.title || ''}”?`}
                description="It will be removed from this vault for good."
                footer={<>
                    <button type="button" className="u-btn u-btn--ghost" onClick={close}>Keep it</button>
                    <button type="button" className="u-btn u-btn--danger" disabled={busy} onClick={remove}><Trash2 size={15} /> Delete</button>
                </>}
            />

            <OrganizationSettings
                isOpen={showOrgSettings}
                onClose={() => { setShowOrgSettings(false); fetchOrgs(); }}
                userId={user?.uid}
                userName={user?.name || user?.email?.split('@')[0]}
            />
        </AppLayout>
    );
};

export default Snippets;
