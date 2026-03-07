import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Clock,
    Plus,
    Settings,
    LogOut,
    Code,
    Terminal,
    User,
    Search,
    ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
    const { user, logout, loading } = useAuth();
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
                const response = await fetch(`/api/user-dashboard?userId=${user.uid}`);
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

    const handleLogout = () => {
        logout();
        toast.success("Signed out successfully");
        navigate('/');
    };

    if (loading || !user) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)' }}>
                <div style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: 'bold' }}>Loading your space...</div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: 'var(--bg-dark)',
            color: 'var(--text-main)',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* Sidebar */}
            <div style={{
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                width: '260px',
                backgroundColor: 'var(--secondary)',
                borderRight: '1px solid var(--border-color)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
                    <div style={{ color: 'var(--primary)' }}>
                        <Code size={28} />
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '1.2rem', letterSpacing: '-0.5px' }}>Utkristi Colabs</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <button style={navItemStyle(true)}>
                        <Clock size={18} /> Recent Rooms
                    </button>
                    <button style={navItemStyle(false)}>
                        <User size={18} /> My Snippets
                    </button>
                    <button style={navItemStyle(false)}>
                        <Settings size={18} /> Account Settings
                    </button>
                </div>

                <div style={{
                    marginTop: 'auto',
                    paddingTop: '20px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                            src={user.photoURL}
                            alt="avatar"
                            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '120px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pro Account</span>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '5px' }}
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ marginLeft: '260px', padding: '48px' }}>
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
                            boxShadow: '0 4px 14px rgba(0, 59, 251, 0.3)'
                        }}
                    >
                        <Plus size={20} /> Create New Room
                    </button>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Recent Rooms</h2>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: 'var(--bg-dark)',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            width: '300px'
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
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{
                                            width: '44px',
                                            height: '44px',
                                            borderRadius: '10px',
                                            backgroundColor: 'rgba(0, 59, 251, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--primary)'
                                        }}>
                                            <Terminal size={20} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', marginBottom: '2px' }}>{room.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Room ID: {room.id} • {room.lang}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{room.lastActive}</span>
                                        <div style={{ color: 'var(--text-muted)' }}>
                                            <ExternalLink size={18} />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No recent rooms found.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const navItemStyle = (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor: active ? 'rgba(0, 59, 251, 0.1)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s'
});

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
