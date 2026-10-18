import React, { useState, useMemo } from "react";
import { FileCode, FileText, Plus, Search, Trash2, Upload, Braces, Palette, Globe, Coffee, Terminal, X } from "lucide-react";

const ICONS = {
    js: [Braces, "#f7df1e"], jsx: [Braces, "#61dafb"], ts: [Braces, "#3178c6"],
    html: [Globe, "#e34f26"], css: [Palette, "#2965f1"],
    py: [Terminal, "#3776ab"], java: [Coffee, "#f89820"],
    cpp: [FileCode, "#659ad2"], h: [FileCode, "#a074c4"], c: [FileCode, "#659ad2"],
};

const extOf = (name) => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

export function FileIcon({ name, size = 14 }) {
    const [Icon, color] = ICONS[extOf(name)] || [FileText, "var(--text-muted)"];
    return <Icon size={size} color={color} style={{ flexShrink: 0 }} />;
}

// File explorer for the project workspace: search, inline creation, per-file delete.
export default function ProjectFileTree({ files, activeFile, onSelect, onCreate, onDelete, onImport, project }) {
    const [query, setQuery] = useState("");
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState("");

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return [...files]
            .filter((f) => !q || f.name.toLowerCase().includes(q))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [files, query]);

    const submit = (e) => {
        e.preventDefault();
        const n = name.trim();
        if (n) onCreate(n);
        setName("");
        setCreating(false);
    };

    return (
        <div className="ftree">
            <div className="ftree-meta">
                <strong className="ftree-title">{project?.name || "Project"}</strong>
                <span className="mode-chip">{project?.type || "web"}</span>
            </div>

            <div className="ftree-actions">
                <div className="ftree-search">
                    <Search size={13} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files" aria-label="Search files" />
                    {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={12} /></button>}
                </div>
                <button className="ftree-icon" title="New file" onClick={() => setCreating(true)}><Plus size={15} /></button>
                <label className="ftree-icon" title="Import file">
                    <Upload size={14} />
                    <input type="file" style={{ display: "none" }} onChange={onImport} />
                </label>
            </div>

            {creating && (
                <form onSubmit={submit} className="ftree-new">
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => { if (!name.trim()) setCreating(false); }}
                        onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
                        placeholder="filename.ext"
                    />
                </form>
            )}

            <div className="ftree-list">
                {visible.map((file) => (
                    <div
                        key={file.id}
                        className={`ftree-item${activeFile?.id === file.id ? " active" : ""}`}
                        onClick={() => onSelect(file)}
                    >
                        <FileIcon name={file.name} />
                        <span className="ftree-name">{file.name}</span>
                        <button
                            className="ftree-del"
                            title="Delete file"
                            onClick={(e) => { e.stopPropagation(); onDelete(file); }}
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                ))}
                {visible.length === 0 && (
                    <div className="ftree-empty">
                        {files.length === 0 ? (
                            <>
                                <p>No files yet.</p>
                                <button className="btn btn-primary" style={{ height: 34, fontSize: 13 }} onClick={() => setCreating(true)}>
                                    <Plus size={14} /> New file
                                </button>
                            </>
                        ) : (
                            <p>No files match "{query}".</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
