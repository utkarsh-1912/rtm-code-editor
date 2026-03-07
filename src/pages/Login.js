import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Github, Mail, Code } from 'lucide-react';
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

    const socialButtonStyle = (id) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        width: '100%',
        padding: '14px',
        marginBottom: '12px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        backgroundColor: isHovered === id ? 'var(--bg-card)' : 'transparent',
        color: 'var(--text-main)',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isHovered === id ? 'translateY(-2px)' : 'none'
    });

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-dark)',
            padding: '20px'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                backgroundColor: 'var(--bg-card)',
                padding: '40px',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                backdropFilter: 'blur(10px)',
                textAlign: 'center',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '60px',
                    height: '60px',
                    backgroundColor: 'rgba(0, 59, 251, 0.1)',
                    borderRadius: '16px',
                    marginBottom: '24px',
                    color: 'var(--primary)'
                }}>
                    <Code size={32} />
                </div>

                <h1 style={{ color: 'var(--text-main)', fontSize: '28px', marginBottom: '8px' }}>Welcome Back</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Sign in to sync your rooms across devices.</p>

                <button
                    onMouseEnter={() => setIsHovered('google')}
                    onMouseLeave={() => setIsHovered(null)}
                    onClick={() => handleLogin('Google')}
                    style={socialButtonStyle('google')}
                >
                    <Mail size={20} />
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

                <div style={{
                    marginTop: '32px',
                    paddingTop: '24px',
                    borderTop: '1px solid var(--border-color)',
                    fontSize: '14px',
                    color: 'var(--text-muted)'
                }}>
                    Don't have an account? <span style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => navigate('/')}>Join as Guest</span>
                </div>
            </div>
        </div>
    );
};

export default Login;
