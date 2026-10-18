import React, { useEffect, useState } from "react";
import "../../styles/app.css";

// Shared loading state: the brand mark drawing its ring, a breathing presence dot,
// a mono status line, an indeterminate track and an elapsed timer.
//   variant: "screen" (fixed, full viewport) | "fill" (fills its parent) | "inline"
export default function Loader({ message = "Loading", variant = "fill", detail }) {
    const [secs, setSecs] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setSecs((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className={`ux ld ld--${variant}`} role="status" aria-live="polite">
            {variant === "screen" && <div className="u-grain" aria-hidden="true" />}
            <div className="ld-core">
                <svg className="ld-mark" viewBox="0 0 32 32" aria-hidden="true">
                    <rect className="brand-tile" x="1" y="1" width="28" height="28" rx="8.5" />
                    <path className="brand-ring ld-ring" d="M21.6 18.7 A7 7 0 1 1 18.7 9.4" fill="none" strokeWidth="2.6" strokeLinecap="round" pathLength="100" />
                    <circle className="brand-halo" cx="24.5" cy="24.5" r="6.4" />
                    <circle className="brand-dot ld-dot" cx="24.5" cy="24.5" r="4" />
                </svg>
                <div className="ld-text">
                    <span className="ld-msg">{message}<span className="ld-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></span>
                    {detail && <span className="u-label">{detail}</span>}
                </div>
                <div className="ld-track" aria-hidden="true"><i /></div>
                <span className="u-label ld-time" aria-hidden="true">{String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}</span>
            </div>
        </div>
    );
}
