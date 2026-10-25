import React, { useCallback, useEffect, useRef, useState } from "react";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import { GripVertical, X, LayoutTemplate, Check, RotateCcw, PanelLeft } from "lucide-react";

// Workspace as rearrangeable cards (LeetCode style): two columns of stacked panels.
// Drag a card by its handle onto another card's top or bottom half to move it there.
// Rooms and projects use the same machinery with their own cards and presets (a config).

export const PANELS = {
    problem: { label: "Problem" },
    code: { label: "Code" },
    io: { label: "Input / Output" },
    chat: { label: "Chat" },
    call: { label: "Call" },
};

export const PRESETS = [
    { id: "problem", label: "Problem left", note: "LeetCode style", layout: { left: ["problem"], right: ["code", "io"] } },
    { id: "classic", label: "Chat left", note: "Pair programming", layout: { left: ["chat"], right: ["code", "io"] } },
    { id: "study", label: "Problem and chat", note: "Interview", layout: { left: ["problem", "chat"], right: ["code", "io"] } },
    { id: "code-first", label: "Code left", note: "Wide editor", layout: { left: ["code", "io"], right: ["problem"] } },
    { id: "interview-call", label: "Problem and call", note: "Live interview", layout: { left: ["problem", "call"], right: ["code", "io"] } },
    { id: "pair-call", label: "Call and chat", note: "Remote pairing", layout: { left: ["call", "chat"], right: ["code", "io"] } },
    { id: "focus", label: "Focus", note: "Just the code", layout: { left: [], right: ["code", "io"] } },
];

export const ROOM_LAYOUT = {
    key: "room-layout-v1",
    panels: PANELS,
    presets: PRESETS,
    fallback: PRESETS[1].layout, // what rooms looked like before: chat, then code over I/O
    toggles: ["problem", "io", "chat", "call"],
    below: { io: "code" }, // shown again, I/O goes right under the code
};

const clone = (l) => ({ left: [...l.left], right: [...l.right] });

export function useRoomLayout(config = ROOM_LAYOUT) {
    const { key, panels, presets, fallback, below = {} } = config;
    const valid = useCallback((l) => {
        if (!l || !Array.isArray(l.left) || !Array.isArray(l.right)) return false;
        const all = [...l.left, ...l.right];
        return all.includes("code") && all.every((id) => panels[id]) && new Set(all).size === all.length;
    }, [panels]);

    const [layout, setLayout] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(key));
            if (valid(saved)) return saved;
        } catch { /* storage blocked */ }
        return clone(fallback);
    });
    useEffect(() => {
        try { localStorage.setItem(key, JSON.stringify(layout)); } catch { /* storage blocked */ }
    }, [key, layout]);

    const has = useCallback((id) => layout.left.includes(id) || layout.right.includes(id), [layout]);

    const toggle = useCallback((id) => setLayout((l) => {
        if (id === "code") return l;
        const next = clone(l);
        if (next.left.includes(id) || next.right.includes(id)) {
            next.left = next.left.filter((x) => x !== id);
            next.right = next.right.filter((x) => x !== id);
        } else if (below[id] && (next.left.includes(below[id]) || next.right.includes(below[id]))) {
            const col = next.left.includes(below[id]) ? "left" : "right";
            next[col].splice(next[col].indexOf(below[id]) + 1, 0, id);
        } else {
            // Other cards open beside the code, in the other column.
            const col = next.left.includes("code") ? "right" : "left";
            next[col].unshift(id);
        }
        return next;
    }), [below]);

    // Move a card into a column at an index (it is removed from where it was first).
    const move = useCallback((id, col, index) => setLayout((l) => {
        const next = clone(l);
        const from = next.left.includes(id) ? "left" : next.right.includes(id) ? "right" : null;
        let at = index;
        if (from) {
            const i = next[from].indexOf(id);
            next[from].splice(i, 1);
            if (from === col && i < index) at -= 1;
        }
        next[col].splice(Math.max(0, Math.min(at, next[col].length)), 0, id);
        return valid(next) ? next : l;
    }), [valid]);

    const applyPreset = useCallback((id) => {
        const p = presets.find((x) => x.id === id);
        if (p) setLayout(clone(p.layout));
    }, [presets]);

    // The card being dragged lives here (not in RoomLayout) so a panel drawn outside the layout,
    // like the docked call window, can start a drag of its own card.
    const [dragging, setDragging] = useState(null);

    const presetId = presets.find((p) => JSON.stringify(p.layout) === JSON.stringify(layout))?.id || null;

    return {
        layout, has, toggle, move, applyPreset, presetId, dragging, setDragging,
        panels, presets, toggles: config.toggles || [],
        reset: () => setLayout(clone(fallback)),
    };
}

