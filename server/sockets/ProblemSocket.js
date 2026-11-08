const ACTIONS = require('../../src/Action');
const RoomRepository = require('../repositories/RoomRepository');

// The room's "Problem" panel: the question being solved, pasted by anyone in the room.
// Kept in memory per room and saved to the room (a moment after the last edit), so it survives
// restarts and a kit or scheduled meeting can set it up before anyone arrives.
const saveTimers = {};
const MAX_PROBLEM = 20 * 1024;

function setupProblemSocket(io, socket, safeSocket, context) {
    const { roomProblemState } = context;

    socket.on(ACTIONS.PROBLEM_CHANGE, safeSocket(({ roomId, text, by } = {}) => {
        if (!roomId || !socket.rooms.has(roomId)) return;
        const clean = String(text ?? '').slice(0, MAX_PROBLEM);
        roomProblemState[roomId] = { text: clean, by: String(by || '').slice(0, 40), at: Date.now() };
        socket.to(roomId).emit(ACTIONS.PROBLEM_CHANGE, roomProblemState[roomId]);
        clearTimeout(saveTimers[roomId]);
        saveTimers[roomId] = setTimeout(() => {
            delete saveTimers[roomId];
            RoomRepository.setRoomProblem(roomId, clean).catch(() => { });
        }, 1500);
    }));

    socket.on(ACTIONS.PROBLEM_SYNC_REQUEST, safeSocket(({ roomId } = {}) => {
        if (!roomId || !socket.rooms.has(roomId)) return;
        if (roomProblemState[roomId]) return socket.emit(ACTIONS.PROBLEM_SYNC, roomProblemState[roomId]);
        RoomRepository.getRoomProblem(roomId).then((text) => {
            if (text && !roomProblemState[roomId]) roomProblemState[roomId] = { text, by: '', at: Date.now() };
            socket.emit(ACTIONS.PROBLEM_SYNC, roomProblemState[roomId] || { text: '', by: '', at: 0 });
        }).catch(() => socket.emit(ACTIONS.PROBLEM_SYNC, { text: '', by: '', at: 0 }));
    }));
}

module.exports = setupProblemSocket;
