import React from "react";
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex";
import "react-reflex/styles.css";
import Icon from "./icons/Icon";
import toast from "react-hot-toast";
import { parseDataFile, MAX_FILE_BYTES } from "../utils/sqlData";

// SQL rooms: imported tables (CSV / TSV / JSON) available to every query in the room.
function TablesPanel({ tables, setTables }) {
    const fileRef = React.useRef(null);
    const [preview, setPreview] = React.useState(null);

    const onFiles = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        for (const file of files) {
            if (file.size > MAX_FILE_BYTES) { toast.error(`${file.name} is over ${MAX_FILE_BYTES / 1024} KB`); continue; }
            try {
                const t = parseDataFile(file.name, await file.text());
                setTables((prev) => [...prev.filter((x) => x.name !== t.name), t]);
                toast.success(`Imported ${t.name} · ${t.rows.length} rows${t.truncated ? " (truncated)" : ""}`);
            } catch (err) {
                toast.error(`${file.name}: ${err.message}`);
            }
        }
    };

    return (
        <div className="ws-io-col">
            <div className="ws-pane-head">
                <span>Tables</span>
                <b>
                    <button type="button" className="ws-tbl-btn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={12} /> Import</button>
                </b>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.json,.txt" multiple hidden onChange={onFiles} />
            <div className="ws-tbl-list">
                {!tables.length && <p className="ws-tbl-empty">Import a CSV, TSV or JSON file and query it by name, e.g. <code>SELECT * FROM data;</code></p>}
                {tables.map((t) => (
                    <div key={t.name} className="ws-tbl">
                        <div className="ws-tbl-row">
                            <Icon name="table" size={14} /> <b>{t.name}</b> <span>{t.rows.length} rows</span>
                            <button type="button" title="Preview" onClick={() => setPreview(preview === t.name ? null : t.name)}><Icon name="show" size={14} /></button>
                            <button type="button" title="Remove" onClick={() => setTables((prev) => prev.filter((x) => x.name !== t.name))}><Icon name="delete" size={14} /></button>
                        </div>
                        <div className="ws-tbl-cols">{t.columns.map((c) => <i key={c.name}>{c.name}<em>{c.type.toLowerCase()}</em></i>)}</div>
                        {preview === t.name && (
                            <div className="ws-tbl-prev"><table>
                                <thead><tr>{t.columns.map((c) => <th key={c.name}>{c.name}</th>)}</tr></thead>
                                <tbody>{t.rows.slice(0, 8).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
                            </table></div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// Room I/O: what the program reads (stdin) beside what it printed.
export default function OutputWindow({ output, isError, time, isMobile, stdin, setStdin, language, tables, setTables }) {
    const input = language === "sql" && setTables ? <TablesPanel tables={tables || []} setTables={setTables} /> : (
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
