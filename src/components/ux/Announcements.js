import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { X, ArrowUpRight } from "lucide-react";
import { getBackendUrl } from "../../utils/api";

const DISMISSED = "dismissed-announcements";
const ROTATE_MS = 6000;
// Shown until the server answers (and if it can't be reached).
const FALLBACK = {
    site: [{ id: "rooms-free", text: "Rooms are free", href: "/pricing", cta: "See plans", tone: "info" }],
    app: [],
};

const readDismissed = () => {
    try { return new Set(JSON.parse(localStorage.getItem(DISMISSED)) || []); } catch { return new Set(); }
};

// Announcement ticker for the header strip: rotates every few seconds (pauses on hover or
// focus), each item can link somewhere, and "×" hides that announcement on this device.
export default function Announcements({ audience = "site", fallback }) {
    const [items, setItems] = useState(fallback ? [{ id: "fallback", text: fallback, tone: "info" }] : FALLBACK[audience] || []);
    const [dismissed, setDismissed] = useState(readDismissed);
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        let alive = true;
        fetch(`${getBackendUrl()}/api/announcements?audience=${audience}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((list) => { if (alive && Array.isArray(list) && list.length) setItems(list); })
            .catch(() => { /* keep the fallback */ });
        return () => { alive = false; };
    }, [audience]);

    const visible = useMemo(() => items.filter((a) => !dismissed.has(a.id)), [items, dismissed]);
    const count = visible.length;

    useEffect(() => {
        if (count < 2 || paused) return undefined;
        const id = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
        return () => clearInterval(id);
    }, [count, paused]);
    useEffect(() => { if (index >= count) setIndex(0); }, [index, count]);

    if (!count) return fallback ? <span className="an-plain">{fallback}</span> : null;
    const a = visible[Math.min(index, count - 1)];

    const dismiss = () => {
        const next = new Set(dismissed);
        next.add(a.id);
        setDismissed(next);
        try { localStorage.setItem(DISMISSED, JSON.stringify([...next].slice(-50))); } catch { /* storage blocked */ }
    };

    const external = a.href && /^https?:/i.test(a.href);
    const body = (
        <>
            <span className={`an-dot an-dot--${a.tone}`} aria-hidden="true" />
            {a.tone === "new" && <b className="an-new">New</b>}
            <span className="an-text">{a.text.replace(/^New:\s*/i, "")}</span>
            {a.href && <span className="an-cta">{a.cta || "Learn more"} <ArrowUpRight size={11} /></span>}
        </>
    );

    return (
        <span
            className="an"
            role="status"
            aria-live="polite"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            <span className="an-item" key={a.id}>
                {a.href
                    ? (external
                        ? <a className="an-link" href={a.href} target="_blank" rel="noreferrer">{body}</a>
                        : <Link className="an-link" to={a.href}>{body}</Link>)
                    : <span className="an-link">{body}</span>}
            </span>
            {count > 1 && (
                <span className="an-dots" aria-label={`Announcement ${index + 1} of ${count}`}>
                    {visible.map((x, i) => (
                        <button key={x.id} className={i === index ? "on" : ""} onClick={() => setIndex(i)} aria-label={`Show announcement ${i + 1}`} />
                    ))}
                </span>
            )}
            <button className="an-x" onClick={dismiss} aria-label="Hide this announcement" title="Hide"><X size={11} /></button>
        </span>
    );
}
