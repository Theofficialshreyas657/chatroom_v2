const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const db = require('./db');

// Initialize app and server
const app = express();
const server = http.createServer(app);
// Add near the top with other middleware
const cors = require('cors');
app.use(cors({
  origin: 'http://127.0.0.1:5501',  // Your frontend URL
  credentials: true                 // Allow cookies for sessions
}));

// Set up session middleware BEFORE initializing Socket.io
const sessionMiddleware = session({
  secret: 'chatappsecret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
});

// Apply session middleware to Express
app.use(sessionMiddleware);

// Initialize Socket.io AFTER creating the session middleware
// Initialize Socket.io WITH CORS
const io = socketIo(server, {
  cors: {
    origin: 'http://127.0.0.1:5501',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Allow sessions in Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// Other middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth middleware
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/public/login.html');
};

// Routes
app.get('/chat', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  console.log('Registration attempt:', { username }); // Log the attempt
  
  // Check if we have the required fields
  if (!username || !password) {
    console.log('Missing required fields');
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  try {
    // Check if username exists
    console.log('Checking if username exists...');
    const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    
    if (users.length > 0) {
      console.log('Username already exists');
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    console.log('Inserting new user...');
    const [result] = await db.execute(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );
    
    console.log('User registered successfully:', result.insertId);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Find user
    const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const user = users[0];
    
    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    
    res.json({ message: 'Logged in successfully', username: user.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout endpoint
app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out successfully' });
});

// Check auth status
app.get('/api/check-auth', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      isAuthenticated: true,
      username: req.session.username
    });
  }
  res.json({ isAuthenticated: false });
});

// Get messages endpoint
app.get('/api/messages', isAuthenticated, async (req, res) => {
  try {
    const [messages] = await db.execute(`
      SELECT m.id, m.content, m.created_at, u.username
      FROM messages m
      JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at ASC
      LIMIT 50
    `);
    
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New user connected');
  
  // Join chat
  socket.on('joinChat', (username) => {
    socket.username = username;
    io.emit('message', {
      username: 'System',
      content: `${username} has joined the chat`,
      created_at: new Date()
    });
  });
  
  // Handle chat message
  socket.on('chatMessage', async (msg) => {
    try {
      // Get user from session
      const socketSession = socket.request.session;
      if (!socketSession || !socketSession.userId) return;
      
      // Save message to database
      const [result] = await db.execute(
        'INSERT INTO messages (user_id, content) VALUES (?, ?)',
        [socketSession.userId, msg]
      );
      
      // Broadcast message
      io.emit('message', {
        username: socket.username,
        content: msg,
        created_at: new Date()
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    if (socket.username) {
      io.emit('message', {
        username: 'System',
        content: `${socket.username} has left the chat`,
        created_at: new Date()
      });
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
