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
const getEmailTemplate = ({ title, message, ctaText, ctaUrl, inviterName, inviterPhoto, recipientEmail, isWelcome = false }) => {
  const logoUrl = "https://utkristi-colabs.onrender.com/utkristi-colabs.png";
  const inviterInitials = (inviterName || "U").charAt(0).toUpperCase();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding: 80px 0; }
    .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-radius: 40px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 20px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
    
    .header { padding: 64px 64px 48px; text-align: center; }
    .logo { height: 24px; width: auto; margin: 0 auto 48px; display: block; }
    
    .inviter-pill { display: inline-block; background: #f8fafc; padding: 10px 20px; border-radius: 100px; border: 1px solid #e2e8f0; margin: 0 auto 40px; text-align: center; }
    .avatar-mini { width: 28px; height: 28px; border-radius: 50%; background: #2563eb; color: #ffffff; display: inline-block; vertical-align: middle; font-size: 12px; font-weight: 800; line-height: 28px; margin-right: 12px; overflow: hidden; text-align: center; }
    .avatar-mini img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .inviter-text { color: #475569; font-size: 13px; font-weight: 600; display: inline-block; vertical-align: middle; line-height: 28px; }
    
    .hero-title { color: #0f172a; font-size: 34px; font-weight: 800; margin: 0 0 20px; letter-spacing: -0.03em; line-height: 1.2; }
    .hero-subtitle { color: #64748b; font-size: 17px; margin: 0; line-height: 1.6; }
    
    .content { padding: 0 64px 64px; color: #334155; }
    .message-body { font-size: 18px; line-height: 1.9; color: #475569; margin-bottom: 56px; text-align: center; background: #f8fafc; padding: 48px; border-radius: 32px; border: 1px solid #f1f5f9; }
    
    .cta-area { text-align: center; margin-bottom: 64px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 24px 64px; border-radius: 24px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2); }
    
    .feature-grid { width: 100%; border-top: 1px solid #f1f5f9; padding-top: 64px; margin-top: 0; }
    .feature-item { width: 48%; display: inline-block; vertical-align: top; margin-bottom: 40px; box-sizing: border-box; }
    .feature-item-inner { padding-right: 20px; }
    .feature-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 10px; line-height: 1.4; }
    .feature-icon { font-size: 20px; margin-bottom: 12px; display: block; }
    .feature-desc { font-size: 13px; color: #64748b; line-height: 1.7; }
    
    .footer { padding: 64px; text-align: center; background-color: #ffffff; border-top: 1px solid #f1f5f9; }
    .footer-links { margin-top: 40px; padding-top: 40px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; line-height: 2.2; }
    .unsubscribe { color: #2563eb; text-decoration: none; font-weight: 600; }

    @media only screen and (max-width: 640px) {
      .wrapper { padding: 24px 0; }
      .main { border-radius: 0; border-left: none; border-right: none; }
      .header { padding: 56px 32px 40px; }
      .hero-title { font-size: 28px; }
      .content { padding: 0 32px 48px; }
      .message-body { padding: 32px; font-size: 16px; margin-bottom: 40px; }
      .cta-area { margin-bottom: 48px; }
      .btn { padding: 20px 48px; width: 100%; box-sizing: border-box; }
      .feature-item { width: 100%; display: block; margin-bottom: 32px; }
      .footer { padding: 48px 32px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main">
      <div class="header">
        <img src="${logoUrl}" alt="Utkristi Colabs" class="logo">
        ${!isWelcome ? `
        <div class="inviter-pill">
          <div class="avatar-mini">
            ${inviterPhoto ? `<img src="${inviterPhoto}" alt="${inviterName}">` : inviterInitials}
          </div>
          <span class="inviter-text">${inviterName || 'A teammate'} is inviting you</span>
        </div>
        ` : `
        <div class="inviter-pill" style="background: #f0fdf4; border-color: #dcfce7; color: #166534;">
          <span class="inviter-text" style="color: #166534; margin: 0;">🚀 System Onboarding Active</span>
        </div>
        `}
        <h1 class="hero-title">${title}</h1>
        <p class="hero-subtitle">The secure workspace where high-performance teams build together.</p>
      </div>
      
      <div class="content">
        <div class="message-body">
          ${message}
        </div>
        
        <div class="cta-area">
          <a href="${ctaUrl}" class="btn">${ctaText}</a>
        </div>
        
        <div class="feature-grid">
          <div class="feature-item">
            <div class="feature-item-inner">
              <span class="feature-icon">⚡</span>
              <div class="feature-title">High-Speed Sync</div>
              <div class="feature-desc">Zero-latency collaborative engine optimized for rapid delivery and execution.</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-item-inner">
              <span class="feature-icon">🎥</span>
              <div class="feature-title">Cinematic Video</div>
              <div class="feature-desc">Integrated HD conferencing with professional 16:9 cinematic layout controls.</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-item-inner">
              <span class="feature-icon">🤖</span>
              <div class="feature-title">AI-Ready Flow</div>
              <div class="feature-desc">Intelligent environment engineered for the modern, AI-augmented developer.</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-item-inner">
              <span class="feature-icon">🔒</span>
              <div class="feature-title">Enterprise Security</div>
              <div class="feature-desc">Persistent, encrypted workspaces with granular security and access logic.</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <p style="font-weight: 700; color: #475569; margin-bottom: 8px; font-size: 15px;">Utkristi Colabs</p>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 16px;">The World's Most Advanced Collaborative IDE</p>
        <p style="font-size: 11px; color: #cbd5e1;">Innovation Plaza, Digital District, Bangalore, KA 560103</p>
        <div class="footer-links">
          This secure communication was intended for <strong>${recipientEmail}</strong>. 
          <br>
          <a href="${process.env.APP_URL || 'http://localhost:5000'}/unsubscribe?email=${encodeURIComponent(recipientEmail)}" class="unsubscribe">Manage Notifications</a> &middot; <a href="${process.env.APP_URL || 'http://localhost:5000'}/terms" style="color: inherit; text-decoration: none;">Security Center</a> &middot; <a href="${process.env.APP_URL || 'http://localhost:5000'}/privacy" style="color: inherit; text-decoration: none;">Privacy Statement</a>
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

app.get("/api/welcome-new-user", async (req, res) => {
  try {
    const { email, name } = req.query;
    if (!email) return res.status(400).json({ error: "Missing email query parameter" });

    const BREVO_KEY = process.env.BREVO_API_KEY;
    if (!BREVO_KEY) return res.status(500).json({ error: "BREVO_API_KEY not configured" });

    const html = getEmailTemplate({
      title: `Welcome to the Studio, ${name || 'Engineer'}`,
      message: "We're thrilled to have you here. Utkristi Colabs is designed to be the fastest, most immersive workspace for your technical team. Start by creating a project or joining a team vault.",
      ctaText: "Launch Workspace",
      ctaUrl: process.env.APP_URL || "http://localhost:5000",
      inviterName: "RTM Onboarding",
      recipientEmail: email,
      isWelcome: true
    });

    const result = await fetchRelay("https://api.brevo.com/v3/smtp/email", {
      sender: { name: "Utkristi Colabs", email: process.env.BREVO_FROM_EMAIL || "noreply@rtm-edit.com" },
      to: [{ email }],
      subject: "Welcome to Utkristi Colabs - Let's build together",
      htmlContent: html
    }, BREVO_KEY);

    res.json({ success: true, message: "Welcome email dispatched", status: result.status });
  } catch (err) {
    console.error("[WelcomeEmail] Error:", err);
    res.status(500).json({ error: "Failed to send welcome", message: err.message });
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

app.post("/api/unsubscribe", async (req, res) => {
  try {
    const { email, unsubscribed } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    await db.unsubscribeUser(email, unsubscribed !== false);
    res.json({ success: true, message: unsubscribed === false ? "Successfully resubscribed" : "Successfully unsubscribed" });
  } catch (err) {
    console.error("Unsubscribe Error:", err);
    res.status(500).json({ error: "Operation failed" });
  }
});

app.get("/api/user-subscription", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email required" });
    const isUnsubscribed = await db.isUserUnsubscribed(email);
    res.json({ email, isUnsubscribed });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch status" });
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
      const appUrl = process.env.APP_URL || "http://localhost:5000";
      const actionUrl = isNewUser ? `${appUrl}/signup` : `${appUrl}/snippets`;
      const actionText = isNewUser ? "Create Account & Join Team" : "View Team Vault";
      const html = getEmailTemplate({
        title: `Team Invitation: ${orgName || 'Team Vault'}`,
        message: `You've been invited by ${inviterName || 'a teammate'} to join <strong>${orgName || 'a Team Vault'}</strong> as a <strong>${role || 'member'}</strong>. ${isNewUser ? "Create an account to start collaborating on shared snippets and projects." : "Access the team vault now to view shared resources."}`,
        ctaText: actionText,
        ctaUrl: actionUrl,
        inviterName: inviterName || "Teammate",
        recipientEmail: email
      });

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
      title: "Confirm Your Invitation",
      message: `<strong>${inviterName || 'A teammate'}</strong> has invited you to join the project workspace <strong>${projectName}</strong> as a <strong>${role || 'collaborator'}</strong>. Get started by clicking the button below.`,
      ctaText: "Access Project",
      ctaUrl: acceptUrl,
      inviterName: inviterName,
      inviterPhoto: req.body.inviterPhoto,
      recipientEmail: email
    });

    const BREVO_KEY = process.env.BREVO_API_KEY;
    if (BREVO_KEY) {
      // Check subscription before sending
      const isUnsubscribed = await db.isUserUnsubscribed(email);
      if (isUnsubscribed) {
        console.log(`[EmailSkipped] User ${email} is unsubscribed.`);
        return res.json({ success: true, message: "Invite recorded, but email skipped due to user preference." });
      }

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
