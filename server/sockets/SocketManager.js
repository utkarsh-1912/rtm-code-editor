const ACTIONS = require('../../src/Action');
const setupEditorSocket = require('./EditorSocket');
const setupWhiteboardSocket = require('./WhiteboardSocket');
const setupProblemSocket = require('./ProblemSocket');
const setupMediaSocket = require('./MediaSocket');
const { createPairingTracker } = require('./pairingTracker');
const { createRoomAccess } = require('./RoomAccess');

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

    const pairing = createPairingTracker(io, socketMeta);
    const access = createRoomAccess(io);
    io.roomAccess = access; // routes that change a room's access drop its cached copy

    // Events that act on a room only count from sockets that are in that room. Socket.IO lets
    // any socket send to any room by name, so without this a private room is only private
    // until someone guesses its id.
    const ROOM_EVENTS = new Set([
        ACTIONS.CODE_CHANGE, ACTIONS.SYNC_LANGUAGE, ACTIONS.SEND_MESSAGE, ACTIONS.EDIT_MESSAGE, ACTIONS.DELETE_MESSAGE,
        ACTIONS.CURSOR_MOVE, ACTIONS.WHITEBOARD_DRAW, ACTIONS.WHITEBOARD_SYNC_REQUEST, ACTIONS.WHITEBOARD_CURSOR,
        ACTIONS.PROBLEM_CHANGE, ACTIONS.PROBLEM_SYNC_REQUEST, ACTIONS.SYNC_EXECUTE, ACTIONS.SYNC_OUTPUT,
    ]);
    const inRoom = (socket, roomId) => typeof roomId === 'string' && socket.rooms.has(roomId);

    const context = {
        io,
        pairing,
        claimSeat,
        userSocketMap,
        userPhotoMap,
        roomChatHistory,
        roomWhiteboardState,
        roomProblemState,
        getAllClients,
        access,
    };

    io.on("connection", (socket) => {
        socket.use(([event, payload], next) => {
            if (ROOM_EVENTS.has(event) && !inRoom(socket, payload?.roomId)) return; // dropped
            if (event === 'join-video-chat' || event === 'rejoin-video-chat') {
                const id = payload?.projectId;
                if (id == null || !(inRoom(socket, String(id)) || inRoom(socket, `project-${id}`))) return;
            }
            next();
        });
        setupEditorSocket(io, socket, safeSocket, context);
        setupWhiteboardSocket(io, socket, safeSocket, context);
        setupProblemSocket(io, socket, safeSocket, context);
        setupMediaSocket(io, socket, safeSocket, context);

        socket.on("disconnecting", safeSocket(() => {
            pairing.close(socket.id);
            [...socket.rooms].forEach(roomId => {
                if (roomId === socket.id) return;
                pairing.recompute(roomId, socket.id);
                socket.in(roomId).emit(ACTIONS.DISCONNECTED, { socketId: socket.id, userName: userSocketMap[socket.id] || "Guest", replaced: !!socketMeta[socket.id]?.replaced });
                if (roomId.startsWith('call:')) {
                    socket.in(roomId).emit('user-left-video', { userId: socket.id });
                    return;
                }

                const remaining = getAllClients(roomId);
                // Last person out: free the in-memory chat (it's in the database). Guest rooms
                // are not deleted here; a refresh would wipe them. jobs/cleanup.js removes
                // unused guest rooms after GUEST_ROOM_TTL_HOURS.
                if (remaining.length <= 1) delete roomChatHistory[roomId];
            });
            access.drop(socket);
            delete userSocketMap[socket.id];
            delete userPhotoMap[socket.id];
            delete socketMeta[socket.id];
        }));
    });
}

module.exports = {
    initializeSockets,
    roomState: { roomChatHistory, roomWhiteboardState, roomProblemState },
};
