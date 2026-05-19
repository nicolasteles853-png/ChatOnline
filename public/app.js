// app.js

const socket = io({
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 20000
});

let userId = localStorage.getItem("userId");
let username = localStorage.getItem("username");
let avatar = localStorage.getItem("avatar");

if (!userId || !username || !avatar) {
  location.href = "/";
}

const myAvatarEl =
  document.getElementById("myAvatar");

const myNameEl =
  document.getElementById("myName");

myAvatarEl.src = avatar;
myNameEl.textContent = username;

let activeChatId = null;
let allMessages = [];
let renderedMessages = [];
let onlineUsers = [];

const messagesAreaEl =
  document.getElementById("messagesArea");

const contactsListEl =
  document.getElementById("contactsList");

const messageInputEl =
  document.getElementById("messageInput");

const activeAvatarEl =
  document.getElementById("activeAvatar");

const activeNameEl =
  document.getElementById("activeName");

const statusTextEl =
  document.getElementById("statusText");

const mediaInputEl =
  document.getElementById("mediaInput");

const callBtn =
  document.querySelector(".call-btn");

const sendBtn =
  document.querySelector(".send-btn");

let localStream = null;
let remoteAudio = null;
let peerConnection = null;

let inCall = false;
let currentCallUser = null;

let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;
let isRecording = false;

const cancelRecordBtn =
  document.createElement("button");

cancelRecordBtn.innerText = "❌";

cancelRecordBtn.style.width = "40px";
cancelRecordBtn.style.height = "40px";
cancelRecordBtn.style.border = "none";
cancelRecordBtn.style.borderRadius = "50%";
cancelRecordBtn.style.background = "#ef4444";
cancelRecordBtn.style.color = "#fff";
cancelRecordBtn.style.display = "none";
cancelRecordBtn.style.cursor = "pointer";

document
.querySelector(".chat-footer")
.appendChild(cancelRecordBtn);

const popupMenu =
  document.createElement("div");

popupMenu.style.position = "fixed";
popupMenu.style.background = "#1f2937";
popupMenu.style.padding = "10px";
popupMenu.style.borderRadius = "10px";
popupMenu.style.display = "none";
popupMenu.style.zIndex = "99999";
popupMenu.style.boxShadow =
  "0 0 10px rgba(0,0,0,0.4)";

const deleteBtn =
  document.createElement("div");

deleteBtn.innerText =
  "Apagar mensagem";

deleteBtn.style.color = "#fff";
deleteBtn.style.cursor = "pointer";
deleteBtn.style.fontSize = "14px";

popupMenu.appendChild(deleteBtn);

document.body.appendChild(popupMenu);

let selectedMessageId = null;

const rtcConfig = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302"
      ]
    },

    {
      urls:
        "turn:openrelay.metered.ca:80",

      username:
        "openrelayproject",

      credential:
        "openrelayproject"
    },

    {
      urls:
        "turn:openrelay.metered.ca:443",

      username:
        "openrelayproject",

      credential:
        "openrelayproject"
    },

    {
      urls:
        "turn:openrelay.metered.ca:443?transport=tcp",

      username:
        "openrelayproject",

      credential:
        "openrelayproject"
    }
  ]
};

function updateSendButton() {

  const text =
    messageInputEl.value.trim();

  const file =
    mediaInputEl.files[0];

  if (
    text.length > 0 ||
    file
  ) {

    sendBtn.innerText = "➤";

  } else {

    if (isRecording) {

      sendBtn.innerText =
        "Enviar";

    } else {

      sendBtn.innerText = "🎙️";
    }
  }
}

function getMessageKey(msg) {

  return (
    msg.id + "_" +
    msg.from + "_" +
    msg.to + "_" +
    msg.timestamp
  );
}

function isUserOnline(id) {

  return onlineUsers.find(
    function(u) {

      return u.id === id;
    }
  );
}

function closeConversation() {

  activeChatId = null;

  messagesAreaEl.innerHTML = "";

  activeAvatarEl.src = "";
  activeNameEl.innerText =
    "Nenhum chat";

  statusTextEl.innerText =
    "Offline";

  document
  .querySelectorAll(".contact")
  .forEach(function(c) {

    c.classList.remove("active");
  });
}

