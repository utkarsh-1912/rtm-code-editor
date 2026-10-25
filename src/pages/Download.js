import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Globe, Smartphone, Monitor, Apple, ArrowUpRight, Download as DownloadIcon, Copy, Check, Cpu, Sparkles, Server } from "lucide-react";
import SiteLayout, { PageHead } from "../components/Site/SiteLayout";
import CtaBand from "../components/Site/CtaBand";
import { pad2 } from "../components/ux/primitives";
import { getBackendUrl } from "../utils/api";

const REPO = "utkarsh-1912/rtm-code-editor";
const RELEASES = `https://github.com/${REPO}/releases`;

const PLATFORMS = [
    { id: "win", icon: Monitor, name: "Windows", note: "Windows 10 and 11, 64-bit installer", match: /win-x64\.exe$/i },
    { id: "mac", icon: Apple, name: "macOS", note: "Apple silicon and Intel, one universal .dmg", match: /mac-universal\.dmg$/i },
    { id: "linux", icon: Monitor, name: "Linux", note: "AppImage for any distro, .deb for Debian and Ubuntu", match: /linux-x64\.AppImage$/i, alt: /linux-x64\.deb$/i },
];

const detectOS = () => {
    const p = (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
    if (/android|iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())) return "mobile";
    if (p.includes("mac")) return "mac";
    if (p.includes("win")) return "win";
    if (p.includes("linux") || p.includes("x11")) return "linux";
    return null;
};

const mb = (bytes) => `${(bytes / 1048576).toFixed(0)} MB`;

function CopyLine({ text }) {
    const [done, setDone] = useState(false);
    return (
        <div className="dl-cmd">
            <code>{text}</code>
            <button className="u-icon" aria-label="Copy command" onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
                {done ? <Check size={15} /> : <Copy size={15} />}
            </button>
        </div>
    );
}

