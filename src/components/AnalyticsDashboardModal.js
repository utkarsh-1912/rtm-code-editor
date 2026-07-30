import React, { useState, useEffect, useCallback } from 'react';
import { Activity, BarChart2, Zap, Code, Cpu, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBackendUrl } from '../utils/api';

function AnalyticsDashboardModal({ isOpen, onClose, roomId = null, projectId = null }) {
    const [analytics, setAnalytics] = useState(null);

    const fetchAnalytics = useCallback(async () => {
        try {
            const query = projectId ? `projectId=${projectId}` : `roomId=${roomId}`;
            const res = await fetch(`${getBackendUrl()}/api/analytics?${query}`);
            if (!res.ok) throw new Error(`Analytics API error ${res.status}`);
            const data = await res.json();
            setAnalytics(data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load workspace analytics");
        }
    }, [roomId, projectId]);

    useEffect(() => {
        if (!isOpen) return;
        fetchAnalytics();
    }, [isOpen, fetchAnalytics]);

    if (!isOpen) return null;

    const summary = analytics?.summary || { totalActions: 0, edits: 0, executions: 0, chatMessages: 0, aiInteractions: 0 };

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
                width: '680px',
                maxWidth: '92vw',
                maxHeight: '85vh',
                boxShadow: 'var(--glass-shadow)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'var(--bg-card)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: 'var(--radius-btn)',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Activity size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', fontFamily: "'Outfit', sans-serif" }}>Workspace Telemetry & Analytics</h3>
                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Real-time productivity velocity, collaboration health & action metrics</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Summary Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                        {[
                            { label: 'Total Actions', value: summary.totalActions, icon: <BarChart2 size={16} />, color: 'var(--primary)' },
                            { label: 'Code Edits', value: summary.edits, icon: <Code size={16} />, color: '#10b981' },
                            { label: 'Executions', value: summary.executions, icon: <Cpu size={16} />, color: '#f59e0b' },
                            { label: 'AI Prompts', value: summary.aiInteractions, icon: <Zap size={16} />, color: '#8b5cf6' }
                        ].map((stat, idx) => (
                            <div key={idx} style={{
                                backgroundColor: 'var(--bg-card)',
                                padding: '14px',
                                borderRadius: 'var(--radius-card)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: stat.color }}>
                                    {stat.icon}
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>{stat.value}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Progress Breakdown */}
                    <div style={{
                        backgroundColor: 'var(--bg-card)',
                        padding: '16px',
                        borderRadius: 'var(--radius-card)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Collaboration Distribution</h4>
                        <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-dark)', display: 'flex', overflow: 'hidden' }}>
                            <div style={{ width: `${(summary.edits / (summary.totalActions || 1)) * 100}%`, backgroundColor: '#10b981' }} title="Edits" />
                            <div style={{ width: `${(summary.executions / (summary.totalActions || 1)) * 100}%`, backgroundColor: '#f59e0b' }} title="Executions" />
                            <div style={{ width: `${(summary.aiInteractions / (summary.totalActions || 1)) * 100}%`, backgroundColor: '#8b5cf6' }} title="AI Prompts" />
                        </div>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <span style={{ color: '#10b981' }}>● Code Edits</span>
                            <span style={{ color: '#f59e0b' }}>● Executions</span>
                            <span style={{ color: '#8b5cf6' }}>● AI Copilot</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AnalyticsDashboardModal;
