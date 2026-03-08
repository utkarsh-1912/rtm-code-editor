import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Clock,
    Settings,
    LogOut,
    Code,
    Database,
    Plus,
    Menu,
    X,
    User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Sidebar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        toast.success("Signed out successfully");
        navigate('/');
    };

    const navItems = [
        { id: '/dashboard', label: 'Rooms', icon: <Clock size={22} /> },
        { id: '/snippets', label: 'Snippets', icon: <Database size={22} /> },
        { id: '/settings', label: 'Settings', icon: <Settings size={22} /> }
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="desktop-sidebar desktop-only" style={{
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                width: '260px',
                backgroundColor: 'var(--secondary)',
                borderRight: '1px solid var(--border-color)',
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 100,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <div className="sidebar-logo" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '48px',
                    cursor: 'pointer'
                }} onClick={() => navigate('/')}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: 'var(--primary)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                    }}>
                        <Code size={24} />
                    </div>
                    <span style={{ fontWeight: '800', fontSize: '1.25rem', letterSpacing: '-0.5px', color: 'var(--text-main)' }}>Colabs</span>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => navigate(item.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                width: '100%',
                                padding: '14px 18px',
                                borderRadius: '12px',
                                backgroundColor: isActive(item.id) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                color: isActive(item.id) ? 'var(--primary)' : 'var(--text-muted)',
                                border: 'none',
                                fontSize: '14px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onMouseOver={(e) => {
                                if (!isActive(item.id)) {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
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
                            {React.cloneElement(item.icon, { size: 18 })} <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer" style={{
                    marginTop: 'auto',
                    paddingTop: '24px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                            src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=3b82f6&color=fff`}
                            alt="avatar"
                            style={{ width: '36px', height: '36px', borderRadius: '12px' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '120px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {user?.name?.split(' ')[0] || 'Dev'}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>PRO PLAN</span>
                        </div>
                    </div>
                    <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', opacity: 0.7 }} title="Sign Out">
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="mobile-only" style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: 'var(--mobile-nav-height, 75px)',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                padding: '0 10px',
                zIndex: 1000,
                boxShadow: '0 -10px 25px rgba(0,0,0,0.3)'
            }}>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => navigate(item.id)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'transparent',
                            border: 'none',
                            color: isActive(item.id) ? 'var(--primary)' : 'var(--text-muted)',
                            transition: 'all 0.2s',
                            padding: '10px'
                        }}
                    >
                        {item.icon}
                        <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                        {isActive(item.id) && (
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--primary)', marginTop: '2px' }}></div>
                        )}
                    </button>
                ))}

                {/* Floating Action for Mobile */}
                <button
                    onClick={() => navigate('/')}
                    style={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: 'var(--primary)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        border: 'none',
                        boxShadow: '0 4px 15px rgba(59, 130, 246, 0.5)',
                        marginBottom: '40px'
                    }}
                >
                    <Plus size={28} />
                </button>

                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: isMobileMenuOpen ? 'var(--primary)' : 'var(--text-muted)',
                        padding: '10px'
                    }}
                >
                    <Menu size={22} />
                    <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>More</span>
                </button>
            </div>

            {/* Mobile "More" Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        zIndex: 999,
                        display: 'flex',
                        alignItems: 'flex-end'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            backgroundColor: 'var(--bg-dark)',
                            borderTopLeftRadius: '24px',
                            borderTopRightRadius: '24px',
                            padding: '32px 24px 100px',
                            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', margin: '0 auto 24px' }}></div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                            <img
                                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=3b82f6&color=fff`}
                                alt="avatar"
                                style={{ width: '56px', height: '56px', borderRadius: '16px' }}
                            />
                            <div>
                                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>{user?.name || 'Developer'}</h4>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>{user?.email}</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                onClick={handleLogout}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '16px',
                                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                                    color: '#f87171',
                                    border: 'none',
                                    borderRadius: '12px',
                                    width: '100%',
                                    fontWeight: '700',
                                    fontSize: '15px'
                                }}
                            >
                                <LogOut size={20} /> Sign Out of All Sessions
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </>
    );
};

export default Sidebar;
