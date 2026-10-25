import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Clock, Video, Lock, DoorOpen, Globe, Copy, CalendarX } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "../components/AppLayout";
import { CalendarLinks } from "../components/Meetings";
import { getMeeting, meetingLink, isJoinable, isOver, startsIn } from "../utils/meetings";

const ACCESS = {
    public: { Icon: Globe, text: "Anyone with the link can join." },
    invite: { Icon: DoorOpen, text: "Invited people join directly; others ask the host to let them in." },
    private: { Icon: Lock, text: "Only invited people can join, signed in with the invited email." },
};

// The page an invite links to: when, who, add to calendar, and Join once it's time.
export default function MeetPage() {
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const [m, setM] = useState(null);
    const [error, setError] = useState(null);
    const [, tick] = useState(0);

    useEffect(() => {
        getMeeting(meetingId).then(setM).catch((err) => setError(err.message));
        const t = setInterval(() => tick((n) => n + 1), 15000);
        return () => clearInterval(t);
    }, [meetingId]);

    const copy = async () => {
        try { await navigator.clipboard.writeText(meetingLink(m)); toast.success("Link copied"); } catch { toast.error("Couldn't copy the link"); }
    };

    let body;
    if (error) {
        body = (
            <div className="mt-page-card">
                <span className="mt-page-ico is-bad"><CalendarX size={22} /></span>
                <h1>Meeting not found</h1>
                <p>The link may be wrong, or the meeting was removed.</p>
                <button className="u-btn u-btn--ghost" onClick={() => navigate("/")}>Go home</button>
            </div>
        );
    } else if (!m) {
        body = <div className="mt-page-card"><div className="u-skel" style={{ height: 180, width: "100%" }} /></div>;
    } else {
        const start = new Date(m.startsAt);
        const joinable = isJoinable(m);
        const over = isOver(m);
        const acc = ACCESS[m.access] || ACCESS.public;
        body = (
            <div className="mt-page-card">
                <span className={`mt-page-ico${m.cancelled ? " is-bad" : joinable ? " is-live" : ""}`}>{m.cancelled ? <CalendarX size={22} /> : <CalendarDays size={22} />}</span>
                <span className="u-label">{m.cancelled ? "Cancelled" : over ? "This meeting has ended" : joinable ? "Happening now" : `Starts ${startsIn(m.startsAt)}`}</span>
                <h1>{m.title}</h1>
                <div className="mt-page-facts">
                    <span><CalendarDays size={14} /> {start.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                    <span><Clock size={14} /> {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {m.durationMin} min <em>({Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")})</em></span>
                    <span><acc.Icon size={14} /> {acc.text}</span>
                </div>
                {m.description && <p className="mt-page-notes">{m.description}</p>}
                <span className="u-small u-muted">Hosted by {m.hostName || "the host"}</span>
                {!m.cancelled && !over && (
                    <>
                        <div className="mt-page-actions">
                            <button className="u-btn u-btn--solid u-btn--lg" onClick={() => navigate(`/editor/${m.roomId}`)} disabled={!joinable && !m.isHost} title={joinable || m.isHost ? "" : "You can join 10 minutes before it starts"}>
                                <Video size={16} /> {joinable ? "Join now" : m.isHost ? "Open the room" : "Join opens 10 min before"}
                            </button>
                            <button className="u-btn u-btn--ghost" onClick={copy}><Copy size={15} /> Copy link</button>
                        </div>
                        <span className="u-label">Add to calendar</span>
                        <CalendarLinks meeting={m} />
                    </>
                )}
            </div>
        );
    }
    return <AppLayout><div className="mt-page">{body}</div></AppLayout>;
}
