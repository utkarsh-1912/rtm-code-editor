const express = require('express');
const router = express.Router();
const SnapshotRepository = require('../repositories/SnapshotRepository');
const AnalyticsRepository = require('../repositories/AnalyticsRepository');

// Get snapshots for room or project
router.get('/snapshots', async (req, res) => {
    try {
        const { projectId, roomId } = req.query;
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
        res.json(snapshot);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete snapshot
router.delete('/snapshots/:id', async (req, res) => {
    try {
        await SnapshotRepository.deleteSnapshot(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
