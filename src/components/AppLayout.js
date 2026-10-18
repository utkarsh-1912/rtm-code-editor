import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Sun, Moon, LogOut, Settings as SettingsIcon, LayoutGrid, Code2, Plus, Keyboard } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../utils/api';
import SearchModal from './SearchModal';
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

const AppLayout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const userRef = useRef(null);
    const [isLight, toggleTheme] = useThemeToggle();
    const [userMenu, setUserMenu] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
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
                <span className="u-strip-hide u-ellipsis">Signed in as {user?.email || user?.name || 'you'}</span>
            </>}
            stripRight={<button onClick={() => setSearchOpen(true)}>Search <kbd style={{ font: 'inherit' }}>Ctrl K</kbd></button>}
            right={<>
                <button className="u-icon u-icon--hide" onClick={() => setSearchOpen(true)} aria-label="Search"><Search size={18} /></button>
                <div style={{ position: 'relative' }}>
                    <button className={`u-icon${notifOpen ? ' on' : ''}`} onClick={() => { setNotifOpen((v) => !v); setHasUnread(false); }} aria-label="Notifications">
                        <Bell size={18} />
                        {hasUnread && <span className="u-badge" />}
                    </button>
                    <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
                </div>
                <button className="u-icon u-icon--hide" onClick={toggleTheme} aria-label="Toggle theme">
                    {isLight ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                <button className="u-btn u-btn--solid u-nav-new" style={{ marginLeft: 6 }} onClick={startRoom}>
                    <Plus size={16} /> New room
                </button>
                <div ref={userRef} style={{ position: 'relative' }}>
                    <button className="u-avatar" onClick={() => setUserMenu((v) => !v)} aria-label="Account menu" aria-expanded={userMenu}>
                        <Avatar name={user?.name || user?.email || ''} photoURL={user?.photoURL} size={34} title="" />
                    </button>
                    {userMenu && (
                        <div className="u-pop" role="menu">
                            <div className="u-pop-head">
                                <strong>{user?.name || 'User'}</strong>
                                <span className="u-ellipsis">{user?.email}</span>
                            </div>
                            {NAV.map(({ to, label, icon: Icon }) => (
                                <button key={to} role="menuitem" onClick={() => { setUserMenu(false); navigate(to); }}><Icon size={16} />{label}</button>
                            ))}
                            <button role="menuitem" onClick={() => { setUserMenu(false); setSearchOpen(true); }}><Keyboard size={16} />Search <kbd>Ctrl K</kbd></button>
                            <button role="menuitem" onClick={() => { setUserMenu(false); toggleTheme(); }}>{isLight ? <Moon size={16} /> : <Sun size={16} />}{isLight ? 'Dark' : 'Light'} theme</button>
                            <button role="menuitem" className="danger" onClick={signOut}><LogOut size={16} />Sign out</button>
                        </div>
                    )}
                </div>
            </>}
            sheetFoot={<>
                <button className="u-btn u-btn--solid" onClick={startRoom}><Plus size={16} /> New room</button>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button className="u-btn u-btn--ghost" onClick={toggleTheme}>{isLight ? <Moon size={16} /> : <Sun size={16} />} Theme</button>
                    <button className="u-btn u-btn--ghost" onClick={signOut}><LogOut size={16} /> Sign out</button>
                </div>
            </>}
            footerCta={<button className="u-btn u-btn--solid u-btn--lg" onClick={startRoom}><Plus size={16} /> New room</button>}
            after={<SearchModal isOpen={searchOpen} onClose={closeSearch} />}
        >
            {children}
        </Shell>
    );
};

export default AppLayout;