function renderMessages() {

  messagesAreaEl.innerHTML = "";

  renderedMessages = [];

  allMessages.forEach(function(msg) {

    if (!activeChatId) return;

    const privateChat =
      (
        msg.from === userId &&
        msg.to === activeChatId
      ) ||
      (
        msg.from === activeChatId &&
        msg.to === userId
      );

    if (privateChat) {

      const key =
        getMessageKey(msg);

      if (
        renderedMessages.indexOf(key)
        !== -1
      ) {
        return;
      }

      renderedMessages.push(key);

      createMessage(
        msg,
        msg.from === userId
      );
    }

  });
}

function createMessage(msg, isOwn) {

  const key =
    getMessageKey(msg);

  if (
    document.querySelector(
      '[data-msg-key="' +
      key +
      '"]'
    )
  ) {
    return;
  }

  const msgEl =
    document.createElement("div");

  msgEl.className =
    "msg " +
    (isOwn ? "own" : "other");

  msgEl.dataset.msgKey =
    key;

  const header =
    document.createElement("div");

  header.className =
    "msg-header";

  const avatarEl =
    document.createElement("img");

  avatarEl.className =
    "avatar-xs";

  avatarEl.src = msg.avatar;

  const name =
    document.createElement("div");

  name.className = "msg-name";
  name.innerText = msg.username;

  const time =
    document.createElement("div");

  time.className = "msg-time";

  const d =
    new Date(msg.timestamp);

  time.innerText =
    d.toLocaleTimeString(
      "pt-BR",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );

  header.appendChild(avatarEl);
  header.appendChild(name);
  header.appendChild(time);

  msgEl.appendChild(header);

  if (msg.text) {

    const text =
      document.createElement("div");

    text.className =
      "msg-text";

    text.innerText = msg.text;

    msgEl.appendChild(text);
  }

  if (msg.image) {

    const media =
      document.createElement("div");

    media.className =
      "media-preview";

    const img =
      document.createElement("img");

    img.src = msg.image;

    media.appendChild(img);

    msgEl.appendChild(media);
  }

  if (msg.video) {

    const media =
      document.createElement("div");

    media.className =
      "media-preview";

    const video =
      document.createElement("video");

    video.src = msg.video;
    video.controls = true;

    media.appendChild(video);

    msgEl.appendChild(media);
  }

  if (msg.audio) {

    const media =
      document.createElement("div");

    media.className =
      "media-preview";

    const audio =
      document.createElement("audio");

    audio.src = msg.audio;
    audio.controls = true;
    audio.autoplay = false;

    media.appendChild(audio);

    msgEl.appendChild(media);
  }

  if (msg.from === userId) {

    msgEl.oncontextmenu =
      function(e) {

      e.preventDefault();

      selectedMessageId =
        msg.id;

      popupMenu.style.display =
        "block";

      popupMenu.style.left =
        e.pageX + "px";

      popupMenu.style.top =
        e.pageY + "px";
    };
  }

  messagesAreaEl.appendChild(msgEl);

  messagesAreaEl.scrollTop =
    messagesAreaEl.scrollHeight;
}

deleteBtn.onclick =
  function() {

  if (!selectedMessageId)
    return;

  socket.emit(
    "delete_message",
    {
      id: selectedMessageId
    }
  );

  popupMenu.style.display =
    "none";

  selectedMessageId = null;
};

document.onclick =
  function() {

  popupMenu.style.display =
    "none";
};

