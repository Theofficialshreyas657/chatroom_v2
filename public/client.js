document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const chatMessages = document.getElementById('chat-messages');
  const logoutBtn = document.getElementById('logout-btn');
  let username = '';

  // Explicitly connect to Socket.IO server at port 3000
  const socket = io('http://localhost:3000', {
    withCredentials: true
  });

  // Initialize chat after checking auth
  const init = async () => {
    try {
      const authResponse = await fetch('http://localhost:3000/api/check-auth', {
        credentials: 'include'
      });
      const authData = await authResponse.json();

      if (!authData.isAuthenticated) {
        window.location.href = '/public/login.html';
        return;
      }

      username = authData.username;

      // Join chat room
      socket.emit('joinChat', username);

      // Load previous messages
      const msgResponse = await fetch('http://localhost:3000/api/messages', {
        credentials: 'include'
      });
      const messages = await msgResponse.json();

      messages.forEach(msg => displayMessage(msg));
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  };

  // Receive message from server
  socket.on('message', message => {
    displayMessage(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  // Handle message form submit
  chatForm.addEventListener('submit', e => {
    e.preventDefault();
    const msg = e.target.elements.msg.value;
    socket.emit('chatMessage', msg);
    e.target.elements.msg.value = '';
    e.target.elements.msg.focus();
  });

  // Display message to DOM
  function displayMessage(message) {
    const div = document.createElement('div');
    div.classList.add('message');
    const time = message.created_at
      ? new Date(message.created_at).toLocaleTimeString()
      : new Date().toLocaleTimeString();
    div.innerHTML = `
      <p class="meta">${message.username} <span>${time}</span></p>
      <p class="text">${message.content}</p>
    `;
    chatMessages.appendChild(div);
  }

  // Logout user
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('http://localhost:3000/api/logout', {
        credentials: 'include'
      });
      window.location.href = '/public/login.html';
    } catch (error) {
      console.error('Logout error:', error);
    }
  });

  // Start the chat
  init();
});