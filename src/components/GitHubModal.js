import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Lock, Globe, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { Modal } from "./ux/primitives";
import GitHubIcon from "./GitHubIcon";
import { useAuth } from "../context/AuthContext";
import { githubApi, connectGitHub, useGitHubStatus } from "../utils/github";
import { isPlanLimit, showUpgradeToast } from "../utils/billing";
import "./GitHubModal.css";

// Push, import, two-way sync and gists through the person's connected GitHub account.
// Every request goes to /api/github; the GitHub token never reaches the browser.
//
// Props:
// - source: "room" | "project"
// - projectId, projectName: for a project (sync and "import into this project")
// - getFiles(): the files as this page has them now, [{ path, content }]
// - currentFile: { path, content } shared by "Share as gist" (the room's code, or the open file)
// - onFilesChanged(): called after an import or pull wrote files into this project

const slug = (s) => String(s || "").trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function useBranches(repoKey) {
    const [info, setInfo] = useState({ defaultBranch: "", branches: [] });
    useEffect(() => {
        if (!repoKey) { setInfo({ defaultBranch: "", branches: [] }); return undefined; }
        let off = false;
        githubApi(`/repos/${repoKey}/branches`)
            .then((d) => !off && setInfo(d))
            .catch(() => !off && setInfo({ defaultBranch: "", branches: [] }));
        return () => { off = true; };
    }, [repoKey]);
    return info;
}

function useFolders(repoKey, branch, known) {
    const [folders, setFolders] = useState([]);
    useEffect(() => {
        if (!repoKey || !known) { setFolders([]); return undefined; }
        let off = false;
        githubApi(`/repos/${repoKey}/folders?branch=${encodeURIComponent(branch)}`)
            .then((d) => !off && setFolders(d))
            .catch(() => !off && setFolders([]));
        return () => { off = true; };
    }, [repoKey, branch, known]);
    return folders;
}

// Repo + branch (+ folder) fields shared by every tab.
function RepoFields({ id, repos, repoKey, setRepoKey, branch, setBranch, folder, setFolder, pushOnly = false, folderLabel, folderHint, withFolders = false }) {
    const { defaultBranch, branches } = useBranches(repoKey);
    useEffect(() => { if (defaultBranch) setBranch(defaultBranch); }, [defaultBranch, setBranch]);
    const folders = useFolders(repoKey, branch, withFolders && branches.includes(branch));
    const list = (repos || []).filter((r) => !pushOnly || r.canPush);
    return (
        <>
            <div className="u-field">
                <label htmlFor={`${id}-repo`}>Repository</label>
                <select id={`${id}-repo`} className="u-select" value={repoKey} onChange={(e) => setRepoKey(e.target.value)} required>
                    <option value="" disabled>{repos ? (list.length ? "Choose a repository" : "No repositories you can use") : "Loading repositories…"}</option>
                    {list.map((r) => <option key={r.fullName} value={r.fullName}>{r.fullName}{r.private ? " · private" : ""}</option>)}
                </select>
            </div>
            <div className="gh-two">
                <div className="u-field">
                    <label htmlFor={`${id}-branch`}>Branch</label>
                    <input id={`${id}-branch`} className="u-input" list={`${id}-branches`} value={branch} onChange={(e) => setBranch(e.target.value.trim())} placeholder="main" required autoComplete="off" />
                    <datalist id={`${id}-branches`}>{branches.map((b) => <option key={b} value={b} />)}</datalist>
                    {pushOnly && branch && branches.length > 0 && !branches.includes(branch) && <span className="u-hint">New branch, started from {defaultBranch}.</span>}
                </div>
                {setFolder && (
                    <div className="u-field">
                        <label htmlFor={`${id}-folder`}>{folderLabel || "Folder"}</label>
                        <input id={`${id}-folder`} className="u-input" list={`${id}-folders`} value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="/ (repository root)" autoComplete="off" />
                        <datalist id={`${id}-folders`}>{folders.map((f) => <option key={f} value={f} />)}</datalist>
                        {folderHint && <span className="u-hint">{folderHint}</span>}
                    </div>
                )}
            </div>
        </>
    );
}

function Done({ href, label, children }) {
    return (
        <div className="gh-done" role="status">
            <p>{children}</p>
            {href && <a className="u-btn u-btn--ghost u-btn--sm" href={href} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {label}</a>}
        </div>
    );
}

