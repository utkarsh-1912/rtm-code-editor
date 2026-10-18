import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { getBackendUrl } from "../utils/api";

// Tracks whether the API server is awake. Free hosting sleeps when idle and can take
// up to a minute to start, so we poll quickly until it answers, then slowly.
const BackendContext = createContext({ status: "checking", db: null, latency: null, waitedMs: 0, retry: () => {} });

export function BackendProvider({ children }) {
    const [state, setState] = useState({ status: "checking", db: null, latency: null, since: Date.now() });
    const [now, setNow] = useState(Date.now());
    const timer = useRef(null);
    const alive = useRef(true);

    const ping = async () => {
        clearTimeout(timer.current);
        const ctrl = new AbortController();
        const abort = setTimeout(() => ctrl.abort(), 10000);
        const t0 = performance.now();
        let up = false;
        try {
            const res = await fetch(`${getBackendUrl()}/api/ping`, { cache: "no-store", signal: ctrl.signal });
            const data = await res.json();
            up = !!data.success;
            if (!alive.current) return;
            setState((s) => ({ status: up ? "up" : "waking", db: data.db || null, latency: Math.round(performance.now() - t0), since: up ? s.since : s.since }));
        } catch {
            if (!alive.current) return;
            setState((s) => ({ ...s, status: s.status === "up" ? "down" : "waking", latency: null }));
        } finally {
            clearTimeout(abort);
        }
        if (alive.current) timer.current = setTimeout(ping, up ? 60000 : 2500);
    };

    useEffect(() => {
        alive.current = true;
        ping();
        const onOnline = () => ping();
        window.addEventListener("online", onOnline);
        return () => { alive.current = false; clearTimeout(timer.current); window.removeEventListener("online", onOnline); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Tick a clock only while we are waiting, for the "waking for 0:12" readout.
    useEffect(() => {
        if (state.status === "up") return undefined;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [state.status]);

    const value = {
        status: state.status,
        db: state.db,
        latency: state.latency,
        waitedMs: state.status === "up" ? 0 : now - state.since,
        retry: () => { setState((s) => ({ ...s, status: "checking", since: Date.now() })); ping(); },
    };
    return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export const useBackend = () => useContext(BackendContext);

export const backendLabel = ({ status, db }) => {
    if (status === "up") return db && db !== "ready" ? "Server up · database starting" : "All systems normal";
    if (status === "down") return "Server unreachable";
    return "Waking the server";
};
