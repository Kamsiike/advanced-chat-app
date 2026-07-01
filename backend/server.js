const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

dotenv.config();

const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8000';

// Middlewares
app.use(express.json());
app.use(helmet());
app.use(cors({ origin: FRONTEND_URL }));
app.set('trust proxy', 1);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api/', apiLimiter);

// Mongo connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app';
mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Helper: sign token
function signToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'dev_secret', {
    expiresIn: '7d',
  });
}

// Auth middleware
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.userId = payload.id;
    req.user = await User.findById(req.userId).select('-password');
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Routes
app.post(
  '/api/auth/signup',
  [
    body('username').isLength({ min: 3 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, password } = req.body;
    try {
      const exists = await User.findOne({ $or: [{ email }, { username }] });
      if (exists) return res.status(409).json({ message: 'User already exists' });

      const user = new User({ username, email, password });
      await user.save();
      const token = signToken(user);
      res.status(201).json({ token, user: { id: user._id, username, email } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

app.post(
  '/api/auth/login',
  [body('email').isEmail().normalizeEmail(), body('password').exists()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email }).select('+password');
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });

      const valid = await user.comparePassword(password);
      if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

      const token = signToken(user);
      res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

app.get('/api/conversations', authenticate, async (req, res) => {
  try {
    const convs = await Conversation.find({ participants: req.userId })
      .populate('participants', 'username profilePicture status')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });
    res.json(convs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post(
  '/api/conversations/create',
  authenticate,
  [body('participants').isArray({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { participants, conversationType = 'direct', groupName } = req.body;
      const conv = new Conversation({ participants, conversationType, groupName });
      await conv.save();
      res.status(201).json(conv);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

app.get('/api/messages/:conversationId', authenticate, async (req, res) => {
  const { conversationId } = req.params;
  try {
    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(100);
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/messages/:messageId', authenticate, async (req, res) => {
  const { messageId } = req.params;
  try {
    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (String(msg.senderId) !== String(req.userId)) return res.status(403).json({ message: 'Not allowed' });
    await msg.remove();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Basic health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Socket.IO
const io = new Server(server, {
  cors: { origin: FRONTEND_URL },
});

// Authenticate socket by token in query
io.use(async (socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    socket.userId = payload.id;
    const user = await User.findById(socket.userId).select('-password');
    if (!user) return next(new Error('User not found'));
    socket.user = user;
    return next();
  } catch (err) {
    console.error('Socket auth error', err);
    return next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('socket connected', socket.userId);
  // mark user online
  User.findByIdAndUpdate(socket.userId, { status: 'online', lastSeen: new Date() }).exec();

  socket.on('joinConversation', (conversationId) => {
    socket.join(conversationId);
  });

  socket.on('leaveConversation', (conversationId) => {
    socket.leave(conversationId);
  });

  socket.on('typing', ({ conversationId, isTyping }) => {
    socket.to(conversationId).emit('typing', { userId: socket.userId, isTyping });
  });

  socket.on('sendMessage', async ({ conversationId, content, messageType = 'text', attachments = [] }) => {
    try {
      const message = new Message({ conversationId, senderId: socket.userId, content, messageType, attachments });
      await message.save();
      // update conversation lastMessage
      await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id, updatedAt: new Date() });
      const populated = await message.populate('senderId', 'username profilePicture');
      io.to(conversationId).emit('newMessage', populated);
    } catch (err) {
      console.error('sendMessage error', err);
      socket.emit('error', { message: 'Could not send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.userId);
    User.findByIdAndUpdate(socket.userId, { status: 'offline', lastSeen: new Date() }).exec();
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
