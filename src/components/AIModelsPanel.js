import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { KeyRound, Lock, LockOpen, ShieldCheck, Plus, Trash2, Zap, ExternalLink, Check, X, Clock } from "lucide-react";
import {
    PROVIDERS, providerById, listConnections, addConnection, removeConnection, getDefault, setDefault,
    listPlatformModels, requestModelAccess, listAccessRequests, decideAccessRequest, testConnection, vaultInfo,
} from "../utils/aiModels";

// Settings > AI models: which model the copilot uses, models this site provides (some on
// request), and models you connect with your own API key (kept encrypted on this device).
export default function AIModelsPanel({ user }) {
    const uid = user?.uid;
    const [connections, setConnections] = useState(() => listConnections(uid));
    const [choice, setChoice] = useState(() => getDefault(uid));
    const [platform, setPlatform] = useState(null); // { admin, models }
    const [adding, setAdding] = useState(false);
    const [testing, setTesting] = useState(null);
    const [vault, setVault] = useState({ kind: vaultInfo.kind(), passphrase: false, locked: false });

    const refreshVault = useCallback(async () => {
        setVault({ kind: vaultInfo.kind(), passphrase: await vaultInfo.hasPassphrase(), locked: await vaultInfo.isLocked() });
    }, []);
    const loadPlatform = useCallback(() => listPlatformModels().then(setPlatform).catch(() => setPlatform({ admin: false, models: [] })), []);
    useEffect(() => { loadPlatform(); refreshVault(); }, [loadPlatform, refreshVault]);

    const pick = (value) => { setDefault(uid, value); setChoice(value); toast.success("Default model saved"); };

    const test = async (c) => {
        setTesting(c.id);
        try {
            const out = await testConnection(uid, c);
            toast.success(`Works: ${out.model} answered in ${(out.ms / 1000).toFixed(1)}s (${out.where}).`);
        } catch (err) {
            toast.error(err.message);
        } finally { setTesting(null); }
    };
    const remove = async (c) => {
        if (!window.confirm(`Remove ${c.label}? Its key is deleted from this device.`)) return;
        await removeConnection(uid, c.id);
        setConnections(listConnections(uid));
        setChoice(getDefault(uid));
    };
    const request = async (m) => {
        try {
            await requestModelAccess(m.id);
            toast.success(`Asked for ${m.label}. You'll get a notification when it's decided.`);
            loadPlatform();
        } catch (err) { toast.error(err.message); }
    };

    const usable = (platform?.models || []).filter((m) => m.ready && (m.status === "available" || m.status === "approved"));

    return (
        <div className="aim">
            <section className="aim-sec">
                <div className="aim-head">
                    <h3>Default model</h3>
                    <span className="u-small u-muted">Used by the AI copilot in rooms and projects.</span>
                </div>
                <div className="aim-choices" role="radiogroup" aria-label="Default model">
                    <Choice on={choice === "auto"} onClick={() => pick("auto")} title="Automatic" sub="A model you connected below if there is one, else the site's default model (the desktop app tries a model on your computer first)." />
                    {usable.filter((m) => !m.default).map((m) => (
                        <Choice key={m.id} on={choice === `platform:${m.id}`} onClick={() => pick(`platform:${m.id}`)} title={m.label} sub={`Provided by this site · ${m.providerName}`} />
                    ))}
                    {connections.map((c) => (
                        <Choice key={c.id} on={choice === `own:${c.id}`} onClick={() => pick(`own:${c.id}`)} title={c.label} sub={`Your key · ${providerById(c.provider)?.name || c.provider}`} />
                    ))}
                </div>
            </section>

            <section className="aim-sec">
                <div className="aim-head">
                    <h3>Models from this site</h3>
                    <span className="u-small u-muted">Some are open to everyone; others are by request while we roll them out.</span>
                </div>
                {platform === null ? <div className="u-skel" style={{ height: 60 }} /> : (
                    <ul className="aim-list">
                        {platform.models.map((m) => (
                            <li key={m.id}>
                                <span className="aim-main"><b>{m.label}</b><span>{m.providerName}{m.ready ? "" : " · coming soon"}</span></span>
                                <AccessState m={m} onRequest={() => request(m)} />
                            </li>
                        ))}
                        {!platform.models.length && <li className="aim-empty">No models are set up on this server yet.</li>}
                    </ul>
                )}
            </section>

            <section className="aim-sec">
                <div className="aim-head">
                    <h3>Your API keys</h3>
                    {!adding && <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => setAdding(true)} disabled={vault.locked}><Plus size={14} /> Add a model</button>}
                </div>
                <VaultBadge vault={vault} onChange={refreshVault} />
                {adding && (
                    <AddForm onCancel={() => setAdding(false)} onSave={async (form) => {
                        const c = await addConnection(uid, form);
                        setConnections(listConnections(uid));
                        setAdding(false);
                        toast.success(`${c.label} saved. Testing it…`);
                        test({ ...c });
                    }} />
                )}
                <ul className="aim-list">
                    {connections.map((c) => (
                        <li key={c.id}>
                            <span className="aim-main"><b>{c.label}</b><span className="u-mono">{providerById(c.provider)?.name} · {c.model} · key ••••{c.last4}</span></span>
                            <span className="aim-actions">
                                <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => test(c)} disabled={testing === c.id || vault.locked}><Zap size={14} /> {testing === c.id ? "Testing…" : "Test"}</button>
                                <button type="button" className="u-icon" onClick={() => remove(c)} title="Remove" aria-label={`Remove ${c.label}`}><Trash2 size={15} /></button>
                            </span>
                        </li>
                    ))}
                    {!connections.length && !adding && <li className="aim-empty">No keys yet. Connect Gemini, Claude (Sonnet, Haiku), OpenAI, OpenRouter, Grok, Qwen, Kimi, Sarvam, or any OpenAI-compatible server.</li>}
                </ul>
            </section>

            {platform?.admin && <AccessRequests onDecided={loadPlatform} />}
        </div>
    );
}

