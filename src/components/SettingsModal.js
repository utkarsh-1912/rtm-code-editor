import React, { useState } from "react";
import { Modal, Slider } from "./ux/primitives";
import { getCallPrefs, saveCallPrefs } from "../utils/callPrefs";

const Seg = ({ value, options, onChange, label }) => (
    <div className="u-seg" role="radiogroup" aria-label={label} style={{ width: "100%" }}>
        {options.map(([v, text]) => (
            <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)} style={{ flex: 1, justifyContent: "center" }}>
                {text}
            </button>
        ))}
    </div>
);

export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange }) {
    const set = (key, value) => onSettingsChange({ ...settings, [key]: value });
    // Stored with the other call preferences, not the editor settings.
    const [keepCall, setKeepCall] = useState(() => getCallPrefs().keepOnNavigate);
    const toggleKeepCall = () => {
        saveCallPrefs({ keepOnNavigate: !keepCall });
        setKeepCall(!keepCall);
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            label="Editor"
            title="Editor settings"
            description="Saved on this device and applied to every room and project."
            footer={<button type="button" className="u-btn u-btn--solid" onClick={onClose}>Done</button>}
        >
            <div className="u-field">
                <span className="u-field-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    Font size
                    <span className="u-mono" style={{ fontSize: settings.fontSize || 16, lineHeight: 1, color: "var(--u-ink)" }}>Aa</span>
                </span>
                <Slider id="font-size" label="Editor font size" min={10} max={28} value={settings.fontSize || 16} onChange={(v) => set("fontSize", v)} marks={[10, 14, 16, 20, 24, 28]} format={(v) => `${v}px`} />
            </div>
            <div className="u-field">
                <span className="u-field-label">Tab size</span>
                <Seg label="Tab size" value={settings.tabSize || 4} onChange={(v) => set("tabSize", v)} options={[[2, "2 spaces"], [4, "4 spaces"]]} />
            </div>
            <div className="u-field">
                <span className="u-field-label">Keybindings</span>
                <Seg label="Keybindings" value={settings.keybinding || "default"} onChange={(v) => set("keybinding", v)} options={[["default", "Default"], ["vim", "Vim"], ["emacs", "Emacs"]]} />
            </div>
            <ul className="g-rules" style={{ margin: "0 -24px", borderTop: "1px solid var(--u-line)" }}>
                <li style={{ gridTemplateColumns: "minmax(0,1fr) auto", padding: "16px 24px" }}>
                    <div>
                        <h5>Word wrap</h5>
                        <p>Wrap long lines instead of scrolling sideways.</p>
                    </div>
                    <button type="button" className="u-switch" role="switch" aria-checked={!!settings.wordWrap} aria-label="Word wrap" onClick={() => set("wordWrap", !settings.wordWrap)} />
                </li>
                <li style={{ gridTemplateColumns: "minmax(0,1fr) auto", padding: "16px 24px" }}>
                    <div>
                        <h5>Lint JavaScript</h5>
                        <p>Underline problems as you type (JavaScript only).</p>
                    </div>
                    <button type="button" className="u-switch" role="switch" aria-checked={!!settings.enableLinting} aria-label="Lint JavaScript" onClick={() => set("enableLinting", !settings.enableLinting)} />
                </li>
                <li style={{ gridTemplateColumns: "minmax(0,1fr) auto", padding: "16px 24px" }}>
                    <div>
                        <h5>Keep calls on other pages</h5>
                        <p>Stay in a call when you open the dashboard or another room or project. Off: leaving the page ends the call.</p>
                    </div>
                    <button type="button" className="u-switch" role="switch" aria-checked={keepCall} aria-label="Keep calls on other pages" onClick={toggleKeepCall} />
                </li>
            </ul>
        </Modal>
    );
}
