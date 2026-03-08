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
            <div className="settings-page" style={{ padding: '0 20px', maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.6s ease-out' }}>
                <div className="settings-header" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    marginBottom: '64px',
                    padding: '20px 0',
                    borderBottom: '1px solid var(--border-color)'
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        border: '1px solid var(--border-color)'
                    }}>
                        <SettingsIcon size={28} />
                    </div>
                    <div>
                        <h1 style={{
                            fontSize: 'clamp(28px, 5vw, 36px)',
                            fontWeight: '900',
                            margin: 0,
                            letterSpacing: '-1px'
                        }}>
                            Account Settings
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px', fontWeight: '500', marginTop: '4px' }}>
                            Configure your workspace and global preferences.
                        </p>
                    </div>
                </div>

                <div className="settings-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(280px, 1fr) 3fr',
                    gap: '48px',
                    alignItems: 'start'
                }}>
                    <div className="settings-nav" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {sections.map(section => (
                            <button
                                key={section.id}
                                className={section.active ? 'glass-effect' : ''}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    padding: '18px 24px',
                                    backgroundColor: section.active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                    border: `1px solid ${section.active ? 'var(--primary)' : 'transparent'}`,
                                    borderRadius: '18px',
                                    color: section.active ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: '700',
                                    fontSize: '15px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                                }}
                            >
                                <div style={{ color: section.active ? 'var(--primary)' : 'var(--text-muted)' }}>
                                    {section.icon}
                                </div>
                                {section.title}
                            </button>
                        ))}
                    </div>

                    <div className="settings-content glass-effect premium-card" style={{
                        padding: '48px',
                        minHeight: '600px',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ marginBottom: '48px' }}>
                            <h2 style={{ fontSize: '26px', fontWeight: '900', margin: '0 0 12px' }}>
                                Personal Information
                            </h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1.6 }}>
                                This information is used to personalize your collaborative experience and room identify.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                            <div className="glass-effect" style={{
                                padding: '40px',
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                borderRadius: '24px',
                                border: '1px dashed var(--border-color)',
                                textAlign: 'center'
                            }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    marginBottom: '20px'
                                }}>
                                    <User size={32} />
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>Profile Management Incoming</h3>
                                <p style={{ color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto', fontSize: '14px', lineHeight: 1.6 }}>
                                    We're building a comprehensive profile system. You'll be able to edit your details in the next major update.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (max-width: 992px) {
                    .settings-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
                    .settings-nav { order: 2; flex-direction: row !important; overflow-x: auto; padding-bottom: 12px; }
                    .settings-nav button { white-space: nowrap; flex-shrink: 0; }
                    .settings-content { order: 1; padding: 32px !important; }
                }
            `}</style>
        </AppLayout>
    );
};

export default Settings;
