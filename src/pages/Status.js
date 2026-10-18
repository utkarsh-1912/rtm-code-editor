import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import SiteLayout, { PageHead } from "../components/Site/SiteLayout";
import { getBackendUrl } from "../utils/api";
import { pad2 } from "../components/ux/primitives";

const LABEL = { ok: "All systems operational", bad: "Service disruption detected", wait: "Checking systems…" };
const TEXT = { ok: "Operational", bad: "Unreachable", wait: "Checking" };
const DOT = { ok: "u-dot", bad: "u-dot u-dot--bad", wait: "u-dot u-dot--warn" };
const HISTORY = 30;

export default function Status() {
    const [api, setApi] = useState({ state: "wait", ms: null });
    const [checked, setChecked] = useState(null);
    // Latency of each check made while this page is open (newest last).
    const [samples, setSamples] = useState([]);

    const check = useCallback(async () => {
        setApi((s) => ({ ...s, state: "wait" }));
        const t0 = performance.now();
        let next;
        try {
            const res = await fetch(`${getBackendUrl()}/api/ping`, { cache: "no-store" });
            const data = await res.json();
            next = { state: data.success ? "ok" : "bad", ms: Math.round(performance.now() - t0) };
        } catch {
            next = { state: "bad", ms: null };
        }
        setApi(next);
        setSamples((s) => [...s, next].slice(-HISTORY));
        setChecked(new Date());
    }, []);

    useEffect(() => {
        check();
        const id = setInterval(check, 30000);
        return () => clearInterval(id);
    }, [check]);

    const rows = [
        ["API & real-time sync", api.state, api.ms != null ? `${api.ms} ms` : "—"],
        ["Web app", "ok", "Serving this page"],
    ];
    const maxMs = Math.max(200, ...samples.map((s) => s.ms || 0));

    return (
        <SiteLayout>
            <PageHead label="Status" title={["System", "status."]} />

            <div className={`u-pane st-banner st-${api.state}`} data-rise>
                <span className={DOT[api.state]} style={{ width: 12, height: 12 }} />
                <strong>{LABEL[api.state]}</strong>
                <button className="u-btn u-btn--ghost" onClick={check}><RefreshCw size={15} /> Refresh</button>
            </div>

            <section className="u-section u-head" style={{ marginTop: 48 }}>
                <span className="u-label" data-rise>Components</span>
                <div>
                    <ul className="u-rows">
                        {rows.map(([name, state, detail], i) => (
                            <li key={name} className="u-row" style={{ cursor: "default" }}>
                                <span className="u-row-idx">{pad2(i + 1)}</span>
                                <div className="u-row-main">
                                    <span className="u-row-title">{name}</span>
                                    <span className="u-row-meta"><span className="u-mono">{detail}</span></span>
                                </div>
                                <span className="u-chip u-chip--mono"><span className={DOT[state]} /> {TEXT[state]}</span>
                            </li>
                        ))}
                    </ul>

                    <div style={{ marginTop: 36 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                            <span className="u-label">API latency · this visit</span>
                            <span className="u-label">{samples.length} check{samples.length === 1 ? "" : "s"}</span>
                        </div>
                        <div className="st-bars" aria-label="Latency of each check since this page opened">
                            {Array.from({ length: HISTORY }).map((_, i) => {
                                const s = samples[i - (HISTORY - samples.length)];
                                if (!s) return <i key={i} className="empty" />;
                                return <i key={i} className={s.state} title={s.ms != null ? `${s.ms} ms` : "unreachable"} style={{ height: s.ms != null ? `${Math.max(10, (s.ms / maxMs) * 100)}%` : "100%" }} />;
                            })}
                        </div>
                        {checked && <p className="u-label" style={{ marginTop: 12 }}>Last checked {checked.toLocaleTimeString()} · refreshes every 30 seconds</p>}
                    </div>
                </div>
            </section>
        </SiteLayout>
    );
}
