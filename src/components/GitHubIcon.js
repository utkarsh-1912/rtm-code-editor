import React from "react";

// GitHub mark, drawn as a CoLabs brand icon: 24px grid, 1.75px stroke, round caps and joins.
// Outline by default; `filled` gives the solid twin for an active or current state.
// Head traced symmetrically about x = 12; the outline leaves the neck open, the filled one closes it.
const HEAD = "M9 22v-3.6c0-.9.2-1.6.7-2.2C6.6 15.9 4 14.4 4 10.4c0-1.3.4-2.4 1.2-3.3-.3-1-.3-2.2.2-3.6 0 0 1.2-.3 3.4 1.3a11 11 0 0 1 6.4 0c2.2-1.6 3.4-1.3 3.4-1.3.5 1.4.5 2.6.2 3.6.8.9 1.2 2 1.2 3.3 0 4-2.6 5.5-5.7 5.8.5.6.7 1.4.7 2.2V22";
const TAIL = "M9 19c-3 .9-3.9-1.6-5.5-2";

export default function GitHubIcon({ size = 18, strokeWidth = 1.75, filled = false, className, title, ...rest }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`github-icon${filled ? " github-icon--filled" : ""}${className ? ` ${className}` : ""}`}
            aria-hidden={title ? undefined : true}
            role={title ? "img" : undefined}
            {...rest}
        >
            {title && <title>{title}</title>}
            <path d={filled ? `${HEAD}Z` : HEAD} fill={filled ? "currentColor" : "none"} />
            <path d={TAIL} />
        </svg>
    );
}
