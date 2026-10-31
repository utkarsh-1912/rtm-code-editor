import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Camera, Copy, ChevronDown, ChevronRight, Lock, Mail, Power, Trash2, UserPlus, X, Flag } from "lucide-react";
import { Modal } from "./ux/primitives";
import {
    saveMeetingNotes, saveCoHosts, listSnapshots, takeSnapshot, updateSnapshot, deleteSnapshot, endMeeting,
} from "../utils/meetings";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clock = (d) => new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const day = (d) => new Date(d).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

// Saves after typing stops; reports "saving" / "saved" / "error".
function useAutosave(value, save, delay = 800) {
    const [state, setState] = useState("idle");
    const first = useRef(true);
    const saveRef = useRef(save);
    saveRef.current = save;
    useEffect(() => {
        if (first.current) { first.current = false; return undefined; }
        setState("dirty");
        const t = setTimeout(async () => {
            setState("saving");
            try { await saveRef.current(value); setState("saved"); } catch { setState("error"); }
        }, delay);
        return () => clearTimeout(t);
    }, [value, delay]);
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
            toast.success(res.removed ? `Meeting ended. ${res.removed} ${res.removed === 1 ? "person was" : "people were"} removed from the room.` : "Meeting ended. The room is now organisers only.");
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
                <li><Lock size={14} /> The room becomes private: only you{meeting?.coHosts?.length ? " and co-organisers" : ""} can open it.</li>
                <li><Flag size={14} /> Invitees see that the meeting has ended.</li>
            </ul>
        </Modal>
    );
}

function SnapshotCard({ meetingId, snap, index, onChange, onDelete }) {
    const [open, setOpen] = useState(false);
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
                        <span>{snap.takenBy ? `Taken by ${snap.takenBy}` : ""}</span>
                        <span>
                            <button type="button" className="u-icon" onClick={copy} title="Copy code" aria-label="Copy code"><Copy size={14} /></button>
                            {snap.kind !== "end" && <button type="button" className="u-icon" onClick={() => onDelete(snap)} title="Delete snapshot" aria-label="Delete snapshot"><Trash2 size={14} /></button>}
                        </span>
                    </div>
                    <pre>{snap.code ? lines.map((l, i) => <span key={i}><i>{i + 1}</i>{l || " "}{"\n"}</span>) : <em>The editor was empty.</em>}</pre>
                </div>
            )}
            <div className="mo-note">
                <textarea className="u-textarea" rows={open ? 3 : 1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Private comment on this snapshot" maxLength={5000} />
                <SaveState state={state} />
            </div>
        </li>
    );
}

// The organiser's side of a meeting page: private notes, code snapshots with comments,
// co-organisers, and ending the meeting.
export default function MeetingOrganiser({ meeting, onChange, userName }) {
    const [notes, setNotes] = useState(meeting.notes || "");
    const notesState = useAutosave(notes, (v) => saveMeetingNotes(meeting.id, v));
    const [snaps, setSnaps] = useState(null);
    const [taking, setTaking] = useState(false);
    const [ending, setEnding] = useState(false);
    const [coHosts, setCoHosts] = useState(meeting.coHosts || []);
    const [draft, setDraft] = useState("");
    const ended = !!meeting.endedAt;
    const started = Date.now() >= new Date(meeting.startsAt).getTime() - 10 * 60000;

    const load = useCallback(() => listSnapshots(meeting.id).then(setSnaps).catch(() => setSnaps([])), [meeting.id]);
    useEffect(() => { load(); }, [load, meeting.endedAt]);

    const snapshot = async () => {
        setTaking(true);
        try {
            const s = await takeSnapshot(meeting.id, { takenBy: userName });
            setSnaps((prev) => [...(prev || []), s]);
            toast.success("Snapshot saved");
        } catch (err) { toast.error(err.message); } finally { setTaking(false); }
    };
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

            <section className="mo-sec">
                <div className="mo-sec-head">
                    <h2>Private notes</h2>
                    <SaveState state={notesState} />
                </div>
                <textarea className="u-textarea mo-notes" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Questions to ask, what went well, follow-ups… Only organisers can see this." maxLength={20000} />
            </section>

            <section className="mo-sec">
                <div className="mo-sec-head">
                    <h2>Code snapshots{snaps?.length ? ` · ${snaps.length}` : ""}</h2>
                    {!ended && <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={snapshot} disabled={taking}><Camera size={14} /> {taking ? "Saving…" : "Take snapshot"}</button>}
                </div>
                {snaps === null ? <div className="u-skel" style={{ height: 60 }} />
                    : snaps.length === 0 ? <p className="mo-empty">No snapshots yet. Take one any time during the call; a final one is saved when you end the meeting.</p>
                        : <ol className="mo-snaps">{snaps.map((s, i) => <SnapshotCard key={s.id} meetingId={meeting.id} snap={s} index={i} onChange={(x) => setSnaps((prev) => prev.map((y) => (y.id === x.id ? x : y)))} onDelete={removeSnap} />)}</ol>}
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
