const ACTIONS = require('../../src/Action');

// Simulate mode only syncs its inputs; each client runs the same deterministic engine.
// The server keeps the board clock so everyone (and anyone who joins later) asks the
// engine for the same moment.
const SIM_MAX_LOAD = 5000;
const SIM_DEFAULT = { running: false, load: 200, seed: 1, elapsedMs: 0, since: 0 };
const simElapsed = (s) => (s.running ? s.elapsedMs + (Date.now() - s.since) : s.elapsedMs);
const simView = (s = SIM_DEFAULT) => ({ running: s.running, load: s.load, seed: s.seed, elapsedMs: simElapsed(s) });

// Last person out: stop the clock so nobody comes back to minutes of catching up.
function pauseWhiteboardSim(roomWhiteboardSim, roomId) {
    const s = roomWhiteboardSim[roomId];
    if (s?.running) roomWhiteboardSim[roomId] = { ...s, running: false, elapsedMs: simElapsed(s) };
}

function setupWhiteboardSocket(io, socket, safeSocket, context) {
    const { roomWhiteboardState, roomWhiteboardSim } = context;

    socket.on(ACTIONS.WHITEBOARD_DRAW, safeSocket((data) => {
        if (!data) return;
        const { roomId, action, payload } = data;
        if (action === 'SIM') {
            // { running?, load?, seed?, reset? }. A new load or seed starts the run again.
            if (!roomId || !socket.rooms.has(roomId)) return;
            const cur = roomWhiteboardSim[roomId] || SIM_DEFAULT;
            const load = Number.isFinite(Number(payload?.load)) ? Math.min(SIM_MAX_LOAD, Math.max(1, Math.round(Number(payload.load)))) : cur.load;
            const seed = Number.isInteger(payload?.seed) ? payload.seed >>> 0 : cur.seed;
            const running = typeof payload?.running === 'boolean' ? payload.running : cur.running;
            const restart = !!payload?.reset || load !== cur.load || seed !== cur.seed;
            const elapsedMs = restart ? 0 : simElapsed(cur);
            roomWhiteboardSim[roomId] = { running, load, seed, elapsedMs, since: Date.now() };
            io.in(roomId).emit(ACTIONS.WHITEBOARD_DRAW, { roomId, action: 'SIM', payload: simView(roomWhiteboardSim[roomId]) });
            return;
        }
        if (!roomWhiteboardState[roomId]) roomWhiteboardState[roomId] = [];
        if (action === 'ADD') roomWhiteboardState[roomId].push(payload);
        else if (action === 'CLEAR') roomWhiteboardState[roomId] = [];
        else if (action === 'UNDO' || action === 'REDO') { if (payload?.elements) roomWhiteboardState[roomId] = payload.elements; }
        else if (action === 'UPDATE') {
            // Diagram edits (move, resize, text, style, sim capacity): replace elements by id.
            const changed = new Map((Array.isArray(payload?.elements) ? payload.elements : []).filter((e) => e?.id).map((e) => [e.id, e]));
            roomWhiteboardState[roomId] = roomWhiteboardState[roomId].map((e) => changed.get(e?.id) || e);
        } else if (action === 'DELETE') {
            const gone = new Set(Array.isArray(payload?.ids) ? payload.ids : []);
            roomWhiteboardState[roomId] = roomWhiteboardState[roomId].filter((e) => !gone.has(e?.id));
        }
        // Drags send many transient updates; they are only for live viewers, so volatile is fine.
        if (action === 'UPDATE' && payload?.transient) socket.volatile.in(roomId).emit(ACTIONS.WHITEBOARD_DRAW, data);
        else socket.in(roomId).emit(ACTIONS.WHITEBOARD_DRAW, data);
    }));

    // Live cursors on the board (board coordinates). Volatile: a dropped frame doesn't matter.
    socket.on(ACTIONS.WHITEBOARD_CURSOR, safeSocket((data) => {
        const roomId = data?.roomId;
        if (!roomId || !socket.rooms.has(roomId)) return;
        const x = Number(data.x), y = Number(data.y);
        if (!data.gone && (!Number.isFinite(x) || !Number.isFinite(y))) return;
        socket.volatile.to(roomId).emit(ACTIONS.WHITEBOARD_CURSOR, {
            socketId: socket.id,
            x, y,
            gone: !!data.gone,
            userName: String(data.userName || 'Guest').slice(0, 40),
        });
    }));

    socket.on(ACTIONS.WHITEBOARD_SYNC_REQUEST, safeSocket(({ roomId }) => {
        socket.emit(ACTIONS.WHITEBOARD_SYNC, { elements: roomWhiteboardState[roomId] || [], sim: simView(roomWhiteboardSim[roomId]) });
    }));
}

module.exports = setupWhiteboardSocket;
module.exports.pauseWhiteboardSim = pauseWhiteboardSim;
