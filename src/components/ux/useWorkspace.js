import { useCallback, useEffect, useState } from "react";
import { getBackendUrl } from "../../utils/api";

const PAGE = 100; // rows fetched per request; the table pages through them

// Rooms, projects and usage stats for the signed-in user. Rooms and projects are fetched a
// page at a time; loadMoreRooms / loadMoreProjects fetch the next page.
export default function useWorkspace(user) {
    const [rooms, setRooms] = useState([]);
    const [projects, setProjects] = useState([]);
    const [roomsTotal, setRoomsTotal] = useState(0);
    const [projectsTotal, setProjectsTotal] = useState(0);
    const [stats, setStats] = useState({ totalRooms: 0, sessions: 0, hours: 0 });
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        if (!user?.uid) return;
        const backendUrl = getBackendUrl();
        const uid = encodeURIComponent(user.uid);
        try {
            const [dashRes, roomsRes, projRes] = await Promise.all([
                fetch(`${backendUrl}/api/user-dashboard?userId=${uid}`),
                fetch(`${backendUrl}/api/rooms?userId=${uid}&limit=${PAGE}&offset=0`),
                fetch(`${backendUrl}/api/projects?userId=${uid}&limit=${PAGE}&offset=0`),
            ]);
            if (!dashRes.ok) throw new Error(`Dashboard API error: ${dashRes.status}`);
            if (!projRes.ok) throw new Error(`Projects API error: ${projRes.status}`);
            const dash = await dashRes.json();
            const proj = await projRes.json();
            // Older servers: no /api/rooms; fall back to the dashboard's recent rooms.
            const roomPage = roomsRes.ok ? await roomsRes.json() : { items: dash.rooms || [], total: (dash.rooms || []).length };
            setRooms(Array.isArray(roomPage.items) ? roomPage.items : []);
            setRoomsTotal(roomPage.total ?? 0);
            const projItems = Array.isArray(proj) ? proj : proj.items || [];
            setProjects(projItems);
            setProjectsTotal(Array.isArray(proj) ? proj.length : proj.total ?? projItems.length);
            setStats(dash.stats || { totalRooms: 0, sessions: 0, hours: 0 });
            setError(null);
        } catch (err) {
            console.error("Workspace fetch error:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [user?.uid]);

    useEffect(() => { reload(); }, [reload]);

    const loadMore = useCallback(async (kind) => {
        if (!user?.uid) return;
        const list = kind === "rooms" ? rooms : projects;
        setLoadingMore(true);
        try {
            const res = await fetch(`${getBackendUrl()}/api/${kind}?userId=${encodeURIComponent(user.uid)}&limit=${PAGE}&offset=${list.length}`);
            if (!res.ok) throw new Error(`${kind} API error: ${res.status}`);
            const page = await res.json();
            const add = (prev) => {
                const seen = new Set(prev.map((x) => String(x.id)));
                return [...prev, ...(page.items || []).filter((x) => !seen.has(String(x.id)))];
            };
            if (kind === "rooms") { setRooms(add); setRoomsTotal(page.total ?? 0); } else { setProjects(add); setProjectsTotal(page.total ?? 0); }
        } catch (err) {
            console.error("Load more failed:", err);
        } finally {
            setLoadingMore(false);
        }
    }, [user?.uid, rooms, projects]);

    return {
        rooms, projects, roomsTotal, projectsTotal, stats, loading, error, reload,
        loadingMore,
        loadMoreRooms: () => loadMore("rooms"),
        loadMoreProjects: () => loadMore("projects"),
    };
}

export const itemDate = (item) => {
    const raw = item.updatedAt || item.updated_at || item.lastActive || item.last_active || item.createdAt || item.created_at;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
};

// Rooms and projects in one list, newest first.
export const mergeActivity = (rooms, projects) => [
    ...projects.map((p) => ({ ...p, kind: "project" })),
    ...rooms.map((r) => ({ ...r, kind: "room" })),
].sort((a, b) => (itemDate(b)?.getTime() || 0) - (itemDate(a)?.getTime() || 0));
