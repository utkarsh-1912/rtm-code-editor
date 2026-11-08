import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Camera, Copy, ChevronDown, ChevronRight, Lock, Mail, Power, Trash2, UserPlus, X, Flag } from "lucide-react";
import { Modal } from "./ux/primitives";
import { lineDiff, withContext } from "../utils/lineDiff";
import InterviewFeedback from "./InterviewFeedback";
import CodePlayback from "./CodePlayback";
import { setAiPolicy, getGuestFeedback } from "../utils/meetings";
import {
    saveMeetingNotes, saveCoHosts, listSnapshots, updateSnapshot, deleteSnapshot, endMeeting,
} from "../utils/meetings";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clock = (d) => new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const day = (d) => new Date(d).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

// Saves after typing stops; reports "saving" / "saved" / "error".
function useAutosave(value, save, delay = 800) {
    const [state, setState] = useState("idle");
    const saved = useRef(value); // last value known to be on the server
    const saveRef = useRef(save);
    saveRef.current = save;
    const pending = useRef(null); // { value } typed but not sent yet
    useEffect(() => {
        if (value === saved.current) { pending.current = null; return undefined; }
        setState("dirty");
        pending.current = { value };
        const t = setTimeout(async () => {
            pending.current = null;
            setState("saving");
            try { await saveRef.current(value); saved.current = value; setState("saved"); } catch { setState("error"); }
        }, delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    // Leaving the page (or this card) before the pause: send what was typed anyway.
    useEffect(() => () => {
        if (pending.current) Promise.resolve(saveRef.current(pending.current.value)).catch(() => { });
    }, []);
    return state;
}

const SaveState = ({ state }) => (
    <span className={`mo-save${state === "error" ? " is-bad" : ""}`}>
        {state === "saving" || state === "dirty" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Not saved, retrying on next edit" : ""}
    </span>
);

// Ask before ending: it removes everyone else's access at once.
export function EndMeetingModal({ open, meeting, onClose, onEnded, code, language, takenBy }) {
    const [busy, setBusy] = useState(false);
    const end = async () => {
        setBusy(true);
        try {
            const res = await endMeeting(meeting.id, { code, language, takenBy });
            toast.success(res.removed ? `Meeting ended. ${res.removed} ${res.removed === 1 ? "person was" : "people were"} removed from the room.` : "Meeting ended. The room is now organisers only.", { id: "meeting-ended" });
            onEnded?.(res.meeting);
            onClose();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal open={open} onClose={onClose} label="End meeting" title="End the meeting for everyone?"
            description="Everyone except organisers leaves the room and loses access right away."
            footer={<>
                <button type="button" className="u-btn u-btn--ghost" onClick={onClose}>Keep it going</button>
                <button type="button" className="u-btn u-btn--danger" onClick={end} disabled={busy}><Power size={15} /> {busy ? "Ending…" : "End meeting"}</button>
            </>}>
            <ul className="mo-list-plain">
                <li><Camera size={14} /> A final snapshot of the code is saved for review.</li>
                <li><Lock size={14} /> The room becomes private: this meeting's guests lose access; you{meeting?.coHosts?.length ? " and co-organisers" : ""} keep it.</li>
                <li><Flag size={14} /> Invitees see that the meeting has ended.</li>
            </ul>
        </Modal>
    );
}

// What changed since the snapshot before: added and removed lines, with a little context.
function SnapshotDiff({ before, after }) {
    const rows = useMemo(() => lineDiff(before.code || "", after.code || ""), [before.code, after.code]);
    const added = rows.filter((r) => r.type === "add").length;
    const removed = rows.filter((r) => r.type === "del").length;
    if (!added && !removed) return <pre><em>No changes since the snapshot before.</em></pre>;
    return (
        <>
            <div className="mo-diff-sum"><span className="is-add">+{added}</span><span className="is-del">−{removed}</span> since {before.label || "the snapshot before"} ({clock(before.createdAt)})</div>
            <pre className="mo-diff">
                {withContext(rows).map((r, i) => (r.type === "gap"
                    ? <span key={i} className="is-gap"><i /><i />⋯ {r.count} unchanged line{r.count === 1 ? "" : "s"}{"\n"}</span>
                    : <span key={i} className={`is-${r.type}`}><i>{r.a ?? ""}</i><i>{r.b ?? ""}</i>{r.type === "add" ? "+ " : r.type === "del" ? "− " : "  "}{r.text || " "}{"\n"}</span>))}
            </pre>
        </>
    );
}

function SnapshotCard({ meetingId, snap, prev, index, onChange, onDelete }) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState(prev ? "changes" : "code"); // changes | code
    const [note, setNote] = useState(snap.note || "");
    const state = useAutosave(note, (v) => updateSnapshot(meetingId, snap.id, { note: v }).then(onChange));
    const lines = (snap.code || "").split("\n");
    const copy = async () => {
        try { await navigator.clipboard.writeText(snap.code || ""); toast.success("Code copied"); } catch { toast.error("Couldn't copy"); }
    };
    return (
        <li className={`mo-snap${snap.kind === "end" ? " is-final" : ""}`}>
            <span className="mo-snap-dot" aria-hidden="true" />
            <div className="mo-snap-head">
                <button type="button" className="mo-snap-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <b>{snap.label || (snap.kind === "end" ? "Final snapshot" : `Snapshot ${index + 1}`)}</b>
                </button>
                <span className="mo-snap-meta">
                    {snap.kind === "end" && <span className="mo-tag">Final</span>}
                    {clock(snap.createdAt)} · {lines.length} line{lines.length === 1 ? "" : "s"}{snap.language ? ` · ${snap.language}` : ""}
                </span>
            </div>
            {open && (
                <div className="mo-code">
                    <div className="mo-code-bar">
                        <span className="mo-views">
                            {prev && <button type="button" className={view === "changes" ? "on" : ""} onClick={() => setView("changes")}>Changes</button>}
                            <button type="button" className={view === "code" ? "on" : ""} onClick={() => setView("code")}>Code</button>
                            {snap.takenBy && <span className="mo-by">by {snap.takenBy}</span>}
                        </span>
                        <span>
                            <button type="button" className="u-icon" onClick={copy} title="Copy code" aria-label="Copy code"><Copy size={14} /></button>
                            {snap.kind !== "end" && <button type="button" className="u-icon" onClick={() => onDelete(snap)} title="Delete snapshot" aria-label="Delete snapshot"><Trash2 size={14} /></button>}
                        </span>
                    </div>
                    {view === "changes" && prev
                        ? <SnapshotDiff before={prev} after={snap} />
                        : <pre>{snap.code ? lines.map((l, i) => <span key={i}><i>{i + 1}</i>{l || " "}{"\n"}</span>) : <em>The editor was empty.</em>}</pre>}
                </div>
            )}
            <div className="mo-note">
                <textarea className="u-textarea" rows={open ? 3 : 1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Private comment on this snapshot" maxLength={5000} />
                <SaveState state={state} />
            </div>
        </li>
    );
}

// The organiser's side of a meeting page, to prepare before and review after: private notes,
// the code snapshots taken in the room (with comments), co-organisers, and ending the meeting.
// What guests said after the meeting.
function GuestFeedback({ meetingId }) {
    const [list, setList] = useState(null);
    useEffect(() => { getGuestFeedback(meetingId).then(setList).catch(() => setList([])); }, [meetingId]);
    if (!list || !list.length) return null;
    const avg = list.reduce((a, x) => a + x.rating, 0) / list.length;
    return (
        <section className="mo-sec">
            <div className="mo-sec-head"><h2>Guest feedback · {avg.toFixed(1)} / 5</h2></div>
            <ul className="mo-gfb">
                {list.map((f) => (
                    <li key={f.id}>
                        <b>{"★".repeat(f.rating)}<span>{"★".repeat(5 - f.rating)}</span></b>
                        <span>{f.name || "A guest"}{f.comment ? `: ${f.comment}` : ""}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default function MeetingOrganiser({ meeting, onChange, userName }) {
    const [notes, setNotes] = useState(meeting.notes || "");
    const notesState = useAutosave(notes, (v) => saveMeetingNotes(meeting.id, v));
    const [snaps, setSnaps] = useState(null);
    const [ending, setEnding] = useState(false);
    const [coHosts, setCoHosts] = useState(meeting.coHosts || []);
    const [draft, setDraft] = useState("");
    const ended = !!meeting.endedAt;
    const started = Date.now() >= new Date(meeting.startsAt).getTime() - 10 * 60000;

    const load = useCallback(() => listSnapshots(meeting.id).then(setSnaps).catch(() => setSnaps([])), [meeting.id]);
    useEffect(() => { load(); }, [load, meeting.endedAt]);

    const removeSnap = async (s) => {
        if (!window.confirm("Delete this snapshot and its comment?")) return;
        try { await deleteSnapshot(meeting.id, s.id); setSnaps((prev) => prev.filter((x) => x.id !== s.id)); } catch (err) { toast.error(err.message); }
    };

    const addCo = () => {
        const parts = draft.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
        const valid = parts.filter((e) => EMAIL.test(e));
        if (parts.length !== valid.length) toast.error("Some of those aren't email addresses.");
        if (valid.length) saveCo([...new Set([...coHosts, ...valid])]);
        setDraft("");
    };
    const saveCo = async (list) => {
        const before = coHosts;
        setCoHosts(list);
        try {
            const res = await saveCoHosts(meeting.id, list);
            setCoHosts(res.meeting.coHosts);
            onChange?.(res.meeting);
        } catch (err) { setCoHosts(before); toast.error(err.message); }
    };

    return (
        <aside className="mo" aria-label="Organiser tools">
            <div className="mo-head">
                <span className="u-label"><Lock size={12} /> Organiser only</span>
                {ended
                    ? <span className="mo-ended">Ended {day(meeting.endedAt)}, {clock(meeting.endedAt)}</span>
                    : started && <button type="button" className="u-btn u-btn--sm mo-end" onClick={() => setEnding(true)}><Power size={14} /> End meeting</button>}
            </div>

            {started && (
                <section className="mo-sec" id="feedback">
                    <div className="mo-sec-head"><h2>Your feedback</h2></div>
                    <InterviewFeedback meetingId={meeting.id} title={meeting.title} />
                </section>
            )}

            {started && <GuestFeedback meetingId={meeting.id} />}

            <section className="mo-sec">
                <div className="mo-sec-head">
                    <h2>AI copilot for guests</h2>
                    <span className="mo-switch" role="radiogroup" aria-label="AI copilot for guests">
                        {[["on", "Allowed"], ["off", "Off"]].map(([v, l]) => (
                            <button key={v} type="button" role="radio" aria-checked={(meeting.aiPolicy || "on") === v} className={(meeting.aiPolicy || "on") === v ? "on" : ""}
                                onClick={async () => { try { const next = await setAiPolicy(meeting.id, v); onChange?.({ ...meeting, ...next }); toast.success(v === "off" ? "Guests won't see the AI copilot in the room" : "Guests can use the AI copilot"); } catch (err) { toast.error(err.message); } }}>{l}</button>
                        ))}
                    </span>
                </div>
                <p className="mo-empty">While the meeting is on, the room shows everyone that the code is recorded for playback, and large pastes are marked on the timeline.</p>
            </section>

            <section className="mo-sec">
                <div className="mo-sec-head">
                    <h2>Guests{meeting.invitees?.length ? ` · ${meeting.invitees.length}` : ""}</h2>
                    {meeting.invitees?.length > 0 && (
                        <span className="mo-save">
                            {Object.values(meeting.rsvps || {}).filter((v) => v === "yes").length} going · {Object.values(meeting.rsvps || {}).filter((v) => v === "no").length} not
                        </span>
                    )}
                </div>
                {meeting.invitees?.length ? (
                    <ul className="mo-guests">
                        {meeting.invitees.map((e) => {
                            const a = (meeting.rsvps || {})[e];
                            return (
                                <li key={e}>
                                    <span className="u-ellipsis">{e}</span>
                                    <span className={`mo-rsvp${a === "yes" ? " is-yes" : a === "no" ? " is-no" : ""}`}>{a === "yes" ? "Going" : a === "no" ? "Not going" : "No answer"}</span>
                                </li>
                            );
                        })}
                    </ul>
                ) : <p className="mo-empty">No one invited by email. Anyone with the link can still come, depending on who can join.</p>}
            </section>

            <section className="mo-sec">
                <div className="mo-sec-head">
                    <h2>Private notes</h2>
                    <SaveState state={notesState} />
                </div>
                <textarea className="u-textarea mo-notes" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Questions to ask, what went well, follow-ups… Only organisers can see this." maxLength={20000} />
            </section>

            {started && (
                <section className="mo-sec">
                    <div className="mo-sec-head"><h2>Code playback</h2></div>
                    <CodePlayback meetingId={meeting.id} startsAt={meeting.startsAt} />
                </section>
            )}

            <section className="mo-sec">
                <div className="mo-sec-head">
                    <h2>Code snapshots{snaps?.length ? ` · ${snaps.length}` : ""}</h2>
                    {!ended && <button type="button" className="u-btn u-btn--quiet u-btn--sm" onClick={load} title="Snapshots are taken in the room; refresh to see new ones">Refresh</button>}
                </div>
                {snaps === null ? <div className="u-skel" style={{ height: 60 }} />
                    : snaps.length === 0 ? <p className="mo-empty">None yet. During the call, use <Camera size={12} style={{ verticalAlign: "-1px" }} /> <b>Snapshot</b> in the room's header to save the code as it is; a final one is saved when the meeting ends.</p>
                        : <ol className="mo-snaps">{snaps.map((s, i) => <SnapshotCard key={s.id} meetingId={meeting.id} snap={s} prev={i > 0 ? snaps[i - 1] : null} index={i} onChange={(x) => setSnaps((prev) => prev.map((y) => (y.id === x.id ? x : y)))} onDelete={removeSnap} />)}</ol>}
            </section>

            <section className="mo-sec">
                <div className="mo-sec-head"><h2>Co-organisers</h2></div>
                <p className="mo-empty">They can edit the meeting, see these notes and snapshots, and end it. They keep access to the room afterwards.</p>
                {coHosts.length > 0 && (
                    <div className="mo-chips">
                        {coHosts.map((e) => (
                            <span key={e} className="u-chip u-chip--mono"><Mail size={11} /> {e}
                                {meeting.isOwner && <button type="button" onClick={() => saveCo(coHosts.filter((x) => x !== e))} aria-label={`Remove ${e}`}><X size={11} /></button>}
                            </span>
                        ))}
                    </div>
                )}
                {meeting.isOwner ? (
                    <div className="mo-add">
                        <input className="u-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="colleague@company.com"
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCo(); } }} aria-label="Co-organiser email" />
                        <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={addCo} disabled={!draft.trim()}><UserPlus size={14} /> Add</button>
                    </div>
                ) : <p className="mo-empty">Only {meeting.hostName || "the organiser"} can change co-organisers.</p>}
            </section>

            <EndMeetingModal open={ending} meeting={meeting} onClose={() => setEnding(false)} takenBy={userName}
                onEnded={(m) => { onChange?.(m); load(); }} />
        </aside>
    );
}
