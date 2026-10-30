// Flowchart / system-design diagrams on the whiteboard canvas.
//
// Elements (stored and synced like any other whiteboard element):
//   node:      { id, type: "node", shape, x, y, w, h, text, color, badge?, kind?, sim? }
//              (sim: capacity for simulate mode, see whiteboard/sim/topology.js)
//   connector: { id, type: "connector", from, to, label, color, route: "straight"|"elbow",
//                dashed, arrows: "end"|"both"|"none" }
// Connectors reference nodes by id, so they follow the nodes when those move.

export const GRID = 12;
export const snap = (v) => Math.round(v / GRID) * GRID;

// Basic flowchart shapes.
export const SHAPES = [
    { id: "process", label: "Process", w: 168, h: 72 },
    { id: "terminal", label: "Start / end", w: 168, h: 56 },
    { id: "decision", label: "Decision", w: 144, h: 108 },
    { id: "io", label: "Input / output", w: 176, h: 68 },
    { id: "database", label: "Database", w: 132, h: 96 },
    { id: "document", label: "Document", w: 160, h: 84 },
    { id: "note", label: "Sticky note", w: 168, h: 120 },
    { id: "actor", label: "User", w: 64, h: 108 },
];

// System design building blocks: a shape plus a type badge and a colour.
export const TEMPLATES = [
    { id: "client", label: "Client", shape: "process", badge: "CLIENT", color: "#38BDF8", text: "Web / mobile app" },
    { id: "user", label: "User", shape: "actor", badge: "", color: "ink", text: "User" },
    { id: "lb", label: "Load balancer", shape: "terminal", badge: "LB", color: "#A78BFA", text: "Load balancer" },
    { id: "gateway", label: "API gateway", shape: "process", badge: "GATEWAY", color: "#A78BFA", text: "API gateway" },
    { id: "service", label: "Service", shape: "process", badge: "SERVICE", color: "#7AA2FF", text: "Service" },
    { id: "worker", label: "Worker", shape: "process", badge: "WORKER", color: "#7AA2FF", text: "Background worker" },
    { id: "db", label: "Database", shape: "database", badge: "SQL", color: "#4ADE80", text: "Database" },
    { id: "nosql", label: "NoSQL", shape: "database", badge: "NOSQL", color: "#4ADE80", text: "Document store" },
    { id: "cache", label: "Cache", shape: "database", badge: "CACHE", color: "#F05252", text: "Cache (Redis)" },
    { id: "queue", label: "Queue", shape: "queue", badge: "QUEUE", color: "#F5B544", text: "Message queue" },
    { id: "storage", label: "Object storage", shape: "database", badge: "BLOB", color: "#F5B544", text: "Object storage" },
    { id: "cdn", label: "CDN", shape: "cloud", badge: "CDN", color: "#38BDF8", text: "CDN" },
    { id: "external", label: "External API", shape: "cloud", badge: "EXT", color: "#94A3B8", text: "Third-party API" },
    { id: "search", label: "Search", shape: "process", badge: "SEARCH", color: "#F472B6", text: "Search index" },
];

const SIZE = Object.fromEntries([...SHAPES, { id: "queue", w: 176, h: 64 }, { id: "cloud", w: 176, h: 100 }].map((s) => [s.id, s]));

export function makeNode({ shape = "process", template, x, y, color = "ink", id }) {
    const t = template ? TEMPLATES.find((tt) => tt.id === template) : null;
    const s = t ? t.shape : shape;
    const size = SIZE[s] || SIZE.process;
    return {
        id,
        type: "node",
        shape: s,
        kind: t?.id || null,
        badge: t?.badge || "",
        x: snap(x - size.w / 2),
        y: snap(y - size.h / 2),
        w: size.w,
        h: size.h,
        text: t ? t.text : "",
        color: t ? t.color : color,
    };
}

// The same node as another shape or block, keeping its id (so connectors stay attached),
// centre, text style and, if it was resized, its size. Template text and colour follow the
// new block unless they had been changed.
export function retypeNode(n, { shape = "process", template }) {
    const t = template ? TEMPLATES.find((tt) => tt.id === template) : null;
    const prev = n.kind ? TEMPLATES.find((tt) => tt.id === n.kind) : null;
    const s = t ? t.shape : shape;
    const size = SIZE[s] || SIZE.process;
    const prevSize = SIZE[n.shape] || SIZE.process;
    const resized = n.w !== prevSize.w || n.h !== prevSize.h;
    const w = resized ? n.w : size.w, h = resized ? n.h : size.h;
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const defaultText = !n.text || (prev && n.text === prev.text);
    const defaultColor = n.color === "ink" || (prev && n.color === prev.color);
    return {
        ...n,
        shape: s,
        kind: t?.id || null,
        badge: t?.badge || "",
        x: snap(cx - w / 2),
        y: snap(cy - h / 2),
        w,
        h,
        text: t && defaultText ? t.text : n.text,
        color: t && defaultColor ? t.color : n.color,
    };
}

