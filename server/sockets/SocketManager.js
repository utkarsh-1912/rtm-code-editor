const ACTIONS = require('../../src/Action');
const RoomRepository = require('../repositories/RoomRepository');
const setupEditorSocket = require('./EditorSocket');
const setupWhiteboardSocket = require('./WhiteboardSocket');
const setupProblemSocket = require('./ProblemSocket');
const setupMediaSocket = require('./MediaSocket');

const userSocketMap = {};
// socketId -> avatar URL for signed-in people (names stay in userSocketMap)
const userPhotoMap = {};
// socketId -> { clientId, uid } so one page never appears twice in a room
const socketMeta = {};
const roomChatHistory = {};
const roomWhiteboardState = {};
const roomProblemState = {}; // roomId -> { text, by, at }

function safeSocket(handler) {
    return async (...args) => {
        try { await handler(...args); } catch (err) { console.error("Socket Error:", err); }
    };
}

function initializeSockets(io) {
    function getAllClients(roomId) {
        return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
            return {
                socketId,
                userName: userSocketMap[socketId] || "Guest",
                photoURL: userPhotoMap[socketId] || null,
                uid: socketMeta[socketId]?.uid || null,
            };
        });
    }

    // Register this socket's page id and drop older sockets from the same page in this room.
    function claimSeat(socket, roomId, { clientId, uid } = {}) {
        const cid = typeof clientId === 'string' ? clientId.slice(0, 64) : null;
        socketMeta[socket.id] = { clientId: cid, uid: typeof uid === 'string' ? uid.slice(0, 128) : null };
        if (!cid) return;
        for (const id of io.sockets.adapter.rooms.get(roomId) || []) {
            if (id !== socket.id && socketMeta[id]?.clientId === cid) {
                socketMeta[id].replaced = true;
                io.sockets.sockets.get(id)?.disconnect(true);
            }
        }
    }

    const context = {
        claimSeat,
        userSocketMap,
        userPhotoMap,
        roomChatHistory,
        roomWhiteboardState,
        roomProblemState,
        getAllClients
    };

    io.on("connection", (socket) => {
        setupEditorSocket(io, socket, safeSocket, context);
        setupWhiteboardSocket(io, socket, safeSocket, context);
        setupProblemSocket(io, socket, safeSocket, context);
        setupMediaSocket(io, socket, safeSocket, context);

        socket.on("disconnecting", safeSocket(() => {
            [...socket.rooms].forEach(roomId => {
                if (roomId === socket.id) return;
                socket.in(roomId).emit(ACTIONS.DISCONNECTED, { socketId: socket.id, userName: userSocketMap[socket.id] || "Guest", replaced: !!socketMeta[socket.id]?.replaced });
                if (roomId.startsWith('call:')) {
                    socket.in(roomId).emit('user-left-video', { userId: socket.id });
                    return;
                }

                const remaining = getAllClients(roomId);
                if (remaining.length <= 1) {
                    delete roomChatHistory[roomId];
                    RoomRepository.isRoomGuest(roomId).then(isGuest => {
                        if (isGuest && !roomId.startsWith('project-')) RoomRepository.deleteRoomPermanently(roomId);
                    }).catch(() => { });
                }
            });
            delete userSocketMap[socket.id];
            delete userPhotoMap[socket.id];
            delete socketMeta[socket.id];
        }));
    });
}

module.exports = {
    initializeSockets
};