function sendMessage() {

  if (!socket.connected) {

    alert(
      "Servidor offline"
    );

    return;
  }

  const text =
    messageInputEl.value.trim();

  const file =
    mediaInputEl.files[0];

  if (!text && !file)
    return;

  if (!activeChatId) {

    alert(
      "Usuário offline"
    );

    return;
  }

  if (
    !isUserOnline(
      activeChatId
    )
  ) {

    alert(
      "Usuário offline"
    );

    closeConversation();

    return;
  }

  if (file) {

    if (
      file.size >
      15 * 1024 * 1024
    ) {

      alert(
        "Arquivo muito grande"
      );

      return;
    }

    const reader =
      new FileReader();

    reader.onload =
      function(e) {

      let image = null;
      let video = null;
      let audio = null;

      if (
        file.type.indexOf(
          "image/"
        ) === 0
      ) {
        image =
          e.target.result;
      }

      if (
        file.type.indexOf(
          "video/"
        ) === 0
      ) {
        video =
          e.target.result;
      }

      if (
        file.type.indexOf(
          "audio/"
        ) === 0
      ) {
        audio =
          e.target.result;
      }

      socket.emit(
        "send_message",
        {
          to: activeChatId,
          text: text,
          image: image,
          video: video,
          audio: audio
        }
      );

      messageInputEl.value =
        "";

      mediaInputEl.value =
        "";

      updateSendButton();
    };

    reader.readAsDataURL(file);

  } else {

    socket.emit(
      "send_message",
      {
        to: activeChatId,
        text: text
      }
    );

    messageInputEl.value =
      "";

    updateSendButton();
  }
}

async function startRecording() {

  if (isRecording)
    return;

  try {

    recordingStream =
      await navigator
      .mediaDevices
      .getUserMedia({
        audio: true
      });

    audioChunks = [];

    mediaRecorder =
      new MediaRecorder(
        recordingStream
      );

    mediaRecorder.ondataavailable =
      function(e) {

      audioChunks.push(
        e.data
      );
    };

    mediaRecorder.start();

    isRecording = true;

    sendBtn.innerText =
      "Enviar";

    cancelRecordBtn.style.display =
      "block";

  } catch(e) {

    alert(
      "Microfone negado"
    );
  }
}

function cancelRecording() {

  if (!mediaRecorder)
    return;

  mediaRecorder.stop();

  if (recordingStream) {

    recordingStream
    .getTracks()
    .forEach(
      function(track) {

      track.stop();
    });
  }

  audioChunks = [];

  isRecording = false;

  cancelRecordBtn.style.display =
    "none";

  updateSendButton();
}

async function stopRecordingAndSend() {

  if (!mediaRecorder)
    return;

  mediaRecorder.onstop =
    function() {

    const blob =
      new Blob(
        audioChunks,
        {
          type:
            "audio/webm"
        }
      );

      const reader =
        new FileReader();

      reader.onload =
        function() {

        socket.emit(
          "send_message",
          {
            to:
              activeChatId,
            text: "",
            image: null,
            video: null,
            audio:
              reader.result
          }
        );
      };

      reader.readAsDataURL(
        blob
      );

      if (
        recordingStream
      ) {

        recordingStream
        .getTracks()
        .forEach(
          function(track) {

          track.stop();
        });
      }

      audioChunks = [];

      isRecording = false;

      cancelRecordBtn.style.display =
        "none";

      updateSendButton();
    };

    mediaRecorder.stop();
}

function updateCallButton() {

  if (!callBtn)
    return;

  if (inCall) {

    callBtn.style.background =
      "#ef4444";

    callBtn.innerText =
      "❌";

  } else {

    callBtn.style.background =
      "#10b981";

    callBtn.innerText =
      "📞";
  }
}

async function createPeer() {

  peerConnection =
    new RTCPeerConnection(
      rtcConfig
    );

  peerConnection.onicecandidate =
    function(event) {

      if (
        event.candidate
      ) {

        socket.emit(
          "ice_candidate",
          {
            to:
              currentCallUser,
            candidate:
              event.candidate
          }
        );
      }
    };

  peerConnection.onconnectionstatechange =
    function() {

      if (
        peerConnection
      ) {

        if (
          peerConnection.connectionState ===
          "disconnected"
        ) {

          endCall();
        }

        if (
          peerConnection.connectionState ===
          "failed"
        ) {

          endCall();
        }
      }
    };

  peerConnection.ontrack =
    function(event) {

      if (
        !remoteAudio
      ) {

        remoteAudio =
          document.createElement(
            "audio"
          );

        remoteAudio.autoplay =
          true;

        remoteAudio.controls =
          false;

        document.body.appendChild(
          remoteAudio
        );
      }

      remoteAudio.srcObject =
        event.streams[0];

      remoteAudio.play();
    };

  localStream =
    await navigator
    .mediaDevices
    .getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

  localStream
  .getTracks()
  .forEach(function(track) {

    peerConnection.addTrack(
      track,
      localStream
    );
  });
}

