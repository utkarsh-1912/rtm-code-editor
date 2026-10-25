import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, Pencil, Copy, Check, X, Users, Hash, User, Code2, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '../components/AppLayout';
import OrganizationSettings from '../components/OrganizationSettings';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../utils/api';
import { Modal, timeAgo } from '../components/ux/primitives';
import { SNIPPET_LANGS } from '../utils/languages';
import Pager from '../components/ux/Pager';

const SNIPPET_FETCH = 100; // per request
const SNIPPET_PAGE = 15; // per list page

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
    const navigate = useNavigate();
    const narrow = useIsNarrow();
    const [snippets, setSnippets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [tag, setTag] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [organizations, setOrganizations] = useState([]);
    const [vault, setVault] = useState('personal');
    const [selectedId, setSelectedId] = useState(null);
    const [mode, setMode] = useState(null); // create | edit | delete | view
    const [target, setTarget] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [tagDraft, setTagDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [tab, setTab] = useState('snippets'); // snippets | teams
    const [lang, setLang] = useState(null);

    const fetchOrgs = useCallback(async () => {
        if (!user?.uid) return;
        try {
            const res = await fetch(`${getBackendUrl()}/api/organizations?userId=${user.uid}`);
            const data = await res.json();
            setOrganizations(Array.isArray(data) ? data : []);
        } catch (err) { /* teams are optional */ }
    }, [user]);

    // Personal snippets come 100 at a time ({ items, total }); team vaults return a list.
    const [total, setTotal] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const fetchSnippets = useCallback(async () => {
        if (!user?.uid) { setLoading(false); return; }
        try {
            const backendUrl = getBackendUrl();
            const url = vault === 'personal'
                ? `${backendUrl}/api/snippets?userId=${encodeURIComponent(user.uid)}&limit=${SNIPPET_FETCH}&offset=0`
                : `${backendUrl}/api/snippets?orgId=${vault}`;
            const res = await fetch(url);
            const data = await res.json();
            const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
            setSnippets(items);
            setTotal(Array.isArray(data) ? items.length : data.total ?? items.length);
        } catch (err) {
            toast.error('Failed to load snippets');
        } finally {
            setLoading(false);
        }
    }, [user, vault]);

    const loadMoreSnippets = async () => {
        if (!user || vault !== 'personal') return;
        setLoadingMore(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/snippets?userId=${encodeURIComponent(user.uid)}&limit=${SNIPPET_FETCH}&offset=${snippets.length}`);
            const data = await res.json();
            setSnippets((prev) => {
                const seen = new Set(prev.map((x) => x.id));
                return [...prev, ...(data.items || []).filter((x) => !seen.has(x.id))];
            });
            setTotal(data.total ?? total);
        } catch {
            toast.error('Could not load more snippets');
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => { fetchSnippets(); fetchOrgs(); }, [fetchSnippets, fetchOrgs]);

    const allTags = useMemo(() => Array.from(new Set(snippets.flatMap((s) => s.tags || []))).sort(), [snippets]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return snippets.filter((s) => {
            const matches = !q || [s.title, s.code, s.language].some((v) => (v || '').toLowerCase().includes(q))
                || (s.tags || []).some((t) => t.toLowerCase().includes(q));
            return matches && (!tag || (s.tags || []).includes(tag)) && (!lang || s.language === lang);
        });
    }, [snippets, query, tag, lang]);

    // Languages in this vault, most used first (side rail filter).
    const langCounts = useMemo(() => {
        const counts = new Map();
        snippets.forEach((s) => counts.set(s.language, (counts.get(s.language) || 0) + 1));
        return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    }, [snippets]);

    const [page, setPage] = useState(1);
    useEffect(() => { setPage(1); }, [query, tag, vault, lang]);
    const pageItems = filtered.slice((page - 1) * SNIPPET_PAGE, page * SNIPPET_PAGE);
    const hasMore = vault === 'personal' && !query && !tag && !lang && snippets.length < total;

    const selected = filtered.find((s) => s.id === selectedId) || pageItems[0] || null;

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
    const pickVault = (id) => { setVault(id); setTag(null); setLang(null); setSelectedId(null); setLoading(true); setTab('snippets'); };
    const preview = (code) => (code || '').split('\n').filter((l) => l.trim()).slice(0, 2).join('\n');

    return (
        <AppLayout>
            <div className="sn-head" data-rise>
                <div className="sn-head-text">
                    <span className="u-label">Library</span>
                    <h1>Snippets</h1>
                    <p>Save code once, drop it into any room. Share a vault with your team.</p>
                </div>
                <div className="sn-head-actions">
                    <div className="u-seg" role="tablist" aria-label="Library">
                        <button role="tab" aria-selected={tab === 'snippets'} className={tab === 'snippets' ? 'on' : ''} onClick={() => setTab('snippets')}><Code2 size={13} /> Snippets</button>
                        <button role="tab" aria-selected={tab === 'teams'} className={tab === 'teams' ? 'on' : ''} onClick={() => setTab('teams')}><Users size={13} /> Teams{organizations.length ? ` · ${organizations.length}` : ''}</button>
                    </div>
                    {tab === 'snippets' && user?.uid && <button className="u-btn u-btn--solid u-btn--sm" onClick={() => open('create')}><Plus size={15} /> New snippet</button>}
                </div>
            </div>

            {!user?.uid ? (
                <div className="u-card sn-guest" data-rise>
                    <span className="sn-empty-ico"><Code2 size={22} /></span>
                    <b>Sign in to keep snippets</b>
                    <p>Snippets and team vaults belong to your account, so they follow you to every room and device.</p>
                    <button className="u-btn u-btn--solid u-btn--sm" onClick={() => navigate('/login', { state: { from: '/snippets' } })}><LogIn size={15} /> Sign in</button>
                </div>
            ) : tab === 'teams' ? (
                <div className="u-card sn-teams" data-rise>
                    <OrganizationSettings
                        inline
                        userId={user?.uid}
                        userName={user?.name || user?.email?.split('@')[0]}
                        userEmail={user?.email}
                        onChanged={fetchOrgs}
                        onOpenVault={pickVault}
                    />
                </div>
            ) : (
                <div className="sn-lib" data-rise style={{ '--d': '60ms' }}>
                    <aside className="sn-rail" aria-label="Filters">
                        <div className="sn-rail-group">
                            <span className="u-label">Vaults</span>
                            <button className={vault === 'personal' ? 'on' : ''} onClick={() => pickVault('personal')}>
                                <User size={14} /> <span className="u-ellipsis">My vault</span>
                                {vault === 'personal' && <em>{total || snippets.length}</em>}
                            </button>
                            {organizations.map((org) => (
                                <button key={org.id} className={vault === org.id ? 'on' : ''} onClick={() => pickVault(org.id)}>
                                    <Users size={14} /> <span className="u-ellipsis">{org.name}</span>
                                    {vault === org.id && <em>{snippets.length}</em>}
                                </button>
                            ))}
                            <button className="sn-rail-link" onClick={() => setTab('teams')}><Plus size={14} /> {organizations.length ? 'Manage teams' : 'Create a team'}</button>
                        </div>
                        {langCounts.length > 1 && (
                            <div className="sn-rail-group">
                                <span className="u-label">Language</span>
                                {langCounts.map(([l, n]) => (
                                    <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(lang === l ? null : l)}>
                                        <span className="sn-dot" data-lang={l} /> <span className="u-ellipsis">{langName(l)}</span> <em>{n}</em>
                                    </button>
                                ))}
                            </div>
                        )}
                        {allTags.length > 0 && (
                            <div className="sn-rail-group">
                                <span className="u-label">Tags</span>
                                <div className="sn-rail-tags">
                                    {allTags.map((t) => (
                                        <button key={t} className={`u-chip u-chip--mono${tag === t ? ' on' : ''}`} onClick={() => setTag(tag === t ? null : t)}><Hash size={11} />{t}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </aside>

                    <div className="u-card sn-list">
                        <div className="sn-toolbar">
                            <label className="u-search" style={{ flex: 1, maxWidth: 'none' }}>
                                <Search size={15} />
                                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${vaultName.toLowerCase()}`} aria-label="Search snippets" />
                            </label>
                            <span className="u-label">{filtered.length}{(query || tag || lang) ? ` / ${total || snippets.length}` : ''}</span>
                        </div>
                        {(tag || lang) && (
                            <div className="sn-active-filters">
                                {lang && <button className="u-chip on" onClick={() => setLang(null)}>{langName(lang)} <X size={11} /></button>}
                                {tag && <button className="u-chip u-chip--mono on" onClick={() => setTag(null)}>#{tag} <X size={11} /></button>}
                            </div>
                        )}

                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 4 }}>
                                {[0, 1, 2, 3].map((i) => <div key={i} className="u-skel" style={{ height: 76 }} />)}
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="u-empty sn-empty">
                                <span className="sn-empty-ico"><Code2 size={22} /></span>
                                <b>{query || tag || lang ? 'Nothing matches' : `${vaultName} is empty`}</b>
                                <p>{query || tag || lang ? 'Try another search or clear the filters.' : 'Save a snippet you reuse: a hook, a query, a config.'}</p>
                                {!query && !tag && !lang && <button className="u-btn u-btn--solid u-btn--sm" onClick={() => open('create')}><Plus size={15} /> New snippet</button>}
                            </div>
                        ) : (
                            <ul className="sn-cards">
                                {pageItems.map((s) => {
                                    const isOn = !narrow && selected?.id === s.id;
                                    const pick = () => (narrow ? open('view', s) : setSelectedId(s.id));
                                    return (
                                        <li key={s.id} className={`sn-card${isOn ? ' on' : ''}`} tabIndex={0} onClick={pick} onKeyDown={(e) => e.key === 'Enter' && pick()}>
                                            <div className="sn-card-top">
                                                <span className="s-lang" data-lang={s.language}>{langShort(s.language)}</span>
                                                <b className="u-ellipsis">{s.title}</b>
                                                <button className="u-icon sn-copy" onClick={(e) => { e.stopPropagation(); copy(s); }} aria-label={`Copy ${s.title}`} title="Copy">
                                                    {copiedId === s.id ? <Check size={15} /> : <Copy size={15} />}
                                                </button>
                                            </div>
                                            {preview(s.code) && <pre className="sn-card-code">{preview(s.code)}</pre>}
                                            <div className="sn-card-meta">
                                                {(s.tags || []).slice(0, 3).map((t) => <span key={t}>#{t}</span>)}
                                                {s.author_name && vault !== 'personal' && <span>by {s.author_name}</span>}
                                                <span className="sn-card-when">{timeAgo(s.updated_at || s.created_at)}</span>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {!loading && filtered.length > 0 && (
                            <Pager
                                page={page}
                                pageSize={SNIPPET_PAGE}
                                loaded={filtered.length}
                                total={query || tag || lang ? filtered.length : total || snippets.length}
                                onPage={setPage}
                                hasMore={hasMore}
                                onLoadMore={loadMoreSnippets}
                                loadingMore={loadingMore}
                                label="snippets"
                            />
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
            )}

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

        </AppLayout>
    );
};

export default Snippets;
