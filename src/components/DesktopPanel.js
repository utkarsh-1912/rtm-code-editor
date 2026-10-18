import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, FolderOpen, SquareTerminal, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { pad2 } from './ux/primitives';
import { desktop, openOnWebsite } from '../utils/desktop';

// Settings > Desktop app: what this install runs locally and quick actions.
export default function DesktopPanel() {
    const navigate = useNavigate();
    const [info, setInfo] = useState(null);
    const [local, setLocal] = useState(null);
    const [checking, setChecking] = useState(false);

    const check = useCallback(async () => {
        setChecking(true);
        try {
            setLocal(await desktop()?.localStatus?.());
        } catch {
            setLocal(null);
        } finally {
            setChecking(false);
        }
    }, []);

    useEffect(() => {
        desktop()?.info?.().then(setInfo).catch(() => {});
        check();
    }, [check]);

    const terminal = async () => {
        try {
            await desktop()?.openTerminal?.({});
        } catch (err) {
            toast.error(err.message || 'Could not open a terminal');
        }
    };

    const rows = [
        {
            title: 'Code runner',
            text: local?.judge0 ? `Local Judge0 at ${local.judge0Url}. Code runs on this computer.` : `No Judge0 at ${local?.judge0Url || 'localhost:2358'}, so code runs on the server. Start Judge0 CE to run offline and faster.`,
            ok: local?.judge0,
        },
        {
            title: 'AI copilot',
            text: local?.llm ? `Local model ${local.model} via ${local.llmUrl}.` : `No local model at ${local?.llmUrl || 'localhost:11434'}, so the server answers. Install Ollama and run "ollama pull ${local?.model || 'qwen2.5-coder:1.5b'}".`,
            ok: local?.llm,
        },
        {
            title: 'Interface',
            text: info?.bundled ? 'Bundled with this install, so the app opens without waiting for the server.' : `Loaded from ${info?.uiUrl || info?.appUrl || 'the server'}.`,
            ok: true,
        },
    ];

    return (
        <div className="u-card u-enter">
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
                            <div className="g-cap">{local == null && r.title !== 'Interface' ? 'checking' : r.ok ? 'local' : 'server'}</div>
                        </div>
                        <span className={`u-dot${r.ok ? '' : ' u-dot--warn'}`} aria-hidden="true" />
                    </li>
                ))}
            </ul>
            <div className="g-desk-actions">
                <button className="u-btn u-btn--ghost u-btn--sm" onClick={check} disabled={checking}><RefreshCw size={14} /> {checking ? 'Checking…' : 'Check again'}</button>
                <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => navigate('/dashboard?import=folder')}><FolderOpen size={14} /> Open folder</button>
                <button className="u-btn u-btn--ghost u-btn--sm" onClick={terminal}><SquareTerminal size={14} /> Terminal</button>
                <button className="u-btn u-btn--ghost u-btn--sm" onClick={() => openOnWebsite('/')}><Globe size={14} /> Website ↗</button>
            </div>
        </div>
    );
}
