import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Clock,
    Settings,
    Database,
    X,
    LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Sidebar = ({ isOpen, onClose, isMobile }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        toast.success("Signed out successfully");
        navigate('/');
    };

    const navItems = [
        { id: '/dashboard', label: 'Dashboard', icon: <Clock size={20} /> },
        { id: '/snippets', label: 'Vault', icon: <Database size={20} /> },
        { id: '/settings', label: 'Settings', icon: <Settings size={20} /> }
    ];

    const isActive = (path) => location.pathname === path;

    const sidebarContent = (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-card)',
            borderRight: '1px solid var(--border-color)',
            padding: '24px 16px'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '40px',
                padding: '0 8px'
            }}>
                <div
                    className="sidebar-logo"
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                    onClick={() => { navigate('/'); if (isMobile) onClose(); }}
                >
                    <img
                        src="/utkristi-colabs.png"
                        alt="Utkristi Colabs"
                        style={{ width: 'auto', height: '32px', objectFit: 'contain' }}
                    />
                </div>
                {isMobile && (
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                )}
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => { navigate(item.id); if (isMobile) onClose(); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            width: '100%',
                            padding: '12px 12px',
                            borderRadius: '8px',
                            backgroundColor: isActive(item.id) ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                            color: isActive(item.id) ? 'var(--primary)' : 'var(--text-muted)',
                            border: 'none',
                            fontSize: '14px',
                            fontWeight: isActive(item.id) ? '700' : '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div style={{
                marginTop: 'auto',
                paddingTop: '20px',
                borderTop: '1px solid var(--border-color)',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                }}>
                    <img
                        src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=3b82f6&color=fff`}
                        alt="avatar"
                        style={{ width: '36px', height: '36px', borderRadius: '8px' }}
                    />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <p style={{
                            margin: 0,
                            fontSize: '13px',
                            fontWeight: '700',
                            color: 'var(--text-main)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {user?.name || 'User'}
                        </p>
                        <p style={{
                            margin: 0,
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            Pro Account
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        title="Sign Out"
                        style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            padding: '8px',
                            color: '#ef4444',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        }}
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: '280px',
                zIndex: 2000,
                transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isOpen ? '20px 0 50px rgba(0,0,0,0.5)' : 'none'
            }}>
                {sidebarContent}
            </div>
        );
    }

    return (
        <aside
            className="sidebar-desktop"
            style={{
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                width: '240px',
                zIndex: 100
            }}>
            {sidebarContent}
        </aside>
    );
};

export default Sidebar;
