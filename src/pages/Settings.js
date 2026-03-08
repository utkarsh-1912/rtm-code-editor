import React from 'react';
import { Settings as SettingsIcon, User, Bell, Shield, Palette } from 'lucide-react';
import AppLayout from '../components/AppLayout';

const Settings = () => {
    const sections = [
        { id: 'profile', title: 'Personal Information', icon: <User size={20} />, active: true },
        { id: 'appearance', title: 'Appearance & Theme', icon: <Palette size={20} /> },
        { id: 'notifications', title: 'Notification Center', icon: <Bell size={20} /> },
        { id: 'security', title: 'Security & Privacy', icon: <Shield size={20} /> }
    ];

    return (
        <AppLayout>
            <div className="settings-page">
                <div className="settings-header" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '32px'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        border: '1px solid var(--border-color)'
                    }}>
                        <SettingsIcon size={20} />
                    </div>
                    <div>
                        <h1 style={{
                            fontSize: '24px',
                            fontWeight: '700',
                            margin: 0,
                            color: 'var(--text-main)'
                        }}>
                            Account Settings
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                            Manage your personal preferences and workspace configuration.
                        </p>
                    </div>
                </div>

                <div className="settings-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: '260px 1fr',
                    gap: '32px',
                    alignItems: 'start'
                }}>
                    <div className="settings-nav" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        backgroundColor: 'var(--bg-card)',
                        padding: '12px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)'
                    }}>
                        {sections.map(section => (
                            <button
                                key={section.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '10px 16px',
                                    backgroundColor: section.active ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: section.active ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: section.active ? '600' : '500',
                                    fontSize: '14px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ color: section.active ? 'var(--primary)' : 'var(--text-muted)' }}>
                                    {React.cloneElement(section.icon, { size: 18 })}
                                </div>
                                {section.title}
                            </button>
                        ))}
                    </div>

                    <div className="settings-content" style={{
                        backgroundColor: 'var(--bg-card)',
                        padding: '32px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        minHeight: '500px'
                    }}>
                        <div style={{ marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 8px' }}>
                                Personal Information
                            </h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                                Your public profile and identification across collaborative rooms.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div style={{
                                padding: '32px',
                                backgroundColor: 'var(--bg-dark)',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                textAlign: 'center'
                            }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    marginBottom: '16px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <User size={24} />
                                </div>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Module Under Construction</h3>
                                <p style={{ color: 'var(--text-muted)', maxWidth: '340px', margin: '0 auto', fontSize: '13px', lineHeight: 1.6 }}>
                                    Profile editing capabilities are being refined. You'll be able to manage your details in an upcoming update.
                                </p>
                            </div>
                        </div>
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

export default Settings;
