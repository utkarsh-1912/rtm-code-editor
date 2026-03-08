import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Search, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SearchModal from './SearchModal';
import NotificationCenter from './NotificationCenter';

const AppLayout = ({ children }) => {
    const { user } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(true); // Default to true for demo

    // Keyboard shortcut for search
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: 'var(--bg-dark)',
            display: 'flex'
        }}>
            {/* Overlay for mobile drawer */}
            {isSidebarOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        zIndex: 1500,
                        backdropFilter: 'blur(2px)'
                    }}
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar
                isMobile={true}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <Sidebar isMobile={false} />

            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                marginLeft: 'var(--sidebar-width)',
                transition: 'margin 0.3s ease',
                width: '100%'
            }}>
                {/* Industry Standard Header */}
                <header style={{
                    height: '64px',
                    backgroundColor: 'var(--bg-card)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 24px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 90
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <img
                            className="header-logo"
                            src="/utkristi-colabs.png"
                            alt="Utkristi Colabs"
                            style={{ height: '28px', cursor: 'pointer' }}
                            onClick={() => window.location.href = '/'}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <button
                            style={headerIconStyle}
                            onClick={() => setIsSearchOpen(true)}
                            title="Search (Ctrl+K)"
                        >
                            <Search size={18} />
                        </button>
                        <div style={{ position: 'relative' }}>
                            <button
                                style={headerIconStyle}
                                onClick={() => {
                                    setIsNotificationsOpen(!isNotificationsOpen);
                                    setHasUnread(false);
                                }}
                            >
                                <Bell size={18} />
                                {hasUnread && <span style={unreadBadgeStyle}></span>}
                            </button>
                            <NotificationCenter
                                isOpen={isNotificationsOpen}
                                onClose={() => setIsNotificationsOpen(false)}
                            />
                        </div>
                        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 4px' }}></div>
                        <div
                            onClick={() => {
                                if (window.innerWidth <= 992) {
                                    setIsSidebarOpen(true);
                                }
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: window.innerWidth <= 992 ? 'pointer' : 'default'
                            }}
                        >
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', display: 'none' }} className="desktop-inline">
                                {user?.name}
                            </span>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--bg-dark)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                transition: 'transform 0.2s'
                            }}
                                onMouseEnter={(e) => {
                                    if (window.innerWidth <= 992) e.currentTarget.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                    if (window.innerWidth <= 992) e.currentTarget.style.transform = 'scale(1)';
                                }}
                            >
                                {user?.photoURL ? (
                                    <img src={user.photoURL} alt="pfp" style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <div style={{ backgroundColor: 'var(--primary)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '12px' }}>
                                        {user?.name?.charAt(0) || 'U'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <main style={{
                    flex: 1,
                    padding: '32px',
                    maxWidth: '1600px',
                    width: '100%',
                    margin: '0 auto'
                }}>
                    {children}
                </main>
            </div>

            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
            />

            <style>{`
                :root {
                    --sidebar-width: 240px;
                }
                @media (max-width: 992px) {
                    :root { --sidebar-width: 0px; }
                    .mobile-only { display: flex !important; }
                    .desktop-inline { display: none !important; }
                    .sidebar-desktop { display: none !important; }
                    .header-logo { display: block !important; }
                    main { padding: 24px 16px !important; }
                }
                @media (min-width: 993px) {
                    .header-logo { display: none !important; }
                    .sidebar-desktop { display: block !important; }
                }
            `}</style>
        </div>
    );
};

const headerIconStyle = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    '&:hover': {
        color: 'var(--text-main)',
        backgroundColor: 'rgba(255,255,255,0.05)'
    }
};

const unreadBadgeStyle = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '8px',
    height: '8px',
    backgroundColor: '#ef4444',
    borderRadius: '50%',
    border: '2px solid var(--bg-card)'
};

export default AppLayout;
