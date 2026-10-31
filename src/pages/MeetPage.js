import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CalendarDays, Clock, Video, Lock, DoorOpen, Globe, Copy, CalendarX, Pencil, Trash2, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "../components/AppLayout";
import { CalendarLinks, ScheduleModal, confirmDeleteMeeting } from "../components/Meetings";
import { useAuth } from "../context/AuthContext";
import DeviceCheck from "../components/DeviceCheck";
import MeetingOrganiser from "../components/MeetingOrganiser";
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
    const { user } = useAuth();
    const [params] = useSearchParams();
    const [m, setM] = useState(null);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(false);
    const [, tick] = useState(0);
    // The invite email carries the person's name (?as=), so guests join without being asked.
    const [guestName, setGuestName] = useState(() => {
        const fromLink = (params.get("as") || "").replace(/\s+/g, " ").trim().slice(0, 60);
        try { return fromLink || localStorage.getItem("guest-name") || ""; } catch { return fromLink; }
    });
    const [renaming, setRenaming] = useState(() => !guestName);

    useEffect(() => {
        if (user || !guestName.trim()) return;
        try { localStorage.setItem("guest-name", guestName.trim()); } catch { /* storage blocked */ }
    }, [guestName, user]);

    // Join: ask for camera and mic here (with a preview), then open the room with the call starting.
    const devicesRef = useRef(null);
    const [joining, setJoining] = useState(false);
    const join = async () => {
        setJoining(true);
        await devicesRef.current?.prepare().catch(() => false);
        navigate(`/editor/${m.roomId}`, { state: { userName: user?.name || guestName.trim() || undefined, startCall: true } });
    };
    const remove = async () => { if (await confirmDeleteMeeting(m)) navigate(user ? "/dashboard" : "/"); };

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
                <span className="u-label">{m.cancelled ? "Cancelled" : m.endedAt ? "Ended by the organiser" : over ? "This meeting has ended" : joinable ? "Happening now" : `Starts ${startsIn(m.startsAt)}`}</span>
                <h1>{m.title}</h1>
                <div className="mt-page-facts">
                    <span><CalendarDays size={14} /> {start.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                    <span><Clock size={14} /> {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {m.durationMin} min <em>({Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")})</em></span>
                    <span><acc.Icon size={14} /> {acc.text}</span>
                </div>
                {m.description && <p className="mt-page-notes">{m.description}</p>}
                <span className="u-small u-muted">Hosted by {m.isHost ? "you" : m.hostName || "the host"}</span>
                {!user && !m.cancelled && !over && (
                    <div className="mt-page-who">
                        <UserRound size={14} />
                        {renaming ? (
                            <input className="u-input" autoFocus={renaming} value={guestName} maxLength={60} placeholder="Your name"
                                onChange={(e) => setGuestName(e.target.value)} onBlur={() => guestName.trim() && setRenaming(false)}
                                onKeyDown={(e) => e.key === "Enter" && guestName.trim() && setRenaming(false)} aria-label="Your name" />
                        ) : (
                            <>
                                <span>You'll join as <b>{guestName}</b></span>
                                <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => setRenaming(true)}>Change</button>
                            </>
                        )}
                    </div>
                )}
                {!m.cancelled && !over && (
                    <>
                        {(joinable || m.isHost) && <DeviceCheck ref={devicesRef} name={user?.name || guestName.trim()} />}
                        <div className="mt-page-actions">
                            <button className="u-btn u-btn--solid u-btn--lg" onClick={join} disabled={joining || (!joinable && !m.isHost)} title={joinable || m.isHost ? "" : "You can join 10 minutes before it starts"}>
                                <Video size={16} /> {joinable ? "Join now" : m.isHost ? "Open the room" : "Join opens 10 min before"}
                            </button>
                            <button className="u-btn u-btn--ghost u-btn--lg" onClick={copy}><Copy size={16} /> Copy link</button>
                        </div>
                        {m.isHost && (
                            <div className="mt-page-host">
                                <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => setEditing(true)}><Pencil size={14} /> Edit or reschedule</button>
                                {m.isOwner && <button className="u-btn u-btn--ghost u-btn--sm danger" onClick={remove}><Trash2 size={14} /> Delete</button>}
                            </div>
                        )}
                        <span className="u-label">Add to calendar</span>
                        <CalendarLinks meeting={m} />
                    </>
                )}
                {!m.isHost && m.endedAt && <p className="u-small u-muted">The room is closed now. Thanks for joining.</p>}
                {m.isHost && over && (
                    <div className="mt-page-host">
                        <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => navigate(`/editor/${m.roomId}`)}><Video size={14} /> Open the room</button>
                        {m.isOwner && <button className="u-btn u-btn--ghost u-btn--sm danger" onClick={remove}><Trash2 size={14} /> Delete</button>}
                    </div>
                )}
                {m.isHost && <ScheduleModal open={editing} meeting={m} onClose={() => setEditing(false)} onScheduled={(next) => setM(next)} />}
            </div>
        );
    }
    // Organisers get the review side: private notes, snapshots, co-organisers, End meeting.
    if (m?.isHost && !m.cancelled) {
        return (
            <AppLayout>
                <div className="mt-page mt-page--org">
                    {body}
                    <MeetingOrganiser meeting={m} onChange={(next) => setM(next)} userName={user?.name || user?.email} />
                </div>
            </AppLayout>
        );
    }
    return <AppLayout><div className="mt-page">{body}</div></AppLayout>;
}