// ---- colour helpers --------------------------------------------------------------------
const hexToRgb = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const withAlpha = (color, a) => {
    const rgb = hexToRgb(color);
    return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : color;
};

// ---- geometry --------------------------------------------------------------------------
const center = (n) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

// Where a line from the node's centre towards (tx, ty) leaves the node's outline.
function boundaryPoint(n, tx, ty) {
    const c = center(n);
    const dx = tx - c.x, dy = ty - c.y;
    if (!dx && !dy) return c;
    const hw = n.w / 2, hh = n.h / 2;
    let t;
    if (n.shape === "decision") t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
    else t = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
    return { x: c.x + dx * t, y: c.y + dy * t };
}

// Middle of the side facing the other node (used by elbow routes).
function sideAnchor(n, other) {
    const c = center(n), o = center(other);
    const dx = o.x - c.x, dy = o.y - c.y;
    if (Math.abs(dx) * n.h >= Math.abs(dy) * n.w) return { x: dx >= 0 ? n.x + n.w : n.x, y: c.y, axis: "x" };
    return { x: c.x, y: dy >= 0 ? n.y + n.h : n.y, axis: "y" };
}

// The polyline for a connector (2 points straight, 4 points elbow).
export function connectorPath(conn, byId, pointer) {
    const a = byId[conn.from];
    const b = conn.to ? byId[conn.to] : null;
    if (!a) return null;
    if (!b) {
        if (!pointer) return null;
        return [boundaryPoint(a, pointer.x, pointer.y), pointer];
    }
    if (conn.route === "elbow") {
        const p = sideAnchor(a, b), q = sideAnchor(b, a);
        if (p.axis === "x") {
            const mx = (p.x + q.x) / 2;
            return q.axis === "x" ? [p, { x: mx, y: p.y }, { x: mx, y: q.y }, q] : [p, { x: q.x, y: p.y }, q];
        }
        const my = (p.y + q.y) / 2;
        return q.axis === "y" ? [p, { x: p.x, y: my }, { x: q.x, y: my }, q] : [p, { x: p.x, y: q.y }, q];
    }
    const cb = center(b), ca = center(a);
    return [boundaryPoint(a, cb.x, cb.y), boundaryPoint(b, ca.x, ca.y)];
}

const distToSegment = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const midOfPath = (pts) => {
    if (pts.length === 4) return { x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2 };
    if (pts.length === 3) return pts[1];
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
};

// ---- hit testing -----------------------------------------------------------------------
export function inNode(n, x, y, pad = 0) {
    if (n.shape === "decision") {
        const c = center(n);
        return Math.abs(x - c.x) / (n.w / 2 + pad) + Math.abs(y - c.y) / (n.h / 2 + pad) <= 1;
    }
    return x >= n.x - pad && x <= n.x + n.w + pad && y >= n.y - pad && y <= n.y + n.h + pad;
}

export function nodeAt(elements, x, y) {
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === "node" && inNode(el, x, y)) return el;
    }
    return null;
}

export function connectorAt(elements, byId, x, y, tolerance) {
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type !== "connector") continue;
        const pts = connectorPath(el, byId);
        if (!pts) continue;
        for (let k = 0; k < pts.length - 1; k++) if (distToSegment({ x, y }, pts[k], pts[k + 1]) <= tolerance) return el;
        if (el.label) {
            const m = midOfPath(pts);
            if (Math.abs(x - m.x) < 40 && Math.abs(y - m.y) < 12) return el;
        }
    }
    return null;
}

// Corner resize handles of a node: "nw" | "ne" | "sw" | "se", or null.
const OUTLINE_PAD = 5;
export function onResizeHandle(n, x, y, zoom) {
    const tol = 9 / zoom;
    const xs = { w: n.x - OUTLINE_PAD, e: n.x + n.w + OUTLINE_PAD };
    const ys = { n: n.y - OUTLINE_PAD, s: n.y + n.h + OUTLINE_PAD };
    for (const v of ["n", "s"]) for (const h of ["w", "e"]) {
        if (Math.abs(x - xs[h]) <= tol && Math.abs(y - ys[v]) <= tol) return v + h;
    }
    return null;
}

