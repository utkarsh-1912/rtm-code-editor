const ACTIONS = require('../../src/Action');

function setupWhiteboardSocket(io, socket, safeSocket, context) {
    const { roomWhiteboardState } = context;

    socket.on(ACTIONS.WHITEBOARD_DRAW, safeSocket((data) => {
        if (!data) return;
        const { roomId, action, payload } = data;
        if (!roomWhiteboardState[roomId]) roomWhiteboardState[roomId] = [];
        if (action === 'ADD') roomWhiteboardState[roomId].push(payload);
        else if (action === 'CLEAR') roomWhiteboardState[roomId] = [];
        else if (action === 'UNDO' || action === 'REDO') if (payload?.elements) roomWhiteboardState[roomId] = payload.elements;
        socket.in(roomId).emit(ACTIONS.WHITEBOARD_DRAW, data);
    }));

    socket.on(ACTIONS.WHITEBOARD_SYNC_REQUEST, safeSocket(({ roomId }) => {
        socket.emit(ACTIONS.WHITEBOARD_SYNC, { elements: roomWhiteboardState[roomId] || [] });
    }));
}

module.exports = setupWhiteboardSocket;
