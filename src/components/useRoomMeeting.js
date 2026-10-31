import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { roomMeeting, takeSnapshot } from "../utils/meetings";

// The scheduled meeting this room is holding, when you organise it (else null), plus what
// happens when an organiser ends it: organisers stay; everyone else is shown out.
export default function useRoomMeeting({ roomId, user, socketRef, onShownOut }) {
    const [meeting, setMeeting] = useState(null);
    const outRef = useRef(onShownOut);
    outRef.current = onShownOut;

    const refresh = useCallback(() => {
        if (!user?.uid) { setMeeting(null); return; }
        roomMeeting(roomId).then((r) => setMeeting(r.meeting || null)).catch(() => { });
    }, [roomId, user?.uid]);

    useEffect(() => {
        refresh();
        const t = setInterval(refresh, 60000);
        return () => clearInterval(t);
    }, [refresh]);

    // The page's socket arrives after the page: watch the ref for it.
    useEffect(() => {
        let attached = null;
        const onEnded = ({ meetingId, organiser } = {}) => {
            if (organiser) {
                toast.success("Meeting ended. The room is now organisers only.", { id: "meeting-ended" });
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
            attached = socket;
            attached?.on("meeting-ended", onEnded);
        };
        sync();
        const t = setInterval(sync, 1000);
        return () => { clearInterval(t); attached?.off("meeting-ended", onEnded); };
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
