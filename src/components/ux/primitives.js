import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const REVEAL = "[data-rise]:not(.is-in), .u-clip:not(.is-in), .u-roll:not(.is-in), .u-lines:not(.is-in), .d-bars:not(.is-in)";

// Adds .is-in to reveal targets inside `rootRef` as they scroll into view,
// including ones rendered later (data loads, tab switches).
export function useReveal(rootRef) {
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return undefined;
        if (!("IntersectionObserver" in window)) {
            root.querySelectorAll(REVEAL).forEach((el) => el.classList.add("is-in"));
            return undefined;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add("is-in");
                    io.unobserve(e.target);
                }
            });
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
        const scan = () => root.querySelectorAll(REVEAL).forEach((el) => {
            // Already on screen: reveal on the next frame instead of waiting for the observer.
            const r = el.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0) requestAnimationFrame(() => el.classList.add("is-in"));
            else io.observe(el);
        });
        scan();
        const mo = new MutationObserver(scan);
        mo.observe(root, { childList: true, subtree: true });
        return () => { io.disconnect(); mo.disconnect(); };
    }, [rootRef]);
}

// Number whose digits roll up into place when revealed.
export function RollingNumber({ value, suffix }) {
    const chars = String(value).split("");
    return (
        <span className="u-num" aria-label={`${value}${suffix || ""}`}>
            <span className="u-roll" aria-hidden="true">
                {chars.map((c, i) => <span key={`${i}-${c}`} style={{ "--d": `${i * 70}ms` }}>{c}</span>)}
            </span>
            {suffix && <small>{suffix}</small>}
        </span>
    );
}

// Live local clock, e.g. "Kolkata 6:52:40 PM".
export function useClock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return now;
}

export const localCity = () => {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        return (tz.split("/").pop() || "Local").replace(/_/g, " ");
    } catch {
        return "Local";
    }
};

export const greeting = (d = new Date()) => {
    const h = d.getHours();
    if (h < 5) return "Up late";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
};

export function Modal({ open, onClose, label, title, description, children, footer, wide = false, onSubmit }) {
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => e.key === "Escape" && onClose?.();
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);
    if (!open) return null;
    const Body = onSubmit ? "form" : "div";
    return (
        <div className="u-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
            <Body className={`u-modal${wide ? " u-modal--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}
                onSubmit={onSubmit ? (e) => { e.preventDefault(); onSubmit(e); } : undefined}>
                <div className="u-modal-head">
                    <div>
                        {label && <span className="u-label">{label}</span>}
                        <h3>{title}</h3>
                        {description && <p>{description}</p>}
                    </div>
                    {onClose && <button type="button" className="u-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>}
                </div>
                {children && <div className="u-modal-body">{children}</div>}
                {footer && <div className="u-modal-foot">{footer}</div>}
            </Body>
        </div>
    );
}

export const timeAgo = (input) => {
    if (!input) return "—";
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return String(input).split(",")[0];
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.round(h / 24);
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export const pad2 = (n) => String(n).padStart(2, "0");

export const newRoomId = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 8; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
    return id;
};

// Accepts a bare room id or a full invite link like https://host/editor/abc123?x=1 or /?room=abc123
export const extractRoomId = (value) => {
    const v = (value || "").trim();
    const m = v.match(/\/editor\/([^/?#\s]+)/) || v.match(/[?&]room=([^&#\s]+)/);
    return m ? m[1] : v;
};

// Custom range slider: filled track, value bubble and optional tick labels.
export function Slider({ value, min = 0, max = 100, step = 1, onChange, marks = [], format = (v) => v, label, id }) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
        <div className="u-slider" style={{ "--p": `${pct}%`, "--pn": pct / 100 }}>
            <div className="u-slider-rail">
                <input
                    id={id}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    aria-label={label}
                    aria-valuetext={String(format(value))}
                    onChange={(e) => onChange(Number(e.target.value))}
                />
                <output className="u-slider-bubble" htmlFor={id}>{format(value)}</output>
            </div>
            {marks.length > 0 && (
                <div className="u-slider-marks" aria-hidden="true">
                    {marks.map((m) => (
                        <button type="button" tabIndex={-1} key={m} className={m === value ? "on" : ""} style={{ left: `${((m - min) / (max - min)) * 100}%` }} onClick={() => onChange(m)}>
                            {format(m)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
