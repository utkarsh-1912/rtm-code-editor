import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, Lock, Send, Sparkles, Copy, Download } from "lucide-react";
import { getFeedback, saveFeedback, getTimeline, getPanel } from "../utils/meetings";
import { runModel } from "../utils/copilot";
import { useAuth } from "../context/AuthContext";
import { rebuild } from "./CodePlayback";

const RECS_IDS = ["strong_yes", "yes", "no", "strong_no"];

// The debrief as Markdown: a table of scores and calls, then each interviewer's notes.
function debriefMarkdown(title, data, all) {
    const label = (id) => ({ strong_yes: "Strong yes", yes: "Yes", no: "No", strong_no: "Strong no" }[id] || "—");
    const cell = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ");
    const head = ["Interviewer", ...data.criteria.map((c) => c.label), "Recommendation"];
    const rows = all.map((f) => [f.name, ...data.criteria.map((c) => f.ratings?.[c.id] || "–"), label(f.recommendation)]);
    return [
        `# Debrief: ${title || "Meeting"}`, "",
        `Scores are 1 (weak) to 4 (strong). ${all.length} submitted.`, "",
        `| ${head.map(cell).join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`,
        ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`), "",
        ...all.filter((f) => f.notes?.trim()).flatMap((f) => [`## ${f.name}`, "", f.notes.trim(), ""]),
    ].join("\n");
}

const RECS = [
    { id: "strong_yes", label: "Strong yes" },
    { id: "yes", label: "Yes" },
    { id: "no", label: "No" },
    { id: "strong_no", label: "Strong no" },
];
const RATING = ["", "Weak", "Mixed", "Good", "Strong"];
const recLabel = (id) => RECS.find((r) => r.id === id)?.label || "—";

