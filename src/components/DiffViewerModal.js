import React, { useState, useEffect, useCallback } from 'react';
import Icon from "./icons/Icon";
import { Modal, timeAgo } from './ux/primitives';
import toast from 'react-hot-toast';
import { getBackendUrl } from '../utils/api';
import { auth } from '../firebase';

// Private rooms check who you are; send the sign-in token when there is one.
const authHeaders = async (extra = {}) => {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
};

function DiffViewerModal({ isOpen, onClose, roomId = null, projectId = null, currentCode = "", files = null, createdBy = "", onRestoreSnapshot }) {
    const [snapshots, setSnapshots] = useState([]);
    const [selectedSnapshot, setSelectedSnapshot] = useState(null);
    const [snapName, setSnapName] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchSnapshots = useCallback(async () => {
        try {
            const query = projectId ? `projectId=${projectId}` : `roomId=${roomId}`;
            const res = await fetch(`${getBackendUrl()}/api/snapshots?${query}`, { headers: await authHeaders() });
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

    const saveSnapshot = async (e) => {
        e.preventDefault();
        const name = snapName.trim() || `Snapshot ${new Date().toLocaleString()}`;
        setSaving(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/snapshots`, {
                method: 'POST',
                headers: await authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ roomId, projectId, name, code: currentCode, files, createdBy }),
            });
            if (!res.ok) throw new Error(`Snapshot API error ${res.status}`);
            toast.success(`Saved “${name}”`);
            setSnapName('');
            fetchSnapshots();
        } catch (err) {
            toast.error('Could not save the snapshot');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const oldLines = (selectedSnapshot?.code || '').split('\n');
    const newLines = (currentCode || '').split('\n');
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    return (
        <Modal open onClose={onClose} wide label={`${snapshots.length} snapshot${snapshots.length === 1 ? '' : 's'}`} title="Version history" description="Compare a saved snapshot with the code you have now, then restore it if you need to."
            footer={selectedSnapshot && onRestoreSnapshot ? <>
                <button type="button" className="u-btn u-btn--ghost" onClick={onClose}>Close</button>
                <button type="button" className="u-btn u-btn--solid" onClick={() => { onRestoreSnapshot(selectedSnapshot); toast.success(`Restored “${selectedSnapshot.name}”`); onClose(); }}>
                    <Icon name="reset" size={16} /> Restore this version
                </button>
            </> : null}
        >
            <form className="h-join" onSubmit={saveSnapshot}>
                <input className="u-input" value={snapName} onChange={(e) => setSnapName(e.target.value)} placeholder="Name this version, e.g. before refactor" aria-label="Snapshot name" />
                <button type="submit" className="u-btn u-btn--solid u-btn--lg" disabled={saving}>{saving ? 'Saving…' : 'Save snapshot'}</button>
            </form>

            {snapshots.length === 0 ? (
                <div className="u-empty" style={{ padding: '40px 0' }}>
                    <span className="u-display">No snapshots</span>
                    <p>Save one above to keep a copy of the code you can compare against or restore.</p>
                </div>
            ) : (
                <div className="dv-grid">
                    <ul className="u-rows dv-list">
                        {snapshots.map((snap) => (
                            <li key={snap.id} className={`u-row s-item${selectedSnapshot?.id === snap.id ? ' on' : ''}`} style={{ gridTemplateColumns: 'minmax(0,1fr)' }} onClick={() => setSelectedSnapshot(snap)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelectedSnapshot(snap)}>
                                <div className="u-row-main">
                                    <span className="u-row-title u-ellipsis" style={{ fontSize: 14.5 }}>{snap.name}</span>
                                    <span className="u-row-meta"><span className="u-mono">{timeAgo(snap.created_at)}</span>{snap.created_by && <span className="u-mono u-ellipsis">{snap.created_by}</span>}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {selectedSnapshot && (
                        <div className="dv-cols">
                            {[['Snapshot', oldLines, newSet, 'del'], ['Now', newLines, oldSet, 'add']].map(([label, lines, other, cls]) => (
                                <div key={label} className="dv-col">
                                    <span className="u-label">{label} · {lines.length} lines</span>
                                    <pre className="u-code dv-code">
                                        {lines.map((l, i) => <span key={i} className={other.has(l) ? '' : cls}>{l || ' '}</span>)}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}

export default DiffViewerModal;
