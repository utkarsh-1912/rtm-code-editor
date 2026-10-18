import { getBackendUrl } from "./api";

// Funnel events (see docs/MARKETING_PLAN.md). Fire and forget: tracking never blocks or breaks the app.
export function track(type, { userId, roomId, projectId, ...metadata } = {}) {
    try {
        fetch(`${getBackendUrl()}/api/analytics/event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, userId, roomId, projectId, metadata }),
            keepalive: true,
        }).catch(() => { });
    } catch { /* ignore */ }
}
