const ACTIONS = require('../../src/Action');
const RoomRepository = require('../repositories/RoomRepository');
const UserRepository = require('../repositories/UserRepository');
const ProjectRepository = require('../repositories/ProjectRepository');
const AnalyticsRepository = require('../repositories/AnalyticsRepository');

// Rooms whose "second person joined" step is already logged (once per room per server run).
const pairedRooms = new Set();

function setupEditorSocket(io, socket, safeSocket, context) {
    const { userSocketMap, userPhotoMap, roomChatHistory, getAllClients, claimSeat, pairing } = context;
    const safePhoto = (url) => (typeof url === 'string' && /^https:\/\//.test(url) ? url.slice(0, 500) : null);

    socket.on(ACTIONS.JOIN, safeSocket(async ({ roomId, userName, userProfile, clientId }) => {
        if (!roomId) return;
        const finalUserName = userName || "Guest";
        userSocketMap[socket.id] = finalUserName;
        userPhotoMap[socket.id] = safePhoto(userProfile?.photoURL);
        claimSeat(socket, roomId, { clientId, uid: userProfile?.uid });
        socket.join(roomId);
        pairing?.recompute(roomId);

        // Announce the join before touching the database so a slow or cold DB
        // never blocks people from collaborating.
        io.in(roomId).emit(ACTIONS.JOINED, { clients: getAllClients(roomId), userName: finalUserName, socketId: socket.id });
        if (roomChatHistory[roomId]) socket.emit(ACTIONS.SYNC_CHAT, { messages: roomChatHistory[roomId] });

        if (getAllClients(roomId).length >= 2 && !pairedRooms.has(roomId)) {
            pairedRooms.add(roomId);
            AnalyticsRepository.logActivity({ userId: userProfile?.uid || null, roomId, actionType: 'SECOND_USER_JOINED' }).catch(() => { });
        }

        try {
            const dbRoom = await RoomRepository.getRoom(roomId);
            if (dbRoom) {
                if (!roomChatHistory[roomId]) {
                    roomChatHistory[roomId] = dbRoom.chat_history || [];
                    socket.emit(ACTIONS.SYNC_CHAT, { messages: roomChatHistory[roomId] });
                }
                // Only seed code from the DB when nobody else is in the room to sync it live.
                if (getAllClients(roomId).length <= 1 && dbRoom.code !== null) socket.emit(ACTIONS.CODE_CHANGE, { code: dbRoom.code });
                if (dbRoom.language) socket.emit(ACTIONS.SYNC_LANGUAGE, { language: dbRoom.language });
                socket.emit('room-meta', { name: dbRoom.name || null });
            } else {
                await RoomRepository.saveRoom(roomId, "", "javascript", []);
                AnalyticsRepository.logActivity({ userId: userProfile?.uid || null, roomId, actionType: 'ROOM_STARTED' }).catch(() => { });
            }
            if (userProfile?.uid) {
                await UserRepository.findOrCreateUser(userProfile);
                await RoomRepository.linkRoomToUser(userProfile.uid, roomId);
                await RoomRepository.updateLastRoom(userProfile.uid, roomId);
            }
        } catch (err) {
            console.error("Room persistence unavailable:", err.message);
        }
    }));

    socket.on(ACTIONS.PROJECT_JOIN, safeSocket(async ({ projectId, userName, photoURL, clientId, uid }) => {
        if (!projectId) return;
        const finalUserName = userName || "Guest";
        const roomId = `project-${projectId}`;
        userSocketMap[socket.id] = finalUserName;
        userPhotoMap[socket.id] = safePhoto(photoURL);
        claimSeat(socket, roomId, { clientId, uid });
        socket.join(roomId);
        pairing?.recompute(roomId);

        const files = await ProjectRepository.getProjectFiles(projectId);
        files.forEach(file => socket.emit(ACTIONS.FILE_CHANGE, { fileId: file.id, path: file.path, content: file.content, socketId: 'server' }));

        // Chat is stored on the project; load it once per server run, then keep it in memory.
        if (!roomChatHistory[roomId]) {
            try {
                const stored = await RoomRepository.getChatHistory(roomId);
                if (stored && !roomChatHistory[roomId]) roomChatHistory[roomId] = stored;
            } catch (err) {
                console.error("Project chat unavailable:", err.message);
            }
        }
        if (roomChatHistory[roomId]) socket.emit(ACTIONS.SYNC_CHAT, { messages: roomChatHistory[roomId] });
        ProjectRepository.touchProject(projectId).catch(() => { });
        if (context.roomWhiteboardState[roomId]?.length > 0) socket.emit(ACTIONS.WHITEBOARD_SYNC, { elements: context.roomWhiteboardState[roomId] });

        const clients = getAllClients(roomId);
        io.in(roomId).emit(ACTIONS.JOINED, { clients, userName: finalUserName, socketId: socket.id });
    }));

    socket.on(ACTIONS.CODE_CHANGE, safeSocket(({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
        RoomRepository.updateRoomCode(roomId, code).catch(() => { });
    }));

    socket.on(ACTIONS.SYNC_CODE, safeSocket(({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    }));

    socket.on(ACTIONS.SYNC_LANGUAGE, safeSocket(({ roomId, language }) => {
        socket.in(roomId).emit(ACTIONS.SYNC_LANGUAGE, { language });
        RoomRepository.updateRoomLanguage(roomId, language);
    }));

    // Shared runs: everyone in the room sees "running" and the same result.
    socket.on(ACTIONS.SYNC_EXECUTE, safeSocket(({ roomId, isExecuting, by } = {}) => {
        if (!roomId || !socket.rooms.has(roomId)) return;
        socket.to(roomId).emit(ACTIONS.SYNC_EXECUTE, { isExecuting: !!isExecuting, by: String(by || '').slice(0, 40) });
    }));

    socket.on(ACTIONS.SYNC_OUTPUT, safeSocket(({ roomId, output, isError, time, meta } = {}) => {
        if (!roomId || !socket.rooms.has(roomId)) return;
        const m = meta && typeof meta === 'object' ? meta : {};
        socket.to(roomId).emit(ACTIONS.SYNC_OUTPUT, {
            output: String(output ?? '').slice(0, 64 * 1024),
            isError: !!isError,
            time: time ?? null,
            meta: {
                status: String(m.status || '').slice(0, 60),
                engine: String(m.engine || '').slice(0, 60),
                exitCode: Number.isFinite(m.exitCode) ? m.exitCode : null,
                by: String(m.by || '').slice(0, 40),
                at: Number(m.at) || Date.now(),
            },
        });
    }));

    socket.on(ACTIONS.CURSOR_MOVE, safeSocket(({ roomId, cursor, userName }) => {
        socket.in(roomId).emit(ACTIONS.CURSOR_MOVE, { cursor, userName, socketId: socket.id });
    }));

    socket.on(ACTIONS.SEND_MESSAGE, safeSocket(({ roomId, message }) => {
        if (!roomChatHistory[roomId]) roomChatHistory[roomId] = [];
        roomChatHistory[roomId].push(message);
        if (roomChatHistory[roomId].length > 50) roomChatHistory[roomId].shift();
        socket.in(roomId).emit(ACTIONS.RECEIVE_MESSAGE, message);
        RoomRepository.updateRoomChat(roomId, roomChatHistory[roomId]).catch(() => { });
    }));

    socket.on(ACTIONS.EDIT_MESSAGE, safeSocket(({ roomId, messageId, newText }) => {
        if (roomChatHistory[roomId]) {
            roomChatHistory[roomId] = roomChatHistory[roomId].map(m => m.id === messageId ? { ...m, text: newText, isEdited: true } : m);
            RoomRepository.updateRoomChat(roomId, roomChatHistory[roomId]).catch(() => { });
        }
        socket.in(roomId).emit(ACTIONS.EDIT_MESSAGE, { messageId, newText });
    }));

    socket.on(ACTIONS.DELETE_MESSAGE, safeSocket(({ roomId, messageId }) => {
        if (roomChatHistory[roomId]) {
            roomChatHistory[roomId] = roomChatHistory[roomId].filter(m => m.id !== messageId);
            RoomRepository.updateRoomChat(roomId, roomChatHistory[roomId]).catch(() => { });
        }
        socket.in(roomId).emit(ACTIONS.DELETE_MESSAGE, { messageId });
    }));

    socket.on(ACTIONS.LEAVE, safeSocket(async ({ roomId }) => {
        socket.in(roomId).emit(ACTIONS.DISCONNECTED, { socketId: socket.id, userName: userSocketMap[socket.id] || "Guest" });
        pairing?.close(socket.id);
        socket.leave(roomId);
        pairing?.recompute(roomId);
        // Guest rooms are cleaned up by jobs/cleanup.js after a few idle hours, not here.
        if (getAllClients(roomId).length === 0) delete roomChatHistory[roomId];
    }));
}

module.exports = setupEditorSocket;
