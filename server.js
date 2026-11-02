const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const { initializeSchema } = require("./server/repositories/DatabaseClient");
const { initializeSockets } = require("./server/sockets/SocketManager");

const authRoutes = require("./server/routes/authRoutes");
const projectRoutes = require("./server/routes/projectRoutes");
const orgRoutes = require("./server/routes/orgRoutes");
const snippetRoutes = require("./server/routes/snippetRoutes");
const notificationRoutes = require("./server/routes/notificationRoutes");
const systemRoutes = require("./server/routes/systemRoutes");
const aiRoutes = require("./server/routes/aiRoutes");
const snapshotRoutes = require("./server/routes/snapshotRoutes");
const analyticsRoutes = require("./server/routes/analyticsRoutes");
const billingRoutes = require("./server/routes/billingRoutes");
const githubRoutes = require("./server/routes/githubRoutes");
const { createRunnerRouter } = require("./server/runner/router");
const health = require("./server/health");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Notice dead connections (closed laptop, lost Wi-Fi) within ~18s instead of ~45s,
  // so they leave the people list promptly.
  pingInterval: 10000,
  pingTimeout: 8000,
});
app.set('io', io); // routes can notify rooms (e.g. a rename)

// Middleware
app.use(cors());
// Bulk file imports and GitHub pushes parse their own (larger) bodies; everything else gets 2 MB.
const jsonBody = express.json({ limit: '2mb' });
// The Stripe webhook needs the untouched raw body to verify its signature.
app.use((req, res, next) => (req.path.endsWith('/files/bulk') || req.path.startsWith('/api/github/') || req.path === '/api/billing/webhook' ? next() : jsonBody(req, res, next)));

// Security headers on every response (the app is served from here in production).
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Permissions-Policy': 'camera=(self), microphone=(self), display-capture=(self), geolocation=()',
  });
  if (process.env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Rate limits (per client address; behind one proxy the last X-Forwarded-For entry is the client).
const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean).pop() || req.socket.remoteAddress || '?';
function limiter(name, max, windowMs) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v.at > windowMs) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const key = clientIp(req);
    const now = Date.now();
    const h = hits.get(key);
    if (!h || now - h.at > windowMs) { hits.set(key, { at: now, n: 1 }); return next(); }
    if (++h.n > max) { res.set('Retry-After', String(Math.ceil((h.at + windowMs - now) / 1000))); return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' }); }
    next();
  };
}
app.use('/api', limiter('api', 600, 60 * 1000));
app.use('/api/support', limiter('support', 5, 60 * 60 * 1000));
app.use(/^\/api\/projects\/[^/]+\/invite$/, limiter('invite', 30, 60 * 60 * 1000));
app.use('/api/user/sync', limiter('sync', 30, 60 * 1000));

// Who is calling (verified sign-in), and requests that name a user must be that user.
const { attachUser, enforceClaimedUser } = require('./server/security/access');
app.use('/api', attachUser, enforceClaimedUser);

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`[SVR] ${req.method} ${req.url}`);
  next();
});

// Malformed JSON Error Handling
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error("[JSON Error] Malformed request body caught.");
    return res.status(400).json({ error: "Malformed JSON", detail: err.message });
  }
  next();
});

// Health first so it answers even while the database is still starting
app.get('/api/ping', (req, res) => res.json({ success: true, message: 'pong', db: health.db, uptime: Math.round(process.uptime()) }));
// Code runner has no database dependency
app.use('/api', createRunnerRouter());

// Router Tier Gateway Mounting
app.use('/api', authRoutes);
app.use('/api', projectRoutes);
app.use('/api', orgRoutes);
app.use('/api', snippetRoutes);
app.use('/api', notificationRoutes);
app.use('/api', systemRoutes);
app.use('/api', aiRoutes);
app.use('/api', snapshotRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', billingRoutes);
app.use('/api', require('./server/routes/meetingRoutes'));
app.use('/api', require('./server/routes/statusRoutes'));
app.use('/api', githubRoutes);

// Serve static React build files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Initialize WebSockets Tier
initializeSockets(io);
// Hourly housekeeping: idle guest rooms (after GUEST_ROOM_TTL_HOURS, default 6), old sessions.
require("./server/jobs/cleanup").startCleanupJob(io, require("./server/sockets/SocketManager").roomState);
// Meeting reminders: a nudge about 10 minutes before a scheduled call.
require("./server/jobs/reminders").startReminderJob(io);
if (process.env.NODE_ENV === 'production' && process.env.RUNNER_LOCAL === '1') {
  console.warn('SECURITY: RUNNER_LOCAL=1 runs visitor code directly on this server (no sandbox). Anyone can read its files and secrets. Use Judge0 or an isolated runner in production.');
}

// Server Entry Point: listen right away (so health checks, the runner and sockets work
// on a cold start) and bring the database up in the background with retries.
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Utkristi CoLabs API listening on port ${PORT}`);
});

const initDatabase = async (attempt = 1) => {
  health.db = "starting";
  try {
    await initializeSchema();
    health.db = "ready";
    console.log("Database ready");
  } catch (err) {
    health.db = "error";
    const wait = Math.min(30000, 2000 * attempt);
    console.error(`Database init failed (attempt ${attempt}), retrying in ${wait / 1000}s:`, err.message);
    setTimeout(() => initDatabase(attempt + 1), wait);
  }
};
initDatabase();
