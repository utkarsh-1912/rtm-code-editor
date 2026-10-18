import React from "react";
import { Modal } from "./ux/primitives";

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

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            label="Editor"
            title="Editor settings"
            description="Saved on this device and applied to every room."
            footer={<button type="button" className="u-btn u-btn--solid" onClick={onClose}>Done</button>}
        >
            <div className="u-field">
                <span className="u-field-label">Font size</span>
                <Seg label="Font size" value={settings.fontSize || 16} onChange={(v) => set("fontSize", v)} options={[12, 14, 16, 18, 20, 24].map((n) => [n, n])} />
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
            </ul>
        </Modal>
    );
}
