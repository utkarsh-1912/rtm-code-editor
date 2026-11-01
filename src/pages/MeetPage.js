import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Video, Lock, DoorOpen, Globe, Copy, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "../components/AppLayout";
import { CalendarLinks, ScheduleModal, confirmDeleteMeeting } from "../components/Meetings";
import { useAuth } from "../context/AuthContext";
import DeviceCheck from "../components/DeviceCheck";
import MeetingOrganiser from "../components/MeetingOrganiser";
import { getMeeting, meetingLink, isJoinable, isOver, startsIn, rsvpMeeting } from "../utils/meetings";

const ACCESS = {
    public: { Icon: Globe, short: "Anyone", text: "Anyone with the link" },
    invite: { Icon: DoorOpen, short: "Invited", text: "Others knock to come in" },
    private: { Icon: Lock, short: "Invitees only", text: "Signed in with the invited email" },
};

// The page an invite links to: when, who, add to calendar, and Join once it's time.
export default function MeetPage() {
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
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

    // Wait for sign-in to be restored: the organiser's view (notes, guests, snapshots) depends on it.
    useEffect(() => {
        if (authLoading) return undefined;
        let live = true;
        getMeeting(meetingId).then((x) => live && setM(x)).catch((err) => live && setError(err.message));
        return () => { live = false; };
    }, [meetingId, authLoading, user?.uid]);
    useEffect(() => {
        const t = setInterval(() => tick((n) => n + 1), 15000);
        return () => clearInterval(t);
    }, []);

    // Arrived from the email's Yes / No buttons (?rsvp=yes|no|invalid): say it was recorded, once.
    const rsvpParam = params.get("rsvp");
    useEffect(() => {
        if (!rsvpParam) return;
        if (rsvpParam === "yes") toast.success("Thanks, the organiser knows you're coming.", { id: "rsvp" });
        else if (rsvpParam === "no") toast("Thanks for letting the organiser know.", { id: "rsvp" });
        else toast.error("That answer link isn't valid any more. Open the latest email for this meeting.", { id: "rsvp" });
        const next = new URLSearchParams(params);
        next.delete("rsvp");
        navigate({ search: next.toString() ? `?${next}` : "" }, { replace: true });
    }, [rsvpParam]); // eslint-disable-line react-hooks/exhaustive-deps
    const answer = async (value) => {
        try { setM(await rsvpMeeting(m.id, value)); toast.success(value === "yes" ? "See you there" : "The organiser will know"); } catch (err) { toast.error(err.message); }
    };

    const copy = async () => {
        try { await navigator.clipboard.writeText(meetingLink(m)); toast.success("Link copied"); } catch { toast.error("Couldn't copy the link"); }
    };

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ");

    if (error) {
        return (
            <AppLayout>
                <header className="db-head" data-rise>
                    <div>
                        <span className="u-label"><span className="u-dot u-dot--bad" /> Meeting</span>
                        <h1 className="db-title">Meeting not found</h1>
                    </div>
                    <div className="db-actions"><button className="u-btn u-btn--ghost" onClick={() => navigate("/")}>Go home</button></div>
                </header>
                <p className="mp-lead">The link may be wrong, or the meeting was removed.</p>
            </AppLayout>
        );
    }
    if (!m) {
        return (
            <AppLayout>
                <div className="db-head"><div className="u-skel" style={{ height: 64, width: 420, maxWidth: "100%" }} /></div>
                <div className="u-skel" style={{ height: 104 }} />
            </AppLayout>
        );
    }

    const start = new Date(m.startsAt);
    const end = new Date(start.getTime() + m.durationMin * 60000);
    const joinable = isJoinable(m);
    const over = isOver(m);
    const live = !m.cancelled && !over;
    const acc = ACCESS[m.access] || ACCESS.public;
    const status = m.cancelled ? { text: "Cancelled", dot: "u-dot--bad" }
        : m.endedAt ? { text: "Ended by the organiser", dot: "u-dot--off" }
            : over ? { text: "Ended", dot: "u-dot--off" }
                : joinable ? { text: "Happening now", dot: "" }
                    : { text: `Starts ${startsIn(m.startsAt)}`, dot: "u-dot--warn" };
    const organiser = m.isHost && !m.cancelled;

    const tiles = [
        { label: "Date", value: start.toLocaleDateString([], { day: "numeric" }), small: start.toLocaleDateString([], { month: "short" }), sub: start.toLocaleDateString([], { weekday: "long", year: "numeric" }) },
        { label: "Time", value: start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, ""), small: start.toLocaleTimeString([], { hour: "numeric" }).match(/[AP]M/i)?.[0] || "", sub: `to ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${tz}` },
        { label: "Length", value: m.durationMin >= 60 && m.durationMin % 60 === 0 ? m.durationMin / 60 : m.durationMin, small: m.durationMin >= 60 && m.durationMin % 60 === 0 ? "h" : "m", sub: `${m.durationMin} minutes` },
        { label: "Who can join", text: acc.short, sub: acc.text, Icon: acc.Icon },
    ];

    const joinCard = live ? (
        <section className="u-card mp-card" data-rise aria-label="Join">
            {m.invited && (
                <div className="mp-rsvp" role="group" aria-label="Will you join?">
                    <span className="u-label">Will you join?</span>
                    <button type="button" className={m.rsvp === "yes" ? "on" : ""} aria-pressed={m.rsvp === "yes"} onClick={() => answer("yes")}>Yes</button>
                    <button type="button" className={m.rsvp === "no" ? "on is-no" : ""} aria-pressed={m.rsvp === "no"} onClick={() => answer("no")}>Can't make it</button>
                </div>
            )}
            <div className="mp-card-head">
                <span className="u-label">Before you join</span>
                {!user && (
                    <span className="mp-who">
                        {renaming ? (
                            <input className="u-input" autoFocus value={guestName} maxLength={60} placeholder="Your name"
                                onChange={(e) => setGuestName(e.target.value)} onBlur={() => guestName.trim() && setRenaming(false)}
                                onKeyDown={(e) => e.key === "Enter" && guestName.trim() && setRenaming(false)} aria-label="Your name" />
                        ) : (
                            <>Joining as <b>{guestName}</b><button type="button" className="u-btn u-btn--quiet u-btn--sm" onClick={() => setRenaming(true)}>Change</button></>
                        )}
                    </span>
                )}
            </div>
            {(joinable || m.isHost) ? <DeviceCheck ref={devicesRef} name={user?.name || guestName.trim()} />
                : <p className="mp-lead">The room opens 10 minutes before the start. Add it to your calendar so you don't miss it.</p>}
            <div className="mp-join">
                <button className="u-btn u-btn--solid u-btn--lg" onClick={join} disabled={joining || (!joinable && !m.isHost)}>
                    <Video size={16} /> {joinable ? "Join now" : m.isHost ? "Open the room" : "Join opens 10 min before"}
                </button>
                <span className="mp-cal"><span className="u-label">Add to calendar</span><CalendarLinks meeting={m} /></span>
            </div>
        </section>
    ) : (
        <section className="u-card mp-card mp-card--done" data-rise>
            <span className="u-label">{m.cancelled ? "Cancelled" : "Finished"}</span>
            <p className="mp-lead">{m.cancelled ? "The organiser cancelled this meeting." : organiser ? "Your notes, snapshots and comments are kept here to review." : "The room is closed now. Thanks for joining."}</p>
        </section>
    );

    return (
        <AppLayout>
            <header className="db-head" data-rise>
                <div>
                    <span className="u-label"><span className={`u-dot ${status.dot}`} /> Meeting · {status.text}</span>
                    <h1 className="db-title">{m.title}</h1>
                    <p className="mp-host">Hosted by {m.isOwner ? "you" : m.hostName || "the host"}{m.coHosts?.length ? ` · ${m.coHosts.length} co-organiser${m.coHosts.length === 1 ? "" : "s"}` : ""}</p>
                </div>
                <div className="db-actions">
                    <button className="u-btn u-btn--ghost" onClick={copy}><Copy size={16} /> Copy link</button>
                    {organiser && live && <button className="u-btn u-btn--ghost" onClick={() => setEditing(true)}><Pencil size={16} /> Edit</button>}
                    {m.isOwner && <button className="u-btn u-btn--ghost mp-danger" onClick={remove} title="Delete meeting" aria-label="Delete meeting"><Trash2 size={16} /></button>}
                    {organiser && over && <button className="u-btn u-btn--solid" onClick={() => navigate(`/editor/${m.roomId}`)}><Video size={16} /> Open the room</button>}
                </div>
            </header>

            <div className="db-kpis mp-kpis" data-rise>
                {tiles.map((t) => (
                    <div key={t.label} className="db-kpi" aria-label={`${t.label}: ${t.sub}`}>
                        <span className="u-label">{t.label}</span>
                        {t.text
                            ? <span className="mp-kpi-text">{t.Icon && <t.Icon size={18} />}{t.text}</span>
                            : <span className="u-num">{t.value}<small>{t.small}</small></span>}
                        <span className="mp-kpi-sub">{t.sub}</span>
                    </div>
                ))}
            </div>

            {m.description && (
                <section className="u-card mp-agenda" data-rise>
                    <span className="u-label">Agenda</span>
                    <p>{m.description}</p>
                </section>
            )}

            <div className={organiser ? "mp-grid" : "mp-single"}>
                {joinCard}
                {organiser && <MeetingOrganiser meeting={m} onChange={(next) => setM(next)} />}
            </div>
            {organiser && <ScheduleModal open={editing} meeting={m} onClose={() => setEditing(false)} onScheduled={(next) => setM(next)} />}
        </AppLayout>
    );
}