function endCall() {

  inCall = false;

  updateCallButton();

  if (peerConnection) {

    peerConnection.close();

    peerConnection =
      null;
  }

  if (localStream) {

    localStream
    .getTracks()
    .forEach(function(track) {

      track.stop();
    });

    localStream = null;
  }

  if (remoteAudio) {

    remoteAudio.pause();

    remoteAudio.srcObject =
      null;

    remoteAudio.remove();

    remoteAudio = null;
  }

  if (
    currentCallUser
  ) {

    socket.emit(
      "call_ended",
      {
        to:
          currentCallUser
      }
    );
  }

  currentCallUser =
    null;
}

async function callVoice() {

  if (inCall) {

    endCall();

    return;
  }

  if (!activeChatId)
    return;

  currentCallUser =
    activeChatId;

  await createPeer();

  const offer =
    await peerConnection
    .createOffer({
      offerToReceiveAudio: true
    });

  await peerConnection
  .setLocalDescription(
    offer
  );

  socket.emit(
    "call_request",
    {
      to:
        activeChatId,

      type:
        "voice",

      offer:
        offer
    }
  );
}

messageInputEl
.addEventListener(
  "keypress",
  function(e) {

    if (
      e.key === "Enter"
    ) {

      sendMessage();
    }
  }
);

messageInputEl
.addEventListener(
  "input",
  function() {

    updateSendButton();

    if (
      !activeChatId
    ) return;

    socket.emit(
      "typing",
      {
        to:
          activeChatId
      }
    );
  }
);

mediaInputEl
.addEventListener(
  "change",
  function() {

    updateSendButton();
  }
);

sendBtn.onclick =
  async function() {

  const text =
    messageInputEl.value.trim();

  const file =
    mediaInputEl.files[0];

  if (
    text.length > 0 ||
    file
  ) {

    sendMessage();

    return;
  }

  if (
    !activeChatId
  ) {

    alert(
      "Selecione um usuário"
    );

    return;
  }

  if (
    !isRecording
  ) {

    startRecording();

  } else {

    stopRecordingAndSend();
  }
};

cancelRecordBtn.onclick =
  function() {

  cancelRecording();
};

socket.on(
  "users_list",
  function(list) {

    onlineUsers =
      list;

    contactsListEl.innerHTML =
      "";

    let activeStillOnline =
      false;

    list.forEach(function(u) {

      if (
        u.id === userId
      ) return;

      if (
        activeChatId ===
        u.id
      ) {

        activeStillOnline =
          true;
      }

      const el =
        document.createElement(
          "div"
        );

      el.className =
        "contact";

      el.dataset.contactId =
        u.id;

      const avatarEl =
        document.createElement(
          "img"
        );

      avatarEl.className =
        "contact-avatar online";

      avatarEl.src =
        u.avatar;

      const info =
        document.createElement(
          "div"
        );

      info.className =
        "contact-info";

      const name =
        document.createElement(
          "div"
        );

      name.className =
        "contact-name";

      name.innerText =
        u.username;

      const status =
        document.createElement(
          "div"
        );

      status.className =
        "contact-status";

      status.innerText =
        "Online";

      info.appendChild(name);

      info.appendChild(status);

      el.appendChild(
        avatarEl
      );

      el.appendChild(info);

      el.onclick =
        function() {

        activeChatId =
          u.id;

        document
        .querySelectorAll(
          ".contact"
        )
        .forEach(
          function(c) {

          c.classList.remove(
            "active"
          );
        });

        el.classList.add(
          "active"
        );

        activeAvatarEl.src =
          u.avatar;

        activeNameEl.innerText =
          u.username;

        statusTextEl.innerText =
          "Online";

        renderMessages();
      };

      contactsListEl
      .appendChild(el);
    });

    if (
      activeChatId &&
      !activeStillOnline
    ) {

      closeConversation();
    }
  }
);

