const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { spawn } = require("child_process");
const ACTIONS = require("./src/Action");
const db = require("./src/db");
const cors = require("cors");
const https = require("https");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`[SVR] ${req.method} ${req.url}`);
  next();
});

// Catch JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error("[JSON Error] Malformed request body caught.");
    return res.status(400).json({ error: "Malformed JSON", detail: err.message });
  }
  next();
});

// Robust Fetch Relay using built-in https
const fetchRelay = async (url, body, apiKey) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const resBody = await res.text();
  return { status: res.status, body: resBody };
};

// Enterprise Email Template
const getEmailTemplate = ({ title, message, ctaText, ctaUrl, inviterName }) => {
  const logoUrl = "https://utkristi-colabs.onrender.com/utkristi-colabs.png";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f1f5f9; padding: 40px 0; }
    .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.05); }
    .header { padding: 40px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .logo { height: 32px; width: auto; display: block; margin: 0 auto; }
    .content { padding: 40px; color: #334155; line-height: 1.6; }
    .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 16px; letter-spacing: -0.02em; }
    .message { font-size: 16px; color: #475569; margin: 0 0 32px; }
    .cta-container { text-align: center; margin: 40px 0 20px; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3); }
    .divider { height: 1px; background-color: #f1f5f9; margin: 40px 0; }
    .footer { padding: 0 40px 40px; text-align: center; font-size: 12px; color: #94a3b8; }
    .footer p { margin: 8px 0; }
    .legal-links { color: #cbd5e1; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 24px; }
    .unsubscribe { color: #2563eb; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main">
      <div class="header">
        <img src="${logoUrl}" alt="Utkristi Colabs" class="logo">
      </div>
      <div class="content">
        <h1 class="title">${title}</h1>
        <p class="message">${message}</p>
        <div class="cta-container">
          <a href="${ctaUrl}" class="btn">${ctaText}</a>
        </div>
        <div class="divider"></div>
        <p style="font-size: 13px; margin: 0;">Sent via <strong>Utkristi Colabs</strong> by ${inviterName || 'a teammate'}.</p>
      </div>
      <div class="footer">
        <p>&copy; 2026 Utkristi Colabs. All rights reserved.</p>
        <p>Enterprise Plaza, Digital District, Bangalore</p>
        <div class="legal-links">
          This is a mandatory system notification regarding your project workspace.
          <br><br>
          <a href="#" class="unsubscribe">Unsubscribe</a> from these alerts &middot; <a href="#" style="color: inherit; text-decoration: none;">Privacy Policy</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
};

// API Routes
app.get("/api/ping", (req, res) => {
  res.json({ success: true, message: "pong" });
});

app.get("/api/test-email", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Missing email query parameter" });
    
    const BREVO_KEY = process.env.BREVO_API_KEY;
    if (!BREVO_KEY) return res.status(500).json({ error: "BREVO_API_KEY not configured" });

    const html = getEmailTemplate({
      title: "Connection Verified",
      message: "Your Brevo mailing relay is now successfully configured with the enterprise template. You can now invite collaborators to your projects.",
      ctaText: "Go to Dashboard",
      ctaUrl: process.env.APP_URL || "http://localhost:5000",
      inviterName: "System Diagnostics"
    });

    const result = await fetchRelay("https://api.brevo.com/v3/smtp/email", {
      sender: { name: "Utkristi Colabs", email: process.env.BREVO_FROM_EMAIL || "noreply@rtm-edit.com" },
      to: [{ email }],
      subject: "RTM Studio - Email Relay Active",
      htmlContent: html
    }, BREVO_KEY);

    res.json({ success: true, brevoStatus: result.status, detail: result.body });
  } catch (err) {
    console.error("[TestEmail] Error:", err);
    res.status(500).json({ error: "Test email failed", message: err.message });
  }
});

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
    const { email, role, orgName, inviterName } = req.body;
    let member = null;
    let isNewUser = false;
    try {
      member = await db.addOrgMember(req.params.id, email, role);
    } catch (e) {
      if (e.message && e.message.includes("User with this email not found")) isNewUser = true;
      else throw e;
    }

    const BREVO_KEY = process.env.BREVO_API_KEY;
    if (BREVO_KEY) {
      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const actionUrl = isNewUser ? `${appUrl}/signup` : `${appUrl}/snippets`;
      const actionText = isNewUser ? "Create Account & Join Team" : "View Team Vault";
      const html = `<!DOCTYPE html><html><head><style>body{background:#0d1117;font-family:sans-serif;color:#e2e8f0;margin:0;padding:40px 0}.wrap{max-width:560px;margin:0 auto;background:#161b22;border-radius:16px;overflow:hidden;border:1px solid #30363d}.header{background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:36px;text-align:center;border-bottom:1px solid #30363d}.logo-text{font-size:26px;font-weight:900;color:#fff}.body{padding:36px}h1{font-size:22px;color:#f1f5f9;margin:0 0 10px;line-height:1.3}p{font-size:15px;color:#94a3b8;line-height:1.6;margin:0 0 16px}.cta{display:inline-block;padding:14px 24px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;margin:16px 0}</style></head><body><div class="wrap"><div class="header"><div class="logo-text">RTM<span style="color:#3b82f6">.</span>Edit</div></div><div class="body"><h1>${inviterName || 'A teammate'} invited you to join "${orgName || 'a Team Vault'}"</h1><p>You've been invited as a <strong>${role || 'member'}</strong> to collaborate on code snippets and components.</p>${isNewUser ? '<p>You don\'t have an account yet. Create one using this email, then let your team know you are ready to be added!</p>' : '<p>You have been successfully added. You can now access the team vault.</p>'}<a href="${actionUrl}" class="cta">${actionText}</a></div></div></body></html>`;

      fetchRelay("https://api.brevo.com/v3/smtp/email", {
        sender: { name: "RTM.Edit", email: process.env.BREVO_FROM_EMAIL || "noreply@rtm-edit.com" },
        to: [{ email }],
        subject: `${inviterName || 'A teammate'} invited you to "${orgName || 'a Team Vault'}"`,
        htmlContent: html
      }, BREVO_KEY).catch(err => console.error("[Brevo Org Invite Error]", err));
    }
    res.json(isNewUser ? { success: true, pendingSignup: true } : member);
  } catch (err) {
    console.error("[OrgMemberAPI] Error:", err);
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

app.get("/api/notifications", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    const notifications = await db.getNotifications(userId);
    res.json(notifications);
  } catch (err) { res.status(500).json({ error: "Failed to fetch notifications" }); }
});