// Text sizes offered in the selection toolbar (px at 100% zoom).
export const TEXT_SIZES = [{ id: "S", px: 12 }, { id: "M", px: 13.5 }, { id: "L", px: 18 }, { id: "XL", px: 24 }];

export const labelPoint = (conn, byId) => {
    const pts = connectorPath(conn, byId);
    return pts ? midOfPath(pts) : null;
};

// ---- drawing ---------------------------------------------------------------------------
function wrapText(ctx, text, maxWidth) {
    const out = [];
    for (const para of String(text || "").split("\n")) {
        let line = "";
        for (const word of para.split(/\s+/)) {
            const next = line ? `${line} ${word}` : word;
            if (ctx.measureText(next).width > maxWidth && line) {
                out.push(line);
                line = word;
            } else line = next;
        }
        out.push(line);
    }
    return out;
}

function shapePath(ctx, n) {
    const { x, y, w, h } = n;
    ctx.beginPath();
    switch (n.shape) {
        case "terminal": {
            const r = Math.min(h / 2, w / 2);
            ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
            break;
        }
        case "decision":
            ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath();
            break;
        case "io": {
            const k = Math.min(22, w * 0.15);
            ctx.moveTo(x + k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - k, y + h); ctx.lineTo(x, y + h); ctx.closePath();
            break;
        }
        case "database": {
            const ry = Math.min(12, h * 0.14);
            ctx.moveTo(x, y + ry);
            ctx.ellipse(x + w / 2, y + ry, w / 2, ry, 0, Math.PI, 0, false);
            ctx.lineTo(x + w, y + h - ry);
            ctx.ellipse(x + w / 2, y + h - ry, w / 2, ry, 0, 0, Math.PI, false);
            ctx.closePath();
            break;
        }
        case "document": {
            const wave = Math.min(10, h * 0.14);
            ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - wave);
            ctx.bezierCurveTo(x + w * 0.75, y + h - wave * 2.4, x + w * 0.5, y + h + wave * 0.6, x + w * 0.25, y + h - wave * 0.6);
            ctx.quadraticCurveTo(x + w * 0.12, y + h - wave * 1.4, x, y + h - wave);
            ctx.closePath();
            break;
        }
        case "cloud": {

            ctx.moveTo(x + w * 0.22, y + h * 0.82);
            ctx.bezierCurveTo(x - w * 0.02, y + h * 0.82, x - w * 0.02, y + h * 0.42, x + w * 0.2, y + h * 0.42);
            ctx.bezierCurveTo(x + w * 0.2, y + h * 0.08, x + w * 0.55, y + h * 0.02, x + w * 0.62, y + h * 0.28);
            ctx.bezierCurveTo(x + w * 0.78, y + h * 0.12, x + w * 1.02, y + h * 0.3, x + w * 0.86, y + h * 0.5);
            ctx.bezierCurveTo(x + w * 1.04, y + h * 0.6, x + w * 0.96, y + h * 0.9, x + w * 0.76, y + h * 0.82);
            ctx.closePath();
            break;
        }
        case "actor":
            break;
        default: {
            const r = n.shape === "note" ? 4 : 8;
            ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
        }
    }
}

