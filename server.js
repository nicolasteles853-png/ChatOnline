// server.js COMPLETO

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
      origin: "*",
      methods: [
        "GET",
        "POST"
      ]
    },

    transports: [
      "websocket",
      "polling"
    ],

    allowEIO3: true,

    maxHttpBufferSize:
      1e8,

    pingTimeout:
      60000,

    pingInterval:
      25000
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
  express.json({
    limit: "100mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "100mb"
  })
);

app.use(
  express.static(PUBLIC_DIR)
);

let users = {};
let messages = [];
let clients = {};

async function ensureFile(
  file,
  data
) {

  try {

    await fs.access(file);

  } catch(e) {

    await fs.writeFile(
      file,
      JSON.stringify(
        data,
        null,
        2
      )
    );
  }
}

async function loadFiles() {

  await ensureFile(
    USERS_FILE,
    {}
  );

  await ensureFile(
    MESSAGES_FILE,
    []
  );

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
  }

  if (
    !Array.isArray(messages)
  ) {

    messages = [];
  }
}

async function saveUsers() {

  try {

    await fs.writeFile(
      USERS_FILE,
      JSON.stringify(
        users,
        null,
        2
      )
    );

  } catch(e) {

    console.log(e);
  }
}

async function saveMessages() {

  try {

    await fs.writeFile(
      MESSAGES_FILE,
      JSON.stringify(
        messages,
        null,
        2
      )
    );

  } catch(e) {

    console.log(e);
  }
}

function getOnlineUsers() {

  const list = [];

  Object.keys(clients)
  .forEach(function(id) {

    const u =
      clients[id];

    if (!u)
      return;

    const exists =
      list.find(
        function(x) {

        return (
          x.id ===
          u.id
        );
      });

    if (!exists) {

      list.push({
        id:
          u.id,

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

function getSocketByUserId(
  id
) {

  let result = null;

  Object.keys(clients)
  .forEach(function(sid) {

    if (
      clients[sid] &&
      clients[sid].id ===
      id
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

    try {

      if (!data)
        return;

      const userId =
        String(
          data.id || ""
        );

      const username =
        String(
          data.username || ""
        );

      const avatar =
        String(
          data.avatar || ""
        );

      if (
        !userId ||
        !username
      ) {

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
        id:
          userId,

        username:
          username,

        avatar:
          avatar
      };

      socket.emit(
        "messages_history",
        messages
      );

      io.emit(
        "users_list",
        getOnlineUsers()
      );

    } catch(e) {

      console.log(e);
    }
  });

  socket.on(
    "send_message",
    async function(data) {

    try {

      const from =
        clients[socket.id];

      if (!from)
        return;

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

      messages.push(msg);

      if (
        messages.length >
        1000
      ) {

        messages =
          messages.slice(
            -1000
          );
      }

      await saveMessages();

      io.emit(
        "message",
        msg
      );

    } catch(e) {

      console.log(e);
    }
  });

  socket.on(
    "delete_message",
    async function(data) {

    try {

      const from =
        clients[socket.id];

      if (!from)
        return;

      const msg =
        messages.find(
          function(m) {

          return (
            m.id ===
            data.id
          );
        });

      if (!msg)
        return;

      if (
        msg.from !==
        from.id
      ) {

        return;
      }

      messages =
        messages.filter(
          function(m) {

          return (
            m.id !==
            data.id
          );
        });

      await saveMessages();

      io.emit(
        "message_deleted",
        {
          id:
            data.id
        }
      );

    } catch(e) {

      console.log(e);
    }
  });

  socket.on(
    "typing",
    function(data) {

    const from =
      clients[socket.id];

    if (!from)
      return;

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
        from:
          from.id,

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

    try {

      const from =
        clients[socket.id];

      if (!from)
        return;

      const targetSocket =
        getSocketByUserId(
          data.to
        );

      if (!targetSocket)
        return;

      io.to(
        targetSocket
      ).emit(
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

    } catch(e) {

      console.log(e);
    }
  });

  socket.on(
    "call_response",
    function(data) {

    try {

      const from =
        clients[socket.id];

      if (!from)
        return;

      const targetSocket =
        getSocketByUserId(
          data.to
        );

      if (!targetSocket)
        return;

      io.to(
        targetSocket
      ).emit(
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

    } catch(e) {

      console.log(e);
    }
  });

  socket.on(
    "ice_candidate",
    function(data) {

    try {

      const from =
        clients[socket.id];

      if (!from)
        return;

      const targetSocket =
        getSocketByUserId(
          data.to
        );

      if (!targetSocket)
        return;

      io.to(
        targetSocket
      ).emit(
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

    } catch(e) {

      console.log(e);
    }
  });

  socket.on(
    "call_ended",
    function(data) {

    try {

      const from =
        clients[socket.id];

      if (!from)
        return;

      const targetSocket =
        getSocketByUserId(
          data.to
        );

      if (!targetSocket)
        return;

      io.to(
        targetSocket
      ).emit(
        "call_ended",
        {
          from:
            from.id,

          to:
            data.to
        }
      );

    } catch(e) {

      console.log(e);
    }
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

    console.log(
      "Desconectado:",
      socket.id
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

app.get(
  "/health",
  function(req, res) {

  res.json({
    status:
      "ok"
  });
});

loadFiles()
.then(function() {

  const PORT =
    process.env.PORT ||
    3000;

  server.listen(
    PORT,
    "0.0.0.0",
    function() {

    console.log(
      "Servidor rodando na porta " +
      PORT
    );
  });
});
