import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarCheck, Clock, Globe, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { getBookingPage, bookSlot, localZone } from "../utils/meetings";

const dayKey = (iso, tz) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });

// The public page a booking link opens: pick a free time (shown in your own time zone), leave
// your name and email, and the meeting, room and invitation are made for you.
export default function BookPage() {
    const { linkId } = useParams();
    const { user } = useAuth();
    const tz = localZone();
    const [page, setPage] = useState(null);
    const [error, setError] = useState(null);
    const [day, setDay] = useState(null);
    const [slot, setSlot] = useState(null);
    const [picked, setPicked] = useState("");
    const [form, setForm] = useState({ name: "", email: "", note: "" });
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);

    const load = () => getBookingPage(linkId).then(setPage).catch((err) => setError(err.message));
    useEffect(() => { load(); }, [linkId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (user) setForm((f) => ({ ...f, name: f.name || user.name || "", email: f.email || user.email || "" }));
    }, [user]);

    const days = useMemo(() => {
        const groups = new Map();
        for (const s of page?.slots || []) {
            const k = dayKey(s, tz);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(s);
        }
        return [...groups.entries()];
    }, [page, tz]);
    const current = days.find(([k]) => k === day) || days[0];

    const book = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            setDone(await bookSlot(linkId, { ...form, startsAt: slot }));
        } catch (err) {
            toast.error(err.message);
            if (/taken|no longer/i.test(err.message)) { setSlot(null); setPicked(""); load(); }
        } finally { setBusy(false); }
    };

    const brand = page?.brand;
    const style = brand?.color ? { "--brand": brand.color } : undefined;
    const fmtDay = (k, opts) => new Date(`${k}T12:00:00`).toLocaleDateString([], opts);
    const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    if (error) {
        return (
            <AppLayout>
                <header className="db-head" data-rise>
                    <div><span className="u-label"><span className="u-dot u-dot--bad" /> Booking</span><h1 className="db-title">Link not available</h1></div>
                </header>
                <p className="mp-lead">{error} Ask the person who sent it for a new link.</p>
            </AppLayout>
        );
    }
    if (!page) return <AppLayout><div className="db-head"><div className="u-skel" style={{ height: 64, width: 420, maxWidth: "100%" }} /></div><div className="u-skel" style={{ height: 240 }} /></AppLayout>;

    return (
        <AppLayout>
            <div className={`bk${brand?.color ? " is-branded" : ""}`} style={style}>
                <header className="db-head" data-rise>
                    <div>
                        {brand && <span className="mp-brand">{brand.logo && <img src={brand.logo} alt="" />}<b>{brand.name}</b></span>}
                        <span className="u-label">Book a time with {page.hostName}</span>
                        <h1 className="db-title">{page.title}</h1>
                        <p className="mp-host bk-facts">
                            <span><Clock size={14} /> {page.durationMin} min</span>
                            <span><Globe size={14} /> Times in {tz.replace(/_/g, " ")}</span>
                        </p>
                    </div>
                </header>
                {page.description && <section className="u-card mp-agenda" data-rise><span className="u-label">What to expect</span><p>{page.description}</p></section>}

                {done ? (
                    <section className="u-card bk-done" data-rise>
                        <CalendarCheck size={28} />
                        <h2>You're booked</h2>
                        <p>{new Date(done.startsAt).toLocaleString([], { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}. The invitation is on its way to <b>{form.email}</b> with a calendar file.</p>
                        <Link className="u-btn u-btn--solid" to={done.url}>Open the meeting page</Link>
                    </section>
                ) : !days.length ? (
                    <section className="u-card bk-done" data-rise><h2>No free times right now</h2><p>All the available times are taken. Check back later or contact {page.hostName}.</p></section>
                ) : slot ? (
                    <form className="u-card bk-form" onSubmit={book} data-rise>
                        <button type="button" className="u-btn u-btn--quiet u-btn--sm" onClick={() => setSlot(null)}><ArrowLeft size={14} /> Pick another time</button>
                        <p className="bk-when">{new Date(slot).toLocaleString([], { weekday: "long", day: "numeric", month: "long" })} · <b>{fmtTime(slot)}</b> – {fmtTime(new Date(new Date(slot).getTime() + page.durationMin * 60000))}</p>
                        <div className="u-field"><label htmlFor="bk-name">Your name</label><input id="bk-name" className="u-input" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
                        <div className="u-field"><label htmlFor="bk-email">Email <span className="u-faint">— the invitation goes here</span></label><input id="bk-email" type="email" className="u-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                        <div className="u-field"><label htmlFor="bk-note">Anything to share? <span className="u-faint">— optional</span></label><textarea id="bk-note" className="u-textarea" rows={3} maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
                        <button type="submit" className="u-btn u-btn--solid bk-cta" disabled={busy}>{busy ? "Booking…" : "Confirm booking"}</button>
                    </form>
                ) : (
                    <section className="u-card bk-pick" data-rise>
                        <div className="bk-selects">
                            <div className="u-field"><label htmlFor="bk-day">Day</label>
                                <select id="bk-day" className="u-select" value={current[0]} onChange={(e) => { setDay(e.target.value); setPicked(""); }}>
                                    {days.map(([k, list]) => <option key={k} value={k}>{fmtDay(k, { weekday: "long", day: "numeric", month: "short" })} · {list.length} free</option>)}
                                </select>
                            </div>
                            <div className="u-field"><label htmlFor="bk-time">Time</label>
                                <select id="bk-time" className="u-select" value={picked} onChange={(e) => setPicked(e.target.value)}>
                                    <option value="" disabled>Pick a time</option>
                                    {current[1].map((s) => <option key={s} value={s}>{fmtTime(s)} – {fmtTime(new Date(Date.parse(s) + page.durationMin * 60000))}</option>)}
                                </select>
                            </div>
                        </div>
                        <button type="button" className="u-btn u-btn--solid bk-cta" disabled={!picked} onClick={() => setSlot(picked)}>Continue</button>
                    </section>
                )}
                {brand && <p className="bk-powered u-small u-faint">Powered by Utkristi CoLabs</p>}
            </div>
        </AppLayout>
    );
}
