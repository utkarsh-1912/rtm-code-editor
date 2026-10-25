import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    FileCode, FileText, Plus, Search, Trash2, Upload, Braces, Palette, Globe, Coffee, Terminal, X,
    ChevronRight, Folder, FolderOpen, FolderPlus, FilePlus, ChevronsDownUp, MoreVertical, Pencil,
    FolderInput, CornerLeftUp,
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
const parentOf = (p) => p.split("/").slice(0, -1).join("/");

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

// Every folder path in the tree (for the "Move to" picker), sorted.
function allFolders(node, out = []) {
    for (const f of node.folders.values()) { out.push(f.path); allFolders(f, out); }
    return out.sort((a, b) => a.localeCompare(b));
}

// File explorer for the project workspace: nested folders, search, create files and folders
// anywhere, rename, move (menu or drag and drop) and delete. All actions sit in "⋮" menus so a
// narrow sidebar never hides them.
export default function ProjectFileTree({ files, activeFile, onSelect, onCreate, onDelete, onImport, onMove, project }) {
    const storeKey = `ftree-open-${project?.id || "x"}`;
    const [query, setQuery] = useState("");
    const [creating, setCreating] = useState(null); // { parent: "src", kind: "file" | "folder" }
    const [name, setName] = useState("");
    const [renaming, setRenaming] = useState(null); // { path, value }
    const [menu, setMenu] = useState(null); // { x, y, items, title }
    const [picker, setPicker] = useState(null); // { path, isFolder, x, y }: "Move to" folder list
    const [dragPath, setDragPath] = useState(null);
    const [dropAt, setDropAt] = useState(null); // folder path ("" = root) under the pointer
    const importRef = useRef(null);
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

    // Close menus on outside click, Escape, scroll or resize.
    useEffect(() => {
        if (!menu && !picker) return undefined;
        const close = () => { setMenu(null); setPicker(null); };
        const away = (e) => { if (!e.target.closest?.(".ftree-pop")) close(); };
        const esc = (e) => e.key === "Escape" && close();
        document.addEventListener("mousedown", away);
        document.addEventListener("keydown", esc);
        window.addEventListener("resize", close);
        return () => {
            document.removeEventListener("mousedown", away);
            document.removeEventListener("keydown", esc);
            window.removeEventListener("resize", close);
        };
    }, [menu, picker]);

    const tree = useMemo(() => buildTree(files), [files]);
    const folders = useMemo(() => allFolders(tree), [tree]);
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

    // Move `from` into folder `toFolder` ("" = root), keeping its name.
    const canMoveInto = (from, toFolder) => toFolder !== parentOf(from) && toFolder !== from && !toFolder.startsWith(`${from}/`);
    const moveInto = (from, toFolder) => {
        if (!onMove || !canMoveInto(from, toFolder)) return;
        const to = toFolder ? `${toFolder}/${baseName(from)}` : baseName(from);
        if (toFolder) setOpen((prev) => new Set([...prev, toFolder, ...ancestors(`${toFolder}/x`)]));
        onMove(from, to);
    };

    const submitRename = (e) => {
        e.preventDefault();
        const n = (renaming?.value || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        if (renaming && n && n !== baseName(renaming.path) && onMove) {
            const parent = parentOf(renaming.path);
            onMove(renaming.path, parent ? `${parent}/${n}` : n);
        }
        setRenaming(null);
    };

    // Opens the shared menu next to the button that was clicked (fixed position, so the
    // scrolling list never clips it).
    const openMenu = (e, items, title) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        const width = 210;
        const x = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width));
        const below = r.bottom + 6;
        const y = below + items.length * 36 + 16 > window.innerHeight ? Math.max(8, r.top - items.length * 36 - 22) : below;
        setPicker(null);
        setMenu({ x, y, items, title });
    };

    const openPicker = (path, isFolder) => {
        setPicker({ path, isFolder, x: menu?.x ?? 40, y: Math.min(menu?.y ?? 80, window.innerHeight - 320) });
        setMenu(null);
    };

    const folderItems = (f) => [
        { icon: FilePlus, label: "New file here", run: () => startCreate(f.path, "file") },
        { icon: FolderPlus, label: "New folder here", run: () => startCreate(f.path, "folder") },
        ...(onMove ? [
            { icon: Pencil, label: "Rename", run: () => setRenaming({ path: f.path, value: f.name }) },
            { icon: FolderInput, label: "Move to…", run: () => openPicker(f.path, true), keep: true },
        ] : []),
        { icon: Trash2, label: "Delete folder", danger: true, run: () => onDelete({ isFolder: true, path: f.path, name: f.name }) },
    ];
    const fileItems = (file, path) => [
        ...(onMove ? [
            { icon: Pencil, label: "Rename", run: () => setRenaming({ path, value: baseName(path) }) },
            { icon: FolderInput, label: "Move to…", run: () => openPicker(path, false), keep: true },
            ...(path.includes("/") ? [{ icon: CornerLeftUp, label: "Move to project root", run: () => moveInto(path, "") }] : []),
        ] : []),
        { icon: Trash2, label: "Delete file", danger: true, run: () => onDelete(file) },
    ];
    const rootItems = [
        { icon: FilePlus, label: "New file", run: () => startCreate("", "file") },
        { icon: FolderPlus, label: "New folder", run: () => startCreate("", "folder") },
        { icon: Upload, label: "Import file", run: () => importRef.current?.click() },
        { icon: ChevronsDownUp, label: "Collapse all folders", run: () => setOpen(new Set()), disabled: !open.size },
    ];

    // Drag and drop: drag any row onto a folder (or the empty area for the root).
    const dragProps = (path) => (onMove ? {
        draggable: !renaming,
        onDragStart: (e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", path);
            setDragPath(path);
        },
        onDragEnd: () => { setDragPath(null); setDropAt(null); },
    } : {});
    const dropProps = (folderPath) => (onMove ? {
        onDragOver: (e) => {
            if (!dragPath) return;
            e.stopPropagation(); // a row answers for itself, even when it refuses the drop
            if (!canMoveInto(dragPath, folderPath)) { if (dropAt !== null) setDropAt(null); return; }
            e.preventDefault();
            if (dropAt !== folderPath) setDropAt(folderPath);
        },
        onDrop: (e) => {
            if (!dragPath) return;
            e.preventDefault();
            e.stopPropagation();
            moveInto(dragPath, folderPath);
            setDragPath(null);
            setDropAt(null);
        },
    } : {});

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

    const label = (path, text) => (renaming?.path === path ? (
        <form className="ftree-rename" onSubmit={submitRename} onClick={(e) => e.stopPropagation()}>
            <input
                autoFocus
                value={renaming.value}
                onChange={(e) => setRenaming((r) => ({ ...r, value: e.target.value }))}
                onBlur={submitRename}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") setRenaming(null); }}
                onFocus={(e) => { const dot = e.target.value.lastIndexOf("."); e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length); }}
                aria-label={`New name for ${path}`}
            />
        </form>
    ) : <span className="ftree-name">{text}</span>);

    const moreButton = (items, title) => (
        <button className="ftree-more" title="More actions" aria-label={`More actions for ${title}`} aria-haspopup="menu" onClick={(e) => openMenu(e, items, title)}>
            <MoreVertical size={14} />
        </button>
    );

    const renderFolder = (node, depth) => {
        const subfolders = [...node.folders.values()].sort((a, b) => a.name.localeCompare(b.name));
        const leaves = [...node.files].sort((a, b) => a.name.localeCompare(b.name));
        return (
            <>
                {createRow(node.path, depth)}
                {subfolders.map((f) => {
                    const isOpen = open.has(f.path);
                    return (
                        <React.Fragment key={`d:${f.path}`}>
                            <div
                                className={`ftree-item ftree-folder${dropAt === f.path ? " is-drop" : ""}${dragPath === f.path ? " is-dragging" : ""}`}
                                style={{ paddingLeft: 6 + depth * 14 }}
                                onClick={() => toggle(f.path)}
                                role="treeitem"
                                aria-expanded={isOpen}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(f.path); }
                                    if (e.key === "F2" && onMove) setRenaming({ path: f.path, value: f.name });
                                }}
                                title={f.path}
                                {...dragProps(f.path)}
                                {...dropProps(f.path)}
                            >
                                <ChevronRight size={13} className={`ftree-chev${isOpen ? " open" : ""}`} />
                                {isOpen ? <FolderOpen size={14} className="ftree-dir" /> : <Folder size={14} className="ftree-dir" />}
                                {label(f.path, f.name)}
                                {moreButton(folderItems(f), f.path)}
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
                {leaves.map(({ file, name: text, path }) => (
                    <div
                        key={file.id || path}
                        className={`ftree-item${activeFile?.id === file.id ? " active" : ""}${dragPath === path ? " is-dragging" : ""}`}
                        style={{ paddingLeft: 25 + depth * 14 }}
                        onClick={() => renaming?.path !== path && onSelect(file)}
                        role="treeitem"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") onSelect(file);
                            if (e.key === "F2" && onMove) setRenaming({ path, value: baseName(path) });
                        }}
                        title={path}
                        {...dragProps(path)}
                        {...dropProps(node.path)}
                    >
                        <FileIcon name={text} />
                        {label(path, text)}
                        {moreButton(fileItems(file, path), path)}
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
                <button className="ftree-icon" title="More: new folder, import, collapse" aria-label="More file actions" aria-haspopup="menu" onClick={(e) => openMenu(e, rootItems, "Project files")}><MoreVertical size={15} /></button>
                <input ref={importRef} type="file" style={{ display: "none" }} onChange={onImport} />
            </div>

            <div
                className={`ftree-list${dropAt === "" ? " is-drop-root" : ""}`}
                role="tree"
                aria-label="Project files"
                {...dropProps("")}
            >
                {matches ? (
                    matches.length ? matches.map((file) => {
                        const p = relPath(file);
                        return (
                            <div key={file.id || p} className={`ftree-item${activeFile?.id === file.id ? " active" : ""}`} onClick={() => onSelect(file)} title={p}>
                                <FileIcon name={p} />
                                <span className="ftree-name">{baseName(p)}</span>
                                {p.includes("/") && <span className="ftree-dirhint">{parentOf(p)}</span>}
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
                        {dragPath && parentOf(dragPath) !== "" && (
                            <div className="ftree-hint ftree-drop-hint">Drop here to move to the project root</div>
                        )}
                    </>
                )}
            </div>

            {menu && (
                <div className="u-pop ftree-pop" role="menu" aria-label={menu.title} style={{ position: "fixed", left: menu.x, top: menu.y, right: "auto", width: 210, minWidth: 0 }}>
                    {menu.items.map((it) => (
                        <button
                            key={it.label}
                            role="menuitem"
                            className={it.danger ? "danger" : ""}
                            disabled={it.disabled}
                            onClick={() => { if (!it.keep) setMenu(null); it.run(); }}
                        >
                            <it.icon size={14} /> {it.label}
                        </button>
                    ))}
                </div>
            )}

            {picker && (
                <div className="u-pop ftree-pop ftree-picker" role="dialog" aria-label={`Move ${picker.path}`} style={{ position: "fixed", left: picker.x, top: picker.y, right: "auto", width: 240, minWidth: 0 }}>
                    <div className="ftree-picker-head">Move <b>{baseName(picker.path)}</b> to</div>
                    <div className="ftree-picker-list">
                        {["", ...folders].filter((p) => canMoveInto(picker.path, p)).map((p) => (
                            <button key={p || "/"} onClick={() => { moveInto(picker.path, p); setPicker(null); }}>
                                <Folder size={14} /> <span>{p ? p : "Project root"}</span>
                            </button>
                        ))}
                        {!["", ...folders].some((p) => canMoveInto(picker.path, p)) && <p className="ftree-hint" style={{ padding: "6px 10px" }}>No other folder yet. Create one first.</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
