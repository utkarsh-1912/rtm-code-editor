const ACTIONS = require('../../src/Action');

function setupWhiteboardSocket(io, socket, safeSocket, context) {
    const { roomWhiteboardState } = context;

    socket.on(ACTIONS.WHITEBOARD_DRAW, safeSocket((data) => {
        if (!data) return;
        const { roomId, action, payload } = data;
        if (!roomWhiteboardState[roomId]) roomWhiteboardState[roomId] = [];
        if (action === 'ADD') roomWhiteboardState[roomId].push(payload);
        else if (action === 'CLEAR') roomWhiteboardState[roomId] = [];
        else if (action === 'UNDO' || action === 'REDO') { if (payload?.elements) roomWhiteboardState[roomId] = payload.elements; }
        else if (action === 'UPDATE') {
            // Diagram edits (move, resize, text, style): replace elements by id.
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
        socket.emit(ACTIONS.WHITEBOARD_SYNC, { elements: roomWhiteboardState[roomId] || [] });
    }));
}

module.exports = setupWhiteboardSocket;
