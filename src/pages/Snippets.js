import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Code, Database } from 'lucide-react';

const Snippets = () => {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-dark)', color: 'var(--text-main)', padding: '40px' }}>
            <button
                onClick={() => navigate('/dashboard')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginBottom: '32px', fontWeight: '600' }}
            >
                <ChevronLeft size={20} /> Back to Dashboard
            </button>
            <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                <Database size={64} style={{ color: 'var(--text-muted)', marginBottom: '24px' }} />
                <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '16px' }}>My Snippets</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '18px', lineHeight: '1.6' }}>
                    Save and manage your most used code blocks here. This feature is coming soon to your workspace.
                </p>
                <div style={{ marginTop: '40px', padding: '40px', border: '2px dashed var(--border-color)', borderRadius: '20px' }}>
                    <Code size={32} style={{ color: 'var(--border-color)', marginBottom: '16px' }} />
                    <p style={{ color: 'var(--border-color)' }}>No snippets saved yet.</p>
                </div>
            </div>
        </div>
    );
};

export default Snippets;
