import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Check, Clock, KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { PROVIDERS, listPlatformModels, requestModelAccess } from "../../utils/aiModels";

// Marketing: the AI models you can use. Bring your own key for any provider, or use the
// models this site provides (some by request while they roll out).
export default function ModelsBand() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [platform, setPlatform] = useState(null);
    useEffect(() => { listPlatformModels().then(setPlatform).catch(() => setPlatform({ models: [] })); }, [user?.uid]);

    const request = async (m) => {
        if (!user) { navigate("/login", { state: { from: "/settings?section=ai" } }); return; }
        try {
            await requestModelAccess(m.id);
            toast.success(`Requested ${m.label}. We'll let you know when it's on.`);
            setPlatform(await listPlatformModels());
        } catch (err) { toast.error(err.message); }
    };

    return (
        <section className="mb" data-rise aria-labelledby="mb-title">
            <div className="mb-intro">
                <span className="u-label">AI models</span>
                <h2 id="mb-title" className="u-display mb-title">Your model,<br />your key.</h2>
                <p>Pick the copilot's model, or connect your own with an API key. Keys stay encrypted on your device and go straight to the provider; we never store them.</p>
                <ul className="mb-points">
                    <li><ShieldCheck size={15} /> Encrypted on your device (AES-256, or your OS keychain in the desktop app)</li>
                    <li><KeyRound size={15} /> Each key is only ever sent to its own provider</li>
                </ul>
            </div>
            <div className="mb-cols">
                <div>
                    <span className="u-label">Bring your own key</span>
                    <ul className="mb-providers">
                        {PROVIDERS.filter((p) => !p.custom).map((p) => <li key={p.id}>{p.name}</li>)}
                        <li className="mb-more">+ any OpenAI-compatible server</li>
                    </ul>
                </div>
                <div>
                    <span className="u-label">Provided by us</span>
                    <ul className="mb-models">
                        {(platform?.models || []).map((m) => (
                            <li key={m.id}>
                                <span><b>{m.label}</b><em>{m.providerName}</em></span>
                                {m.status === "available" || m.status === "approved"
                                    ? <span className="mb-tag is-ok"><Check size={12} /> {m.access === "open" ? "Included" : "You have access"}</span>
                                    : m.status === "pending"
                                        ? <span className="mb-tag"><Clock size={12} /> Requested</span>
                                        : <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => request(m)}>Request access</button>}
                            </li>
                        ))}
                        {platform && !platform.models.length && <li className="mb-more">Coming soon</li>}
                    </ul>
                </div>
            </div>
        </section>
    );
}
