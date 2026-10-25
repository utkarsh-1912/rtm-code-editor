import React, { useEffect, useRef } from "react";
import { SquareTerminal, X } from "lucide-react";
import { desktop } from "../utils/desktop";

// Things drawn over the page (dialogs, menus, popovers). The terminal is a native view on top
// of the page, so it steps aside while any of these is open.
const OVERLAYS = ".u-modal-back, .sx-back, .rl-menu, .u-pop, .ftree-pop, .ra-screen, .wsh-menu, .rl-drop";

// A terminal inside the layout (desktop app). The page only tells the app where the panel is;
// commands come solely from typing in the terminal itself.
export default function TerminalPanel({ dockKey, cwd, title, onClose }) {
    const slotRef = useRef(null);
    const bridge = desktop();
    const supported = !!bridge?.terminalDock;

    useEffect(() => {
        if (!supported) return undefined;
        let frame = 0;
        let last = "";
        const place = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const el = slotRef.current;
                if (!el) return;
                const r = el.getBoundingClientRect();
                const covered = !!document.querySelector(OVERLAYS);
                const visible = !covered && r.width > 20 && r.height > 20 && document.visibilityState === "visible";
                const key = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), visible].join(",");
                if (key === last) return;
                last = key;
                bridge.terminalDock({ key: dockKey, cwd, title, rect: { x: r.left, y: r.top, width: r.width, height: r.height }, visible }).catch(() => { });
            });
        };
        place();
        const ro = new ResizeObserver(place);
        ro.observe(slotRef.current);
        // Dialogs and menus come and go as DOM nodes; splitter drags move the slot.
        const mo = new MutationObserver(place);
        mo.observe(document.body, { childList: true, subtree: true });
        const poll = setInterval(place, 700);
        window.addEventListener("resize", place);
        document.addEventListener("visibilitychange", place);
        const off = bridge.onTerminalClosed?.(({ key }) => { if (key === dockKey) onClose?.(); });
        return () => {
            cancelAnimationFrame(frame);
            ro.disconnect();
            mo.disconnect();
            clearInterval(poll);
            window.removeEventListener("resize", place);
            document.removeEventListener("visibilitychange", place);
            off?.();
            bridge.terminalClose({ key: dockKey }).catch(() => { });
        };
        // cwd/title only matter when the terminal starts; re-docking on change would restart it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supported, dockKey]);

    // One header only: in the desktop app the terminal draws its own (folder, Stop, Clear, Pop
    // out, Close); elsewhere a short note explains where the terminal lives.
    return (
        <div className="term-panel">
            <div className="term-slot" ref={slotRef}>
                {!supported && (
                    <p className="term-note">
                        <SquareTerminal size={14} /> The terminal is part of the desktop app. Download it to run commands in your project folder.
                        {onClose && <button className="u-icon" onClick={onClose} title="Close" aria-label="Close"><X size={14} /></button>}
                    </p>
                )}
            </div>
        </div>
    );
}
