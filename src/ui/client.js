/* =============================================================================
 * EECE/CS 3093C Software Engineering — Team 20 Messenger
 * client.js — Authentication + Team 20 Messenger Merge
 * =============================================================================
 */

"use strict";

const socket = io();

let currentUsername = "";
let selectedGroup = "";

let typingTimer = null;
let isTyping = false;


// =============================================================================
// Socket Connection
// =============================================================================

socket.on("connect", () => {
  console.log(
    "Connected to Socket.IO server: " + socket.id
  );
});


socket.on("connect_error", (error) => {
  console.error(
    "Socket connection failed:",
    error.message
  );
});


// =============================================================================
// DOM References
// =============================================================================


// Authentication

const loginUI = document.getElementById("loginUI");
const registerUI = document.getElementById("registerUI");
const chatUI = document.getElementById("chatUI");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

const joinButton = document.getElementById("joinBTN");
const registerButton = document.getElementById("registerBTN");

const registerUsernameInput =
  document.getElementById("reg-username");

const registerPasswordInput =
  document.getElementById("reg-password");


const loginError =
  document.getElementById("login-error");

const registerError =
  document.getElementById("register-error");


const showRegisterButton =
  document.getElementById("showRegisterBtn");

const showLoginButton =
  document.getElementById("showLoginBtn");


const logoutButton =
  document.getElementById("logoutBTN");


const displayName =
  document.getElementById("display-name");



// Public chat

const sendButton =
  document.getElementById("send-button");

const chatMessageInput =
  document.getElementById("chat-message");

const responses =
  document.getElementById("responses");

const status =
  document.getElementById("status");

const typingIndicator =
  document.getElementById("typing-indicator");



// Groups

const groupTabs =
  document.querySelector(".group-tabs");

const myGroups =
  document.getElementById("my-groups");

const newGroupName =
  document.getElementById("new-group-name");

const createGroupButton =
  document.getElementById("create-group-button");

const groupAccountName =
  document.getElementById("group-account-name");

const addUserGroupButton =
  document.getElementById("add-user-group-button");

const deleteUserGroupButton =
  document.getElementById("delete-user-group-button");

const groupUpdateMessage =
  document.getElementById("group-update-message");


// Private messaging

const privateUserSelect =
  document.getElementById("private-user-select");

const privateMessageInput =
  document.getElementById("private-chat-message");

const privateSendButton =
  document.getElementById("private-send-button");

const privateResponses =
  document.getElementById("private-responses");


// Online users

const onlineUsersCount =
  document.getElementById("online-users-count");

const onlineUsersList =
  document.getElementById("online-users-list");


// =============================================================================
// Authentication UI
// =============================================================================


showRegisterButton.addEventListener(
  "click",
  () => {

    loginUI.classList.add("hidden");
    registerUI.classList.remove("hidden");

    loginError.textContent = "";

  }
);



showLoginButton.addEventListener(
  "click",
  () => {

    registerUI.classList.add("hidden");
    loginUI.classList.remove("hidden");

    registerError.textContent = "";

  }
);



// =============================================================================
// Login
// =============================================================================


joinButton.addEventListener(
  "click",
  login
);



passwordInput.addEventListener(
  "keydown",
  (event)=>{

    if(event.key === "Enter"){
      login();
    }

  }
);



function login(){

  const username =
    usernameInput.value.trim();

  const password =
    passwordInput.value;


  const usernamePattern =
    /^\w{3,20}$/;


  const passwordPattern =
    /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;



  if(!usernamePattern.test(username)){

    loginError.textContent =
      "Username must be 3-20 characters.";

    return;
  }



  if(!passwordPattern.test(password)){

    loginError.textContent =
      "Password must be at least 6 characters and contain letters and numbers.";

    return;
  }



  loginError.textContent = "";


  socket.emit(
    "join",
    {
      username,
      password
    }
  );

}



// Successful login

socket.on(
  "join-success",
  (username)=>{

    currentUsername = username;


    loginUI.classList.add("hidden");

    registerUI.classList.add("hidden");

    chatUI.classList.remove("hidden");


    displayName.textContent =
      username;


    chatMessageInput.focus();

  }
);



// Failed login

socket.on(
  "join-error",
  (message)=>{

    loginError.textContent =
      message;

  }
);



// =============================================================================
// Registration
// =============================================================================


registerButton.addEventListener(
  "click",
  registerAccount
);



function registerAccount(){

  const username =
    registerUsernameInput.value.trim();


  const password =
    registerPasswordInput.value;



  const usernamePattern =
    /^\w{3,20}$/;


  const passwordPattern =
    /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;



  if(!usernamePattern.test(username)){

    registerError.textContent =
      "Username must be 3-20 characters.";

    return;
  }



  if(!passwordPattern.test(password)){

    registerError.textContent =
      "Password must contain letters and numbers.";

    return;
  }



  registerError.textContent = "";


  socket.emit(
    "register",
    {
      username,
      password
    }
  );

}



