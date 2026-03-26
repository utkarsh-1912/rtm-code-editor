import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Search, Bell, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SearchModal from './SearchModal';
import NotificationCenter from './NotificationCenter';

const AppLayout = ({ children }) => {
    const { user } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        return localStorage.getItem('sidebar-collapsed') === 'true';
    });
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const [isLightMode, setIsLightMode] = useState(() => {
        return document.documentElement.classList.contains('light-theme');
    });

    React.useEffect(() => {
        if (isLightMode) {
            document.documentElement.classList.add('light-theme');
        } else {
            document.documentElement.classList.remove('light-theme');
        }
    }, [isLightMode]);

    const toggleTheme = () => {
        const newMode = !isLightMode;
        setIsLightMode(newMode);
        if (newMode) {
            document.documentElement.classList.add('light-theme');
            localStorage.setItem('app-theme', 'light');
        } else {
            document.documentElement.classList.remove('light-theme');
            localStorage.setItem('app-theme', 'dark');
        }
    };

    const toggleSidebarCollapse = () => {
        const newState = !isSidebarCollapsed;
        setIsSidebarCollapsed(newState);
        localStorage.setItem('sidebar-collapsed', newState);
    };

    // Fetch unread status
    const checkNotifications = React.useCallback(async () => {
        if (!user?.uid) return;
        try {
            const { getBackendUrl } = await import('../utils/api');
            const response = await fetch(`${getBackendUrl()}/api/notifications?userId=${user.uid}`);
            const notifications = await response.json();
            const unread = notifications.some(n => !n.is_read);
            setHasUnread(unread);
        } catch (error) {
            console.error('Failed to check notifications:', error);
        }
    }, [user?.uid]);

    React.useEffect(() => {
        checkNotifications();
        const interval = setInterval(checkNotifications, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [checkNotifications]);

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
                isLightMode={isLightMode}
            />

            <Sidebar
                isMobile={false}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={toggleSidebarCollapse}
                isLightMode={isLightMode}
            />

            <div
                className="main-layout-container"
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    width: '100%',
                    minWidth: 0
                }}
            >
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
                            src={isLightMode ? "/utkristi-colabs.png" : "/utkristi-colabs-dark.png"}
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

                        {/* Theme Toggle for Large Screens (Replaces PFP) */}
                        <div className="desktop-inline" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 4px' }}></div>
                            <button
                                onClick={toggleTheme}
                                style={{
                                    ...headerIconStyle,
                                    color: isLightMode ? '#f59e0b' : 'var(--text-muted)',
                                    backgroundColor: isLightMode ? 'rgba(245, 158, 11, 0.1)' : 'transparent'
                                }}
                                title={isLightMode ? "Switch to Dark Mode" : "Switch to Light Mode"}
                            >
                                {isLightMode ? <Sun size={20} /> : <Moon size={20} />}
                            </button>
                        </div>

                        <div
                            onClick={() => {
                                if (window.innerWidth <= 992) {
                                    setIsSidebarOpen(true);
                                }
                            }}
                            className="mobile-only"
                            style={{
                                display: 'none',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--bg-dark)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                            }}>
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
                    --sidebar-width: ${isSidebarCollapsed ? '72px' : '240px'};
                }
                .main-layout-container {
                    margin-left: var(--sidebar-width);
                }
                @media (max-width: 992px) {
                    :root { --sidebar-width: 0px !important; }
                    .main-layout-container { margin-left: 0 !important; }
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
