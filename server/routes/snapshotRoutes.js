const express = require('express');
const router = express.Router();
const SnapshotRepository = require('../repositories/SnapshotRepository');
const AnalyticsRepository = require('../repositories/AnalyticsRepository');
const RoomRepository = require('../repositories/RoomRepository');
const { verifyToken } = require('../services/Identity');

// Saved versions of a non-public room are only for its owner and invited people (verified
// sign-in token in the Authorization header). Public rooms and projects are unchanged.
async function mayUseRoom(req, roomId) {
    if (!roomId) return true;
    const access = await RoomRepository.getRoomAccess(roomId);
    if (!access || access.visibility === 'public') return true;
    const who = await verifyToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    return !!who && (who.uid === access.ownerUid || (!!who.email && access.allowed.includes(who.email)));
}
const denied = (res) => res.status(403).json({ error: "This room is private." });

// Get snapshots for room or project
router.get('/snapshots', async (req, res) => {
    try {
        const { projectId, roomId } = req.query;
        if (!(await mayUseRoom(req, roomId))) return denied(res);
        const snapshots = await SnapshotRepository.getSnapshots({ projectId, roomId });
        res.json(snapshots);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Create new snapshot
router.post('/snapshots', async (req, res) => {
    try {
        const { projectId, roomId, name, code, files, createdBy } = req.body;
        if (!name) return res.status(400).json({ error: "Missing snapshot name" });
        if (!(await mayUseRoom(req, roomId))) return denied(res);

        const snapshot = await SnapshotRepository.createSnapshot({ projectId, roomId, name, code, files, createdBy });

        AnalyticsRepository.logActivity({
            userId: createdBy,
            roomId,
            projectId,
            actionType: 'SNAPSHOT_CREATE',
            metadata: { name }
        }).catch(() => { });

        res.json(snapshot);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Get single snapshot details
router.get('/snapshots/:id', async (req, res) => {
    try {
        const snapshot = await SnapshotRepository.getSnapshotById(req.params.id);
        if (!snapshot) return res.status(404).json({ error: "Snapshot not found" });
        if (!(await mayUseRoom(req, snapshot.room_id))) return denied(res);
        res.json(snapshot);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete snapshot
router.delete('/snapshots/:id', async (req, res) => {
    try {
        const snapshot = await SnapshotRepository.getSnapshotById(req.params.id);
        if (snapshot && !(await mayUseRoom(req, snapshot.room_id))) return denied(res);
        await SnapshotRepository.deleteSnapshot(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