export function drawNode(ctx, n, { ink, editing }) {
    const stroke = n.color === "ink" ? ink : n.color;
    const fill = n.shape === "note"
        ? withAlpha(n.color === "ink" ? "#F5B544" : stroke, 0.28)
        : n.color === "ink" ? withAlpha(ink === "#F2F1EC" ? "#F2F1EC" : "#1B1A17", 0.05) : withAlpha(stroke, 0.12);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;

    if (n.shape === "actor") {
        const cx = n.x + n.w / 2, top = n.y + 4, head = Math.min(13, n.w * 0.22);
        ctx.beginPath(); ctx.arc(cx, top + head, head, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const neck = top + head * 2, hip = n.y + n.h * 0.62;
        ctx.beginPath();
        ctx.moveTo(cx, neck); ctx.lineTo(cx, hip);
        ctx.moveTo(cx - n.w * 0.36, neck + 12); ctx.lineTo(cx + n.w * 0.36, neck + 12);
        ctx.moveTo(cx, hip); ctx.lineTo(cx - n.w * 0.3, n.y + n.h * 0.86);
        ctx.moveTo(cx, hip); ctx.lineTo(cx + n.w * 0.3, n.y + n.h * 0.86);
        ctx.stroke();
    } else {
        shapePath(ctx, n);
        ctx.fill();
        ctx.stroke();
        if (n.shape === "database") {
            const ry = Math.min(12, n.h * 0.14);
            ctx.beginPath();
            ctx.ellipse(n.x + n.w / 2, n.y + ry, n.w / 2, ry, 0, 0, Math.PI, false);
            ctx.stroke();
        }
        if (n.shape === "queue") {
            ctx.beginPath();
            for (let i = 1; i <= 3; i++) {
                const qx = n.x + n.w - i * 12;
                ctx.moveTo(qx, n.y + 8); ctx.lineTo(qx, n.y + n.h - 8);
            }
            ctx.globalAlpha = 0.55;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    // Type badge (system design blocks).
    if (n.badge) {
        ctx.font = "700 9px ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
        const bw = ctx.measureText(n.badge).width + 10;
        const bx = n.shape === "cloud" ? n.x + n.w * 0.3 : n.shape === "io" ? n.x + 26 : n.x + 8;
        const by = n.shape === "database" ? n.y + 22 : n.shape === "cloud" ? n.y + n.h * 0.3 : n.y + 8;
        ctx.fillStyle = withAlpha(stroke, 0.9);
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(bx, by, bw, 14, 3) : ctx.rect(bx, by, bw, 14);
        ctx.fill();
        ctx.fillStyle = "#0B0B0A";
        ctx.textBaseline = "middle";
        ctx.fillText(n.badge, bx + 5, by + 7.5);
    }

    // Label text, wrapped (below the figure for actors). Size, weight and alignment come
    // from the node (fontSize, bold, align: left|center|right, valign: top|middle|bottom).
    if (!editing && n.text) {
        const fs = n.fontSize || 13.5;
        ctx.font = `${n.bold ? 700 : 500} ${fs}px Inter, Archivo, system-ui, sans-serif`;
        ctx.fillStyle = ink;
        ctx.textBaseline = "middle";
        const inset = n.shape === "decision" ? n.w * 0.22 : n.shape === "io" ? 24 : n.shape === "cloud" ? n.w * 0.18 : 12;
        const maxW = n.shape === "actor" ? 140 : Math.max(30, n.w - inset * 2);
        const lines = wrapText(ctx, n.text, maxW).slice(0, 12);
        const lh = Math.round(fs * 1.26);
        const badgeShift = n.badge && n.shape !== "decision" ? 7 : 0;
        const actor = n.shape === "actor";
        const align = actor ? "center" : n.align || "center";
        const valign = actor ? "middle" : n.valign || "middle";
        const span = (lines.length - 1) * lh;
        const topPad = (n.badge && n.shape !== "decision" ? 26 : 10) + (n.shape === "database" ? 14 : 0);
        const bottomPad = 10 + (n.shape === "database" ? 12 : n.shape === "document" ? 10 : 0);
        const cy = actor ? n.y + n.h + 12 + span / 2
            : valign === "top" ? n.y + topPad + lh / 2 + span / 2
                : valign === "bottom" ? n.y + n.h - bottomPad - lh / 2 - span / 2
                    : n.shape === "database" ? n.y + n.h / 2 + 6 + badgeShift
                        : n.shape === "cloud" ? n.y + n.h * 0.58
                            : n.y + n.h / 2 + badgeShift;
        ctx.textAlign = align;
        const tx = align === "left" ? n.x + inset : align === "right" ? n.x + n.w - inset : n.x + n.w / 2;
        lines.forEach((line, i) => ctx.fillText(line, tx, cy + (i - (lines.length - 1) / 2) * lh));
        ctx.textAlign = "start";
    }
    ctx.restore();
}

// ---- simulate mode ---------------------------------------------------------------------
export const SIM_LEVEL_COLOR = ["", "#F5B544", "#F05252"]; // ok, busy, saturated / dropping

// A strip under the node with its measured numbers; `level` tints it and rings the shape.
export function drawSimFooter(ctx, n, { text, level = 0 }, { ink, bg }) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const tone = SIM_LEVEL_COLOR[level];
    if (tone && n.shape !== "actor") {
        ctx.strokeStyle = withAlpha(tone, 0.85);
        ctx.lineWidth = 3;
        shapePath(ctx, n);
        ctx.stroke();
    }
    ctx.font = "600 10.5px ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
    const tw = ctx.measureText(text).width + 14;
    const cx = n.x + n.w / 2;
    const top = n.shape === "actor" ? n.y + n.h + 30 : n.y + n.h + 6;
    ctx.fillStyle = bg;
    ctx.strokeStyle = tone || withAlpha(ink === "#F2F1EC" ? "#F2F1EC" : "#1B1A17", 0.2);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx - tw / 2, top, tw, 18, 9) : ctx.rect(cx - tw / 2, top, tw, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone || ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, top + 9.5);
    ctx.restore();
}

export function drawConnector(ctx, conn, byId, { ink, bg, pointer, selected, editing, rate }) {
    const pts = connectorPath(conn, byId, pointer);
    if (!pts) return;
    const color = conn.color === "ink" || !conn.color ? ink : conn.color;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = selected ? 2.6 : 1.8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (conn.dashed || !conn.to) ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.setLineDash([]);

    const head = (from, to) => {
        const ang = Math.atan2(to.y - from.y, to.x - from.x);
        const s = 10;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - s * Math.cos(ang - 0.42), to.y - s * Math.sin(ang - 0.42));
        ctx.lineTo(to.x - s * Math.cos(ang + 0.42), to.y - s * Math.sin(ang + 0.42));
        ctx.closePath();
        ctx.fill();
    };
    const arrows = conn.arrows || "end";
    if (arrows !== "none") head(pts[pts.length - 2], pts[pts.length - 1]);
    if (arrows === "both") head(pts[1], pts[0]);

    // While simulating, the measured rate rides along with the label.
    const label = rate ? (conn.label ? `${conn.label} · ${rate}` : rate) : conn.label;
    if (label && !editing) {
        const m = midOfPath(pts);
        ctx.font = rate ? "600 11.5px ui-monospace, 'SF Mono', Menlo, Consolas, monospace" : "500 12px Inter, Archivo, system-ui, sans-serif";
        const tw = ctx.measureText(label).width + 12;
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(m.x - tw / 2, m.y - 10, tw, 20, 6) : ctx.rect(m.x - tw / 2, m.y - 10, tw, 20);
        ctx.fill();
        ctx.fillStyle = ink;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, m.x, m.y + 0.5);
        ctx.textAlign = "start";
    }
    if (selected) {
        ctx.fillStyle = "#7AA2FF";
        [pts[0], pts[pts.length - 1]].forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); });
    }
    ctx.restore();
}

