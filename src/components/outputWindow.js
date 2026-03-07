import React from "react";
import { Terminal } from "lucide-react";

export default function OutputWindow({ output, isError, time, isMobile, stdin, setStdin }) {
    return (
        <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            height: "100%",
            backgroundColor: "var(--bg-dark)",
            borderTop: "1px solid var(--border-color)",
            fontFamily: "monospace",
            fontSize: "14px"
        }}>

            {/* Input Section */}
            <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderBottom: isMobile ? "2px solid var(--bg-dark)" : "none",
                borderRight: isMobile ? "none" : "1px solid var(--border-color)"
            }}>
                <div style={{ padding: "6px 16px", backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontWeight: "600", fontSize: "13px" }}>
                    Standard Input (stdin)
                </div>
                <textarea
                    value={stdin || ""}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder="Enter input for your program here..."
                    style={{
                        flex: 1,
                        width: "100%",
                        backgroundColor: "var(--bg-dark)",
                        border: "none",
                        color: "var(--text-main)",
                        padding: "12px 16px",
                        resize: "none",
                        outline: "none",
                        fontFamily: "monospace",
                        fontSize: "14px",
                    }}
                />
            </div>

            {/* Output Section */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 16px", backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Terminal size={14} color="var(--text-muted)" />
                        <span style={{ fontWeight: "600", color: "var(--text-muted)", fontSize: "13px" }}>Execution Output</span>
                    </div>
                    {time && (
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", backgroundColor: "var(--secondary)", padding: "2px 6px", borderRadius: "4px" }}>
                            Time: {time}s
                        </span>
                    )}
                </div>

                <div style={{ flex: 1, padding: "12px 16px", overflow: "auto", backgroundColor: "rgba(0,0,0,0.2)" }}>
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
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", opacity: 0.5, fontStyle: "italic", fontSize: "13px" }}>
                            Run your code to see the output here.
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
