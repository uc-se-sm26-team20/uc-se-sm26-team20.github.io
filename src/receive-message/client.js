var sendBtnElm = document.getElementById('send-button');
if(!sendBtnElm) {
    console.log("Error in getting 'send-button' button");
}

sendBtnElm.addEventListener('click', sendMessage);

var chatMessageInput = document.getElementById('chat-message');
if(!chatMessageInput) {
    console.log("Error in getting 'chat-message' input");
}

chatMessageInput.addEventListener('keypress', function(e) {
    if(e.key === 'Enter') {
        sendMessage();
    }
});
function sendMessage() {
    const messageInput = document.getElementById("chat-message");
    const message = messageInput.value.trim();

    if (message === "") return;

    const chatBox = document.getElementById("chat-box");

    const messageElement = document.createElement("div");
    messageElement.className = "sent";
    messageElement.textContent = "You: " + message;

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;

    messageInput.value = "";
}

function receiveMessage(message) {
    const chatBox = document.getElementById("chat-box");

    const messageElement = document.createElement("div");
    messageElement.className = "received";
    messageElement.textContent = "Other User: " + message;

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}
