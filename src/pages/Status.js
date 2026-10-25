import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import SiteLayout, { PageHead } from "../components/Site/SiteLayout";
import { getBackendUrl } from "../utils/api";
import { pad2 } from "../components/ux/primitives";

// Overall banner and per-service rows. "off" = not set up on this server (not an outage).
const LABEL = { ok: "All systems operational", degraded: "Some services are slow", partial: "Some services are down", down: "Service disruption", wait: "Checking systems…" };
const TEXT = { ok: "Operational", degraded: "Degraded", down: "Down", off: "Not enabled", wait: "Checking" };
const DOT = { ok: "u-dot", degraded: "u-dot u-dot--warn", partial: "u-dot u-dot--warn", down: "u-dot u-dot--bad", off: "u-dot st-dot-off", wait: "u-dot u-dot--warn" };
const BANNER = { ok: "ok", degraded: "wait", partial: "bad", down: "bad", wait: "wait" };
const HISTORY = 30;

export default function Status() {
    const [overall, setOverall] = useState("wait");
    const [components, setComponents] = useState([]);
    const [checked, setChecked] = useState(null);
    // API round trips made while this page is open (newest last).
    const [samples, setSamples] = useState([]);

    const check = useCallback(async () => {
        setOverall((o) => (o === "ok" ? o : "wait"));
        const t0 = performance.now();
        try {
            const res = await fetch(`${getBackendUrl()}/api/status`, { cache: "no-store" });
            const ms = Math.round(performance.now() - t0);
            if (res.status === 404) {
                // Older server without /api/status: fall back to a ping.
                const ping = await fetch(`${getBackendUrl()}/api/ping`, { cache: "no-store" }).then((r) => r.json());
                setOverall(ping.success ? "ok" : "down");
                setComponents([{ id: "api", name: "API", what: "Accounts, rooms, projects and saving", state: ping.success ? "ok" : "down", ms }]);
            } else {
                const data = await res.json();
                setOverall(data.overall || "down");
                setComponents(Array.isArray(data.components) ? data.components : []);
            }
            setSamples((s) => [...s, { state: "ok", ms }].slice(-HISTORY));
        } catch {
            setOverall("down");
            setComponents((list) => (list.length ? list.map((c) => (c.id === "api" ? { ...c, state: "down", detail: "Unreachable" } : c)) : [{ id: "api", name: "API", what: "Accounts, rooms, projects and saving", state: "down", detail: "Unreachable" }]));
            setSamples((s) => [...s, { state: "bad", ms: null }].slice(-HISTORY));
        }
        setChecked(new Date());
    }, []);

    useEffect(() => {
        check();
        const id = setInterval(check, 30000);
        return () => clearInterval(id);
    }, [check]);

    const rows = [
        ...components,
        { id: "web", name: "Web app", what: "This site", state: "ok", detail: "Serving this page" },
    ];
    const maxMs = Math.max(200, ...samples.map((s) => s.ms || 0));

    return (
        <SiteLayout>
            <PageHead label="Status" title={["System", "status."]} />

            <div className={`u-pane st-banner st-${BANNER[overall] || "wait"}`} data-rise>
                <span className={DOT[overall] || DOT.wait} style={{ width: 12, height: 12 }} />
                <strong>{LABEL[overall] || LABEL.wait}</strong>
                <button className="u-btn u-btn--ghost" onClick={check}><RefreshCw size={15} /> Refresh</button>
            </div>

            <section className="u-section u-head" style={{ marginTop: 48 }}>
                <span className="u-label" data-rise>Services</span>
                <div>
                    <ul className="u-rows">
                        {rows.map((c, i) => (
                            <li key={c.id} className="u-row st-row" style={{ cursor: "default" }}>
                                <span className="u-row-idx">{pad2(i + 1)}</span>
                                <div className="u-row-main">
                                    <span className="u-row-title">{c.name}</span>
                                    <span className="u-row-meta">
                                        <span>{c.what}</span>
                                        {(c.detail || c.ms != null) && <span className="u-mono">{[c.detail, c.ms != null && c.state !== "off" ? `${c.ms} ms` : null].filter(Boolean).join(" · ")}</span>}
                                    </span>
                                </div>
                                <span className="u-chip u-chip--mono"><span className={DOT[c.state] || DOT.wait} /> {TEXT[c.state] || TEXT.wait}</span>
                            </li>
                        ))}
                    </ul>

                    <div style={{ marginTop: 36 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                            <span className="u-label">Response time · this visit</span>
                            <span className="u-label">{samples.length} check{samples.length === 1 ? "" : "s"}</span>
                        </div>
                        <div className="st-bars" aria-label="Response time of each check since this page opened">
                            {Array.from({ length: HISTORY }).map((_, i) => {
                                const s = samples[i - (HISTORY - samples.length)];
                                if (!s) return <i key={i} className="empty" />;
                                return <i key={i} className={s.state} title={s.ms != null ? `${s.ms} ms` : "unreachable"} style={{ height: s.ms != null ? `${Math.max(10, (s.ms / maxMs) * 100)}%` : "100%" }} />;
                            })}
                        </div>
                        {checked && <p className="u-label" style={{ marginTop: 12 }}>Last checked {checked.toLocaleTimeString()} · refreshes every 30 seconds · service checks update every minute</p>}
                    </div>
                </div>
            </section>
        </SiteLayout>
    );
}
