import React, { useState, useEffect } from 'react';
import { Bell, UserPlus, FileEdit, Info, Trash2, CheckCircle2 } from 'lucide-react';

const NotificationCenter = ({ isOpen, onClose }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);

    // Mock notifications for now - in a real app, these would come from an API or Socket
    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setTimeout(() => {
                setNotifications([
                    { id: 1, type: 'join', user: 'FJ', message: 'FJ joined your workspace', time: '2m ago', icon: <UserPlus size={14} />, color: '#3b82f6' },
                    { id: 2, type: 'edit', user: 'System', message: 'Workspace "Project Alpha" was renamed', time: '1h ago', icon: <FileEdit size={14} />, color: '#a855f7' },
                    { id: 3, type: 'system', user: 'Admin', message: 'Server maintenance scheduled for 12:00 PM', time: '3h ago', icon: <Info size={14} />, color: '#fbbf24' },
                ]);
                setLoading(false);
            }, 500);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div style={dropdownStyle}>
            <div style={headerStyle}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>Notifications</h3>
                <button
                    onClick={() => setNotifications([])}
                    style={clearButtonStyle}
                >
                    Clear all
                </button>
            </div>

            <div style={contentStyle}>
                {loading ? (
                    <div style={statusTextStyle}>Loading...</div>
                ) : notifications.length > 0 ? (
                    notifications.map((n) => (
                        <div key={n.id} style={notificationItemStyle}>
                            <div style={{ ...iconWrapperStyle, backgroundColor: `${n.color}15`, color: n.color }}>
                                {n.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={messageStyle}>{n.message}</div>
                                <div style={timeStyle}>{n.time}</div>
                            </div>
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
            <div style={pointerStyle}></div>
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

export default NotificationCenter;
