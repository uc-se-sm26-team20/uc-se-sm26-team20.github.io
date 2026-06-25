/* =============================================================================
 * client.js — code skeleton provided by Dr. Phu Phung
 * Code complete implementation by Team 20
 * ===============================================================================
 */
var socket = io(); //connect to the Socket.io Server
socket.on("connect", () => { //connected to the server
  console.log(`Connected to Socket.io server: 
    ${socket.io.opts.hostname}, port: ${socket.io.opts.port}`);
});

// UI DOM references
var sendBtnElm = document.getElementById('send-button');
if(!sendBtnElm) {
    console.log("Error in getting 'send-button' button");
}
// AC-01.2 (UI): Send button click triggers sendMessage()
sendBtnElm.addEventListener('click', sendMessage);

var chatMessageInput = document.getElementById('chat-message');
if(!chatMessageInput) {
    console.log('Error in getting "chat-message" input');
}
// AC-01.2 (UI): pressing Enter also triggers sendMessage()
chatMessageInput.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') sendMessage();
});

// =============================================================================
// Use-Case-01: Send Message
// =============================================================================

function sendMessage() {
    var message = chatMessageInput.value.trim();
    if (!message) return;   // AC-02.2: empty messages are ignored
    console.log(`Debug>Chat message: ${message}`); //for UI testing only
   
    socket.emit('message', message);

    chatMessageInput.value = ''; // AC-01.5: clear input after sending
    chatMessageInput.focus();
}

// =============================================================================
// Use-Case-02: Receive message 
// =============================================================================
socket.on('message', displayMessage);

function displayMessage(data){
    var d = document.createElement('div');
    //AC-02.2
    var timestamp = new Date().toLocaleTimeString();
    d.innerHTML = ' [' + timestamp + '] ' + data; 
    document.getElementById('responses').appendChild(d);
}

socket.on('status', function(data) {
    var statusElm = document.getElementById('status');
    //AC-02.2  
    var timestamp = new Date().toLocaleTimeString();
    statusElm.innerHTML = statusElm.innerHTML + '<br>[' + timestamp + '] ' + data;
    
    //AC-02.3
    statusElm.scrollTop = statusElm.scrollHeight;

});