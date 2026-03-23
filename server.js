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
    const { userId, orgId } = req.query;
    if (orgId) {
      const snippets = await db.getOrgSnippets(orgId);
      return res.json(snippets);
    }
    if (!userId) return res.status(400).json({ error: "User ID required" });
    const snippets = await db.getSnippets(userId);
    res.json(snippets);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch snippets" });
  }
});

app.post("/api/snippets", async (req, res) => {
  try {
    const { userId, title, code, language, tags, organizationId } = req.body;
    const snippet = await db.createSnippet(userId, title, code, language, tags, organizationId);
    res.json(snippet[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create snippet" });
  }
});

app.put("/api/snippets/:id", async (req, res) => {
  try {
    const { title, code, language, tags } = req.body;
    const snippet = await db.updateSnippet(req.params.id, title, code, language, tags);
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
 * Organizations API
 */
app.post("/api/organizations", async (req, res) => {
  try {
    const { userId, name } = req.body;
    const org = await db.createOrganization(userId, name);
    res.json(org);
  } catch (err) {
    res.status(500).json({ error: "Failed to create organization" });
  }
});

app.get("/api/organizations", async (req, res) => {
  try {
    const { userId } = req.query;
    const orgs = await db.getOrganizations(userId);
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

app.post("/api/organizations/:id/members", async (req, res) => {
  try {
    const { email, role } = req.body;
    const member = await db.addOrgMember(req.params.id, email, role);
    res.json(member);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to add member" });
  }
});

app.get("/api/organizations/:id/members", async (req, res) => {
  try {
    const members = await db.getOrgMembers(req.params.id);
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

app.delete("/api/organizations/:id", async (req, res) => {
  try {
    await db.deleteOrganization(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete team" });
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

app.get("/api/user/profile", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    const user = await db.getUser(userId);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

app.delete("/api/user", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    await db.deleteAccount(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete account" });
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
    const { userId, device: clientDevice, userAgent: clientUA, sessionId } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    // Better IP detection
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    if (ip === '::1' || ip === '127.0.0.1') ip = 'Localhost';

    // Better User-Agent detection
    const ua = req.headers['user-agent'] || clientUA || 'Unknown Device';

    // Premium device parsing
    let device = 'Other Device';
    if (ua.includes('Windows')) device = 'Windows PC';
    else if (ua.includes('Macintosh')) device = 'MacBook';
    else if (ua.includes('Linux')) device = 'Linux Machine';
    else if (ua.includes('iPhone')) device = 'iPhone';
    else if (ua.includes('Android')) device = 'Android';

    const session = await db.createSession(userId, { device, ip, userAgent: ua, sessionId });
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

/**
 * Projects API
 */
app.post("/api/projects", async (req, res) => {
  try {
    const { userId, name, description, type } = req.body;
    const project = await db.createProject(userId, name, description, type);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: "Failed to create project" });
  }
});

app.get("/api/projects", async (req, res) => {
  try {
    const { userId } = req.query;
    const projects = await db.getProjects(userId);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    const project = await db.getProject(req.params.id);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

app.get("/api/projects/:id/files", async (req, res) => {
  try {
    const files = await db.getProjectFiles(req.params.id);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch project files" });
  }
});

app.post("/api/projects/:id/files", async (req, res) => {
  try {
    const { name, path, content, isDirectory } = req.body;
    const file = await db.upsertProjectFile(req.params.id, name, path, content, isDirectory);
    res.json(file[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to save file" });
  }
});

app.delete("/api/projects/:id/files", async (req, res) => {
  try {
    const { path } = req.query;
    await db.deleteProjectFile(req.params.id, path);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete file" });
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    await db.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

app.use((req, res, next) => {
  res.sendFile(__dirname + "/build/index.html");
});

const userSocketMap = {};
const roomChatHistory = {};
const roomWhiteboardState = {}; // In-memory whiteboard state per room

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
        await db.updateLastRoom(userProfile.uid, roomId);
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

    // Create Notification for others
    if (userName && userName !== "Guest") {
      const clients = getAllClients(roomId);
      clients.forEach(client => {
        if (client.socketId !== socket.id) {
          db.getUser(userSocketMap[client.socketId]).then(u => {
            if (u) db.createNotification(u.auth_provider_id, 'join', `${userName} joined the workspace`);
          }).catch(() => { });
        }
      });
    }
  });

  socket.on(ACTIONS.PROJECT_JOIN, async ({ projectId, userName }) => {
    const roomId = `project-${projectId}`;
    userSocketMap[socket.id] = userName;
    socket.join(roomId);

    console.log(`User ${userName} joined project room: ${roomId}`);

    // Bug 5: Send current file contents to the new joiner
    try {
      const files = await db.getProjectFiles(projectId);
      if (files && files.length > 0) {
        files.forEach(file => {
          socket.emit(ACTIONS.FILE_CHANGE, {
            fileId: file.id,
            path: file.path,
            content: file.content,
            socketId: 'server' // Mark as server-origin so editor doesn't echo it
          });
        });
      }
    } catch (err) {
      console.error("Project file sync error:", err);
    }

    // Bug 8: Send chat history to the new joiner
    const chatHistory = roomChatHistory[roomId] || [];
    if (chatHistory.length > 0) {
      socket.emit(ACTIONS.SYNC_CHAT, { messages: chatHistory });
    }

    // Bug 6: Send current whiteboard state to the new joiner
    const wbState = roomWhiteboardState[roomId];
    if (wbState && wbState.length > 0) {
      socket.emit(ACTIONS.WHITEBOARD_SYNC, { elements: wbState });
    }

    const clients = getAllClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        userName,
        socketId: socket.id,
      });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    // Save to DB asynchronously
    db.updateRoomCode(roomId, code).catch(err => console.error("DB Code Update Error:", err));
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.LEAVE, async ({ roomId }) => {
    socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
      socketId: socket.id,
      userName: userSocketMap[socket.id],
    });
    socket.leave(roomId);

    // Clean up memory if room is empty
    const remaining = getAllClients(roomId);
    if (remaining.length === 0) {
      delete roomChatHistory[roomId];

      // Cleanup Guest Rooms (Owned by no one)
      try {
        const isGuest = await db.isRoomGuest(roomId);
        if (isGuest && !roomId.startsWith('project-')) {
          console.log(`Cleaning up empty guest room: ${roomId}`);
          await db.deleteRoomPermanently(roomId);
        }
      } catch (err) {
        console.error("Guest Room Cleanup Error:", err);
      }
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

        // Cleanup Guest Rooms (Owned by no one)
        if (remaining.length <= 1) {
          db.isRoomGuest(roomId).then(isGuest => {
            if (isGuest && !roomId.startsWith('project-')) {
              console.log(`Cleaning up abandoned guest room: ${roomId}`);
              db.deleteRoomPermanently(roomId).catch(() => { });
            }
          }).catch(() => { });
        }
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

  socket.on(ACTIONS.MOUSE_MOVE, ({ roomId, mouse, userName }) => {
    socket.in(roomId).emit(ACTIONS.MOUSE_MOVE, { mouse, userName, socketId: socket.id });
  });

  socket.on(ACTIONS.FILE_CHANGE, ({ roomId, fileId, path, content }) => {
    socket.in(roomId).emit(ACTIONS.FILE_CHANGE, { fileId, path, content });
  });

  socket.on(ACTIONS.MEDIA_STATE_CHANGE, ({ roomId, state }) => {
    // Bug 4: emit the same event name the client listens for (ACTIONS.MEDIA_STATE_CHANGE)
    socket.in(roomId).emit(ACTIONS.MEDIA_STATE_CHANGE, { userId: socket.id, state });
  });

  socket.on(ACTIONS.FOLLOW_MODE, ({ roomId, viewState, userName }) => {
    socket.in(roomId).emit(ACTIONS.FOLLOW_MODE, { viewState, userName });
  });

  socket.on(ACTIONS.WHITEBOARD_DRAW, (data) => {
    const { roomId, action, payload } = data;
    // Bug 6: Persist whiteboard state server-side
    if (!roomWhiteboardState[roomId]) roomWhiteboardState[roomId] = [];
    if (action === 'ADD') {
      roomWhiteboardState[roomId].push(payload);
    } else if (action === 'CLEAR') {
      roomWhiteboardState[roomId] = [];
    } else if (action === 'UNDO' || action === 'REDO') {
      // Sync by replacing full elements array
      if (payload && payload.elements) roomWhiteboardState[roomId] = payload.elements;
    }
    socket.in(roomId).emit(ACTIONS.WHITEBOARD_DRAW, data);
  });

  // Bug 6: Handle whiteboard sync requests from late joiners
  socket.on(ACTIONS.WHITEBOARD_SYNC_REQUEST, ({ roomId }) => {
    const elements = roomWhiteboardState[roomId] || [];
    socket.emit(ACTIONS.WHITEBOARD_SYNC, { elements });
  });

  socket.on(ACTIONS.WHITEBOARD_CLEAR, ({ roomId }) => {
    socket.in(roomId).emit(ACTIONS.WHITEBOARD_CLEAR);
  });

  socket.on(ACTIONS.WHITEBOARD_CURSOR, ({ roomId, x, y, userName }) => {
    socket.in(roomId).emit(ACTIONS.WHITEBOARD_CURSOR, { x, y, userName, socketId: socket.id });
  });

  socket.on(ACTIONS.SYNC_SCROLL, ({ roomId, scrollPos, userName }) => {
    socket.in(roomId).emit(ACTIONS.SYNC_SCROLL, { scrollPos, userName });
  });

  // WebRTC Signaling
  socket.on('join-video-chat', ({ projectId, userId, name, isSpectator }) => {
    const roomId = `project-${projectId}`;
    socket.join(roomId);

    // Get all participants currently in this video room
    const clients = [];
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      for (const id of room) {
        if (id !== socket.id) {
          clients.push({
            userId: id,
            name: userSocketMap[id] || "Participant",
            isSpectator: false // We can refine this if needed
          });
        }
      }
    }

    // Tell the new joiner who's already there
    socket.emit('video-participants', { clients });

    // Notify others that a new user joined
    socket.to(roomId).emit('user-joined-video', { userId: socket.id, name, isSpectator });
  });

  socket.on('request-streams', ({ to }) => {
    io.to(to).emit('request-streams', { from: socket.id });
  });

  socket.on('video-offer', ({ to, offer }) => {
    io.to(to).emit('video-offer', { from: socket.id, offer });
  });

  socket.on('video-answer', ({ to, answer }) => {
    io.to(to).emit('video-answer', { from: socket.id, answer });
  });

  socket.on('new-ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('new-ice-candidate', { from: socket.id, candidate });
  });

  socket.on('leave-video-chat', ({ projectId }) => {
    const roomId = `project-${projectId}`;
    socket.leave(roomId);
    socket.to(roomId).emit('user-left-video', { userId: socket.id });
  });

  socket.on(ACTIONS.SCREEN_SHARE_START, ({ roomId }) => {
    socket.to(roomId).emit(ACTIONS.SCREEN_SHARE_START, { userId: socket.id });
  });

  socket.on(ACTIONS.SCREEN_SHARE_STOP, ({ roomId }) => {
    socket.to(roomId).emit(ACTIONS.SCREEN_SHARE_STOP, { userId: socket.id });
  });
  // Note: MEDIA_STATE_CHANGE is handled above (Bug 1: removed duplicate handler)
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
