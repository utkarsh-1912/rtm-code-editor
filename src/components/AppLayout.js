import React from 'react';
import Sidebar from './Sidebar';

const AppLayout = ({ children }) => {
    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: 'var(--bg-dark)',
            color: 'var(--text-main)',
            fontFamily: 'Inter, sans-serif',
            display: 'flex'
        }}>
            <Sidebar />
            <main className="dashboard-content" style={{
                flex: 1,
                marginLeft: 'var(--sidebar-width, 260px)',
                padding: '48px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                minWidth: 0,
                position: 'relative',
                zIndex: 1
            }}>
                {children}
            </main>

            <style>{`
                :root {
                    --sidebar-width: 260px;
                }
                @media (max-width: 768px) {
                    :root {
                        --sidebar-width: 0px;
                    }
                    .dashboard-content {
                        padding: 24px 16px 100px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default AppLayout;
