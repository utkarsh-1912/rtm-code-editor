// Connect Google Calendar or Outlook (Settings > Connections). See services/CalendarSync.js.
const express = require('express');
const router = express.Router();
const CalendarSync = require('../services/CalendarSync');
const { requireUser } = require('../security/access');

const known = (p) => Object.prototype.hasOwnProperty.call(CalendarSync.PROVIDERS, p);

router.get('/calendar/connections', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        const mine = await CalendarSync.listConnections(me.uid);
        res.json(Object.entries(CalendarSync.PROVIDERS).map(([id, p]) => {
            const c = mine.find((x) => x.provider === id);
            return { id, name: p.name, configured: CalendarSync.configured(id), connected: !!c, email: c?.email || null };
        }));
    } catch (err) { res.status(500).json({ error: 'Could not load your calendars.' }); }
});

router.post('/calendar/:provider/connect', (req, res) => {
    const me = requireUser(req, res);
    if (!me) return;
    const p = req.params.provider;
    if (!known(p)) return res.status(404).json({ error: 'Unknown calendar.' });
    if (!CalendarSync.configured(p)) return res.status(503).json({ error: `${CalendarSync.PROVIDERS[p].name} isn't set up on this server yet.` });
    res.json({ url: CalendarSync.authUrl(p, me.uid) });
});

// The provider sends people back here (no sign-in header: the signed state says who it is).
router.get('/calendar/:provider/callback', async (req, res) => {
    const back = (q) => res.redirect(`${process.env.APP_URL || ""}/settings?section=connections&${new URLSearchParams(q)}`);
    try {
        const p = req.params.provider;
        if (!known(p) || !CalendarSync.configured(p)) return back({ calendar: 'error', reason: 'That calendar isn’t set up here.' });
        if (req.query.error) return back({ calendar: 'error', reason: 'Access wasn’t granted.' });
        await CalendarSync.finishConnect(p, String(req.query.code || ''), String(req.query.state || ''));
        back({ calendar: 'connected' });
    } catch (err) {
        back({ calendar: 'error', reason: String(err.message || 'Could not connect the calendar.').slice(0, 160) });
    }
});

router.delete('/calendar/:provider', async (req, res) => {
    try {
        const me = requireUser(req, res);
        if (!me) return;
        if (!known(req.params.provider)) return res.status(404).json({ error: 'Unknown calendar.' });
        await CalendarSync.disconnect(me.uid, req.params.provider);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Could not disconnect the calendar.' }); }
});

module.exports = router;
