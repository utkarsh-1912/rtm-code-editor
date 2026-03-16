import React from 'react';

const LogoLoader = ({ size = 60, message = "Loading..." }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px'
        }}>
            <div style={{
                position: 'relative',
                width: size,
                height: size,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {/* Pulsing ring */}
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: '2px solid var(--primary)',
                    borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
                    animation: 'morph 3s linear infinite'
                }} />

                {/* Secondary ring */}
                <div style={{
                    position: 'absolute',
                    width: '120%',
                    height: '120%',
                    border: '1px solid var(--primary)',
                    opacity: 0.3,
                    borderRadius: '50% 50% 20% 80% / 25% 80% 20% 75%',
                    animation: 'morph 4s linear infinite reverse'
                }} />

                <img
                    src="/utkristi-labs.png"
                    alt="Logo"
                    style={{
                        width: size * 0.6,
                        height: size * 0.6,
                        objectFit: 'contain',
                        zIndex: 2,
                        animation: 'pulse 2s ease-in-out infinite'
                    }}
                />
            </div>

            <p style={{
                margin: 0,
                fontSize: '12px',
                fontWeight: '700',
                color: 'var(--text-muted)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                animation: 'blink 1.5s infinite'
            }}>
                {message}
            </p>

            <style>{`
                @keyframes morph {
                    0% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; transform: rotate(0deg); }
                    25% { border-radius: 58% 42% 75% 25% / 76% 46% 54% 24%; }
                    50% { border-radius: 50% 50% 33% 67% / 55% 27% 73% 45%; }
                    75% { border-radius: 33% 67% 58% 42% / 63% 68% 32% 37%; }
                    100% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px var(--primary)); }
                    50% { transform: scale(1.1); filter: drop-shadow(0 0 10px var(--primary)); }
                }
                @keyframes blink {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default LogoLoader;
