const ACTIONS = require('../../src/Action');
const RoomRepository = require('../repositories/RoomRepository');
const UserRepository = require('../repositories/UserRepository');
const ProjectRepository = require('../repositories/ProjectRepository');

function setupEditorSocket(io, socket, safeSocket, context) {
    const { userSocketMap, userPhotoMap, roomChatHistory, getAllClients, claimSeat } = context;
    const safePhoto = (url) => (typeof url === 'string' && /^https:\/\//.test(url) ? url.slice(0, 500) : null);

    socket.on(ACTIONS.JOIN, safeSocket(async ({ roomId, userName, userProfile, clientId }) => {
        if (!roomId) return;
        const finalUserName = userName || "Guest";
        userSocketMap[socket.id] = finalUserName;
        userPhotoMap[socket.id] = safePhoto(userProfile?.photoURL);
        claimSeat(socket, roomId, { clientId, uid: userProfile?.uid });
        socket.join(roomId);

        // Announce the join before touching the database so a slow or cold DB
        // never blocks people from collaborating.
        io.in(roomId).emit(ACTIONS.JOINED, { clients: getAllClients(roomId), userName: finalUserName, socketId: socket.id });
        if (roomChatHistory[roomId]?.length > 0) socket.emit(ACTIONS.SYNC_CHAT, { messages: roomChatHistory[roomId] });

        try {
            const dbRoom = await RoomRepository.getRoom(roomId);
            if (dbRoom) {
                if (!roomChatHistory[roomId]) {
                    roomChatHistory[roomId] = dbRoom.chat_history || [];
                    if (roomChatHistory[roomId].length) socket.emit(ACTIONS.SYNC_CHAT, { messages: roomChatHistory[roomId] });
                }
                // Only seed code from the DB when nobody else is in the room to sync it live.
                if (getAllClients(roomId).length <= 1 && dbRoom.code !== null) socket.emit(ACTIONS.CODE_CHANGE, { code: dbRoom.code });
                if (dbRoom.language) socket.emit(ACTIONS.SYNC_LANGUAGE, { language: dbRoom.language });
            } else {
                await RoomRepository.saveRoom(roomId, "", "javascript", []);
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

        const files = await ProjectRepository.getProjectFiles(projectId);
        files.forEach(file => socket.emit(ACTIONS.FILE_CHANGE, { fileId: file.id, path: file.path, content: file.content, socketId: 'server' }));

        if (roomChatHistory[roomId]?.length > 0) socket.emit(ACTIONS.SYNC_CHAT, { messages: roomChatHistory[roomId] });
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

    socket.on(ACTIONS.CURSOR_MOVE, safeSocket(({ roomId, cursor, userName }) => {
        socket.in(roomId).emit(ACTIONS.CURSOR_MOVE, { cursor, userName, socketId: socket.id });
    }));

    socket.on(ACTIONS.SEND_MESSAGE, safeSocket(({ roomId, message }) => {
        if (!roomChatHistory[roomId]) roomChatHistory[roomId] = [];
        roomChatHistory[roomId].push(message);
        if (roomChatHistory[roomId].length > 50) roomChatHistory[roomId].shift();
        socket.in(roomId).emit(ACTIONS.RECEIVE_MESSAGE, message);
        RoomRepository.updateRoomChat(roomId, roomChatHistory[roomId]);
    }));

    socket.on(ACTIONS.EDIT_MESSAGE, safeSocket(({ roomId, messageId, newText }) => {
        if (roomChatHistory[roomId]) roomChatHistory[roomId] = roomChatHistory[roomId].map(m => m.id === messageId ? { ...m, text: newText, isEdited: true } : m);
        socket.in(roomId).emit(ACTIONS.EDIT_MESSAGE, { messageId, newText });
    }));

    socket.on(ACTIONS.DELETE_MESSAGE, safeSocket(({ roomId, messageId }) => {
        if (roomChatHistory[roomId]) roomChatHistory[roomId] = roomChatHistory[roomId].filter(m => m.id !== messageId);
        socket.in(roomId).emit(ACTIONS.DELETE_MESSAGE, { messageId });
    }));

    socket.on(ACTIONS.LEAVE, safeSocket(async ({ roomId }) => {
        socket.in(roomId).emit(ACTIONS.DISCONNECTED, { socketId: socket.id, userName: userSocketMap[socket.id] || "Guest" });
        socket.leave(roomId);
        const remaining = getAllClients(roomId);
        if (remaining.length === 0) {
            delete roomChatHistory[roomId];
            const isGuest = await RoomRepository.isRoomGuest(roomId);
            if (isGuest && !roomId.startsWith('project-')) await RoomRepository.deleteRoomPermanently(roomId);
        }
    }));
}

module.exports = setupEditorSocket;
