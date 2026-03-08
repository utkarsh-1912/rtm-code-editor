import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Bell, Shield, Palette, Save, Check, Moon, Sun, Monitor } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../utils/api';
import toast from 'react-hot-toast';

const Settings = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [saving, setSaving] = useState(false);

    // Profile State
    const [profile, setProfile] = useState({
        name: user?.name || '',
        bio: '',
        socials: { twitter: '', github: '' }
    });

    // Theme State
    const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'dark');

    const sections = [
        { id: 'profile', title: 'Personal Information', icon: <User size={20} /> },
        { id: 'appearance', title: 'Appearance & Theme', icon: <Palette size={20} /> },
        { id: 'notifications', title: 'Notification Center', icon: <Bell size={20} /> },
        { id: 'security', title: 'Security & Privacy', icon: <Shield size={20} /> }
    ];

    useEffect(() => {
        // Fetch existing profile data if needed
        const fetchProfile = async () => {
            if (!user?.uid) return;
            try {
                const res = await fetch(`${getBackendUrl()}/api/user-dashboard?userId=${user.uid}`);
                const data = await res.json();
                if (data.user) {
                    setProfile({
                        name: data.user.name || user.name || '',
                        bio: data.user.bio || '',
                        socials: data.user.social_links || { twitter: '', github: '' }
                    });
                }
            } catch (err) {
                console.error("Failed to fetch profile:", err);
            }
        };
        fetchProfile();
    }, [user]);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/user/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    profileData: {
                        name: profile.name,
                        bio: profile.bio,
                        social_links: profile.socials
                    }
                })
            });

            if (res.ok) {
                toast.success("Profile updated successfully");
            } else {
                toast.error("Failed to update profile");
            }
        } catch (err) {
            toast.error("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('app-theme', newTheme);
        if (newTheme === 'light') {
            document.documentElement.classList.add('light-theme');
        } else {
            document.documentElement.classList.remove('light-theme');
        }
        toast.success(`Theme set to ${newTheme}`);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
                return (
                    <form onSubmit={handleSaveProfile}>
                        <div style={sectionHeaderStyle}>
                            <h2 style={sectionTitleStyle}>Personal Information</h2>
                            <p style={sectionSubtitleStyle}>Manage your public identity across the platform.</p>
                        </div>

                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Display Name</label>
                            <input
                                style={inputStyle}
                                value={profile.name}
                                onChange={e => setProfile({ ...profile, name: e.target.value })}
                                placeholder="e.g. Utkarsh"
                            />
                        </div>

                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Bio</label>
                            <textarea
                                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                                value={profile.bio}
                                onChange={e => setProfile({ ...profile, bio: e.target.value })}
                                placeholder="Tell us about yourself..."
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div style={formGroupStyle}>
                                <label style={labelStyle}>GitHub Username</label>
                                <input
                                    style={inputStyle}
                                    value={profile.socials.github}
                                    onChange={e => setProfile({ ...profile, socials: { ...profile.socials, github: e.target.value } })}
                                    placeholder="github_handle"
                                />
                            </div>
                            <div style={formGroupStyle}>
                                <label style={labelStyle}>Twitter Handle</label>
                                <input
                                    style={inputStyle}
                                    value={profile.socials.twitter}
                                    onChange={e => setProfile({ ...profile, socials: { ...profile.socials, twitter: e.target.value } })}
                                    placeholder="@handle"
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={saving} style={saveButtonStyle}>
                            {saving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
                        </button>
                    </form>
                );
            case 'appearance':
                return (
                    <div>
                        <div style={sectionHeaderStyle}>
                            <h2 style={sectionTitleStyle}>Appearance & Theme</h2>
                            <p style={sectionSubtitleStyle}>Customize the visual feel of your workspace.</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            {[
                                { id: 'dark', label: 'Dark Mode', icon: <Moon size={20} /> },
                                { id: 'light', label: 'Light Mode', icon: <Sun size={20} /> },
                                { id: 'system', label: 'System Default', icon: <Monitor size={20} /> }
                            ].map(opt => (
                                <div
                                    key={opt.id}
                                    onClick={() => handleThemeChange(opt.id)}
                                    style={{
                                        ...themeOptionStyle,
                                        border: theme === opt.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        backgroundColor: theme === opt.id ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-dark)'
                                    }}
                                >
                                    <div style={{ color: theme === opt.id ? 'var(--primary)' : 'var(--text-muted)' }}>
                                        {opt.icon}
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: '600', marginTop: '8px' }}>{opt.label}</span>
                                    {theme === opt.id && <Check size={14} style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--primary)' }} />}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'notifications':
                return (
                    <div>
                        <div style={sectionHeaderStyle}>
                            <h2 style={sectionTitleStyle}>Notification Center</h2>
                            <p style={sectionSubtitleStyle}>Control how you receive alerts and updates.</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <ToggleItem label="Join/Leave Alerts" description="Notify when someone joins or leaves your room" enabled={true} />
                            <ToggleItem label="Chat Messages" description="Receive pings for new messages in the chat" enabled={true} />
                            <ToggleItem label="System Updates" description="Stay informed about new features and maintenance" enabled={false} />
                        </div>
                    </div>
                );
            case 'security':
                return (
                    <div>
                        <div style={sectionHeaderStyle}>
                            <h2 style={sectionTitleStyle}>Security & Privacy</h2>
                            <p style={sectionSubtitleStyle}>Protect your account and workspace data.</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={dangerZoneItemStyle}>
                                <div>
                                    <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600' }}>Active Sessions</h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Sign out from all other devices and browser sessions.</p>
                                </div>
                                <button style={ghostButtonStyle} onClick={() => toast("Feature coming soon")}>Sign out others</button>
                            </div>

                            <div style={{ ...dangerZoneItemStyle, border: '1px solid rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: '#ef4444' }}>Delete Account</h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Permanently remove your account and all associated workspaces.</p>
                                </div>
                                <button style={{ ...ghostButtonStyle, color: '#ef4444' }} onClick={() => toast("Critical action: Please contact support")}>Delete</button>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <AppLayout>
            <div className="settings-page">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                    <div style={headerIconWrapperStyle}>
                        <SettingsIcon size={20} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: 'var(--text-main)' }}>Account Settings</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Configure your personal preferences and security.</p>
                    </div>
                </div>

                <div className="settings-grid" style={gridStyle}>
                    <div className="settings-nav" style={sidebarNavStyle}>
                        {sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveTab(section.id)}
                                style={{
                                    ...sidebarButtonStyle,
                                    backgroundColor: activeTab === section.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                    color: activeTab === section.id ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: activeTab === section.id ? '600' : '500'
                                }}
                            >
                                {React.cloneElement(section.icon, { size: 18 })}
                                {section.title}
                            </button>
                        ))}
                    </div>

                    <div className="settings-content" style={contentAreaStyle}>
                        {renderContent()}
                    </div>
                </div>
            </div>

            <style>{`
                @media (max-width: 992px) {
                    .settings-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
                    .settings-nav { 
                        flex-direction: row !important; 
                        overflow-x: auto; 
                        padding: 8px !important;
                        white-space: nowrap;
                    }
                    .settings-nav button { flex: 0 0 auto; }
                    .settings-content { padding: 24px !important; }
                }
            `}</style>
        </AppLayout>
    );
};