// Selection outline + resize handle for a node; "target" outline while connecting.
export function drawNodeOutline(ctx, n, zoom, { handle = true, accent = "#7AA2FF" } = {}) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5 / zoom;
    const p = OUTLINE_PAD;
    ctx.strokeRect(n.x - p, n.y - p, n.w + p * 2, n.h + p * 2);
    if (handle) {
        const s = 8 / zoom;
        ctx.fillStyle = "#fff";
        [[n.x - p, n.y - p], [n.x + n.w + p, n.y - p], [n.x - p, n.y + n.h + p], [n.x + n.w + p, n.y + n.h + p]].forEach(([hx, hy]) => {
            ctx.fillRect(hx - s / 2, hy - s / 2, s, s);
            ctx.strokeRect(hx - s / 2, hy - s / 2, s, s);
        });
    }
    ctx.restore();
}

// Small SVG previews for the shape library.
export const SHAPE_PREVIEW = {
    process: "M3 5h26v16H3z",
    terminal: "M10 6h12a7 7 0 0 1 0 14H10a7 7 0 0 1 0-14z",
    decision: "M16 3l13 10-13 10L3 13z",
    io: "M8 6h21l-5 14H3z",
    database: "M4 7c0-3 24-3 24 0v12c0 3-24 3-24 0zM4 7c0 3 24 3 24 0",
    document: "M4 4h24v14c-6-3-10 4-16 2-3-1-5-1-8 0z",
    note: "M5 4h22v18H5z",
    actor: "M16 4a3 3 0 1 0 0.01 0M16 10v7M10 12h12M16 17l-5 6M16 17l5 6",
    queue: "M3 6h26v14H3zM20 8v10M24 8v10",
    cloud: "M9 21c-5 0-5-7 0-7 0-6 8-7 10-3 3-3 9 0 7 4 4 1 3 6-1 6z",
};
