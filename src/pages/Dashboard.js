import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Folder, FolderOpen, FileUp, Terminal, Link2, ArrowUpRight, ArrowRight, Check, Sparkles, RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import SpaceLoader from '../components/SpaceLoader';
import { getBackendUrl, publicOrigin } from '../utils/api';
import useWorkspace, { itemDate, mergeActivity } from '../components/ux/useWorkspace';
import { Modal, RollingNumber, newRoomId, timeAgo, greeting, extractRoomId } from '../components/ux/primitives';
import { LANGS } from '../utils/languages';
import { pickFolder, pickFiles, importProject, describeSkipped } from '../utils/localFiles';
import { usePlan, isPlanLimit, showUpgradeToast, catalogue } from '../utils/billing';
import { track } from '../utils/track';

// Project templates: a web app (live preview) plus every runnable language.
const TEMPLATES = [
    { id: 'web', name: 'Web app', desc: 'html · css · js, live preview', short: 'web' },
    ...LANGS.map((l) => ({ id: l.id, name: l.label, desc: l.file, short: l.short })),
];

const DAYS = 14;


// Item count per day for the last DAYS days, oldest first.
const activityByDay = (items) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (DAYS - 1));
    const counts = Array(DAYS).fill(0);
    items.forEach((it) => {
        const d = itemDate(it);
        if (!d) return;
        const idx = Math.floor((d.getTime() - start.getTime()) / 86400000);
        if (idx >= 0 && idx < DAYS) counts[idx] += 1;
    });
    return counts;
};

function RowMenu({ open, onToggle, children }) {
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onToggle(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open, onToggle]);
    return (
        <div className="d-menu-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
            <button className={`u-icon${open ? ' on' : ''}`} onClick={() => onToggle(!open)} aria-label="More actions" aria-expanded={open}>
                <MoreHorizontal size={18} />
            </button>
            {open && <div className="u-pop" role="menu" style={{ minWidth: 200 }}>{children}</div>}
        </div>
    );
}