socket.on(
  "messages_history",
  function(list) {

    const unique = [];

    list.forEach(function(msg) {

      const exists =
        unique.find(
          function(m) {

          return (
            getMessageKey(
              m
            ) ===
            getMessageKey(
              msg
            )
          );
        });

      if (!exists) {

        unique.push(
          msg
        );
      }
    });

    allMessages =
      unique;

    renderMessages();
  }
);

socket.on(
  "message",
  function(msg) {

    const exists =
      allMessages.find(
        function(m) {

        return (
          getMessageKey(
            m
          ) ===
          getMessageKey(
            msg
          )
        );
      });

    if (exists)
      return;

    allMessages.push(msg);

    const privateChat =
      (
        msg.from ===
        userId &&
        msg.to ===
        activeChatId
      ) ||
      (
        msg.from ===
        activeChatId &&
        msg.to ===
        userId
      );

    if (
      privateChat
    ) {

      createMessage(
        msg,
        msg.from ===
        userId
      );
    }
  }
);

socket.on(
  "message_deleted",
  function(data) {

    allMessages =
      allMessages.filter(
        function(msg) {

        return (
          msg.id !==
          data.id
        );
      });

    renderMessages();
  }
);

socket.on(
  "typing",
  function(data) {

    const contact =
      document.querySelector(
        '[data-contact-id="' +
        data.from +
        '"]'
      );

    if (!contact)
      return;

    let label =
      contact.querySelector(
        ".typing-label"
      );

    if (!label) {

      label =
        document.createElement(
          "div"
        );

      label.className =
        "typing-label";

      label.innerText =
        "digitando...";

      contact.appendChild(
        label
      );
    }

    clearTimeout(
      label.timeout
    );

    label.timeout =
      setTimeout(
        function() {

        if (label) {

          label.remove();
        }

      },
      2000
    );
  }
);

socket.on(
  "call_request",
  async function(data) {

    if (
      data.to !==
      userId
    ) return;

    currentCallUser =
      data.from.id;

    const ok =
      confirm(
        data.from
        .username +
        " está ligando"
      );

    if (!ok) {

      socket.emit(
        "call_response",
        {
          to:
            data.from.id,
          accepted:
            false
        }
      );

      return;
    }

    await createPeer();

    await peerConnection
    .setRemoteDescription(
      new RTCSessionDescription(
        data.offer
      )
    );

    const answer =
      await peerConnection
      .createAnswer();

    await peerConnection
    .setLocalDescription(
      answer
    );

    inCall = true;

    updateCallButton();

    socket.emit(
      "call_response",
      {
        to:
          data.from.id,

        accepted:
          true,

        answer:
          answer
      }
    );
  }
);

socket.on(
  "call_response",
  async function(data) {

    if (
      data.to !==
      userId
    ) return;

    if (
      !data.accepted
    ) {

      alert(
        data.from
        .username +
        " recusou a chamada"
      );

      endCall();

      return;
    }

    await peerConnection
    .setRemoteDescription(
      new RTCSessionDescription(
        data.answer
      )
    );

    inCall = true;

    updateCallButton();

    alert(
      "Chamada conectada com " +
      data.from
      .username
    );
  }
);

socket.on(
  "call_ended",
  function(data) {

    if (
      data.to !==
      userId
    ) return;

    alert(
      "Chamada encerrada"
    );

    endCall();
  }
);

socket.on(
  "ice_candidate",
  async function(data) {

    if (
      data.to !==
      userId ||
      !peerConnection
    ) return;

    try {

      await peerConnection
      .addIceCandidate(
        new RTCIceCandidate(
          data.candidate
        )
      );

    } catch(e) {

    }
  }
);

socket.on(
  "connect",
  function() {

    statusTextEl.innerText =
      "Online";

    socket.emit(
      "login",
      {
        id:
          userId,

        username:
          username,

        avatar:
          avatar
      }
    );
  }
);

socket.on(
  "disconnect",
  function() {

    statusTextEl.innerText =
      "Reconectando...";
  }
);

callBtn.onclick =
  function() {

  callVoice();
};

updateCallButton();
updateSendButton();
