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

const PORT = process.env.PORT || 8080;

// In-memory collection that maps each Socket.IO ID to a username.
const userlist = new Map();

const typingUsers = new Set();

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

    io.emit(
      "status",
      name + " joined the chat. Active users: " + userlist.size
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

  // ===========================================================================
  // Use-Case-01: Send Message
  // ===========================================================================

  socket.on("message", (data) => {
    // AC-01.2: ignore non-string and empty messages.
    if (typeof data !== "string") {
      return;
    }

    const message = data.trim();

    if (!message) {
      return;
    }

    // AC-01.1 and AC-01.4: identify the sender.
    const sender =
      userlist.get(socket.id) || "Unknown user";

    console.log(
      'Debug> "' + sender + '" sent: ' + message
    );

    // AC-01.3: broadcast the message to every connected client.
    io.emit(
      "message",
      sender + " says: " + message
    );
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