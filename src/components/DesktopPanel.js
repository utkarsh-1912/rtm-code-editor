import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, FolderOpen, SquareTerminal, Globe, ArrowUpRight, Check, Download, Cpu, Cloud, WifiOff, Trash2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { pad2 } from './ux/primitives';
import { desktop, openOnWebsite } from '../utils/desktop';
import { runWhere, setRunWhere } from '../utils/runner';

// Settings > Desktop app: the built-in runner (which languages this computer can run), the
// local AI model, and quick actions.
export default function DesktopPanel() {
    const navigate = useNavigate();
    const [info, setInfo] = useState(null);
    const [local, setLocal] = useState(null);
    const [chains, setChains] = useState(null);
    const [where, setWhere] = useState(runWhere());
    const [checking, setChecking] = useState(false);
    const [packs, setPacks] = useState({ available: [], installed: {} });
    const [progress, setProgress] = useState({}); // pack id -> { phase, done, total, message }

    const check = useCallback(async (fresh = false) => {
        setChecking(true);
        try {
            const [status, list] = await Promise.all([
                desktop()?.localStatus?.().catch(() => null),
                desktop()?.toolchains?.({ fresh }).catch(() => null),
            ]);
            setLocal(status || null);
            setChains(Array.isArray(list) ? list : null);
            const p = await desktop()?.packs?.().catch(() => null);
            if (p) setPacks(p);
        } finally {
            setChecking(false);
        }
    }, []);

    useEffect(() => {
        desktop()?.info?.().then(setInfo).catch(() => {});
        check();
        const off = desktop()?.onPackProgress?.((p) => setProgress((cur) => ({ ...cur, [p.id]: p })));
        return () => off?.();
    }, [check]);

    // Download a language pack (official portable toolchain) into the app's data folder.
    const installPack = async (id, label) => {
        setProgress((cur) => ({ ...cur, [id]: { phase: 'download', done: 0, total: 0 } }));
        const r = await desktop()?.installPack?.(id).catch((err) => ({ ok: false, error: err.message }));
        if (r?.ok) toast.success(`${label} is ready, offline too`);
        else toast.error(r?.error ? `Couldn't install ${label}: ${r.error}` : `Couldn't install ${label}`);
        setProgress((cur) => { const next = { ...cur }; delete next[id]; return next; });
        check(true);
    };
    const removePack = async (id, label) => {
        if (!window.confirm(`Remove ${label} from this app? You can install it again later.`)) return;
        await desktop()?.removePack?.(id).catch(() => {});
        check(true);
    };
    const packFor = (c) => packs.available.find((p) => p.id === c.pack);
    const isMac = info?.platform === 'darwin';
    const pct = (p) => (p?.total ? Math.round((p.done / p.total) * 100) : null);
    const stage = (p) => (!p ? '' : p.phase === 'extract' ? 'Unpacking…' : p.phase === 'install' ? 'Installing…' : pct(p) != null ? `${pct(p)}%` : 'Downloading…');

    const terminal = async () => {
        try {
            await desktop()?.openTerminal?.({});
        } catch (err) {
            toast.error(err.message || 'Could not open a terminal');
        }
    };

    const choose = (v) => { setRunWhere(v); setWhere(v); };
    const ready = chains?.filter((c) => c.ready) || [];
    const missing = chains?.filter((c) => !c.ready) || [];

    const rows = [
        {
            title: 'AI copilot',
            text: local?.llm ? `Local model ${local.model} via ${local.llmUrl}.` : `No local model at ${local?.llmUrl || 'localhost:11434'}, so the cloud answers. Install Ollama and run "ollama pull ${local?.model || 'qwen2.5-coder:1.5b'}" to use AI offline.`,
            ok: local?.llm,
        },
        {
            title: 'Interface',
            text: info?.bundled ? 'Bundled with this install, so the app opens instantly and the offline editor works without internet.' : `Loaded from ${info?.uiUrl || info?.appUrl || 'the server'}.`,
            ok: true,
        },
    ];

    return (
        <>
            <div className="u-card u-enter dk-runner">
                <div className="g-panel-head">
                    <strong>Code runner</strong>
                    <span className="u-label">{chains ? `${ready.length} of ${chains.length} languages on this computer` : 'Checking'}</span>
                </div>
                <p className="u-muted dk-lede">
                    Code runs on this computer with the compilers and interpreters you have installed, like an IDE.
                    It's faster, works offline, and nothing leaves your machine. JavaScript works out of the box.
                </p>
                <div className="dk-where" role="radiogroup" aria-label="Where code runs">
                    <button type="button" role="radio" aria-checked={where === 'local'} className={where === 'local' ? 'on' : ''} onClick={() => choose('local')}>
                        <Cpu size={16} /><b>This computer first</b><span>Falls back to the cloud for languages you don't have.</span>
                    </button>
                    <button type="button" role="radio" aria-checked={where === 'cloud'} className={where === 'cloud' ? 'on' : ''} onClick={() => choose('cloud')}>
                        <Cloud size={16} /><b>Always the cloud</b><span>Every run goes to the sandboxed cloud runner.</span>
                    </button>
                </div>
                {chains === null ? (
                    <div className="u-skel" style={{ height: 120 }} />
                ) : (
                    <ul className="dk-langs">
                        {[...ready, ...missing].map((c) => (
                            <li key={c.id} className={c.ready ? 'is-ready' : ''}>
                                <span className={`dk-mark${c.ready ? ' on' : ''}`}>{c.ready ? <Check size={12} /> : null}</span>
                                <b>{c.label}</b>
                                <span className="u-mono dk-ver u-ellipsis" title={c.version || ''}>{c.ready ? (c.builtin ? 'built in' : c.version || c.tool) : c.note || 'not installed'}</span>
                                {!c.ready && packFor(c) && (
                                    progress[c.pack]
                                        ? <span className="dk-progress" title={stage(progress[c.pack])}><i style={{ width: `${pct(progress[c.pack]) ?? 30}%` }} /><em>{stage(progress[c.pack])}</em></span>
                                        : <button className="dk-get" onClick={() => installPack(c.pack, packFor(c).label)} title={`Download ${packFor(c).label} (${packFor(c).approx}) into the app`}><Package size={12} /> Install · {packFor(c).approx}</button>
                                )}
                                {!c.ready && !packFor(c) && isMac && (c.id === 'c' || c.id === 'cpp') && (
                                    <button className="dk-get" onClick={() => desktop()?.installAppleTools?.()} title="Apple's Command Line Tools include the C and C++ compilers"><Package size={12} /> Install</button>
                                )}
                                {!c.ready && !packFor(c) && !(isMac && (c.id === 'c' || c.id === 'cpp')) && c.install && (
                                    <a className="dk-get" href={c.install} target="_blank" rel="noreferrer" onClick={(e) => { e.preventDefault(); desktop()?.openExternal?.(c.install); }}>
                                        <Download size={12} /> Get
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                {Object.keys(packs.installed || {}).length > 0 && (
                    <div className="dk-packs">
                        <span className="u-label">Installed language packs</span>
                        {Object.entries(packs.installed).map(([id, p]) => {
                            const label = packs.available.find((a) => a.id === id)?.label || id;
                            return (
                                <div key={id} className="dk-pack">
                                    <Package size={14} /><b>{label}</b><span className="u-mono">{p.version}</span>
                                    <button className="u-icon" onClick={() => removePack(id, label)} title={`Remove ${label}`} aria-label={`Remove ${label}`}><Trash2 size={14} /></button>
                                </div>
                            );
                        })}
                    </div>
                )}
                <p className="u-small u-muted dk-note">
                    <WifiOff size={12} /> Built-in and installed languages run offline. Language packs are the official toolchains, kept inside the app (not installed system-wide). In shared rooms you're asked once before code runs on your computer, because it runs with your permissions.
                    {local?.judge0 && ' A Judge0 on this computer is also used as a fallback.'}
                </p>
            </div>

            <div className="u-card u-enter" style={{ marginTop: 12 }}>
                <div className="g-panel-head">
                    <strong>This computer</strong>
                    <span className="u-label">{info ? `v${info.version} · ${info.platform}` : 'Desktop app'}</span>
                </div>
                <ul className="g-rules">
                    {rows.map((r, i) => (
                        <li key={r.title}>
                            <span>{pad2(i + 1)}</span>
                            <div>
                                <h5>{r.title}</h5>
                                <p>{r.text}</p>
                                <div className="g-cap">{local == null && r.title !== 'Interface' ? 'checking' : r.ok ? 'local' : 'cloud'}</div>
                            </div>
                            <span className={`u-dot${r.ok ? '' : ' u-dot--warn'}`} aria-hidden="true" />
                        </li>
                    ))}
                </ul>
                <div className="g-desk-actions">
                    <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => check(true)} disabled={checking}><RefreshCw size={14} /> {checking ? 'Checking…' : 'Check again'}</button>
                    <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => navigate('/offline')}><WifiOff size={14} /> Offline editor</button>
                    <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => navigate('/dashboard?import=folder')}><FolderOpen size={14} /> Open folder</button>
                    <button className="u-btn u-btn--ghost u-btn--sm" onClick={terminal}><SquareTerminal size={14} /> Terminal</button>
                    <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => openOnWebsite('/')}><Globe size={14} /> Website <ArrowUpRight size={15} /></button>
                </div>
            </div>
        </>
    );
}
