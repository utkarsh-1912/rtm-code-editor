// The interviewer-only side panel of a scheduled meeting: a chat the candidate never sees.
// Only sockets signed in as an organiser of that meeting (host or co-organiser) can join it.
const MeetingRepository = require('../repositories/MeetingRepository');
const InterviewRepository = require('../repositories/InterviewRepository');

const panelRoom = (id) => `panel:${id}`;

function setupInterviewSocket(io, socket, safeSocket, context) {
    const { access, userSocketMap } = context;
    const { isOrganiser } = require('../routes/meetingRoutes');

    socket.on('panel-join', safeSocket(async ({ meetingId } = {}) => {
        const m = meetingId && await MeetingRepository.getMeeting(String(meetingId));
        const who = access.whoIs(socket.id);
        if (!m || !who || !isOrganiser(m, who)) { socket.emit('panel-denied', { meetingId }); return; }
        socket.join(panelRoom(m.id));
        const messages = await InterviewRepository.panelMessages(m.id);
        socket.emit('panel-history', { meetingId: m.id, messages: messages.map(view) });
    }));

    socket.on('panel-send', safeSocket(async ({ meetingId, text } = {}) => {
        const id = String(meetingId || '');
        if (!socket.rooms.has(panelRoom(id))) return; // joined (and checked) first
        const clean = String(text || '').replace(/\s+$/, '').slice(0, 2000);
        if (!clean.trim()) return;
        const who = access.whoIs(socket.id);
        const author = userSocketMap[socket.id] || who?.email || 'Interviewer';
        const row = await InterviewRepository.addPanelMessage(id, String(author).slice(0, 120), clean);
        io.to(panelRoom(id)).emit('panel-message', { meetingId: id, message: view(row) });
    }));

    socket.on('panel-leave', safeSocket(({ meetingId } = {}) => socket.leave(panelRoom(String(meetingId || '')))));
}

const view = (r) => ({ id: r.id, author: r.author, text: r.text, at: r.created_at });

module.exports = setupInterviewSocket;
