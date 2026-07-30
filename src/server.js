/* =============================================================================
 * EECE/CS 3093C Software Engineering — Team 20 Messenger
 * server.js — Authentication + Team 20 Messenger Merge
 * =============================================================================
 */

"use strict";


const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const messengerdb = require("./messengerdb");


const app = express();

const server =
  http.createServer(app);


const io =
  new Server(server);



const PORT =
  process.env.PORT || 8092;



// =============================================================================
// Database Connection
// =============================================================================


(async()=>{

  try{

    await messengerdb.connect();

    const savedGroups =
      await messengerdb.getAllGroupChatNames();

    savedGroups.forEach(
      (group)=>{
        addAvailableGroup(group);
      }
    );

    server.listen(
      PORT,
      ()=>{
        console.log(
          "Team 20 Messenger running on port " +
          PORT
        );
      }
    );


  }
  catch(error){

    console.error(
      "Database connection failed:",
      error
    );

    process.exit(1);

  }


})();




// =============================================================================
// Security Headers
// =============================================================================


app.use(
  (req,res,next)=>{


    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "connect-src 'self' ws: wss:",
        "img-src 'self' data:",
        "font-src 'self' https://cdn.jsdelivr.net"

      ].join("; ")
    );


    next();


  }
);


app.use(express.json());


// Serve UI files

app.use(
  express.static(
    path.join(__dirname,"ui")
  )
);


// =============================================================================
// Profile Update HTTP Endpoint
// =============================================================================

app.post("/update-profile", async (req, res) => {
  const { oldUsername, newUsername, newPassword } = req.body;

  if (!oldUsername || !newUsername || !newPassword) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    const result = await messengerdb.updateProfile(oldUsername.trim(), newUsername.trim(), newPassword);

    if (result.success) {
      syncUserUpdate(oldUsername.trim(), newUsername.trim());
    }
    res.json(result);
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});




// =============================================================================
// Data Storage
// =============================================================================


// socket.id -> username

const userlist =
  new Map();



// username -> Set(groups)

const userGroups =
  new Map();



// Existing groups

const GLOBAL_GROUP =
  "Global";


const availableGroups =
  [
    GLOBAL_GROUP
  ];



// typing users

const typingUsers =
  new Set();




// =============================================================================
// Authentication Helpers
// =============================================================================


function authorizeUser(socket){

  return (
    socket &&
    socket.authenticated === true
  );

}



/**
 * Updates the server's internal maps when a profile is changed/recreated.
 */
function syncUserUpdate(oldUsername, newUsername) {
  if (!oldUsername || !newUsername) return;

  const nameChanged = oldUsername !== newUsername;

  if (nameChanged) {
    // Migrate group memberships to the new key
    if (userGroups.has(oldUsername)) {
      const groups = userGroups.get(oldUsername);
      userGroups.set(newUsername, groups);
      userGroups.delete(oldUsername);
    }
    // Update typing state
    if (typingUsers.has(oldUsername)) {
      typingUsers.delete(oldUsername);
      typingUsers.add(newUsername);
    }
  }

  // Update all sockets belonging to this user
  userlist.forEach((username, socketId) => {
    if (username === oldUsername) {
      if (nameChanged) userlist.set(socketId, newUsername);
      
      const clientSocket = io.sockets.sockets.get(socketId);
      if (clientSocket) {
        clientSocket.emit("update-profile-success", { username: newUsername });
        if (nameChanged) sendUserGroups(newUsername);
      }
    }
  });

  if (nameChanged) {
    sendToAuthenticatedClients("status", `${oldUsername} is now known as ${newUsername}`);
    sendConnectedUsers();
  }
}


function sendToAuthenticatedClients(
  event,
  data
){

  userlist.forEach(
    (_,socketId)=>{


      const client =
        io.sockets.sockets.get(socketId);


      if(
        client &&
        authorizeUser(client)
      ){

        client.emit(
          event,
          data
        );

      }


    }
  );

}




// =============================================================================
// Socket Connections
// =============================================================================