// A card that another component draws over (the docked call): the card renders an empty slot
// and this reports where it is on screen, following splitter drags and window resizes.
export function useDockSlot() {
    const [slot, setSlot] = useState(null);
    const [rect, setRect] = useState(null);
    useEffect(() => {
        if (!slot) { setRect(null); return undefined; }
        const measure = () => {
            const r = slot.getBoundingClientRect();
            setRect((p) => (p && p.left === r.left && p.top === r.top && p.width === r.width && p.height === r.height
                ? p : { left: r.left, top: r.top, width: r.width, height: r.height }));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(slot);
        const area = slot.closest(".rl");
        if (area) ro.observe(area);
        window.addEventListener("resize", measure);
        return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
    }, [slot]);
    return [setSlot, rect];
}

// The grip that moves a card. Cards draw it in their tab; the code editor and the docked call
// draw it in their own toolbar.
export function CardHandle({ id, state, label, onDragStart, onDragEnd }) {
    const name = label || state?.panels?.[id]?.label || PANELS[id]?.label || id;
    return (
        <span
            className="rl-handle"
            draggable
            onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", id);
                (onDragStart || state.setDragging)(id);
            }}
            onDragEnd={onDragEnd || (() => state.setDragging(null))}
            title={`Drag to move ${name}`}
            aria-label={`Move ${name}`}
        >
            <GripVertical size={14} />
        </span>
    );
}

// Card frame: a slim tab (handle + title + hide) above the panel, unless the panel puts the
// handle in its own toolbar (the code editor does, to avoid a second row).
function Card({ id, label, render, dragging, onDragStart, onDragEnd, onDropAt, onHide, inlineHandle }) {
    const [zone, setZone] = useState(null); // "before" | "after"
    const handle = <CardHandle id={id} label={label} onDragStart={onDragStart} onDragEnd={onDragEnd} />;
    return (
        <div className={`rl-card${dragging === id ? " is-dragging" : ""}`}>
            {!inlineHandle && (
                <div className="rl-tab">
                    {handle}
                    <span className="rl-title">{label}</span>
                    {onHide && <button className="rl-hide" onClick={onHide} title={`Hide ${label}`} aria-label={`Hide ${label}`}><X size={13} /></button>}
                </div>
            )}
            <div className="rl-body">{render(inlineHandle ? handle : null)}</div>
            {dragging && dragging !== id && (
                <div
                    className={`rl-drop${zone ? ` is-${zone}` : ""}`}
                    onDragOver={(e) => {
                        e.preventDefault();
                        const r = e.currentTarget.getBoundingClientRect();
                        setZone(e.clientY - r.top < r.height / 2 ? "before" : "after");
                    }}
                    onDragLeave={() => setZone(null)}
                    onDrop={(e) => { e.preventDefault(); onDropAt(zone || "after"); setZone(null); }}
                >
                    <span>{zone === "before" ? "Place above" : "Place below"} {label}</span>
                </div>
            )}
        </div>
    );
}