export default function Download() {
    const os = useMemo(detectOS, []);
    const [release, setRelease] = useState({ state: "loading" });

    useEffect(() => {
        let alive = true;
        // Our server caches the GitHub lookup; fall back to GitHub directly if it is asleep.
        const fromServer = () => fetch(`${getBackendUrl()}/api/release/latest`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
        const fromGitHub = () => fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } })
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((d) => ({ tag: d.tag_name, date: d.published_at, url: d.html_url, assets: (d.assets || []).map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })) }));
        fromServer().catch(fromGitHub)
            .then((d) => alive && setRelease({ state: "ok", ...d }))
            .catch(() => alive && setRelease({ state: "none" }));
        return () => { alive = false; };
    }, []);

    const assetFor = (p, alt = false) => release.assets?.find((a) => (alt ? p.alt : p.match)?.test(a.name));
    const primary = PLATFORMS.find((p) => p.id === os);
    const primaryAsset = primary && assetFor(primary);

    return (
        <SiteLayout>
            <PageHead
                label="Download"
                title={["Use it", "anywhere."]}
                lede={<><b>In the browser, or as a desktop app for Windows, macOS and Linux.</b> The desktop app runs code and AI on your own machine when it can.</>}
            >
                {os === "mobile" || !primary ? (
                    <Link to="/" className="u-btn u-btn--solid u-btn--lg">Open in the browser <ArrowUpRight size={16} /></Link>
                ) : primaryAsset ? (
                    <a href={primaryAsset.url} className="u-btn u-btn--solid u-btn--lg"><DownloadIcon size={16} /> Download for {primary.name} · {mb(primaryAsset.size)}</a>
                ) : (
                    <a href={RELEASES} target="_blank" rel="noreferrer" className="u-btn u-btn--solid u-btn--lg"><DownloadIcon size={16} /> {primary.name} build · see releases</a>
                )}
                <Link to="/" className="u-btn u-btn--ghost u-btn--lg">Use the web app</Link>
            </PageHead>

            <div className="u-head">
                <span className="u-label" data-rise>
                    {release.state === "ok" ? `Release ${release.tag} · ${new Date(release.date).toLocaleDateString()}` : release.state === "loading" ? "Checking releases…" : "Desktop builds"}
                </span>
                <div>
                    <ul className="u-rows">
                        {PLATFORMS.map(({ id, icon: Icon, name, note, ...p }, i) => {
                            const asset = assetFor({ ...p });
                            const alt = p.alt && assetFor({ ...p }, true);
                            return (
                                <li key={id} className={`u-row d-row-plat${os === id ? " dl-mine" : ""}`} data-rise style={{ "--d": `${i * 60}ms`, cursor: "default" }}>
                                    <span className="u-row-idx">{pad2(i + 1)}</span>
                                    <div className="d-plat">
                                        <span className="d-ico"><Icon size={18} /></span>
                                        <div className="u-row-main">
                                            <span className="u-row-title" style={{ fontSize: 22 }}>{name}{os === id && <span className="u-chip u-chip--mono" style={{ marginLeft: 10 }}>this device</span>}</span>
                                            <span className="u-muted u-small">{note}</span>
                                        </div>
                                    </div>
                                    <div className="u-row-side">
                                        {asset ? (
                                            <>
                                                {alt && <a href={alt.url} className="u-btn u-btn--ghost u-btn--sm">.deb</a>}
                                                <a href={asset.url} className="u-btn u-btn--solid u-btn--sm"><DownloadIcon size={14} /> {asset.name.split(".").pop()} · {mb(asset.size)}</a>
                                            </>
                                        ) : release.state === "loading" ? (
                                            <span className="u-skel" style={{ width: 120, height: 32 }} />
                                        ) : (
                                            <span className="u-chip u-chip--mono"><span className="u-dot u-dot--warn" /> Not published yet</span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                        {[
                            { icon: Globe, name: "Web", note: "Chrome, Edge, Firefox and Safari. Nothing to install." },
                            { icon: Smartphone, name: "Phones and tablets", note: "Join rooms, chat, draw and run code from a mobile browser." },
                        ].map(({ icon: Icon, name, note }, i) => (
                            <li key={name} className="u-row d-row-plat" style={{ cursor: "default" }}>
                                <span className="u-row-idx">{pad2(PLATFORMS.length + i + 1)}</span>
                                <div className="d-plat">
                                    <span className="d-ico"><Icon size={18} /></span>
                                    <div className="u-row-main">
                                        <span className="u-row-title" style={{ fontSize: 22 }}>{name}</span>
                                        <span className="u-muted u-small">{note}</span>
                                    </div>
                                </div>
                                <div className="u-row-side"><Link to="/" className="u-btn u-btn--ghost u-btn--sm">Open <ArrowUpRight size={14} /></Link></div>
                            </li>
                        ))}
                    </ul>

                    {release.state === "none" && (
                        <div className="u-card dl-note" data-rise>
                            <strong>No desktop release is published yet.</strong>
                            <p className="u-muted">Installers are built by GitHub Actions when a version tag is pushed. To build one yourself:</p>
                            <CopyLine text="cd desktop && npm install && npm run dist" />
                        </div>
                    )}
                    <p className="u-label" style={{ marginTop: 14 }}>
                        The desktop app is free on every plan. Builds are not code-signed yet, so Windows SmartScreen and macOS Gatekeeper ask before the first launch. <a href={RELEASES} target="_blank" rel="noreferrer" className="u-ul">All releases <ArrowUpRight size={15} /></a>
                    </p>
                </div>
            </div>

            <section className="u-section u-head">
                <span className="u-label" data-rise>On your machine</span>
                <div className="dl-local">
                    <p className="u-lede" data-rise><b>The desktop app tries your machine first.</b> Code runs on a local Judge0 and the copilot uses a local model. If either isn't running, it falls back to the server.</p>
                    <div className="dl-steps">
                        <article className="u-card dl-step" data-rise>
                            <div className="f-cell-top"><span className="u-label">01 · Code runner</span><Cpu size={18} /></div>
                            <h3>Judge0 CE</h3>
                            <p className="u-muted">Open-source code execution in Docker, on port 2358. Follow the self-hosting steps in the Judge0 repo, then start it:</p>
                            <CopyLine text="docker compose up -d db redis && docker compose up -d" />
                            <a href="https://github.com/judge0/judge0/blob/master/CHANGELOG.md#deployment-procedure" target="_blank" rel="noreferrer" className="u-ul u-small">Judge0 deployment guide <ArrowUpRight size={15} /></a>
                        </article>
                        <article className="u-card dl-step" data-rise style={{ "--d": "80ms" }}>
                            <div className="f-cell-top"><span className="u-label">02 · AI copilot</span><Sparkles size={18} /></div>
                            <h3>Ollama + Qwen2.5-Coder</h3>
                            <p className="u-muted">A small open-weight code model that runs on a laptop CPU. Use the 7B model if you have 8 GB of free memory.</p>
                            <CopyLine text="ollama pull qwen2.5-coder:1.5b" />
                            <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="u-ul u-small">Get Ollama <ArrowUpRight size={15} /></a>
                        </article>
                        <article className="u-card dl-step" data-rise style={{ "--d": "160ms" }}>
                            <div className="f-cell-top"><span className="u-label">03 · Fallback</span><Server size={18} /></div>
                            <h3>The server</h3>
                            <p className="u-muted">With nothing local, runs and AI requests go to the hosted server, exactly like the web app. Nothing to set up.</p>
                            <Link to="/status" className="u-ul u-small">Server status</Link>
                        </article>
                    </div>
                </div>
            </section>

            <CtaBand />
        </SiteLayout>
    );
}
