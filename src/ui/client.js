/* =============================================================================
 * EECE/CS 3093C Software Engineering — Team 20 Messenger
 * client.js — code skeleton provided by Dr. Phu Phung
 * Team implementation by EECE/CS 3093C Team 20
 * =============================================================================
 */

"use strict";

// Connect to the Socket.IO server that served this page.
const socket = io();

// =============================================================================
// UI DOM references
// =============================================================================

const sendButtonElement = document.getElementById("send-button");
const chatMessageInput = document.getElementById("chat-message");
const responsesElement = document.getElementById("responses");
const statusElement = document.getElementById("status");
const privateResponsesElement = document.getElementById("private-responses");
const privateChatInput = document.getElementById("private-chat-message");
const privateSendButton = document.getElementById("private-send-button");
const privateUserSelect = document.getElementById("private-user-select");
const loginScreen = document.getElementById("login-screen");
const mainChat = document.getElementById("main-chat");
const joinButton = document.getElementById("join-button");
const usernameInput = document.getElementById("username");
const groupTabsContainer = document.querySelector(".group-tabs");
const newGroupInput = document.getElementById("new-group-name");
const createGroupButton = document.getElementById("create-group-button");
const groupAccountInput = document.getElementById("group-account-name");
const addUserGroupButton = document.getElementById("add-user-group-button");
const deleteUserGroupButton = document.getElementById(
  "delete-user-group-button"
);
const groupUpdateMessage = document.getElementById("group-update-message");
const myGroupsElement = document.getElementById("my-groups");
const onlineUsersCountElement = document.getElementById("online-users-count");
const onlineUsersListElement = document.getElementById("online-users-list");

const typingIndicator = document.getElementById("typing-indicator");
let typingTimer;
let isTyping = false;
let selectedGroup = "";

if (
  !sendButtonElement ||
  !chatMessageInput ||
  !responsesElement ||
  !statusElement ||
  !privateResponsesElement ||
  !privateChatInput ||
  !privateSendButton ||
  !privateUserSelect ||
  !loginScreen ||
  !mainChat ||
  !joinButton ||
  !usernameInput ||
  !groupTabsContainer ||
  !newGroupInput ||
  !createGroupButton ||
  !groupAccountInput ||
  !addUserGroupButton ||
  !deleteUserGroupButton ||
  !groupUpdateMessage ||
  !myGroupsElement ||
  !onlineUsersCountElement ||
  !onlineUsersListElement
) {
  throw new Error("One or more required messenger UI elements are missing.");
}

// =============================================================================
// Socket.IO connection events
// =============================================================================

socket.on("connect", () => {
  console.log(
    `Connected to Socket.IO server. Socket ID: ${socket.id}`
  );
});

socket.on("connect_error", (error) => {
  console.error(
    `Socket.IO connection failed: ${error.message}`
  );
});

// =============================================================================
// User input events
// =============================================================================

joinButton.addEventListener("click", joinChat);

// Allow joining by pressing Enter in the username field.
usernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    joinChat();
  }
});

// AC-01.1: clicking the Send button submits the current message.
sendButtonElement.addEventListener("click", sendMessage);

// Pressing Enter also sends the current message.
chatMessageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

chatMessageInput.addEventListener(
  "input",
  () => {
    if (!isTyping) {
      isTyping = true;
      socket.emit("typing");
    }

    clearTimeout(typingTimer);

    typingTimer = setTimeout(() => {
      isTyping = false;
      socket.emit("stopTyping");
    }, 1000);
  }
);

groupTabsContainer.addEventListener("click", (event) => {
  const tab = event.target.closest(".group-tab");

  if (!tab) {
    return;
  }

  selectGroup(tab.textContent.trim());
});

createGroupButton.addEventListener("click", () => {
  const groupName = newGroupInput.value.trim();

  if (!groupName) {
    groupUpdateMessage.textContent = "Enter a group name first.";
    return;
  }

  socket.emit("create-group", groupName);
  newGroupInput.value = "";
});

addUserGroupButton.addEventListener("click", () => {
  updateUserGroup("add-user-group");
});

deleteUserGroupButton.addEventListener("click", () => {
  updateUserGroup("delete-user-group");
});

// =============================================================================
// Use-Case: Join Chat
// =============================================================================

function joinChat() {
  const username = usernameInput.value.trim();

  // Basic validation for the username.
  if (!username) {
    alert("Please enter a username to join the chat.");
    return;
  }

  console.log(`Debug> User joining as: ${username}`);

  // Switch views by toggling the "hidden" class defined in CSS.
  loginScreen.classList.add("hidden");
  mainChat.classList.remove("hidden");

  // Inform the server about the new user.
  socket.emit("join", username);

  // Set focus to the message input for immediate typing.
  chatMessageInput.focus();
}

// =============================================================================
// Private chat input events
// =============================================================================

privateSendButton.addEventListener("click", sendPrivateMessage);

privateChatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendPrivateMessage();
  }
});

// =============================================================================
// Use-Case-01: Send Message
// =============================================================================

function sendMessage() {
  const message = chatMessageInput.value.trim();

  // AC-01.2: empty messages are ignored.
  if (!message) {
    return;
  }

  if (!selectedGroup) {
    groupUpdateMessage.textContent = "Select a group chat first.";
    return;
  }

  console.log(`Debug> Chat message: ${message}`);

  // AC-01.3: send the message to the selected group.
  socket.emit("message", {
    group: selectedGroup,
    message
  });

  // AC-01.5: clear and refocus the input after sending.
  chatMessageInput.value = "";
  chatMessageInput.focus();

  socket.emit("stopTyping");
  isTyping = false;
}

