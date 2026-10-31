import React, { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import Icon from "./icons/Icon";

// "Ada started a call" with a Join button, for people in the room or project who aren't in the
// call. The page's socket is created later than the page, so this watches the ref for it.
export default function useCallStartedAlert(socketRef, { inCall, onJoin }) {
    const latest = useRef({ inCall, onJoin });
    latest.current = { inCall, onJoin };

    useEffect(() => {
        let attached = null;
        const onStarted = ({ name, userId } = {}) => {
            if (latest.current.inCall || !attached || userId === attached.id) return;
            const who = name || "Someone";
            toast((t) => (
                <span className="u-toast-call">
                    <Icon name="call" size={16} />
                    <span><b>{who}</b> started a call</span>
                    <button className="u-btn u-btn--solid u-btn--sm" onClick={() => { toast.dismiss(t.id); latest.current.onJoin?.(); }}>Join</button>
                    <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => toast.dismiss(t.id)}>Later</button>
                </span>
            ), { id: "call-started", duration: 15000 });
            // Installed app in the background: a system notification too.
            if (document.visibilityState !== "visible") {
                window.colabsDesktop?.notify?.({ title: "Call started", body: `${who} started a call. Open the room to join.` }).catch?.(() => { });
            }
        };
        const sync = () => {
            const socket = socketRef.current || null;
            if (socket === attached) return;
            attached?.off("call-started", onStarted);
            attached = socket;
            attached?.on("call-started", onStarted);
        };
        sync();
        const t = setInterval(sync, 1000);
        return () => { clearInterval(t); attached?.off("call-started", onStarted); };
    }, [socketRef]);
}