socket.on(
  "register-success",
  (username)=>{

    registerUI.classList.add("hidden");

    loginUI.classList.remove("hidden");


    loginError.textContent =
      "Account '" +
      username +
      "' created. You may log in.";

  }
);



socket.on(
  "register-error",
  (message)=>{

    registerError.textContent =
      message;

  }
);



// =============================================================================
// Logout
// =============================================================================


logoutButton.addEventListener(
  "click",
  ()=>{

    socket.emit("leave-chat");

  }
);



socket.on(
  "leave-success",
  ()=>{

    currentUsername = "";

    chatUI.classList.add("hidden");

    loginUI.classList.remove("hidden");


    usernameInput.value = "";

    passwordInput.value = "";


    responses.innerHTML = "";

    privateResponses.innerHTML = "";

    status.innerHTML = "";


  }
);
// =============================================================================
// Public Chat
// =============================================================================


sendButton.addEventListener(
  "click",
  sendMessage
);



chatMessageInput.addEventListener(
  "keydown",
  (event)=>{

    if(event.key === "Enter"){

      event.preventDefault();

      sendMessage();

    }

  }
);



chatMessageInput.addEventListener(
  "input",
  ()=>{

    if(!isTyping){

      isTyping = true;

      socket.emit("typing");

    }


    clearTimeout(typingTimer);


    typingTimer =
      setTimeout(()=>{

        isTyping = false;

        socket.emit("stopTyping");


      },1000);


  }
);



function sendMessage(){

  const message =
    chatMessageInput.value.trim();



  if(!message){

    return;

  }



  if(!selectedGroup){

    groupUpdateMessage.textContent =
      "Select a group first.";

    return;

  }



  socket.emit(
    "message",
    {
      group:selectedGroup,
      message
    }
  );



  chatMessageInput.value = "";

  chatMessageInput.focus();


  isTyping = false;

  socket.emit("stopTyping");

}



// =============================================================================
// Receive Public Messages
// =============================================================================


socket.on(
  "message",
  displayMessage
);



function displayMessage(data){

  const element =
    document.createElement("div");


  const timestamp =
    new Date().toLocaleTimeString();



  const safeMessage =
    DOMPurify.sanitize(
      String(data)
    );



  element.innerHTML =
    '<span class="message-time">[' +
    timestamp +
    ']</span> ' +
    safeMessage;



  responses.appendChild(element);


  responses.scrollTop =
    responses.scrollHeight;

}



// =============================================================================
// Group Tabs
// =============================================================================


groupTabs.addEventListener(
  "click",
  (event)=>{


    const tab =
      event.target.closest(".group-tab");


    if(!tab){

      return;

    }


    selectGroup(
      tab.textContent.trim()
    );


  }
);



function renderGroupTabs(groups){

  if(!Array.isArray(groups)){

    return;

  }



  if(!groups.includes(selectedGroup)){

    selectedGroup =
      groups[0] || "";

  }



  groupTabs.innerHTML = "";



  groups.forEach(
    (group)=>{


      const button =
        document.createElement("button");


      button.type =
        "button";


      button.className =
        "group-tab";


      button.textContent =
        group;



      if(group === selectedGroup){

        button.classList.add(
          "active"
        );

      }



      groupTabs.appendChild(button);


    }
  );

}



function selectGroup(group){

  selectedGroup = group;



  document
    .querySelectorAll(".group-tab")
    .forEach(
      (tab)=>{

        tab.classList.toggle(
          "active",
          tab.textContent.trim() === group
        );

      }
    );

}



// =============================================================================
// Receive User Groups
// =============================================================================


socket.on(
  "user-groups",
  (groups)=>{


    renderGroupTabs(groups);



    if(!groups || groups.length === 0){

      myGroups.textContent =
        "My group chats: none";

      return;

    }



    myGroups.textContent =
      "My group chats: " +
      groups.join(", ");


  }
);



// =============================================================================
// Group Management
// =============================================================================


createGroupButton.addEventListener(
  "click",
  ()=>{


    const group =
      newGroupName.value.trim();



    if(!group){

      groupUpdateMessage.textContent =
        "Enter a group name.";

      return;

    }



    socket.emit(
      "create-group",
      group
    );


    newGroupName.value = "";


  }
);



addUserGroupButton.addEventListener(
  "click",
  ()=>{

    updateUserGroup(
      "add-user-group"
    );

  }
);



deleteUserGroupButton.addEventListener(
  "click",
  ()=>{

    updateUserGroup(
      "delete-user-group"
    );

  }
);



