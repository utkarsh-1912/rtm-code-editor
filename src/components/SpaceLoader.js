import React from 'react';
import { Loader2 } from 'lucide-react';

const SpaceLoader = () => {
    return (
        <div style={{
            height: '100vh',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-dark)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Orbs */}
            <div style={{
                position: 'absolute',
                width: '300px',
                height: '300px',
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1), transparent)',
                filter: 'blur(60px)',
                top: '20%',
                left: '30%',
                animation: 'float 10s infinite alternate'
            }}></div>
            <div style={{
                position: 'absolute',
                width: '250px',
                height: '250px',
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08), transparent)',
                filter: 'blur(50px)',
                bottom: '20%',
                right: '30%',
                animation: 'float 12s infinite alternate-reverse'
            }}></div>

            <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
                <div style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '24px'
                }}>
                    <Loader2 size={48} className="spin-animation" color="var(--primary)" />
                </div>

                <h3 style={{
                    fontSize: '1.5rem',
                    fontWeight: '800',
                    color: 'var(--text-main)',
                    margin: 0,
                    letterSpacing: '-0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    Loading <span style={{
                        background: 'linear-gradient(to right, var(--primary), #60a5fa)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>your space...</span>
                </h3>
                <p style={{
                    marginTop: '12px',
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)',
                    fontWeight: '500',
                    opacity: 0.8
                }}>
                    Preparing your creative workspace
                </p>

                <div style={{
                    marginTop: '32px',
                    width: '200px',
                    height: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    margin: '32px auto 0'
                }}>
                    <div className="progress-bar-animation" style={{
                        height: '100%',
                        background: 'linear-gradient(to right, #3b82f6, #60a5fa)',
                        borderRadius: '10px',
                        boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                    }}></div>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin-animation {
                    animation: spin 2s linear infinite;
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0) scale(1); opacity: 0.8; }
                    50% { transform: translateY(-5px) scale(1.1); opacity: 1; }
                }
                @keyframes float {
                    0% { transform: translate(0, 0); }
                    100% { transform: translate(20px, 20px); }
                }
                .progress-bar-animation {
                    animation: progress 2s infinite ease-in-out;
                }
                @keyframes progress {
                    0% { width: 0%; transform: translateX(-100%); }
                    50% { width: 100%; transform: translateX(0); }
                    100% { width: 0%; transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

export default SpaceLoader;
