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
import SpaceLoader from '../components/SpaceLoader';

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
                method: 'DELETE',
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
                method: 'PUT',
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
        return <SpaceLoader />;
    }

    return (
        <AppLayout>
            <div className="dashboard-container">
                <div style={{
                    marginBottom: '40px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '24px'
                }}>
                    <div>
                        <h1 style={{
                            fontSize: '32px',
                            fontWeight: '800',
                            marginBottom: '8px',
                            color: 'var(--text-main)',
                            letterSpacing: '-0.02em'
                        }}>
                            Dashboard
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px', fontWeight: '500' }}>
                            Welcome back, <span style={{ color: 'var(--primary)' }}>{user.name}</span>
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {user?.last_room_id && (
                            <button
                                onClick={() => navigate(`/editor/${user.last_room_id}`, { state: { userName: user.name, role: 'editor' } })}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    backgroundColor: 'rgba(168, 85, 247, 0.08)',
                                    color: '#a855f7',
                                    border: '1px solid rgba(168, 85, 247, 0.2)',
                                    padding: '12px 24px',
                                    borderRadius: '12px',
                                    fontWeight: '700',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 4px 12px rgba(168, 85, 247, 0.1)'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.12)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.08)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <Zap size={18} fill="#a855f7" /> Resume: {user.last_room_id}
                            </button>
                        )}
                        <button
                            onClick={() => navigate('/')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px 24px',
                                background: 'linear-gradient(135deg, var(--primary) 0%, #2563eb 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: '700',
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.4)'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 15px 25px -5px rgba(59, 130, 246, 0.5)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(59, 130, 246, 0.4)';
                            }}
                        >
                            <Plus size={20} strokeWidth={2.5} /> New Room
                        </button>
                    </div>
                </div>

                {/* Industry Standard Stats Area */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '20px',
                    marginBottom: '40px'
                }}>
                    {[
                        { label: 'Active Projects', value: stats.totalRooms || 0, icon: <Terminal size={20} /> },
                        { label: 'Total Sessions', value: stats.sessions || 0, icon: <Users size={20} /> },
                        { label: 'Coding Hours', value: `${stats.hours || 0}h`, icon: <Zap size={20} /> }
                    ].map((stat, i) => (
                        <div key={i} style={{
                            padding: '24px',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <div style={{ color: 'var(--primary)' }}>{stat.icon}</div>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{stat.label}</span>
                            </div>
                            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' }}>{stat.value}</div>
                        </div>
                    ))}
                </div>

                <div style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Recent Workspaces</h2>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            backgroundColor: 'var(--bg-dark)',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            width: '240px'
                        }}>
                            <Search size={14} color="var(--text-muted)" />
                            <input
                                type="text"
                                placeholder="Filter rooms..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '13px',
                                    width: '100%',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ padding: '24px' }}>
                        {loadingRooms ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                        ) : filteredRooms.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                                {filteredRooms.map((room) => (
                                    <div
                                        key={room.id}
                                        style={{
                                            padding: '20px',
                                            backgroundColor: 'var(--bg-dark)',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                <span style={{
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                    padding: '4px 8px',
                                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                                    color: 'var(--primary)',
                                                    borderRadius: '4px',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {room.lang}
                                                </span>
                                                <div style={{ position: 'relative' }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowActionMenu(showActionMenu === room.id ? null : room.id);
                                                        }}
                                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>

                                                    {showActionMenu === room.id && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            right: 0,
                                                            top: '24px',
                                                            backgroundColor: 'var(--bg-card)',
                                                            border: '1px solid var(--border-color)',
                                                            borderRadius: '6px',
                                                            padding: '4px',
                                                            zIndex: 10,
                                                            minWidth: '120px',
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                                        }}>
                                                            <button
                                                                onClick={() => { setShowRenameModal(room); setShowActionMenu(null); }}
                                                                style={menuButtonStyle}
                                                            >
                                                                <Edit2 size={13} /> Rename
                                                            </button>
                                                            <button
                                                                onClick={() => { setShowDeleteModal(room); setShowActionMenu(null); }}
                                                                style={{ ...menuButtonStyle, color: '#f87171' }}
                                                            >
                                                                <Trash2 size={13} /> Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-main)' }}>{room.name}</h4>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>ID: {room.id}</p>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={12} /> {room.lastActive.split(',')[0]}
                                            </div>
                                            <button
                                                onClick={() => navigate(`/editor/${room.id}`)}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--border-color)',
                                                    backgroundColor: 'transparent',
                                                    color: 'var(--text-main)',
                                                    fontWeight: '600',
                                                    fontSize: '12px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                Open <ExternalLink size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '60px 0', textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>No workspaces found.</p>
                                <button
                                    onClick={() => navigate('/')}
                                    style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                                >
                                    Create New Room
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modals - Clean Overlays */}
                {(showRenameModal || showDeleteModal) && (
                    <div style={modalOverlayStyle}>
                        {showRenameModal && (
                            <div style={modalContentStyle}>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Rename Workspace</h3>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '13px' }}>Enter a new name for this collaborative space.</p>
                                <input
                                    style={modalInputStyle}
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Workspace name"
                                    autoFocus
                                />
                                <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setShowRenameModal(null)} style={cancelButtonStyle}>Cancel</button>
                                    <button onClick={() => handleRenameRoom(showRenameModal.id)} style={confirmButtonStyle}>Rename</button>
                                </div>
                            </div>
                        )}

                        {showDeleteModal && (
                            <div style={modalContentStyle}>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#f87171' }}>Delete Workspace</h3>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '13px' }}>Are you sure you want to delete this workspace? This action cannot be undone.</p>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setShowDeleteModal(null)} style={cancelButtonStyle}>Cancel</button>
                                    <button onClick={() => handleDeleteRoom(showDeleteModal.id)} style={{ ...confirmButtonStyle, backgroundColor: '#ef4444' }}>Delete Permanently</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

// Styles
const menuButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-main)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'left',
    borderRadius: '4px',
    transition: 'background 0.2s'
};

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '24px',
    backdropFilter: 'blur(4px)'
};

const modalContentStyle = {
    backgroundColor: 'var(--bg-card)',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
};

const modalInputStyle = {
    width: '100%',
    padding: '12px 14px',
    backgroundColor: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-main)',
    fontSize: '14px',
    outline: 'none'
};

const cancelButtonStyle = {
    padding: '10px 18px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-muted)',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer'
};

const confirmButtonStyle = {
    padding: '10px 18px',
    backgroundColor: 'var(--primary)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer'
};

export default Dashboard;
