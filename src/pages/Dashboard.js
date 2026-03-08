import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Plus,
    Terminal,
    Search,
    ExternalLink,
    MoreVertical,
    Edit2,
    Trash2,
    Calendar,
    Users,
    Zap
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
    const [searchTerm, setSearchTerm] = useState('');

    // UI States
    const [showActionMenu, setShowActionMenu] = useState(null);
    const [showRenameModal, setShowRenameModal] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(null);
    const [newName, setNewName] = useState('');

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;
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
    }, [user]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleDeleteRoom = async (roomId) => {
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/remove-room`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid, roomId })
            });

            if (response.ok) {
                toast.success("Room deleted successfully");
                fetchDashboardData();
                setShowDeleteModal(null);
            }
        } catch (err) {
            toast.error("Failed to delete room");
        }
    };

    const handleRenameRoom = async (roomId) => {
        if (!newName.trim()) return;
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/rename-room`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, newName })
            });

            if (response.ok) {
                toast.success("Room renamed");
                fetchDashboardData();
                setShowRenameModal(null);
                setNewName('');
            }
        } catch (err) {
            toast.error("Failed to rename room");
        }
    };

    const filteredRooms = recentRooms.filter(room =>
        room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading || !user) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)' }}>
                <div style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: 'bold' }}>Loading your space...</div>
            </div>
        );
    }

    return (
        <AppLayout>
            <div className="dashboard-container" style={{ animation: 'fadeIn 0.6s ease-out' }}>
                <div className="dashboard-header" style={{
                    marginBottom: '48px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '24px'
                }}>
                    <div>
                        <h1 className="welcome-text" style={{
                            fontSize: 'clamp(28px, 5vw, 40px)',
                            fontWeight: '800',
                            marginBottom: '12px',
                            letterSpacing: '-0.04em',
                            background: 'linear-gradient(to right, var(--text-main), var(--primary))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Welcome, {user.name.split(' ')[0]}
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '16px', fontWeight: '500' }}>
                            Streamline your collaborative development workflow.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="glass-effect"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '16px 32px',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '18px',
                            fontWeight: '800',
                            fontSize: '15px',
                            cursor: 'pointer',
                            boxShadow: '0 12px 24px -6px rgba(59, 130, 246, 0.5)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            whiteSpace: 'nowrap'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 20px 32px -8px rgba(59, 130, 246, 0.6)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            e.currentTarget.style.boxShadow = '0 12px 24px -6px rgba(59, 130, 246, 0.5)';
                        }}
                    >
                        <Plus size={22} strokeWidth={3} /> Create New Room
                    </button>
                </div>

                {/* Stats Section */}
                <div className="stats-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '24px',
                    marginBottom: '64px'
                }}>
                    {[
                        { label: 'Active Projects', value: stats.totalRooms || 0, icon: <Terminal size={24} />, color: 'var(--primary)' },
                        { label: 'Total Sessions', value: stats.sessions || 0, icon: <Users size={24} />, color: 'var(--accent-purple)' },
                        { label: 'Coding Hours', value: `${stats.hours || 0}h`, icon: <Zap size={24} />, color: 'var(--accent-rose)' }
                    ].map((stat, i) => (
                        <div key={i} className="premium-card glass-effect" style={{ padding: '32px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{
                                position: 'absolute',
                                top: '-20px',
                                right: '-20px',
                                width: '100px',
                                height: '100px',
                                borderRadius: '50%',
                                background: stat.color,
                                opacity: 0.05,
                                filter: 'blur(30px)'
                            }}></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '16px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: stat.color,
                                    border: '1px solid var(--border-color)'
                                }}>
                                    {stat.icon}
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {stat.label}
                                    </p>
                                    <h3 style={{ margin: 0, fontSize: '32px', fontWeight: '800' }}>{stat.value}</h3>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="rooms-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>Recent Workspace</h2>
                        <div className="glass-effect" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 20px',
                            borderRadius: '16px',
                            width: '100%',
                            maxWidth: '400px',
                            border: '1px solid var(--border-color)'
                        }}>
                            <Search size={18} color="var(--text-muted)" />
                            <input
                                type="text"
                                placeholder="Filter by room name or ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '15px',
                                    width: '100%',
                                    outline: 'none',
                                    fontWeight: '500'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ padding: '8px' }}>
                        {loadingRooms ? (
                            <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>Synchronizing with cloud...</div>
                        ) : filteredRooms.length > 0 ? (
                            <div className="room-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '12px', padding: '16px' }}>
                                {filteredRooms.map((room) => (
                                    <div
                                        key={room.id}
                                        className="room-card"
                                        style={{
                                            padding: '24px',
                                            backgroundColor: 'var(--bg-dark)',
                                            borderRadius: '20px',
                                            border: '1px solid var(--border-color)',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            position: 'relative',
                                            cursor: 'default'
                                        }}
                                        onMouseOver={(e) => {
                                            if (window.innerWidth > 768) {
                                                e.currentTarget.style.transform = 'translateY(-4px)';
                                                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                                                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
                                            }
                                        }}
                                        onMouseOut={(e) => {
                                            if (window.innerWidth > 768) {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                            <div style={{
                                                padding: '8px 14px',
                                                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: '700',
                                                color: 'var(--primary)',
                                                textTransform: 'uppercase'
                                            }}>
                                                {room.lang}
                                            </div>
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowActionMenu(showActionMenu === room.id ? null : room.id);
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                                >
                                                    <MoreVertical size={20} />
                                                </button>

                                                {showActionMenu === room.id && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        right: 0,
                                                        top: '30px',
                                                        backgroundColor: 'var(--bg-card)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '12px',
                                                        padding: '8px',
                                                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                                        zIndex: 10,
                                                        width: '160px'
                                                    }}>
                                                        <button
                                                            onClick={() => { setShowRenameModal(room); setShowActionMenu(null); }}
                                                            style={menuButtonStyle}
                                                        >
                                                            <Edit2 size={16} /> Rename
                                                        </button>
                                                        <button
                                                            onClick={() => { setShowDeleteModal(room); setShowActionMenu(null); }}
                                                            style={{ ...menuButtonStyle, color: '#f87171' }}
                                                        >
                                                            <Trash2 size={16} /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.name}</h4>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', letterSpacing: '0.02em' }}>ID: {room.id}</p>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                                <Calendar size={14} /> {room.lastActive.split(',')[0]}
                                            </div>
                                            <button
                                                onClick={() => navigate(`/editor/${room.id}`)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '8px 16px',
                                                    borderRadius: '10px',
                                                    border: '1px solid var(--border-color)',
                                                    backgroundColor: 'transparent',
                                                    color: 'var(--text-main)',
                                                    fontWeight: '600',
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'var(--text-main)';
                                                    e.currentTarget.style.color = 'var(--bg-dark)';
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.color = 'var(--text-main)';
                                                }}
                                            >
                                                Enter <ExternalLink size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '100px 40px', textAlign: 'center' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'var(--bg-dark)', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                    <Zap size={40} />
                                </div>
                                <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>No active rooms</h3>
                                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 32px', lineHeight: '1.6' }}>
                                    Your workspace is ready. Create your first room to start collaborating in real-time.
                                </p>
                                <button
                                    onClick={() => navigate('/')}
                                    style={{ padding: '12px 24px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    Start Coding Now
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modals - using fixed portal style */}
                {(showRenameModal || showDeleteModal) && (
                    <div style={modalOverlayStyle}>
                        {showRenameModal && (
                            <div className="glass-effect premium-card" style={modalContentStyle}>
                                <h3 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px' }}>Rename Room</h3>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '15px' }}>Give your collaborative space a more meaningful title.</p>
                                <input
                                    style={modalInputStyle}
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Enter new room name..."
                                    autoFocus
                                />
                                <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                                    <button onClick={() => setShowRenameModal(null)} style={cancelButtonStyle}>Cancel</button>
                                    <button onClick={() => handleRenameRoom(showRenameModal.id)} style={confirmButtonStyle}>Update Name</button>
                                </div>
                            </div>
                        )}

                        {showDeleteModal && (
                            <div className="glass-effect premium-card" style={modalContentStyle}>
                                <h3 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px', color: '#f43f5e' }}>Delete Room</h3>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '15px' }}>Are you sure? This action is permanent and all room data will be lost.</p>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                                    <button onClick={() => setShowDeleteModal(null)} style={cancelButtonStyle}>Cancel</button>
                                    <button onClick={() => handleDeleteRoom(showDeleteModal.id)} style={{ ...confirmButtonStyle, backgroundColor: '#f43f5e' }}>Yes, Delete Room</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .loader {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(59, 130, 246, 0.1);
                    border-top: 3px solid var(--primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @media (max-width: 768px) {
                    .dashboard-header { flex-direction: column !important; align-items: flex-start !important; gap: 24px; }
                    .welcome-text { font-size: 28px !important; }
                    .create-room-btn { width: 100% !important; justify-content: center; }
                    .stats-grid { grid-template-columns: 1fr !important; }
                    .room-grid { grid-template-columns: 1fr !important; padding: 12px !important; }
                }
            `}</style>
        </AppLayout>
    );
};

// Styles
const menuButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-main)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.2s'
};

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '24px'
};

const modalContentStyle = {
    backgroundColor: 'var(--bg-card)',
    padding: '40px',
    borderRadius: '24px',
    border: '1px solid var(--border-color)',
    width: '100%',
    maxWidth: '500px',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
};

const modalInputStyle = {
    width: '100%',
    padding: '16px',
    backgroundColor: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    color: 'var(--text-main)',
    fontSize: '16px',
    outline: 'none'
};

const cancelButtonStyle = {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    color: 'var(--text-main)',
    fontWeight: '600',
    cursor: 'pointer'
};

const confirmButtonStyle = {
    padding: '12px 24px',
    backgroundColor: 'var(--primary)',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontWeight: '700',
    cursor: 'pointer'
};

export default Dashboard;
