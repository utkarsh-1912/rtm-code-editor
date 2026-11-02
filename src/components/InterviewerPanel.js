import React, { useEffect, useRef, useState } from "react";
import { EyeOff, Send, X, NotebookPen, MessagesSquare } from "lucide-react";
import { getFeedback, saveMyNotes } from "../utils/meetings";

// Interviewer-only side panel in a room during a scheduled meeting: a chat between the
// organisers that the candidate never sees, and your own private notes (they become the notes
// of your feedback after the call).
export default function InterviewerPanel({ meeting, socketRef, onClose }) {
    const [tab, setTab] = useState("chat");
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState("");
    const [denied, setDenied] = useState(false);
    const [notes, setNotes] = useState(null);
    const [saved, setSaved] = useState("");
    const listRef = useRef(null);

    // Join the panel channel on the room's socket (the server checks you're an organiser).
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !meeting) return undefined;
        const onHistory = (p) => { if (p.meetingId === meeting.id) setMessages(p.messages || []); };
        const onMessage = (p) => { if (p.meetingId === meeting.id) setMessages((prev) => [...prev, p.message]); };
        const onDenied = () => setDenied(true);
        socket.on("panel-history", onHistory);
        socket.on("panel-message", onMessage);
        socket.on("panel-denied", onDenied);
        const join = () => socket.emit("panel-join", { meetingId: meeting.id });
        join();
        socket.on("connect", join); // a reconnected socket is in no rooms
        return () => {
            socket.emit("panel-leave", { meetingId: meeting.id });
            socket.off("panel-history", onHistory);
            socket.off("panel-message", onMessage);
            socket.off("panel-denied", onDenied);
            socket.off("connect", join);
        };
    }, [socketRef, meeting]);

    useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages, tab]);

    // My notes: load once, save a moment after typing stops.
    useEffect(() => {
        if (!meeting) return;
        getFeedback(meeting.id).then((f) => setNotes(f.mine?.notes || "")).catch(() => setNotes(""));
    }, [meeting]);
    const firstNotes = useRef(true);
    useEffect(() => {
        if (notes === null) return undefined;
        if (firstNotes.current) { firstNotes.current = false; return undefined; }
        setSaved("Saving…");
        const t = setTimeout(() => saveMyNotes(meeting.id, notes).then(() => setSaved("Saved")).catch(() => setSaved("Not saved")), 700);
        return () => clearTimeout(t);
    }, [notes, meeting]);

    const send = (e) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text) return;
        socketRef.current?.emit("panel-send", { meetingId: meeting.id, text });
        setDraft("");
    };

    return (
        <aside className="ip" aria-label="Interviewer panel">
            <header className="ip-head">
                <span className="ip-title"><EyeOff size={14} /> Interviewers only</span>
                <button type="button" className="ip-x" onClick={onClose} aria-label="Close interviewer panel"><X size={15} /></button>
            </header>
            <div className="ip-tabs" role="tablist">
                <button role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}><MessagesSquare size={13} /> Chat</button>
                <button role="tab" aria-selected={tab === "notes"} className={tab === "notes" ? "on" : ""} onClick={() => setTab("notes")}><NotebookPen size={13} /> My notes</button>
            </div>
            {denied ? (
                <p className="ip-empty">Only the meeting's organisers can use this panel.</p>
            ) : tab === "chat" ? (
                <>
                    <ol className="ip-list" ref={listRef}>
                        {messages.length === 0 && <li className="ip-empty">Talk with the other interviewers here. The candidate can't see this.</li>}
                        {messages.map((m) => (
                            <li key={m.id}><b>{m.author}</b><span>{m.text}</span><time>{new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></li>
                        ))}
                    </ol>
                    <form className="ip-send" onSubmit={send}>
                        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message interviewers" maxLength={2000} aria-label="Message interviewers" />
                        <button type="submit" disabled={!draft.trim()} aria-label="Send"><Send size={14} /></button>
                    </form>
                </>
            ) : (
                <div className="ip-notes">
                    <textarea value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} disabled={notes === null}
                        placeholder="Observations, follow-up questions, evidence for your scores… Only you see these; they're added to your feedback." />
                    <span className="ip-saved">{saved}</span>
                </div>
            )}
        </aside>
    );
}