io.on(
"connection",
(socket)=>{


  console.log(
    "New socket connected:",
    socket.id
  );


  socket.authenticated =
    false;



  // ===========================================================================
  // LOGIN
  // ===========================================================================


  socket.on(
    "join",
    async(credentials)=>{


      if(
        !credentials ||
        typeof credentials.username !== "string" ||
        typeof credentials.password !== "string"
      ){

        socket.emit(
          "join-error",
          "Invalid login request."
        );

        return;

      }



      const username =
        credentials.username.trim();


      const password =
        credentials.password;



      const user =
        await messengerdb.find(
          username,
          password
        );



      if(!user){

        socket.emit(
          "join-error",
          "Invalid username or password."
        );

        return;

      }



      socket.authenticated =
        true;



      userlist.set(
        socket.id,
        username
      );



      const savedGroups =
        await messengerdb.getUserGroupChats(username);


      const groups =
        new Set(savedGroups);


      groups.add(GLOBAL_GROUP);


      groups.forEach(
        (group)=>{
          addAvailableGroup(group);
        }
      );


      userGroups.set(
        username,
        groups
      );



      socket.emit(
        "join-success",
        username
      );



      sendToAuthenticatedClients(
        "status",
        username +
        " joined the chat. Active users: " +
        userlist.size
      );



      sendUserGroups(
        username
      );


      sendConnectedUsers();



    }
  );





  // ===========================================================================
  // UPDATE PROFILE
  // ===========================================================================

  socket.on("update-profile", async (data) => {
    if (!authorizeUser(socket)) {
      socket.emit("not-authorized");
      return;
    }

    const oldUsername = userlist.get(socket.id);
    const { newUsername, newPassword } = data;

    if (!newUsername || !newPassword) {
      socket.emit("update-profile-error", "Username and password are required.");
      return;
    }

    try {
      const result = await messengerdb.updateProfile(
        oldUsername,
        newUsername.trim(),
        newPassword
      );

      if (!result.success) {
        socket.emit("update-profile-error", result.message);
        return;
      }

      // DB update successful; now sync the running server state
      syncUserUpdate(oldUsername, newUsername.trim());

    } catch (error) {
      console.error("Socket update error:", error);
      socket.emit("update-profile-error", "Internal server error during update.");
    }
  });



  // ===========================================================================
  // REGISTER
  // ===========================================================================


  socket.on(
    "register",
    async(data)=>{


      if(
        !data ||
        typeof data.username !== "string" ||
        typeof data.password !== "string"
      ){

        socket.emit(
          "register-error",
          "Invalid request."
        );

        return;

      }



      const username =
        data.username.trim();


      const password =
        data.password;



      const usernamePattern =
        /^\w{3,20}$/;


      const passwordPattern =
        /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;



      if(!usernamePattern.test(username)){

        socket.emit(
          "register-error",
          "Username must be 3-20 characters."
        );

        return;

      }



      if(!passwordPattern.test(password)){

        socket.emit(
          "register-error",
          "Password must contain letters and numbers."
        );

        return;

      }



      try{


        const result =
          await messengerdb.register(
            username,
            password
          );



        if(!result.success){

          socket.emit(
            "register-error",
            result.message
          );

          return;

        }



        socket.emit(
          "register-success",
          username
        );


      }
      catch(error){


        socket.emit(
          "register-error",
          "Server error."
        );


      }


    }
  );
// =============================================================================
// PUBLIC GROUP MESSAGES
// =============================================================================


socket.on(
  "message",
  (data)=>{


    if(!authorizeUser(socket)){

      socket.emit(
        "not-authorized"
      );

      return;

    }



    if(
      !data ||
      typeof data.group !== "string" ||
      typeof data.message !== "string"
    ){

      return;

    }



    const group =
      data.group.trim();


    const message =
      data.message.trim();



    if(
      !group ||
      !message ||
      !availableGroups.includes(group)
    ){

      return;

    }



    const sender =
      userlist.get(socket.id);



    const groups =
      userGroups.get(sender) ||
      new Set();



    if(!groups.has(group)){

      socket.emit(
        "status",
        "You are not a member of this group."
      );

      return;

    }



    sendToGroup(
      group,
      "message",
      "[" +
      group +
      "] " +
      sender +
      " says: " +
      message
    );


  }
);




// =============================================================================
// GROUP CREATION
// =============================================================================


socket.on(
  "create-group",
  async(groupName)=>{


    if(!authorizeUser(socket)){

      return;

    }



    if(
      typeof groupName !== "string" ||
      !groupName.trim()
    ){

      return;

    }



    const creator =
      userlist.get(socket.id);



    const group =
      groupName.trim();



    try{


      const result =
        await messengerdb.createGroupChat(
          creator,
          group
        );


      if(!result.success){

        socket.emit(
          "group-update-status",
          result.message
        );

        return;

      }


      addAvailableGroup(group);


      const groups =
        userGroups.get(creator) ||
        new Set();


      groups.add(group);


      userGroups.set(
        creator,
        groups
      );


      sendUserGroups(
        creator
      );


      socket.emit(
        "group-update-status",
        "Created group: " + group
      );


    }
    catch(error){


      console.error(
        "Create group error:",
        error
      );


      socket.emit(
        "group-update-status",
        "Server error creating group."
      );


    }


  }
);




// =============================================================================
// ADD / REMOVE USER FROM GROUP
// =============================================================================


socket.on(
  "add-user-group",
  (data)=>{

    updateUserGroup(
      socket,
      data,
      "add"
    );

  }
);



socket.on(
  "delete-user-group",
  (data)=>{

    updateUserGroup(
      socket,
      data,
      "delete"
    );

  }
);




// =============================================================================
// TYPING INDICATOR
// =============================================================================


socket.on(
  "typing",
  ()=>{


    if(!authorizeUser(socket)){

      return;

    }



    const username =
      userlist.get(socket.id);



    typingUsers.add(username);



    sendToAuthenticatedClients(
      "typingUsers",
      Array.from(typingUsers)
    );


  }
);



socket.on(
  "stopTyping",
  ()=>{


    const username =
      userlist.get(socket.id);



    typingUsers.delete(username);



    sendToAuthenticatedClients(
      "typingUsers",
      Array.from(typingUsers)
    );


  }
);




// =============================================================================
// PRIVATE MESSAGING
// =============================================================================


socket.on(
  "private-message",
  (data)=>{


    if(!authorizeUser(socket)){

      return;

    }



    if(
      !data ||
      !data.recipientSocketId ||
      !data.message
    ){

      return;

    }



    const sender =
      userlist.get(socket.id);



    const recipient =
      userlist.get(
        data.recipientSocketId
      );



    if(!recipient){

      socket.emit(
        "private-message",
        {
          from:"System",
          to:sender,
          message:"User is no longer online."
        }
      );

      return;

    }



    const privateMessage =
    {

      from:sender,

      to:recipient,

      message:
        String(data.message).trim()

    };



    socket.emit(
      "private-message",
      privateMessage
    );



    io.to(
      data.recipientSocketId
    )
    .emit(
      "private-message",
      privateMessage
    );


  }
);

// =============================================================================
// LOGOUT / LEAVE CHAT
// =============================================================================


socket.on(
  "leave-chat",
  ()=>{


    if(!authorizeUser(socket)){

      socket.emit(
        "not-authorized"
      );

      return;

    }



    const username =
      userlist.get(socket.id);



    userlist.delete(
      socket.id
    );



    socket.authenticated =
      false;



    typingUsers.delete(
      username
    );



    socket.emit(
      "leave-success"
    );



    sendToAuthenticatedClients(
      "status",
      username +
      " left the chat. Active users: " +
      userlist.size
    );



    sendConnectedUsers();


  }
);




// =============================================================================
// DISCONNECT
// =============================================================================


socket.on(
  "disconnect",
  ()=>{


    if(!authorizeUser(socket)){

      return;

    }



    const username =
      userlist.get(socket.id);



    userlist.delete(
      socket.id
    );



    typingUsers.delete(
      username
    );



    console.log(
      username +
      " disconnected."
    );



    sendToAuthenticatedClients(
      "typingUsers",
      Array.from(typingUsers)
    );



    sendToAuthenticatedClients(
      "status",
      username +
      " left the chat. Active users: " +
      userlist.size
    );



    sendConnectedUsers();


  }
);




}); // END io.on(connection)




