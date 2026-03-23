import React, { useState, useEffect } from 'react';
import { X, Plus, Users, Shield, Mail } from 'lucide-react';
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
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={e => e.stopPropagation()}>
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Users size={24} color="var(--primary)" />
                        <div>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>Team Vaults</h2>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Collaborate on snippets with your team</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={closeButtonStyle}><X size={20} /></button>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar: Org List */}
                    <div style={sidebarStyle}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>YOUR TEAMS</span>
                            <button onClick={() => setShowCreate(true)} style={plusButtonStyle}><Plus size={14} /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                            {organizations.map(org => (
                                <div
                                    key={org.id}
                                    onClick={() => handleSelectOrg(org)}
                                    style={orgItemStyle(activeOrg?.id === org.id)}
                                >
                                    <Shield size={14} style={{ opacity: 0.6 }} />
                                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{org.name}</span>
                                </div>
                            ))}
                            {organizations.length === 0 && !loading && (
                                <p style={{ padding: '20px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No teams yet</p>
                            )}
                        </div>
                    </div>

                    {/* Main Content: Members & Settings */}
                    <div style={contentStyle}>
                        {showCreate ? (
                            <div style={formContainerStyle}>
                                <h3 style={{ marginTop: 0 }}>Create New Team</h3>
                                <form onSubmit={handleCreateOrg}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                        <label style={labelStyle}>TEAM NAME</label>
                                        <input
                                            value={newOrgName}
                                            onChange={e => setNewOrgName(e.target.value)}
                                            placeholder="e.g. Frontend Squad"
                                            style={inputStyle}
                                            autoFocus
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button type="button" onClick={() => setShowCreate(false)} style={secondaryButtonStyle}>Cancel</button>
                                        <button type="submit" style={primaryButtonStyle}>Create Team</button>
                                    </div>
                                </form>
                            </div>
                        ) : activeOrg ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0 }}>{activeOrg.name}</h3>
                                    <span style={roleBadgeStyle}>{activeOrg.role}</span>
                                </div>

                                <div style={memberSectionStyle}>
                                    <label style={labelStyle}>INVITE MEMBER</label>
                                    <form onSubmit={handleInvite} style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ flex: 1, position: 'relative' }}>
                                            <Mail size={14} style={inputIconStyle} />
                                            <input
                                                type="email"
                                                value={inviteEmail}
                                                onChange={e => setInviteEmail(e.target.value)}
                                                placeholder="colleague@example.com"
                                                style={{ ...inputStyle, paddingLeft: '36px' }}
                                            />
                                        </div>
                                        <button type="submit" style={inviteButtonStyle}>Add</button>
                                    </form>
                                </div>

                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>TEAM MEMBERS ({members.length})</label>
                                    <div style={memberListStyle}>
                                        {members.map(member => (
                                            <div key={member.id} style={memberItemStyle}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={avatarStyle}>{member.name[0]}</div>
                                                    <div>
                                                        <div style={{ fontSize: '14px', fontWeight: '600' }}>{member.name}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{member.email}</div>
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: '11px', opacity: 0.6 }}>{member.role}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {activeOrg.role === 'admin' && (
                                    <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                                        {!showDeleteConfirm ? (
                                            <button
                                                onClick={() => setShowDeleteConfirm(true)}
                                                style={{ ...secondaryButtonStyle, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', width: '100%' }}
                                            >
                                                Delete Team
                                            </button>
                                        ) : (
                                            <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#ef4444', fontWeight: '600' }}>Confirm deletion? This cannot be undone.</p>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => setShowDeleteConfirm(false)} style={{ ...secondaryButtonStyle, flex: 1 }}>Cancel</button>
                                                    <button onClick={handleDeleteOrg} style={{ ...primaryButtonStyle, backgroundColor: '#ef4444', flex: 1 }}>Confirm Delete</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={emptyContentStyle}>
                                <Users size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                                <p>Select a team to manage members</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
};

const modalStyle = {
    backgroundColor: 'var(--bg-card)', width: '90%', maxWidth: '800px', height: '80vh',
    borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden'
};

const headerStyle = {
    padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
};

const sidebarStyle = {
    width: '240px', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-dark)', display: 'flex', flexDirection: 'column'
};

const contentStyle = { flex: 1, backgroundColor: 'var(--bg-card)', overflowY: 'auto' };

const closeButtonStyle = { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' };

const plusButtonStyle = {
    padding: '4px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--primary)', cursor: 'pointer'
};

const orgItemStyle = (active) => ({
    padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
    backgroundColor: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: active ? 'var(--primary)' : 'var(--text-main)',
    marginBottom: '4px', transition: 'all 0.2s'
});

const inputStyle = {
    width: '100%', padding: '12px 14px', backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border-color)',
    borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none'
};

const primaryButtonStyle = {
    padding: '10px 20px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer'
};

const secondaryButtonStyle = {
    padding: '10px 20px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: '600', cursor: 'pointer'
};

const labelStyle = { fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' };

const roleBadgeStyle = {
    fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', padding: '4px 8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', borderRadius: '6px'
};

const inputIconStyle = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 };

const inviteButtonStyle = { padding: '0 20px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' };

const memberListStyle = { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' };

const memberItemStyle = {
    padding: '12px', backgroundColor: 'var(--bg-dark)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
};

const avatarStyle = { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '14px' };

const emptyContentStyle = { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' };

const formContainerStyle = { padding: '40px', maxWidth: '400px', margin: '0 auto' };

const memberSectionStyle = { padding: '16px', backgroundColor: 'var(--bg-dark)', borderRadius: '16px', border: '1px solid var(--border-color)' };

export default OrganizationSettings;
