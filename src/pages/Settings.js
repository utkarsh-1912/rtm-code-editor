import React, { useState, useEffect, useCallback } from 'react';
import { Save, Check, Monitor, Laptop, Smartphone, Tablet, LogOut, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../utils/api';
import { getThemePref, setThemePref } from '../utils/theme';
import { Modal, pad2, timeAgo } from '../components/ux/primitives';

const SECTIONS = [
    { id: 'profile', title: 'Profile' },
    { id: 'appearance', title: 'Appearance' },
    { id: 'notifications', title: 'Notifications' },
    { id: 'security', title: 'Security' },
];

const NOTIFS = [
    { id: 'joins', title: 'Join and leave alerts', text: 'A note when someone enters or leaves your room.', on: true },
    { id: 'chat', title: 'Chat messages', text: 'A ping for new messages in room chat.', on: true },
    { id: 'updates', title: 'Product updates', text: 'New features and planned maintenance.', on: false },
];

const THEMES = [
    { id: 'dark', name: 'Night' },
    { id: 'light', name: 'Paper' },
    { id: 'system', name: 'System' },
];

const loadNotifPrefs = () => {
    const base = Object.fromEntries(NOTIFS.map((n) => [n.id, n.on]));
    try { return { ...base, ...JSON.parse(localStorage.getItem('notif-prefs') || '{}') }; } catch { return base; }
};

const deviceIcon = (device) => {
    const d = (device || '').toLowerCase();
    if (d.includes('iphone') || d.includes('android')) return <Smartphone size={17} />;
    if (d.includes('tablet') || d.includes('ipad')) return <Tablet size={17} />;
    if (d.includes('mac')) return <Laptop size={17} />;
    return <Monitor size={17} />;
};

const Settings = () => {
    const { user } = useAuth();
    const [active, setActive] = useState('profile');
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({ name: user?.name || '', bio: '', socials: { twitter: '', github: '' } });
    const [theme, setTheme] = useState(getThemePref);
    const [notifs, setNotifs] = useState(loadNotifPrefs);
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    useEffect(() => {
        if (!user?.uid) return;
        (async () => {
            try {
                const res = await fetch(`${getBackendUrl()}/api/user-dashboard?userId=${user.uid}`);
                const data = await res.json();
                if (data.user) {
                    setProfile({
                        name: data.user.name || user.name || '',
                        bio: data.user.bio || '',
                        socials: { twitter: '', github: '', ...(data.user.social_links || {}) },
                    });
                }
            } catch (err) {
                console.error('Failed to fetch profile:', err);
            }
        })();
    }, [user]);

    const fetchSessions = useCallback(async () => {
        if (!user) return;
        setSessionsLoading(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/sessions?userId=${user.uid}`);
            const data = await res.json();
            setSessions(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        } finally {
            setSessionsLoading(false);
        }
    }, [user]);

    useEffect(() => { if (active === 'security') fetchSessions(); }, [active, fetchSessions]);

    const saveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/user/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid, profileData: { name: profile.name, bio: profile.bio, social_links: profile.socials } }),
            });
            if (res.ok) toast.success('Profile saved');
            else toast.error('Failed to update profile');
        } catch {
            toast.error('An error occurred');
        } finally {
            setSaving(false);
        }
    };

    const chooseTheme = (id) => {
        setTheme(id);
        setThemePref(id);
    };

    const toggleNotif = (id) => {
        const next = { ...notifs, [id]: !notifs[id] };
        setNotifs(next);
        try { localStorage.setItem('notif-prefs', JSON.stringify(next)); } catch { /* storage blocked */ }
    };

    const signOutOthers = async () => {
        const currentId = localStorage.getItem('rtm_db_session_id');
        try {
            await fetch(`${getBackendUrl()}/api/sessions/others?userId=${user.uid}&currentSessionId=${currentId || -1}`, { method: 'DELETE' });
            toast.success('Signed out other devices');
            fetchSessions();
        } catch {
            toast.error('Failed to sign out other devices');
        }
    };

    const deleteAccount = async () => {
        try {
            const res = await fetch(`${getBackendUrl()}/api/user?userId=${user.uid}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Account deleted');
                window.location.href = '/login';
            } else {
                toast.error('Failed to delete account');
            }
        } catch {
            toast.error('An error occurred');
        }
    };

    const avatar = user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=1C1C19&color=E8E6DF`;
    const currentSessionId = localStorage.getItem('rtm_db_session_id');
    const idx = SECTIONS.findIndex((s) => s.id === active);

    return (
        <AppLayout>
            <div className="u-head">
                <span className="u-label" data-rise>03 — Account</span>
                <div className="u-head-body">
                    <h1 className="u-lede" data-rise style={{ '--d': '60ms' }}>
                        <b>Your account, your rules.</b> Profile, theme, alerts and the devices signed in.
                    </h1>
                </div>
            </div>

            <div className="g-layout">
                <nav className="g-index" aria-label="Settings sections" data-rise>
                    {SECTIONS.map((s, i) => (
                        <button key={s.id} className={active === s.id ? 'on' : ''} onClick={() => setActive(s.id)} aria-current={active === s.id ? 'page' : undefined}>
                            <span>{pad2(i + 1)}</span><span>{s.title}</span>
                        </button>
                    ))}
                </nav>

                <div className="g-content" key={active}>
                    <h2 className="u-display u-lg u-lines is-in" style={{ marginBottom: 8 }}>
                        <span><span>{SECTIONS[idx].title}</span></span>
                    </h2>

                    {active === 'profile' && (
                        <form className="u-card u-enter" onSubmit={saveProfile}>
                            <div className="g-profile">
                                <img src={avatar} alt="" />
                                <div style={{ minWidth: 0 }}>
                                    <h4 className="u-ellipsis">{profile.name || user?.name || 'Your name'}</h4>
                                    <span className="u-mono u-faint u-ellipsis" style={{ fontSize: 12, display: 'block' }}>{user?.email}</span>
                                </div>
                            </div>
                            <div className="g-form">
                                <div className="u-field">
                                    <label htmlFor="pf-name">Display name</label>
                                    <input id="pf-name" className="u-input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="How teammates see you" />
                                </div>
                                <div className="u-field">
                                    <label htmlFor="pf-bio">Bio</label>
                                    <textarea id="pf-bio" className="u-textarea" value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="A line or two about what you build" />
                                </div>
                                <div className="g-two">
                                    <div className="u-field">
                                        <label htmlFor="pf-gh">GitHub</label>
                                        <input id="pf-gh" className="u-input" value={profile.socials.github} onChange={(e) => setProfile({ ...profile, socials: { ...profile.socials, github: e.target.value } })} placeholder="username" />
                                    </div>
                                    <div className="u-field">
                                        <label htmlFor="pf-tw">X / Twitter</label>
                                        <input id="pf-tw" className="u-input" value={profile.socials.twitter} onChange={(e) => setProfile({ ...profile, socials: { ...profile.socials, twitter: e.target.value } })} placeholder="@handle" />
                                    </div>
                                </div>
                            </div>
                            <div className="u-modal-foot" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="u-label">Visible to people in your rooms</span>
                                <button type="submit" className="u-btn u-btn--solid" disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save profile'}</button>
                            </div>
                        </form>
                    )}

                    {active === 'appearance' && (
                        <div className="u-card u-enter">
                            <div className="g-panel-head"><strong>Theme</strong><span className="u-label">Saved on this device</span></div>
                            <div className="g-themes">
                                {THEMES.map((t) => (
                                    <button key={t.id} className={`g-theme${theme === t.id ? ' on' : ''}`} onClick={() => chooseTheme(t.id)} aria-pressed={theme === t.id}>
                                        <div className={`g-theme-prev ${t.id}`}>
                                            <b>{t.name}</b>
                                            <i style={{ width: '70%' }} /><i style={{ width: '45%' }} /><i style={{ width: '58%' }} />
                                        </div>
                                        <div className="g-theme-name">
                                            <span>{t.id === 'system' ? 'Match my device' : t.id === 'dark' ? 'Dark' : 'Light'}</span>
                                            {theme === t.id && <Check size={16} />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {active === 'notifications' && (
                        <div className="u-card u-enter">
                            <div className="g-panel-head"><strong>Alerts</strong><span className="u-label">Saved on this device</span></div>
                            <ul className="g-rules">
                                {NOTIFS.map((n, i) => (
                                    <li key={n.id}>
                                        <span>{pad2(i + 1)}</span>
                                        <div>
                                            <h5>{n.title}</h5>
                                            <p>{n.text}</p>
                                            <div className="g-cap">{notifs[n.id] ? 'on' : 'off'}</div>
                                        </div>
                                        <button className="u-switch" role="switch" aria-checked={!!notifs[n.id]} aria-label={n.title} onClick={() => toggleNotif(n.id)} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {active === 'security' && (
                        <>
                            <div className="u-card u-enter">
                                <div className="g-panel-head">
                                    <div>
                                        <strong>Active sessions</strong>
                                        <div className="u-small u-muted">Devices signed in to your account.</div>
                                    </div>
                                    <button className="u-btn u-btn--ghost u-btn--sm" onClick={signOutOthers} disabled={sessions.length <= 1}><LogOut size={14} /> Sign out others</button>
                                </div>
                                {sessionsLoading && sessions.length === 0 ? (
                                    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {[0, 1].map((i) => <div key={i} className="u-skel" style={{ height: 44 }} />)}
                                    </div>
                                ) : sessions.length === 0 ? (
                                    <p className="u-muted u-small" style={{ padding: 18, margin: 0 }}>No sessions found.</p>
                                ) : sessions.map((s) => {
                                    const isCurrent = String(s.id) === String(currentSessionId);
                                    return (
                                        <div key={s.id} className="g-session">
                                            <span className="d-ico" style={isCurrent ? { background: 'var(--u-solid)', color: 'var(--u-on-solid)' } : undefined}>{deviceIcon(s.device)}</span>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 14.5, fontWeight: 500, display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <span className="u-ellipsis">{s.device || 'Unknown device'}</span>
                                                    {isCurrent && <span className="u-chip u-chip--mono u-chip--accent">This device</span>}
                                                </div>
                                                <div className="u-mono u-faint" style={{ fontSize: 11.5 }}>{s.ip} · {s.last_active ? timeAgo(s.last_active) : '—'}</div>
                                            </div>
                                            {isCurrent && <span className="u-dot" />}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="u-card g-danger u-enter" style={{ '--d': '80ms' }}>
                                <ul className="g-rules">
                                    <li>
                                        <span>!!</span>
                                        <div>
                                            <h5>Delete account</h5>
                                            <p>Removes your account with every room, project and snippet. This can't be undone.</p>
                                        </div>
                                        <button className="u-btn u-btn--ghost u-btn--sm" style={{ color: 'var(--u-bad)' }} onClick={() => { setConfirmText(''); setDeleteOpen(true); }}>
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <Modal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                label="Delete account"
                title="This is permanent."
                description="Every room, project, snippet and setting tied to this account will be removed."
                onSubmit={() => confirmText.trim().toLowerCase() === 'delete' && deleteAccount()}
                footer={<>
                    <button type="button" className="u-btn u-btn--ghost" onClick={() => setDeleteOpen(false)}>Cancel</button>
                    <button type="submit" className="u-btn u-btn--danger" disabled={confirmText.trim().toLowerCase() !== 'delete'}>Delete my account</button>
                </>}
            >
                <div className="u-field">
                    <label htmlFor="del-confirm">Type <span className="u-mono">delete</span> to confirm</label>
                    <input id="del-confirm" className="u-input" autoFocus value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
                </div>
            </Modal>
        </AppLayout>
    );
};

export default Settings;
