// Time spent pairing: while a room or project has two or more people in it, every signed-in
// person there accrues time. Saved to users.pairing_seconds when they leave, when the room
// drops to one person, and every few minutes (so a server restart loses at most that much).
const UserRepository = require('../repositories/UserRepository');

const FLUSH_MS = 5 * 60 * 1000;

function createPairingTracker(io, socketMeta) {
    const open = new Map(); // socketId -> { roomId, uid, since }

    const persist = (uid, seconds) => {
        if (!uid || seconds < 1) return;
        UserRepository.addPairingSeconds(uid, Math.round(seconds)).catch((err) => console.error("Pairing time not saved:", err.message));
    };

    const close = (socketId) => {
        const rec = open.get(socketId);
        if (!rec) return;
        open.delete(socketId);
        persist(rec.uid, (Date.now() - rec.since) / 1000);
    };

    // Re-evaluate a room after someone joined or left. `leavingId` is still in the room
    // while it disconnects, so it is left out of the count.
    const recompute = (roomId, leavingId = null) => {
        if (!roomId || roomId.startsWith('call:')) return;
        const members = [...(io.sockets.adapter.rooms.get(roomId) || [])].filter((id) => id !== leavingId);
        if (members.length >= 2) {
            const now = Date.now();
            for (const id of members) {
                const uid = socketMeta[id]?.uid;
                const rec = open.get(id);
                if (!uid || (rec && rec.roomId === roomId)) continue;
                if (rec) close(id);
                open.set(id, { roomId, uid, since: now });
            }
        } else {
            for (const id of members) if (open.get(id)?.roomId === roomId) close(id);
        }
    };

    const flush = setInterval(() => {
        const now = Date.now();
        for (const rec of open.values()) {
            persist(rec.uid, (now - rec.since) / 1000);
            rec.since = now;
        }
    }, FLUSH_MS);
    flush.unref?.();

    return { recompute, close };
}

module.exports = { createPairingTracker };
