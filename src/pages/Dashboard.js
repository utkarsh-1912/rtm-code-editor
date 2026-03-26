import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Plus,
    Terminal,
    Search,
    MoreVertical,
    Edit2,
    Trash2,
    Calendar,
    Users,
    Zap,
    Folder,
    ChevronRight,
    ChevronLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '../components/AppLayout';
import { getBackendUrl } from '../utils/api';
import SpaceLoader from '../components/SpaceLoader';

const Dashboard = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [recentRooms, setRecentRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [stats, setStats] = useState({ totalRooms: 0, sessions: 0, hours: 0 });
    const [searchTerm, setSearchTerm] = useState('');

    // UI States
    const [showActionMenu, setShowActionMenu] = useState(null);
    const [showRenameModal, setShowRenameModal] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(null);
    const [newName, setNewName] = useState('');
    const [activeTab, setActiveTab] = useState('rooms'); // rooms, projects
    const [projects, setProjects] = useState([]);
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');
    const [newProjectType, setNewProjectType] = useState('web');

    // Carousel Items
    const activityItems = React.useMemo(() => {
        return [
            ...projects.slice(0, 10).map(p => ({ ...p, type: 'project' })),
            ...recentRooms.slice(0, 10).map(r => ({ ...r, type: 'room' }))
        ].sort((a, b) => new Date(b.updatedAt || Date.now()) - new Date(a.updatedAt || Date.now()));
    }, [projects, recentRooms]);

    // Refs for Carousel
    const carouselRef = React.useRef(null);
    const [scrollIndex, setScrollIndex] = useState(0);

    const handleCarouselScroll = () => {
        if (!carouselRef.current) return;
        const scrollLeft = carouselRef.current.scrollLeft;
        const cardWidth = 344; // card + gap
        const index = Math.round(scrollLeft / cardWidth);
        if (index !== scrollIndex) setScrollIndex(index);
    };

    const scrollCarousel = (direction) => {
        if (!carouselRef.current) return;
        const scrollAmount = 344;
        carouselRef.current.scrollBy({
            left: direction === 'right' ? scrollAmount : -scrollAmount,
            behavior: 'smooth'
        });
    };

    const scrollToItem = (index) => {
        if (!carouselRef.current) return;
        carouselRef.current.scrollTo({
            left: index * 344,
            behavior: 'smooth'
        });
    };

    // Click outside listener for dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showActionMenu && !event.target.closest('.action-menu-container')) {
                setShowActionMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showActionMenu]);

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
        if (location.state?.openCreateProject) {
            setShowCreateProjectModal(true);
            setActiveTab('projects');
            // Clear state to avoid reopening on refresh
            window.history.replaceState({}, document.title);
        }
    }, [user, loading, navigate, location]);

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/user-dashboard?userId=${user.uid}`);
            const data = await response.json();

            setRecentRooms(data.rooms || []);
            setStats(data.stats || { totalRooms: 0, sessions: 0, hours: 0 });

            // Fetch Projects
            const projRes = await fetch(`${backendUrl}/api/projects?userId=${user.uid}`);
            const projData = await projRes.json();
            setProjects(projData || []);
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

    const handleCreateProject = async (e) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    name: newProjectName,
                    description: newProjectDesc,
                    type: newProjectType
                })
            });
            if (response.ok) {
                const project = await response.json();
                toast.success("Project created");
                setShowCreateProjectModal(false);
                setNewProjectName('');
                setNewProjectDesc('');
                setNewProjectType('web');
                navigate(`/project/${project.id}`);
            }
        } catch (err) {
            toast.error("Failed to create project");
        }
    };

    const handleDeleteProject = async (projectId) => {
        try {
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/projects/${projectId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                toast.success("Project deleted");
                setShowDeleteModal(null);
                fetchDashboardData();
            }
        } catch (err) {
            toast.error("Delete failed");
        }
    };

    const filteredRooms = recentRooms.filter(room =>
        room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading || !user) {
        return <SpaceLoader />;
    }

    const StatCard = ({ icon: Icon, label, value, color }) => (
        <div style={{
            padding: '20px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'default',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden'
        }} className="stat-card">
            <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: color
            }}>
                <Icon size={24} />
            </div>
            <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>{value}</h3>
            </div>
            <div style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${color}10 0%, transparent 70%)`
            }} />
        </div>
    );

    return (
        <AppLayout>
            <div className="dashboard-container">
                <div style={{
                    marginBottom: '32px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '24px',
                    padding: '12px 0'
                }}>
                    <div>
                        <p style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Workspace</p>
                        <h1 style={{
                            fontSize: '32px',
                            fontWeight: '900',
                            marginBottom: '4px',
                            color: 'var(--text-main)',
                            letterSpacing: '-0.03em'
                        }}>
                            Welcome back, <span style={{ color: 'var(--text-main)' }}>{user.name.split(' ')[0]}</span>
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Let's build something amazing today.</p>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        flexWrap: 'wrap'
                    }}>
                        <button
                            onClick={() => setShowCreateProjectModal(true)}
                            className="dashboard-primary-btn"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px 20px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-main)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                fontWeight: '700',
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.3s'
                            }}
                        >
                            <Folder size={18} /> New Project
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="dashboard-primary-btn highlight"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px 20px',
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '700',
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                                boxShadow: '0 8px 12px -3px rgba(59, 130, 246, 0.3)'
                            }}
                        >
                            <Plus size={20} strokeWidth={2.5} /> New Room
                        </button>
                    </div>
                </div>

                {/* Dashboard Stats */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '20px',
                    marginBottom: '40px'
                }}>
                    <StatCard icon={Folder} label="Active Projects" value={projects.length} color="#3b82f6" />
                    <StatCard icon={Users} label="Total Sessions" value={stats.sessions || recentRooms.length} color="#8b5cf6" />
                    <StatCard icon={Zap} label="Coding Hours" value={stats.hours ? `${stats.hours}h` : '2h'} color="#f59e0b" />
                </div>

                {/* Recent Activity Section */}
                {(recentRooms.length > 0 || projects.length > 0) && (
                    <div style={{ marginBottom: '64px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '8px', height: '24px', backgroundColor: 'var(--primary)', borderRadius: '4px' }} />
                                <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0, letterSpacing: '-0.02em' }}>Recent Activity</h2>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    onClick={() => scrollCarousel('left')}
                                    style={carouselBtnStyle}
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button 
                                    onClick={() => scrollCarousel('right')}
                                    style={carouselBtnStyle}
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>

                        <div style={{ position: 'relative', minWidth: 0, overflow: 'visible' }}>
                            <div 
                                ref={carouselRef}
                                onScroll={handleCarouselScroll}
                                style={{
                                    display: 'flex',
                                    gap: '24px',
                                    overflowX: 'auto',
                                    paddingBottom: '24px',
                                    scrollSnapType: 'x mandatory',
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                    WebkitOverflowScrolling: 'touch'
                                }}
                                className="activity-carousel"
                            >
                                <style>{`
                                    .activity-carousel::-webkit-scrollbar { display: none; }
                                `}</style>

                                {activityItems.map((item, idx) => (
                                    <div
                                        key={`recent-${item.type}-${item.id}`}
                                        onClick={() => navigate(item.type === 'project' ? `/project/${item.id}` : `/editor/${item.id}`)}
                                        className="activity-card"
                                        style={{
                                            flex: '0 0 320px',
                                            padding: '20px',
                                            backgroundColor: 'var(--bg-card)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '16px',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '16px',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            scrollSnapAlign: 'start'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '10px',
                                                backgroundColor: item.type === 'project' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                                                color: item.type === 'project' ? '#3b82f6' : '#8b5cf6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {item.type === 'project' ? <Folder size={20} /> : <Terminal size={20} />}
                                            </div>
                                            <div style={{
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                backgroundColor: 'rgba(255,255,255,0.05)',
                                                fontSize: '10px',
                                                fontWeight: '800',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                color: 'var(--text-muted)'
                                            }}>
                                                {item.type === 'project' ? 'Project' : 'Room'}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--text-main)' }}>{item.name}</h3>
                                            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {item.type === 'project' 
                                                    ? (item.description || `${item.type === 'web' ? 'Fullstack web' : 'Technical'} development project`)
                                                    : `Collaborative coding session • ID: ${item.id.substring(0, 8)}`
                                                }
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Calendar size={14} color="var(--text-muted)" />
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {item.type === 'project' ? 'Updated recently' : 'Opened recently'}
                                                </span>
                                            </div>
                                            <ChevronRight size={16} color="var(--primary)" />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination Dots */}
                            {activityItems.length > 1 && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    marginTop: '8px'
                                }}>
                                    {activityItems.map((_, i) => (
                                        <button
                                            key={`dot-${i}`}
                                            onClick={() => scrollToItem(i)}
                                            style={{
                                                width: scrollIndex === i ? '24px' : '6px',
                                                height: '6px',
                                                borderRadius: '3px',
                                                backgroundColor: scrollIndex === i ? 'var(--primary)' : 'var(--border-color)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: 0,
                                                transition: 'all 0.3s ease'
                                            }}
                                            aria-label={`Go to item ${i + 1}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div style={workspaceCardStyle}>
                    <div style={workspaceHeaderStyle}>
                        <div style={pillTabContainerStyle}>
                            <button
                                onClick={() => setActiveTab('rooms')}
                                style={pillTabButtonStyle(activeTab === 'rooms')}
                            >
                                Single Rooms
                            </button>
                            <button
                                onClick={() => setActiveTab('projects')}
                                style={pillTabButtonStyle(activeTab === 'projects')}
                            >
                                Pro Projects
                            </button>
                        </div>
                        <div style={searchContainerStyle}>
                            <Search size={14} color="var(--text-muted)" />
                            <input
                                type="text"
                                placeholder={`Search ${activeTab}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={searchInputStyle}
                            />
                        </div>
                    </div>

                    <div style={{ padding: '32px' }}>
                        {loadingRooms ? (
                            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <SpaceLoader />
                            </div>
                        ) : activeTab === 'rooms' ? (
                            filteredRooms.length > 0 ? (
                                <div className="responsive-grid">
                                    {filteredRooms.map((room) => (
                                        <div
                                            key={room.id}
                                            style={sharpItemCardStyle}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.borderColor = "var(--primary)";
                                                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)";
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.borderColor = "var(--border-color)";
                                                e.currentTarget.style.backgroundColor = "transparent";
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                <span style={sharpLangBadgeStyle(room.lang)}>
                                                    {room.lang}
                                                </span>
                                                <div style={{ position: 'relative' }} className="action-menu-container">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowActionMenu(showActionMenu === room.id ? null : room.id);
                                                        }}
                                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {showActionMenu === room.id && (
                                                        <div style={sharpMenuStyle}>
                                                            <button onClick={() => { setShowRenameModal(room); setShowActionMenu(null); }} style={menuButtonStyle}><Edit2 size={13} /> Rename</button>
                                                            <button onClick={() => { setShowDeleteModal(room); setShowActionMenu(null); }} style={{ ...menuButtonStyle, color: '#f87171' }}><Trash2 size={13} /> Delete</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-main)' }}>{room.name}</h4>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px', fontFamily: 'monospace' }}>ID: {room.id}</p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Calendar size={12} /> {room.lastActive?.split(',')[0] || "Just now"}
                                                </div>
                                                <button onClick={() => navigate(`/editor/${room.id}`)} style={sharpCardButtonStyle}>Open Workspace</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={emptyStateStyle}>
                                    <Terminal size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                                    <p>No rooms found matching your search</p>
                                </div>
                            )
                        ) : (
                            projects.length > 0 ? (
                                <div className="responsive-grid">
                                    {projects.map((proj) => (
                                        <div
                                            key={proj.id}
                                            style={sharpItemCardStyle}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.borderColor = "var(--primary)";
                                                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)";
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.borderColor = "var(--border-color)";
                                                e.currentTarget.style.backgroundColor = "transparent";
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                                <div style={{ color: 'var(--primary)' }}><Folder size={24} /></div>
                                                <div style={{ position: 'relative' }} className="action-menu-container">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowActionMenu(showActionMenu === proj.id ? null : proj.id);
                                                        }}
                                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {showActionMenu === proj.id && (
                                                        <div style={sharpMenuStyle}>
                                                            <button onClick={() => { setShowDeleteModal({ ...proj, isProject: true }); setShowActionMenu(null); }} style={{ ...menuButtonStyle, color: '#f87171' }}><Trash2 size={13} /> Delete</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-main)' }}>{proj.name}</h4>
                                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>{proj.description || "Multi-file project workspace"}</p>
                                            <button onClick={() => navigate(`/project/${proj.id}`)} style={sharpCardButtonStyle}>Join Project</button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={emptyStateStyle}>
                                    <Folder size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                                    <p>No projects created yet</p>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* Modals - Clean Overlays */}
                {(showRenameModal || showDeleteModal || showCreateProjectModal) && (
                    <div style={modalOverlayStyle}>
                        {showCreateProjectModal && (
                            <div style={modalContentStyle}>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Create Pro Project</h3>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '13px' }}>Start a multi-file workspace with real-time preview.</p>
                                <form onSubmit={handleCreateProject}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>PROJECT NAME</label>
                                            <input
                                                style={modalInputStyle}
                                                value={newProjectName}
                                                onChange={(e) => setNewProjectName(e.target.value)}
                                                placeholder="e.g. My Portfolio Website"
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>DESCRIPTION</label>
                                            <input
                                                style={modalInputStyle}
                                                value={newProjectDesc}
                                                onChange={(e) => setNewProjectDesc(e.target.value)}
                                                placeholder="Short summary of your project..."
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>PROJECT TYPE</label>
                                            <select
                                                style={modalInputStyle}
                                                value={newProjectType}
                                                onChange={(e) => setNewProjectType(e.target.value)}
                                            >
                                                <option value="web">Web Project (HTML/CSS/JS)</option>
                                                <option value="cpp">C++ Project</option>
                                                <option value="python">Python Project</option>
                                                <option value="java">Java Project</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '32px', justifyContent: 'flex-end' }}>
                                        <button type="button" onClick={() => setShowCreateProjectModal(false)} style={{ ...cancelButtonStyle, flex: 1 }}>Cancel</button>
                                        <button type="submit" style={{ ...confirmButtonStyle, flex: 1 }}>Create Project</button>
                                    </div>
                                </form>
                            </div>
                        )}
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
                                <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setShowRenameModal(null)} style={cancelButtonStyle}>Cancel</button>
                                    <button onClick={() => handleRenameRoom(showRenameModal.id)} style={confirmButtonStyle}>Rename</button>
                                </div>
                            </div>
                        )}

                        {showDeleteModal && (
                            <div style={modalOverlayStyle} onClick={() => setShowDeleteModal(null)}>
                                <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                                    <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: '#f87171' }}>Confirm Delete</h2>
                                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                                        Are you sure you want to delete <strong>{showDeleteModal.name}</strong>? This action cannot be undone.
                                    </p>
                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                        <button onClick={() => setShowDeleteModal(null)} style={cancelButtonStyle}>Cancel</button>
                                        <button
                                            onClick={() => {
                                                if (showDeleteModal.isProject) handleDeleteProject(showDeleteModal.id);
                                                else handleDeleteRoom(showDeleteModal.id);
                                            }}
                                            style={{ ...confirmButtonStyle, backgroundColor: '#f87171' }}
                                        >
                                            Delete
                                        </button>
                                    </div>
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
// Modern Sharp Styles
const workspaceCardStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)',
    overflow: 'hidden'
};

const workspaceHeaderStyle = {
    padding: '16px 24px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    flexWrap: 'wrap',
    gap: '20px'
};

const pillTabContainerStyle = {
    display: 'flex',
    backgroundColor: 'var(--bg-dark)',
    padding: '3px',
    borderRadius: '4px',
    border: '1px solid var(--border-color)'
};

const pillTabButtonStyle = (active) => ({
    padding: '8px 24px',
    borderRadius: '4px',
    backgroundColor: active ? 'var(--bg-card)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    border: 'none',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
});

const searchContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    backgroundColor: 'var(--bg-dark)',
    borderRadius: '4px',
    border: '1px solid var(--border-color)',
    minWidth: window.innerWidth < 768 ? '180px' : '280px',
    transition: 'border-color 0.2s'
};

const searchInputStyle = {
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '14px',
    width: '100%',
    outline: 'none'
};

const sharpItemCardStyle = {
    padding: '24px',
    backgroundColor: 'transparent',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.2s ease',
    minHeight: '180px'
};

const sharpCardButtonStyle = {
    padding: '8px 16px',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-main)',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const sharpLangBadgeStyle = (lang) => ({
    fontSize: '10px',
    fontWeight: '700',
    padding: '4px 8px',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    color: 'var(--primary)',
    borderRadius: '2px',
    textTransform: 'uppercase'
});

const sharpMenuStyle = {
    position: 'absolute',
    right: 0,
    top: '28px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    padding: '4px',
    zIndex: 100,
    minWidth: '140px',
    boxShadow: '0 8px 16px rgba(0,0,0,0.4)'
};

const emptyStateStyle = {
    padding: '80px 20px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
};

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
    padding: '24px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    position: 'relative'
};

const modalInputStyle = {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-main)',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
};

const cancelButtonStyle = {
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-muted)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
};

const confirmButtonStyle = {
    padding: '12px 24px',
    backgroundColor: 'var(--primary)',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer'
};

const carouselBtnStyle = {
    border: '1px solid var(--border-color)',
    background: 'var(--bg-card)',
    color: 'var(--text-main)',
    padding: '8px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

export default Dashboard;
