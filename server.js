// server.js

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs").promises;
const path = require("path");

const app = express();

const server =
  http.createServer(app);

const io =
  socketIo(server, {
    cors: {
      origin: "*"
    },
    maxHttpBufferSize:
      1e8
  });

const PUBLIC_DIR =
  path.join(
    __dirname,
    "public"
  );

const USERS_FILE =
  path.join(
    __dirname,
    "users.json"
  );

const MESSAGES_FILE =
  path.join(
    __dirname,
    "messages.json"
  );

app.use(
  express.static(PUBLIC_DIR)
);

let users = {};
let messages = [];

let clients = {};

async function loadFiles() {

  try {

    const usersRaw =
      await fs.readFile(
        USERS_FILE,
        "utf8"
      );

    users =
      JSON.parse(usersRaw);

  } catch(e) {

    users = {};

    await fs.writeFile(
      USERS_FILE,
      JSON.stringify(
        users,
        null,
        2
      )
    );
  }

  try {

    const msgRaw =
      await fs.readFile(
        MESSAGES_FILE,
        "utf8"
      );

    messages =
      JSON.parse(msgRaw);

  } catch(e) {

    messages = [];

    await fs.writeFile(
      MESSAGES_FILE,
      JSON.stringify(
        messages,
        null,
        2
      )
    );
  }
}

async function saveUsers() {

  await fs.writeFile(
    USERS_FILE,
    JSON.stringify(
      users,
      null,
      2
    )
  );
}

async function saveMessages() {

  await fs.writeFile(
    MESSAGES_FILE,
    JSON.stringify(
      messages,
      null,
      2
    )
  );
}

function getOnlineUsers() {

  const list = [];

  Object.keys(clients)
  .forEach(function(id) {

    const u = clients[id];

    const exists =
      list.find(function(x) {
        return x.id === u.id;
      });

    if (!exists) {

      list.push({
        id: u.id,
        username:
          u.username,
        avatar:
          u.avatar,
        status:
          "online"
      });
    }
  });

  return list;
}

function getSocketByUserId(id) {

  let result = null;

  Object.keys(clients)
  .forEach(function(sid) {

    if (
      clients[sid].id === id
    ) {

      result = sid;
    }
  });

  return result;
}

io.on(
  "connection",
  function(socket) {

  console.log(
    "Conectado:",
    socket.id
  );

  socket.on(
    "login",
    async function(data) {

    if (!data) return;

    const userId =
      data.id;

    const username =
      data.username;

    const avatar =
      data.avatar;

    if (
      !userId ||
      !username ||
      !avatar
    ) {

      socket.emit(
        "auth_error",
        {
          message:
            "Dados inválidos"
        }
      );

      return;
    }

    users[userId] = {
      username:
        username,
      avatar:
        avatar
    };

    await saveUsers();

    clients[socket.id] = {
      id: userId,
      username:
        username,
      avatar:
        avatar
    };

    socket.emit(
      "auth_success",
      {
        userId:
          userId,
        username:
          username,
        avatar:
          avatar
      }
    );

    socket.emit(
      "messages_history",
      messages
    );

    io.emit(
      "users_list",
      getOnlineUsers()
    );
  });

  socket.on(
    "send_message",
    async function(data) {

    const from =
      clients[socket.id];

    if (!from) return;

    const msg = {
      id:
        Date.now()
        .toString() +
        "_" +
        Math.random()
        .toString(36)
        .substring(2, 8),

      from:
        from.id,

      username:
        from.username,

      avatar:
        from.avatar,

      to:
        data.to || null,

      text:
        data.text || "",

      image:
        data.image || null,

      video:
        data.video || null,

      audio:
        data.audio || null,

      timestamp:
        Date.now()
    };

    const exists =
      messages.find(
        function(m) {

        return (
          m.id === msg.id
        );
      });

    if (!exists) {

      messages.push(msg);

      await saveMessages();
    }

    io.emit(
      "message",
      msg
    );
  });

  socket.on(
    "typing",
    function(data) {

    const from =
      clients[socket.id];

    if (!from) return;

    const targetSocket =
      getSocketByUserId(
        data.to
      );

    if (!targetSocket)
      return;

    io.to(targetSocket)
    .emit(
      "typing",
      {
        from: from.id,
        username:
          from.username,
        to:
          data.to
      }
    );
  });

  socket.on(
    "call_request",
    function(data) {

    const from =
      clients[socket.id];

    if (!from) return;

    const targetSocket =
      getSocketByUserId(
        data.to
      );

    if (!targetSocket)
      return;

    io.to(targetSocket)
    .emit(
      "call_request",
      {
        from: {
          id:
            from.id,
          username:
            from.username,
          avatar:
            from.avatar
        },

        to:
          data.to,

        type:
          data.type,

        offer:
          data.offer
      }
    );
  });

  socket.on(
    "call_response",
    function(data) {

    const from =
      clients[socket.id];

    if (!from) return;

    const targetSocket =
      getSocketByUserId(
        data.to
      );

    if (!targetSocket)
      return;

    io.to(targetSocket)
    .emit(
      "call_response",
      {
        from: {
          id:
            from.id,
          username:
            from.username,
          avatar:
            from.avatar
        },

        to:
          data.to,

        accepted:
          data.accepted,

        answer:
          data.answer
      }
    );
  });

  socket.on(
    "ice_candidate",
    function(data) {

    const from =
      clients[socket.id];

    if (!from) return;

    const targetSocket =
      getSocketByUserId(
        data.to
      );

    if (!targetSocket)
      return;

    io.to(targetSocket)
    .emit(
      "ice_candidate",
      {
        from:
          from.id,

        to:
          data.to,

        candidate:
          data.candidate
      }
    );
  });

  socket.on(
    "call_ended",
    function(data) {

    const from =
      clients[socket.id];

    if (!from) return;

    const targetSocket =
      getSocketByUserId(
        data.to
      );

    if (!targetSocket)
      return;

    io.to(targetSocket)
    .emit(
      "call_ended",
      {
        from:
          from.id,

        to:
          data.to
      }
    );
  });

  socket.on(
    "disconnect",
    function() {

    delete clients[
      socket.id
    ];

    io.emit(
      "users_list",
      getOnlineUsers()
    );
  });
});

app.get(
  "/",
  function(req, res) {

  res.sendFile(
    path.join(
      PUBLIC_DIR,
      "index.html"
    )
  );
});

app.get(
  "/chat",
  function(req, res) {

  res.sendFile(
    path.join(
      PUBLIC_DIR,
      "chat.html"
    )
  );
});

loadFiles()
.then(function() {

  const PORT =
    process.env.PORT ||
    3000;

  server.listen(
    PORT,
    function() {

    console.log(
      "Servidor rodando em http://localhost:" +
      PORT
    );
  });
});
