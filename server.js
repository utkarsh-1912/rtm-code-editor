const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const ACTIONS = require("./src/Action");
const db = require("./src/db");

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("build"));

// API Routes
app.get("/api/recent-rooms", async (req, res) => {
  try {
    const rooms = await db.getRecentRooms(req.query.email);
    res.json(rooms);
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
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
  socket.on(ACTIONS.JOIN, async ({ roomId, userName }) => {
    userSocketMap[socket.id] = userName;
    socket.join(roomId);

    // Load or Initialize Room from DB
    let room;
    try {
      room = await db.getRoom(roomId);
      if (room) {
        // Load code into memory if not already there (optional, but good for sync)
        if (!roomChatHistory[roomId]) {
          roomChatHistory[roomId] = room.chat_history || [];
        }
        // Send existing code to the joining user
        if (room.code) {
          socket.emit(ACTIONS.CODE_CHANGE, { code: room.code });
        }
      } else {
        // New room, create entry
        await db.saveRoom(roomId, "", "javascript", []);
      }
    } catch (err) {
      console.error("DB Join Error:", err);
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
    const history = roomChatHistory[roomId] || (room && room.chat_history) || [];
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

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        userName: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
    socket.leave();

    // Clean up room history if empty
    rooms.forEach((roomId) => {
      const remaining = getAllClients(roomId);
      if (remaining.length === 0) {
        delete roomChatHistory[roomId];
      }
    });
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
  });

  socket.on(ACTIONS.CURSOR_MOVE, ({ roomId, cursor, userName }) => {
    socket.in(roomId).emit(ACTIONS.CURSOR_MOVE, { cursor, userName, socketId: socket.id });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, (err) => {
  if (!err) {
    console.log(`Running at port ${PORT}`);
  }
});
