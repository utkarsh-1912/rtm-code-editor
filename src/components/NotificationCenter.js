import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserPlus, FileEdit, Info, CheckCircle2, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../utils/api';
import toast from 'react-hot-toast';
import LogoLoader from './LogoLoader';

const NotificationCenter = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef(null);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const response = await fetch(`${getBackendUrl()}/api/notifications?userId=${user.uid}`);
            const data = await response.json();
            setNotifications(data);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
            // Mark all as read when opening
            fetch(`${getBackendUrl()}/api/notifications/read`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.uid })
            }).catch(console.error);
        }
    }, [isOpen, fetchNotifications, user]);

    // Click outside logic
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            // Delay adding the listener to avoid immediate triggering from the button click
            const timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 0);
            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isOpen, onClose]);

    const handleClearAll = async () => {
        try {
            await fetch(`${getBackendUrl()}/api/notifications?userId=${user.uid}`, {
                method: 'DELETE'
            });
            setNotifications([]);
            toast.success('Notifications cleared');
        } catch (error) {
            toast.error('Failed to clear notifications');
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        try {
            await fetch(`${getBackendUrl()}/api/notifications/${id}`, {
                method: 'DELETE'
            });
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            toast.error('Failed to delete notification');
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'join': return <UserPlus size={14} />;
            case 'edit': return <FileEdit size={14} />;
            default: return <Info size={14} />;
        }
    };

    const getColor = (type) => {
        switch (type) {
            case 'join': return '#3b82f6';
            case 'edit': return '#a855f7';
            default: return '#fbbf24';
        }
    };

    if (!isOpen) return null;

    return (
        <div style={dropdownStyle} className="notification-center-dropdown" ref={containerRef}>
            <div style={headerStyle}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>Notifications</h3>
                <button
                    onClick={handleClearAll}
                    style={clearButtonStyle}
                >
                    Clear all
                </button>
            </div>

            <div style={contentStyle}>
                {loading ? (
                    <div style={statusTextStyle}><LogoLoader size={30} message="" /></div>
                ) : notifications.length > 0 ? (
                    notifications.map((n) => (
                        <div key={n.id} style={notificationItemStyle} className="notification-item">
                            <div style={{ ...iconWrapperStyle, backgroundColor: `${getColor(n.type)}15`, color: getColor(n.type) }}>
                                {getIcon(n.type)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={messageStyle}>{n.message}</div>
                                <div style={timeStyle}>{new Date(n.created_at).toLocaleString()}</div>
                            </div>
                            <button
                                onClick={(e) => handleDelete(n.id, e)}
                                style={deleteItemButtonStyle}
                                className="delete-btn"
                                title="Delete"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))
                ) : (
                    <div style={emptyStateStyle}>
                        <CheckCircle2 size={32} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.5 }} />
                        <p style={{ margin: 0 }}>You're all caught up!</p>
                    </div>
                )}
            </div>

            {notifications.length > 0 && (
                <div style={footerStyle}>
                    View all activity
                </div>
            )}

            {/* Pointer for the dropdown */}
            <div style={pointerStyle} className="dropdown-pointer"></div>
        </div>
    );
};

const dropdownStyle = {
    position: 'absolute',
    top: '50px',
    right: '-10px',
    width: '320px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
    zIndex: 1000,
    overflow: 'hidden',
    animation: 'slideIn 0.2s ease-out'
};

const headerStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)'
};

const clearButtonStyle = {
    background: 'transparent',
    border: 'none',
    color: 'var(--primary)',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600'
};

const contentStyle = {
    maxHeight: '360px',
    overflowY: 'auto'
};

const notificationItemStyle = {
    display: 'flex',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'background 0.2s',
    position: 'relative',
    '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.03)'
    }
};

const iconWrapperStyle = {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
};

const messageStyle = {
    fontSize: '13px',
    color: 'var(--text-main)',
    lineHeight: '1.4',
    marginBottom: '4px'
};

const timeStyle = {
    fontSize: '11px',
    color: 'var(--text-muted)'
};

const statusTextStyle = {
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '13px'
};

const emptyStateStyle = {
    padding: '60px 20px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '13px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
};

const footerStyle = {
    padding: '10px',
    textAlign: 'center',
    fontSize: '12px',
    color: 'var(--text-muted)',
    backgroundColor: 'rgba(0,0,0,0.1)',
    cursor: 'pointer',
    fontWeight: '600',
    borderTop: '1px solid var(--border-color)'
};

const pointerStyle = {
    position: 'absolute',
    top: '-6px',
    right: '25px',
    width: '10px',
    height: '10px',
    backgroundColor: 'var(--bg-card)',
    borderLeft: '1px solid var(--border-color)',
    borderTop: '1px solid var(--border-color)',
    transform: 'rotate(45deg)'
};

const deleteItemButtonStyle = {
    background: 'rgba(239, 68, 68, 0.1)',
    border: 'none',
    color: '#ef4444',
    padding: '4px',
    borderRadius: '4px',
    cursor: 'pointer',
    opacity: 0,
    transition: 'opacity 0.2s',
    marginLeft: '8px'
};

const CustomStyles = () => (
    <style>{`
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .notification-item:hover {
            background-color: rgba(255, 255, 255, 0.03);
        }
        .notification-item:hover .delete-btn {
            opacity: 1 !important;
        }
        @media (max-width: 480px) {
            .notification-center-dropdown {
                position: fixed !important;
                top: 64px !important;
                left: 10px !important;
                right: 10px !important;
                width: calc(100% - 20px) !important;
                max-height: 80vh !important;
                border-radius: 16px !important;
            }
            .dropdown-pointer {
                display: none !important;
            }
        }
    `}</style>
);

export default function NotificationCenterWithStyles(props) {
    return (
        <>
            <CustomStyles />
            <NotificationCenter {...props} />
        </>
    );
}
