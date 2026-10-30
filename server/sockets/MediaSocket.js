const ACTIONS = require('../../src/Action');
const StreamingService = require('../services/StreamingService');

function setupMediaSocket(io, socket, safeSocket, context) {
    const { userSocketMap } = context;

    // Calls get their own room, so only people actually in the call exchange media
    // (the project/room channel can have many more people who are just editing).
    const callRoom = (id) => `call:${id}`;

    // WebRTC Signaling
    socket.on('join-video-chat', safeSocket(({ projectId, name, isSpectator }) => {
        const roomId = callRoom(projectId);
        socket.join(roomId);
        // A call can run on its own socket (kept going after leaving its page), which never
        // joined the room, so remember its name here for the participant lists.
        if (name && !userSocketMap[socket.id]) userSocketMap[socket.id] = name;
        const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []).filter(id => id !== socket.id).map(id => ({
            userId: id, name: userSocketMap[id] || "Guest", isSpectator: false
        }));
        socket.emit('video-participants', { clients });
        socket.to(roomId).emit('user-joined-video', { userId: socket.id, name: name || "Guest", isSpectator });
    }));

    // After a reconnect (e.g. server restart) a socket that is still in a call re-enters the
    // call room quietly: existing peer connections keep running, and people who join later
    // are told about it and connect to it. No announcement, so nobody duplicates a peer.
    socket.on('rejoin-video-chat', safeSocket(({ projectId } = {}) => {
        if (!projectId) return;
        socket.join(callRoom(projectId));
    }));

    socket.on('request-streams', safeSocket(({ to }) => io.to(to).emit('request-streams', { from: socket.id })));
    socket.on('video-offer', safeSocket(({ to, offer }) => io.to(to).emit('video-offer', { from: socket.id, offer })));
    socket.on('video-answer', safeSocket(({ to, answer }) => io.to(to).emit('video-answer', { from: socket.id, answer })));
    socket.on('new-ice-candidate', safeSocket(({ to, candidate }) => io.to(to).emit('new-ice-candidate', { from: socket.id, candidate })));

    // Relay mute / camera / screen-share state to everyone else in the call
    socket.on(ACTIONS.MEDIA_STATE_CHANGE, safeSocket(({ roomId, state }) => {
        if (!roomId || !state) return;
        const name = userSocketMap[socket.id];
        const payload = { userId: socket.id, state: name ? { ...state, name } : state };
        socket.to(roomId).emit(ACTIONS.MEDIA_STATE_CHANGE, payload);
        socket.to(roomId).emit('media-state-update', payload);
    }));

    // Drawing + pointers over a shared screen
    socket.on('call-annotate', safeSocket(({ projectId, event }) => {
        if (!projectId || !event) return;
        socket.to(callRoom(projectId)).emit('call-annotate', { userId: socket.id, name: userSocketMap[socket.id], event });
    }));

    socket.on('leave-video-chat', safeSocket(({ projectId }) => {
        const roomId = callRoom(projectId);
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
