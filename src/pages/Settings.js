import React from 'react';
import { Settings as SettingsIcon, User, Bell, Shield, Palette } from 'lucide-react';
import AppLayout from '../components/AppLayout';

const Settings = () => {
    const sections = [
        { id: 'profile', title: 'Personal Information', icon: <User size={20} />, active: true },
        { id: 'notifications', title: 'Notifications', icon: <Bell size={20} /> },
        { id: 'security', title: 'Security & Privacy', icon: <Shield size={20} /> },
        { id: 'appearance', title: 'Appearance', icon: <Palette size={20} /> }
    ];

    return (
        <AppLayout>
            <div style={{ maxWidth: '1000px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                    <SettingsIcon size={32} style={{ color: 'var(--primary)' }} />
                    <h1 style={{ fontSize: '32px', fontWeight: '700' }}>Account Settings</h1>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {sections.map(section => (
                            <button
                                key={section.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '16px 20px',
                                    backgroundColor: section.active ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                                    border: `1px solid ${section.active ? 'var(--primary)' : 'var(--border-color)'}`,
                                    borderRadius: '12px',
                                    color: section.active ? 'var(--primary)' : 'var(--text-main)',
                                    fontWeight: '600',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {section.icon} {section.title}
                            </button>
                        ))}
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '40px', borderRadius: '20px', border: '1px solid var(--border-color)', flex: 1 }}>
                        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            Personal Information
                        </h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Manage your profile details and preference settings here.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coming Soon</label>
                                <div style={{ padding: '24px', backgroundColor: 'var(--bg-dark)', borderRadius: '12px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Full profile management will be available in the next update.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default Settings;
