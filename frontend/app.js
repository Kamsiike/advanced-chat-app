const API_URL = 'http://localhost:3000';
let socket;
let currentUser = null;
let currentConversation = null;
let authToken = localStorage.getItem('authToken');

document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  initializeEventListeners();
  if (authToken) {
    connectSocket();
    loadConversations();
  } else {
    showAuthModal();
  }
});

function initializeTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme');
  const isDarkMode = savedTheme ? savedTheme === 'dark' : prefersDark;
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  }
}

document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  const isDarkMode = document.body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
});

function initializeEventListeners() {
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  document.getElementById('messageInput').addEventListener('input', () => {
    if (socket && currentConversation) {
      socket.emit('typing', { conversationId: currentConversation });
    }
  });
  document.getElementById('attachBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  document.getElementById('searchInput').addEventListener('input', searchConversations);
  document.getElementById('newChatBtn').addEventListener('click', openNewChatDialog);
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('signupForm').addEventListener('submit', handleSignup);
}

function connectSocket() {
  socket = io(API_URL, {
    auth: { token: authToken },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });
  
  socket.on('connect', () => {
    console.log('Connected');
    loadConversations();
  });
  
  socket.on('receive-message', (data) => {
    if (data.conversationId === currentConversation) {
      displayMessage(data, 'received');
    }
    updateConversationPreview(data.conversationId, data.text);
  });
  
  socket.on('typing', () => {
    showTypingIndicator();
  });
  
  socket.on('stop-typing', () => {
    hideTypingIndicator();
  });
}

function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const text = messageInput.value.trim();
  if (!text || !socket || !currentConversation) return;
  
  const message = {
    conversationId: currentConversation,
    text: text,
    timestamp: new Date()
  };
  
  socket.emit('send-message', message, (ack) => {
    if (ack && ack.success) {
      displayMessage(ack.data, 'sent');
      messageInput.value = '';
      messageInput.focus();
      socket.emit('stop-typing', { conversationId: currentConversation });
      scrollMessagesToBottom();
    }
  });
}

function displayMessage(message, type) {
  const container = document.getElementById('messagesContainer');
  if (container.querySelector('.empty-state')) {
    container.innerHTML = '';
  }
  
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;
  messageEl.innerHTML = `
    <div>
      <div class="message-bubble">${escapeHtml(message.text)}</div>
      <div class="message-time">${formatTime(message.timestamp)}</div>
    </div>
  `;
  container.appendChild(messageEl);
  scrollMessagesToBottom();
}

function scrollMessagesToBottom() {
  const container = document.getElementById('messagesContainer');
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 0);
}

function loadConversations() {
  fetch(`${API_URL}/api/conversations`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(res => res.json())
  .then(data => {
    currentUser = data.user;
    const list = document.getElementById('conversationsList');
    list.innerHTML = '';
    data.conversations.forEach(conv => {
      const item = createConversationItem(conv);
      list.appendChild(item);
    });
  })
  .catch(err => console.error('Failed to load conversations:', err));
}

function createConversationItem(conversation) {
  const item = document.createElement('div');
  item.className = 'conversation-item';
  item.innerHTML = `
    <div class="conversation-avatar">${getAvatar(conversation.name)}</div>
    <div class="conversation-content">
      <div class="conversation-name">${escapeHtml(conversation.name)}</div>
      <div class="conversation-preview">${escapeHtml(conversation.lastMessage || 'No messages')}</div>
    </div>
  `;
  item.addEventListener('click', () => selectConversation(conversation));
  return item;
}

function selectConversation(conversation) {
  currentConversation = conversation.id;
  document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById('chatName').textContent = conversation.name;
  document.getElementById('chatStatus').textContent = 'Online';
  loadMessages(conversation.id);
  socket.emit('join-room', conversation.id);
}

function loadMessages(conversationId) {
  fetch(`${API_URL}/api/messages/${conversationId}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    if (data.messages.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💬</div><h3>No messages</h3></div>`;
      return;
    }
    data.messages.forEach(msg => {
      const type = msg.senderId === currentUser.id ? 'sent' : 'received';
      displayMessage(msg, type);
    });
  })
  .catch(err => console.error('Failed to load messages:', err));
}

function updateConversationPreview(conversationId, preview) {
  const items = document.querySelectorAll('.conversation-item');
  items.forEach(item => {
    if (item.dataset.conversationId === conversationId) {
      item.querySelector('.conversation-preview').textContent = preview;
    }
  });
}

function searchConversations(e) {
  const query = e.target.value.toLowerCase();
  const items = document.querySelectorAll('.conversation-item');
  items.forEach(item => {
    const name = item.querySelector('.conversation-name').textContent.toLowerCase();
    item.style.display = name.includes(query) ? '' : 'none';
  });
}

function openNewChatDialog() {
  const name = prompt('Enter contact name:');
  if (name) {
    fetch(`${API_URL}/api/conversations/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    })
    .then(res => res.json())
    .then(() => loadConversations())
    .catch(err => console.error('Failed:', err));
  }
}

function showTypingIndicator() {
  document.getElementById('typingIndicator').style.display = 'flex';
  scrollMessagesToBottom();
}

function hideTypingIndicator() {
  document.getElementById('typingIndicator').style.display = 'none';
}

function showAuthModal() {
  document.getElementById('authModal').style.display = 'flex';
}

function hideAuthModal() {
  document.getElementById('authModal').style.display = 'none';
}

function toggleAuthForm(e) {
  e.preventDefault();
  document.getElementById('loginForm').style.display = 
    document.getElementById('loginForm').style.display === 'none' ? 'flex' : 'none';
  document.getElementById('signupForm').style.display = 
    document.getElementById('signupForm').style.display === 'none' ? 'flex' : 'none';
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.token) {
      authToken = data.token;
      localStorage.setItem('authToken', authToken);
      hideAuthModal();
      connectSocket();
      loadConversations();
    }
  })
  .catch(err => console.error('Login error:', err));
}

function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signupName').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  
  fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.token) {
      authToken = data.token;
      localStorage.setItem('authToken', authToken);
      hideAuthModal();
      connectSocket();
      loadConversations();
    }
  })
  .catch(err => console.error('Signup error:', err));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  return d.toLocaleDateString();
}

function getAvatar(name) {
  const emojis = ['👤', '👨', '👩', '🧑', '👶'];
  return emojis[name.charCodeAt(0) % emojis.length];
}