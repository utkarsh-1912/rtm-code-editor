// One id per page load. Sent with every room join so the server can drop stale sockets
// from this same page (reconnects, effect re-runs) instead of showing you twice.
// A new tab or a reload gets a new id, so separate tabs still count as separate people.
const make = () => {
    try {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    } catch { /* fall through */ }
    return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const CLIENT_ID = make();