function updateUserGroup(eventName){


  const username =
    groupAccountName.value.trim();



  if(!selectedGroup){

    groupUpdateMessage.textContent =
      "Select a group first.";

    return;

  }



  if(!username){

    groupUpdateMessage.textContent =
      "Enter a username.";

    return;

  }



  socket.emit(
    eventName,
    {
      username,
      group:selectedGroup
    }
  );

}



socket.on(
  "group-update-status",
  (message)=>{

    groupUpdateMessage.textContent =
      message;

  }
);



// =============================================================================
// Typing Indicator
// =============================================================================


socket.on(
  "typingUsers",
  (users)=>{


    if(!Array.isArray(users) ||
       users.length === 0){

      typingIndicator.textContent =
        "";

      return;

    }



    if(users.length === 1){

      typingIndicator.textContent =
        users[0] +
        " is typing...";

    }
    else{

      typingIndicator.textContent =
        users.join(", ") +
        " are typing...";

    }


  }
);
// =============================================================================
// Private Messaging
// =============================================================================


privateSendButton.addEventListener(
  "click",
  sendPrivateMessage
);



privateMessageInput.addEventListener(
  "keydown",
  (event)=>{

    if(event.key === "Enter"){

      event.preventDefault();

      sendPrivateMessage();

    }

  }
);



function sendPrivateMessage(){


  const recipientSocketId =
    privateUserSelect.value;


  const message =
    privateMessageInput.value.trim();



  if(!recipientSocketId || !message){

    return;

  }



  socket.emit(
    "private-message",
    {
      recipientSocketId,
      message
    }
  );



  privateMessageInput.value = "";

  privateMessageInput.focus();


}



// =============================================================================
// Receive Private Messages
// =============================================================================


socket.on(
  "private-message",
  displayPrivateMessage
);



function displayPrivateMessage(data){


  const element =
    document.createElement("div");


  const timestamp =
    new Date().toLocaleTimeString();



  const from =
    DOMPurify.sanitize(
      String(data.from || "")
    );


  const to =
    DOMPurify.sanitize(
      String(data.to || "")
    );


  const message =
    DOMPurify.sanitize(
      String(data.message || "")
    );



  element.innerHTML =
    '<span class="message-time">[' +
    timestamp +
    ']</span> ' +
    '<strong>Private</strong> ' +
    from +
    " → " +
    to +
    ": " +
    message;



  privateResponses.appendChild(element);



  privateResponses.scrollTop =
    privateResponses.scrollHeight;


}



// =============================================================================
// Online Users
// =============================================================================


socket.on(
  "online-users",
  updatePrivateUsers
);



function updatePrivateUsers(users){


  if(!Array.isArray(users)){

    return;

  }



  privateUserSelect.innerHTML =
    '<option value="">Select an online user</option>';



  users.forEach(
    (user)=>{


      if(user.socketId === socket.id){

        return;

      }



      const option =
        document.createElement("option");


      option.value =
        user.socketId;


      option.textContent =
        user.username;



      privateUserSelect.appendChild(option);


    }
  );

}



// Authentication project compatibility
socket.on(
  "user-list",
  (users)=>{


    if(!Array.isArray(users)){

      return;

    }



    onlineUsersList.innerHTML = "";



    users.forEach(
      (username)=>{


        const li =
          document.createElement("li");


        li.textContent =
          username;


        onlineUsersList.appendChild(li);


      }
    );



    onlineUsersCount.textContent =
      users.length === 1
        ? "1 user online"
        : users.length + " users online";


  }
);



// Team 20 compatibility
socket.on(
  "connected-users",
  (users)=>{


    if(!Array.isArray(users)){

      return;

    }



    onlineUsersList.innerHTML = "";



    users.forEach(
      (username)=>{


        const li =
          document.createElement("li");


        li.textContent =
          username;


        onlineUsersList.appendChild(li);


      }
    );



    onlineUsersCount.textContent =
      users.length === 1
        ? "1 user online"
        : users.length + " users online";


  }
);



// =============================================================================
// System Status
// =============================================================================


socket.on(
  "status",
  displayStatus
);



function displayStatus(data){


  const element =
    document.createElement("div");


  const timestamp =
    new Date().toLocaleTimeString();



  const safe =
    DOMPurify.sanitize(
      String(data)
    );



  element.innerHTML =
    '<span class="status-time">[' +
    timestamp +
    ']</span> ' +
    safe;



  status.appendChild(element);



  status.scrollTop =
    status.scrollHeight;


}



// =============================================================================
// Authorization Failure
// =============================================================================


socket.on(
  "not-authorized",
  ()=>{


    status.textContent =
      "You must login before using the messenger.";

  }
);



// =============================================================================
// Disconnect Handling
// =============================================================================


socket.on(
  "disconnect",
  ()=>{

    console.log(
      "Disconnected from server."
    );

  }
);