app.put("/api/notifications/read", async (req, res) => {
  try {
    const { userId } = req.body;
    await db.markNotificationsRead(userId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to update notifications" }); }
});

app.delete("/api/notifications", async (req, res) => {
  try {
    await db.clearNotifications(req.query.userId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to clear notifications" }); }
});

app.delete("/api/notifications/:id", async (req, res) => {
  try {
    await db.deleteNotification(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to delete notification" }); }
});

app.get("/api/user/profile", async (req, res) => {
  try {
    const user = await db.getUser(req.query.userId);
    res.json(user);
  } catch (err) { res.status(500).json({ error: "Failed to fetch profile" }); }
});

app.delete("/api/user", async (req, res) => {
  try {
    await db.deleteAccount(req.query.userId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to delete account" }); }
});

app.get("/api/sessions", async (req, res) => {
  try {
    const sessions = await db.getSessions(req.query.userId);
    res.json(sessions);
  } catch (err) { res.status(500).json({ error: "Failed to fetch sessions" }); }
});

app.post("/api/sessions", async (req, res) => {
  try {
    const { userId, device: clientDevice, userAgent: clientUA, sessionId } = req.body;
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    const ua = req.headers['user-agent'] || clientUA || 'Unknown';
    let device = 'Device';
    if (ua.includes('Windows')) device = 'Windows PC';
    else if (ua.includes('Macintosh')) device = 'MacBook';
    else if (ua.includes('iPhone')) device = 'iPhone';
    else if (ua.includes('Android')) device = 'Android';
    const session = await db.createSession(userId, { device, ip, userAgent: ua, sessionId });
    res.json(session);
  } catch (err) { res.status(500).json({ error: "Failed to create session" }); }
});

app.delete("/api/sessions/others", async (req, res) => {
  try {
    await db.deleteOtherSessions(req.query.userId, req.query.currentSessionId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to clear sessions" }); }
});

app.post("/api/projects", async (req, res) => {
  try {
    const { userId, name, description, type } = req.body;
    const project = await db.createProject(userId, name, description, type);
    res.json(project);
  } catch (err) { res.status(500).json({ error: "Failed to create project" }); }
});

app.get("/api/projects", async (req, res) => {
  try {
    const projects = await db.getProjects(req.query.userId);
    res.json(projects);
  } catch (err) { res.status(500).json({ error: "Failed to fetch projects" }); }
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    const project = await db.getProject(req.params.id);
    res.json(project);
  } catch (err) { res.status(500).json({ error: "Failed to fetch project" }); }
});

app.get("/api/projects/:id/files", async (req, res) => {
  try {
    const files = await db.getProjectFiles(req.params.id);
    res.json(files);
  } catch (err) { res.status(500).json({ error: "Failed to fetch files" }); }
});

app.post("/api/projects/:id/files", async (req, res) => {
  try {
    const { name, path, content, isDirectory } = req.body;
    const file = await db.upsertProjectFile(req.params.id, name, path, content, isDirectory);
    res.json(file[0]);
  } catch (err) { res.status(500).json({ error: "Failed to save file" }); }
});

app.delete("/api/projects/:id/files", async (req, res) => {
  try {
    await db.deleteProjectFile(req.params.id, req.query.path);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to delete file" }); }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    await db.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to delete project" }); }
});

app.post("/api/projects/:id/invite", async (req, res) => {
  try {
    const { email, inviterName, projectName, role } = req.body;
    if (!email || !projectName) return res.status(400).json({ error: "Missing required invite data" });

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const acceptUrl = `${appUrl}/project/${req.params.id}?invite=1&email=${encodeURIComponent(email)}&role=${role || "member"}`;
    
    const html = getEmailTemplate({
      title: `Join ${projectName}`,
      message: `${inviterName || 'A teammate'} has invited you to collaborate on the project <strong>${projectName}</strong> as a <strong>${role || 'collaborator'}</strong>. Click below to accept the invitation.`,
      ctaText: "Accept Invitation",
      ctaUrl: acceptUrl,
      inviterName: inviterName
    });

    const BREVO_KEY = process.env.BREVO_API_KEY;
    if (BREVO_KEY) {
      fetchRelay("https://api.brevo.com/v3/smtp/email", {
        sender: { name: "Utkristi Colabs", email: process.env.BREVO_FROM_EMAIL || "noreply@rtm-edit.com" },
        to: [{ email }],
        subject: `${inviterName || 'A teammate'} invited you to ${projectName}`,
        htmlContent: html
      }, BREVO_KEY).catch(err => console.error("[Brevo Project Invite Error]", err));
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[InviteAPI] FATAL Error:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

app.use(express.static("build"));
app.use((req, res) => { res.sendFile(path.join(__dirname, "build", "index.html")); });

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Uncaught Server Error]", err.stack);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

const userSocketMap = {};
const roomChatHistory = {};
const roomWhiteboardState = {};
const streamingProcesses = {}; // { projectId: ffmpegProcess }

const getAllClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(socketId => ({
    socketId,
    userName: userSocketMap[socketId] || "Guest",
  }));
};

const safeSocket = (handler) => async (...args) => {
  try { await handler(...args); } catch (err) { console.error("Socket Error:", err); }
};

io.on("connection", (socket) => {
  socket.on(ACTIONS.JOIN, safeSocket(async ({ roomId, userName, userProfile }) => {
    const finalUserName = userName || "Guest";
    userSocketMap[socket.id] = finalUserName;
    socket.join(roomId);

    let dbRoom = await db.getRoom(roomId);
    if (dbRoom) {
      if (!roomChatHistory[roomId]) roomChatHistory[roomId] = dbRoom.chat_history || [];
      if (dbRoom.code !== null) socket.emit(ACTIONS.CODE_CHANGE, { code: dbRoom.code });
      if (dbRoom.language) socket.emit(ACTIONS.SYNC_LANGUAGE, { language: dbRoom.language });
    } else {
      await db.saveRoom(roomId, "", "javascript", []);
    }

    if (userProfile?.uid) {
      await db.findOrCreateUser(userProfile);
      await db.linkRoomToUser(userProfile.uid, roomId);
      await db.updateLastRoom(userProfile.uid, roomId);
    }

    const clients = getAllClients(roomId);
    io.in(roomId).emit(ACTIONS.JOINED, { clients, userName: finalUserName, socketId: socket.id });
    if (roomChatHistory[roomId]?.length > 0) socket.emit(ACTIONS.SYNC_CHAT, { messages: roomChatHistory[roomId] });
  }));

  socket.on(ACTIONS.PROJECT_JOIN, safeSocket(async ({ projectId, userName }) => {
    const finalUserName = userName || "Guest";
    const roomId = `project-${projectId}`;
    userSocketMap[socket.id] = finalUserName;
    socket.join(roomId);

    const files = await db.getProjectFiles(projectId);
    files.forEach(file => socket.emit(ACTIONS.FILE_CHANGE, { fileId: file.id, path: file.path, content: file.content, socketId: 'server' }));

    if (roomChatHistory[roomId]?.length > 0) socket.emit(ACTIONS.SYNC_CHAT, { messages: roomChatHistory[roomId] });
    if (roomWhiteboardState[roomId]?.length > 0) socket.emit(ACTIONS.WHITEBOARD_SYNC, { elements: roomWhiteboardState[roomId] });

    const clients = getAllClients(roomId);
    io.in(roomId).emit(ACTIONS.JOINED, { clients, userName: finalUserName, socketId: socket.id });
  }));

  socket.on(ACTIONS.CODE_CHANGE, safeSocket(({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    db.updateRoomCode(roomId, code).catch(() => { });
  }));

  socket.on(ACTIONS.SYNC_CODE, safeSocket(({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  }));

  socket.on(ACTIONS.LEAVE, safeSocket(async ({ roomId }) => {
    socket.in(roomId).emit(ACTIONS.DISCONNECTED, { socketId: socket.id, userName: userSocketMap[socket.id] || "Guest" });
    socket.leave(roomId);
    const remaining = getAllClients(roomId);
    if (remaining.length === 0) {
      delete roomChatHistory[roomId];
      const isGuest = await db.isRoomGuest(roomId);
      if (isGuest && !roomId.startsWith('project-')) await db.deleteRoomPermanently(roomId);
    }
  }));

  socket.on("disconnecting", safeSocket(() => {
    [...socket.rooms].forEach(roomId => {
      if (roomId === socket.id) return;
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, { socketId: socket.id, userName: userSocketMap[socket.id] || "Guest" });
      if (roomId.startsWith('project-')) socket.in(roomId).emit('user-left-video', { userId: socket.id });

      const remaining = getAllClients(roomId);
      if (remaining.length <= 1) {
        delete roomChatHistory[roomId];
        db.isRoomGuest(roomId).then(isGuest => {
          if (isGuest && !roomId.startsWith('project-')) db.deleteRoomPermanently(roomId);
        }).catch(() => { });
      }
    });
    delete userSocketMap[socket.id];
  }));

  socket.on(ACTIONS.SEND_MESSAGE, safeSocket(({ roomId, message }) => {
    if (!roomChatHistory[roomId]) roomChatHistory[roomId] = [];
    roomChatHistory[roomId].push(message);
    if (roomChatHistory[roomId].length > 50) roomChatHistory[roomId].shift();
    socket.in(roomId).emit(ACTIONS.RECEIVE_MESSAGE, message);
    db.updateRoomChat(roomId, roomChatHistory[roomId]);
  }));

  socket.on(ACTIONS.EDIT_MESSAGE, safeSocket(({ roomId, messageId, newText }) => {
    if (roomChatHistory[roomId]) roomChatHistory[roomId] = roomChatHistory[roomId].map(m => m.id === messageId ? { ...m, text: newText, isEdited: true } : m);
    socket.in(roomId).emit(ACTIONS.EDIT_MESSAGE, { messageId, newText });
  }));

  socket.on(ACTIONS.DELETE_MESSAGE, safeSocket(({ roomId, messageId }) => {
    if (roomChatHistory[roomId]) roomChatHistory[roomId] = roomChatHistory[roomId].filter(m => m.id !== messageId);
    socket.in(roomId).emit(ACTIONS.DELETE_MESSAGE, { messageId });
  }));

  socket.on(ACTIONS.SYNC_LANGUAGE, safeSocket(({ roomId, language }) => {
    socket.in(roomId).emit(ACTIONS.SYNC_LANGUAGE, { language });
    db.updateRoomLanguage(roomId, language);
  }));

  socket.on(ACTIONS.CURSOR_MOVE, safeSocket(({ roomId, cursor, userName }) => {
    socket.in(roomId).emit(ACTIONS.CURSOR_MOVE, { cursor, userName, socketId: socket.id });
  }));

  socket.on(ACTIONS.WHITEBOARD_DRAW, safeSocket((data) => {
    if (!data) return;
    const { roomId, action, payload } = data;
    if (!roomWhiteboardState[roomId]) roomWhiteboardState[roomId] = [];
    if (action === 'ADD') roomWhiteboardState[roomId].push(payload);
    else if (action === 'CLEAR') roomWhiteboardState[roomId] = [];
    else if (action === 'UNDO' || action === 'REDO') if (payload?.elements) roomWhiteboardState[roomId] = payload.elements;
    socket.in(roomId).emit(ACTIONS.WHITEBOARD_DRAW, data);
  }));

  socket.on(ACTIONS.WHITEBOARD_SYNC_REQUEST, safeSocket(({ roomId }) => {
    socket.emit(ACTIONS.WHITEBOARD_SYNC, { elements: roomWhiteboardState[roomId] || [] });
  }));

  socket.on(ACTIONS.SCREEN_SHARE_STOP, safeSocket(({ roomId }) => {
    socket.to(roomId).emit(ACTIONS.SCREEN_SHARE_STOP, { userId: socket.id });
  }));

  // RTMP Streaming Handlers
  socket.on(ACTIONS.START_STREAMING, safeSocket(({ projectId, rtmpKey }) => {
    if (!rtmpKey) return;

    console.log(`Starting RTMP stream for project ${projectId} to ${rtmpKey}`);

    if (streamingProcesses[projectId]) {
      streamingProcesses[projectId].kill();
    }

    // FFmpeg command to transcode WebM/VP8 to H.264/AAC for RTMP
    const ffmpeg = spawn('ffmpeg', [
      '-i', '-', // Input from stdin
      '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '3000k',
      '-maxrate', '3000k', '-bufsize', '6000k',
      '-pix_fmt', 'yuv420p', '-g', '50',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
      '-f', 'flv', rtmpKey
    ]);

    ffmpeg.on('close', (code) => {
      console.log(`FFmpeg process for ${projectId} closed with code ${code}`);
      delete streamingProcesses[projectId];
    });

    ffmpeg.stderr.on('data', (data) => {
      // console.log(`FFmpeg [${projectId}]: ${data}`);
    });

    streamingProcesses[projectId] = ffmpeg;
  }));

  socket.on(ACTIONS.STREAM_DATA, safeSocket(({ projectId, chunk }) => {
    const ffmpeg = streamingProcesses[projectId];
    if (ffmpeg && ffmpeg.stdin.writable) {
      ffmpeg.stdin.write(chunk);
    }
  }));

  socket.on(ACTIONS.STOP_STREAMING, safeSocket(({ projectId }) => {
    if (streamingProcesses[projectId]) {
      streamingProcesses[projectId].stdin.end();
      streamingProcesses[projectId].kill();
      delete streamingProcesses[projectId];
      console.log(`Streaming stopped for ${projectId}`);
    }
  }));

  socket.on('join-video-chat', safeSocket(({ projectId, name, isSpectator }) => {
    const roomId = `project-${projectId}`;
    socket.join(roomId);
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []).filter(id => id !== socket.id).map(id => ({
      userId: id, name: userSocketMap[id] || "Guest", isSpectator: false
    }));
    socket.emit('video-participants', { clients });
    socket.to(roomId).emit('user-joined-video', { userId: socket.id, name: name || "Guest", isSpectator });
  }));

  socket.on('request-streams', safeSocket(({ to }) => io.to(to).emit('request-streams', { from: socket.id })));
  socket.on('video-offer', safeSocket(({ to, offer }) => io.to(to).emit('video-offer', { from: socket.id, offer })));
  socket.on('video-answer', safeSocket(({ to, answer }) => io.to(to).emit('video-answer', { from: socket.id, answer })));
  socket.on('new-ice-candidate', safeSocket(({ to, candidate }) => io.to(to).emit('new-ice-candidate', { from: socket.id, candidate })));
  socket.on('leave-video-chat', safeSocket(({ projectId }) => {
    const roomId = `project-${projectId}`;
    socket.leave(roomId);
    socket.to(roomId).emit('user-left-video', { userId: socket.id });
  }));
});

const startServer = async () => {
  try {
    await db.initializeSchema();
    server.listen(process.env.PORT || 5000, () => console.log("Running at 5000"));
  } catch (err) {
    console.error("CRITICAL:", err);
    process.exit(1);
  }
};
startServer();
