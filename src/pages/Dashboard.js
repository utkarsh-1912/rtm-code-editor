import React, { useState, useEffect } from 'react';
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

    const fetchDashboardData = async () => {
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
    };

    useEffect(() => {
        fetchDashboardData();
    }, [user]);

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
            {/* Header */}
            <div style={{ marginBottom: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                        Welcome back, <span style={{ color: 'var(--primary)' }}>{user.name.split('')[0]}</span>
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>Manage your collaborative codebases and rooms.</p>
                </div>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '14px 28px',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: '700',
                        fontSize: '15px',
                        cursor: 'pointer',
                        boxShadow: '0 8px 24px rgba(0, 59, 251, 0.25)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <Plus size={20} /> Create Room
                </button>
            </div>

            {/* Stats Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '56px' }}>
                <div style={statCardStyle('rgba(59, 130, 246, 0.1)')}>
                    <div style={iconBoxStyle('var(--primary)')}><Terminal size={22} /></div>
                    <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Rooms</span>
                        <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '4px' }}>{stats.totalRooms}</div>
                    </div>
                </div>
                <div style={statCardStyle('rgba(16, 185, 129, 0.1)')}>
                    <div style={iconBoxStyle('#10b981')}><Zap size={22} /></div>
                    <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sessions</span>
                        <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '4px' }}>{stats.sessions}</div>
                    </div>
                </div>
                <div style={statCardStyle('rgba(245, 158, 11, 0.1)')}>
                    <div style={iconBoxStyle('#f59e0b')}><Users size={22} /></div>
                    <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collaborators</span>
                        <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '4px' }}>{Math.ceil(stats.totalRooms * 2.3)}</div>
                    </div>
                </div>
            </div>

            {/* Room List Section */}
            <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.03)'
            }}>
                <div style={{ padding: '32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: '700' }}>Recent Experience</h3>
                    <div style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: '360px'
                    }}>
                        <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                        <input
                            placeholder="Search by room name or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 16px 12px 48px',
                                backgroundColor: 'var(--bg-dark)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'var(--text-main)',
                                fontSize: '14px',
                                outline: 'none',
                                transition: 'all 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                        />
                    </div>
                </div>

                <div style={{ padding: '8px' }}>
                    {loadingRooms ? (
                        <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>Synchronizing with cloud...</div>
                    ) : filteredRooms.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '12px', padding: '16px' }}>
                            {filteredRooms.map((room) => (
                                <div
                                    key={room.id}
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
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.borderColor = 'var(--border-color)';
                                        e.currentTarget.style.boxShadow = 'none';
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

            {/* Modals */}
            {showRenameModal && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px' }}>Rename Workspace</h3>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>New Name</label>
                            <input
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={showRenameModal.name}
                                style={modalInputStyle}
                                onKeyDown={(e) => e.key === 'Enter' && handleRenameRoom(showRenameModal.id)}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowRenameModal(null)} style={cancelButtonStyle}>Cancel</button>
                            <button onClick={() => handleRenameRoom(showRenameModal.id)} style={confirmButtonStyle}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <div style={modalOverlayStyle}>
                    <div style={{ ...modalContentStyle, maxWidth: '400px' }}>
                        <div style={{ color: '#f87171', marginBottom: '16px' }}><Trash2 size={40} /></div>
                        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '12px' }}>Delete Room?</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6' }}>
                            This will permanently remove <b>{showDeleteModal.name}</b> and its entire history. This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setShowDeleteModal(null)} style={{ ...cancelButtonStyle, flex: 1 }}>Keep it</button>
                            <button onClick={() => handleDeleteRoom(showDeleteModal.id)} style={{ ...confirmButtonStyle, backgroundColor: '#f87171', border: 'none', flex: 1 }}>Delete Permanently</button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
};

const statCardStyle = (bgColor) => ({
    backgroundColor: 'var(--bg-card)',
    padding: '32px',
    borderRadius: '24px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    transition: 'all 0.3s ease'
});

const iconBoxStyle = (color) => ({
    width: '60px',
    height: '60px',
    borderRadius: '18px',
    backgroundColor: 'var(--bg-dark)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: color,
    boxShadow: `inset 0 0 0 1px ${color}20`
});

const menuButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
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
    outline: 'none',
    transition: 'all 0.2s'
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
