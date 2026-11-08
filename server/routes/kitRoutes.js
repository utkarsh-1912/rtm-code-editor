// Session kits: a saved problem, starter code, language and timer length. Apply one in any room,
// or attach it to a booking link or a scheduled call so the room is ready when people arrive.
const express = require('express');
const router = express.Router();
const { sql } = require('../repositories/DatabaseClient');
const { requireUser } = require('../security/access');
const { LANGS } = (() => { try { return { LANGS: require('../../src/shared/languages.json').languages.map((l) => l.id) }; } catch { return { LANGS: [] }; } })();

const MAX_KITS = 50;

function readKit(b, base = {}) {
    const pick = (k, fb) => (b[k] !== undefined ? b[k] : fb);
    const title = String(pick('title', base.title) || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const language = String(pick('language', base.language) || 'javascript');
    const timerMin = Math.min(240, Math.max(0, Math.round(Number(pick('timerMin', base.timer_min)) || 0)));
    return {
        title, timerMin,
        language: LANGS.includes(language) ? language : 'javascript',
        problem: String(pick('problem', base.problem) || '').slice(0, 20 * 1024),
        code: String(pick('code', base.code) || '').slice(0, 100 * 1024),
        error: !title ? 'Give the kit a name.' : null,
    };
}

const view = (k) => ({ id: k.id, title: k.title, problem: k.problem, language: k.language, code: k.code, timerMin: k.timer_min, updatedAt: k.updated_at });

// A kit the user owns (null otherwise). Used by booking links and scheduling too.
async function kitFor(uid, id) {
    if (!uid || !id) return null;
    return (await sql`SELECT * FROM session_kits WHERE id = ${Number(id) || 0} AND owner_uid = ${uid}`)[0] || null;
}

router.get('/kits', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        res.json((await sql`SELECT * FROM session_kits WHERE owner_uid = ${me.uid} ORDER BY updated_at DESC`).map(view));
    } catch (err) { res.status(500).json({ error: 'Could not load your kits.' }); }
});

router.post('/kits', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        const f = readKit(req.body || {});
        if (f.error) return res.status(400).json({ error: f.error });
        const n = (await sql`SELECT COUNT(*)::int n FROM session_kits WHERE owner_uid = ${me.uid}`)[0].n;
        if (n >= MAX_KITS) return res.status(400).json({ error: `You can keep up to ${MAX_KITS} kits.` });
        const row = (await sql`
            INSERT INTO session_kits (owner_uid, title, problem, language, code, timer_min)
            VALUES (${me.uid}, ${f.title}, ${f.problem}, ${f.language}, ${f.code}, ${f.timerMin}) RETURNING *
        `)[0];
        res.json(view(row));
    } catch (err) { res.status(500).json({ error: 'Could not save the kit.' }); }
});

router.put('/kits/:id', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        const base = await kitFor(me.uid, req.params.id);
        if (!base) return res.status(404).json({ error: 'Kit not found.' });
        const f = readKit(req.body || {}, base);
        if (f.error) return res.status(400).json({ error: f.error });
        const row = (await sql`
            UPDATE session_kits SET title = ${f.title}, problem = ${f.problem}, language = ${f.language}, code = ${f.code},
                timer_min = ${f.timerMin}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${base.id} RETURNING *
        `)[0];
        res.json(view(row));
    } catch (err) { res.status(500).json({ error: 'Could not save the kit.' }); }
});

router.delete('/kits/:id', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        const rows = await sql`DELETE FROM session_kits WHERE id = ${Number(req.params.id) || 0} AND owner_uid = ${me.uid} RETURNING id`;
        res.status(rows.length ? 200 : 404).json(rows.length ? { success: true } : { error: 'Kit not found.' });
    } catch (err) { res.status(500).json({ error: 'Could not delete the kit.' }); }
});

module.exports = router;
module.exports.kitFor = kitFor;
