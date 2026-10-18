import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Monitor, Laptop, Smartphone, Tablet, LogOut, Pencil, Check, X, AppWindow } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBackendUrl } from '../utils/api';
import { deviceKey } from '../utils/deviceSession';
import { timeAgo } from './ux/primitives';

const deviceIcon = (device) => {
    const d = (device || '').toLowerCase();
    if (d.startsWith('desktop app')) return <AppWindow size={17} />;
    if (d.includes('iphone') || d.includes('android')) return <Smartphone size={17} />;
    if (d.includes('ipad') || d.includes('tablet')) return <Tablet size={17} />;
    if (d.includes('mac')) return <Laptop size={17} />;
    return <Monitor size={17} />;
};

// Settings > Security: devices signed in to the account. Rename any of them, sign out one,
// or sign out all the others. A signed-out device notices on its next check-in.
export default function DeviceList({ user, onSignOutHere }) {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null); // device id
    const [draft, setDraft] = useState('');
    const [confirming, setConfirming] = useState(null); // device id, or 'others'
    const [busy, setBusy] = useState(null);
    const inputRef = useRef(null);
    const uid = user?.uid;

    const load = useCallback(async () => {
        if (!uid) return;
        setLoading(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/sessions?userId=${encodeURIComponent(uid)}&sessionKey=${encodeURIComponent(deviceKey())}`);
            const data = await res.json();
            setDevices(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Could not load your devices');
        } finally {
            setLoading(false);
        }
    }, [uid]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (editing != null) inputRef.current?.select(); }, [editing]);

    const startRename = (d) => {
        setConfirming(null);
        setEditing(d.id);
        setDraft(d.name || d.device || '');
    };

    const saveRename = async (d) => {
        const name = draft.trim();
        setEditing(null);
        if (name === (d.name || d.device || '')) return;
        const prev = devices;
        setDevices((list) => list.map((x) => (x.id === d.id ? { ...x, name: name || null } : x)));
        try {
            const res = await fetch(`${getBackendUrl()}/api/sessions/${d.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid, name }),
            });
            if (!res.ok) throw new Error();
            toast.success(name ? 'Device renamed' : 'Name reset');
        } catch {
            setDevices(prev);
            toast.error('Rename failed');
        }
    };

    const remove = async (d) => {
        setBusy(d.id);
        try {
            if (d.current) {
                // Removing this device is signing out here.
                await onSignOutHere?.();
                return;
            }
            const res = await fetch(`${getBackendUrl()}/api/sessions/${d.id}?userId=${encodeURIComponent(uid)}`, { method: 'DELETE' });
            if (!res.ok && res.status !== 404) throw new Error();
            setDevices((list) => list.filter((x) => x.id !== d.id));
            toast.success(`Signed out ${d.name || d.device || 'device'}`);
        } catch {
            toast.error('Could not sign that device out');
        } finally {
            setBusy(null);
            setConfirming(null);
        }
    };

    const signOutOthers = async () => {
        setBusy('others');
        try {
            const res = await fetch(`${getBackendUrl()}/api/sessions/others`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid, currentSessionId: deviceKey() }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error);
            setDevices((list) => list.filter((x) => x.current));
            toast.success(data.count ? `Signed out ${data.count} other device${data.count === 1 ? '' : 's'}` : 'No other devices');
        } catch {
            toast.error('Could not sign out other devices');
        } finally {
            setBusy(null);
            setConfirming(null);
        }
    };

    const others = devices.filter((d) => !d.current).length;

    return (
        <div className="u-card u-enter">
            <div className="g-panel-head">
                <div>
                    <strong>Devices</strong>
                    <div className="u-small u-muted">Signed in to your account. Rename one to tell them apart.</div>
                </div>
                {confirming === 'others' ? (
                    <span className="dv-confirm">
                        <span className="u-small">Sign out {others}?</span>
                        <button className="u-btn u-btn--sm dv-danger" onClick={signOutOthers} disabled={busy === 'others'}>{busy === 'others' ? 'Signing out…' : 'Sign out'}</button>
                        <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => setConfirming(null)}>Cancel</button>
                    </span>
                ) : (
                    <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => { setEditing(null); setConfirming('others'); }} disabled={others === 0}><LogOut size={14} /> Sign out others</button>
                )}
            </div>

            {loading && devices.length === 0 ? (
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[0, 1].map((i) => <div key={i} className="u-skel" style={{ height: 44 }} />)}
                </div>
            ) : devices.length === 0 ? (
                <p className="u-muted u-small" style={{ padding: 18, margin: 0 }}>No devices yet. This one appears after its first check-in.</p>
            ) : (
                <ul className="dv-list">
                    {devices.map((d) => {
                        const label = d.name || d.device || 'Unknown device';
                        const isEditing = editing === d.id;
                        return (
                            <li key={d.id} className={`dv-row${d.current ? ' is-current' : ''}`}>
                                <span className="d-ico">{deviceIcon(d.device)}</span>
                                <div className="dv-main">
                                    {isEditing ? (
                                        <form className="dv-edit" onSubmit={(e) => { e.preventDefault(); saveRename(d); }}>
                                            <input
                                                ref={inputRef}
                                                className="u-input"
                                                value={draft}
                                                maxLength={80}
                                                onChange={(e) => setDraft(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                                                aria-label="Device name"
                                                placeholder={d.device || 'Device name'}
                                            />
                                            <button type="submit" className="u-icon" aria-label="Save name"><Check size={16} /></button>
                                            <button type="button" className="u-icon" onClick={() => setEditing(null)} aria-label="Cancel rename"><X size={16} /></button>
                                        </form>
                                    ) : (
                                        <div className="dv-name">
                                            <span className="u-ellipsis" title={label}>{label}</span>
                                            {d.current && <span className="u-chip u-chip--mono u-chip--accent">This device</span>}
                                        </div>
                                    )}
                                    <div className="u-mono u-faint dv-meta">
                                        {d.name && d.device ? `${d.device} · ` : ''}{d.ip || 'IP unknown'} · {d.current ? 'active now' : d.last_active ? `active ${timeAgo(d.last_active)}` : '—'}
                                    </div>
                                </div>
                                {!isEditing && (
                                    confirming === d.id ? (
                                        <span className="dv-confirm">
                                            <button className="u-btn u-btn--sm dv-danger" onClick={() => remove(d)} disabled={busy === d.id}>{busy === d.id ? '…' : d.current ? 'Sign out here' : 'Sign out'}</button>
                                            <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => setConfirming(null)}>Cancel</button>
                                        </span>
                                    ) : (
                                        <span className="dv-actions">
                                            <button className="u-icon" onClick={() => startRename(d)} aria-label={`Rename ${label}`} title="Rename"><Pencil size={15} /></button>
                                            <button className="u-icon" onClick={() => { setEditing(null); setConfirming(d.id); }} aria-label={`Sign out ${label}`} title={d.current ? 'Sign out of this device' : 'Sign out this device'}><LogOut size={15} /></button>
                                        </span>
                                    )
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
