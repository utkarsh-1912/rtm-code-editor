import React, { useEffect, useRef } from "react";

const FADE_MS = 4500;
const PTR_TTL = 4000;

const colorFor = (id = "") => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return `hsl(${h}, 85%, 58%)`;
};

// Transparent layer over a shared screen: everyone can draw (strokes fade out, like Pop)
// and see each other's labelled pointers. Coordinates are normalised to 0..1.
export default function CallAnnotations({ socketRef, projectId, drawing, userName, clearKey = 0 }) {
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
                ctx.font = "600 10.5px Archivo, Inter, system-ui, sans-serif";
                ctx.textBaseline = "middle";
                for (const [id, p] of Object.entries(ptrsRef.current)) {
                    const age = now - p.ts;
                    if (age > PTR_TTL) { delete ptrsRef.current[id]; continue; }
                    const x = p.x * w, y = p.y * h, c = colorFor(id);
                    // Pointer fades out over its last second instead of vanishing.
                    const life = Math.min(1, (PTR_TTL - age) / 1000);
                    // The name tag fades faster (after ~2s still), like editor cursor tags.
                    const tagAlpha = life * (age < 2200 ? 1 : Math.max(0.18, 1 - (age - 2200) / 800));
                    ctx.globalAlpha = life;
                    ctx.beginPath();
                    ctx.moveTo(x, y); ctx.lineTo(x + 3.5, y + 13); ctx.lineTo(x + 6.5, y + 8); ctx.lineTo(x + 12, y + 7.5); ctx.closePath();
                    ctx.fillStyle = c;
                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 1.2;
                    ctx.lineJoin = "round";
                    ctx.fill();
                    ctx.stroke();
                    ctx.globalAlpha = tagAlpha;
                    const tw = ctx.measureText(p.name).width + 12;
                    const tx = x + 11, ty = y + 12, th = 17;
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(tx, ty, tw, th, [0, 4, 4, 4]); else ctx.rect(tx, ty, tw, th);
                    ctx.fillStyle = c;
                    ctx.fill();
                    ctx.fillStyle = "#fff";
                    ctx.fillText(p.name, tx + 6, ty + th / 2 + 0.5);
                }
                ctx.globalAlpha = 1;
            }
            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, []);

    // "Clear" in the call: wipe strokes here and for everyone else.
    useEffect(() => {
        if (!clearKey) return;
        segsRef.current = [];
        socketRef.current?.emit("call-annotate", { projectId, event: { t: "clear" } });
    }, [clearKey, socketRef, projectId]);

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
