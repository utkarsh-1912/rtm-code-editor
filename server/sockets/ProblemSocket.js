const ACTIONS = require('../../src/Action');
const RoomRepository = require('../repositories/RoomRepository');

// The room's "Problem" panel: the question being solved, pasted by anyone in the room, and the
// example tests that came with it (shown in the Input/Output panel). Kept in memory per room and
// saved to the room (a moment after the last edit), so it survives restarts and a kit or
// scheduled meeting can set it up before anyone arrives.
const saveTimers = {};
const MAX_PROBLEM = 20 * 1024;

// [{ input, output }], at most 10, each part at most 5,000 characters.
const cleanTests = (tests) => (Array.isArray(tests) ? tests : []).slice(0, 10)
    .map((t) => ({ input: String(t?.input ?? '').slice(0, 5000), output: String(t?.output ?? '').slice(0, 5000) }))
    .filter((t) => t.input || t.output);

// A contest the room is working through: { title, source, url, index, problems: [{ label, title, url }] }.
const okUrl = (u) => /^https:\/\/(www\.)?(leetcode\.com|leetcode\.cn|codeforces\.com)\//i.test(String(u || ''));
function cleanSeries(s) {
    if (!s || !Array.isArray(s.problems) || !s.problems.length) return null;
    const problems = s.problems.slice(0, 30).filter((p) => okUrl(p?.url)).map((p) => ({
        label: String(p.label || '').slice(0, 8), title: String(p.title || '').slice(0, 160), url: String(p.url).slice(0, 300),
    }));
    if (!problems.length) return null;
    return {
        title: String(s.title || '').slice(0, 160), source: String(s.source || '').slice(0, 20), url: okUrl(s.url) ? String(s.url).slice(0, 300) : '',
        index: Math.min(problems.length - 1, Math.max(0, Math.round(Number(s.index) || 0))), problems,
    };
}

function setupProblemSocket(io, socket, safeSocket, context) {
    const { roomProblemState } = context;

    // `tests` is optional: typing in the problem keeps the examples; an import or a clear sets them.
    socket.on(ACTIONS.PROBLEM_CHANGE, safeSocket(({ roomId, text, by, tests, series } = {}) => {
        if (!roomId || !socket.rooms.has(roomId)) return;
        const clean = String(text ?? '').slice(0, MAX_PROBLEM);
        const prev = roomProblemState[roomId] || {};
        const nextTests = tests !== undefined ? cleanTests(tests) : (clean ? prev.tests || [] : []);
        const nextSeries = series !== undefined ? cleanSeries(series) : (clean ? prev.series || null : null);
        roomProblemState[roomId] = { text: clean, by: String(by || '').slice(0, 40), at: Date.now(), tests: nextTests, series: nextSeries };
        socket.to(roomId).emit(ACTIONS.PROBLEM_CHANGE, roomProblemState[roomId]);
        clearTimeout(saveTimers[roomId]);
        saveTimers[roomId] = setTimeout(() => {
            delete saveTimers[roomId];
            RoomRepository.setRoomProblem(roomId, clean, nextTests, nextSeries).catch(() => { });
        }, 1500);
    }));

    socket.on(ACTIONS.PROBLEM_SYNC_REQUEST, safeSocket(({ roomId } = {}) => {
        if (!roomId || !socket.rooms.has(roomId)) return;
        if (roomProblemState[roomId]) return socket.emit(ACTIONS.PROBLEM_SYNC, roomProblemState[roomId]);
        RoomRepository.getRoomProblemState(roomId).then(({ text, tests, series }) => {
            if (text && !roomProblemState[roomId]) roomProblemState[roomId] = { text, by: '', at: Date.now(), tests, series };
            socket.emit(ACTIONS.PROBLEM_SYNC, roomProblemState[roomId] || { text: '', by: '', at: 0, tests: [] });
        }).catch(() => socket.emit(ACTIONS.PROBLEM_SYNC, { text: '', by: '', at: 0, tests: [] }));
    }));
}

module.exports = setupProblemSocket;
module.exports.cleanTests = cleanTests;
module.exports.cleanSeries = cleanSeries;
