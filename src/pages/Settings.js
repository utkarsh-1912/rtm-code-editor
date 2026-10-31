import React, { useState, useEffect } from 'react';
import { Save, Check, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../utils/api';
import { getThemePref, setThemePref } from '../utils/theme';
import { Modal, pad2 } from '../components/ux/primitives';
import { pushConfigured, pushStatus, enablePush, disablePush } from '../utils/push';
import { usePlan, openPortal } from '../utils/billing';
import { useSearchParams } from 'react-router-dom';
import DesktopPanel from '../components/DesktopPanel';
import DeviceList from '../components/DeviceList';
import { IS_DESKTOP } from '../utils/desktop';
import GitHubIcon from '../components/GitHubIcon';
import { useGitHubStatus, connectGitHub, disconnectGitHub, CONNECTED_MESSAGE } from '../utils/github';

const SECTIONS = [
    { id: 'profile', title: 'Profile' },
    { id: 'appearance', title: 'Appearance' },
    { id: 'billing', title: 'Plan & billing' },
    { id: 'notifications', title: 'Notifications' },
    { id: 'connections', title: 'Connections' },
    { id: 'security', title: 'Security' },
    ...(IS_DESKTOP ? [{ id: 'desktop', title: 'Desktop app' }] : []),
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

const Settings = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const signOutHere = async () => {
        await logout();
        toast.success('Signed out');
        navigate('/');
    };
    const [params] = useSearchParams();
    // Guests only get here in the desktop app, and only for the Desktop app section.
    const sections = user ? SECTIONS : SECTIONS.filter((x) => x.id === 'desktop');
    const [active, setActive] = useState(() => (sections.some((x) => x.id === params.get('section')) ? params.get('section') : sections[0]?.id || 'profile'));
    // Follow ?section= when it changes while this page is open (e.g. from the account menu).
    const sectionParam = params.get('section');
    useEffect(() => {
        if (sectionParam && sections.some((x) => x.id === sectionParam)) setActive(sectionParam);
    }, [sectionParam, sections]);
    const { plan, error: planError, reload: reloadPlan } = usePlan(user);
    const [busyBilling, setBusyBilling] = useState(false);
    const manageBilling = async () => {
        setBusyBilling(true);
        try { await openPortal(); } catch (err) { toast.error(err.message); setBusyBilling(false); }
    };
    useEffect(() => {
        // Back from Stripe Checkout: the webhook may land a moment after the redirect.
        if (params.get('billing') !== 'success') return undefined;
        toast.success('Thanks! Your plan is being activated.');
        const timers = [2500, 6000, 12000].map((ms) => setTimeout(reloadPlan, ms));
        return () => timers.forEach(clearTimeout);
    }, [params, reloadPlan]);
    const github = useGitHubStatus(user, active === 'connections');
    const [githubBusy, setGithubBusy] = useState(false);
    useEffect(() => {
        // Back from GitHub. In a popup opened by a room or project: tell it and close.
        const result = params.get('github');
        if (!result) return;
        if (window.opener && !window.opener.closed) {
            try {
                window.opener.postMessage({ type: CONNECTED_MESSAGE, status: result }, window.location.origin);
                window.close();
                return;
            } catch { /* opener on another origin: stay here */ }
        }
        if (result === 'connected') toast.success('GitHub connected');
        else toast.error(params.get('reason') || 'Could not connect GitHub');
    }, [params]);
    const connectGithub = async () => {
        setGithubBusy(true);
        try { await connectGitHub({ popup: false }); } catch (err) { toast.error(err.message); setGithubBusy(false); }
    };
    const disconnectGithub = async () => {
        setGithubBusy(true);
        try {
            await disconnectGitHub();
            toast.success('GitHub disconnected');
            await github.reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setGithubBusy(false);
        }
    };
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({ name: user?.name || '', bio: '', socials: { twitter: '', github: '' } });
    const [theme, setTheme] = useState(getThemePref);
    const [notifs, setNotifs] = useState(loadNotifPrefs);
    const [push, setPush] = useState({ supported: false, enabled: false });
    useEffect(() => { if (pushConfigured()) pushStatus().then(setPush).catch(() => { }); }, []);
    const togglePush = async () => {
        try {
            setPush(push.enabled ? await disablePush() : await enablePush());
        } catch (err) { toast.error(err.message || 'Could not change push settings'); }
    };
    const testPush = async () => {
        const res = await fetch(`${getBackendUrl()}/api/notifications/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.uid }) });
        const data = await res.json().catch(() => ({}));
        if (res.ok) toast.success('Test sent. It should arrive in a moment.'); else toast.error(data.error || 'Test failed');
    };
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
    const idx = Math.max(0, sections.findIndex((s) => s.id === active));

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
                    {sections.map((s, i) => (
                        <button key={s.id} className={active === s.id ? 'on' : ''} onClick={() => setActive(s.id)} aria-current={active === s.id ? 'page' : undefined}>
                            <span>{pad2(i + 1)}</span><span>{s.title}</span>
                        </button>
                    ))}
                </nav>

                <div className="g-content" key={active}>
                    <h2 className="u-display u-lg u-lines is-in" style={{ marginBottom: 8 }}>
                        <span><span>{sections[idx]?.title}</span></span>
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

                    {active === 'desktop' && <DesktopPanel />}

                    {active === 'billing' && (
                        <div className="u-card u-enter">
                            <div className="g-panel-head"><strong>Your plan</strong><span className="u-label">{plan ? (plan.plan === 'free' ? 'Free' : 'Team') : 'Loading'}</span></div>
                            {!plan && <p className="u-muted" style={{ margin: 0 }}>{planError || 'Loading your plan…'}</p>}
                            {plan && (
                                <>
                                    <ul className="g-rules">
                                        <li>
                                            <span>01</span>
                                            <div>
                                                <h5>{plan.plan === 'free' ? 'Free' : 'Team'}{plan.status === 'trialing' ? ' · trial' : ''}{plan.status === 'past_due' ? ' · payment failed' : ''}</h5>
                                                <p>
                                                    {plan.plan === 'free' && `Includes ${plan.limits.projects} projects and ${plan.limits.aiPerDay} AI prompts a day.`}
                                                    {plan.plan !== 'free' && plan.status === 'trialing' && plan.trialEndsAt && `Your trial ends ${new Date(plan.trialEndsAt).toLocaleDateString()}, then it renews${plan.interval === 'year' ? ' yearly' : ' monthly'}.`}
                                                    {plan.plan !== 'free' && plan.status !== 'trialing' && plan.cancelAtPeriodEnd && plan.renewsAt && `Ends on ${new Date(plan.renewsAt).toLocaleDateString()}. You will move to Free after that.`}
                                                    {plan.plan !== 'free' && plan.status !== 'trialing' && !plan.cancelAtPeriodEnd && plan.renewsAt && `Renews on ${new Date(plan.renewsAt).toLocaleDateString()}.`}
                                                </p>
                                                {plan.plan !== 'free' && plan.cancelAtPeriodEnd && <div className="g-cap">cancellation scheduled</div>}
                                            </div>
                                        </li>
                                        <li>
                                            <span>02</span>
                                            <div>
                                                <h5>Projects</h5>
                                                <p>{plan.usage.projects}{plan.limits.projects != null ? ` of ${plan.limits.projects}` : ''} used{plan.limits.projects == null ? ' · unlimited' : ''}</p>
                                                {plan.limits.projects != null && <div className="up-meter"><i style={{ width: `${Math.min(100, (plan.usage.projects / plan.limits.projects) * 100)}%` }} /></div>}
                                            </div>
                                        </li>
                                        <li>
                                            <span>03</span>
                                            <div>
                                                <h5>AI prompts today</h5>
                                                <p>{plan.usage.aiToday}{plan.limits.aiPerDay != null ? ` of ${plan.limits.aiPerDay}` : ''} used{plan.limits.aiPerDay == null ? ' · unlimited' : ''}</p>
                                                {plan.limits.aiPerDay != null && <div className="up-meter"><i style={{ width: `${Math.min(100, (plan.usage.aiToday / plan.limits.aiPerDay) * 100)}%` }} /></div>}
                                            </div>
                                        </li>
                                    </ul>
                                    <div className="g-actions">
                                        {plan.plan === 'free'
                                            ? <button className="u-btn u-btn--solid" onClick={() => navigate('/pricing')}>See Team plans</button>
                                            : <button className="u-btn u-btn--solid" onClick={manageBilling} disabled={busyBilling}>Manage billing</button>}
                                        {plan.hasCustomer && plan.plan === 'free' && <button className="u-btn u-btn--ghost" onClick={manageBilling} disabled={busyBilling}>Invoices and payment methods</button>}
                                    </div>
                                    {!plan.billingEnabled && <p className="u-label" style={{ marginTop: 12 }}>Online billing is not enabled on this server.</p>}
                                </>
                            )}
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
                            {push.supported && (
                                <ul className="g-rules">
                                    <li>
                                        <span>{pad2(NOTIFS.length + 1)}</span>
                                        <div>
                                            <h5>Push notifications</h5>
                                            <p>Invites and mentions on this device, even when the tab is closed.</p>
                                            <div className="g-cap">{push.enabled ? 'on' : 'off'}{push.enabled && <> · <button type="button" className="u-link" onClick={testPush}>send a test</button></>}</div>
                                        </div>
                                        <button className="u-switch" role="switch" aria-checked={!!push.enabled} aria-label="Push notifications" onClick={togglePush} />
                                    </li>
                                </ul>
                            )}
                        </div>
                    )}

                    {active === 'connections' && (
                        <div className="u-card u-enter">
                            <div className="g-panel-head"><strong>Accounts</strong><span className="u-label">{github.status?.connected ? 'Connected' : 'Not connected'}</span></div>
                            <ul className="g-rules">
                                <li>
                                    <span><GitHubIcon size={16} filled={!!github.status?.connected} /></span>
                                    <div>
                                        <h5>GitHub{github.status?.connected ? ` · @${github.status.login}` : ''}</h5>
                                        <p>
                                            {!github.status && (github.error || 'Checking…')}
                                            {github.status && !github.status.configured && 'GitHub is not set up on this server yet.'}
                                            {github.status?.configured && !github.status.connected && 'Push rooms and projects to repositories, import repositories, keep projects in sync and share gists.'}
                                            {github.status?.connected && 'Used for push, import, sync and gists from rooms and projects. Your token stays on the CoLabs server.'}
                                        </p>
                                        {github.status?.connected && <div className="g-cap">scopes: {github.status.scopes || 'none'}</div>}
                                    </div>
                                    {github.status?.configured && (github.status.connected
                                        ? <button className="u-btn u-btn--ghost u-btn--sm" onClick={disconnectGithub} disabled={githubBusy}>Disconnect</button>
                                        : <button className="u-btn u-btn--solid u-btn--sm" onClick={connectGithub} disabled={githubBusy}>Connect</button>)}
                                </li>
                            </ul>
                        </div>
                    )}

                    {active === 'security' && (
                        <>
                            <DeviceList user={user} onSignOutHere={signOutHere} />

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
