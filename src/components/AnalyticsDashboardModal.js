import React, { useState, useEffect, useCallback } from 'react';
import { Modal, RollingNumber } from './ux/primitives';
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

    const total = summary.totalActions || 1;
    const parts = [
        { label: 'Code edits', value: summary.edits, color: 'var(--u-ok)' },
        { label: 'Runs', value: summary.executions, color: 'var(--u-warn)' },
        { label: 'AI prompts', value: summary.aiInteractions, color: 'var(--u-mark)' },
        { label: 'Chat', value: summary.chatMessages, color: 'var(--u-ink-3)' },
    ];

    return (
        <Modal open onClose={onClose} wide label={projectId ? `project/${projectId}` : `room/${roomId}`} title="Activity" description="What happened in this workspace, counted from its event log.">
            {!analytics ? (
                <div className="u-skel" style={{ height: 140 }} />
            ) : (
                <>
                    <div className="u-stats" style={{ margin: '0 -24px', borderBottom: 0 }}>
                        {[['Actions', summary.totalActions], ['Edits', summary.edits], ['Runs', summary.executions], ['AI prompts', summary.aiInteractions]].map(([label, value]) => (
                            <div className="u-stat" key={label} style={{ padding: '18px 22px' }}>
                                <span className="u-label">{label}</span>
                                <RollingNumber value={value || 0} />
                            </div>
                        ))}
                    </div>
                    <div className="u-field" style={{ borderTop: '1px solid var(--u-line)', paddingTop: 18 }}>
                        <span className="u-field-label">Mix</span>
                        <div className="an-bar" role="img" aria-label="Share of each action type">
                            {parts.map((p) => <i key={p.label} title={`${p.label}: ${p.value || 0}`} style={{ width: `${((p.value || 0) / total) * 100}%`, background: p.color }} />)}
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            {parts.map((p) => (
                                <span key={p.label} className="u-label"><i style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} /> {p.label} · {p.value || 0}</span>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </Modal>
    );
}

export default AnalyticsDashboardModal;
