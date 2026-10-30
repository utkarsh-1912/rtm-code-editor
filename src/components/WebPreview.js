import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./icons/Icon";

// Output panel for web projects: a live preview with a small browser toolbar, and the page's
// console. The console arrives as text lines tagged [LOG] / [WARN] / [ERROR], plus a
// "--- Web App Reloaded [time] ---" marker per rebuild (see ProjectPage).
const WIDTHS = [
    { id: "full", label: "Full width", icon: "device-desktop", px: null },
    { id: "tablet", label: "Tablet, 768px", icon: "device-tablet", px: 768 },
    { id: "phone", label: "Phone, 375px", icon: "device-phone", px: 375 },
];

const LEVEL = { LOG: "log", WARN: "warn", ERROR: "error" };
const LEVEL_ICON = { log: "log-info", warn: "log-warn", error: "log-error" };

const parseConsole = (text) => (text || "").split("\n").filter((l) => l.length).map((line) => {
    const reload = /^--- Web App Reloaded \[(.+)\] ---$/.exec(line);
    if (reload) return { kind: "reload", text: reload[1] };
    const tagged = /^\[(LOG|WARN|ERROR)\] ?(.*)$/.exec(line);
    if (tagged) return { kind: LEVEL[tagged[1]], text: tagged[2] };
    return { kind: "log", text: line };
});

export default function WebPreview({ srcDoc, consoleText, tab, onTab, onReload, onClearConsole, onOpenInTab, onHide, address, isMobile }) {
    const [width, setWidth] = useState("full");
    const rows = useMemo(() => parseConsole(consoleText), [consoleText]);
    const errors = rows.filter((r) => r.kind === "error").length;
    const logged = rows.filter((r) => r.kind !== "reload").length;
    const frameWidth = isMobile ? null : WIDTHS.find((w) => w.id === width)?.px;

    // Keep the newest console line in view.
    const consoleRef = useRef(null);
    useEffect(() => {
        const el = consoleRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [rows.length, tab]);

    return (
        <div className="ws-out">
            <div className="ws-pane-head">
                <div className="u-seg" role="tablist" aria-label="Output">
                    <button role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "on" : ""} onClick={() => onTab("preview")}>
                        <Icon name="preview" size={14} filled={tab === "preview"} /> Preview
                    </button>
                    <button role="tab" aria-selected={tab === "terminal"} className={tab === "terminal" ? "on" : ""} onClick={() => onTab("terminal")}>
                        <Icon name="terminal" size={14} filled={tab === "terminal"} /> Console
                        {logged > 0 && <i className={`wp-count${errors ? " is-bad" : ""}`}>{errors || logged}</i>}
                    </button>
                </div>
                <div className="ws-out-actions">
                    {tab === "terminal" && (
                        <button className="u-icon" onClick={onClearConsole} title="Clear console" aria-label="Clear console" disabled={!logged}><Icon name="delete" size={16} /></button>
                    )}
                    {onHide && <button className="u-icon" onClick={onHide} title="Hide panel" aria-label="Hide panel"><Icon name="close" size={16} /></button>}
                </div>
            </div>

            {tab === "preview" ? (
                <div className="wp-preview">
                    <div className="wp-bar">
                        <button className="u-icon" onClick={onReload} title="Reload preview" aria-label="Reload preview"><Icon name="reload" size={16} /></button>
                        <span className="wp-address" title={address}>{address}</span>
                        {!isMobile && (
                            <div className="wp-widths" role="radiogroup" aria-label="Preview width">
                                {WIDTHS.map((w) => (
                                    <button key={w.id} role="radio" aria-checked={width === w.id} className={`u-icon${width === w.id ? " on" : ""}`} onClick={() => setWidth(w.id)} title={w.label} aria-label={w.label}>
                                        <Icon name={w.icon} size={16} filled={width === w.id} />
                                    </button>
                                ))}
                            </div>
                        )}
                        <button className="u-icon" onClick={onOpenInTab} title="Open in a new tab" aria-label="Open preview in a new tab"><Icon name="open-external" size={16} /></button>
                    </div>
                    <div className={`wp-stage${frameWidth ? " is-framed" : ""}`}>
                        {srcDoc ? (
                            <iframe
                                srcDoc={srcDoc}
                                title="Web preview"
                                sandbox="allow-scripts allow-modals allow-forms allow-popups"
                                style={frameWidth ? { width: frameWidth } : undefined}
                            />
                        ) : (
                            <div className="wp-building"><span className="wp-spinner" aria-hidden="true" /> Building preview…</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="wp-console" ref={consoleRef} role="log" aria-live="polite">
                    {rows.length === 0 ? (
                        <p className="wp-empty">Nothing logged yet. <span>console.log, warnings and errors from the preview show up here.</span></p>
                    ) : rows.map((r, i) => r.kind === "reload" ? (
                        <div key={i} className="wp-reload"><span>Reloaded {r.text}</span></div>
                    ) : (
                        <div key={i} className={`wp-line is-${r.kind}`}>
                            <Icon name={LEVEL_ICON[r.kind]} size={14} />
                            <span>{r.text}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
