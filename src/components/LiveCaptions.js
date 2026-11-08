import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import ACTIONS from "../Action";

const Recognition = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const captionsSupported = !!Recognition;
const KEEP_MS = 8000; // how long a finished line stays up

// Live captions in a call. Turning them on shows everyone's captions and captions your own
// speech with the browser's speech recognition (which may send your audio to the browser
// maker's speech service). Nobody else's speech is transcribed unless they turn it on too.
export default function LiveCaptions({ socketRef, roomId, userName, on }) {
    const [lines, setLines] = useState({}); // socketId|"me" -> { name, text, final, at }
    const recRef = useRef(null);
    const [, tick] = useState(0);

    // Others' captions.
    useEffect(() => {
        const socket = socketRef.current;
        if (!on || !socket) return undefined;
        const onCaption = ({ socketId, name, text, final }) => setLines((l) => ({ ...l, [socketId]: { name, text, final, at: Date.now() } }));
        socket.on(ACTIONS.CAPTION, onCaption);
        const t = setInterval(() => tick((n) => n + 1), 2000); // drop old lines
        return () => { socket.off(ACTIONS.CAPTION, onCaption); clearInterval(t); };
    }, [on, socketRef]);

    // My captions.
    useEffect(() => {
        if (!on || !Recognition) return undefined;
        const rec = new Recognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = navigator.language || "en-US";
        let stopped = false;
        let lastSent = 0;
        rec.onresult = (e) => {
            const r = e.results[e.results.length - 1];
            const text = r[0].transcript.trim().slice(-300);
            if (!text) return;
            setLines((l) => ({ ...l, me: { name: "You", text, final: r.isFinal, at: Date.now() } }));
            const now = Date.now();
            if (r.isFinal || now - lastSent > 400) {
                lastSent = now;
                socketRef.current?.emit(ACTIONS.CAPTION, { roomId, text, final: r.isFinal, name: userName });
            }
        };
        rec.onerror = (e) => {
            if (e.error === "not-allowed" || e.error === "service-not-allowed") { stopped = true; toast.error("Captions need microphone access."); }
        };
        rec.onend = () => { if (!stopped) { try { rec.start(); } catch { /* already starting */ } } };
        try { rec.start(); } catch { /* ignore */ }
        recRef.current = rec;
        return () => { stopped = true; try { rec.stop(); } catch { /* ignore */ } recRef.current = null; };
    }, [on, roomId, userName, socketRef]);

    if (!on) return null;
    const now = Date.now();
    const shown = Object.entries(lines).filter(([, l]) => now - l.at < KEEP_MS).sort((a, b) => a[1].at - b[1].at).slice(-3);
    return (
        <div className="lc" aria-live="polite" aria-label="Live captions">
            {!shown.length && <span className="lc-line lc-hint">{Recognition ? "Captions on. Speak and your words appear here for everyone with captions on." : "Your browser can’t caption your speech, but you’ll see others’ captions."}</span>}
            {shown.map(([id, l]) => (
                <span key={id} className={`lc-line${l.final ? "" : " is-live"}`}><b>{l.name}</b> {l.text}</span>
            ))}
        </div>
    );
}
