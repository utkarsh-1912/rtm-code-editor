import React, { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useBackend } from "../../context/BackendContext";

const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

// Floating notice shown while the API server is cold-starting or unreachable.
export default function ServerWake() {
    const { status, waitedMs, retry } = useBackend();
    const [hidden, setHidden] = useState(false);
    if (status === "up" || hidden || (status === "checking" && waitedMs < 1500)) return null;

    const down = status === "down";
    // Your own connection being down is a different problem (see OfflineNotice): the server
    // can't be judged while you're offline, so this stays quiet then.
    if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
    return (
        <div className="ux sw" role="status" aria-live="polite">
            <span className="sw-mark" aria-hidden="true"><i /></span>
            <div className="sw-text">
                <strong>{down ? "Lost the server" : "Waking the server"}</strong>
                <span>{down ? "Retrying in the background. Rooms reconnect on their own." : "Free hosting sleeps when idle; the first load can take up to a minute."}</span>
            </div>
            <span className="u-label sw-time">{mmss(waitedMs)}</span>
            <button className="u-icon" onClick={retry} title="Try again now" aria-label="Try again now"><RefreshCw size={15} /></button>
            <button className="u-icon" onClick={() => setHidden(true)} title="Hide" aria-label="Hide notice"><X size={15} /></button>
            <div className="sw-track" aria-hidden="true"><i /></div>
        </div>
    );
}
