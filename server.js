const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const ACTIONS = require("./src/Action");

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("build"));
app.use((req, res, next) => {
  res.sendFile(__dirname + "/build/index.html");
});

const userSocketMap = {};
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
  socket.on(ACTIONS.JOIN, ({ roomId, userName }) => {
    userSocketMap[socket.id] = userName;
    socket.join(roomId);
    const clients = getAllClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        userName: userName,
        socketId: socket.id,
      });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
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
  });

  // Handle chat messages
  socket.on("send-message", ({ roomId, message }) => {
    socket.in(roomId).emit("receive-message", message);
  });

  socket.on(ACTIONS.EDIT_MESSAGE, ({ roomId, messageId, newText }) => {
    socket.in(roomId).emit(ACTIONS.EDIT_MESSAGE, { messageId, newText });
  });

  socket.on(ACTIONS.DELETE_MESSAGE, ({ roomId, messageId }) => {
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
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, (err) => {
  if (!err) {
    console.log(`Running at port ${PORT}`);
  }
});
