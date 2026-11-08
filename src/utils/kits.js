import { getBackendUrl } from "./api";
import { auth } from "../firebase";

// Session kits: a saved problem, starter code, language and timer length (see server/routes/kitRoutes.js).
async function call(path, { method = "GET", body } = {}) {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const res = await fetch(`${getBackendUrl()}/api${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}

export const listKits = () => call("/kits");
export const createKit = (body) => call("/kits", { method: "POST", body });
export const updateKit = (id, body) => call(`/kits/${id}`, { method: "PUT", body });
export const deleteKit = (id) => call(`/kits/${id}`, { method: "DELETE" });
