// Running inside the installed desktop app? The app is a focused workspace: marketing
// pages are skipped, and website pages (legal, help, status) open in the browser.
import { publicOrigin } from "./api";

export const desktop = () => (typeof window !== "undefined" ? window.colabsDesktop : null) || null;
export const IS_DESKTOP = !!desktop();

// Website-only pages. In the app, links to these open the public site in the browser.
export const WEB_ONLY = ["/about", "/features", "/pricing", "/download", "/status", "/security", "/support", "/privacy", "/terms"];
export const isWebOnly = (path) => WEB_ONLY.includes(String(path || "").split(/[?#]/)[0]);

export function openOnWebsite(path = "/") {
    const url = /^https?:/i.test(path) ? path : `${publicOrigin()}${path}`;
    const d = desktop();
    if (d?.openExternal) return d.openExternal(url);
    window.open(url, "_blank", "noopener,noreferrer");
    return undefined;
}
