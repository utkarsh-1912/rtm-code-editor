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
                marginLeft: '260px',
                padding: '48px',
                transition: 'all 0.3s',
                minWidth: 0 // Prevent flex children from overflowing
            }}>
                {children}
            </main>

            <style>{`
                @media (max-width: 768px) {
                    .dashboard-content {
                        margin-left: 0 !important;
                        padding: 30px 20px 100px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default AppLayout;
