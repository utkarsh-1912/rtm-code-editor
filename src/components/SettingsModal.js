import React, { useEffect, useRef } from "react";
import { X, Settings, Type, AlignLeft, WrapText } from "lucide-react";

export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange }) {
    const modalRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleChange = (key, value) => {
        onSettingsChange({ ...settings, [key]: value });
    };

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
            <div ref={modalRef} style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "16px",
                width: "90%",
                maxWidth: "400px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                overflow: "hidden",
                animation: "slideUp 0.3s ease-out"
            }}>
                {/* Header */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "16px 20px", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-dark)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-main)", fontWeight: "600" }}>
                        <Settings size={18} color="var(--primary)" />
                        <span>Editor Settings</span>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: "20px" }}>

                    {/* Font Size */}
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", color: "var(--text-muted)", fontSize: "14px", fontWeight: "500" }}>
                            <Type size={14} /> Font Size
                        </div>
                        <select
                            value={settings.fontSize}
                            onChange={(e) => handleChange("fontSize", parseInt(e.target.value))}
                            style={{
                                width: "100%", padding: "10px", borderRadius: "8px", backgroundColor: "var(--bg-dark)",
                                border: "1px solid var(--border-color)", color: "var(--text-main)", fontSize: "14px", outline: "none"
                            }}
                        >
                            {[12, 14, 16, 18, 20, 24].map(size => (
                                <option key={size} value={size}>{size}px</option>
                            ))}
                        </select>
                    </div>

                    {/* Tab Size */}
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", color: "var(--text-muted)", fontSize: "14px", fontWeight: "500" }}>
                            <AlignLeft size={14} /> Tab Size
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                            {[2, 4].map(size => (
                                <button
                                    key={size}
                                    onClick={() => handleChange("tabSize", size)}
                                    style={{
                                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer", transition: "all 0.2s",
                                        backgroundColor: settings.tabSize === size ? "var(--primary)" : "var(--bg-dark)",
                                        color: settings.tabSize === size ? "white" : "var(--text-main)",
                                        border: settings.tabSize === size ? "1px solid var(--primary)" : "1px solid var(--border-color)"
                                    }}
                                >
                                    {size} spaces
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Word Wrap */}
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", color: "var(--text-muted)", fontSize: "14px", fontWeight: "500" }}>
                            <WrapText size={14} /> Word Wrap
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                            {[{ label: "Off", value: false }, { label: "On", value: true }].map(opt => (
                                <button
                                    key={opt.label}
                                    onClick={() => handleChange("wordWrap", opt.value)}
                                    style={{
                                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer", transition: "all 0.2s",
                                        backgroundColor: settings.wordWrap === opt.value ? "var(--primary)" : "var(--bg-dark)",
                                        color: settings.wordWrap === opt.value ? "white" : "var(--text-main)",
                                        border: settings.wordWrap === opt.value ? "1px solid var(--primary)" : "1px solid var(--border-color)"
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
