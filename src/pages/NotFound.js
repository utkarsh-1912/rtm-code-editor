import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Frown } from 'lucide-react';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-dark)',
            color: 'var(--text-main)',
            textAlign: 'center',
            padding: '20px'
        }}>
            <Frown size={80} color="var(--primary)" style={{ marginBottom: '20px' }} />
            <h1 style={{ fontSize: '4rem', margin: '0' }}>404</h1>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '30px', color: 'var(--text-muted)' }}>
                The room you're looking for doesn't exist or was moved.
            </h2>
            <button
                onClick={() => navigate('/')}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 24px',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
            >
                <Home size={20} />
                Back to Home
            </button>
        </div>
    );
};

export default NotFound;