const Dashboard = () => {
    const { user, loading, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { rooms, projects, stats, loading: loadingData, error, reload } = useWorkspace(user);
    const { plan: planInfo, reload: reloadPlan } = usePlan(user);

    const [view, setView] = useState('all'); // all | rooms | projects
    const [lang, setLang] = useState(null);
    const [sort, setSort] = useState('recent');
    const [query, setQuery] = useState('');
    const [menuFor, setMenuFor] = useState(null);
    const [renameTarget, setRenameTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [newName, setNewName] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', type: 'web' });
    const [busy, setBusy] = useState(false);
    const [tplQuery, setTplQuery] = useState('');
    const [roomInput, setRoomInput] = useState('');
    const [snippetCount, setSnippetCount] = useState(null);
    const [setupHidden, setSetupHidden] = useState(() => { try { return localStorage.getItem('db-setup-hidden') === '1'; } catch { return false; } });
    const searchRef = useRef(null);
    const profiled = useRef(false);

    // Invite links land on /?room=…; "/" forwards here with the query intact.
    useEffect(() => {
        const room = new URLSearchParams(location.search).get('room');
        if (room) setRoomInput(room);
    }, [location.search]);

    useEffect(() => {
        if (!user?.uid || profiled.current) return;
        profiled.current = true;
        refreshProfile(user.uid);
        fetch(`${getBackendUrl()}/api/snippets?userId=${user.uid}`)
            .then((r) => r.json())
            .then((d) => setSnippetCount(Array.isArray(d) ? d.length : 0))
            .catch(() => setSnippetCount(null));
    }, [user?.uid, refreshProfile]);

    // "/" jumps to search, like most enterprise tools.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== '/' || e.ctrlKey || e.metaKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
            e.preventDefault();
            searchRef.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const hideSetup = () => {
        setSetupHidden(true);
        try { localStorage.setItem('db-setup-hidden', '1'); } catch { /* storage blocked */ }
    };

    useEffect(() => {
        if (!loading && !user) navigate('/login', { replace: true, state: { from: location.pathname + location.search } });
        if (location.state?.openCreateProject) {
            setCreateOpen(true);
            setView('projects');
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
    }, [user, loading, navigate, location]);

    useEffect(() => {
        if (error) toast.error('Failed to load your workspace data.');
    }, [error]);

    const languages = useMemo(() => {
        const map = {};
        rooms.forEach((r) => { if (r.lang) map[r.lang] = (map[r.lang] || 0) + 1; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [rooms]);

    const items = useMemo(() => {
        let list = view === 'rooms' ? rooms.map((r) => ({ ...r, kind: 'room' }))
            : view === 'projects' ? projects.map((p) => ({ ...p, kind: 'project' }))
                : mergeActivity(rooms, projects);
        if (lang) list = list.filter((i) => i.kind === 'room' && i.lang === lang);
        const q = query.trim().toLowerCase();
        if (q) list = list.filter((i) => [i.name, i.id, i.description, i.lang, i.type].some((v) => (v || '').toString().toLowerCase().includes(q)));
        if (sort === 'name') list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        else if (view !== 'all') list = [...list].sort((a, b) => (itemDate(b)?.getTime() || 0) - (itemDate(a)?.getTime() || 0));
        return list;
    }, [view, rooms, projects, lang, query, sort]);

    const bars = useMemo(() => activityByDay([...rooms, ...projects]), [rooms, projects]);
    const maxBar = Math.max(1, ...bars);

    const enterRoom = (id, role = 'editor') => navigate(`/editor/${id}`, { state: { userName: user?.name || '', role } });

    const joinRoom = (e) => {
        e?.preventDefault();
        const id = extractRoomId(roomInput);
        if (!id) return toast.error('Paste a room ID or invite link first.');
        enterRoom(id, new URLSearchParams(location.search).get('role') || 'editor');
    };

    const openItem = (item) => {
        if (item.kind === 'project') navigate(`/project/${item.id}`);
        else navigate(`/editor/${item.id}`, { state: { userName: user?.name || '', role: 'editor' } });
    };

    const copyRoomLink = async (id) => {
        try {
            await navigator.clipboard.writeText(`${publicOrigin()}/editor/${encodeURIComponent(id)}`);
            toast.success('Room link copied');
        } catch {
            toast.error('Could not copy link');
        }
    };

    const handleRename = async () => {
        if (!newName.trim() || !renameTarget) return;
        setBusy(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/rename-room`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: renameTarget.id, newName }),
            });
            if (!res.ok) throw new Error('rename failed');
            toast.success('Room renamed');
            setRenameTarget(null);
            setNewName('');
            reload();
        } catch {
            toast.error('Failed to rename room');
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setBusy(true);
        try {
            const res = deleteTarget.kind === 'project'
                ? await fetch(`${getBackendUrl()}/api/projects/${deleteTarget.id}`, { method: 'DELETE' })
                : await fetch(`${getBackendUrl()}/api/remove-room`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.uid, roomId: deleteTarget.id }),
                });
            if (!res.ok) throw new Error('delete failed');
            toast.success(deleteTarget.kind === 'project' ? 'Project deleted' : 'Room deleted');
            setDeleteTarget(null);
            reload();
        } catch {
            toast.error('Delete failed');
        } finally {
            setBusy(false);
        }
    };

    // Open a folder or files from disk as a new project (VS Code style).
    const importFromDisk = async (kind) => {
        if (busy) return;
        let picked;
        try {
            picked = kind === 'files' ? await pickFiles() : await pickFolder();
        } catch (err) {
            return toast.error(err.message || 'Could not open that');
        }
        if (!picked) return;
        if (!picked.files.length) return toast.error(`Nothing to import. ${describeSkipped(picked.skipped)}`.trim());
        const id = toast.loading(`Importing ${picked.files.length} file${picked.files.length === 1 ? '' : 's'}…`);
        setBusy(true);
        try {
            const project = await importProject({
                userId: user.uid,
                picked,
                onProgress: (done, total) => toast.loading(`Importing ${done}/${total} files…`, { id }),
            });
            toast.success(`Opened ${picked.name}. ${describeSkipped(picked.skipped)}`.trim(), { id });
            navigate(`/project/${project.id}`);
        } catch (err) {
            toast.error(err.message || 'Import failed', { id });
        } finally {
            setBusy(false);
        }
    };

    // Desktop menu: File > Open Folder / Open Files lands here with ?import=folder|files.
    const importParam = new URLSearchParams(location.search).get('import');
    useEffect(() => {
        if (!user || !importParam || !window.colabsDesktop) return;
        navigate(location.pathname, { replace: true }); // clear ?import so the menu can trigger it again
        importFromDisk(importParam === 'files' ? 'files' : 'folder');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid, importParam]);

    const handleCreateProject = async () => {
        if (!form.name.trim()) return toast.error('Give your project a name.');
        setBusy(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid, name: form.name, description: form.description, type: form.type }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (isPlanLimit(res, data)) { setCreateOpen(false); showUpgradeToast(data.error); return; }
                throw new Error('create failed');
            }
            const project = await res.json();
            reloadPlan();
            toast.success('Project created');
            setCreateOpen(false);
            setForm({ name: '', description: '', type: 'web' });
            navigate(`/project/${project.id}`);
        } catch {
            toast.error('Failed to create project');
        } finally {
            setBusy(false);
        }
    };

    if (loading || !user) return <SpaceLoader />;

    const first = (user?.name || user?.email || 'there').split(/[\s@]/)[0];
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const touched = bars.reduce((a, b) => a + b, 0);

    const checklist = [
        { text: 'Open your first room', done: rooms.length > 0, run: () => enterRoom(newRoomId()) },
        { text: 'Create a project', done: projects.length > 0, run: () => setCreateOpen(true) },
        { text: 'Save a snippet', done: (snippetCount || 0) > 0, run: () => navigate('/snippets') },
    ];
    const setupLeft = checklist.filter((c) => !c.done).length;

    const kpis = [
        { label: 'Projects', value: projects.length, to: () => setView('projects') },
        { label: 'Rooms', value: stats.totalRooms || rooms.length, to: () => setView('rooms') },
        { label: 'Snippets', value: snippetCount ?? 0, to: () => navigate('/snippets') },
        { label: 'Hours pairing', value: stats.hours || 0, suffix: 'h' },
    ];

    const counts = { all: rooms.length + projects.length, rooms: rooms.length, projects: projects.length };

    return (
        <AppLayout>
            <header className="db-head" data-rise>
                <div>
                    <span className="u-label">{greeting()} · {today}</span>
                    <h1 className="db-title">Welcome back, {first}</h1>
                </div>
                <div className="db-actions">
                    <button className="u-btn u-btn--ghost db-open" onClick={() => importFromDisk('folder')} disabled={busy} title="Open a folder from your computer as a project (Ctrl+Shift+O in the desktop app)"><FolderOpen size={16} /> Open folder</button>
                    <button className="u-btn u-btn--ghost db-open" onClick={() => importFromDisk('files')} disabled={busy} title="Open files from your computer as a project"><FileUp size={16} /> Open files</button>
                    <button className="u-btn u-btn--ghost" onClick={() => setCreateOpen(true)}><Folder size={16} /> New project</button>
                    <button className="u-btn u-btn--solid" onClick={() => enterRoom(newRoomId())}><Plus size={16} /> New room</button>
                </div>
            </header>

            {planInfo && planInfo.plan === 'free' && planInfo.billingEnabled && (
                <aside className="u-card db-plan" data-rise aria-label="Your plan">
                    <div className="db-plan-meters">
                        <span className="u-label">Free plan</span>
                        <span><b>{planInfo.usage.projects}</b> of {planInfo.limits.projects} projects</span>
                        <span><b>{planInfo.usage.aiToday}</b> of {planInfo.limits.aiPerDay} AI prompts today</span>
                    </div>
                    <button className="u-btn u-btn--solid u-btn--sm" onClick={() => { track('UPGRADE_CLICKED', { userId: user.uid, source: 'dashboard' }); navigate('/pricing'); }}>Try Team free for {catalogue.trialDays} days <ArrowUpRight size={14} /></button>
                </aside>
            )}

            <section className="u-card db-quick" data-rise aria-label="Join a room">
                <form className="db-join" onSubmit={joinRoom}>
                    <Link2 size={17} aria-hidden="true" />
                    <input
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value)}
                        placeholder="Paste a room link or ID to join"
                        aria-label="Room link or ID"
                    />
                    <button type="submit" className="u-btn u-btn--solid u-btn--sm" disabled={!roomInput.trim()}>Join <ArrowRight size={14} /></button>
                </form>
                {user?.last_room_id && (
                    <button className="db-resume" onClick={() => enterRoom(user.last_room_id)} title="Continue your last room">
                        <RotateCcw size={14} /> Continue <span className="u-mono">room/{user.last_room_id}</span>
                    </button>
                )}
            </section>

            <div className="db-kpis" data-rise>
                {kpis.map((k) => (
                    <button key={k.label} className="db-kpi" onClick={k.to} disabled={!k.to}>
                        <span className="u-label">{k.label}</span>
                        {loadingData ? <span className="u-skel" style={{ height: 40, width: '50%' }} /> : <RollingNumber value={k.value} suffix={k.suffix} />}
                    </button>
                ))}
                <div className="db-kpi db-kpi--spark" aria-label={`${touched} rooms and projects active in the last ${DAYS} days`}>
                    <span className="u-label">Last {DAYS} days · {touched}</span>
                    <div className="d-bars db-spark">
                        {bars.map((n, i) => (
                            <i key={i} className={n === 0 ? 'zero' : ''} title={`${n}`} style={{ height: `${n === 0 ? 100 : Math.max(10, (n / maxBar) * 100)}%`, '--d': `${i * 25}ms` }} />
                        ))}
                    </div>
                </div>
            </div>

            {setupLeft > 0 && !setupHidden && !loadingData && (
                <div className="db-setup" data-rise>
                    <span className="u-label"><Sparkles size={13} /> Getting started · {checklist.length - setupLeft}/{checklist.length}</span>
                    <div className="db-setup-items">
                        {checklist.map((c) => (
                            <button key={c.text} className={`u-chip${c.done ? ' done' : ''}`} onClick={c.done ? undefined : c.run} disabled={c.done}>
                                {c.done ? <Check size={12} /> : <span className="db-ring" />} {c.text}
                            </button>
                        ))}
                    </div>
                    <button className="u-icon" onClick={hideSetup} aria-label="Hide getting started"><X size={15} /></button>
                </div>
            )}

            <section className="u-card db-table" data-rise aria-label="Rooms and projects">
                <div className="db-toolbar">
                    <div className="u-seg" role="tablist" aria-label="Show">
                        {[['all', 'All'], ['rooms', 'Rooms'], ['projects', 'Projects']].map(([id, label]) => (
                            <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => { setView(id); if (id === 'projects') setLang(null); }}>
                                {label} <em>{counts[id]}</em>
                            </button>
                        ))}
                    </div>
                    {languages.length > 1 && view !== 'projects' && (
                        <select className="u-select db-lang" value={lang || ''} onChange={(e) => setLang(e.target.value || null)} aria-label="Room language">
                            <option value="">Any language</option>
                            {languages.map(([l, n]) => <option key={l} value={l}>{l} ({n})</option>)}
                        </select>
                    )}
                    <label className="u-search db-search">
                        <Search size={15} />
                        <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search rooms and projects" />
                        <kbd>/</kbd>
                    </label>
                    <div className="u-seg" role="tablist" aria-label="Sort">
                        <button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>Recent</button>
                        <button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>A–Z</button>
                    </div>
                </div>

                <div className="db-th" aria-hidden="true">
                    <span />
                    <span>Name</span>
                    <span>Type</span>
                    <span>Last active</span>
                    <span />
                </div>

                {loadingData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
                        {[0, 1, 2, 3].map((i) => <div key={i} className="u-skel" style={{ height: 48 }} />)}
                    </div>
                ) : items.length === 0 ? (
                    <div className="u-empty" style={{ padding: '48px 20px' }}>
                        <p><b>{query || lang ? 'Nothing matches.' : view === 'projects' ? 'No projects yet.' : 'Nothing here yet.'}</b> {query || lang ? 'Try another search or filter.' : view === 'projects' ? 'Projects keep files, history and teammates together.' : 'Start a room and share the link.'}</p>
                        {!query && !lang && (view === 'projects'
                            ? <button className="u-btn u-btn--solid u-btn--sm" onClick={() => setCreateOpen(true)}><Plus size={15} /> New project</button>
                            : <button className="u-btn u-btn--solid u-btn--sm" onClick={() => enterRoom(newRoomId())}><Plus size={15} /> New room</button>)}
                    </div>
                ) : (
                    <ul className="db-rows">
                        {items.map((item) => {
                            const isProject = item.kind === 'project';
                            const key = `${item.kind}-${item.id}`;
                            const when = itemDate(item);
                            return (
                                <li key={key} className="db-row" tabIndex={0} onClick={() => openItem(item)} onKeyDown={(e) => e.key === 'Enter' && openItem(item)}>
                                    <span className="d-ico">{isProject ? <Folder size={16} /> : <Terminal size={16} />}</span>
                                    <span className="db-name">
                                        <b className="u-ellipsis">{item.name || item.id}</b>
                                        <span className="u-mono u-ellipsis">{isProject ? (item.description || 'Project') : `room/${item.id}`}</span>
                                    </span>
                                    <span className="db-type"><span className="u-chip u-chip--mono">{isProject ? (item.type || 'project') : (item.lang || 'room')}</span></span>
                                    <span className="db-when u-mono">{when ? timeAgo(when) : (item.lastActive || 'just now').split(',')[0]}</span>
                                    <span className="db-row-actions" onClick={(e) => e.stopPropagation()}>
                                        {!isProject && (
                                            <button className="u-icon" onClick={() => copyRoomLink(item.id)} title="Copy invite link" aria-label={`Copy invite link for ${item.name || item.id}`}><Link2 size={15} /></button>
                                        )}
                                        <RowMenu open={menuFor === key} onToggle={(v) => setMenuFor(v ? key : null)}>
                                            <button onClick={() => { setMenuFor(null); openItem(item); }}><ArrowUpRight size={16} />Open</button>
                                            {!isProject && <button onClick={() => { setMenuFor(null); setRenameTarget(item); setNewName(item.name || ''); }}><Pencil size={16} />Rename</button>}
                                            <button className="danger" onClick={() => { setMenuFor(null); setDeleteTarget(item); }}><Trash2 size={16} />{isProject ? 'Delete project' : 'Remove from list'}</button>
                                        </RowMenu>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {!loadingData && items.length > 0 && (
                    <div className="db-foot u-label">Showing {items.length} of {counts[view]}{lang ? ` · ${lang}` : ''}</div>
                )}
            </section>

            <Modal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                label="New project"
                title="Start a project"
                description="A multi-file workspace with live preview, history and invites."
                onSubmit={handleCreateProject}
                footer={<>
                    <button type="button" className="u-btn u-btn--ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
                    <button type="submit" className="u-btn u-btn--solid" disabled={busy}>{busy ? 'Creating…' : 'Create project'}</button>
                </>}
            >
                <div className="u-field">
                    <label htmlFor="np-name">Name</label>
                    <input id="np-name" className="u-input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Portfolio website" />
                </div>
                <div className="u-field">
                    <label htmlFor="np-desc">Description <span className="u-faint">(optional)</span></label>
                    <input id="np-desc" className="u-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="One line about what it does" />
                </div>
                <div className="u-field">
                    <span className="u-field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        Template
                        <input className="u-input db-tpl-find" value={tplQuery} onChange={(e) => setTplQuery(e.target.value)} placeholder="Find a language" aria-label="Find a template" />
                    </span>
                    <div className="u-tiles db-tpls" role="radiogroup" aria-label="Template">
                        {TEMPLATES.filter((t) => !tplQuery.trim() || `${t.name} ${t.desc}`.toLowerCase().includes(tplQuery.trim().toLowerCase())).map(({ id, name, desc, short }) => (
                            <button type="button" key={id} role="radio" className={`u-tile${form.type === id ? ' on' : ''}`} onClick={() => setForm({ ...form, type: id })} aria-checked={form.type === id}>
                                <span className="u-tile-ico u-mono">{short}</span>
                                <span className="u-tile-copy"><b>{name}</b><span className="u-tile-desc">{desc}</span></span>
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>

            <Modal
                open={!!renameTarget}
                onClose={() => setRenameTarget(null)}
                label={`room/${renameTarget?.id || ''}`}
                title="Rename room"
                onSubmit={handleRename}
                footer={<>
                    <button type="button" className="u-btn u-btn--ghost" onClick={() => setRenameTarget(null)}>Cancel</button>
                    <button type="submit" className="u-btn u-btn--solid" disabled={busy || !newName.trim()}>Rename</button>
                </>}
            >
                <div className="u-field">
                    <label htmlFor="rn-name">Room name</label>
                    <input id="rn-name" className="u-input" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Room name" />
                </div>
            </Modal>

            <Modal
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                label={deleteTarget?.kind === 'project' ? 'Delete project' : 'Delete room'}
                title={`Delete “${deleteTarget?.name || deleteTarget?.id || ''}”?`}
                description="This can't be undone."
                footer={<>
                    <button type="button" className="u-btn u-btn--ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
                    <button type="button" className="u-btn u-btn--danger" disabled={busy} onClick={handleDelete}><Trash2 size={15} /> Delete</button>
                </>}
            />
        </AppLayout>
    );
};

export default Dashboard;
