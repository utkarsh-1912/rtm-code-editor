import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { CalendarPlus, CalendarDays, Clock, Copy, X, Video, Download, MoreHorizontal, Mail, Check, Pencil, Trash2 } from "lucide-react";
import { Modal } from "./ux/primitives";
import { VISIBILITY_OPTIONS } from "./RoomAccess";
import {
    scheduleMeeting, updateMeeting, deleteMeeting, listMeetings, meetingLink, icsUrl, googleCalendarUrl, outlookCalendarUrl,
    formatWhen, isJoinable, startsIn,
} from "../utils/meetings";

const DURATIONS = [15, 30, 45, 60, 90, 120];
const pad = (n) => String(n).padStart(2, "0");
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// The next half hour, at least 15 minutes from now.
function nextSlot() {
    const d = new Date(Date.now() + 15 * 60000);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    return d;
}

// "Add to calendar": Google, Outlook, or a calendar file (Apple Calendar and anything else).
export function CalendarLinks({ meeting, compact = false }) {
    return (
        <div className={`mt-cal${compact ? " mt-cal--compact" : ""}`}>
            <a className="u-btn u-btn--ghost u-btn--sm" href={googleCalendarUrl(meeting)} target="_blank" rel="noreferrer">Google</a>
            <a className="u-btn u-btn--ghost u-btn--sm" href={outlookCalendarUrl(meeting)} target="_blank" rel="noreferrer">Outlook</a>
            <a className="u-btn u-btn--ghost u-btn--sm" href={icsUrl(meeting)}><Download size={13} /> .ics</a>
        </div>
    );
}

