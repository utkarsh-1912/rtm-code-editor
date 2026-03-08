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
    ChevronRight
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
        { id: '/dashboard', label: 'Dashboard', icon: <Clock size={20} /> },
        { id: '/snippets', label: 'Vault', icon: <Database size={20} /> },
        { id: '/settings', label: 'Settings', icon: <Settings size={20} /> }
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <>
            {/* Desktop Layout - Side Navigation */}
            <aside className="sidebar-desktop glass-effect" style={{
                position: 'fixed',
                left: '24px',
                top: '20px',
                bottom: '20px',
                width: '280px',
                borderRadius: '32px',
                padding: '40px 24px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 100,
                boxShadow: '0 40px 80px rgba(0,0,0,0.3)',
                border: '1px solid var(--border-color)',
                animation: 'slideInLeft 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '64px',
                    padding: '0 12px',
                    cursor: 'pointer'
                }} onClick={() => navigate('/')}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        background: 'linear-gradient(135deg, var(--primary), #a855f7)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: '0 10px 20px rgba(59, 130, 246, 0.4)'
                    }}>
                        <Code size={26} strokeWidth={2.5} />
                    </div>
                    <span style={{ fontWeight: '900', fontSize: '24px', letterSpacing: '-1px' }}>RTM</span>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => navigate(item.id)}
                            className={isActive(item.id) ? 'glass-effect' : ''}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                padding: '18px 24px',
                                borderRadius: '20px',
                                backgroundColor: isActive(item.id) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                color: isActive(item.id) ? 'var(--primary)' : 'var(--text-muted)',
                                border: 'none',
                                fontSize: '16px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ color: isActive(item.id) ? 'var(--primary)' : 'var(--text-muted)' }}>
                                    {item.icon}
                                </div>
                                <span>{item.label}</span>
                            </div>
                            {isActive(item.id) && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }}></div>}
                        </button>
                    ))}
                </nav>

                <div style={{
                    marginTop: 'auto',
                    padding: '24px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '24px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px'
                }}>
                    <img
                        src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=3b82f6&color=fff`}
                        alt="avatar"
                        style={{ width: '44px', height: '44px', borderRadius: '14px', border: '1px solid var(--border-color)' }}
                    />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user?.name || 'Operator'}
                        </p>
                        <button onClick={handleLogout} style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            color: '#f43f5e',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            marginTop: '2px'
                        }}>Sign Out</button>
                    </div>
                </div>
            </aside>

            {/* Mobile Layout - Bottom Tab Bar */}
            <nav className="sidebar-mobile glass-effect" style={{
                position: 'fixed',
                bottom: '24px',
                left: '24px',
                right: '24px',
                height: '80px',
                borderRadius: '24px',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                padding: '0 12px',
                zIndex: 1000,
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                border: '1px solid var(--border-color)',
                animation: 'slideInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
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
                            transition: 'all 0.3s',
                            width: '64px'
                        }}
                    >
                        <div style={{
                            padding: '12px',
                            borderRadius: '16px',
                            backgroundColor: isActive(item.id) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                            transition: 'all 0.3s'
                        }}>
                            {React.cloneElement(item.icon, { size: 24, strokeWidth: isActive(item.id) ? 2.5 : 2 })}
                        </div>
                    </button>
                ))}

                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        width: '64px'
                    }}
                >
                    <div style={{ padding: '12px' }}>
                        <Menu size={24} />
                    </div>
                </button>
            </nav>

            {/* Mobile Side Drawer/Drawer */}
            {isMobileMenuOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    backdropFilter: 'blur(12px)',
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'flex-end',
                    animation: 'fadeIn 0.3s ease-out'
                }} onClick={() => setIsMobileMenuOpen(false)}>
                    <div style={{
                        width: '100%',
                        background: 'var(--bg-card)',
                        borderTopLeftRadius: '32px',
                        borderTopRightRadius: '32px',
                        padding: '40px 32px 64px',
                        borderTop: '1px solid var(--border-color)',
                        boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
                        animation: 'slideInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: '40px', height: '4px', background: 'var(--border-color)', borderRadius: '2px', margin: '0 auto 32px' }}></div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '48px' }}>
                            <img
                                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=3b82f6&color=fff`}
                                alt="avatar"
                                style={{ width: '72px', height: '72px', borderRadius: '24px', border: '1px solid var(--border-color)' }}
                            />
                            <div>
                                <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '900' }}>{user?.name || 'Operator'}</h3>
                                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '15px' }}>{user?.email}</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <button onClick={handleLogout} style={{
                                padding: '20px',
                                background: 'rgba(244, 63, 94, 0.1)',
                                color: '#f43f5e',
                                border: 'none',
                                borderRadius: '20px',
                                width: '100%',
                                fontWeight: '900',
                                fontSize: '16px'
                            }}>Sign Out from Session</button>

                            <button onClick={() => setIsMobileMenuOpen(false)} style={{
                                padding: '20px',
                                background: 'rgba(255,255,255,0.03)',
                                color: 'var(--text-main)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '20px',
                                width: '100%',
                                fontWeight: '800',
                                fontSize: '16px'
                            }}>Return to Dashboard</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideInLeft {
                    from { transform: translateX(-40px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideInUp {
                    from { transform: translateY(40px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .sidebar-mobile { display: none; }
                @media (max-width: 992px) {
                    .sidebar-desktop { display: none !important; }
                    .sidebar-mobile { display: flex !important; }
                }
            `}</style>
        </>
    );
};

export default Sidebar;
