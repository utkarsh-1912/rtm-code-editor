// Who is on the other end of a socket: verifies a sign-in ID token (sent by the client when it
// joins) and caches the answer for a few minutes. Without a valid token the person is a guest,
// whatever user id the client claims.
const { verifyFirebaseUser } = require('./BillingService');

const TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // token -> { at, who }

async function lookup(token) {
    const key = process.env.FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY;
    if (!token || !key) return null;
    try {
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const u = data.users && data.users[0];
        return u ? { uid: u.localId, email: String(u.email || '').toLowerCase() || null } : null;
    } catch {
        return null;
    }
}

async function verifyToken(token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return null;
    const hit = cache.get(token);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.who;
    const who = await lookup(token);
    cache.set(token, { at: Date.now(), who });
    if (cache.size > 2000) {
        for (const [k, v] of cache) if (Date.now() - v.at > TTL_MS) cache.delete(k);
    }
    return who;
}

module.exports = { verifyToken, verifyFirebaseUser };
