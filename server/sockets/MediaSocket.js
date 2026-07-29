const ACTIONS = require('../../src/Action');
const StreamingService = require('../services/StreamingService');

function setupMediaSocket(io, socket, safeSocket, context) {
    const { userSocketMap } = context;

    // WebRTC Signaling
    socket.on('join-video-chat', safeSocket(({ projectId, name, isSpectator }) => {
        const roomId = `project-${projectId}`;
        socket.join(roomId);
        const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []).filter(id => id !== socket.id).map(id => ({
            userId: id, name: userSocketMap[id] || "Guest", isSpectator: false
        }));
        socket.emit('video-participants', { clients });
        socket.to(roomId).emit('user-joined-video', { userId: socket.id, name: name || "Guest", isSpectator });
    }));

    socket.on('request-streams', safeSocket(({ to }) => io.to(to).emit('request-streams', { from: socket.id })));
    socket.on('video-offer', safeSocket(({ to, offer }) => io.to(to).emit('video-offer', { from: socket.id, offer })));
    socket.on('video-answer', safeSocket(({ to, answer }) => io.to(to).emit('video-answer', { from: socket.id, answer })));
    socket.on('new-ice-candidate', safeSocket(({ to, candidate }) => io.to(to).emit('new-ice-candidate', { from: socket.id, candidate })));

    socket.on('leave-video-chat', safeSocket(({ projectId }) => {
        const roomId = `project-${projectId}`;
        socket.leave(roomId);
        socket.to(roomId).emit('user-left-video', { userId: socket.id });
    }));

    socket.on(ACTIONS.SCREEN_SHARE_STOP, safeSocket(({ roomId }) => {
        socket.to(roomId).emit(ACTIONS.SCREEN_SHARE_STOP, { userId: socket.id });
    }));

    // RTMP Streaming
    socket.on(ACTIONS.START_STREAMING, safeSocket(({ projectId, rtmpKey }) => {
        StreamingService.startStream(projectId, rtmpKey);
    }));

    socket.on(ACTIONS.STREAM_DATA, safeSocket(({ projectId, chunk }) => {
        StreamingService.writeStreamChunk(projectId, chunk);
    }));

    socket.on(ACTIONS.STOP_STREAMING, safeSocket(({ projectId }) => {
        StreamingService.stopStream(projectId);
    }));
}

module.exports = setupMediaSocket;
