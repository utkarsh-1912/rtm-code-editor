import React from "react";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import "react-reflex/styles.css";

// Room I/O: what the program reads (stdin) beside what it printed.
export default function OutputWindow({ output, isError, time, isMobile, stdin, setStdin }) {
    const input = (
        <div className="ws-io-col">
            <div className="ws-pane-head"><span>Input</span><b>stdin</b></div>
            <textarea
                className="ws-stdin"
                value={stdin || ""}
                onChange={(e) => setStdin && setStdin(e.target.value)}
                placeholder="Text your program reads from standard input"
                spellCheck={false}
                aria-label="Program input"
            />
        </div>
    );

    const result = (
        <div className="ws-io-col">
            <div className="ws-pane-head">
                <span>Output</span>
                {output && (
                    <b className={isError ? "io-bad" : "io-ok"}>
                        {isError ? "error" : "ok"}{time !== null && time !== undefined ? ` · ${time}s` : ""}
                    </b>
                )}
            </div>
            <pre className={`ws-console${isError ? " is-error" : ""}`} aria-live="polite">
                {output || <span className="u-caret">No output yet. Press Run</span>}
            </pre>
        </div>
    );

    return (
        <div className="ws-out ws-io" style={{ borderTop: "1px solid var(--u-line)" }}>
            {isMobile ? (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
                    {input}
                    {result}
                </div>
            ) : (
                <ReflexContainer orientation="vertical">
                    <ReflexElement flex={0.42} minSize={140}>{input}</ReflexElement>
                    <ReflexSplitter />
                    <ReflexElement flex={0.58} minSize={160}>{result}</ReflexElement>
                </ReflexContainer>
            )}
        </div>
    );
}
