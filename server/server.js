// server.js

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*"
  },
  maxHttpBufferSize: 1e8
});

const PUBLIC_DIR = path.join(__dirname, "../public");
const USERS_FILE = path.join(__dirname, "users.json");
const MESSAGES_FILE = path.join(__dirname, "messages.json");

app.use(express.static(PUBLIC_DIR));

let users = {};
let messages = [];
let clients = {};

async function loadFiles() {
  try {
    const usersRaw = await fs.readFile(USERS_FILE, "utf8");
    users = JSON.parse(usersRaw);
  } catch (e) {
    users = {};
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  }

  try {
    const msgRaw = await fs.readFile(MESSAGES_FILE, "utf8");
    messages = JSON.parse(msgRaw);
  } catch (e) {
    messages = [];
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
  }
}

async function saveUsers() {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function saveMessages() {
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

function getOnlineUsers() {
  return Object.values(clients).map((u) => {
    return {
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      status: "online"
    };
  });
}

io.on("connection", (socket) => {

  socket.on("login", async (data) => {

    if (!data) return;

    const userId = data.id;
    const username = data.username;
    const avatar = data.avatar;

    if (!userId || !username || !avatar) {
      socket.emit("auth_error", {
        message: "Dados inválidos."
      });
      return;
    }

    users[userId] = {
      username,
      avatar
    };

    await saveUsers();

    clients[socket.id] = {
      id: userId,
      username,
      avatar
    };

    socket.emit("auth_success", {
      userId,
      username,
      avatar
    });

    socket.emit("messages_history", messages);

    io.emit("users_list", getOnlineUsers());
  });

  socket.on("send_message", async (data) => {

    const from = clients[socket.id];

    if (!from) return;

    const msg = {
      id: Date.now().toString(),
      from: from.id,
      username: from.username,
      avatar: from.avatar,
      to: data.to || null,
      text: data.text || "",
      image: data.image || null,
      video: data.video || null,
      audio: data.audio || null,
      timestamp: Date.now()
    };

    messages.push(msg);

    await saveMessages();

    io.emit("message", msg);
  });

  socket.on("typing", (data) => {

    const from = clients[socket.id];

    if (!from) return;

    socket.broadcast.emit("typing", {
      from: from.id,
      username: from.username,
      to: data.to || null
    });
  });

  socket.on("call_request", (data) => {

    const from = clients[socket.id];

    if (!from) return;

    io.emit("call_request", {
      from: {
        id: from.id,
        username: from.username,
        avatar: from.avatar
      },
      to: data.to,
      type: data.type
    });
  });

  socket.on("call_response", (data) => {

    const from = clients[socket.id];

    if (!from) return;

    io.emit("call_response", {
      from: {
        id: from.id,
        username: from.username,
        avatar: from.avatar
      },
      to: data.to,
      accepted: data.accepted
    });
  });

  socket.on("disconnect", () => {

    delete clients[socket.id];

    io.emit("users_list", getOnlineUsers());
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/chat", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "chat.html"));
});

loadFiles().then(() => {

  const PORT = process.env.PORT || 3000;

  server.listen(PORT, () => {
    console.log("Servidor iniciado na porta " + PORT);
  });

});
