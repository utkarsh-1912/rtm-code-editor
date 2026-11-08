import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ACTIONS from "../Action";
import Icon from "./icons/Icon";
import { Modal } from "./ux/primitives";

const PRESETS = [5, 10, 15, 25, 45, 60];

// The room's shared session state: who is presenting ("Follow me") and the session timer.
export function useSession(socketRef, roomId, socketConnected) {
    const [session, setSession] = useState({ follow: null, timer: null });
    const [stoppedFollowing, setStoppedFollowing] = useState(null); // presenter socket id I stopped following
    useEffect(() => {
        const socket = socketRef.current;
        if (!socketConnected || !socket) return undefined;
        const onSync = (s) => setSession({ follow: s?.follow || null, timer: s?.timer || null });
        const ask = () => socket.emit(ACTIONS.SESSION_SYNC_REQUEST, { roomId });
        // Ask once this socket is in the room (the server ignores asks from outside it).
        const onJoined = ({ socketId }) => { if (socketId === socket.id) ask(); };
        socket.on(ACTIONS.SESSION_SYNC, onSync);
        socket.on(ACTIONS.JOINED, onJoined);
        const t = setTimeout(ask, 1500); // in case the join was confirmed before we listened
        return () => { clearTimeout(t); socket.off(ACTIONS.SESSION_SYNC, onSync); socket.off(ACTIONS.JOINED, onJoined); };
    }, [socketRef, roomId, socketConnected]);

    const me = socketRef.current?.id;
    const presenter = session.follow;
    const presenting = !!presenter && presenter.socketId === me;
    const followId = presenter && !presenting && stoppedFollowing !== presenter.socketId ? presenter.socketId : null;
    return {
        session, presenting, followId, presenter,
        stopFollowing: () => setStoppedFollowing(presenter?.socketId || null),
        follow: () => setStoppedFollowing(null),
    };
}

export const toggleFollowMe = (socketRef, roomId, userName, on) =>
    socketRef.current?.emit(ACTIONS.FOLLOW_MODE, { roomId, on, userName });

const fmt = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

// Pills over the room: following / presenting, and the timer (everyone sees the same one).
export function SessionPills({ state, socketRef, roomId, userName, onOpenTimer }) {
    const { session, presenting, followId, presenter, stopFollowing, follow } = state;
    const timer = session.timer;
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!timer) return undefined;
        const t = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(t);
    }, [timer]);
    const left = timer ? timer.endsAt - now : 0;
    const [announced, setAnnounced] = useState(null);
    useEffect(() => {
        if (timer && left <= 0 && announced !== timer.endsAt) {
            setAnnounced(timer.endsAt);
            toast(`${timer.label}: time’s up`, { icon: "⏰" });
        }
    }, [timer, left, announced]);

    if (!presenter && !timer) return null;
    return (
        <div className="ss">
            {/* Follow changes are announced; the ticking timer is not (the "time's up" toast is). */}
            <span role="status" className="ss-live">
            {presenting && (
                <span className="ss-pill is-on">
                    <Icon name="show" size={14} /> Others follow your view
                    <button type="button" onClick={() => toggleFollowMe(socketRef, roomId, userName, false)}>Stop</button>
                </span>
            )}
            {presenter && !presenting && (followId ? (
                <span className="ss-pill is-on">
                    <Icon name="show" size={14} /> Following {presenter.userName}
                    <button type="button" onClick={stopFollowing}>Stop following</button>
                </span>
            ) : (
                <span className="ss-pill">
                    <Icon name="hide" size={14} /> {presenter.userName} is presenting
                    <button type="button" onClick={follow}>Follow</button>
                </span>
            ))}
            </span>
            {timer && (
                <button type="button" aria-live="off" aria-label={`${timer.label}: ${left > 0 ? `${Math.ceil(left / 60000)} minutes left` : "time’s up"}. Change the timer`} className={`ss-pill ss-timer${left <= 0 ? " is-over" : left < 60000 ? " is-low" : ""}`} onClick={onOpenTimer} title={`Set by ${timer.by}. Click to change.`}>
                    <Icon name="timer" size={14} /> {timer.label} <b>{left > 0 ? fmt(left) : "Time’s up"}</b>
                </button>
            )}
        </div>
    );
}

// Start, change or stop the shared timer.
export function TimerModal({ open, onClose, socketRef, roomId, userName, timer }) {
    const [label, setLabel] = useState("");
    const [minutes, setMinutes] = useState(25);
    useEffect(() => { if (open) { setLabel(timer?.label || ""); setMinutes(timer?.minutes || 25); } }, [open, timer]);
    const start = (m) => {
        socketRef.current?.emit(ACTIONS.SESSION_TIMER, { roomId, minutes: m, label: label || "Timer", userName });
        onClose();
    };
    return (
        <Modal open={open} onClose={onClose} label="Session" title="Session timer" description="Everyone in the room sees the same countdown. Use it for a pairing block, a break or an interview’s parts."
            onSubmit={(e) => { e.preventDefault(); start(minutes); }}
            footer={<>
                {timer && <button type="button" className="u-btn u-btn--ghost" onClick={() => start(0)}>Stop timer</button>}
                <button type="submit" className="u-btn u-btn--solid" disabled={!(minutes > 0)}>{timer ? "Restart" : "Start"}</button>
            </>}>
            <div className="u-field">
                <label htmlFor="ss-label">What it’s for <span className="u-faint">— optional</span></label>
                <input id="ss-label" className="u-input" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder="Pairing block, Break, System design…" autoFocus />
            </div>
            <div className="u-field">
                <span className="u-field-label">Length</span>
                <div className="ss-presets" role="radiogroup" aria-label="Length">
                    {PRESETS.map((m) => (
                        <button key={m} type="button" role="radio" aria-checked={minutes === m} className={minutes === m ? "on" : ""} onClick={() => setMinutes(m)}>{m} min</button>
                    ))}
                    <input className="u-input" type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(Math.min(240, Math.max(0, Number(e.target.value) || 0)))} aria-label="Minutes" />
                </div>
            </div>
        </Modal>
    );
}