const Choice = ({ on, onClick, title, sub }) => (
    <button type="button" role="radio" aria-checked={on} className={`aim-choice${on ? " on" : ""}`} onClick={onClick}>
        <span className="aim-radio" aria-hidden="true" />
        <span className="aim-main"><b>{title}</b><span>{sub}</span></span>
    </button>
);

function AccessState({ m, onRequest }) {
    if (m.status === "available") return <span className="aim-tag is-ok"><Check size={12} /> {m.access === "open" ? "Open" : "Yours"}</span>;
    if (m.status === "approved") return <span className="aim-tag is-ok"><Check size={12} /> Approved</span>;
    if (m.status === "pending") return <span className="aim-tag"><Clock size={12} /> Requested</span>;
    return (
        <span className="aim-actions">
            {m.status === "declined" && <span className="aim-tag is-bad">Not approved</span>}
            <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={onRequest}>{m.status === "declined" ? "Ask again" : "Request access"}</button>
        </span>
    );
}

function VaultBadge({ vault, onChange }) {
    const [mode, setMode] = useState(null); // unlock | set | remove
    const [pass, setPass] = useState("");
    const [busy, setBusy] = useState(false);
    if (vault.kind === "desktop") {
        return <p className="aim-note"><ShieldCheck size={14} /> Keys are encrypted by your operating system's keychain and only ever sent from this app to the provider they're for. They're never stored on our servers.</p>;
    }
    const run = async (fn) => {
        setBusy(true);
        try { await fn(); setPass(""); setMode(null); await onChange(); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
    };
    return (
        <div className="aim-vault">
            <p className="aim-note">
                {vault.locked ? <Lock size={14} /> : <ShieldCheck size={14} />}
                {vault.locked
                    ? "Your keys are locked. Unlock them with your passphrase to use or add models."
                    : `Keys are encrypted on this device (AES-256) with a key the browser can't export, and are never stored on our servers.${vault.passphrase ? " A passphrase protects them too." : " Add a passphrase so they can't be read at all until you unlock them."}`}
            </p>
            {mode ? (
                <form className="aim-pass" onSubmit={(e) => {
                    e.preventDefault();
                    if (mode === "unlock") run(async () => { if (!(await vaultInfo.unlock(pass))) throw new Error("That passphrase isn't right."); });
                    else if (mode === "set") run(() => vaultInfo.setPassphrase(pass));
                }}>
                    <input className="u-input" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={mode === "unlock" ? "Passphrase" : "New passphrase (8+ characters)"} autoFocus />
                    <button type="submit" className="u-btn u-btn--solid u-btn--sm" disabled={busy || !pass}>{mode === "unlock" ? "Unlock" : "Save passphrase"}</button>
                    <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => { setMode(null); setPass(""); }}>Cancel</button>
                </form>
            ) : (
                <span className="aim-actions">
                    {vault.locked && <button type="button" className="u-btn u-btn--solid u-btn--sm" onClick={() => setMode("unlock")}><LockOpen size={14} /> Unlock</button>}
                    {!vault.locked && <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => setMode("set")}><KeyRound size={14} /> {vault.passphrase ? "Change passphrase" : "Add a passphrase"}</button>}
                    {!vault.locked && vault.passphrase && <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => { vaultInfo.lock(); onChange(); }}><Lock size={14} /> Lock now</button>}
                    {!vault.locked && vault.passphrase && <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => window.confirm("Remove the passphrase? Keys stay encrypted with this device's key.") && run(() => vaultInfo.setPassphrase(null))}>Remove passphrase</button>}
                </span>
            )}
        </div>
    );
}

