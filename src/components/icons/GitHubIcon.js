import React from "react";

// GitHub mark for the GitHub actions (Fluent has no brand logos). Outline from Lucide's
// `github` icon (ISC), redrawn on the CoLabs brand grid: 24px, 1.5px line (Fluent weight), round caps.
// `filled` thickens the stroke for an active state.
export default function GitHubIcon({ size = 18, strokeWidth = 1.5, filled = false, className, title, ...rest }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={filled ? strokeWidth + 0.75 : strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`github-icon${className ? ` ${className}` : ""}`}
            aria-hidden={title ? undefined : true}
            role={title ? "img" : undefined}
            {...rest}
        >
            {title && <title>{title}</title>}
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
        </svg>
    );
}
