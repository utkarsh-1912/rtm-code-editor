import React, { useCallback, useEffect, useRef, useState } from "react";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import { GripVertical, X, LayoutTemplate, Check, RotateCcw } from "lucide-react";

// Room workspace as rearrangeable cards (LeetCode style): two columns of stacked panels.
// Drag a card by its handle onto another card's top or bottom half to move it there.

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

const KEY = "room-layout-v1";
const DEFAULT = PRESETS[1].layout; // what rooms looked like before: chat, then code over I/O

function valid(l) {
    if (!l || !Array.isArray(l.left) || !Array.isArray(l.right)) return false;
    const all = [...l.left, ...l.right];
    return all.includes("code") && all.every((id) => PANELS[id]) && new Set(all).size === all.length;
}

const clone = (l) => ({ left: [...l.left], right: [...l.right] });

export function useRoomLayout() {
    const [layout, setLayout] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(KEY));
            if (valid(saved)) return saved;
        } catch { /* storage blocked */ }
        return clone(DEFAULT);
    });
    useEffect(() => {
        try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch { /* storage blocked */ }
    }, [layout]);

    const has = useCallback((id) => layout.left.includes(id) || layout.right.includes(id), [layout]);

    const toggle = useCallback((id) => setLayout((l) => {
        if (id === "code") return l;
        const next = clone(l);
        if (next.left.includes(id) || next.right.includes(id)) {
            next.left = next.left.filter((x) => x !== id);
            next.right = next.right.filter((x) => x !== id);
        } else if (id === "io") {
            const col = next.left.includes("code") ? "left" : "right";
            next[col].splice(next[col].indexOf("code") + 1, 0, "io");
        } else {
            // Problem, chat and call open beside the code, in the other column.
            const col = next.left.includes("code") ? "right" : "left";
            next[col].unshift(id);
        }
        return next;
    }), []);

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
    }), []);

    const applyPreset = useCallback((id) => {
        const p = PRESETS.find((x) => x.id === id);
        if (p) setLayout(clone(p.layout));
    }, []);

    // The card being dragged lives here (not in RoomLayout) so a panel drawn outside the layout,
    // like the docked call window, can start a drag of its own card.
    const [dragging, setDragging] = useState(null);

    const presetId = PRESETS.find((p) => JSON.stringify(p.layout) === JSON.stringify(layout))?.id || null;

    return { layout, has, toggle, move, applyPreset, presetId, dragging, setDragging, reset: () => setLayout(clone(DEFAULT)) };
}

// The grip that moves a card. Cards draw it in their tab; the code editor and the docked call
// draw it in their own toolbar.
export function CardHandle({ id, state, onDragStart, onDragEnd }) {
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
            title={`Drag to move ${PANELS[id].label}`}
            aria-label={`Move ${PANELS[id].label}`}
        >
            <GripVertical size={14} />
        </span>
    );
}

// Card frame: a slim tab (handle + title + hide) above the panel, unless the panel puts the
// handle in its own toolbar (the code editor does, to avoid a second row).
function Card({ id, render, dragging, onDragStart, onDragEnd, onDropAt, onHide, inlineHandle }) {
    const [zone, setZone] = useState(null); // "before" | "after"
    const handle = <CardHandle id={id} onDragStart={onDragStart} onDragEnd={onDragEnd} />;
    return (
        <div className={`rl-card${dragging === id ? " is-dragging" : ""}`}>
            {!inlineHandle && (
                <div className="rl-tab">
                    {handle}
                    <span className="rl-title">{PANELS[id].label}</span>
                    {onHide && <button className="rl-hide" onClick={onHide} title={`Hide ${PANELS[id].label}`} aria-label={`Hide ${PANELS[id].label}`}><X size={13} /></button>}
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
                    <span>{zone === "before" ? "Place above" : "Place below"} {PANELS[id].label}</span>
                </div>
            )}
        </div>
    );
}

export default function RoomLayout({ state, renderPanel, inlineHandles = [] }) {
    const { layout, move, toggle, dragging, setDragging } = state;
    const endDrag = () => setDragging(null);

    const column = (col) => {
        const ids = layout[col];
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
                        <ReflexElement key={id} minSize={90} flex={id === "io" ? 0.35 : id === "code" && ids.includes("io") ? 0.65 : 1 / ids.length}>
                            <Card
                                id={id}
                                render={(handle) => renderPanel(id, handle)}
                                inlineHandle={id === "code" || inlineHandles.includes(id)}
                                dragging={dragging}
                                onDragStart={setDragging}
                                onDragEnd={endDrag}
                                onHide={id === "code" ? null : () => toggle(id)}
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
export function LayoutMenu({ state, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const away = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
        const esc = (e) => e.key === "Escape" && onClose();
        document.addEventListener("mousedown", away);
        document.addEventListener("keydown", esc);
        return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
    }, [onClose]);

    const mini = (l) => (
        <span className="rl-mini" aria-hidden="true">
            {["left", "right"].filter((c) => l[c].length).map((c) => (
                <span key={c} className="rl-mini-col" style={{ flex: l[c].includes("code") ? 1.6 : 1 }}>
                    {l[c].map((id) => <i key={id} className={`rl-mini-${id}`} style={{ flex: id === "io" ? 0.6 : 1 }} />)}
                </span>
            ))}
        </span>
    );

    return (
        <div className="rl-menu" ref={ref} role="dialog" aria-label="Layout">
            <div className="rl-menu-head"><LayoutTemplate size={14} /> Layout <span>Drag a card's grip to rearrange</span></div>
            <div className="rl-presets">
                {PRESETS.map((p) => (
                    <button key={p.id} className={state.presetId === p.id ? "on" : ""} onClick={() => state.applyPreset(p.id)}>
                        {mini(p.layout)}
                        <b>{p.label}</b>
                        <em>{p.note}</em>
                    </button>
                ))}
            </div>
            <div className="rl-toggles">
                {["problem", "io", "chat", "call"].map((id) => (
                    <button key={id} onClick={() => state.toggle(id)} aria-pressed={state.has(id)}>
                        <span className={`rl-check${state.has(id) ? " on" : ""}`}>{state.has(id) && <Check size={11} />}</span>
                        {PANELS[id].label}
                    </button>
                ))}
                <button className="rl-reset" onClick={state.reset}><RotateCcw size={12} /> Reset</button>
            </div>
        </div>
    );
}
