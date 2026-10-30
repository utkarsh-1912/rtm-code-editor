import React, { useId } from "react";

// CoLabs AI Copilot mark: a chat bubble (the same shape as Chat in the Teams-style set) with
// a four-point spark inside, meaning "an assistant you talk to". Drawn at Fluent's weight:
// 24px grid, 1.5px line, round caps and joins. `filled` is the solid bubble with the spark
// cut out, for an active state.
const BUBBLE = "M7 3.5h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-6l-4 3.25V17.5A4 4 0 0 1 3 13.5v-6a4 4 0 0 1 4-4Z";
const SPARK = "M12 6.2Q12.86 9.64 16.3 10.5Q12.86 11.36 12 14.8Q11.14 11.36 7.7 10.5Q11.14 9.64 12 6.2Z";

export default function AiIcon({ size = 18, filled = false, className, title, ...rest }) {
    const mask = useId();
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`ai-icon${className ? ` ${className}` : ""}`}
            aria-hidden={title ? undefined : true}
            role={title ? "img" : undefined}
            {...rest}
        >
            {title && <title>{title}</title>}
            {filled ? (
                <>
                    <mask id={mask}>
                        <rect width="24" height="24" fill="#fff" />
                        <path d={SPARK} fill="#000" stroke="#000" strokeWidth={1} />
                    </mask>
                    <path d={BUBBLE} fill="currentColor" mask={`url(#${mask})`} />
                </>
            ) : (
                <>
                    <path d={BUBBLE} />
                    <path d={SPARK} />
                </>
            )}
        </svg>
    );
}
