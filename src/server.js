/* =============================================================================
 * EECE/CS 3093C Software Engineering — Team 20 Messenger
 * server.js — code skeleton provided by Dr. Phu Phung
 * Team implementation by EECE/CS 3093C Team 20
 * =============================================================================
 */

"use strict";

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 8092;

// In-memory collection that maps each Socket.IO ID to a username.
const userlist = new Map();

const typingUsers = new Set();
const userGroups = new Map();
const availableGroups = [];
const reservedGroupNames = new Set(["global", "public chat"]);

// =============================================================================
// Lecture 11: Content Security Policy
// =============================================================================

/*
 * AC-02.6:
 * Add a Content-Security-Policy header to every response.
 *
 * This provides browser-level defense in depth against unauthorized
 * scripts and must appear before express.static(...).
 */
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' https://cdnjs.cloudflare.com; " +
      "style-src 'self' 'unsafe-inline'; " +
      "connect-src 'self' https://cdnjs.cloudflare.com"
  );

  next();
});

// Serve the messenger files contained in src/ui.
app.use(express.static(path.join(__dirname, "ui")));

// =============================================================================
// Socket.IO client connections
// =============================================================================

io.on("connection", (socket) => {
  console.log("New connection established - socket ID: " + socket.id);

  // AC-02.3: notify all connected users that someone joined after they provide a name.
  socket.on("join", (chosenUsername) => {
    if (typeof chosenUsername !== "string" || !chosenUsername.trim()) {
      return;
    }

    const name = chosenUsername.trim();
    userlist.set(socket.id, name);

    if (!userGroups.has(name)) {
      userGroups.set(name, new Set());
    }

    console.log(
      "New client connected - socket ID: " +
        socket.id +
        ", username: " +
        name
    );

    io.emit(
      "connected-users",
      Array.from(userlist.values())
    );
    emitOnlineUsers();

    io.emit(
      "status",
      name + " joined the chat. Active users: " + userlist.size
    );

    socket.emit(
      "user-groups",
      Array.from(userGroups.get(name))
    );
  });

  socket.on("typing", () => {
    const username = userlist.get(socket.id) || "Unknown user";
    typingUsers.add(username);

    io.emit("typingUsers", Array.from(typingUsers));
  });

  socket.on("stopTyping", () => {
    const username = userlist.get(socket.id) || "Unknown user";
    typingUsers.delete(username);

    io.emit("typingUsers", Array.from(typingUsers));
  });

  socket.on("add-user-group", (data) => {
    updateUserGroup(socket, data, "add");
  });

  socket.on("delete-user-group", (data) => {
    updateUserGroup(socket, data, "delete");
  });

  socket.on("create-group", (groupName) => {
    createGroup(socket, groupName);
  });

  // ===========================================================================
  // Use-Case-01: Send Message
  // ===========================================================================

  socket.on("message", (data) => {
    // AC-01.2: ignore invalid and empty messages.
    if (
      !data ||
      typeof data.message !== "string"
    ) {
      return;
    }

    const message = data.message.trim();
    const group =
      typeof data.group === "string" ? data.group.trim() : "";

    if (!message) {
      return;
    }

    // AC-01.1 and AC-01.4: identify the sender.
    const sender =
      userlist.get(socket.id) || "Unknown user";

    if (!group) {
      console.log(
        'Debug> "' + sender + '" sent to public chat: ' + message
      );

      io.emit(
        "message",
        "[Public] " + sender + " says: " + message
      );
      return;
    }

    if (!availableGroups.includes(group)) {
      return;
    }

    const senderGroups = userGroups.get(sender) || new Set();

    if (!senderGroups.has(group)) {
      socket.emit(
        "status",
        "You are not in the " + group + " group."
      );
      return;
    }

    console.log(
      'Debug> "' + sender + '" sent to ' + group + ": " + message
    );

    sendToGroup(
      group,
      "message",
      "[" + group + "] " + sender + " says: " + message
    );
  });


  socket.on("private-message", (data) => {
    if (!data || typeof data !== "object") {
      return;
    }

    const recipientSocketId = data.recipientSocketId;
    const message = String(data.message || "").trim();

    if (!recipientSocketId || !message) {
      return;
    }

    const sender = userlist.get(socket.id) || "Unknown user";
    const recipient = userlist.get(recipientSocketId);

    if (!recipient) {
      socket.emit("private-message", {
        from: "System",
        to: sender,
        message: "That user is no longer online."
      });
      return;
    }

    const privateMessage = {
      from: sender,
      to: recipient,
      message: message
    };

    socket.emit("private-message", privateMessage);
    io.to(recipientSocketId).emit("private-message", privateMessage);
  });


  // ===========================================================================
  // Use-Case-02: Disconnect notification
  // ===========================================================================




  socket.on("disconnect", () => {
    const disconnectedUsername = userlist.get(socket.id);

    if (!disconnectedUsername) {
      return;
    }

    userlist.delete(socket.id);
    typingUsers.delete(disconnectedUsername);

    io.emit(
      "typingUsers",
      Array.from(typingUsers)
    );

    io.emit(
      "connected-users",
      Array.from(userlist.values())
    );
    emitOnlineUsers();

    console.log(
      "Client disconnected - socket ID: " +
        socket.id +
        ", username: " +
        disconnectedUsername
    );

    // Notify remaining clients that the user left.
    io.emit(
      "status",
      disconnectedUsername +
        " left the chat. Active users: " +
        userlist.size
    );
  });
});