function updateUserGroup(eventName) {
  const username = groupAccountInput.value.trim();

  if (!selectedGroup) {
    groupUpdateMessage.textContent = "Select a group chat first.";
    return;
  }

  if (!username) {
    groupUpdateMessage.textContent = "Enter a username first.";
    return;
  }

  socket.emit(eventName, {
    username,
    group: selectedGroup
  });
}

function renderGroupTabs(groups) {
  if (!Array.isArray(groups)) {
    return;
  }

  if (!groups.includes(selectedGroup)) {
    selectedGroup = groups[0] || "";
  }

  groupTabsContainer.innerHTML = "";

  groups.forEach((group) => {
    const tab = document.createElement("button");
    tab.className = "group-tab";
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.textContent = group;

    if (group === selectedGroup) {
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
    }
    else {
      tab.setAttribute("aria-selected", "false");
    }

    groupTabsContainer.appendChild(tab);
  });
}

function selectGroup(group) {
  selectedGroup = group;

  document.querySelectorAll(".group-tab").forEach((tab) => {
    const isSelected = tab.textContent.trim() === selectedGroup;
    tab.classList.toggle("active", isSelected);
    tab.setAttribute("aria-selected", String(isSelected));
  });
}

// =============================================================================
// Online users display
// =============================================================================

socket.on("connected-users", renderConnectedUsers);

function renderConnectedUsers(users) {
  if (!Array.isArray(users)) {
    return;
  }

  onlineUsersCountElement.textContent =
    users.length === 1
      ? "1 user online"
      : users.length + " users online";

  onlineUsersListElement.innerHTML = "";

  users.forEach((username) => {
    const userElement = document.createElement("li");
    userElement.textContent = String(username);
    onlineUsersListElement.appendChild(userElement);
  });
}

// =============================================================================
// Use-Case-02: Receive Message
// =============================================================================

// AC-02.1: display incoming messages without refreshing the page.
socket.on("message", displayMessage);

function displayMessage(data) {
  const messageElement = document.createElement("div");
  const timestamp = new Date().toLocaleTimeString();

  /*
   * AC-02.5:
   * Sanitize incoming content before inserting it into the page.
   * This prevents injected HTML or JavaScript from executing.
   */
  const sanitizedMessage = DOMPurify.sanitize(String(data));

  messageElement.innerHTML =
    '<span class="message-time">[' +
    timestamp +
    "]</span> " +
    sanitizedMessage;

  responsesElement.appendChild(messageElement);

  // AC-02.4: keep the newest message visible.
  responsesElement.scrollTop = responsesElement.scrollHeight;
}

// =============================================================================
// System status events
// =============================================================================

// AC-02.3: display join and leave events separately from chat messages.
socket.on("status", displayStatus);

socket.on("group-update-status", (message) => {
  groupUpdateMessage.textContent = message;
});

socket.on("user-groups", (groups) => {
  renderGroupTabs(groups);

  if (!Array.isArray(groups) || groups.length === 0) {
    myGroupsElement.textContent = "My group chats: none";
    return;
  }

  myGroupsElement.textContent = "My group chats: " + groups.join(", ");
});

function displayStatus(data) {
  const statusMessageElement = document.createElement("div");
  const timestamp = new Date().toLocaleTimeString();

  /*
   * AC-02.5:
   * Sanitize system-status content before inserting it into the page.
   */
  const sanitizedStatus = DOMPurify.sanitize(String(data));

  statusMessageElement.innerHTML =
    '<span class="status-time">[' +
    timestamp +
    "]</span> " +
    sanitizedStatus;

  statusElement.appendChild(statusMessageElement);

  // AC-02.4: keep the newest status event visible.
  statusElement.scrollTop = statusElement.scrollHeight;
}
// =============================================================================
// Use-Case-03: Private Messages
// =============================================================================

function sendPrivateMessage() {
  const recipientSocketId = privateUserSelect.value;
  const message = privateChatInput.value.trim();

  if (!recipientSocketId || !message) {
    return;
  }

  socket.emit("private-message", {
    recipientSocketId,
    message
  });

  privateChatInput.value = "";
  privateChatInput.focus();
}// =============================================================================
// Receive Online User List
// =============================================================================

socket.on("online-users", (users) => {
  privateUserSelect.innerHTML =
    '<option value="">Select a user</option>';

  users.forEach((user) => {
    if (user.socketId === socket.id) {
      return;
    }

    const option = document.createElement("option");
    option.value = user.socketId;
    option.textContent = user.username;

    privateUserSelect.appendChild(option);
  });
});


// =============================================================================
// Receive Private Messages
// =============================================================================

socket.on("private-message", displayPrivateMessage);

function displayPrivateMessage(data) {
  const messageElement = document.createElement("div");
  const timestamp = new Date().toLocaleTimeString();

  const from = DOMPurify.sanitize(String(data.from));
  const to = DOMPurify.sanitize(String(data.to));
  const message = DOMPurify.sanitize(String(data.message));

  messageElement.innerHTML =
    '<span class="message-time">[' +
    timestamp +
    ']</span> <strong>Private</strong> ' +
    from +
    ' → ' +
    to +
    ': ' +
    message;

  privateResponsesElement.appendChild(messageElement);

  privateResponsesElement.scrollTop =
    privateResponsesElement.scrollHeight;
}

socket.on("typingUsers", (users) => {
  if (users.length === 0) {
    typingIndicator.textContent = "";
  }
  else if (users.length === 1) {
    typingIndicator.textContent = users[0] + " is typing...";
  }
  else {
    typingIndicator.textContent = users.join(", ") + " are typing...";
  }
});
