import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, Search, Bell, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AppLayout = ({ children }) => {
    const { user } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
                        <button
                            className="mobile-only"
                            onClick={() => setIsSidebarOpen(true)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '8px',
                                display: 'none'
                            }}
                        >
                            <Menu size={20} />
                        </button>
                        <div className="mobile-only" style={{ fontWeight: '800', fontSize: '18px', color: 'var(--text-main)', display: 'none' }}>RTM Editor</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <button style={headerIconStyle}><Search size={18} /></button>
                        <button style={headerIconStyle}><Bell size={18} /></button>
                        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 4px' }}></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                                overflow: 'hidden'
                            }}>
                                {user?.photoURL ? (
                                    <img src={user.photoURL} alt="pfp" style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <User size={16} color="var(--text-muted)" />
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

            <style>{`
                :root {
                    --sidebar-width: 240px;
                }
                @media (max-width: 992px) {
                    :root { --sidebar-width: 0px; }
                    .mobile-only { display: flex !important; }
                    .desktop-inline { display: none !important; }
                    main { padding: 24px 16px !important; }
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
    transition: 'all 0.2s'
};

export default AppLayout;
