import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Github, Mail, Code, ArrowLeft, UserCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
    const { loginWithGoogle, loginWithGitHub, user } = useAuth();
    const navigate = useNavigate();
    const [isHovered, setIsHovered] = useState(null);

    // Redirect if already logged in
    React.useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleLogin = async (provider) => {
        try {
            if (provider === 'Google') {
                await loginWithGoogle();
            } else if (provider === 'GitHub') {
                await loginWithGitHub();
            }
            toast.success(`Signed in with ${provider}!`);
        } catch (error) {
            toast.error(`Authentication failed: ${error.message}`);
        }
    };

    const containerStyle = {
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-dark)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden'
    };

    const cardStyle = {
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'var(--bg-card)',
        padding: '48px 40px',
        borderRadius: '28px',
        border: '1px solid var(--border-color)',
        backdropFilter: 'blur(16px)',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        zIndex: 10,
        animation: 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
    };

    const socialButtonStyle = (id) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        width: '100%',
        padding: '14px',
        marginBottom: '16px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        backgroundColor: isHovered === id ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
        color: 'var(--text-main)',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isHovered === id ? 'translateY(-2px)' : 'none',
        boxShadow: isHovered === id ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none'
    });

    const backButtonStyle = {
        position: 'absolute',
        top: '40px',
        left: '40px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        backgroundColor: 'transparent',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        color: 'var(--text-muted)',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s',
        zIndex: 20
    };

    return (
        <div style={containerStyle}>
            {/* Background Orbs */}
            <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', filter: 'blur(80px)' }}></div>
            <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '35vw', height: '35vw', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', filter: 'blur(70px)' }}></div>

            <button
                onClick={() => navigate('/')}
                style={backButtonStyle}
                onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            >
                <ArrowLeft size={18} />
                Back to Home
            </button>

            <div style={cardStyle}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '64px',
                    height: '64px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '20px',
                    marginBottom: '28px',
                    color: 'var(--primary)'
                }}>
                    <Code size={36} />
                </div>

                <h1 style={{ color: 'var(--text-main)', fontSize: '32px', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.02em' }}>Welcome Back</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '40px', lineHeight: '1.6', fontSize: '15px' }}>
                    Sign in to sync your rooms, save snippets, and collaborate across all your devices.
                </p>

                <div style={{ marginBottom: '32px' }}>
                    <button
                        onMouseEnter={() => setIsHovered('google')}
                        onMouseLeave={() => setIsHovered(null)}
                        onClick={() => handleLogin('Google')}
                        style={socialButtonStyle('google')}
                    >
                        <Mail size={20} color="#ea4335" />
                        Continue with Google
                    </button>

                    <button
                        onMouseEnter={() => setIsHovered('github')}
                        onMouseLeave={() => setIsHovered(null)}
                        onClick={() => handleLogin('GitHub')}
                        style={socialButtonStyle('github')}
                    >
                        <Github size={20} />
                        Continue with GitHub
                    </button>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    margin: '24px 0',
                    color: 'var(--border-color)'
                }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'currentColor' }}></div>
                    <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OR</span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'currentColor' }}></div>
                </div>

                <button
                    onClick={() => navigate('/')}
                    onMouseEnter={() => setIsHovered('guest')}
                    onMouseLeave={() => setIsHovered(null)}
                    style={{
                        ...socialButtonStyle('guest'),
                        backgroundColor: 'transparent',
                        border: '1px dashed var(--border-color)',
                        marginBottom: 0
                    }}
                >
                    <UserCircle2 size={20} color="var(--primary)" />
                    Don't have an account? Join as Guest
                </button>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default Login;
