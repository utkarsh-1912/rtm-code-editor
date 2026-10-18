import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { LANGS } from "../utils/languages";

// Searchable language menu for the editor bar: label, runtime and file extension.
export default function LangPicker({ value, onChange, disabled }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [cursor, setCursor] = useState(0);
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const current = LANGS.find((l) => l.id === value);

    const list = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return LANGS;
        return LANGS.filter((l) => [l.label, l.runtime, l.id, ...l.ext].some((v) => v.toLowerCase().includes(s)));
    }, [q]);

    useEffect(() => {
        if (!open) return undefined;
        setQ("");
        setCursor(Math.max(0, LANGS.findIndex((l) => l.id === value)));
        const t = setTimeout(() => inputRef.current?.focus(), 0);
        const away = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", away);
        return () => { clearTimeout(t); document.removeEventListener("mousedown", away); };
    }, [open, value]);

    useEffect(() => { setCursor(0); }, [q]);
    useEffect(() => {
        rootRef.current?.querySelector(`[data-i="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
    }, [cursor]);

    const pick = (id) => {
        setOpen(false);
        if (id !== value) onChange(id);
    };

    const onKey = (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(list.length - 1, c + 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
        else if (e.key === "Enter") { e.preventDefault(); if (list[cursor]) pick(list[cursor].id); }
        else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    };

    return (
        <div className="lp" ref={rootRef}>
            <button type="button" className="lp-btn" onClick={() => setOpen((o) => !o)} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} title="Change language">
                <span className="lp-badge">{current?.short || value}</span>
                <span className="lp-name">{current?.label || value}</span>
                {current?.runtime && current.runtime !== current.label && <span className="lp-rt">{current.runtime}</span>}
                <ChevronDown size={13} />
            </button>
            {open && (
                <div className="lp-pop" role="dialog" aria-label="Choose a language">
                    <label className="lp-search">
                        <Search size={13} />
                        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search languages" aria-label="Search languages" />
                    </label>
                    <ul role="listbox" aria-label="Languages">
                        {list.map((l, i) => (
                            <li
                                key={l.id}
                                data-i={i}
                                role="option"
                                aria-selected={l.id === value}
                                className={`${i === cursor ? "is-cursor" : ""}${l.id === value ? " is-on" : ""}`}
                                onMouseEnter={() => setCursor(i)}
                                onMouseDown={(e) => { e.preventDefault(); pick(l.id); }}
                            >
                                <span className="lp-badge">{l.short}</span>
                                <span className="lp-name">{l.label}</span>
                                <span className="lp-rt">{l.runtime} · .{l.ext[0]}</span>
                                {l.id === value && <Check size={13} />}
                            </li>
                        ))}
                        {!list.length && <li className="lp-none">No language matches “{q}”</li>}
                    </ul>
                </div>
            )}
        </div>
    );
}
