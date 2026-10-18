import React, { useState, useEffect } from 'react';
import { Plus, Mail, Trash2 } from 'lucide-react';
import { Modal } from './ux/primitives';
import { getBackendUrl } from '../utils/api';
import toast from 'react-hot-toast';

const OrganizationSettings = ({ isOpen, onClose, userId, userName }) => {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [activeOrg, setActiveOrg] = useState(null);
    const [members, setMembers] = useState([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const fetchOrganizations = React.useCallback(async () => {
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/organizations?userId=${userId}`);
            const data = await response.json();
            setOrganizations(data);
            if (data.length > 0 && !activeOrg) {
                handleSelectOrg(data[0]);
            }
        } catch (err) {
            toast.error("Failed to load organizations");
        } finally {
            setLoading(false);
        }
    }, [userId, activeOrg]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (isOpen) fetchOrganizations();
    }, [isOpen, fetchOrganizations]);

    const handleCreateOrg = async (e) => {
        e.preventDefault();
        if (!newOrgName.trim()) return;
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/organizations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, name: newOrgName })
            });
            if (response.ok) {
                toast.success("Organization created");
                setNewOrgName('');
                setShowCreate(false);
                fetchOrganizations();
            }
        } catch (err) {
            toast.error("Failed to create organization");
        }
    };

    const handleSelectOrg = async (org) => {
        setActiveOrg(org);
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/organizations/${org.id}/members`);
            const data = await response.json();
            setMembers(data);
        } catch (err) {
            toast.error("Failed to load members");
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !activeOrg) return;
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/organizations/${activeOrg.id}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: inviteEmail, 
                    role: 'member',
                    orgName: activeOrg.name,
                    inviterName: userName || 'A Team Admin'
                })
            });
            const data = await response.json();
            
            if (response.ok || data.success) {
                if (data.pendingSignup) {
                    toast.success("Invite sent! They need to sign up first.");
                } else {
                    toast.success("Member added & notified!");
                }
                setInviteEmail('');
                handleSelectOrg(activeOrg);
            } else {
                toast.error(data.error || "Failed to invite");
            }
        } catch (err) {
            toast.error("Invite failed");
        }
    };

    const handleDeleteOrg = async () => {
        if (!activeOrg) return;
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/organizations/${activeOrg.id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                toast.success("Team deleted successfully");
                setActiveOrg(null);
                setShowDeleteConfirm(false);
                fetchOrganizations();
            } else {
                toast.error("Failed to delete team");
            }
        } catch (err) {
            toast.error("Error deleting team");
        }
    };

    if (!isOpen) return null;

    return (
        <Modal open onClose={onClose} wide label="Teams" title="Team vaults" description="Share snippets with the people you work with.">
            <div className="og-grid">
                <aside className="og-side">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="u-label">Your teams · {organizations.length || 0}</span>
                        <button type="button" className={`u-icon${showCreate ? ' on' : ''}`} onClick={() => setShowCreate(true)} aria-label="New team"><Plus size={16} /></button>
                    </div>
                    {loading ? (
                        <div className="u-skel" style={{ height: 80 }} />
                    ) : organizations.length === 0 ? (
                        <p className="u-small u-muted" style={{ margin: '8px 0' }}>No teams yet.</p>
                    ) : (
                        <div className="d-side" style={{ position: 'static', padding: 0 }}>
                            {organizations.map((org) => (
                                <button type="button" key={org.id} className={activeOrg?.id === org.id && !showCreate ? 'on' : ''} onClick={() => { setShowCreate(false); setShowDeleteConfirm(false); handleSelectOrg(org); }}>
                                    <span className="u-ellipsis">{org.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </aside>

                <section className="og-main">
                    {showCreate ? (
                        <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <h4 className="og-title">New team</h4>
                            <div className="u-field">
                                <label htmlFor="org-name">Team name</label>
                                <input id="org-name" className="u-input" autoFocus placeholder="e.g. Platform team" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" className="u-btn u-btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="u-btn u-btn--solid" disabled={!newOrgName.trim()}>Create team</button>
                            </div>
                        </form>
                    ) : activeOrg ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <h4 className="og-title">{activeOrg.name}</h4>
                            <form className="h-join" onSubmit={handleInvite}>
                                <input className="u-input" type="email" placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} aria-label="Invite by email" />
                                <button type="submit" className="u-btn u-btn--solid u-btn--lg" disabled={!inviteEmail.trim()}><Mail size={15} /> Invite</button>
                            </form>
                            <div>
                                <span className="u-label">Members · {members.length || 0}</span>
                                <div className="ws-people" style={{ padding: '8px 0 0' }}>
                                    {(Array.isArray(members) ? members : []).map((m) => (
                                        <div key={m.id || m.email} className="ws-person" style={{ padding: '8px 4px' }}>
                                            <span className="ws-person-av" style={{ background: 'var(--u-mark)' }}>{(m.name || m.email || '?').slice(0, 2).toUpperCase()}</span>
                                            <div style={{ minWidth: 0 }}>
                                                <b style={{ display: 'block' }} className="u-ellipsis">{m.name || m.email}</b>
                                                <span className="u-mono u-faint u-ellipsis" style={{ fontSize: 11, display: 'block' }}>{m.email}</span>
                                            </div>
                                            <em>{m.role}</em>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {activeOrg.role === 'admin' && (
                                <div style={{ borderTop: '1px solid var(--u-line)', paddingTop: 16 }}>
                                    {!showDeleteConfirm ? (
                                        <button type="button" className="u-btn u-btn--ghost u-btn--sm" style={{ color: 'var(--u-bad)' }} onClick={() => setShowDeleteConfirm(true)}><Trash2 size={14} /> Delete team</button>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span className="u-small" style={{ color: 'var(--u-bad)' }}>Delete “{activeOrg.name}” for everyone?</span>
                                            <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                                            <button type="button" className="u-btn u-btn--danger u-btn--sm" onClick={handleDeleteOrg}>Delete</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="u-empty" style={{ padding: '32px 0' }}>
                            <span className="u-display">No team</span>
                            <p>Create a team to share a snippet vault.</p>
                            <button type="button" className="u-btn u-btn--solid" onClick={() => setShowCreate(true)}><Plus size={15} /> New team</button>
                        </div>
                    )}
                </section>
            </div>
        </Modal>
    );
};

export default OrganizationSettings;
