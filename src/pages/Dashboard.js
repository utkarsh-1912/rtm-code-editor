import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Plus,
    Terminal,
    Search,
    ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '../components/AppLayout';
import { getBackendUrl } from '../utils/api';

const Dashboard = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [recentRooms, setRecentRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [stats, setStats] = useState({ totalRooms: 0, sessions: 0, hours: 0 });

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        if (!user) return;

        const fetchDashboardData = async () => {
            try {
                const backendUrl = getBackendUrl();
                const response = await fetch(`${backendUrl}/api/user-dashboard?userId=${user.uid}`);
                const data = await response.json();

                setRecentRooms(data.rooms || []);
                setStats(data.stats || { totalRooms: 0, sessions: 0, hours: 0 });
            } catch (err) {
                console.error("Dashboard Fetch Error:", err);
                toast.error("Failed to load your workspace data.");
            } finally {
                setLoadingRooms(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    if (loading || !user) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)' }}>
                <div className="pulse-animation" style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: 'bold' }}>Loading your space...</div>
            </div>
        );
    }

    return (
        <AppLayout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Dashboard</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Welcome back, {user.name}. Here's what's happening.</p>
                </div>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(0, 59, 251, 0.3)',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <Plus size={20} /> Create New Room
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                <div style={statCardStyle()}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Total Rooms</span>
                    <span style={{ fontSize: '28px', fontWeight: '700' }}>{stats.totalRooms}</span>
                </div>
                <div style={statCardStyle()}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Active Sessions</span>
                    <span style={{ fontSize: '28px', fontWeight: '700' }}>{stats.sessions}</span>
                </div>
                <div style={statCardStyle()}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Collaboration Hours</span>
                    <span style={{ fontSize: '28px', fontWeight: '700' }}>{stats.hours}h</span>
                </div>
            </div>

            <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                padding: '32px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Recent Rooms</h2>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        backgroundColor: 'var(--bg-dark)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        width: '100%',
                        maxWidth: '300px'
                    }}>
                        <Search size={16} color="var(--text-muted)" />
                        <input
                            placeholder="Search rooms..."
                            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '14px', width: '100%' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loadingRooms ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading your rooms...</div>
                    ) : recentRooms.length > 0 ? (
                        recentRooms.map((room) => (
                            <div
                                key={room.id}
                                onClick={() => navigate(`/editor/${room.id}`)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '16px 20px',
                                    backgroundColor: 'var(--bg-dark)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    gap: '12px'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--primary)';
                                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.02)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                    e.currentTarget.style.backgroundColor = 'var(--bg-dark)';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: 0 }}>
                                    <div style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '10px',
                                        backgroundColor: 'rgba(0, 59, 251, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--primary)',
                                        flexShrink: 0
                                    }}>
                                        <Terminal size={20} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: '600', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Room ID: {room.id} • {room.lang}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'none' }}>{room.lastActive}</span>
                                    <div style={{ color: 'var(--text-muted)' }}>
                                        <ExternalLink size={18} />
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                            No recent rooms found. Start by creating one!
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
};

const statCardStyle = () => ({
    backgroundColor: 'var(--bg-card)',
    padding: '24px',
    borderRadius: '20px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
});

export default Dashboard;