const lengthLabel = (d) => (d < 60 ? `${d} min` : `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60} min` : ""}`);

// Host removes a meeting (asks first). Resolves true when it's gone.
export async function confirmDeleteMeeting(m) {
    const upcoming = new Date(m.startsAt).getTime() > Date.now();
    const told = upcoming && m.invitees?.length ? " Everyone invited gets a cancellation email." : "";
    if (!window.confirm(`Delete “${m.title}”?${told}`)) return false;
    try {
        await deleteMeeting(m.id);
        toast.success("Meeting deleted");
        return true;
    } catch (err) {
        toast.error(err.message);
        return false;
    }
}

// Schedule a call in a new room, or in `roomId` when given (from inside a room).
// With `meeting`, edits that meeting instead: a new time reschedules it and everyone is told.
export function ScheduleModal({ open, onClose, roomId = null, hostName, onScheduled, meeting = null }) {
    const editing = !!meeting;
    const slot = useMemo(nextSlot, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    const [title, setTitle] = useState("");
    const [date, setDate] = useState(localDate(slot));
    const [time, setTime] = useState(localTime(slot));
    const [duration, setDuration] = useState(30);
    const [access, setAccess] = useState("invite");
    const [emails, setEmails] = useState([]);
    const [draft, setDraft] = useState("");
    const [description, setDescription] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null); // { meeting, emailed }

    useEffect(() => {
        if (!open) return;
        if (meeting) {
            const at = new Date(meeting.startsAt);
            setTitle(meeting.title || ""); setDate(localDate(at)); setTime(localTime(at)); setDuration(meeting.durationMin || 30);
            setAccess(meeting.access || "invite"); setEmails(meeting.invitees || []); setDescription(meeting.description || "");
        } else {
            setTitle(""); setDate(localDate(slot)); setTime(localTime(slot)); setDuration(30); setAccess("invite");
            setEmails([]); setDescription("");
        }
        setDraft(""); setDone(null);
    }, [open, slot, meeting]);
    const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);

    const addDraft = () => {
        const parts = draft.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
        const valid = parts.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
        if (valid.length) setEmails((prev) => [...new Set([...prev, ...valid])].slice(0, 50));
        if (parts.length !== valid.length) toast.error("Some of those aren't email addresses.");
        setDraft("");
    };

    const submit = async () => {
        const startsAt = new Date(`${date}T${time}`);
        if (!title.trim()) return toast.error("Give the meeting a title.");
        if (Number.isNaN(startsAt.getTime())) return toast.error("Pick a date and time.");
        const all = draft.trim() ? [...emails, ...draft.split(/[\s,;]+/).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))] : emails;
        setBusy(true);
        try {
            const fields = {
                title: title.trim(), description, startsAt: startsAt.toISOString(), durationMin: duration,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, invitees: [...new Set(all.map((e) => e.toLowerCase()))], access,
            };
            const res = editing ? await updateMeeting(meeting.id, fields) : await scheduleMeeting({ ...fields, roomId, hostName });
            if (editing) {
                // Nothing to show after an edit: close and say who was told.
                toast.success(res.emailed ? `Saved. ${res.emailed} ${res.emailed === 1 ? "person was" : "people were"} emailed.` : "Saved");
                onScheduled?.(res.meeting);
                onClose?.();
                return;
            }
            setDone(res);
            onScheduled?.(res.meeting);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const copy = async (text) => {
        try { await navigator.clipboard.writeText(text); toast.success("Link copied"); } catch { toast.error("Couldn't copy the link"); }
    };

    if (done) {
        const m = done.meeting;
        return (
            <Modal open={open} onClose={onClose} label="Scheduled" title={m.title} description={`${formatWhen(m.startsAt)} · ${m.durationMin} min`}
                footer={<button type="button" className="u-btn u-btn--solid" onClick={onClose}>Done</button>}>
                <div className="mt-done">
                    <span className="mt-done-ico"><Check size={20} /></span>
                    <p>{m.invitees?.length ? (done.emailed ? `Invites sent to ${m.invitees.length} ${m.invitees.length === 1 ? "person" : "people"}.` : `Saved. Email invites couldn't be sent right now; share the link instead.`) : "Saved. Share the link with anyone you want to join."}</p>
                    <div className="dl-cmd"><code>{meetingLink(m)}</code><button type="button" className="u-btn u-btn--sm u-btn--solid" onClick={() => copy(meetingLink(m))}><Copy size={13} /> Copy</button></div>
                    <span className="u-label">Add to your calendar</span>
                    <CalendarLinks meeting={m} />
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            wide
            label={editing ? "Edit meeting" : roomId ? `room/${roomId}` : "New room"}
            title={editing ? "Edit call" : "Schedule a call"}
            description={editing
                ? "Change the time, people or details. Invitees are emailed: a new time counts as a reschedule, new people get an invite, removed people are told."
                : "Pick a time, invite people, and everyone gets a link and a calendar invite."}
            onSubmit={submit}
            footer={<>
                <button type="button" className="u-btn u-btn--ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="u-btn u-btn--solid" disabled={busy}>{editing ? <Check size={15} /> : <CalendarPlus size={15} />} {busy ? (editing ? "Saving…" : "Scheduling…") : editing ? "Save changes" : "Schedule"}</button>
            </>}
        >
            <div className="u-field">
                <label htmlFor="mt-title">Title</label>
                <input id="mt-title" className="u-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. System design interview" maxLength={200} />
            </div>
            <div className="mt-when">
                <div className="u-field">
                    <label htmlFor="mt-date">Date</label>
                    <input id="mt-date" type="date" className="u-input" value={date} min={localDate(new Date())} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="u-field">
                    <label htmlFor="mt-time">Time</label>
                    <input id="mt-time" type="time" className="u-input" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
                <div className="u-field">
                    <label htmlFor="mt-dur">Length</label>
                    <select id="mt-dur" className="u-select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                        {durations.map((d) => <option key={d} value={d}>{lengthLabel(d)}</option>)}
                    </select>
                </div>
            </div>
            <span className="u-small u-muted mt-tz"><Clock size={12} /> {Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")}. Invitees see it in their own time zone.</span>

            <div className="u-field">
                <label htmlFor="mt-invite">Invite <span className="u-faint">— emails, Enter or comma to add</span></label>
                <div className="u-tagbox">
                    {emails.map((e) => (
                        <span key={e} className="u-chip u-chip--mono"><Mail size={11} /> {e}
                            <button type="button" onClick={() => setEmails((prev) => prev.filter((x) => x !== e))} aria-label={`Remove ${e}`}><X size={11} /></button>
                        </span>
                    ))}
                    <input id="mt-invite" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft.trim() && addDraft()} placeholder={emails.length ? "" : "ada@company.com, alan@company.com"}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "," || e.key === ";") { e.preventDefault(); addDraft(); }
                            if (e.key === "Backspace" && !draft && emails.length) setEmails((prev) => prev.slice(0, -1));
                        }} />
                </div>
            </div>

            <div className="u-field">
                <span className="mt-label">Who can join</span>
                <div className="ra-options" role="radiogroup" aria-label="Who can join">
                    {VISIBILITY_OPTIONS.map((o) => (
                        <button key={o.id} type="button" role="radio" aria-checked={access === o.id} className={access === o.id ? "on" : ""} onClick={() => setAccess(o.id)}>
                            <o.Icon size={16} />
                            <b>{o.id === "private" ? "Invitees only" : o.label}</b>
                            <span>{o.id === "private" ? "Only the people you invite, signed in." : o.note}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="u-field">
                <label htmlFor="mt-desc">Notes <span className="u-faint">— optional</span></label>
                <textarea id="mt-desc" className="u-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Agenda, links, what to prepare" maxLength={2000} />
            </div>
        </Modal>
    );
}

// Dashboard card: upcoming calls you host or are invited to.
export function UpcomingMeetings({ user, onSchedule, refreshKey = 0 }) {
    const navigate = useNavigate();
    const [items, setItems] = useState(null);
    const [menu, setMenu] = useState(null);
    const [editing, setEditing] = useState(null);
    const [, tick] = useState(0);

    useEffect(() => {
        if (!user?.uid) return undefined;
        let live = true;
        listMeetings().then((list) => live && setItems(list)).catch(() => live && setItems([]));
        const t = setInterval(() => tick((n) => n + 1), 30000); // "in 5 min" stays fresh
        return () => { live = false; clearInterval(t); };
    }, [user?.uid, refreshKey]);

    if (!user?.uid || items === null) return null;

    const remove = async (m) => {
        if (await confirmDeleteMeeting(m)) setItems((prev) => prev.filter((x) => x.id !== m.id));
    };
    const saved = (next) => setItems((prev) => prev.map((x) => (x.id === next.id ? next : x)).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)));

    return (
        <section className="u-card mt-upcoming" data-rise aria-label="Upcoming calls">
            <div className="mt-upcoming-head">
                <span className="u-label"><CalendarDays size={13} /> Upcoming calls{items.length ? ` · ${items.length}` : ""}</span>
                <button className="u-btn u-btn--ghost u-btn--sm" onClick={onSchedule}><CalendarPlus size={14} /> Schedule</button>
            </div>
            {items.length === 0 ? (
                <p className="mt-empty">Nothing scheduled. Plan an interview or a pairing session, and everyone gets a calendar invite.</p>
            ) : (
                <ul className="mt-list">
                    {items.slice(0, 5).map((m) => {
                        const joinable = isJoinable(m);
                        return (
                            <li key={m.id} className={joinable ? "is-live" : ""}>
                                <span className="mt-date">
                                    <b>{new Date(m.startsAt).toLocaleDateString([], { day: "numeric" })}</b>
                                    <span>{new Date(m.startsAt).toLocaleDateString([], { month: "short" })}</span>
                                </span>
                                <span className="mt-main">
                                    <b className="u-ellipsis">{m.title}</b>
                                    <span className="u-mono">{formatWhen(m.startsAt)} · {m.durationMin} min · {m.isHost ? "you host" : `by ${m.hostName || "host"}`}</span>
                                </span>
                                <span className="mt-when-chip">{joinable ? "live" : startsIn(m.startsAt)}</span>
                                <button className={`u-btn u-btn--sm ${joinable ? "u-btn--solid" : "u-btn--ghost"}`} onClick={() => navigate(joinable ? `/editor/${m.roomId}` : `/meet/${m.id}`)}>
                                    {joinable ? <><Video size={13} /> Join</> : "Details"}
                                </button>
                                <span className="mt-more">
                                    <button className="u-icon" onClick={() => setMenu(menu === m.id ? null : m.id)} aria-label={`More for ${m.title}`}><MoreHorizontal size={15} /></button>
                                    {menu === m.id && (
                                        <div className="u-pop mt-pop" role="menu" onMouseLeave={() => setMenu(null)}>
                                            <a href={googleCalendarUrl(m)} target="_blank" rel="noreferrer"><CalendarPlus size={15} /> Google Calendar</a>
                                            <a href={outlookCalendarUrl(m)} target="_blank" rel="noreferrer"><CalendarPlus size={15} /> Outlook</a>
                                            <a href={icsUrl(m)}><Download size={15} /> Calendar file (.ics)</a>
                                            <button onClick={() => { navigator.clipboard?.writeText(meetingLink(m)); toast.success("Link copied"); setMenu(null); }}><Copy size={15} /> Copy link</button>
                                            {m.isHost && <>
                                                <div className="u-pop-sep" role="separator" />
                                                <button onClick={() => { setMenu(null); setEditing(m); }}><Pencil size={15} /> Edit or reschedule</button>
                                                <button className="danger" onClick={() => { setMenu(null); remove(m); }}><Trash2 size={15} /> Delete meeting</button>
                                            </>}
                                        </div>
                                    )}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
            <ScheduleModal open={!!editing} meeting={editing} onClose={() => setEditing(null)} onScheduled={saved} />
        </section>
    );
}
