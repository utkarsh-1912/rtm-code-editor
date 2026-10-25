import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WifiOff, X } from "lucide-react";

// Your own internet connection is down. This is separate from ServerWake (the server is slow
// or asleep while you're online) and follows the connection as it drops and comes back.
export default function OfflineNotice() {
    const [offline, setOffline] = useState(typeof navigator !== "undefined" && navigator.onLine === false);
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        const down = () => { setOffline(true); setHidden(false); };
        const up = () => setOffline(false);
        window.addEventListener("offline", down);
        window.addEventListener("online", up);
        return () => { window.removeEventListener("offline", down); window.removeEventListener("online", up); };
    }, []);

    if (!offline || hidden) return null;
    const isDesktop = !!window.colabsDesktop;
    return (
        <div className="ux sw sw--offline" role="status" aria-live="polite">
            <span className="sw-ico" aria-hidden="true"><WifiOff size={16} /></span>
            <div className="sw-text">
                <strong>No internet connection</strong>
                <span>{isDesktop ? "Your saved workspace and the offline editor still work. Rooms come back when you reconnect." : "Rooms reconnect by themselves when your connection is back."}</span>
            </div>
            {isDesktop && <Link className="u-btn u-btn--ghost u-btn--sm" to="/offline">Offline editor</Link>}
            <button className="u-icon" onClick={() => setHidden(true)} title="Hide" aria-label="Hide notice"><X size={15} /></button>
        </div>
    );
}
