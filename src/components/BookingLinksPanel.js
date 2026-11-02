import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarClock, Copy, Pencil, Plus, Trash2, ExternalLink } from "lucide-react";
import { listBookingLinks, createBookingLink, updateBookingLink, deleteBookingLink, bookingUrl, allZones, localZone, zoneLabel } from "../utils/meetings";

const DAYS = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
const WORKWEEK = Object.fromEntries(DAYS.map(([d]) => [d, ["sat", "sun"].includes(d) ? [] : [["09:00", "17:00"]]]));
const LENGTHS = [15, 30, 45, 60, 90, 120];

const blank = () => ({ title: "", description: "", durationMin: 45, timeZone: localZone(), hours: WORKWEEK, daysAhead: 14, noticeMin: 240, bufferMin: 15, access: "invite", coHosts: [], active: true });

// Settings > Booking links: share a link, candidates pick a time from your weekly hours.
export default function BookingLinksPanel() {
    const [links, setLinks] = useState(null);
    const [editing, setEditing] = useState(null); // link being edited, or blank() for a new one
    const load = () => listBookingLinks().then(setLinks).catch(() => setLinks([]));
    useEffect(() => { load(); }, []);

    const copy = async (id) => {
        try { await navigator.clipboard.writeText(bookingUrl(id)); toast.success("Booking link copied"); } catch { toast.error("Couldn't copy the link"); }
    };
    const remove = async (l) => {
        if (!window.confirm(`Delete "${l.title}"? Meetings already booked stay.`)) return;
        try { await deleteBookingLink(l.id); load(); } catch (err) { toast.error(err.message); }
    };

    return (
        <div className="bl">
            <div className="bl-head">
                <div>
                    <h3>Booking links</h3>
                    <p className="u-small u-muted">Share a link and candidates pick a time from your weekly hours. Each booking creates the meeting, the room and the invitations, and never double-books your meetings.</p>
                </div>
                {!editing && <button type="button" className="u-btn u-btn--solid u-btn--sm" onClick={() => setEditing(blank())}><Plus size={14} /> New link</button>}
            </div>
            {editing && <LinkForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
            {links === null ? <div className="u-skel" style={{ height: 60 }} /> : (
                <ul className="bl-list">
                    {links.map((l) => (
                        <li key={l.id} className={l.active ? "" : "is-off"}>
                            <span className="bl-ico"><CalendarClock size={16} /></span>
                            <span className="bl-main">
                                <b>{l.title}{!l.active && <em> · paused</em>}</b>
                                <span className="u-mono">{l.durationMin} min · {l.timeZone.replace(/_/g, " ")} · {summary(l.hours)}</span>
                            </span>
                            <span className="bl-actions">
                                <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => copy(l.id)}><Copy size={13} /> Copy link</button>
                                <a className="u-icon" href={`/book/${l.id}`} target="_blank" rel="noreferrer" title="Open the booking page" aria-label="Open the booking page"><ExternalLink size={15} /></a>
                                <button type="button" className="u-icon" onClick={() => setEditing(l)} title="Edit" aria-label={`Edit ${l.title}`}><Pencil size={15} /></button>
                                <button type="button" className="u-icon" onClick={() => remove(l)} title="Delete" aria-label={`Delete ${l.title}`}><Trash2 size={15} /></button>
                            </span>
                        </li>
                    ))}
                    {!links.length && !editing && <li className="bl-empty">No booking links yet. Make one for each kind of interview, e.g. "45-min system design".</li>}
                </ul>
            )}
        </div>
    );
}

function summary(hours) {
    const on = DAYS.filter(([d]) => hours?.[d]?.length);
    if (!on.length) return "no hours set";
    const first = hours[on[0][0]][0];
    return `${on.map(([, l]) => l).join(", ")} ${first[0]}–${first[1]}`;
}

