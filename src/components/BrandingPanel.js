import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Sparkles, Upload, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getBranding, saveBranding, listTeams } from "../utils/meetings";
import { getBackendUrl } from "../utils/api";

// Settings > Branding (Enterprise): your team's logo and name on everything candidates
// see — meeting pages, booking pages and meeting emails.
export default function BrandingPanel({ user }) {
    const navigate = useNavigate();
    const [teams, setTeams] = useState(null);
    const [orgId, setOrgId] = useState(null);
    const [b, setB] = useState(null);
    const [form, setForm] = useState({ name: "", logo: undefined });
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        listTeams(user.uid).then((list) => {
            const mine = (Array.isArray(list) ? list : []).filter((t) => t.role === "owner" || t.role === "admin");
            setTeams(mine);
            if (mine[0]) setOrgId(mine[0].id);
        }).catch(() => setTeams([]));
    }, [user.uid]);
    useEffect(() => {
        if (!orgId) return;
        setB(null);
        getBranding(orgId).then((x) => { setB(x); setForm({ name: x.name || "", logo: undefined }); }).catch((err) => toast.error(err.message));
    }, [orgId]);

    const pickLogo = (file) => {
        if (!file) return;
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast.error("Use a PNG, JPEG or WebP image.");
        if (file.size > 200 * 1024) return toast.error("Keep the logo under 200 KB.");
        const r = new FileReader();
        r.onload = () => setForm((f) => ({ ...f, logo: r.result }));
        r.readAsDataURL(file);
    };
    const save = async () => {
        setBusy(true);
        try {
            await saveBranding(orgId, { name: form.name, ...(form.logo !== undefined ? { logo: form.logo } : {}) });
            toast.success("Branding saved. New meetings show it to candidates.");
            setB(await getBranding(orgId));
            setForm((f) => ({ ...f, logo: undefined }));
        } catch (err) { toast.error(err.message); } finally { setBusy(false); }
    };

    if (teams === null) return <div className="u-skel" style={{ height: 120 }} />;
    if (!teams.length) return (
        <div className="br">
            <h3>Custom branding</h3>
            <p className="u-small u-muted">Branding belongs to a team. Create a team (Snippets › Teams) as its owner first.</p>
        </div>
    );

    const saved = b?.logo && b.logo.startsWith("/") ? `${getBackendUrl()}${b.logo}` : b?.logo;
    const logoShown = form.logo !== undefined ? form.logo : saved;
    return (
        <div className="br">
            <div className="br-head">
                <div>
                    <h3>Custom branding</h3>
                    <p className="u-small u-muted">Your logo and name on meeting pages, booking pages and meeting emails, for meetings your team's owners and admins host.</p>
                </div>
                {teams.length > 1 && (
                    <select className="u-select br-team" value={orgId || ""} onChange={(e) => setOrgId(Number(e.target.value))} aria-label="Team">
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                )}
            </div>
            {!b ? <div className="u-skel" style={{ height: 120 }} /> : !b.enterprise ? (
                <div className="br-lock">
                    <Sparkles size={18} />
                    <div><b>An Enterprise feature</b><p>Custom branding is included in Enterprise. Free and Team show the standard look.</p></div>
                    <button type="button" className="u-btn u-btn--solid u-btn--sm" onClick={() => navigate("/pricing")}>See plans</button>
                </div>
            ) : (
                <>
                    <div className="br-grid">
                        <div className="u-field"><label htmlFor="br-name">Display name</label>
                            <input id="br-name" className="u-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={b.teamName} maxLength={80} />
                        </div>
                        <div className="u-field"><span className="u-field-label">Logo</span>
                            <span className="br-logo">
                                {logoShown ? <img src={logoShown} alt="" /> : <span className="u-small u-faint">No logo</span>}
                                <label className="u-btn u-btn--ghost u-btn--sm"><Upload size={13} /> Upload<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pickLogo(e.target.files?.[0])} /></label>
                                {logoShown && <button type="button" className="u-icon" onClick={() => setForm((f) => ({ ...f, logo: null }))} aria-label="Remove logo"><Trash2 size={14} /></button>}
                            </span>
                        </div>
                    </div>
                    <div className="br-preview">
                        <span className="u-label">Preview</span>
                        <div className="br-card">
                            <span className="br-card-top">{logoShown && <img src={logoShown} alt="" />}<b>{form.name || b.teamName}</b></span>
                            <span className="br-card-title">System design interview</span>
                            <span className="br-card-btn">Join now</span>
                        </div>
                    </div>
                    <div className="br-foot"><button type="button" className="u-btn u-btn--solid u-btn--sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save branding"}</button></div>
                </>
            )}
        </div>
    );
}
