import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Folder, Terminal, Globe, FileCode, Coffee, Link2, ArrowUpRight, ArrowRight, Check, Sparkles, RotateCcw, Code2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import SpaceLoader from '../components/SpaceLoader';
import { getBackendUrl } from '../utils/api';
import useWorkspace, { itemDate, mergeActivity } from '../components/ux/useWorkspace';
import { Modal, RollingNumber, newRoomId, timeAgo, greeting, extractRoomId, pad2 } from '../components/ux/primitives';

const TEMPLATES = [
    { id: 'web', name: 'Web starter', desc: 'html · css · js', icon: Globe },
    { id: 'cpp', name: 'C++ console', desc: 'main.cpp', icon: Terminal },
    { id: 'python', name: 'Python script', desc: 'main.py', icon: FileCode },
    { id: 'java', name: 'Java class', desc: 'Main.java', icon: Coffee },
];

const DAYS = 14;

const STEPS = [
    { title: 'Create', copy: 'One click makes a private room with its own link. Nothing to install.' },
    { title: 'Share', copy: 'Send the link. Teammates join with just a name, even before they sign up.' },
    { title: 'Build', copy: 'Edit, talk, draw and run code in the same room, live.' },
];

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
    const [roomInput, setRoomInput] = useState('');
    const [snippetCount, setSnippetCount] = useState(null);
    const [step, setStep] = useState(0);
    const [autoStep, setAutoStep] = useState(true);
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

    useEffect(() => {
        if (!autoStep) return undefined;
        const id = setTimeout(() => setStep((v) => (v + 1) % STEPS.length), 5000);
        return () => clearTimeout(id);
    }, [step, autoStep]);

    useEffect(() => {
        if (!loading && !user) navigate('/login');
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
    const latest = mergeActivity(rooms, projects)[0];

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
            await navigator.clipboard.writeText(`${window.location.origin}/?room=${id}`);
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

    const handleCreateProject = async () => {
        if (!form.name.trim()) return toast.error('Give your project a name.');
        setBusy(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid, name: form.name, description: form.description, type: form.type }),
            });
            if (!res.ok) throw new Error('create failed');
            const project = await res.json();
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

    const statItems = [
        { label: 'Projects', value: projects.length, note: 'Multi-file workspaces' },
        { label: 'Rooms', value: stats.totalRooms || rooms.length, note: 'Rooms you have opened' },
        { label: 'Sessions', value: stats.sessions || rooms.length, note: 'Times you joined a room' },
        { label: 'Hours', value: stats.hours || 0, suffix: 'h', note: 'Spent coding together' },
    ];

    const first = (user?.name || user?.email || 'there').split(/[\s@]/)[0];
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

    const checklist = [
        { text: 'Open your first room', done: rooms.length > 0 },
        { text: 'Create a project', done: projects.length > 0 },
        { text: 'Spend an hour pairing', done: (stats.hours || 0) >= 1 },
    ];

    return (
        <AppLayout>
            <div className="h-top" data-rise>
                <span className="u-label">{greeting()} · {today}</span>
                <span className="u-label"><span className="u-dot" /> Workspace synced</span>
            </div>

            <h1 className="u-display u-giant h-name u-lines">
                <span><span style={{ '--d': '60ms' }}>Hello,</span></span>
                <span><span style={{ '--d': '160ms' }}>{first}<span className="u-faint">.</span></span></span>
            </h1>

            <div className="h-grid">
                <section className="u-pane h-pane h-start" data-rise aria-label="Start or join a room">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <span className="u-label">Instant room</span>
                        <span className="u-label">{pad2(step + 1)} of {pad2(STEPS.length)}</span>
                    </div>
                    <h2>Start a room. <span>Share the link and everyone codes together.</span></h2>

                    <form className="h-join" onSubmit={joinRoom}>
                        <input
                            className="u-input"
                            value={roomInput}
                            onChange={(e) => setRoomInput(e.target.value)}
                            placeholder="Paste a room ID or invite link"
                            aria-label="Room ID or invite link"
                        />
                        <button type="submit" className="u-btn u-btn--ghost u-btn--lg">Join <ArrowRight size={16} /></button>
                    </form>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="u-btn u-btn--solid u-btn--lg" onClick={() => enterRoom(newRoomId())}>
                            <Plus size={17} /> Create a new room
                        </button>
                    </div>

                    {user?.last_room_id && (
                        <div className="h-resume" onClick={() => enterRoom(user.last_room_id)} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && enterRoom(user.last_room_id)}>
                            <RotateCcw size={18} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 500 }}>Continue where you left off</div>
                                <div className="u-mono u-muted" style={{ fontSize: 12 }}>room/{user.last_room_id}</div>
                            </div>
                            <span className="u-circ u-circ--sm"><ArrowUpRight size={15} /></span>
                        </div>
                    )}

                    <div className="h-start-foot">
                        <p className="h-steps-copy" key={step}>{STEPS[step].copy}</p>
                        <div className="u-steps" style={{ '--n': STEPS.length, '--dur': '5s' }}>
                            {STEPS.map((s, i) => (
                                <button
                                    key={s.title}
                                    className={`u-step${i === step ? ' on' : ''}${autoStep ? ' run' : ''}`}
                                    onClick={() => { setStep(i); setAutoStep(false); }}
                                >
                                    <span className="u-label">{pad2(i + 1)}</span>
                                    <b>{s.title}</b>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="h-side">
                    <button className="u-card h-card u-hover" data-rise style={{ '--d': '80ms' }} onClick={() => setCreateOpen(true)}>
                        <span className="u-label"><Folder size={13} /> Project · {loadingData ? '…' : projects.length} so far</span>
                        <div className="h-card-row">
                            <div>
                                <h3>New project</h3>
                                <p>A multi-file workspace with preview, history and invites.</p>
                            </div>
                            <span className="u-circ"><ArrowUpRight size={17} /></span>
                        </div>
                    </button>
                    <button className="u-card h-card u-hover" data-rise style={{ '--d': '160ms' }} onClick={() => navigate('/snippets')}>
                        <span className="u-label"><Code2 size={13} /> Library · {snippetCount ?? '…'} snippets</span>
                        <div className="h-card-row">
                            <div>
                                <h3>Snippets</h3>
                                <p>Reusable code you can drop into any room.</p>
                            </div>
                            <span className="u-circ"><ArrowUpRight size={17} /></span>
                        </div>
                    </button>
                </div>
            </div>

            <div className="u-section-head" data-rise style={{ marginTop: 'clamp(56px, 8vw, 96px)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span className="u-label">Your workspace</span>
                    <p className="u-lede"><b>Everything you're building.</b> Rooms for quick sessions, projects that stick around.</p>
                </div>
            </div>

            <div className="u-stats" data-rise>
                {statItems.map((s) => (
                    <div className="u-stat" key={s.label}>
                        <span className="u-label">{s.label}</span>
                        {loadingData ? <span className="u-skel" style={{ height: 80, width: '60%' }} /> : <RollingNumber value={s.value} suffix={s.suffix} />}
                        <p>{s.note}</p>
                    </div>
                ))}
            </div>

            <section className="u-section" style={{ marginTop: 40 }} id="board">
                <div className="u-sheetbox">
                    <div className="d-board">
                        <aside className="u-card d-side" aria-label="Filter">
                            {[
                                ['all', 'Everything', rooms.length + projects.length],
                                ['rooms', 'Rooms', rooms.length],
                                ['projects', 'Projects', projects.length],
                            ].map(([id, label, count]) => (
                                <button key={id} className={view === id && !lang ? 'on' : ''} onClick={() => { setView(id); setLang(null); }}>
                                    {label} <em>{count}</em>
                                </button>
                            ))}
                            {languages.length > 0 && <hr />}
                            {languages.length > 0 && <span className="u-label">Room language</span>}
                            {languages.map(([l, n]) => (
                                <button key={l} className={lang === l ? 'on' : ''} onClick={() => { setLang(lang === l ? null : l); setView('rooms'); }}>
                                    <span className="u-mono" style={{ fontSize: 12.5 }}>{l}</span> <em>{n}</em>
                                </button>
                            ))}
                        </aside>

                        <div className="u-card d-list">
                            <div className="d-toolbar">
                                <label className="u-search">
                                    <Search size={15} />
                                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${view === 'all' ? 'rooms and projects' : view}`} aria-label="Search" />
                                </label>
                                <div className="u-seg" role="tablist" aria-label="Sort">
                                    <button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>Recent</button>
                                    <button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>A–Z</button>
                                </div>
                            </div>

                            {loadingData ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 0' }}>
                                    {[0, 1, 2, 3].map((i) => <div key={i} className="u-skel" style={{ height: 58 }} />)}
                                </div>
                            ) : items.length === 0 ? (
                                <div className="u-empty">
                                    <span className="u-display">{query ? 'No match' : 'Empty'}</span>
                                    <p>{query ? `Nothing matches “${query}”.` : view === 'projects' ? 'No projects yet. Start one to keep files, history and teammates together.' : 'No rooms yet. Start one and share the link.'}</p>
                                    {!query && (view === 'projects'
                                        ? <button className="u-btn u-btn--solid" onClick={() => setCreateOpen(true)}><Plus size={16} /> New project</button>
                                        : <button className="u-btn u-btn--solid" onClick={() => navigate(`/editor/${newRoomId()}`)}><Plus size={16} /> New room</button>)}
                                </div>
                            ) : (
                                <ul className="u-rows">
                                    {items.map((item) => {
                                        const isProject = item.kind === 'project';
                                        const key = `${item.kind}-${item.id}`;
                                        const when = itemDate(item);
                                        return (
                                            <li key={key} className="u-row d-row" tabIndex={0} onClick={() => openItem(item)} onKeyDown={(e) => e.key === 'Enter' && openItem(item)}>
                                                <span className="d-ico">{isProject ? <Folder size={17} /> : <Terminal size={17} />}</span>
                                                <div className="u-row-main">
                                                    <span className="u-row-title u-ellipsis">{item.name || item.id}</span>
                                                    <span className="u-row-meta">
                                                        <span className="u-chip u-chip--mono">{isProject ? (item.type || 'project') : (item.lang || 'room')}</span>
                                                        <span className="u-mono u-ellipsis">{isProject ? (item.description || 'Multi-file project') : `room/${item.id}`}</span>
                                                    </span>
                                                </div>
                                                <div className="u-row-side">
                                                    <span className="u-row-when">{when ? timeAgo(when) : (item.lastActive || 'Just now').split(',')[0]}</span>
                                                    <RowMenu open={menuFor === key} onToggle={(v) => setMenuFor(v ? key : null)}>
                                                        <button onClick={() => { setMenuFor(null); openItem(item); }}><ArrowUpRight size={16} />Open</button>
                                                        {!isProject && <button onClick={() => { setMenuFor(null); copyRoomLink(item.id); }}><Link2 size={16} />Copy invite link</button>}
                                                        {!isProject && <button onClick={() => { setMenuFor(null); setRenameTarget(item); setNewName(item.name || ''); }}><Pencil size={16} />Rename</button>}
                                                        <button className="danger" onClick={() => { setMenuFor(null); setDeleteTarget(item); }}><Trash2 size={16} />Delete</button>
                                                    </RowMenu>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        <aside className="u-card d-read" aria-label="Summary">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <h4><Sparkles size={15} /> The read</h4>
                                {loadingData ? <span className="u-skel" style={{ height: 60 }} /> : latest ? (
                                    <p>
                                        You have <mark>{rooms.length} room{rooms.length === 1 ? '' : 's'}</mark> and <mark>{projects.length} project{projects.length === 1 ? '' : 's'}</mark>.
                                        {' '}Most recent is <mark>{latest.name || latest.id}</mark>{itemDate(latest) ? `, ${timeAgo(itemDate(latest))}` : ''}.
                                        {languages[0] && <> You mostly write <mark>{languages[0][0]}</mark>.</>}
                                    </p>
                                ) : <p>Nothing here yet. Start a room and it will show up in this list.</p>}
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <span className="u-label">Activity · {DAYS} days</span>
                                    <span className="u-label">{bars.reduce((a, b) => a + b, 0)}</span>
                                </div>
                                <div className="d-bars" aria-label="Rooms and projects touched per day">
                                    {bars.map((n, i) => (
                                        <i key={i} className={n === 0 ? 'zero' : ''} title={`${n}`} style={{ height: `${n === 0 ? 100 : Math.max(8, (n / maxBar) * 100)}%`, '--d': `${i * 35}ms`, opacity: n === 0 ? 0.6 : 1 }} />
                                    ))}
                                </div>
                                <div className="d-bars-x"><span>{DAYS}d ago</span><span>today</span></div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <span className="u-label">Getting started</span>
                                <ul className="d-check">
                                    {checklist.map((c) => (
                                        <li key={c.text} className={c.done ? 'done' : ''}><i>{c.done && <Check size={11} strokeWidth={3} />}</i>{c.text}</li>
                                    ))}
                                </ul>
                            </div>
                        </aside>
                    </div>
                </div>
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
                    <span className="u-field-label">Template</span>
                    <div className="u-tiles">
                        {TEMPLATES.map(({ id, name, desc, icon: Icon }) => (
                            <button type="button" key={id} className={`u-tile${form.type === id ? ' on' : ''}`} onClick={() => setForm({ ...form, type: id })} aria-pressed={form.type === id}>
                                <span className="u-tile-ico"><Icon size={17} /></span>
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
