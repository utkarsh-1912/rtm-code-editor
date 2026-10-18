const ACTIONS = require('../../src/Action');

// The room's "Problem" panel: the question being solved, pasted by anyone in the room.
// Kept in memory per room (like the whiteboard) and sent to people as they open the panel.
const MAX_PROBLEM = 20 * 1024;

function setupProblemSocket(io, socket, safeSocket, context) {
    const { roomProblemState } = context;

    socket.on(ACTIONS.PROBLEM_CHANGE, safeSocket(({ roomId, text, by } = {}) => {
        if (!roomId || !socket.rooms.has(roomId)) return;
        const clean = String(text ?? '').slice(0, MAX_PROBLEM);
        roomProblemState[roomId] = { text: clean, by: String(by || '').slice(0, 40), at: Date.now() };
        socket.to(roomId).emit(ACTIONS.PROBLEM_CHANGE, roomProblemState[roomId]);
    }));

    socket.on(ACTIONS.PROBLEM_SYNC_REQUEST, safeSocket(({ roomId } = {}) => {
        if (!roomId || !socket.rooms.has(roomId)) return;
        socket.emit(ACTIONS.PROBLEM_SYNC, roomProblemState[roomId] || { text: '', by: '', at: 0 });
    }));
}

module.exports = setupProblemSocket;