// After the interview: each organiser rates the candidate and recommends. Others' feedback
// appears once you've submitted yours, then the debrief shows everyone side by side.
export default function InterviewFeedback({ meetingId, title }) {
    const { user } = useAuth();
    const [drafting, setDrafting] = useState(false);
    const [data, setData] = useState(null);
    const [ratings, setRatings] = useState({});
    const [rec, setRec] = useState(null);
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);

    const load = () => getFeedback(meetingId).then((d) => {
        setData(d);
        setRatings(d.mine?.ratings || {});
        setRec(d.mine?.recommendation || null);
        setNotes(d.mine?.notes || "");
    }).catch(() => setData({ criteria: [], others: [], mine: null }));
    useEffect(() => { load(); }, [meetingId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (data && window.location.hash === "#feedback") document.getElementById("feedback")?.scrollIntoView({ block: "start" });
    }, [data]);

    const save = async (submit) => {
        setBusy(true);
        try {
            await saveFeedback(meetingId, { ratings, recommendation: rec, notes, submit });
            toast.success(submit ? "Feedback submitted" : "Draft saved");
            await load();
        } catch (err) { toast.error(err.message); } finally { setBusy(false); }
    };

    // A first draft from what was recorded: the final code, the interviewers' chat and your notes.
    // It fills only empty scores and adds to your notes; you review it before submitting.
    const draftWithAI = async () => {
        setDrafting(true);
        try {
            const [frames, panel] = await Promise.all([getTimeline(meetingId).catch(() => []), getPanel(meetingId).catch(() => [])]);
            const states = rebuild(frames || []);
            const code = states.length ? states[states.length - 1].lines.join("\n").slice(0, 8000) : "";
            const pastes = states.filter((s) => s.paste).length;
            const chat = (panel || []).map((m) => `${m.author}: ${m.text}`).join("\n").slice(0, 4000);
            const criteria = data.criteria.map((c) => `${c.id} (${c.label})`).join(", ");
            const messages = [
                { role: "system", content: "You help an interviewer write fair, evidence-based feedback after a remote pairing interview. Use only the material given. Never invent facts. Be specific and brief." },
                { role: "user", content: `Meeting: ${title || "Interview"}\n\nFinal code:\n\`\`\`\n${code || "(nothing recorded)"}\n\`\`\`\nLarge pastes during the meeting: ${pastes}\n\nInterviewers' private chat:\n${chat || "(none)"}\n\nMy notes:\n${notes || "(none)"}\n\nWrite markdown with three short sections: **Strengths**, **Concerns**, **Evidence** (quote code or notes). Then, on the last line exactly: SCORES: ${data.criteria.map((c) => `${c.id}=<1-4>`).join(", ")}, recommendation=<${RECS_IDS.join("|")}>\nCriteria: ${criteria}. Use 1-4 where 4 is strong. If there is not enough evidence for a criterion, write ?.` },
            ];
            const out = await runModel({ messages, userId: user?.uid, action: "feedback" });
            const text = String(out.text || "");
            const line = /SCORES:\s*(.+)$/im.exec(text);
            const body = text.replace(/^.*SCORES:.*$/im, "").trim();
            if (line) {
                const pairs = Object.fromEntries(line[1].split(/[,;]/).map((p) => p.split("=").map((x) => x.trim())).filter((p) => p.length === 2));
                setRatings((r) => {
                    const next = { ...r };
                    for (const c of data.criteria) { const v = Number(pairs[c.id]); if (!next[c.id] && v >= 1 && v <= 4) next[c.id] = v; }
                    return next;
                });
                if (!rec && RECS_IDS.includes(pairs.recommendation)) setRec(pairs.recommendation);
            }
            setNotes((n) => (n.trim() ? `${n.trim()}\n\n--- AI draft (${out.model || "model"}) ---\n${body}` : body));
            toast.success("Draft added. Check it before you submit.");
        } catch (err) {
            toast.error(err.message || "The AI model couldn't write a draft.");
        } finally { setDrafting(false); }
    };

    if (!data) return <div className="u-skel" style={{ height: 120 }} />;
    const submitted = !!data.mine?.submittedAt;
    const all = submitted ? [data.mine, ...data.others] : [];

    return (
        <div className="fb">
            <div className="fb-form">
                {data.criteria.map((c) => (
                    <div key={c.id} className="fb-row">
                        <span>{c.label}</span>
                        <span className="fb-scale" role="radiogroup" aria-label={c.label}>
                            {[1, 2, 3, 4].map((v) => (
                                <button key={v} type="button" role="radio" aria-checked={ratings[c.id] === v} className={ratings[c.id] === v ? "on" : ""}
                                    onClick={() => setRatings((r) => ({ ...r, [c.id]: r[c.id] === v ? undefined : v }))} title={RATING[v]}>{v}</button>
                            ))}
                        </span>
                    </div>
                ))}
                <div className="fb-row">
                    <span>Recommendation</span>
                    <span className="fb-recs" role="radiogroup" aria-label="Recommendation">
                        {RECS.map((r) => (
                            <button key={r.id} type="button" role="radio" aria-checked={rec === r.id} className={`${rec === r.id ? "on" : ""} is-${r.id}`} onClick={() => setRec(r.id)}>{r.label}</button>
                        ))}
                    </span>
                </div>
                <textarea className="u-textarea fb-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Evidence for your scores: what they did, said and wrote. Your notes from the room are here." />
                <div className="fb-actions">
                    <span className="u-small u-muted">{submitted ? <><Check size={12} /> Submitted. You can still edit it.</> : <><Lock size={12} /> Others' feedback appears after you submit yours.</>}</span>
                    <span>
                        <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={draftWithAI} disabled={drafting || busy} title="Uses your AI model (Settings > AI models) with the recorded code, the interviewers' chat and your notes"><Sparkles size={13} /> {drafting ? "Drafting…" : "Draft with AI"}</button>
                        {!submitted && <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => save(false)} disabled={busy}>Save draft</button>}
                        <button type="button" className="u-btn u-btn--solid u-btn--sm" onClick={() => save(true)} disabled={busy || !rec}><Send size={13} /> {submitted ? "Update" : "Submit"}</button>
                    </span>
                </div>
            </div>

            {submitted && (
                <div className="fb-debrief">
                    <div className="fb-debrief-head">
                        <span className="u-label">Debrief · {data.submittedCount} submitted</span>
                        {data.waitingOn?.length > 0 && <span className="u-small u-muted">Waiting on {data.waitingOn.join(", ")}</span>}
                        <span className="fb-export">
                            <button type="button" className="u-icon" title="Copy the debrief (paste it into your hiring tool)" aria-label="Copy the debrief" onClick={async () => {
                                try { await navigator.clipboard.writeText(debriefMarkdown(title, data, all)); toast.success("Debrief copied"); } catch { toast.error("Couldn't copy"); }
                            }}><Copy size={15} /></button>
                            <button type="button" className="u-icon" title="Download the debrief as a Markdown file" aria-label="Download the debrief" onClick={() => {
                                const blob = new Blob([debriefMarkdown(title, data, all)], { type: "text/markdown" });
                                const a = document.createElement("a");
                                a.href = URL.createObjectURL(blob);
                                a.download = `debrief-${String(title || "meeting").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "meeting"}.md`;
                                a.click();
                                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                            }}><Download size={15} /></button>
                        </span>
                    </div>
                    <div className="fb-table" role="table">
                        <div role="row" className="fb-tr fb-th">
                            <span role="columnheader">Interviewer</span>
                            {data.criteria.map((c) => <span key={c.id} role="columnheader" title={c.label}>{c.label.split(" ")[0]}</span>)}
                            <span role="columnheader">Call</span>
                        </div>
                        {all.map((f) => (
                            <div role="row" key={f.uid} className="fb-tr">
                                <span role="cell" className="u-ellipsis">{f.name}</span>
                                {data.criteria.map((c) => <span key={c.id} role="cell" className={`fb-score s${f.ratings?.[c.id] || 0}`}>{f.ratings?.[c.id] || "–"}</span>)}
                                <span role="cell" className={`fb-call is-${f.recommendation}`}>{recLabel(f.recommendation)}</span>
                            </div>
                        ))}
                    </div>
                    {data.others.filter((f) => f.notes).map((f) => (
                        <details key={f.uid} className="fb-other">
                            <summary>{f.name}'s notes</summary>
                            <p>{f.notes}</p>
                        </details>
                    ))}
                </div>
            )}
        </div>
    );
}
