import React, { useState, useEffect, useCallback } from 'react';
import { History, GitCommit, RotateCcw, X, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBackendUrl } from '../utils/api';

function DiffViewerModal({ isOpen, onClose, roomId = null, projectId = null, currentCode = "", onRestoreSnapshot }) {
    const [snapshots, setSnapshots] = useState([]);
    const [selectedSnapshot, setSelectedSnapshot] = useState(null);

    const fetchSnapshots = useCallback(async () => {
        try {
            const query = projectId ? `projectId=${projectId}` : `roomId=${roomId}`;
            const res = await fetch(`${getBackendUrl()}/api/snapshots?${query}`);
            if (!res.ok) throw new Error(`Snapshot API error ${res.status}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                setSnapshots(data);
                if (data.length > 0) setSelectedSnapshot(data[0]);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load version history");
        }
    }, [roomId, projectId]);

    useEffect(() => {
        if (!isOpen) return;
        fetchSnapshots();
    }, [isOpen, fetchSnapshots]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999
        }}>
            <div style={{
                backgroundColor: 'var(--bg-floating)',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--border-color)',
                width: '840px',
                maxWidth: '94vw',
                height: '80vh',
                boxShadow: 'var(--glass-shadow)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'var(--bg-card)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: 'var(--radius-btn)',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <History size={18} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', fontFamily: "'Outfit', sans-serif" }}>Version Snapshots & Diff Viewer</h3>
                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Compare historical checkpoints and restore previous versions</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Content Layout */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Snapshots Sidebar */}
                    <div style={{
                        width: '260px',
                        borderRight: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-dark)',
                        padding: '12px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '4px' }}>REVISION TIMELINE</div>
                        {snapshots.length === 0 ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
                                No snapshots created yet.
                            </div>
                        ) : (
                            snapshots.map((snap) => {
                                const isSelected = selectedSnapshot && selectedSnapshot.id === snap.id;
                                return (
                                    <div
                                        key={snap.id}
                                        onClick={() => setSelectedSnapshot(snap)}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: 'var(--radius-card)',
                                            border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                                            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <GitCommit size={13} color={isSelected ? 'var(--primary)' : 'var(--text-muted)'} />
                                            <span style={{ fontSize: '12px', fontWeight: '700', color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>{snap.name}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            <Clock size={10} />
                                            <span>{new Date(snap.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Diff Preview Panel */}
                    <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                        {selectedSnapshot ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>{selectedSnapshot.name}</h4>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Created by {selectedSnapshot.created_by}</span>
                                    </div>
                                    {onRestoreSnapshot && (
                                        <button
                                            onClick={() => {
                                                onRestoreSnapshot(selectedSnapshot);
                                                toast.success(`Restored snapshot "${selectedSnapshot.name}"`);
                                                onClose();
                                            }}
                                            className="primary-action-btn"
                                            style={{
                                                padding: '6px 14px',
                                                fontSize: '12px',
                                                borderRadius: 'var(--radius-btn)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <RotateCcw size={14} /> Restore Version
                                        </button>
                                    )}
                                </div>

                                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '4px' }}>HISTORICAL CODE</div>
                                        <pre style={{
                                            flex: 1,
                                            margin: 0,
                                            padding: '12px',
                                            backgroundColor: 'var(--bg-dark)',
                                            borderRadius: 'var(--radius-card)',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '12px',
                                            fontFamily: 'monospace',
                                            overflowY: 'auto',
                                            whiteSpace: 'pre-wrap',
                                            color: '#f87171'
                                        }}>
                                            {selectedSnapshot.code || "// Empty code state"}
                                        </pre>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '4px' }}>CURRENT WORKSPACE CODE</div>
                                        <pre style={{
                                            flex: 1,
                                            margin: 0,
                                            padding: '12px',
                                            backgroundColor: 'var(--bg-dark)',
                                            borderRadius: 'var(--radius-card)',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '12px',
                                            fontFamily: 'monospace',
                                            overflowY: 'auto',
                                            whiteSpace: 'pre-wrap',
                                            color: '#34d399'
                                        }}>
                                            {currentCode || "// Empty current code"}
                                        </pre>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                Select a snapshot from the timeline to view diff.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DiffViewerModal;
