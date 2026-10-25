const RoomRepository = require('../repositories/RoomRepository');
const { verifyToken } = require('../services/Identity');

// Room access for sockets: verified identity per socket, cached access settings per room,
// people waiting to be let in ("knocks") and one-off approvals.
//
// public  anyone with the link joins
// invite  others ask to join; the owner lets them in (once, or always by email)
// private only the owner and invited emails, signed in
function createRoomAccess(io) {
    const identity = {}; // socketId -> { uid, email } | null (verified, never taken from the client)
    const cache = new Map(); // roomId -> access | null
    const knocks = new Map(); // roomId -> Map(socketId -> { name, email, clientId })
    const grants = new Map(); // roomId -> Set(clientId or socketId) let in by the owner

    async function load(roomId) {
        if (cache.has(roomId)) return cache.get(roomId);
        try {
            const access = await RoomRepository.getRoomAccess(roomId);
            cache.set(roomId, access);
            return access;
        } catch (err) {
            console.error('Room access unavailable:', err.message);
            return null;
        }
    }

    const set = (roomId, access) => cache.set(roomId, access);
    const forget = (roomId) => cache.delete(roomId);

    async function identify(socket, idToken) {
        const who = idToken ? await verifyToken(idToken) : null;
        identity[socket.id] = who;
        return who;
    }

    const whoIs = (socketId) => identity[socketId] || null;
    const isOwner = (access, socketId) => !!access?.ownerUid && whoIs(socketId)?.uid === access.ownerUid;

    function mayEnter(roomId, access, socket, clientId) {
        if (!access || access.visibility === 'public') return true;
        const who = whoIs(socket.id);
        if (who && (who.uid === access.ownerUid || (who.email && access.allowed.includes(who.email)))) return true;
        const g = grants.get(roomId);
        return !!g && (g.has(clientId) || g.has(socket.id));
    }

    // Owners currently in the room (their sockets).
    function ownerSockets(roomId, access) {
        return [...(io.sockets.adapter.rooms.get(roomId) || [])].filter((id) => isOwner(access, id));
    }

    function knock(roomId, access, socket, { name, clientId }) {
        if (!knocks.has(roomId)) knocks.set(roomId, new Map());
        const who = whoIs(socket.id);
        const request = { socketId: socket.id, name: String(name || 'Guest').slice(0, 40), email: who?.email || null, clientId: clientId || null };
        knocks.get(roomId).set(socket.id, request);
        const owners = ownerSockets(roomId, access);
        owners.forEach((id) => io.to(id).emit('room-knock', request));
        return owners.length > 0;
    }

    function pendingFor(roomId) {
        return [...(knocks.get(roomId)?.values() || [])];
    }

    function answer(roomId, socketId, allow) {
        const request = knocks.get(roomId)?.get(socketId);
        if (!request) return null;
        knocks.get(roomId).delete(socketId);
        if (allow) {
            if (!grants.has(roomId)) grants.set(roomId, new Set());
            grants.get(roomId).add(request.clientId || socketId);
            grants.get(roomId).add(socketId);
        }
        return request;
    }

    // A socket left: drop its identity and any knock it had open (tell the owners).
    function drop(socket) {
        for (const [roomId, map] of knocks) {
            if (map.delete(socket.id)) {
                const access = cache.get(roomId);
                ownerSockets(roomId, access).forEach((id) => io.to(id).emit('room-knock-gone', { socketId: socket.id }));
            }
        }
        delete identity[socket.id];
    }

    return { load, set, forget, identify, whoIs, isOwner, mayEnter, knock, pendingFor, answer, drop };
}

module.exports = { createRoomAccess };
