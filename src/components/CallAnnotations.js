import React, { useEffect, useRef } from "react";

const FADE_MS = 4500;
const PTR_TTL = 3000;

const colorFor = (id = "") => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return `hsl(${h}, 85%, 58%)`;
};

// Transparent layer over a shared screen: everyone can draw (strokes fade out, like Pop)
// and see each other's labelled pointers. Coordinates are normalised to 0..1.
export default function CallAnnotations({ socketRef, projectId, drawing, userName }) {
    const canvasRef = useRef(null);
    const segsRef = useRef([]);       // { a:[x,y], b:[x,y], color, ts }
    const ptrsRef = useRef({});       // userId -> { x, y, name, ts }
    const lastRef = useRef(null);
    const lastPtrSent = useRef(0);
    const downRef = useRef(false);

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;
        const onAnnotate = ({ userId, name, event }) => {
            if (!event) return;
            if (event.t === "seg") segsRef.current.push({ a: event.a, b: event.b, color: colorFor(userId), ts: performance.now() });
            if (event.t === "ptr") ptrsRef.current[userId] = { x: event.x, y: event.y, name: name || "Guest", ts: performance.now() };
            if (event.t === "clear") segsRef.current = [];
        };
        socket.on("call-annotate", onAnnotate);
        return () => socket.off("call-annotate", onAnnotate);
    }, [socketRef]);

    useEffect(() => {
        let raf;
        const draw = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                const { clientWidth: w, clientHeight: h } = canvas;
                if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
                const ctx = canvas.getContext("2d");
                ctx.clearRect(0, 0, w, h);
                const now = performance.now();
                segsRef.current = segsRef.current.filter((s) => now - s.ts < FADE_MS);
                ctx.lineCap = "round";
                ctx.lineWidth = 4;
                for (const s of segsRef.current) {
                    ctx.globalAlpha = 1 - (now - s.ts) / FADE_MS;
                    ctx.strokeStyle = s.color;
                    ctx.beginPath();
                    ctx.moveTo(s.a[0] * w, s.a[1] * h);
                    ctx.lineTo(s.b[0] * w, s.b[1] * h);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
                ctx.font = "600 11px Inter, sans-serif";
                for (const [id, p] of Object.entries(ptrsRef.current)) {
                    if (now - p.ts > PTR_TTL) { delete ptrsRef.current[id]; continue; }
                    const x = p.x * w, y = p.y * h, c = colorFor(id);
                    ctx.fillStyle = c;
                    ctx.beginPath();
                    ctx.moveTo(x, y); ctx.lineTo(x + 12, y + 4); ctx.lineTo(x + 4, y + 12); ctx.closePath();
                    ctx.fill();
                    const tw = ctx.measureText(p.name).width + 12;
                    ctx.fillRect(x + 10, y + 12, tw, 18);
                    ctx.fillStyle = "#fff";
                    ctx.fillText(p.name, x + 16, y + 25);
                }
            }
            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, []);

    const norm = (e) => {
        const r = canvasRef.current.getBoundingClientRect();
        return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
    };
    const send = (event) => socketRef.current?.emit("call-annotate", { projectId, event });

    const onMove = (e) => {
        const pt = norm(e);
        const now = performance.now();
        if (drawing && downRef.current && lastRef.current) {
            const seg = { a: lastRef.current, b: pt };
            segsRef.current.push({ ...seg, color: colorFor(socketRef.current?.id || userName), ts: now });
            send({ t: "seg", ...seg });
            lastRef.current = pt;
        }
        if (now - lastPtrSent.current > 40) {
            lastPtrSent.current = now;
            send({ t: "ptr", x: pt[0], y: pt[1] });
        }
    };

    return (
        <canvas
            ref={canvasRef}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => { if (!drawing) return; downRef.current = true; lastRef.current = norm(e); e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={onMove}
            onPointerUp={() => { downRef.current = false; lastRef.current = null; }}
            onPointerCancel={() => { downRef.current = false; lastRef.current = null; }}
            style={{
                position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 6,
                cursor: drawing ? "crosshair" : "default", touchAction: drawing ? "none" : "auto",
            }}
        />
    );
}
