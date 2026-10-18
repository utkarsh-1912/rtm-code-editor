import React from "react";

// Brand mark: an ink tile with the workspace ring knocked out of it and the accent
// presence dot (a collaborator joining) breaking out of the corner. Every colour is a
// theme token (.brand-* in styles/app.css), so the mark inverts with dark/light.
// Wordmark: condensed display "UTKRISTI" + mono "colabs".
export default function Logo({ size = 30, compact = false, className = "", onClick }) {
    return (
        <span className={`brand ${className}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
            aria-label={compact ? "Utkristi CoLabs" : undefined}
            onKeyDown={onClick ? (e) => e.key === "Enter" && onClick(e) : undefined}>
            <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
                <rect className="brand-tile" x="1" y="1" width="28" height="28" rx="8.5" />
                <path className="brand-ring" d="M21.6 18.7 A7 7 0 1 1 18.7 9.4" fill="none" strokeWidth="2.6" strokeLinecap="round" />
                <circle className="brand-halo" cx="24.5" cy="24.5" r="6.4" />
                <circle className="brand-dot" cx="24.5" cy="24.5" r="4" />
            </svg>
            {!compact && (
                <span className="brand-name" style={{ fontSize: Math.round(size * 0.66) }} role="img" aria-label="Utkristi CoLabs">
                    <span className="brand-pre" aria-hidden="true">Utkristi</span>
                    <span className="brand-co" aria-hidden="true">colabs</span>
                </span>
            )}
        </span>
    );
}
