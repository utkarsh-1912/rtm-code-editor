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
export const cancelMeeting = (id) => call(`/meetings/${encodeURIComponent(id)}`, { method: "DELETE" });

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
export const isJoinable = (m, now = Date.now()) => !m.cancelled && now >= new Date(m.startsAt).getTime() - 10 * 60000 && now <= endOf(m).getTime();
export const isOver = (m, now = Date.now()) => now > endOf(m).getTime();

export function startsIn(startsAt, now = Date.now()) {
    const mins = Math.round((new Date(startsAt).getTime() - now) / 60000);
    if (mins <= 0) return "now";
    if (mins < 60) return `in ${mins} min`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `in ${h} h${mins % 60 ? ` ${mins % 60} min` : ""}`;
    const d = Math.round(h / 24);
    return `in ${d} day${d === 1 ? "" : "s"}`;
}