function AddForm({ onSave, onCancel }) {
    const [provider, setProvider] = useState("gemini");
    const p = providerById(provider);
    const [model, setModel] = useState(p.models[0] || "");
    const [label, setLabel] = useState("");
    const [base, setBase] = useState("");
    const [key, setKey] = useState("");
    const [busy, setBusy] = useState(false);
    const choose = (id) => { setProvider(id); setModel(providerById(id).models[0] || ""); };
    return (
        <form className="aim-add" onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try { await onSave({ provider, model, label, base, key }); setKey(""); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
        }}>
            <div className="u-field">
                <label htmlFor="aim-provider">Provider</label>
                <select id="aim-provider" className="u-select" value={provider} onChange={(e) => choose(e.target.value)}>
                    {PROVIDERS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
            </div>
            {p.custom && (
                <div className="u-field">
                    <label htmlFor="aim-base">Server address</label>
                    <input id="aim-base" className="u-input" value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://llm.example.com/v1" />
                </div>
            )}
            <div className="u-field">
                <label htmlFor="aim-model">Model id</label>
                <input id="aim-model" className="u-input u-mono" list="aim-models" value={model} onChange={(e) => setModel(e.target.value)} placeholder={p.modelHint || "Model id"} />
                <datalist id="aim-models">{p.models.map((m) => <option key={m} value={m} />)}</datalist>
            </div>
            <div className="u-field">
                <label htmlFor="aim-key">API key {p.keyUrl && <a href={p.keyUrl} target="_blank" rel="noreferrer noopener" className="aim-link">Get a key <ExternalLink size={11} /></a>}</label>
                <input id="aim-key" className="u-input u-mono" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your key" />
            </div>
            <div className="u-field">
                <label htmlFor="aim-label">Name <span className="u-faint">— optional</span></label>
                <input id="aim-label" className="u-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`${p.name} · ${model || "model"}`} />
            </div>
            <div className="aim-actions">
                <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={onCancel}>Cancel</button>
                <button type="submit" className="u-btn u-btn--solid u-btn--sm" disabled={busy || !key.trim() || !model.trim()}>{busy ? "Encrypting…" : "Save & test"}</button>
            </div>
        </form>
    );
}

// For the site's developers (ADMIN_EMAILS): who asked for which model.
function AccessRequests({ onDecided }) {
    const [rows, setRows] = useState(null);
    const load = useCallback(() => listAccessRequests("pending").then(setRows).catch(() => setRows([])), []);
    useEffect(() => { load(); }, [load]);
    const decide = async (r, decision) => {
        try { await decideAccessRequest(r.id, decision); toast.success(decision === "approve" ? `Approved ${r.name || r.email}` : "Declined"); load(); onDecided?.(); } catch (err) { toast.error(err.message); }
    };
    return (
        <section className="aim-sec">
            <div className="aim-head"><h3>Access requests</h3><span className="u-small u-muted">Only you (the site's developers) see this.</span></div>
            {rows === null ? <div className="u-skel" style={{ height: 48 }} /> : (
                <ul className="aim-list">
                    {rows.map((r) => (
                        <li key={r.id}>
                            <span className="aim-main"><b>{r.name || r.email}</b><span>{r.email} · {r.model}{r.note ? ` · “${r.note}”` : ""}</span></span>
                            <span className="aim-actions">
                                <button type="button" className="u-btn u-btn--solid u-btn--sm" onClick={() => decide(r, "approve")}><Check size={14} /> Approve</button>
                                <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => decide(r, "decline")}><X size={14} /> Decline</button>
                            </span>
                        </li>
                    ))}
                    {!rows.length && <li className="aim-empty">Nothing waiting.</li>}
                </ul>
            )}
        </section>
    );
}
