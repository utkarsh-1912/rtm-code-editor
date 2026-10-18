const ACTIONS = require('../../src/Action');
const RoomRepository = require('../repositories/RoomRepository');
const setupEditorSocket = require('./EditorSocket');
const setupWhiteboardSocket = require('./WhiteboardSocket');
const setupMediaSocket = require('./MediaSocket');

const userSocketMap = {};
// socketId -> avatar URL for signed-in people (names stay in userSocketMap)
const userPhotoMap = {};
const roomChatHistory = {};
const roomWhiteboardState = {};

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
            };
        });
    }

    const context = {
        userSocketMap,
        userPhotoMap,
        roomChatHistory,
        roomWhiteboardState,
        getAllClients
    };

    io.on("connection", (socket) => {
        setupEditorSocket(io, socket, safeSocket, context);
        setupWhiteboardSocket(io, socket, safeSocket, context);
        setupMediaSocket(io, socket, safeSocket, context);

        socket.on("disconnecting", safeSocket(() => {
            [...socket.rooms].forEach(roomId => {
                if (roomId === socket.id) return;
                socket.in(roomId).emit(ACTIONS.DISCONNECTED, { socketId: socket.id, userName: userSocketMap[socket.id] || "Guest" });
                if (roomId.startsWith('project-')) socket.in(roomId).emit('user-left-video', { userId: socket.id });

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
        }));
    });
}

module.exports = {
    initializeSockets
};
