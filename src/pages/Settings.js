import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings as SettingsIcon, User } from 'lucide-react';

const Settings = () => {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-dark)', color: 'var(--text-main)', padding: '40px' }}>
            <button
                onClick={() => navigate('/dashboard')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginBottom: '32px', fontWeight: '600' }}
            >
                <ChevronLeft size={20} /> Back to Dashboard
            </button>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                    <SettingsIcon size={32} style={{ color: 'var(--primary)' }} />
                    <h1 style={{ fontSize: '32px', fontWeight: '700' }}>Account Settings</h1>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <User size={20} /> Personal Information
                        </h3>
                        <p style={{ color: 'var(--text-muted)' }}>Manage your profile details and preference settings here.</p>
                        <div style={{ marginTop: '24px', padding: '20px', backgroundColor: 'var(--secondary)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Configuration options coming soon.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
