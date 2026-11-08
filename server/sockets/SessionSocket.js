const ACTIONS = require('../../src/Action');
const CodeRecorder = require('../services/CodeRecorder');

// Working together in a room: "Follow me" (one presenter; everyone else's editor scrolls with
// theirs until they stop following) and a shared session timer everyone sees count down.
const follow = {}; // roomId -> { socketId, userName }
const timers = {}; // roomId -> { label, endsAt, minutes, by }

const MAX_MIN = 240;

function setupSessionSocket(io, socket, safeSocket) {
    const inRoom = (roomId) => typeof roomId === 'string' && socket.rooms.has(roomId);
    const state = (roomId) => ({ follow: follow[roomId] || null, timer: timers[roomId] || null });

    socket.on(ACTIONS.SESSION_SYNC_REQUEST, safeSocket(({ roomId } = {}) => {
        if (!inRoom(roomId)) return;
        socket.emit(ACTIONS.SESSION_SYNC, state(roomId));
    }));

    // { on: true } makes this socket the presenter (taking over from anyone else).
    socket.on(ACTIONS.FOLLOW_MODE, safeSocket(({ roomId, on, userName } = {}) => {
        if (!inRoom(roomId)) return;
        if (on) follow[roomId] = { socketId: socket.id, userName: String(userName || 'Someone').slice(0, 60) };
        else if (follow[roomId]?.socketId === socket.id) delete follow[roomId];
        else return;
        io.to(roomId).emit(ACTIONS.SESSION_SYNC, state(roomId));
    }));

    // The presenter's view: the top line on screen and the cursor line. Only the presenter's count.
    socket.on(ACTIONS.SYNC_SCROLL, safeSocket(({ roomId, topLine, cursorLine } = {}) => {
        if (!inRoom(roomId) || follow[roomId]?.socketId !== socket.id) return;
        socket.to(roomId).emit(ACTIONS.SYNC_SCROLL, {
            topLine: Math.max(1, Math.round(Number(topLine) || 1)),
            cursorLine: Math.max(1, Math.round(Number(cursorLine) || 1)),
            socketId: socket.id,
        });
    }));

    // A sizeable paste in the editor: marked on the playback when a meeting is recording.
    socket.on(ACTIONS.CODE_PASTE, safeSocket(({ roomId, chars, by } = {}) => {
        if (!inRoom(roomId)) return;
        CodeRecorder.onPaste(roomId, { chars, by }).catch(() => { });
    }));

    // Live captions: one person's speech as text, passed on to the room (at most ~5 a second).
    let lastCaption = 0;
    socket.on(ACTIONS.CAPTION, safeSocket(({ roomId, text, final, name } = {}) => {
        if (!inRoom(roomId)) return;
        const now = Date.now();
        if (!final && now - lastCaption < 200) return;
        lastCaption = now;
        socket.to(roomId).emit(ACTIONS.CAPTION, {
            socketId: socket.id, name: String(name || 'Someone').slice(0, 60), text: String(text || '').slice(0, 300), final: !!final,
        });
    }));

    // { minutes, label } starts it; { minutes: 0 } stops it.
    socket.on(ACTIONS.SESSION_TIMER, safeSocket(({ roomId, minutes, label, userName } = {}) => {
        if (!inRoom(roomId)) return;
        const m = Math.min(MAX_MIN, Math.max(0, Number(minutes) || 0));
        if (m > 0) {
            timers[roomId] = {
                label: String(label || '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Timer',
                minutes: m, endsAt: Date.now() + m * 60000, by: String(userName || 'Someone').slice(0, 60),
            };
        } else delete timers[roomId];
        io.to(roomId).emit(ACTIONS.SESSION_SYNC, state(roomId));
    }));

    socket.on('disconnecting', safeSocket(() => {
        for (const roomId of socket.rooms) {
            if (follow[roomId]?.socketId === socket.id) {
                delete follow[roomId];
                socket.to(roomId).emit(ACTIONS.SESSION_SYNC, state(roomId));
            }
        }
    }));
    socket.on(ACTIONS.LEAVE, safeSocket(({ roomId } = {}) => {
        if (follow[roomId]?.socketId === socket.id) {
            delete follow[roomId];
            socket.to(roomId).emit(ACTIONS.SESSION_SYNC, state(roomId));
        }
    }));
}

// Timers for rooms nobody is in any more are dropped now and then.
setInterval(() => {
    const now = Date.now();
    for (const [roomId, t] of Object.entries(timers)) if (t.endsAt < now - 60 * 60000) delete timers[roomId];
}, 10 * 60000).unref?.();

module.exports = setupSessionSocket;
