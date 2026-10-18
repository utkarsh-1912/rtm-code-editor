const express = require("express");
const { runCode, info } = require("./index");

// Tiny per-IP limiter so a public runner cannot be hammered.
const hits = new Map();
const LIMIT = Number(process.env.RUNNER_RATE_PER_MIN) || 30;
function rateLimit(req, res, next) {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "?";
    const now = Date.now();
    const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
    if (list.length >= LIMIT) return res.status(429).json({ error: "Too many runs. Wait a minute and try again." });
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 5000) hits.clear();
    next();
}

function createRunnerRouter() {
    const router = express.Router();
    router.get("/runner", (req, res) => res.json({ success: true, ...info() }));
    router.post("/run", express.json({ limit: "256kb" }), rateLimit, async (req, res) => {
        try {
            const { language, source, stdin } = req.body || {};
            const result = await runCode({ language, source, stdin });
            res.json(result);
        } catch (err) {
            res.status(err.status || 500).json({ error: err.message });
        }
    });
    return router;
}

module.exports = { createRunnerRouter };
