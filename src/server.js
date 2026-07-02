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

function sendOnlineUsers() {
  const users = Array.from(userlist, ([socketId, username]) => ({
    socketId,
    username
  }));

  io.emit("online-users", users);
}

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
  // Create a readable username from the client's unique socket ID.
  const socketIdentifier = socket.id
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-5)
    .toUpperCase();

  const username =
    "User_" + (socketIdentifier || "00000");

  userlist.set(socket.id, username);
  sendOnlineUsers();


  console.log(
    "New client connected - socket ID: " +
      socket.id +
      ", username: " +
      username
  );

  // AC-02.3: notify all connected users that someone joined.
  io.emit(
    "status",
    username +
      " joined the chat. Number of connected clients: " +
      userlist.size
  );

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
    const disconnectedUsername =
      userlist.get(socket.id) || "Unknown user";

    userlist.delete(socket.id);
    sendOnlineUsers();


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
        " left the chat. Number of connected clients: " +
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