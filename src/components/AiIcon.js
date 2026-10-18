import React from "react";

// AI copilot mark: code brackets around a four-point spark. Drawn on the same 24px grid,
// stroke and round caps as the lucide icons beside it, so it sits naturally in toolbars.
export default function AiIcon({ size = 18, strokeWidth = 2, className, title, ...rest }) {
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
            className={`ai-icon${className ? ` ${className}` : ""}`}
            aria-hidden={title ? undefined : true}
            role={title ? "img" : undefined}
            {...rest}
        >
            {title && <title>{title}</title>}
            <path d="M6.5 7.5 2.5 12l4 4.5" />
            <path d="M17.5 7.5 21.5 12l-4 4.5" />
            <path
                className="ai-icon-spark"
                d="M12 7.6c.35 2.55 1.45 3.65 4 4-2.55.35-3.65 1.45-4 4-.35-2.55-1.45-3.65-4-4 2.55-.35 3.65-1.45 4-4Z"
                fill="currentColor"
                strokeWidth={strokeWidth * 0.6}
            />
            <circle cx="18.6" cy="4.6" r="1.1" fill="currentColor" stroke="none" />
        </svg>
    );
}
