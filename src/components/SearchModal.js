import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Terminal, Folder, FileText, Code2, CalendarDays, LayoutGrid, Settings, Plus, CalendarPlus, Sun,
    LifeBuoy, Activity, CreditCard, ArrowRight, Clock, CornerDownLeft, Loader2,
} from 'lucide-react';
import { getBackendUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { recentRooms } from '../utils/recentRooms';
import { newRoomId } from './ux/primitives';
import { formatWhen } from '../utils/meetings';

// Search palette (Ctrl K): pages and actions instantly, plus your rooms, projects, files,
// snippets and meetings from the server. Filters narrow it to one kind.
const SCOPES = [
    { id: 'all', label: 'All' },
    { id: 'room', label: 'Rooms' },
    { id: 'project', label: 'Projects' },
    { id: 'file', label: 'Files' },
    { id: 'snippet', label: 'Snippets' },
    { id: 'meeting', label: 'Meetings' },
];
const ICON = { room: Terminal, project: Folder, file: FileText, snippet: Code2, meeting: CalendarDays, page: ArrowRight, action: Plus, recent: Clock };
const GROUP = { recent: 'Recent', action: 'Actions', page: 'Go to', room: 'Rooms', project: 'Projects', file: 'Files', snippet: 'Snippets', meeting: 'Meetings' };
const EMPTY = { rooms: [], projects: [], files: [], snippets: [], meetings: [] };

// Case-insensitive subsequence match with a score (prefix and word starts score higher).
function score(text, q) {
    const t = String(text || '').toLowerCase();
    const s = q.toLowerCase();
    if (!s) return 1;
    const at = t.indexOf(s);
    if (at === 0) return 100;
    if (at > 0) return t[at - 1] === ' ' || t[at - 1] === '/' ? 80 : 60;
    let i = 0;
    for (const ch of t) if (ch === s[i]) i += 1;
    return i === s.length ? 20 : 0;
}

// Wrap the matched part of `text` in <mark>.
function Highlight({ text, q }) {
    const t = String(text || '');
    const i = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (i < 0) return t;
    return <>{t.slice(0, i)}<mark>{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
}

const SearchModal = ({ isOpen, onClose, onOpenHelp, onToggleTheme }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('all');
    const [remote, setRemote] = useState(EMPTY);
    const [loading, setLoading] = useState(false);
    const [cursor, setCursor] = useState(0);
    const listRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return undefined;
        setQuery(''); setScope('all'); setRemote(EMPTY); setCursor(0);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);

    // Server results, debounced; stale answers are ignored.
    useEffect(() => {
        const q = query.trim();
        if (!isOpen || !q || !user?.uid) { setRemote(EMPTY); setLoading(false); return undefined; }
        let live = true;
        setLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`${getBackendUrl()}/api/search?q=${encodeURIComponent(q)}&userId=${encodeURIComponent(user.uid)}`);
                const data = await res.json();
                if (live) setRemote({ ...EMPTY, ...data });
            } catch {
                if (live) setRemote(EMPTY);
            } finally {
                if (live) setLoading(false);
            }
        }, 220);
        return () => { live = false; clearTimeout(t); };
    }, [query, isOpen, user?.uid]);

    const items = useMemo(() => {
        const q = query.trim();
        const go = (to, state) => () => navigate(to, state ? { state } : undefined);
        const local = [
            { kind: 'action', id: 'new-room', title: 'New room', sub: 'Start a room and share the link', icon: Plus, run: () => navigate(`/editor/${newRoomId()}`, { state: { userName: user?.name || '', role: 'editor' } }) },
            ...(user?.uid ? [
                { kind: 'action', id: 'new-project', title: 'New project', sub: 'Files, history and teammates together', icon: Folder, run: go('/dashboard', { openCreateProject: true }) },
                { kind: 'action', id: 'schedule', title: 'Schedule a call', sub: 'Invite people with a calendar invite', icon: CalendarPlus, run: go('/dashboard', { openSchedule: true }) },
                { kind: 'action', id: 'new-snippet', title: 'New snippet', sub: 'Save code you reuse', icon: Code2, run: go('/snippets', { create: true }) },
            ] : []),
            ...(onToggleTheme ? [{ kind: 'action', id: 'theme', title: 'Switch light / dark', sub: 'Theme', icon: Sun, run: onToggleTheme }] : []),
            ...(onOpenHelp ? [{ kind: 'action', id: 'help', title: 'Help & shortcuts', sub: 'Guides, what\'s new, contact', icon: LifeBuoy, run: onOpenHelp }] : []),
            { kind: 'page', id: 'p-dash', title: 'Workspace', sub: 'Rooms and projects', icon: LayoutGrid, run: go('/dashboard') },
            { kind: 'page', id: 'p-snip', title: 'Snippets', sub: 'Your vault and team vaults', icon: Code2, run: go('/snippets') },
            { kind: 'page', id: 'p-teams', title: 'Teams', sub: 'Shared vaults and members', icon: Code2, run: go('/snippets', { tab: 'teams' }) },
            { kind: 'page', id: 'p-set', title: 'Settings', sub: 'Profile, editor, devices', icon: Settings, run: go('/settings') },
            { kind: 'page', id: 'p-bill', title: 'Plan & billing', sub: 'Settings', icon: CreditCard, run: go('/settings?section=billing') },
            { kind: 'page', id: 'p-status', title: 'System status', sub: 'Is everything working?', icon: Activity, run: go('/status') },
            { kind: 'page', id: 'p-support', title: 'Support', sub: 'Contact us', icon: LifeBuoy, run: go('/support') },
        ];

        if (!q) {
            const recent = recentRooms().slice(0, 5).map((r) => ({ kind: 'recent', id: `rr-${r.id}`, title: `room/${r.id}`, sub: r.language || 'Room', icon: Clock, run: go(`/editor/${r.id}`) }));
            return scope === 'all' ? [...recent, ...local] : [];
        }

        const fromServer = [
            ...remote.rooms.map((r) => ({ kind: 'room', id: `r-${r.room_id}`, title: r.name || r.room_id, sub: `room/${r.room_id}${r.language ? ` · ${r.language}` : ''}`, run: go(`/editor/${r.room_id}`) })),
            ...remote.projects.map((p) => ({ kind: 'project', id: `p-${p.id}`, title: p.name, sub: p.description || p.type || 'Project', run: go(`/project/${p.id}`) })),
            ...remote.files.map((f) => ({ kind: 'file', id: `f-${f.id}`, title: String(f.path || '').replace(/^\/+/, '').split('/').pop(), sub: `${f.project_name} · ${String(f.path || '').replace(/^\/+/, '')}`, run: go(`/project/${f.project_id}`, { openPath: String(f.path || '').replace(/^\/+/, '') }) })),
            ...remote.snippets.map((s) => ({ kind: 'snippet', id: `s-${s.id}`, title: s.title, sub: s.match_line ? s.match_line.trim().slice(0, 90) : s.language, code: !!s.match_line, run: go('/snippets', { snippetId: s.id }) })),
            ...remote.meetings.map((m) => ({ kind: 'meeting', id: `m-${m.id}`, title: m.title, sub: formatWhen(m.starts_at), run: go(`/meet/${m.id}`) })),
        ];
        const matchedLocal = scope === 'all'
            ? local.map((it) => ({ ...it, s: Math.max(score(it.title, q), String(it.sub || '').toLowerCase().includes(q.toLowerCase()) ? 30 : 0) })).filter((it) => it.s > 0).sort((a, b) => b.s - a.s).slice(0, 4)
            : [];
        return [...matchedLocal, ...fromServer.filter((it) => scope === 'all' || it.kind === scope)];
    }, [query, scope, remote, user?.uid, user?.name, navigate, onOpenHelp, onToggleTheme]);

    useEffect(() => { setCursor(0); }, [query, scope]);
    useEffect(() => {
        listRef.current?.querySelector(`[data-i="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [cursor]);

    const pick = (it) => { if (!it) return; onClose(); it.run(); };

    const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); pick(items[cursor]); }
        else if (e.key === 'Tab') {
            e.preventDefault();
            const i = SCOPES.findIndex((s) => s.id === scope);
            setScope(SCOPES[(i + (e.shiftKey ? SCOPES.length - 1 : 1)) % SCOPES.length].id);
        }
    };

    if (!isOpen) return null;

    const q = query.trim();
    let lastGroup = null;
    return (
        <div className="sx-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="sx" role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKey}>
                <label className="sx-input">
                    {loading ? <Loader2 size={18} className="sx-spin" /> : <Search size={18} />}
                    <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={user?.uid ? 'Search rooms, projects, files, snippets…' : 'Search pages and actions…'} aria-label="Search" />
                    <kbd>Esc</kbd>
                </label>
                {user?.uid && (
                    <div className="sx-scopes" role="tablist" aria-label="Filter">
                        {SCOPES.map((s) => (
                            <button key={s.id} role="tab" aria-selected={scope === s.id} className={scope === s.id ? 'on' : ''} onClick={() => setScope(s.id)}>{s.label}</button>
                        ))}
                    </div>
                )}
                <div className="sx-list" ref={listRef} role="listbox">
                    {items.length === 0 ? (
                        <div className="sx-empty">
                            {!q ? 'Type to search.' : loading ? 'Searching…' : <>Nothing found for “{q}”.{scope !== 'all' && <button onClick={() => setScope('all')}>Search everything</button>}</>}
                        </div>
                    ) : items.map((it, i) => {
                        const head = it.kind !== lastGroup ? GROUP[it.kind] : null;
                        lastGroup = it.kind;
                        const Icon = it.icon || ICON[it.kind] || ArrowRight;
                        return (
                            <React.Fragment key={it.id}>
                                {head && <div className="sx-group">{head}</div>}
                                <button
                                    data-i={i}
                                    role="option"
                                    aria-selected={i === cursor}
                                    className={`sx-item${i === cursor ? ' on' : ''}`}
                                    onMouseMove={() => cursor !== i && setCursor(i)}
                                    onClick={() => pick(it)}
                                >
                                    <span className={`sx-ico sx-ico--${it.kind}`}><Icon size={15} /></span>
                                    <span className="sx-text">
                                        <b className="u-ellipsis"><Highlight text={it.title} q={q} /></b>
                                        <span className={`u-ellipsis${it.code ? ' sx-code' : ''}`}><Highlight text={it.sub} q={q} /></span>
                                    </span>
                                    {i === cursor && <CornerDownLeft size={14} className="sx-enter" />}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
                <div className="sx-foot">
                    <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
                    <span><kbd>Enter</kbd> open</span>
                    {user?.uid && <span><kbd>Tab</kbd> filter</span>}
                    {!user?.uid && <span className="sx-note">Sign in to search your rooms and files</span>}
                </div>
            </div>
        </div>
    );
};

export default SearchModal;
