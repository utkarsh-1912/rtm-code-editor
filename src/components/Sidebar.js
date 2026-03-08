import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Clock,
    Settings,
    LogOut,
    Code,
    Database
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Sidebar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        toast.success("Signed out successfully");
        navigate('/');
    };

    const navItems = [
        { id: '/dashboard', label: 'Recent Rooms', icon: <Clock size={18} /> },
        { id: '/snippets', label: 'My Snippets', icon: <Database size={18} /> },
        { id: '/settings', label: 'Account Settings', icon: <Settings size={18} /> }
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="dashboard-sidebar" style={{
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            width: '260px',
            backgroundColor: 'var(--secondary)',
            borderRight: '1px solid var(--border-color)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
            transition: 'all 0.3s'
        }}>
            <div className="sidebar-logo" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '40px',
                cursor: 'pointer'
            }} onClick={() => navigate('/')}>
                <div style={{ color: 'var(--primary)' }}>
                    <Code size={28} />
                </div>
                <span style={{ fontWeight: '700', fontSize: '1.2rem', letterSpacing: '-0.5px', color: 'var(--text-main)' }}>Utkristi Colabs</span>
            </div>

            <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => navigate(item.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: '10px',
                            backgroundColor: isActive(item.id) ? 'rgba(0, 59, 251, 0.1)' : 'transparent',
                            color: isActive(item.id) ? 'var(--primary)' : 'var(--text-muted)',
                            border: 'none',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                            if (!isActive(item.id)) {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.color = 'var(--text-main)';
                            }
                        }}
                        onMouseOut={(e) => {
                            if (!isActive(item.id)) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--text-muted)';
                            }
                        }}
                    >
                        {item.icon} <span className="nav-text">{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer" style={{
                marginTop: 'auto',
                paddingTop: '20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                        src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=random`}
                        alt="avatar"
                        style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                    />
                    <div className="user-info" style={{ display: 'flex', flexDirection: 'column', maxWidth: '120px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                            {user?.name || 'Developer'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pro Account</span>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '5px' }}
                    title="Logout"
                >
                    <LogOut size={18} />
                </button>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .dashboard-sidebar {
                        left: 0;
                        bottom: 0;
                        top: auto !important;
                        width: 100vw !important;
                        height: 70px !important;
                        flex-direction: row !important;
                        padding: 0 20px !important;
                        border-right: none !important;
                        border-top: 1px solid var(--border-color) !important;
                        justify-content: space-around !important;
                        align-items: center !important;
                    }
                    .sidebar-logo, .user-info, .sidebar-footer {
                        display: none !important;
                    }
                    .sidebar-nav {
                        flex-direction: row !important;
                        justify-content: space-around !important;
                        width: 100% !important;
                        gap: 0 !important;
                    }
                    .nav-text {
                        display: none !important;
                    }
                    .sidebar-nav button {
                        width: auto !important;
                        justify-content: center !important;
                        padding: 12px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default Sidebar;
