# 🚀 Advanced Chat Application

> A modern, production-ready chat application with Material Design 3, real-time messaging, and scalable backend.

## ✨ Features

- **Real-Time Messaging**: Instant message delivery using WebSockets (Socket.IO)
- **Material Design 3**: Google's latest design system for beautiful, accessible UI
- **User Authentication**: Secure JWT-based authentication
- **Typing Indicators**: See when users are typing
- **User Presence**: Online/offline status tracking
- **Message History**: Persistent storage of conversations
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark Mode Support**: Automatic theme switching based on system preference
- **Accessibility**: WCAG 2.1 compliant with ARIA labels and keyboard navigation

## 🏗️ Tech Stack

**Frontend**: HTML5, CSS3, Vanilla JavaScript, Material Design 3
**Backend**: Node.js, Express.js, Socket.IO, MongoDB, JWT

## 🚀 Quick Start

```bash
# Backend
cd backend
npm install
cp .env.example .env
npm run dev

# Frontend
cd frontend
# Open index.html in browser or use: python -m http.server 8000
```

## 📝 API Endpoints

- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/conversations` - List conversations
- `POST /api/conversations/create` - Create conversation
- `GET /api/messages/:conversationId` - Get messages
- `DELETE /api/messages/:messageId` - Delete message

## 🔒 Security

✅ JWT authentication  
✅ Password hashing (bcrypt)  
✅ CORS protection  
✅ Input sanitization  
✅ Rate limiting  

## 📄 License

MIT - Open source and free to use
