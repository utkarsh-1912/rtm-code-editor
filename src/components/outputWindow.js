import React from "react";
import { Terminal } from "lucide-react";

export default function OutputWindow({ output, isError, time, isMobile }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "var(--bg-dark)", borderTop: "1px solid var(--border-color)", fontFamily: "monospace", fontSize: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Terminal size={16} color="var(--text-muted)" />
                    <span style={{ fontWeight: "600", color: "var(--text-muted)" }}>Execution Output</span>
                </div>
                {time && (
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", backgroundColor: "var(--secondary)", padding: "2px 8px", borderRadius: "4px" }}>
                        Time: {time}s
                    </span>
                )}
            </div>

            <div style={{ flex: 1, padding: "16px", overflow: "auto" }}>
                {output ? (
                    <pre style={{
                        whiteSpace: "pre-wrap",
                        margin: 0,
                        fontSize: "13px",
                        lineHeight: 1.5,
                        color: isError ? "#f87171" : "#4ade80"
                    }}>
                        {output}
                    </pre>
                ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", opacity: 0.5, fontStyle: "italic" }}>
                        Run your code to see the output here.
                    </div>
                )}
            </div>
        </div>
    );
}
