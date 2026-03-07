import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Github, Mail, Code } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [isHovered, setIsHovered] = useState(null);

    const handleMockLogin = (provider) => {
        // Mocking user data. In production, this would be Firebase auth result.
        const mockUser = {
            uid: '12345',
            name: 'Demo User',
            email: 'demo@example.com',
            photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Demo',
            provider
        };
        login(mockUser);
        toast.success(`Signed in with ${provider}! Redirecting...`);
        setTimeout(() => navigate('/dashboard'), 1500);
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
                backgroundColor: 'rgba(30, 41, 59, 0.7)',
                padding: '40px',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                backdropFilter: 'blur(10px)',
                textAlign: 'center'
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
                    onClick={() => handleMockLogin('Google')}
                    style={socialButtonStyle('google')}
                >
                    <Mail size={20} />
                    Continue with Google
                </button>

                <button
                    onMouseEnter={() => setIsHovered('github')}
                    onMouseLeave={() => setIsHovered(null)}
                    onClick={() => handleMockLogin('GitHub')}
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
                    Don't have an account? <span style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => handleMockLogin('Guest')}>Join as Guest</span>
                </div>
            </div>
        </div>
    );
};

export default Login;
