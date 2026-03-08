const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const ACTIONS = require("./src/Action");
const db = require("./src/db");
const cors = require("cors");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static("build"));

// API Routes
app.get("/api/ping", (req, res) => {
  res.json({ success: true, message: "pong" });
});

// API Routes
app.get("/api/user-dashboard", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    const dashboardData = await db.getUserDashboard(userId);
    res.json(dashboardData);
  } catch (err) {
    console.error("Dashboard API Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/api/remove-room", async (req, res) => {
  try {
    const { userId, roomId } = req.body;
    if (!userId || !roomId) return res.status(400).json({ error: "Missing required fields" });

    await db.unlinkRoomFromUser(userId, roomId);
    res.json({ success: true, message: "Room removed from workspace" });
  } catch (err) {
    console.error("Delete API Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/api/rename-room", async (req, res) => {
  try {
    const { roomId, newName } = req.body;
    if (!roomId || !newName) return res.status(400).json({ error: "Missing required fields" });

    await db.updateRoomName(roomId, newName);
    res.json({ success: true, message: "Room renamed successfully" });
  } catch (err) {
    console.error("Rename API Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Snippets API
 */
app.get("/api/snippets", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    const snippets = await db.getSnippets(userId);
    res.json(snippets);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch snippets" });
  }
});

app.post("/api/snippets", async (req, res) => {
  try {
    const { userId, title, code, language } = req.body;
    const snippet = await db.createSnippet(userId, title, code, language);
    res.json(snippet[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create snippet" });
  }
});

app.put("/api/snippets/:id", async (req, res) => {
  try {
    const { title, code, language } = req.body;
    const snippet = await db.updateSnippet(req.params.id, title, code, language);
    res.json(snippet[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update snippet" });
  }
});

app.delete("/api/snippets/:id", async (req, res) => {
  try {
    await db.deleteSnippet(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete snippet" });
  }
});

/**
 * Search API
 */
app.get("/api/search", async (req, res) => {
  try {
    const { q, userId } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    if (!q) return res.json({ rooms: [], snippets: [] });

    const results = await db.searchAll(userId, q);
    res.json(results);
  } catch (err) {
    console.error("Search API Error:", err);
    res.status(500).json({ error: "Failed to search" });
  }
});

/**
 * Notifications API
 */
app.get("/api/notifications", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    const notifications = await db.getNotifications(userId);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

app.put("/api/notifications/read", async (req, res) => {
  try {
    const { userId } = req.body;
    await db.markNotificationsRead(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

app.delete("/api/notifications", async (req, res) => {
  try {
    const { userId } = req.query;
    await db.clearNotifications(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear notifications" });
  }
});

app.delete("/api/notifications/:id", async (req, res) => {
  try {
    await db.deleteNotification(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

/**
 * Sessions API
 */
app.get("/api/sessions", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    const sessions = await db.getSessions(userId);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

app.post("/api/sessions", async (req, res) => {
  try {
    const { userId, device, ip, userAgent } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    const session = await db.createSession(userId, { device, ip, userAgent });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: "Failed to create session" });
  }
});

app.delete("/api/sessions/others", async (req, res) => {
  try {
    const { userId, currentSessionId } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    await db.deleteOtherSessions(userId, currentSessionId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to sign out other devices" });
  }
});

app.use((req, res, next) => {
  res.sendFile(__dirname + "/build/index.html");
});

const userSocketMap = {};
const roomChatHistory = {};

const getAllClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        userName: userSocketMap[socketId],
      };
    }
  );
};

io.on("connection", (socket) => {
  console.log("Connected Socket : ", socket.id);
  socket.on(ACTIONS.JOIN, async ({ roomId, userName, userProfile }) => {
    userSocketMap[socket.id] = userName;
    socket.join(roomId);

    // Load or Initialize Room from DB first
    let dbRoom;
    try {
      dbRoom = await db.getRoom(roomId);
      if (dbRoom) {
        // Load chat history into memory if needed
        if (!roomChatHistory[roomId]) {
          roomChatHistory[roomId] = dbRoom.chat_history || [];
        }
        // Send existing code and language to the joining user
        if (dbRoom.code !== null) {
          socket.emit(ACTIONS.CODE_CHANGE, { code: dbRoom.code });
        }
        if (dbRoom.language) {
          socket.emit(ACTIONS.SYNC_LANGUAGE, { language: dbRoom.language });
        }
      } else {
        // New room, create entry
        await db.saveRoom(roomId, "", "javascript", []);
      }
    } catch (err) {
      console.error("DB Room Init Error:", err);
    }

    // Now that we're sure the room exists in DB, handle user link
    if (userProfile && userProfile.uid) {
      try {
        await db.findOrCreateUser(userProfile);
        await db.linkRoomToUser(userProfile.uid, roomId);
      } catch (err) {
        console.error("User Persistence Error:", err);
      }
    }

    const clients = getAllClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        userName: userName,
        socketId: socket.id,
      });
    });

    // Sync chat history to the joining user
    const history = roomChatHistory[roomId] || (dbRoom && dbRoom.chat_history) || [];
    if (history.length > 0) {
      socket.emit(ACTIONS.SYNC_CHAT, {
        messages: history,
      });
    }
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    // Save to DB asynchronously
    db.updateRoomCode(roomId, code).catch(err => console.error("DB Code Update Error:", err));
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.LEAVE, ({ roomId }) => {
    socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
      socketId: socket.id,
      userName: userSocketMap[socket.id],
    });
    socket.leave(roomId);

    // Clean up memory if room is empty
    const remaining = getAllClients(roomId);
    if (remaining.length === 0) {
      delete roomChatHistory[roomId];
    }
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      // socket.rooms includes the socket.id itself, skip it
      if (roomId === socket.id) return;

      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        userName: userSocketMap[socket.id],
      });

      // Clean up room history if empty
      const remaining = getAllClients(roomId);
      if (remaining.length <= 1) { // 1 because current socket hasn't fully left yet
        delete roomChatHistory[roomId];
      }
    });

    delete userSocketMap[socket.id];
  });

  // Handle chat messages
  socket.on(ACTIONS.SEND_MESSAGE, ({ roomId, message }) => {
    if (!roomChatHistory[roomId]) roomChatHistory[roomId] = [];
    roomChatHistory[roomId].push(message);
    if (roomChatHistory[roomId].length > 50) roomChatHistory[roomId].shift(); // Cap history

    socket.in(roomId).emit(ACTIONS.RECEIVE_MESSAGE, message);

    // Save to DB
    db.updateRoomChat(roomId, roomChatHistory[roomId]).catch(err => console.error("DB Chat Update Error:", err));
  });

  socket.on(ACTIONS.EDIT_MESSAGE, ({ roomId, messageId, newText }) => {
    if (roomChatHistory[roomId]) {
      roomChatHistory[roomId] = roomChatHistory[roomId].map(m =>
        m.id === messageId ? { ...m, text: newText, isEdited: true } : m
      );
    }
    socket.in(roomId).emit(ACTIONS.EDIT_MESSAGE, { messageId, newText });
  });

  socket.on(ACTIONS.DELETE_MESSAGE, ({ roomId, messageId }) => {
    if (roomChatHistory[roomId]) {
      roomChatHistory[roomId] = roomChatHistory[roomId].filter(m => m.id !== messageId);
    }
    socket.in(roomId).emit(ACTIONS.DELETE_MESSAGE, { messageId });
  });

  // Handle execution sync
  socket.on(ACTIONS.SYNC_EXECUTE, ({ roomId, isExecuting }) => {
    socket.in(roomId).emit(ACTIONS.SYNC_EXECUTE, { isExecuting });
  });

  socket.on(ACTIONS.SYNC_OUTPUT, ({ roomId, output, isError, time }) => {
    socket.in(roomId).emit(ACTIONS.SYNC_OUTPUT, { output, isError, time });
  });

  socket.on(ACTIONS.SYNC_LANGUAGE, ({ roomId, language }) => {
    socket.in(roomId).emit(ACTIONS.SYNC_LANGUAGE, { language });
    // Save to DB
    db.updateRoomLanguage(roomId, language).catch(err => console.error("DB Language Update Error:", err));
  });

  socket.on(ACTIONS.CURSOR_MOVE, ({ roomId, cursor, userName }) => {
    socket.in(roomId).emit(ACTIONS.CURSOR_MOVE, { cursor, userName, socketId: socket.id });
  });
});

// Initialize Database & Start Server
const startServer = async () => {
  try {
    await db.initializeSchema();

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Running at port ${PORT}`);
    });
  } catch (err) {
    console.error("CRITICAL: Failed to initialize server:", err);
    process.exit(1);
  }
};

startServer();
