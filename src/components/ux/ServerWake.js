import React, { useState } from "react";
import Icon from "../icons/Icon";
import { useBackend } from "../../context/BackendContext";

const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

// Floating notice shown while the API server is cold-starting or unreachable.
export default function ServerWake() {
    const { status, waitedMs, retry } = useBackend();
    const [hidden, setHidden] = useState(false);
    if (status === "up" || hidden || (status === "checking" && waitedMs < 1500)) return null;

    const down = status === "down";
    return (
        <div className="ux sw" role="status" aria-live="polite">
            <span className="sw-mark" aria-hidden="true"><i /></span>
            <div className="sw-text">
                <strong>{down ? "Lost the server" : "Waking the server"}</strong>
                <span>{down ? "Retrying in the background. Rooms reconnect on their own." : "Free hosting sleeps when idle; the first load can take up to a minute."}</span>
            </div>
            <span className="u-label sw-time">{mmss(waitedMs)}</span>
            <button className="u-icon" onClick={retry} title="Try again now" aria-label="Try again now"><Icon name="reload" size={16} /></button>
            <button className="u-icon" onClick={() => setHidden(true)} title="Hide" aria-label="Hide notice"><Icon name="close" size={16} /></button>
            <div className="sw-track" aria-hidden="true"><i /></div>
        </div>
    );
}
