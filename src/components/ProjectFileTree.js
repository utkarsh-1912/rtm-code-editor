import React, { useEffect, useMemo, useState } from "react";
import {
    FileCode, FileText, Plus, Search, Trash2, Upload, Braces, Palette, Globe, Coffee, Terminal, X,
    ChevronRight, Folder, FolderOpen, FolderPlus, FilePlus, ChevronsDownUp,
} from "lucide-react";

const ICONS = {
    js: [Braces, "#f7df1e"], jsx: [Braces, "#61dafb"], ts: [Braces, "#3178c6"], tsx: [Braces, "#3178c6"],
    html: [Globe, "#e34f26"], css: [Palette, "#2965f1"], json: [Braces, "#cbcb41"],
    py: [Terminal, "#3776ab"], java: [Coffee, "#f89820"], md: [FileText, "#7aa2ff"],
    cpp: [FileCode, "#659ad2"], h: [FileCode, "#a074c4"], c: [FileCode, "#659ad2"], rs: [FileCode, "#dea584"], go: [FileCode, "#00add8"],
};

const extOf = (name) => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");
export const relPath = (f) => String(f.path || f.name || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
const baseName = (p) => p.split("/").pop();

export function FileIcon({ name, size = 14 }) {
    const [Icon, color] = ICONS[extOf(name)] || [FileText, "var(--text-muted)"];
    return <Icon size={size} color={color} style={{ flexShrink: 0 }} />;
}

// Nested tree from flat rows: files are placed by path; folder rows (is_directory) keep
// empty folders visible. Folders first, then files, alphabetically.
function buildTree(files) {
    const root = { path: "", folders: new Map(), files: [] };
    const folderAt = (path) => {
        let node = root;
        if (!path) return node;
        let acc = "";
        for (const seg of path.split("/")) {
            acc = acc ? `${acc}/${seg}` : seg;
            if (!node.folders.has(seg)) node.folders.set(seg, { name: seg, path: acc, folders: new Map(), files: [] });
            node = node.folders.get(seg);
        }
        return node;
    };
    for (const f of files) {
        const p = relPath(f);
        if (!p) continue;
        if (f.is_directory || f.isDirectory) { folderAt(p).row = f; continue; }
        const parts = p.split("/");
        folderAt(parts.slice(0, -1).join("/")).files.push({ file: f, name: parts[parts.length - 1], path: p });
    }
    return root;
}

const ancestors = (p) => p.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/"));

// File explorer for the project workspace: nested folders, search, inline creation of files
// and folders (anywhere in the tree), and delete.
export default function ProjectFileTree({ files, activeFile, onSelect, onCreate, onDelete, onImport, project }) {
    const storeKey = `ftree-open-${project?.id || "x"}`;
    const [query, setQuery] = useState("");
    const [creating, setCreating] = useState(null); // { parent: "src", kind: "file" | "folder" }
    const [name, setName] = useState("");
    const [open, setOpen] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem(storeKey)) || []); } catch { return new Set(); }
    });

    useEffect(() => {
        try { localStorage.setItem(storeKey, JSON.stringify([...open])); } catch { /* storage blocked */ }
    }, [open, storeKey]);

    // Reveal the active file.
    const activePath = activeFile ? relPath(activeFile) : "";
    useEffect(() => {
        if (!activePath.includes("/")) return;
        setOpen((prev) => {
            const need = ancestors(activePath).filter((a) => !prev.has(a));
            return need.length ? new Set([...prev, ...need]) : prev;
        });
    }, [activePath]);

    const tree = useMemo(() => buildTree(files), [files]);
    const fileCount = useMemo(() => files.filter((f) => !(f.is_directory || f.isDirectory)).length, [files]);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return null;
        return files
            .filter((f) => !(f.is_directory || f.isDirectory) && relPath(f).toLowerCase().includes(q))
            .sort((a, b) => relPath(a).localeCompare(relPath(b)));
    }, [files, query]);

    const toggle = (path) => setOpen((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path); else next.add(path);
        return next;
    });

    const startCreate = (parent, kind) => {
        if (parent) setOpen((prev) => new Set([...prev, parent]));
        setQuery("");
        setName("");
        setCreating({ parent, kind });
    };

    const submit = (e) => {
        e.preventDefault();
        const n = name.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        if (n && creating) {
            const path = creating.parent ? `${creating.parent}/${n}` : n;
            onCreate(path, { isDirectory: creating.kind === "folder" });
            if (creating.kind === "folder") setOpen((prev) => new Set([...prev, ...ancestors(`${path}/x`)]));
        }
        setName("");
        setCreating(null);
    };

    const createRow = (parent, depth) => (creating && creating.parent === parent ? (
        <form onSubmit={submit} className="ftree-new" style={{ paddingLeft: 10 + depth * 14 }}>
            {creating.kind === "folder" ? <Folder size={14} /> : <FileText size={14} />}
            <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => { if (!name.trim()) setCreating(null); }}
                onKeyDown={(e) => e.key === "Escape" && setCreating(null)}
                placeholder={creating.kind === "folder" ? "folder name" : "file.ext (or dir/file.ext)"}
                aria-label={creating.kind === "folder" ? "New folder name" : "New file name"}
            />
        </form>
    ) : null);

    const renderFolder = (node, depth) => {
        const folders = [...node.folders.values()].sort((a, b) => a.name.localeCompare(b.name));
        const leaves = [...node.files].sort((a, b) => a.name.localeCompare(b.name));
        return (
            <>
                {createRow(node.path, depth)}
                {folders.map((f) => {
                    const isOpen = open.has(f.path);
                    return (
                        <React.Fragment key={`d:${f.path}`}>
                            <div
                                className="ftree-item ftree-folder"
                                style={{ paddingLeft: 6 + depth * 14 }}
                                onClick={() => toggle(f.path)}
                                role="treeitem"
                                aria-expanded={isOpen}
                                tabIndex={0}
                                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(f.path))}
                                title={f.path}
                            >
                                <ChevronRight size={13} className={`ftree-chev${isOpen ? " open" : ""}`} />
                                {isOpen ? <FolderOpen size={14} className="ftree-dir" /> : <Folder size={14} className="ftree-dir" />}
                                <span className="ftree-name">{f.name}</span>
                                <span className="ftree-row-actions">
                                    <button title="New file in folder" aria-label={`New file in ${f.path}`} onClick={(e) => { e.stopPropagation(); startCreate(f.path, "file"); }}><FilePlus size={13} /></button>
                                    <button title="New folder in folder" aria-label={`New folder in ${f.path}`} onClick={(e) => { e.stopPropagation(); startCreate(f.path, "folder"); }}><FolderPlus size={13} /></button>
                                    <button className="ftree-del" title="Delete folder" aria-label={`Delete ${f.path}`} onClick={(e) => { e.stopPropagation(); onDelete({ isFolder: true, path: f.path, name: f.name }); }}><Trash2 size={13} /></button>
                                </span>
                            </div>
                            {isOpen && (
                                <div role="group">
                                    {renderFolder(f, depth + 1)}
                                    {!f.folders.size && !f.files.length && !(creating && creating.parent === f.path) && (
                                        <div className="ftree-hint" style={{ paddingLeft: 30 + depth * 14 }}>Empty folder</div>
                                    )}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
                {leaves.map(({ file, name: label, path }) => (
                    <div
                        key={file.id || path}
                        className={`ftree-item${activeFile?.id === file.id ? " active" : ""}`}
                        style={{ paddingLeft: 25 + depth * 14 }}
                        onClick={() => onSelect(file)}
                        role="treeitem"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && onSelect(file)}
                        title={path}
                    >
                        <FileIcon name={label} />
                        <span className="ftree-name">{label}</span>
                        <span className="ftree-row-actions">
                            <button className="ftree-del" title="Delete file" aria-label={`Delete ${path}`} onClick={(e) => { e.stopPropagation(); onDelete(file); }}><Trash2 size={13} /></button>
                        </span>
                    </div>
                ))}
            </>
        );
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
                <button className="ftree-icon" title="New file" aria-label="New file" onClick={() => startCreate("", "file")}><FilePlus size={15} /></button>
                <button className="ftree-icon" title="New folder" aria-label="New folder" onClick={() => startCreate("", "folder")}><FolderPlus size={15} /></button>
                <button className="ftree-icon" title="Collapse all folders" aria-label="Collapse all folders" onClick={() => setOpen(new Set())} disabled={!open.size}><ChevronsDownUp size={14} /></button>
                <label className="ftree-icon" title="Import file">
                    <Upload size={14} />
                    <input type="file" style={{ display: "none" }} onChange={onImport} />
                </label>
            </div>

            <div className="ftree-list" role="tree" aria-label="Project files">
                {matches ? (
                    matches.length ? matches.map((file) => {
                        const p = relPath(file);
                        return (
                            <div key={file.id || p} className={`ftree-item${activeFile?.id === file.id ? " active" : ""}`} onClick={() => onSelect(file)} title={p}>
                                <FileIcon name={p} />
                                <span className="ftree-name">{baseName(p)}</span>
                                {p.includes("/") && <span className="ftree-dirhint">{p.split("/").slice(0, -1).join("/")}</span>}
                            </div>
                        );
                    }) : <div className="ftree-empty"><p>No files match "{query}".</p></div>
                ) : (
                    <>
                        {renderFolder(tree, 0)}
                        {fileCount === 0 && !tree.folders.size && !creating && (
                            <div className="ftree-empty">
                                <p>No files yet.</p>
                                <button className="btn btn-primary" style={{ height: 34, fontSize: 13 }} onClick={() => startCreate("", "file")}>
                                    <Plus size={14} /> New file
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