// =============================================================================
// SEND ONLINE USER LIST
// =============================================================================


function sendConnectedUsers(){


  const users =
    [];


  userlist.forEach(
    (username,socketId)=>{


      users.push(
        {
          socketId,
          username
        }
      );


    }
  );



  sendToAuthenticatedClients(
    "online-users",
    users
  );


  sendToAuthenticatedClients(
    "connected-users",
    users.map(
      user=>user.username
    )
  );


}



// =============================================================================
// GROUP FUNCTIONS
// =============================================================================


async function updateUserGroup(
  socket,
  data,
  action
){


  if(!authorizeUser(socket)){

    return;

  }



  if(
    !data ||
    typeof data.username !== "string" ||
    typeof data.group !== "string"
  ){

    return;

  }



  const username =
    data.username.trim();



  const group =
    data.group.trim();



  const requester =
    userlist.get(socket.id);



  const requesterGroups =
    userGroups.get(requester) ||
    new Set();



  if(
    !username ||
    !group ||
    !availableGroups.includes(group)
  ){

    return;

  }



  if(
    !requesterGroups.has(group)
  ){

    socket.emit(
      "group-update-status",
      "You must belong to this group."
    );

    return;

  }



  if(
    action === "delete" &&
    group === GLOBAL_GROUP
  ){

    socket.emit(
      "group-update-status",
      "Global group cannot be removed."
    );

    return;

  }



  try{


    const result =
      await messengerdb.updateUserGroupChat(
        username,
        group,
        action
      );


    if(!result.success){

      socket.emit(
        "group-update-status",
        result.message
      );

      return;

    }


    const groups =
      userGroups.get(username) ||
      new Set();


    if(action === "add"){

      groups.add(group);

    }
    else{

      groups.delete(group);

    }


    userGroups.set(
      username,
      groups
    );


    sendUserGroups(
      username
    );


    sendToUser(
      username,
      "status",
      action === "add"
        ? "You were added to " + group
        : "You were removed from " + group
    );


    socket.emit(
      "group-update-status",
      "Updated groups for " +
      username
    );


  }
  catch(error){


    console.error(
      "Update user group error:",
      error
    );


    socket.emit(
      "group-update-status",
      "Server error updating group membership."
    );


  }


}




