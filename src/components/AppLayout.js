import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Sun, Moon, LogOut, LogIn, LifeBuoy, Settings as SettingsIcon, LayoutGrid, Code2, Plus, UserRound, ShieldCheck, CreditCard, ChevronDown, UserCheck, CalendarPlus, CalendarClock, Folder } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../utils/api';
import SearchModal from './SearchModal';
import HelpModal from './HelpModal';
import Announcements from './ux/Announcements';
import NotificationCenter from './NotificationCenter';
import Shell, { useOnline, useThemeToggle } from './ux/Shell';
import { useBackend, backendLabel } from '../context/BackendContext';
import { Avatar } from './clients';
import { newRoomId } from './ux/primitives';

// One home for signed-in users: the workspace lives at /dashboard ("/" redirects there).
const NAV = [
    { to: '/dashboard', label: 'Workspace', icon: LayoutGrid },
    { to: '/snippets', label: 'Snippets', icon: Code2 },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const COLUMNS = [
    { title: 'Workspace', links: [['Workspace', '/dashboard'], ['Snippets', '/snippets'], ['Settings', '/settings']] },
    { title: 'Product', links: [['Features', '/features'], ['Download', '/download'], ['Pricing', '/pricing']] },
    { title: 'Help', links: [['Support', '/support'], ['Status', '/status'], ['Security', '/security']] },
    { title: 'Legal', links: [['Privacy', '/privacy'], ['Terms', '/terms']] },
];

// The navbar's New button: a room in one click, everything else from its menu.
function NewSplit({ onRoom, items }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const key = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', key);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
    }, [open]);
    return (
        <div className="u-split u-nav-new" ref={ref}>
            <button className="u-btn u-btn--solid u-split-main" onClick={onRoom}><Plus size={16} /> New room</button>
            <button className="u-btn u-btn--solid u-split-more" onClick={() => setOpen((v) => !v)} aria-label="More things to create" aria-haspopup="menu" aria-expanded={open}><ChevronDown size={15} /></button>
            {open && (
                <div className="u-pop u-split-pop" role="menu">
                    {items.map(({ id, Icon, title, sub, run }) => (
                        <button key={id} role="menuitem" onClick={() => { setOpen(false); run(); }}>
                            <Icon size={16} />
                            <span className="u-split-text"><b>{title}</b><span>{sub}</span></span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

const AppLayout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const userRef = useRef(null);
    const [isLight, toggleTheme] = useThemeToggle();
    const [userMenu, setUserMenu] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const online = useOnline();
    const backend = useBackend();

    const checkNotifications = useCallback(async () => {
        if (!user?.uid) return;
        try {
            const res = await fetch(`${getBackendUrl()}/api/notifications?userId=${user.uid}`);
            const list = await res.json();
            const unread = Array.isArray(list) ? list.filter((n) => !n.read) : [];
            setHasUnread(unread.length > 0);
            // Installed app: surface new alerts natively (web push is browser-only).
            if (window.colabsDesktop?.notify) {
                const seen = Number(sessionStorage.getItem('notif-seen') || 0);
                const fresh = unread.filter((n) => Number(n.id) > seen);
                if (seen && fresh.length) window.colabsDesktop.notify({ title: 'Utkristi CoLabs', body: fresh[0].message }).catch(() => { });
                const top = Math.max(0, ...list.map((n) => Number(n.id) || 0));
                sessionStorage.setItem('notif-seen', String(top));
            }
        } catch (err) {
            /* offline: leave badge as is */
        }
    }, [user?.uid]);

    useEffect(() => {
        checkNotifications();
        const id = setInterval(checkNotifications, 60000);
        return () => clearInterval(id);
    }, [checkNotifications]);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
            // "?" opens help, unless you're typing.
            const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
            if (e.key === '?' && !typing && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                setHelpOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (!userMenu) return undefined;
        const close = (e) => { if (userRef.current && !userRef.current.contains(e.target)) setUserMenu(false); };
        const esc = (e) => e.key === 'Escape' && setUserMenu(false);
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
    }, [userMenu]);

    const closeSearch = useCallback(() => setSearchOpen(false), []);

    const signOut = () => {
        logout();
        toast.success('Signed out');
        navigate('/');
    };

    const startRoom = () => navigate(`/editor/${newRoomId()}`, { state: { userName: user?.name || '', role: 'editor' } });


    return (
        <Shell
            homeTo="/dashboard"
            links={NAV}
            columns={COLUMNS}
            holdHeader={userMenu || notifOpen}
            stripLeft={<>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className={`u-dot${!online || backend.status === 'down' ? ' u-dot--bad' : backend.status === 'up' ? '' : ' u-dot--warn'}`} />
                    {online ? backendLabel(backend) : 'Offline'}
                </span>
                <span className="u-strip-hide u-ellipsis"><Announcements audience="app" /></span>
            </>}
            stripRight={<button onClick={() => setHelpOpen(true)} title="Help, what's new and shortcuts (?)"><LifeBuoy size={12} style={{ verticalAlign: '-2px' }} /> Help</button>}
            onSearch={user ? undefined : () => setSearchOpen(true)}
            right={<>
                <button className="u-icon" onClick={() => setSearchOpen(true)} aria-label="Search (Ctrl K)" title="Search (Ctrl K)"><Search size={18} /></button>
                {user && <div style={{ position: 'relative' }}>
                    {/* Phones open notifications from the account menu instead. */}
                    <button className={`u-icon u-icon--hide${notifOpen ? ' on' : ''}`} onClick={() => { setNotifOpen((v) => !v); setHasUnread(false); }} aria-label="Notifications">
                        <Bell size={18} />
                        {hasUnread && <span className="u-badge" />}
                    </button>
                    <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
                </div>}
                <button className="u-icon u-icon--hide" onClick={toggleTheme} aria-label="Toggle theme">
                    {isLight ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                {user ? (
                    <NewSplit onRoom={startRoom} items={[
                        { id: 'room', Icon: Plus, title: 'Room now', sub: 'Code, talk and draw together', run: startRoom },
                        { id: 'interview', Icon: UserCheck, title: 'Interview', sub: 'Start now, pick a time, or let them pick', run: () => navigate('/dashboard', { state: { openInterview: true } }) },
                        { id: 'call', Icon: CalendarPlus, title: 'Scheduled call', sub: 'A room for later, with invites', run: () => navigate('/dashboard', { state: { openSchedule: true } }) },
                        { id: 'book', Icon: CalendarClock, title: 'Booking link', sub: 'People pick a time from your hours', run: () => navigate('/settings?section=scheduling&new=1') },
                        { id: 'project', Icon: Folder, title: 'Project', sub: 'Files, history and teammates', run: () => navigate('/dashboard', { state: { openCreateProject: true } }) },
                        { id: 'snippet', Icon: Code2, title: 'Snippet', sub: 'Save code you reuse', run: () => navigate('/snippets', { state: { create: true } }) },
                    ]} />
                ) : (
                    <button className="u-btn u-btn--solid u-nav-new" style={{ marginLeft: 6 }} onClick={startRoom}>
                        <Plus size={16} /> New room
                    </button>
                )}
                {!user ? (
                    // Guests (public pages like a meeting link) have no account menu.
                    <button className="u-btn u-btn--ghost" onClick={() => navigate('/login', { state: { from: window.location.pathname + window.location.search } })}>
                        <LogIn size={15} /> Sign in
                    </button>
                ) : (
                <div ref={userRef} style={{ position: 'relative' }}>
                    <button className="u-avatar" onClick={() => setUserMenu((v) => !v)} aria-label="Account menu" aria-expanded={userMenu}>
                        <Avatar name={user?.name || user?.email || ''} photoURL={user?.photoURL} size={28} title="" />
                        {hasUnread && <span className="u-badge u-avatar-badge" />}
                    </button>
                    {userMenu && (
                        <div className="u-pop" role="menu">
                            <div className="u-pop-head">
                                <strong>{user?.name || 'User'}</strong>
                                <span className="u-ellipsis">{user?.email}</span>
                            </div>
                            {/* Account only: pages, search and theme are already in the header. */}
                            <button role="menuitem" onClick={() => { setUserMenu(false); navigate('/settings?section=profile'); }}><UserRound size={16} />Profile</button>
                            <button role="menuitem" onClick={() => { setUserMenu(false); navigate('/settings?section=security'); }}><ShieldCheck size={16} />Devices &amp; security</button>
                            <button role="menuitem" onClick={() => { setUserMenu(false); navigate('/settings?section=billing'); }}><CreditCard size={16} />Plan &amp; billing</button>
                            {/* Phones hide the header's notification, search and theme icons, so offer them here. */}
                            <button role="menuitem" className="u-pop-sm" onClick={() => { setUserMenu(false); setNotifOpen(true); setHasUnread(false); }}><Bell size={16} />Notifications{hasUnread && <span className="u-pop-dot" aria-label="unread" />}</button>
                            <button role="menuitem" className="u-pop-sm" onClick={() => { setUserMenu(false); setSearchOpen(true); }}><Search size={16} />Search</button>
                            <button role="menuitem" className="u-pop-sm" onClick={() => { setUserMenu(false); toggleTheme(); }}>{isLight ? <Moon size={16} /> : <Sun size={16} />}{isLight ? 'Dark' : 'Light'} theme</button>
                            <div className="u-pop-sep" role="separator" />
                            <button role="menuitem" className="danger" onClick={signOut}><LogOut size={16} />Sign out</button>
                        </div>
                    )}
                </div>
                )}
            </>}
            sheetFoot={<>
                <button className="u-btn u-btn--solid" onClick={startRoom}><Plus size={16} /> New room</button>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button className="u-btn u-btn--ghost" onClick={toggleTheme}>{isLight ? <Moon size={16} /> : <Sun size={16} />} Theme</button>
                    <button className="u-btn u-btn--ghost" onClick={signOut}><LogOut size={16} /> Sign out</button>
                </div>
            </>}
            footerCta={<button className="u-btn u-btn--solid u-btn--lg" onClick={startRoom}><Plus size={16} /> New room</button>}
            after={<>
                <SearchModal isOpen={searchOpen} onClose={closeSearch} onOpenHelp={() => setHelpOpen(true)} onToggleTheme={toggleTheme} />
                <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
            </>}
        >
            {children}
        </Shell>
    );
};

export default AppLayout;
