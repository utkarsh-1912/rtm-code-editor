import React from 'react';
import Sidebar from './Sidebar';

const AppLayout = ({ children }) => {
    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: 'var(--bg-dark)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <Sidebar />
            <main className="main-content" style={{
                flex: 1,
                marginLeft: 'var(--sidebar-width, 0px)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                minWidth: 0,
                position: 'relative'
            }}>
                <div style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    padding: '40px 32px'
                }}>
                    {children}
                </div>
            </main>

            <style>{`
                :root {
                    --sidebar-width: 280px;
                }
                @media (max-width: 1024px) {
                    :root { --sidebar-width: 240px; }
                }
                @media (max-width: 768px) {
                    :root { --sidebar-width: 0px; }
                    .main-content {
                        padding-bottom: var(--mobile-nav-height, 80px) !important;
                    }
                    .main-content > div {
                        padding: 24px 16px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default AppLayout;