// `hidden`: cards that stay in the layout but are not shown right now (the project's output panel
// keeps its own show/hide). `onHideCard(id)` returns true when the page handled a card's ✕ itself.
export default function RoomLayout({ state, renderPanel, inlineHandles = [], flexOf, hidden = [], onHideCard }) {
    const { layout, move, toggle, dragging, setDragging, panels } = state;
    const endDrag = () => setDragging(null);

    // Default heights: the card under the code is a short strip (I/O, output).
    const flexFor = flexOf || ((id, ids) => (id === "io" || id === "output" ? 0.35 : id === "code" && ids.some((x) => x === "io" || x === "output") ? 0.65 : 1 / ids.length));

    const column = (col) => {
        const ids = layout[col].filter((id) => !hidden.includes(id));
        if (!ids.length) {
            return dragging ? (
                <div
                    className="rl-empty-col"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); move(dragging, col, 0); endDrag(); }}
                >
                    Drop here for a new column
                </div>
            ) : null;
        }
        return (
            <ReflexContainer orientation="horizontal" key={`${col}-${ids.join("-")}`}>
                {ids.flatMap((id, i) => {
                    const items = [];
                    if (i > 0) items.push(<ReflexSplitter key={`s-${id}`} />);
                    items.push(
                        <ReflexElement key={id} minSize={90} flex={flexFor(id, ids)}>
                            <Card
                                id={id}
                                label={panels[id].label}
                                render={(handle) => renderPanel(id, handle)}
                                inlineHandle={id === "code" || inlineHandles.includes(id)}
                                dragging={dragging}
                                onDragStart={setDragging}
                                onDragEnd={endDrag}
                                onHide={id === "code" ? null : () => { if (!onHideCard?.(id)) toggle(id); }}
                                onDropAt={(zone) => {
                                    if (dragging) move(dragging, col, zone === "before" ? i : i + 1);
                                    endDrag();
                                }}
                            />
                        </ReflexElement>
                    );
                    return items;
                })}
            </ReflexContainer>
        );
    };

    const left = column("left");
    const right = column("right");
    const both = left && right;

    return (
        <div className={`rl${dragging ? " is-arranging" : ""}`}>
            <ReflexContainer orientation="vertical" key={both ? "two" : "one"}>
                {left && <ReflexElement key="left" flex={both ? (layout.left.includes("code") ? 0.62 : 0.38) : 1} minSize={layout.left.length ? 240 : 120}>{left}</ReflexElement>}
                {both && <ReflexSplitter key="split" />}
                {right && <ReflexElement key="right" flex={both ? (layout.left.includes("code") ? 0.38 : 0.62) : 1} minSize={layout.right.length ? 240 : 120}>{right}</ReflexElement>}
            </ReflexContainer>
        </div>
    );
}

// Layout picker: presets drawn as tiny diagrams, plus show/hide toggles for each card.
// `classic` (projects): an extra first choice that turns cards off and keeps the sidebar layout.
export function LayoutMenu({ state, onClose, classic }) {
    const ref = useRef(null);
    useEffect(() => {
        const away = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
        const esc = (e) => e.key === "Escape" && onClose();
        document.addEventListener("mousedown", away);
        document.addEventListener("keydown", esc);
        return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
    }, [onClose]);

    const cardsOn = !classic || !classic.on;

    const mini = (l) => (
        <span className="rl-mini" aria-hidden="true">
            {["left", "right"].filter((c) => l[c].length).map((c) => (
                <span key={c} className="rl-mini-col" style={{ flex: l[c].includes("code") ? 1.6 : 1 }}>
                    {l[c].map((id) => <i key={id} className={`rl-mini-${id}`} style={{ flex: id === "io" || id === "output" ? 0.6 : 1 }} />)}
                </span>
            ))}
        </span>
    );

    return (
        <div className="rl-menu" ref={ref} role="dialog" aria-label="Layout">
            <div className="rl-menu-head"><LayoutTemplate size={14} /> Layout <span>{cardsOn ? "Drag a card's grip to rearrange" : "Pick a card layout to rearrange panels"}</span></div>
            <div className="rl-presets">
                {classic && (
                    <button className={classic.on ? "on" : ""} onClick={classic.onPick}>
                        <span className="rl-mini rl-mini--classic" aria-hidden="true"><PanelLeft size={18} /></span>
                        <b>Classic</b>
                        <em>Sidebar and editor</em>
                    </button>
                )}
                {state.presets.map((p) => (
                    <button key={p.id} className={cardsOn && state.presetId === p.id ? "on" : ""} onClick={() => { state.applyPreset(p.id); classic?.onCards?.(); }}>
                        {mini(p.layout)}
                        <b>{p.label}</b>
                        <em>{p.note}</em>
                    </button>
                ))}
            </div>
            {cardsOn && (
                <div className="rl-toggles">
                    {state.toggles.map((id) => (
                        <button key={id} onClick={() => state.toggle(id)} aria-pressed={state.has(id)}>
                            <span className={`rl-check${state.has(id) ? " on" : ""}`}>{state.has(id) && <Check size={11} />}</span>
                            {state.panels[id].label}
                        </button>
                    ))}
                    <button className="rl-reset" onClick={state.reset}><RotateCcw size={12} /> Reset</button>
                </div>
            )}
        </div>
    );
}