// =============================================================================
// TRACK AVAILABLE GROUPS
// =============================================================================


function addAvailableGroup(group){


  if(
    typeof group === "string" &&
    group.trim() &&
    !availableGroups.includes(group.trim())
  ){

    availableGroups.push(
      group.trim()
    );

  }


}



// =============================================================================
// SEND USER GROUPS
// =============================================================================


function sendUserGroups(username){


  const groups =
    Array.from(
      userGroups.get(username) || []
    );



  sendToUser(
    username,
    "user-groups",
    groups
  );


}




// =============================================================================
// SEND MESSAGE TO GROUP MEMBERS
// =============================================================================


function sendToGroup(
  group,
  event,
  payload
){


  userlist.forEach(
    (username,socketId)=>{


      const groups =
        userGroups.get(username) ||
        new Set();



      if(groups.has(group)){


        io.to(socketId)
          .emit(
            event,
            payload
          );


      }


    }
  );


}




// =============================================================================
// SEND EVENT TO ONE USER
// =============================================================================


function sendToUser(
  username,
  event,
  payload
){


  userlist.forEach(
    (connectedUsername,socketId)=>{


      if(
        connectedUsername === username
      ){

        io.to(socketId)
          .emit(
            event,
            payload
          );

      }


    }
  );


}
