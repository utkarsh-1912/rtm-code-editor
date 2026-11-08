import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack } from "lucide-react";
import { getTimeline } from "../utils/meetings";

// Replays how the code was written during a meeting. Frames are either the whole text
// ({ full }) or one block of changed lines ({ s, d, i }); see server/services/CodeRecorder.js.
// Paste markers ({ paste, by }) belong to the next change, which is where the pasted text shows.
export function rebuild(frames) {
    const states = [];
    let lines = [];
    let paste = null;
    for (const f of frames) {
        if (Number.isFinite(f.paste)) { paste = { chars: f.paste, by: f.by || "" }; continue; }
        let changed = null;
        if (typeof f.full === "string") {
            lines = f.full.split("\n");
            changed = [0, lines.length];
        } else if (Number.isInteger(f.s)) {
            lines = [...lines.slice(0, f.s), ...(f.i || []), ...lines.slice(f.s + (f.d || 0))];
            changed = [f.s, f.s + (f.i || []).length];
        }
        states.push({ at: new Date(f.at).getTime(), lines, changed, paste });
        paste = null;
    }
    if (paste && states.length) states[states.length - 1].paste = paste;
    return states;
}

const SPEEDS = [1, 2, 4, 8];

export default function CodePlayback({ meetingId, startsAt }) {
    const [frames, setFrames] = useState(null);
    const [i, setI] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(2);
    const codeRef = useRef(null);

    useEffect(() => { getTimeline(meetingId).then(setFrames).catch(() => setFrames([])); }, [meetingId]);
    const states = useMemo(() => (frames ? rebuild(frames) : []), [frames]);
    const last = states.length - 1;
    const cur = states[Math.min(i, last)];

    // Play: real gaps between frames, sped up, never more than a second of waiting.
    useEffect(() => {
        if (!playing) return undefined;
        if (i >= last) { setPlaying(false); return undefined; }
        const gap = Math.min(1000, Math.max(60, (states[i + 1].at - states[i].at) / speed));
        const t = setTimeout(() => setI((n) => n + 1), gap);
        return () => clearTimeout(t);
    }, [playing, i, last, states, speed]);

    // Keep the changed lines in view.
    useEffect(() => {
        const el = codeRef.current?.querySelector(".is-changed");
        if (el) el.scrollIntoView({ block: "nearest" });
    }, [i]);

    if (frames === null) return <div className="u-skel" style={{ height: 80 }} />;
    if (!states.length) return <p className="mo-empty">Nothing recorded. Code typed in the room while the meeting is on is recorded here so you can replay it.</p>;

    const since = (t) => {
        const s = Math.max(0, Math.round((t - new Date(startsAt).getTime()) / 1000));
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    };
    const [from, to] = cur.changed || [-1, -1];

    return (
        <div className="cp">
            <div className="cp-bar">
                <button type="button" className="cp-btn" onClick={() => { setI(0); setPlaying(false); }} aria-label="Back to start" title="Back to start"><SkipBack size={14} /></button>
                <button type="button" className="cp-btn cp-play" onClick={() => { if (i >= last) setI(0); setPlaying((p) => !p); }} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
                <span className="cp-track">
                    <input type="range" min={0} max={last} value={Math.min(i, last)} onChange={(e) => { setPlaying(false); setI(Number(e.target.value)); }}
                        style={{ "--p": `${last ? (Math.min(i, last) / last) * 100 : 100}%` }} aria-label="Playback position" />
                    {/* Where something sizeable was pasted in (everyone in the room was told it's recorded). */}
                    {states.map((st, n) => st.paste && (
                        <button key={n} type="button" className="cp-mark" style={{ left: `${last ? (n / last) * 100 : 0}%` }}
                            onClick={() => { setPlaying(false); setI(n); }} title={`Pasted ${st.paste.chars} characters${st.paste.by ? ` (${st.paste.by})` : ""}`} aria-label={`Paste at change ${n + 1}`} />
                    ))}
                </span>
                <span className="cp-time">{since(cur.at)} <small>/ {since(states[last].at)}</small></span>
                <button type="button" className="cp-btn cp-speed" onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])} title="Playback speed">{speed}×</button>
            </div>
            <pre className="cp-code" ref={codeRef}>
                {cur.lines.map((l, n) => (
                    <span key={n} className={n >= from && n < to ? "is-changed" : ""}><i>{n + 1}</i>{l || " "}{"\n"}</span>
                ))}
            </pre>
            <span className="cp-meta">Change {Math.min(i, last) + 1} of {states.length} · {new Date(cur.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                {cur.paste && <b className="cp-pasted"> · Pasted {cur.paste.chars} characters{cur.paste.by ? ` (${cur.paste.by})` : ""}</b>}
                {states.some((st) => st.paste) && <span className="cp-legend"> · <i className="cp-mark-key" /> pastes</span>}
            </span>
        </div>
    );
}
