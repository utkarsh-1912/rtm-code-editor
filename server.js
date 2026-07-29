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

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

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

// Router Tier Gateway Mounting
app.use('/api', authRoutes);
app.use('/api', projectRoutes);
app.use('/api', orgRoutes);
app.use('/api', snippetRoutes);
app.use('/api', notificationRoutes);
app.use('/api', systemRoutes);

// Serve static React build files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Initialize WebSockets Tier
initializeSockets(io);

// Server Entry Point
const startServer = async () => {
  try {
    await initializeSchema();
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`===========================================`);
      console.log(`Utkristi Colabs Enterprise Node Running on port ${PORT}`);
      console.log(`===========================================`);
    });
  } catch (err) {
    console.error("CRITICAL Initialization Error:", err);
    process.exit(1);
  }
};

startServer();
