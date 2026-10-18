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
const { createRunnerRouter } = require("./server/runner/router");
const health = require("./server/health");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
// Bulk file imports parse their own (larger) bodies; everything else gets 2 MB.
const jsonBody = express.json({ limit: '2mb' });
// The Stripe webhook needs the untouched raw body to verify its signature.
app.use((req, res, next) => (req.path.endsWith('/files/bulk') || req.path === '/api/billing/webhook' ? next() : jsonBody(req, res, next)));

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

// Serve static React build files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Initialize WebSockets Tier
initializeSockets(io);

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
