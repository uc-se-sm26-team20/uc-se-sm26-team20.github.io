
// =============================================================================
// EECE/CS 3093C Software Engineering
// server.js — code skeleton provided by Phu Phung
// complete implementation by Team 20
// =============================================================================
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; \
                  script-src 'self' https://cdnjs.cloudflare.com; \
                  style-src 'self' 'unsafe-inline'; \
                  connect-src 'self' https://cdnjs.cloudflare.com"
                );
  next();
});

app.use(express.static(path.join(__dirname, 'ui')));

const PORT = process.env.PORT || 8081;
server.listen(PORT, () => console.log('Server running on port ' + PORT));

// In-memory store: socketId → username
const userlist = new Map();

io.on('connection', (socket) => {

  // Auto-assign a unique username from the socket ID
  const username = 'User_' + socket.id.slice(-5);
  userlist.set(socket.id, username);
  console.log('New client connected - socket ID: ' + socket.id )

  //Todo: UC-02 (AC-02.1): notify all connected clients that a new user joined
  io.emit('status', username + ' joined the chat. Number of connected clients: ' + userlist.size);

  // ---------------------------------------------------------------------------
  // Use-Case-01: Send message
  //
  // AC-01.1: a username is always assigned on connection — every sender
  //          is identified before any message can be sent
  // AC-01.2: empty or non-string messages are ignored — no broadcast is sent
  // AC-01.3: the message is broadcast to ALL connected clients
  // AC-01.4: the broadcast payload includes the sender's username and the text
  // AC-01.5: input is cleared after sending (enforced client-side)
  // ---------------------------------------------------------------------------
  socket.on('message', (data) => {
      if (!data || data.trim() === "") return; //AC-01.2
      const sender = userlist.get(socket.id);
      console.log(`Debug> "${sender} sent: ${data}"`);
      io.emit('message', sender + 'says: ' + data.trim()) //AC-01.3 and AC-01.4
      
  });

  // ---------------------------------------------------------------------------
  // Use-Case-02: Receive message — disconnect notification
  // ---------------------------------------------------------------------------
  socket.on('disconnect', () => {
    const username = userlist.get(socket.id);
    userlist.delete(socket.id);
    console.log('Client disconnected - socket ID: ' + socket.id);
    io.emit('status', username + ' left the chat. Number of connected clients: ' + userlist.size);
  });
});