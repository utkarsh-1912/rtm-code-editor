// Code playback for scheduled meetings: while a meeting is on, the room's code is recorded so
// organisers can replay how the solution was written. At most one frame every 2 seconds, and
// each frame only holds what changed: the lines replaced in the middle of the file
// ({ s: first line, d: lines removed, i: lines inserted }), or the whole text ({ full }) when
// there's nothing to compare with yet (first frame, or after a server restart).
const InterviewRepository = require('../repositories/InterviewRepository');

const EVERY_MS = 2000;
const ROOM_CHECK_MS = 60 * 1000;

const roomMeeting = new Map(); // roomId -> { meetingId, at }
const state = new Map(); // meetingId -> { last, lastAt, pending, timer }

async function meetingFor(roomId) {
    const hit = roomMeeting.get(roomId);
    if (hit && Date.now() - hit.at < ROOM_CHECK_MS) return hit.meetingId;
    const meetingId = await InterviewRepository.liveMeetingForRoom(roomId).catch(() => null);
    roomMeeting.set(roomId, { meetingId, at: Date.now() });
    return meetingId;
}

// The change from one version to the next as a single block of lines.
function delta(before, after) {
    if (before === undefined) return { full: after };
    if (before === after) return null;
    const a = before.split('\n'), b = after.split('\n');
    let p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    let s = 0;
    while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    return { s: p, d: a.length - p - s, i: b.slice(p, b.length - s) };
}

async function write(meetingId) {
    const st = state.get(meetingId);
    if (!st || st.pending === undefined) return;
    const code = st.pending;
    st.pending = undefined;
    st.timer = null;
    const frame = delta(st.last, code);
    st.lastAt = Date.now();
    if (!frame) return;
    st.last = code;
    st.writing = InterviewRepository.addFrame(meetingId, frame).catch(() => { });
    await st.writing;
}

async function onCode(roomId, code) {
    if (typeof code !== 'string' || code.length > 500000) return;
    const meetingId = await meetingFor(roomId);
    if (!meetingId) return;
    let st = state.get(meetingId);
    if (!st) { st = { last: undefined, lastAt: 0, pending: undefined, timer: null }; state.set(meetingId, st); }
    st.pending = code;
    const wait = st.lastAt + EVERY_MS - Date.now();
    if (wait <= 0 && !st.timer) write(meetingId);
    else if (!st.timer) st.timer = setTimeout(() => write(meetingId), Math.max(0, wait));
}

// A meeting ended: flush what's pending and forget it.
async function finish(meetingId) {
    const st = state.get(meetingId);
    if (st?.timer) clearTimeout(st.timer);
    await st?.writing; // a frame still being saved
    await write(meetingId);
    state.delete(meetingId);
    for (const [roomId, v] of roomMeeting) if (v.meetingId === meetingId) roomMeeting.delete(roomId);
}

// A sizeable paste during a meeting: a marker on the playback timeline ({ paste, by }).
async function onPaste(roomId, { chars, by }) {
    const n = Math.round(Number(chars) || 0);
    if (n < 40) return;
    const meetingId = await meetingFor(roomId);
    if (!meetingId) return;
    await InterviewRepository.addFrame(meetingId, { paste: Math.min(n, 1e6), by: String(by || '').slice(0, 60) }).catch(() => { });
}

module.exports = { onCode, onPaste, finish, delta };
