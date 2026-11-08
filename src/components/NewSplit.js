import React, { useEffect, useRef, useState } from "react";
import { Plus, ChevronDown } from "lucide-react";

// "New room" in one click, and everything else to create from its arrow.
// In the navbar (`inNav`) phones get a compact + that opens the menu (Room now is its first item).
export default function NewSplit({ onRoom, items, inNav = false, label = "New room" }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const key = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", key);
        return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
    }, [open]);
    return (
        <div className={`u-split${inNav ? " u-nav-new" : ""}`} ref={ref}>
            <button className="u-btn u-btn--solid u-split-main" onClick={onRoom}><Plus size={16} /> {label}</button>
            <button className="u-btn u-btn--solid u-split-more" onClick={() => setOpen((v) => !v)} aria-label="Create something new" aria-haspopup="menu" aria-expanded={open}>
                <ChevronDown size={15} className="u-split-chev" /><Plus size={18} className="u-split-plus" />
            </button>
            {open && (
                <div className="u-pop u-split-pop" role="menu">
                    {items.map(({ id, Icon, title, sub, run, disabled }) => (
                        <button key={id} role="menuitem" disabled={disabled} onClick={() => { setOpen(false); run(); }}>
                            <Icon size={16} />
                            <span className="u-split-text"><b>{title}</b><span>{sub}</span></span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
