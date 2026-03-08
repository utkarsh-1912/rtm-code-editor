import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Clock,
    Settings,
    Database,
    X,
    LogOut,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Sidebar = ({ isOpen, onClose, isMobile, isCollapsed, onToggleCollapse }) => {
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
            padding: isCollapsed && !isMobile ? '24px 12px' : '24px 16px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed && !isMobile ? 'center' : 'space-between',
                marginBottom: '40px',
                padding: '0 8px'
            }}>
                <div
                    className="sidebar-logo"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        justifyContent: 'center'
                    }}
                    onClick={() => { navigate('/'); if (isMobile) onClose(); }}
                >
                    <img
                        src={isCollapsed && !isMobile ? "/logo192.png" : "/utkristi-colabs.png"}
                        alt="Logo"
                        style={{
                            width: 'auto',
                            height: isCollapsed && !isMobile ? '24px' : '32px',
                            objectFit: 'contain',
                            transition: 'all 0.3s'
                        }}
                    />
                </div>
                {isMobile && (
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                )}
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => { navigate(item.id); if (isMobile) onClose(); }}
                        title={isCollapsed && !isMobile ? item.label : ""}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isCollapsed && !isMobile ? 'center' : 'flex-start',
                            gap: '12px',
                            width: '100%',
                            padding: '12px',
                            borderRadius: '12px',
                            backgroundColor: isActive(item.id) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                            color: isActive(item.id) ? 'var(--primary)' : 'var(--text-muted)',
                            border: 'none',
                            fontSize: '14px',
                            fontWeight: isActive(item.id) ? '700' : '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '20px' }}>
                            {item.icon}
                        </div>
                        {(!isCollapsed || isMobile) && <span>{item.label}</span>}
                    </button>
                ))}
            </nav>

            <div style={{
                marginTop: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            }}>
                {/* Profile Section */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed && !isMobile ? 'center' : 'flex-start',
                    gap: '12px',
                    padding: isCollapsed && !isMobile ? '8px' : '12px',
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    transition: 'all 0.3s'
                }}>
                    <img
                        src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=3b82f6&color=fff`}
                        alt="avatar"
                        style={{
                            width: isCollapsed && !isMobile ? '28px' : '36px',
                            height: isCollapsed && !isMobile ? '28px' : '36px',
                            borderRadius: '10px',
                            transition: 'all 0.3s'
                        }}
                    />
                    {(!isCollapsed || isMobile) && (
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
                    )}
                    {(!isCollapsed || isMobile) && (
                        <button
                            onClick={handleLogout}
                            title="Sign Out"
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                padding: '8px',
                                color: '#ef4444',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                transition: 'all 0.2s'
                            }}
                        >
                            <LogOut size={16} />
                        </button>
                    )}
                </div>

                {/* Collapse Toggle for Desktop */}
                {!isMobile && (
                    <button
                        onClick={onToggleCollapse}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            padding: '10px',
                            backgroundColor: 'transparent',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        {isCollapsed ? <ChevronRight size={18} /> : <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ChevronLeft size={18} />
                            <span style={{ fontSize: '12px', fontWeight: '600' }}>Collapse</span>
                        </div>}
                    </button>
                )}
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
                width: isCollapsed ? '72px' : '240px',
                zIndex: 100,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
            {sidebarContent}
        </aside>
    );
};

export default Sidebar;