// =============================================================================
// Start the application
// =============================================================================

server.listen(PORT, () => {
  console.log(
    "Team 20 Messenger server running on port " + PORT
  );
});

function updateUserGroup(socket, data, action) {
  if (
    !data ||
    typeof data.username !== "string" ||
    typeof data.group !== "string"
  ) {
    return;
  }

  const username = data.username.trim();
  const group = data.group.trim();
  const requester = userlist.get(socket.id);
  const requesterGroups = userGroups.get(requester) || new Set();

  if (!username || !availableGroups.includes(group)) {
    return;
  }

  if (!requesterGroups.has(group)) {
    socket.emit(
      "group-update-status",
      "You must be in " + group + " to update its members."
    );
    return;
  }

  const groups = userGroups.get(username) || new Set();

  if (action === "add") {
    groups.add(group);
  }
  else {
    groups.delete(group);
  }

  userGroups.set(username, groups);

  socket.emit(
    "group-update-status",
    username +
      " groups: " +
      (Array.from(groups).join(", ") || "none")
  );

  sendUserGroups(username);
  sendToUser(
    username,
    "status",
    "You were " +
      (action === "add" ? "added to " : "removed from ") +
      group +
      "."
  );
}

function createGroup(socket, groupName) {
  if (typeof groupName !== "string" || !groupName.trim()) {
    return;
  }

  const creator = userlist.get(socket.id);

  if (!creator) {
    return;
  }

  const group = groupName.trim();

  if (reservedGroupNames.has(group.toLowerCase())) {
    socket.emit("group-update-status", "Choose a different group name.");
    return;
  }

  if (availableGroups.includes(group)) {
    socket.emit("group-update-status", "Group already exists: " + group);
    return;
  }

  availableGroups.push(group);
  const creatorGroups = userGroups.get(creator) || new Set();
  creatorGroups.add(group);
  userGroups.set(creator, creatorGroups);

  sendUserGroups(creator);
  socket.emit("group-update-status", "Group created: " + group);
}

function sendUserGroups(username) {
  const groups = Array.from(userGroups.get(username) || []);

  sendToUser(username, "user-groups", groups);
}

function sendToGroup(group, eventName, payload) {
  userlist.forEach((connectedUsername, socketId) => {
    const groups = userGroups.get(connectedUsername) || new Set();

    if (groups.has(group)) {
      io.to(socketId).emit(eventName, payload);
    }
  });
}

function sendToUser(username, eventName, payload) {
  userlist.forEach((connectedUsername, socketId) => {
    if (connectedUsername === username) {
      io.to(socketId).emit(eventName, payload);
    }
  });
}

function emitOnlineUsers() {
  const users = Array.from(userlist, ([socketId, username]) => ({
    socketId,
    username
  }));

  io.emit("online-users", users);
}
