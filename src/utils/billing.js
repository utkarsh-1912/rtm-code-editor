import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { auth } from "../firebase";
import { getBackendUrl } from "./api";
import catalogue from "../shared/plans.json";
import { track } from "./track";

export { catalogue };
export const TEAM = catalogue.plans.team;
export const yearlyPrice = (monthly) => Math.round(monthly * 12 * (1 - catalogue.yearlyDiscount));

// Billing endpoints identify the caller by Firebase ID token, never by a userId in the body.
async function authed(path, options = {}) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Sign in to manage your plan");
    const res = await fetch(`${getBackendUrl()}/api/billing/${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Billing responded ${res.status}`);
    return data;
}

export const fetchPlan = () => authed("status");

export async function startCheckout(interval = "month") {
    const { url } = await authed("checkout", { method: "POST", body: JSON.stringify({ plan: "team", interval }) });
    window.location.assign(url);
}

export async function openPortal() {
    const { url } = await authed("portal", { method: "POST" });
    window.location.assign(url);
}

// A 402 from the API means a Free plan limit; say so with a way out instead of "failed".
export const isPlanLimit = (res, data) => res?.status === 402 || data?.code === "PLAN_LIMIT";

export function showUpgradeToast(message) {
    toast.custom((t) => (
        <div className={`up-toast${t.visible ? " is-in" : ""}`} role="alert">
            <p>{message}</p>
            <div>
                <a className="u-btn u-btn--solid u-btn--sm" href="/pricing" onClick={() => { track("UPGRADE_CLICKED", { source: "limit" }); toast.dismiss(t.id); }}>See plans</a>
                <button type="button" className="u-btn u-btn--ghost u-btn--sm" onClick={() => toast.dismiss(t.id)}>Not now</button>
            </div>
        </div>
    ), { duration: 9000 });
}

// Current plan, limits and usage for the signed-in person. `null` until loaded or if signed out.
export function usePlan(user) {
    const [plan, setPlan] = useState(null);
    const [error, setError] = useState(null);
    const reload = useCallback(async () => {
        if (!user?.uid) return;
        try {
            setPlan(await fetchPlan());
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    }, [user?.uid]);
    useEffect(() => { reload(); }, [reload]);
    return { plan, error, reload };
}
