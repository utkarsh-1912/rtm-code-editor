import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CalendarDays } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { getBackendUrl } from "../utils/api";
import { auth } from "../firebase";

async function call(path, method = "GET") {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const res = await fetch(`${getBackendUrl()}/api${path}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}

// Settings > Connections: Google Calendar and Outlook. Connected calendars keep booking links
// from offering busy times, and meetings you schedule are added to them.
export default function CalendarConnections() {
    const [list, setList] = useState(null);
    const [busy, setBusy] = useState(null);
    const [params] = useSearchParams();
    const load = useCallback(() => call("/calendar/connections").then(setList).catch(() => setList([])), []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const r = params.get("calendar");
        if (r === "connected") toast.success("Calendar connected");
        else if (r === "error") toast.error(params.get("reason") || "Could not connect the calendar");
    }, [params]);

    const connect = async (id) => {
        setBusy(id);
        try { window.location.href = (await call(`/calendar/${id}/connect`, "POST")).url; } catch (err) { toast.error(err.message); setBusy(null); }
    };
    const disconnect = async (id) => {
        setBusy(id);
        try { await call(`/calendar/${id}`, "DELETE"); toast.success("Calendar disconnected"); await load(); } catch (err) { toast.error(err.message); } finally { setBusy(null); }
    };

    if (!list) return null;
    return (
        <>
            <div className="g-panel-head"><strong>Calendars</strong><span className="u-label">{list.filter((c) => c.connected).length} connected</span></div>
            <ul className="g-rules">
                {list.map((c) => (
                    <li key={c.id}>
                        <span><CalendarDays size={16} /></span>
                        <div>
                            <h5>{c.name}{c.connected && c.email ? ` · ${c.email}` : ""}</h5>
                            <p>{!c.configured ? `${c.name} isn't set up on this server yet (an admin adds its OAuth app).`
                                : c.connected ? "Busy times are kept off your booking links, and meetings you schedule are added to this calendar."
                                    : "Keep busy times off your booking links and add meetings you schedule to your calendar."}</p>
                        </div>
                        {c.configured && (c.connected
                            ? <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => disconnect(c.id)} disabled={busy === c.id}>Disconnect</button>
                            : <button className="u-btn u-btn--solid u-btn--sm" onClick={() => connect(c.id)} disabled={busy === c.id}>Connect</button>)}
                    </li>
                ))}
            </ul>
        </>
    );
}
