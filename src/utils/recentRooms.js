// Rooms opened on this device, newest first (for the desktop start screen).
const KEY = "recent-rooms";

export function recentRooms() {
    try {
        const list = JSON.parse(localStorage.getItem(KEY)) || [];
        return Array.isArray(list) ? list.filter((r) => r && typeof r.id === "string") : [];
    } catch {
        return [];
    }
}

export function rememberRoom(id, language) {
    if (!id) return;
    try {
        const rest = recentRooms().filter((r) => r.id !== id);
        localStorage.setItem(KEY, JSON.stringify([{ id, language: language || "", at: Date.now() }, ...rest].slice(0, 8)));
    } catch { /* storage blocked */ }
}

export function forgetRoom(id) {
    try {
        localStorage.setItem(KEY, JSON.stringify(recentRooms().filter((r) => r.id !== id)));
    } catch { /* storage blocked */ }
}