function LinkForm({ initial, onSaved, onCancel }) {
    const [f, setF] = useState(() => ({ ...initial, hours: JSON.parse(JSON.stringify(initial.hours || WORKWEEK)) }));
    const [co, setCo] = useState((initial.coHosts || []).join(", "));
    const [busy, setBusy] = useState(false);
    const zones = useMemo(() => {
        const list = allZones();
        return [...new Set([localZone(), f.timeZone, "UTC", ...list])];
    }, [f.timeZone]);
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
    const setDay = (d, on) => set("hours", { ...f.hours, [d]: on ? [["09:00", "17:00"]] : [] });
    const setRange = (d, i, which, v) => set("hours", { ...f.hours, [d]: f.hours[d].map((r, k) => (k === i ? (which ? [r[0], v] : [v, r[1]]) : r)) });

    const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const body = { ...f, coHosts: co.split(/[\s,;]+/).filter(Boolean) };
            if (initial.id) await updateBookingLink(initial.id, body); else await createBookingLink(body);
            toast.success(initial.id ? "Booking link saved" : "Booking link created. Copy it and share it.");
            onSaved();
        } catch (err) { toast.error(err.message); } finally { setBusy(false); }
    };

    return (
        <form className="bl-form" onSubmit={save}>
            <div className="bl-grid">
                <div className="u-field bl-wide"><label htmlFor="bl-title">Title</label><input id="bl-title" className="u-input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. System design interview" maxLength={200} autoFocus /></div>
                <div className="u-field"><label htmlFor="bl-len">Length</label>
                    <select id="bl-len" className="u-select" value={f.durationMin} onChange={(e) => set("durationMin", Number(e.target.value))}>{LENGTHS.map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h${m % 60 ? ` ${m % 60} min` : ""}`}</option>)}</select>
                </div>
                <div className="u-field"><label htmlFor="bl-tz">Your time zone</label>
                    <select id="bl-tz" className="u-select" value={f.timeZone} onChange={(e) => set("timeZone", e.target.value)}>{zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")} ({zoneLabel(z)})</option>)}</select>
                </div>
            </div>
            <div className="u-field">
                <span className="u-field-label">Weekly hours</span>
                <div className="bl-week">
                    {DAYS.map(([d, label]) => {
                        const ranges = f.hours[d] || [];
                        return (
                            <div key={d} className={`bl-day${ranges.length ? "" : " is-off"}`}>
                                <label className="bl-check"><input type="checkbox" checked={!!ranges.length} onChange={(e) => setDay(d, e.target.checked)} /> {label}</label>
                                {ranges.length ? ranges.map((r, i) => (
                                    <span key={i} className="bl-range">
                                        <input type="time" className="u-input" value={r[0]} onChange={(e) => setRange(d, i, 0, e.target.value)} aria-label={`${label} from`} />
                                        <span>–</span>
                                        <input type="time" className="u-input" value={r[1]} onChange={(e) => setRange(d, i, 1, e.target.value)} aria-label={`${label} until`} />
                                    </span>
                                )) : <span className="u-small u-faint">Unavailable</span>}
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="bl-grid">
                <div className="u-field"><label htmlFor="bl-ahead">Bookable up to</label>
                    <select id="bl-ahead" className="u-select" value={f.daysAhead} onChange={(e) => set("daysAhead", Number(e.target.value))}>{[7, 14, 21, 30, 60].map((d) => <option key={d} value={d}>{d} days ahead</option>)}</select>
                </div>
                <div className="u-field"><label htmlFor="bl-notice">Minimum notice</label>
                    <select id="bl-notice" className="u-select" value={f.noticeMin} onChange={(e) => set("noticeMin", Number(e.target.value))}>{[[0, "None"], [60, "1 hour"], [240, "4 hours"], [1440, "1 day"], [2880, "2 days"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </div>
                <div className="u-field"><label htmlFor="bl-buffer">Gap between meetings</label>
                    <select id="bl-buffer" className="u-select" value={f.bufferMin} onChange={(e) => set("bufferMin", Number(e.target.value))}>{[0, 10, 15, 30, 60].map((v) => <option key={v} value={v}>{v ? `${v} min` : "None"}</option>)}</select>
                </div>
            </div>
            <div className="u-field"><label htmlFor="bl-co">Co-interviewers <span className="u-faint">— emails; they join as co-organisers and their meetings count as busy</span></label>
                <input id="bl-co" className="u-input" value={co} onChange={(e) => setCo(e.target.value)} placeholder="ada@company.com, alan@company.com" />
            </div>
            <div className="u-field"><label htmlFor="bl-desc">What to expect <span className="u-faint">— shown to candidates and added to the invite</span></label>
                <textarea id="bl-desc" className="u-textarea" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
            </div>
            <div className="bl-foot">
                <label className="bl-check"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Accepting bookings</label>
                <span>
                    <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={onCancel}>Cancel</button>
                    <button type="submit" className="u-btn u-btn--solid u-btn--sm" disabled={busy}>{busy ? "Saving…" : initial.id ? "Save" : "Create link"}</button>
                </span>
            </div>
        </form>
    );
}
