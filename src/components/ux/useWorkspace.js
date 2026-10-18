import { useCallback, useEffect, useState } from "react";
import { getBackendUrl } from "../../utils/api";

// Rooms, projects and usage stats for the signed-in user.
export default function useWorkspace(user) {
    const [rooms, setRooms] = useState([]);
    const [projects, setProjects] = useState([]);
    const [stats, setStats] = useState({ totalRooms: 0, sessions: 0, hours: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        if (!user?.uid) return;
        const backendUrl = getBackendUrl();
        try {
            const [dashRes, projRes] = await Promise.all([
                fetch(`${backendUrl}/api/user-dashboard?userId=${user.uid}`),
                fetch(`${backendUrl}/api/projects?userId=${user.uid}`),
            ]);
            if (!dashRes.ok) throw new Error(`Dashboard API error: ${dashRes.status}`);
            if (!projRes.ok) throw new Error(`Projects API error: ${projRes.status}`);
            const dash = await dashRes.json();
            const proj = await projRes.json();
            setRooms(Array.isArray(dash.rooms) ? dash.rooms : []);
            setStats(dash.stats || { totalRooms: 0, sessions: 0, hours: 0 });
            setProjects(Array.isArray(proj) ? proj : []);
            setError(null);
        } catch (err) {
            console.error("Workspace fetch error:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [user?.uid]);

    useEffect(() => { reload(); }, [reload]);

    return { rooms, projects, stats, loading, error, reload };
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
