const express = require('express');
const router = express.Router();
const { sql } = require('../repositories/DatabaseClient');
const health = require('../health');
const runner = require('../runner/index');
const OneSignal = require('../services/OneSignalService');

// Public status of every part of the service, as users see it (no vendor names). Checks that
// call other services are cached so this endpoint can't be used to hammer them.
const TTL_MS = 60 * 1000;
let cached = null;

const timeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };

async function timed(fn) {
    const t0 = Date.now();
    try {
        const r = await fn();
        return { ...r, ms: Date.now() - t0 };
    } catch (err) {
        return { state: 'down', detail: err.name === 'AbortError' ? 'Not responding' : 'Unreachable', ms: Date.now() - t0 };
    }
}

// HTTP check: ok on 2xx, degraded on 429/5xx, down otherwise.
async function httpCheck(url, init = {}) {
    const res = await fetch(url, { ...init, signal: timeout(6000) });
    if (res.ok) return { state: 'ok' };
    if (res.status === 429 || res.status >= 500) return { state: 'degraded', detail: 'Slow or busy' };
    return { state: 'down', detail: 'Not accepting requests' };
}

const off = (detail) => async () => ({ state: 'off', detail });

const CHECKS = [
    {
        id: 'api', name: 'API', what: 'Accounts, rooms, projects and saving',
        run: async () => ({ state: 'ok' }),
    },
    {
        id: 'database', name: 'Storage', what: 'Saving your code, chat and files',
        run: async () => {
            if (health.db !== 'ready') return { state: health.db === 'starting' ? 'degraded' : 'down', detail: health.db === 'starting' ? 'Starting up' : 'Unavailable' };
            await sql`SELECT 1`;
            return { state: 'ok' };
        },
    },
    {
        id: 'realtime', name: 'Live collaboration', what: 'Typing together, chat, cursors and calls',
        run: async (io) => ({ state: io ? 'ok' : 'down', detail: io ? `${io.engine?.clientsCount ?? 0} connected` : 'Not running' }),
    },
    {
        id: 'runner', name: 'Code runner', what: 'Running code in rooms and projects',
        run: async () => {
            const info = runner.info();
            if (!info.engines?.length) return { state: 'down', detail: 'No runner available' };
            if (process.env.JUDGE0_URL) {
                const r = await httpCheck(`${process.env.JUDGE0_URL.replace(/\/$/, '')}/about`, process.env.JUDGE0_AUTH_TOKEN ? { headers: { 'X-Auth-Token': process.env.JUDGE0_AUTH_TOKEN } } : {});
                if (r.state !== 'ok' && info.engines.length > 1) return { state: 'degraded', detail: 'Running on backup' };
                if (r.state !== 'ok') return r;
            }
            return { state: 'ok', detail: `${info.languages?.length || 0} languages` };
        },
    },
    {
        id: 'ai', name: 'AI copilot', what: 'Explain, refactor, fix and write tests',
        run: async () => {
            if (process.env.LLM_BASE_URL) {
                return httpCheck(`${process.env.LLM_BASE_URL.replace(/\/$/, '')}/models`, process.env.LLM_API_KEY ? { headers: { authorization: `Bearer ${process.env.LLM_API_KEY}` } } : {});
            }
            if (!process.env.GEMINI_API_KEY) return { state: 'off', detail: 'Not set up' };
            return httpCheck('https://generativelanguage.googleapis.com/v1beta/openai/models', { headers: { authorization: `Bearer ${process.env.GEMINI_API_KEY}` } });
        },
    },
    {
        id: 'email', name: 'Email', what: 'Invites, meeting invitations and reminders',
        run: async () => {
            if (process.env.BREVO_API_KEY) return httpCheck('https://api.brevo.com/v3/account', { headers: { 'api-key': process.env.BREVO_API_KEY, accept: 'application/json' } });
            if (OneSignal.configured() || process.env.RESEND_API_KEY) return { state: 'ok', detail: 'Backup sender' };
            return { state: 'off', detail: 'Not set up' };
        },
    },
    {
        id: 'push', name: 'Notifications', what: 'Alerts on your devices',
        run: async () => (OneSignal.configured() ? { state: 'ok' } : { state: 'off', detail: 'Not set up' }),
    },
    {
        id: 'auth', name: 'Sign-in', what: 'Signing in with Google, GitHub or email',
        run: async () => {
            const key = process.env.FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY;
            if (!key) return { state: 'off', detail: 'Not set up' };
            // A lookup with no token is rejected (400) when the service is up.
            const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: timeout(6000) });
            return res.status === 400 || res.ok ? { state: 'ok' } : res.status >= 500 ? { state: 'degraded', detail: 'Slow or busy' } : { state: 'down', detail: 'Unavailable' };
        },
    },
    {
        id: 'billing', name: 'Payments', what: 'Upgrades and billing',
        run: process.env.STRIPE_SECRET_KEY
            ? () => httpCheck('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } })
            : off('Not set up'),
    },
];

router.get('/status', async (req, res) => {
    try {
        // Problems are re-checked sooner, so a blip doesn't stay on the page for a minute.
        const ttl = cached?.body.overall === 'ok' ? TTL_MS : 15 * 1000;
        if (!cached || Date.now() - cached.at > ttl) {
            const io = req.app.get('io');
            const components = await Promise.all(CHECKS.map(async (c) => ({ id: c.id, name: c.name, what: c.what, ...(await timed(() => c.run(io))) })));
            const live = components.filter((c) => c.state !== 'off');
            const overall = live.some((c) => c.state === 'down') ? (live.find((c) => c.id === 'api' || c.id === 'database')?.state === 'down' ? 'down' : 'partial') : live.some((c) => c.state === 'degraded') ? 'degraded' : 'ok';
            cached = { at: Date.now(), body: { overall, checkedAt: new Date().toISOString(), components } };
        }
        res.set('Cache-Control', 'no-store');
        res.json(cached.body);
    } catch (err) {
        res.status(500).json({ overall: 'down', components: [] });
    }
});

module.exports = router;