// ---- Push ---------------------------------------------------------------------

function PushTab({ repos, reloadRepos, getFiles, defaultName, onClose }) {
    const [target, setTarget] = useState("existing");
    const [repoKey, setRepoKey] = useState("");
    const [name, setName] = useState(slug(defaultName) || "colabs-project");
    const [isPrivate, setIsPrivate] = useState(true);
    const [branch, setBranch] = useState("main");
    const [folder, setFolder] = useState("");
    const [message, setMessage] = useState("Update from Utkristi CoLabs");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);
    const count = getFiles().length;

    const submit = async (e) => {
        e.preventDefault();
        const [owner, repo] = repoKey.split("/");
        setBusy(true);
        try {
            const res = await githubApi("/push", {
                method: "POST",
                body: {
                    ...(target === "new" ? { createRepo: { name, private: isPrivate } } : { owner, repo }),
                    branch: target === "new" ? "" : branch,
                    folder,
                    message,
                    files: getFiles(),
                },
            });
            setDone(res);
            if (target === "new") reloadRepos();
            toast.success(res.unchanged ? "Nothing changed: GitHub already has these files" : `Pushed to ${res.owner}/${res.repo}`);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    if (done) {
        return (
            <Done href={done.url} label={done.unchanged ? "Open branch" : "View commit"}>
                {done.unchanged ? "GitHub already had these files, so no commit was made." : <>Committed {plural(count, "file")} to <b>{done.owner}/{done.repo}</b> on <span className="u-mono">{done.branch}</span>.</>}
                {" "}<button type="button" className="u-link" onClick={() => setDone(null)}>Push again</button>
            </Done>
        );
    }

    return (
        <form className="gh-form" onSubmit={submit}>
            <div className="u-tiles">
                <button type="button" className={`u-tile${target === "existing" ? " on" : ""}`} onClick={() => setTarget("existing")} aria-pressed={target === "existing"}>
                    <span className="u-tile-ico"><GitHubIcon size={16} /></span><span><b>Existing repository</b><span>commit on a branch</span></span>
                </button>
                <button type="button" className={`u-tile${target === "new" ? " on" : ""}`} onClick={() => setTarget("new")} aria-pressed={target === "new"}>
                    <span className="u-tile-ico"><GitHubIcon size={16} filled /></span><span><b>New repository</b><span>on your account</span></span>
                </button>
            </div>
            {target === "existing" ? (
                <RepoFields id="gh-push" repos={repos} repoKey={repoKey} setRepoKey={setRepoKey} branch={branch} setBranch={setBranch} folder={folder} setFolder={setFolder} pushOnly folderLabel="Into folder" />
            ) : (
                <>
                    <div className="u-field">
                        <label htmlFor="gh-new-name">Repository name</label>
                        <input id="gh-new-name" className="u-input" value={name} onChange={(e) => setName(slug(e.target.value))} required maxLength={100} />
                    </div>
                    <div className="u-tiles">
                        <button type="button" className={`u-tile${isPrivate ? " on" : ""}`} onClick={() => setIsPrivate(true)} aria-pressed={isPrivate}>
                            <span className="u-tile-ico"><Lock size={16} /></span><span><b>Private</b><span>only people you add</span></span>
                        </button>
                        <button type="button" className={`u-tile${!isPrivate ? " on" : ""}`} onClick={() => setIsPrivate(false)} aria-pressed={!isPrivate}>
                            <span className="u-tile-ico"><Globe size={16} /></span><span><b>Public</b><span>anyone can see it</span></span>
                        </button>
                    </div>
                </>
            )}
            <div className="u-field">
                <label htmlFor="gh-push-msg">Commit message</label>
                <input id="gh-push-msg" className="u-input" value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={500} />
            </div>
            <div className="gh-actions">
                <span className="u-hint">{plural(count, "file")}, one commit.</span>
                <button type="button" className="u-btn u-btn--ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="u-btn u-btn--solid" disabled={busy || !count || (target === "existing" && !repoKey)}>
                    {busy ? "Pushing…" : <><GitHubIcon size={15} /> Commit &amp; push</>}
                </button>
            </div>
        </form>
    );
}

// ---- Import -------------------------------------------------------------------

function ImportTab({ repos, projectId, onFilesChanged, onClose, onLinked }) {
    const navigate = useNavigate();
    const [repoKey, setRepoKey] = useState("");
    const [branch, setBranch] = useState("main");
    const [folder, setFolder] = useState("");
    const [target, setTarget] = useState("new");
    const [name, setName] = useState("");
    const [keepSynced, setKeepSynced] = useState(true);
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        const [owner, repo] = repoKey.split("/");
        setBusy(true);
        try {
            const res = await githubApi("/import", {
                method: "POST",
                body: {
                    owner, repo, branch, path: folder, link: keepSynced,
                    ...(target === "new" ? { newProject: { name: name || repo } } : { projectId }),
                },
            });
            const skipped = res.skipped.length ? ` ${plural(res.skipped.length, "file")} skipped (binary or over 1 MB).` : "";
            toast.success(`Imported ${plural(res.count, "file")}.${skipped}`, { duration: 6000 });
            if (target === "new") {
                onClose();
                navigate(`/project/${res.projectId}`);
            } else {
                onFilesChanged?.();
                if (res.link) onLinked?.();
            }
        } catch (err) {
            if (isPlanLimit({ status: err.status }, err.data)) showUpgradeToast(err.message);
            else toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="gh-form" onSubmit={submit}>
            <RepoFields id="gh-import" repos={repos} repoKey={repoKey} setRepoKey={setRepoKey} branch={branch} setBranch={setBranch} folder={folder} setFolder={setFolder} withFolders folderLabel="From folder" />
            {projectId && (
                <div className="u-tiles">
                    <button type="button" className={`u-tile${target === "new" ? " on" : ""}`} onClick={() => setTarget("new")} aria-pressed={target === "new"}>
                        <span className="u-tile-ico">+</span><span><b>New project</b><span>opens when ready</span></span>
                    </button>
                    <button type="button" className={`u-tile${target === "this" ? " on" : ""}`} onClick={() => setTarget("this")} aria-pressed={target === "this"}>
                        <span className="u-tile-ico">↓</span><span><b>This project</b><span>same paths are replaced</span></span>
                    </button>
                </div>
            )}
            {target === "new" && (
                <div className="u-field">
                    <label htmlFor="gh-import-name">Project name</label>
                    <input id="gh-import-name" className="u-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={repoKey.split("/")[1] || "Named after the repository"} maxLength={120} />
                </div>
            )}
            <label className="gh-check">
                <input type="checkbox" checked={keepSynced} onChange={(e) => setKeepSynced(e.target.checked)} />
                <span>Keep the project in sync with this folder <span className="u-faint">(pull and push from the Sync tab)</span></span>
            </label>
            <div className="gh-actions">
                <span className="u-hint">Text files only, up to 300.</span>
                <button type="button" className="u-btn u-btn--ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="u-btn u-btn--solid" disabled={busy || !repoKey || !branch}>{busy ? "Importing…" : "Import"}</button>
            </div>
        </form>
    );
}

// ---- Sync ---------------------------------------------------------------------

const BADGE = { added: "A", modified: "M", deleted: "D" };

function ChangeList({ changes }) {
    if (!changes.length) return <p className="u-muted gh-empty">Everything matches GitHub.</p>;
    return (
        <ul className="gh-changes">
            {changes.map((c) => (
                <li key={c.path} className={c.conflict ? "is-conflict" : ""}>
                    <span className="u-mono gh-path" title={c.path}>{c.path}</span>
                    {c.local && <span className={`gh-badge is-${c.local}`} title={`Changed here: ${c.local}`}>{BADGE[c.local]} here</span>}
                    {c.remote && <span className={`gh-badge is-${c.remote}`} title={`Changed on GitHub: ${c.remote}`}>{BADGE[c.remote]} GitHub</span>}
                    {c.conflict && <span className="gh-badge is-conflict">conflict</span>}
                </li>
            ))}
        </ul>
    );
}

function SyncTab({ repos, projectId, getFiles, onFilesChanged, linkVersion }) {
    const [link, setLink] = useState(undefined);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState("");
    const [conflicts, setConflicts] = useState(null);
    const [message, setMessage] = useState("Update from Utkristi CoLabs");
    const [repoKey, setRepoKey] = useState("");
    const [branch, setBranch] = useState("main");
    const [folder, setFolder] = useState("");

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const { link: current } = await githubApi(`/projects/${projectId}/link`);
            setLink(current);
            setStatus(current ? await githubApi(`/projects/${projectId}/status`, { method: "POST", body: { files: getFiles() } }) : null);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }, [projectId, getFiles]);
    // getFiles changes on every edit; read status on open and when asked, not per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { refresh(); }, [projectId, linkVersion]);

    const linkRepo = async (e) => {
        e.preventDefault();
        const [owner, repo] = repoKey.split("/");
        setBusy("link");
        try {
            await githubApi(`/projects/${projectId}/link`, { method: "POST", body: { owner, repo, branch, path: folder } });
            toast.success(`Linked to ${repoKey}`);
            await refresh();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy("");
        }
    };

    const unlink = async () => {
        setBusy("unlink");
        try {
            await githubApi(`/projects/${projectId}/link`, { method: "DELETE" });
            setLink(null);
            setStatus(null);
            setConflicts(null);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy("");
        }
    };

    const pull = async (resolve) => {
        setBusy("pull");
        try {
            const res = await githubApi(`/projects/${projectId}/pull`, { method: "POST", body: { files: getFiles(), resolve } });
            setConflicts(null);
            const parts = [res.updated.length && `${plural(res.updated.length, "file")} updated`, res.deleted.length && `${res.deleted.length} deleted`, res.kept.length && `${res.kept.length} kept as yours`].filter(Boolean);
            toast.success(parts.length ? `Pulled: ${parts.join(", ")}` : "Up to date with GitHub");
            if (res.skipped.length) toast(`${plural(res.skipped.length, "file")} on GitHub can't be opened here (binary or over 1 MB) and were left alone.`, { duration: 6000 });
            if (res.updated.length || res.deleted.length) await onFilesChanged?.();
            await refresh();
        } catch (err) {
            if (err.code === "CONFLICT") setConflicts(err.data.conflicts || []);
            else toast.error(err.message);
        } finally {
            setBusy("");
        }
    };

    const push = async (e) => {
        e.preventDefault();
        setBusy("push");
        try {
            const res = await githubApi(`/projects/${projectId}/push`, { method: "POST", body: { files: getFiles(), message } });
            if (res.unchanged) toast.success("Nothing to commit");
            else toast.success((t) => <span>Pushed {plural(res.pushed.length, "change")}. <a className="u-link" href={res.url} target="_blank" rel="noreferrer" onClick={() => toast.dismiss(t.id)}>View commit</a></span>, { duration: 6000 });
            await refresh();
        } catch (err) {
            toast.error(err.message);
            if (err.code === "PULL_FIRST" || err.code === "BRANCH_MOVED") refresh();
        } finally {
            setBusy("");
        }
    };

    if (link === undefined) return <p className="u-muted gh-empty">Checking this project's link…</p>;

    if (!link) {
        return (
            <form className="gh-form" onSubmit={linkRepo}>
                <p className="u-muted gh-lede">Link this project to a branch to pull GitHub's changes and push yours. To start from the repository's files instead, use <b>Import</b> into this project with "keep in sync".</p>
                <RepoFields id="gh-link" repos={repos} repoKey={repoKey} setRepoKey={setRepoKey} branch={branch} setBranch={setBranch} folder={folder} setFolder={setFolder} withFolders folderLabel="Folder in the repo" folderHint="Maps to the root of this project." />
                <div className="gh-actions">
                    <span className="u-hint">The branch must already exist.</span>
                    <button type="submit" className="u-btn u-btn--solid" disabled={busy === "link" || !repoKey || !branch}>{busy === "link" ? "Linking…" : "Link repository"}</button>
                </div>
            </form>
        );
    }

    const changes = status?.changes || [];
    const local = changes.filter((c) => c.local);
    const remote = changes.filter((c) => c.remote);
    const deletes = local.filter((c) => c.local === "deleted").length;
    const repoUrl = `https://github.com/${link.owner}/${link.repo}/tree/${link.branch}${link.path ? `/${link.path}` : ""}`;

    return (
        <div className="gh-form">
            <div className="gh-linkbar">
                <div>
                    <a href={repoUrl} target="_blank" rel="noreferrer" className="u-ul"><b>{link.owner}/{link.repo}</b></a>
                    <span className="u-mono u-faint"> · {link.branch}{link.path ? ` · /${link.path}` : ""} · {link.baseSha.slice(0, 7)}</span>
                </div>
                <div className="gh-linkbar-actions">
                    <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={refresh} disabled={loading} aria-label="Check for changes" title="Check for changes"><RefreshCw size={14} className={loading ? "gh-spin" : ""} /></button>
                    <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={unlink} disabled={!!busy}>Unlink</button>
                </div>
            </div>

            {status ? <ChangeList changes={changes} /> : <p className="u-muted gh-empty">{loading ? "Comparing with GitHub…" : "Could not compare with GitHub."}</p>}

            {conflicts && (
                <div className="gh-notice" role="alert">
                    <AlertTriangle size={16} />
                    <div>
                        <b>{plural(conflicts.length, "file")} changed both here and on GitHub.</b>
                        <p className="u-mono">{conflicts.slice(0, 6).join(", ")}{conflicts.length > 6 ? ` and ${conflicts.length - 6} more` : ""}</p>
                        <p>Choose which version to keep for these files. Other files from GitHub are pulled either way.</p>
                        <div className="gh-notice-actions">
                            <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => pull("mine")} disabled={!!busy}>Keep mine</button>
                            <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => pull("theirs")} disabled={!!busy}>Take GitHub's</button>
                            <button type="button" className="u-link" onClick={() => setConflicts(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {remote.length > 0 && !conflicts && (
                <div className="gh-actions gh-actions--start">
                    <button type="button" className="u-btn u-btn--ghost" onClick={() => pull()} disabled={!!busy || loading}>{busy === "pull" ? "Pulling…" : `Pull ${plural(remote.length, "change")}`}</button>
                    <span className="u-hint">Pull before you push.</span>
                </div>
            )}

            <form onSubmit={push} className="gh-form">
                <div className="u-field">
                    <label htmlFor="gh-sync-msg">Commit message</label>
                    <input id="gh-sync-msg" className="u-input" value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={500} />
                    {deletes > 0 && <span className="u-hint gh-warn">This commit deletes {plural(deletes, "file")} from GitHub.</span>}
                </div>
                <div className="gh-actions">
                    <span className="u-hint">{plural(local.length, "change")} here</span>
                    <button type="submit" className="u-btn u-btn--solid" disabled={!!busy || loading || !local.length || remote.length > 0}>
                        {busy === "push" ? "Pushing…" : <><GitHubIcon size={15} /> Commit &amp; push</>}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ---- Gist ---------------------------------------------------------------------

function GistTab({ currentFile, getFiles, isProject, onClose }) {
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(false);
    const [scope, setScope] = useState("file");
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        const files = scope === "all" ? getFiles() : currentFile ? [currentFile] : [];
        if (!files.some((f) => String(f.content || "").trim())) { toast.error("There is no code to share"); return; }
        setBusy(true);
        try {
            const res = await githubApi("/gists", { method: "POST", body: { description, isPublic, files: files.map((f) => ({ name: f.path, content: f.content })) } });
            toast.success("Gist created");
            window.open(res.url, "_blank", "noopener");
            onClose();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="gh-form" onSubmit={submit}>
            <div className="u-field">
                <label htmlFor="gist-desc">Description</label>
                <input id="gist-desc" className="u-input" placeholder="e.g. Binary search, pairing notes" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            {isProject && (
                <div className="u-seg" role="group" aria-label="What to share">
                    <button type="button" className={scope === "file" ? "on" : ""} onClick={() => setScope("file")} aria-pressed={scope === "file"}>This file{currentFile ? <em> {currentFile.path.split("/").pop()}</em> : null}</button>
                    <button type="button" className={scope === "all" ? "on" : ""} onClick={() => setScope("all")} aria-pressed={scope === "all"}>All files <em>{getFiles().length}</em></button>
                </div>
            )}
            <div className="u-field">
                <span className="u-field-label">Visibility</span>
                <div className="u-tiles">
                    <button type="button" className={`u-tile${!isPublic ? " on" : ""}`} onClick={() => setIsPublic(false)} aria-pressed={!isPublic}>
                        <span className="u-tile-ico"><Lock size={16} /></span><span><b>Secret</b><span>link only</span></span>
                    </button>
                    <button type="button" className={`u-tile${isPublic ? " on" : ""}`} onClick={() => setIsPublic(true)} aria-pressed={isPublic}>
                        <span className="u-tile-ico"><Globe size={16} /></span><span><b>Public</b><span>listed on profile</span></span>
                    </button>
                </div>
            </div>
            <div className="gh-actions">
                <button type="button" className="u-btn u-btn--ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="u-btn u-btn--solid" disabled={busy}>{busy ? "Creating…" : <><GitHubIcon size={15} /> Create gist</>}</button>
            </div>
        </form>
    );
}

// ---- Modal ----------------------------------------------------------------------

export default function GitHubModal({ isOpen, onClose, source = "room", projectId, projectName, getFiles, currentFile, onFilesChanged, initialTab }) {
    const { user } = useAuth();
    const isProject = source === "project" && Boolean(projectId);
    const tabs = useMemo(() => [
        ...(isProject ? [{ id: "sync", label: "Sync" }] : []),
        { id: "push", label: "Push" },
        { id: "import", label: "Import" },
        { id: "gist", label: "Gist" },
    ], [isProject]);
    const [tab, setTab] = useState(initialTab || tabs[0].id);
    const [linkVersion, setLinkVersion] = useState(0);
    const { status, error } = useGitHubStatus(user, isOpen);
    const connected = Boolean(status?.connected);
    const [repos, setRepos] = useState(null);
    const loadRepos = useCallback(() => {
        githubApi("/repos").then(setRepos).catch((err) => { setRepos([]); toast.error(err.message); });
    }, []);
    useEffect(() => { if (isOpen && connected) loadRepos(); }, [isOpen, connected, loadRepos]);
    const [connecting, setConnecting] = useState(false);

    if (!isOpen) return null;

    const connect = async () => {
        setConnecting(true);
        try { await connectGitHub(); } catch (err) { toast.error(err.message); } finally { setConnecting(false); }
    };

    let body;
    if (!user) {
        body = <p className="u-muted gh-empty">Sign in to push, import and sync with GitHub. <a className="u-link" href="/login">Sign in</a></p>;
    } else if (!status) {
        body = <p className="u-muted gh-empty">{error || "Checking your GitHub connection…"}</p>;
    } else if (!status.configured) {
        body = <p className="u-muted gh-empty">GitHub isn't set up on this server yet. An admin needs to add a GitHub OAuth app (see the README).</p>;
    } else if (!connected) {
        body = (
            <div className="gh-connect">
                <span className="gh-connect-mark"><GitHubIcon size={24} /></span>
                <p>Connect your GitHub account to push to repositories, import them, keep projects in sync and share gists. CoLabs asks for the <span className="u-mono">repo</span> and <span className="u-mono">gist</span> scopes; you can disconnect any time in Settings.</p>
                <button type="button" className="u-btn u-btn--solid" onClick={connect} disabled={connecting}><GitHubIcon size={15} /> {connecting ? "Opening GitHub…" : "Connect GitHub"}</button>
            </div>
        );
    } else {
        const files = getFiles || (() => (currentFile ? [currentFile] : []));
        body = (
            <>
                <div className="gh-tabs">
                    <div className="u-seg" role="tablist" aria-label="GitHub actions">
                        {tabs.map((t) => (
                            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.label}</button>
                        ))}
                    </div>
                    <span className="u-mono u-faint gh-login">@{status.login}</span>
                </div>
                {tab === "sync" && isProject && <SyncTab repos={repos} projectId={projectId} getFiles={files} onFilesChanged={onFilesChanged} linkVersion={linkVersion} />}
                {tab === "push" && <PushTab repos={repos} reloadRepos={loadRepos} getFiles={files} defaultName={projectName} onClose={onClose} />}
                {tab === "import" && <ImportTab repos={repos} projectId={isProject ? projectId : null} onFilesChanged={onFilesChanged} onClose={onClose} onLinked={() => { setLinkVersion((v) => v + 1); setTab("sync"); }} />}
                {tab === "gist" && <GistTab currentFile={currentFile} getFiles={files} isProject={isProject} onClose={onClose} />}
            </>
        );
    }

    return (
        <Modal open onClose={onClose} label="GitHub" title={isProject ? "GitHub for this project" : "GitHub"} description={isProject ? projectName : "Push this room's code, import a repository or share a gist."}>
            {body}
        </Modal>
    );
}
