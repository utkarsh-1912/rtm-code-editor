import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Mail, Trash2, Users, ArrowUpRight, Crown, Shield } from 'lucide-react';
import { Modal, timeAgo } from './ux/primitives';
import { getBackendUrl } from '../utils/api';
import toast from 'react-hot-toast';

const initials = (s) => String(s || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const canManage = (role) => role === 'owner' || role === 'admin';
const ROLE_ICON = { owner: Crown, admin: Shield };

// Teams: shared snippet vaults. Inline (a tab on the Snippets page) or as a modal.
const OrganizationSettings = ({ isOpen = true, inline = false, onClose, onChanged, onOpenVault, userId, userName, userEmail }) => {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [activeId, setActiveId] = useState(null);
    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('member');
    const [inviting, setInviting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const activeOrg = organizations.find((o) => o.id === activeId) || null;

    const fetchOrganizations = useCallback(async () => {
        if (!userId) { setLoading(false); return; }
        try {
            const response = await fetch(`${getBackendUrl()}/api/organizations?userId=${encodeURIComponent(userId)}`);
            const data = await response.json();
            const list = Array.isArray(data) ? data : [];
            setOrganizations(list);
            setActiveId((cur) => (list.some((o) => o.id === cur) ? cur : list[0]?.id ?? null));
        } catch (err) {
            toast.error('Could not load your teams');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { if (isOpen) fetchOrganizations(); }, [isOpen, fetchOrganizations]);

    const fetchMembers = useCallback(async (orgId) => {
        if (!orgId) { setMembers([]); return; }
        setMembersLoading(true);
        try {
            const response = await fetch(`${getBackendUrl()}/api/organizations/${orgId}/members`);
            const data = await response.json();
            setMembers(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error('Could not load members');
        } finally {
            setMembersLoading(false);
        }
    }, []);

    useEffect(() => { fetchMembers(activeId); setShowDeleteConfirm(false); }, [activeId, fetchMembers]);

    const handleCreateOrg = async (e) => {
        e.preventDefault();
        const name = newOrgName.trim();
        if (!name) return;
        try {
            const response = await fetch(`${getBackendUrl()}/api/organizations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, name }),
            });
            const created = await response.json().catch(() => null);
            if (!response.ok) throw new Error(created?.error || 'create failed');
            toast.success(`Team ${name} created`);
            setNewOrgName('');
            setShowCreate(false);
            await fetchOrganizations();
            if (created?.id) setActiveId(created.id);
            onChanged?.();
        } catch (err) {
            toast.error('Could not create the team');
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !activeOrg) return;
        setInviting(true);
        try {
            const response = await fetch(`${getBackendUrl()}/api/organizations/${activeOrg.id}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, orgName: activeOrg.name, inviterName: userName || 'A teammate' }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok && !data.success) {
                throw new Error(/not found/i.test(data.error || '') ? 'No CoLabs account uses that email yet. Ask them to sign up first.' : data.error || 'Invite failed');
            }
            toast.success(data.pendingSignup ? 'Invite sent. They need to sign up first.' : 'Added to the team');
            setInviteEmail('');
            fetchMembers(activeOrg.id);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setInviting(false);
        }
    };

    const handleDeleteOrg = async () => {
        if (!activeOrg) return;
        try {
            const response = await fetch(`${getBackendUrl()}/api/organizations/${activeOrg.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('delete failed');
            toast.success(`Deleted ${activeOrg.name}`);
            setShowDeleteConfirm(false);
            setActiveId(null);
            await fetchOrganizations();
            onChanged?.();
        } catch (err) {
            toast.error('Could not delete the team');
        }
    };

    if (!isOpen) return null;

    const me = (m) => (userEmail && m.email === userEmail) || (!userEmail && userName && m.name === userName);

    const body = (
        <div className={`tm${inline ? ' tm--inline' : ''}`}>
            <aside className="tm-side" aria-label="Your teams">
                <div className="tm-side-head">
                    <span className="u-label">Your teams · {organizations.length}</span>
                    <button type="button" className={`u-icon${showCreate ? ' on' : ''}`} onClick={() => setShowCreate(true)} aria-label="New team" title="New team"><Plus size={16} /></button>
                </div>
                {loading ? (
                    [0, 1].map((i) => <div key={i} className="u-skel" style={{ height: 52 }} />)
                ) : organizations.length === 0 ? (
                    <p className="u-small u-muted" style={{ margin: '4px 2px' }}>No teams yet.</p>
                ) : (
                    <ul className="tm-list">
                        {organizations.map((org) => (
                            <li key={org.id}>
                                <button
                                    type="button"
                                    className={activeId === org.id && !showCreate ? 'on' : ''}
                                    onClick={() => { setShowCreate(false); setActiveId(org.id); }}
                                >
                                    <span className="tm-av">{initials(org.name)}</span>
                                    <span className="tm-list-text">
                                        <b className="u-ellipsis">{org.name}</b>
                                        <span>{org.role || 'member'}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </aside>

            <section className="tm-main">
                {showCreate ? (
                    <form onSubmit={handleCreateOrg} className="tm-create">
                        <h3>New team</h3>
                        <p className="u-muted">A team gets its own snippet vault. Everyone in it can read and add snippets.</p>
                        <div className="u-field">
                            <label htmlFor="org-name">Team name</label>
                            <input id="org-name" className="u-input" autoFocus placeholder="e.g. Platform team" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} maxLength={80} />
                        </div>
                        <div className="tm-row-actions">
                            <button type="button" className="u-btn u-btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                            <button type="submit" className="u-btn u-btn--solid" disabled={!newOrgName.trim()}>Create team</button>
                        </div>
                    </form>
                ) : activeOrg ? (
                    <>
                        <header className="tm-head">
                            <span className="tm-av tm-av--lg">{initials(activeOrg.name)}</span>
                            <div className="tm-head-text">
                                <h3 className="u-ellipsis">{activeOrg.name}</h3>
                                <span className="u-muted">You are {activeOrg.role === 'owner' ? 'the owner' : `a ${activeOrg.role || 'member'}`} · {members.length} {members.length === 1 ? 'member' : 'members'}</span>
                            </div>
                            {onOpenVault && (
                                <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => onOpenVault(activeOrg.id)}>
                                    Open vault <ArrowUpRight size={14} />
                                </button>
                            )}
                        </header>

                        {canManage(activeOrg.role) && (
                            <form className="tm-invite" onSubmit={handleInvite}>
                                <label className="tm-invite-field">
                                    <Mail size={15} />
                                    <input type="email" placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} aria-label="Invite by email" />
                                </label>
                                <select className="u-select tm-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} aria-label="Role">
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <button type="submit" className="u-btn u-btn--solid" disabled={!inviteEmail.trim() || inviting}>{inviting ? 'Inviting…' : 'Invite'}</button>
                            </form>
                        )}

                        <div className="tm-members">
                            <span className="u-label">Members</span>
                            {membersLoading && !members.length ? (
                                [0, 1, 2].map((i) => <div key={i} className="u-skel" style={{ height: 48 }} />)
                            ) : (
                                <ul>
                                    {members.map((m) => {
                                        const RoleIcon = ROLE_ICON[m.role];
                                        return (
                                            <li key={m.id || m.email}>
                                                <span className="tm-av tm-av--sm">{initials(m.name || m.email)}</span>
                                                <span className="tm-member">
                                                    <b className="u-ellipsis">{m.name || m.email}{me(m) && <em className="tm-you">you</em>}</b>
                                                    <span className="u-mono u-ellipsis">{m.email}</span>
                                                </span>
                                                {m.joined_at && <span className="tm-when u-mono">joined {timeAgo(m.joined_at)}</span>}
                                                <span className={`tm-role-chip tm-role-chip--${m.role || 'member'}`}>{RoleIcon && <RoleIcon size={11} />}{m.role || 'member'}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {canManage(activeOrg.role) && (
                            <div className="tm-danger">
                                {!showDeleteConfirm ? (
                                    <button type="button" className="u-btn u-btn--ghost u-btn--sm tm-del" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={14} /> Delete team</button>
                                ) : (
                                    <div className="tm-row-actions">
                                        <span className="u-small" style={{ color: 'var(--u-bad)' }}>Delete “{activeOrg.name}” and its vault for everyone?</span>
                                        <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                                        <button type="button" className="u-btn u-btn--danger u-btn--sm" onClick={handleDeleteOrg}>Delete</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="u-empty tm-empty">
                        <span className="tm-empty-ico"><Users size={22} /></span>
                        <b>No team yet</b>
                        <p>Create a team to share a snippet vault with the people you work with.</p>
                        <button type="button" className="u-btn u-btn--solid" onClick={() => setShowCreate(true)}><Plus size={15} /> New team</button>
                    </div>
                )}
            </section>
        </div>
    );

    if (inline) return body;
    return (
        <Modal open onClose={onClose} wide label="Teams" title="Team vaults" description="Share snippets with the people you work with.">
            {body}
        </Modal>
    );
};

export default OrganizationSettings;
