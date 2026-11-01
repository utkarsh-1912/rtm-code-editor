import { getBackendUrl, publicOrigin } from "./api";
import { auth } from "../firebase";

// Scheduled meetings: API calls (with the sign-in token) and "add to calendar" links.

async function headers(extra = {}) {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function call(path, { method = "GET", body } = {}) {
    const res = await fetch(`${getBackendUrl()}/api${path}`, {
        method,
        headers: await headers(body ? { "Content-Type": "application/json" } : {}),
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}

export const scheduleMeeting = (body) => call("/meetings", { method: "POST", body });
export const listMeetings = () => call("/meetings");
export const getMeeting = (id) => call(`/meetings/${encodeURIComponent(id)}`);
export const updateMeeting = (id, body) => call(`/meetings/${encodeURIComponent(id)}`, { method: "PATCH", body });
export const deleteMeeting = (id) => call(`/meetings/${encodeURIComponent(id)}`, { method: "DELETE" });
export const listPastMeetings = () => call("/meetings?past=1");
// Organisers only: the room's meeting, private notes, co-organisers, snapshots, ending it.
const mid = (id) => `/meetings/${encodeURIComponent(id)}`;
export const roomMeeting = (roomId) => call(`/meetings/room/${encodeURIComponent(roomId)}`);
export const saveMeetingNotes = (id, notes) => call(`${mid(id)}/notes`, { method: "PUT", body: { notes } });
export const saveCoHosts = (id, coHosts) => call(`${mid(id)}/co-hosts`, { method: "PUT", body: { coHosts } });
export const listSnapshots = (id) => call(`${mid(id)}/snapshots`);
export const takeSnapshot = (id, body = {}) => call(`${mid(id)}/snapshots`, { method: "POST", body });
export const updateSnapshot = (id, sid, body) => call(`${mid(id)}/snapshots/${sid}`, { method: "PATCH", body });
export const deleteSnapshot = (id, sid) => call(`${mid(id)}/snapshots/${sid}`, { method: "DELETE" });
export const endMeeting = (id, body = {}) => call(`${mid(id)}/end`, { method: "POST", body });
// Invitees answer "yes" / "no" (signed in with the invited address).
export const rsvpMeeting = (id, answer) => call(`${mid(id)}/rsvp`, { method: "POST", body: { answer } });

// --- Time zones --------------------------------------------------------------------------------
export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export const allZones = () => {
    try { return Intl.supportedValuesOf("timeZone"); } catch { return [localZone(), "UTC"]; }
};
const zoneParts = (t, tz) => Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
}).formatToParts(new Date(t)).map((p) => [p.type, p.value]));
// How far `tz` is ahead of UTC at instant `t`, in ms.
const zoneOffset = (t, tz) => {
    const p = zoneParts(t, tz);
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
};
// "2026-11-03" + "16:30" on the clock in `tz` -> the real instant.
export function zonedToDate(date, time, tz) {
    const [y, mo, d] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    const wall = Date.UTC(y, mo - 1, d, h, mi);
    let t = wall - zoneOffset(wall, tz);
    t = wall - zoneOffset(t, tz); // second pass settles daylight-saving edges
    return new Date(t);
}
// An instant as date + time strings on the clock in `tz` (for the date and time inputs).
export function dateInZone(at, tz) {
    const p = zoneParts(new Date(at).getTime(), tz);
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${String(+p.hour % 24).padStart(2, "0")}:${p.minute}` };
}
// "GMT+5:30" style label for a zone right now.
export function zoneLabel(tz, at = Date.now()) {
    const off = Math.round(zoneOffset(new Date(at).getTime(), tz) / 60000);
    const sign = off < 0 ? "-" : "+";
    const a = Math.abs(off);
    return `GMT${sign}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, "0")}` : ""}`;
}

export const meetingLink = (m) => `${publicOrigin()}/meet/${m.id}`;
export const icsUrl = (m) => `${getBackendUrl()}/api/meetings/${encodeURIComponent(m.id)}/ics`;

const endOf = (m) => new Date(new Date(m.startsAt).getTime() + m.durationMin * 60000);
const gDate = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export const googleCalendarUrl = (m) => {
    const p = new URLSearchParams({
        action: "TEMPLATE",
        text: m.title,
        dates: `${gDate(m.startsAt)}/${gDate(endOf(m))}`,
        details: `${m.description ? `${m.description}\n\n` : ""}Join: ${meetingLink(m)}`,
        location: meetingLink(m),
    });
    return `https://calendar.google.com/calendar/render?${p}`;
};

export const outlookCalendarUrl = (m) => {
    const p = new URLSearchParams({
        path: "/calendar/action/compose",
        rru: "addevent",
        subject: m.title,
        startdt: new Date(m.startsAt).toISOString(),
        enddt: endOf(m).toISOString(),
        body: `${m.description ? `${m.description}\n\n` : ""}Join: ${meetingLink(m)}`,
        location: meetingLink(m),
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${p}`;
};

// "Today 4:30 PM", "Tomorrow 9:00 AM", "Mon 12 Oct, 2:00 PM" in the viewer's time zone.
export function formatWhen(startsAt) {
    const d = new Date(startsAt);
    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((day(d) - day(now)) / 86400000);
    if (diffDays === 0) return `Today ${time}`;
    if (diffDays === 1) return `Tomorrow ${time}`;
    return `${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

// Joinable from 10 minutes before the start until it ends.
export const isJoinable = (m, now = Date.now()) => !m.cancelled && !m.endedAt && now >= new Date(m.startsAt).getTime() - 10 * 60000 && now <= endOf(m).getTime();
export const isOver = (m, now = Date.now()) => !!m.endedAt || now > endOf(m).getTime();

export function startsIn(startsAt, now = Date.now()) {
    const mins = Math.round((new Date(startsAt).getTime() - now) / 60000);
    if (mins <= 0) return "now";
    if (mins < 60) return `in ${mins} min`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `in ${h} h${mins % 60 ? ` ${mins % 60} min` : ""}`;
    const d = Math.round(h / 24);
    return `in ${d} day${d === 1 ? "" : "s"}`;
}
