import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Icon from "./icons/Icon";
import { listKits, createKit, deleteKit } from "../utils/kits";
import { labelFor } from "../utils/languages";

// Problem pane: apply a saved session kit to this room, or save the room as a new kit.
export default function KitMenu({ problem, getCode, language, onApply }) {
    const [open, setOpen] = useState(false);
    const [kits, setKits] = useState(null);
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState("");
    const [timerMin, setTimerMin] = useState(0);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        listKits().then(setKits).catch(() => setKits([]));
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const key = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", key);
        return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
    }, [open]);

    const save = async (e) => {
        e.preventDefault();
        try {
            const kit = await createKit({ title, problem, code: getCode(), language, timerMin });
            setKits((k) => [kit, ...(k || [])]);
            setSaving(false);
            setTitle("");
            toast.success(`Saved “${kit.title}”. Attach it to a booking link or scheduled call too.`);
        } catch (err) { toast.error(err.message); }
    };
    const remove = async (k) => {
        if (!window.confirm(`Delete the kit “${k.title}”?`)) return;
        try { await deleteKit(k.id); setKits((list) => list.filter((x) => x.id !== k.id)); } catch (err) { toast.error(err.message); }
    };

    return (
        <span className="km" ref={ref}>
            <button type="button" className={`ec-icon${open ? " on" : ""}`} onClick={() => setOpen((v) => !v)} title="Session kits: saved problems with starter code and a timer" aria-label="Session kits" aria-haspopup="menu" aria-expanded={open}>
                <Icon name="starter" size={14} />
            </button>
            {open && (
                <div className="km-pop" role="menu">
                    <div className="km-head"><b>Session kits</b><span>Problem, starter code and timer, ready in one click.</span></div>
                    {kits === null ? <div className="u-skel" style={{ height: 40, margin: 8 }} /> : (
                        <ul className="km-list">
                            {kits.map((k) => (
                                <li key={k.id}>
                                    <button type="button" role="menuitem" className="km-apply" onClick={() => { setOpen(false); onApply(k); }}>
                                        <b>{k.title}</b>
                                        <span>{labelFor(k.language)}{k.timerMin ? ` · ${k.timerMin} min timer` : ""}{k.problem ? "" : " · no problem text"}</span>
                                    </button>
                                    <button type="button" className="ec-icon" onClick={() => remove(k)} title="Delete kit" aria-label={`Delete ${k.title}`}><Icon name="delete" size={13} /></button>
                                </li>
                            ))}
                            {!kits.length && <li className="km-empty">No kits yet. Set up a room, then save it as a kit.</li>}
                        </ul>
                    )}
                    {saving ? (
                        <form className="km-save" onSubmit={save}>
                            <input className="u-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kit name, e.g. Rate limiter pairing" maxLength={120} autoFocus aria-label="Kit name" />
                            <label className="km-timer">Timer
                                <select className="u-select" value={timerMin} onChange={(e) => setTimerMin(Number(e.target.value))}>
                                    {[0, 15, 25, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m ? `${m} min` : "None"}</option>)}
                                </select>
                            </label>
                            <span className="km-save-actions">
                                <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => setSaving(false)}>Cancel</button>
                                <button type="submit" className="u-btn u-btn--solid u-btn--sm" disabled={!title.trim()}>Save</button>
                            </span>
                        </form>
                    ) : (
                        <button type="button" className="km-new" onClick={() => setSaving(true)}><Icon name="add" size={14} /> Save this room as a kit</button>
                    )}
                </div>
            )}
        </span>
    );
}