const ToggleItem = ({ label, description, enabled }) => {
    const [isOn, setIsOn] = useState(enabled);
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <h4 style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: '600' }}>{label}</h4>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{description}</p>
            </div>
            <div
                onClick={() => setIsOn(!isOn)}
                style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '20px',
                    backgroundColor: isOn ? 'var(--primary)' : 'var(--border-color)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                }}
            >
                <div style={{
                    width: '14px',
                    height: '14px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '3px',
                    left: isOn ? '19px' : '3px',
                    transition: 'left 0.2s'
                }}></div>
            </div>
        </div>
    );
};

// Styles
const gridStyle = { display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', alignItems: 'start' };
const sidebarNavStyle = { display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' };
const sidebarButtonStyle = { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', border: 'none', borderRadius: '6px', fontSize: '14px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s' };
const contentAreaStyle = { backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: '12px', border: '1px solid var(--border-color)', minHeight: '500px' };
const headerIconWrapperStyle = { width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', border: '1px solid var(--border-color)' };
const sectionHeaderStyle = { marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' };
const sectionTitleStyle = { fontSize: '18px', fontWeight: '700', margin: '0 0 8px' };
const sectionSubtitleStyle = { color: 'var(--text-muted)', fontSize: '14px', margin: 0 };
const formGroupStyle = { marginBottom: '24px' };
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '12px 16px', backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' };
const saveButtonStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'opacity 0.2s' };
const themeOptionStyle = { padding: '24px 16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', position: 'relative', transition: 'all 0.2s' };
const dangerZoneItemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-dark)' };
const ghostButtonStyle = { padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' };

export default Settings;
