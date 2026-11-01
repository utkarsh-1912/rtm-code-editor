import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { roomMeeting, takeSnapshot } from "../utils/meetings";

// The scheduled meeting this room is holding, when you organise it (else null), plus what
// happens when an organiser ends it: organisers stay; everyone else is shown out.
export default function useRoomMeeting({ roomId, user, socketRef, onShownOut, onEndRequest }) {
    const [meeting, setMeeting] = useState(null);
    const outRef = useRef(onShownOut);
    outRef.current = onShownOut;
    const endRef = useRef(onEndRequest);
    endRef.current = onEndRequest;

    const refresh = useCallback(() => {
        if (!user?.uid) { setMeeting(null); return; }
        roomMeeting(roomId).then((r) => setMeeting(r.meeting || null)).catch(() => { });
    }, [roomId, user?.uid]);

    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;
    useEffect(() => {
        refresh();
        const t = setInterval(refresh, 60000);
        return () => clearInterval(t);
    }, [refresh]);

    // The page's socket arrives after the page: watch the ref for it.
    useEffect(() => {
        let attached = null;
        // Past the scheduled end: ask the organiser to end it (it ends by itself later).
        const onOverrun = ({ title, autoEndInMin } = {}) => {
            refreshRef.current?.(); // make sure the End dialog has the meeting
            toast((t) => (
                <span className="u-toast-call">
                    <span><b>{title || "This meeting"}</b> is past its end time. It ends by itself in {autoEndInMin || 50} min.</span>
                    <button className="u-btn u-btn--solid u-btn--sm" onClick={() => { toast.dismiss(t.id); endRef.current?.(); }}>End now</button>
                    <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => toast.dismiss(t.id)}>Keep going</button>
                </span>
            ), { id: "meeting-overrun", duration: 30000 });
        };
        const onEnded = ({ meetingId, organiser, auto, stays } = {}) => {
            if (stays && !organiser) {
                toast("The scheduled meeting here has ended. You still have access to this room.", { id: "meeting-ended" });
                return;
            }
            if (organiser) {
                toast.success(auto ? "The meeting was ended automatically. The room is now organisers only." : "Meeting ended. The room is now organisers only.", { id: "meeting-ended" });
                setMeeting(null);
                return;
            }
            toast("The organiser ended this meeting.", { id: "meeting-ended", icon: "👋", duration: 6000 });
            outRef.current?.(meetingId);
        };
        const sync = () => {
            const socket = socketRef.current || null;
            if (socket === attached) return;
            attached?.off("meeting-ended", onEnded);
            attached?.off("meeting-overrun", onOverrun);
            attached = socket;
            attached?.on("meeting-ended", onEnded);
            attached?.on("meeting-overrun", onOverrun);
        };
        sync();
        const t = setInterval(sync, 1000);
        return () => { clearInterval(t); attached?.off("meeting-ended", onEnded); attached?.off("meeting-overrun", onOverrun); };
    }, [socketRef]);

    const snapshot = useCallback(async ({ code, language, takenBy }) => {
        if (!meeting) return;
        try {
            await takeSnapshot(meeting.id, { code, language, takenBy });
            toast.success("Snapshot saved to the meeting");
        } catch (err) {
            toast.error(err.message);
        }
    }, [meeting]);

    return { meeting, setMeeting, snapshot };
}
