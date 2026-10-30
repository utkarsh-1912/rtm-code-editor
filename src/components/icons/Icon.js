import React from "react";
import ICONS from "./registry";
import "./icons.css";

// The one way to draw an icon in CoLabs: <Icon name="mic" size={16} filled={!isMuted} />.
// Outline by default; `filled` is for a pressed toggle or the current navigation item.
// Decorative (aria-hidden) unless `label` is given, which names it for screen readers.
export const ICON_SIZES = [12, 14, 16, 20, 24];

const snapSize = (size) => {
    if (ICON_SIZES.includes(size)) return size;
    const nearest = ICON_SIZES.reduce((best, s) => (Math.abs(s - size) < Math.abs(best - size) ? s : best));
    if (process.env.NODE_ENV !== "production") {
        console.warn(`<Icon> size ${size} is not a token (${ICON_SIZES.join("/")}); using ${nearest}.`);
    }
    return nearest;
};

export default function Icon({ name, size = 16, filled = false, label, className, style, ...rest }) {
    const entry = ICONS[name];
    if (!entry) {
        if (process.env.NODE_ENV !== "production") console.warn(`<Icon> has no icon named "${name}".`);
        return null;
    }
    const Glyph = filled ? entry.filled : entry.outline;
    const px = snapSize(size);
    return (
        <Glyph
            className={`cl-icon${className ? ` ${className}` : ""}`}
            // Glyphs are 1em square, so font-size sets the size and a stylesheet width can still override it.
            style={{ fontSize: px, ...style }}
            aria-hidden={label ? undefined : true}
            aria-label={label || undefined}
            role={label ? "img" : undefined}
            focusable="false"
            data-icon={name}
            {...rest}
        />
    );
}
