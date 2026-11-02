import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, Lock, Send } from "lucide-react";
import { getFeedback, saveFeedback } from "../utils/meetings";

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
export default function InterviewFeedback({ meetingId }) {
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
