// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

// Import all routes
const adminRoutes      = require('./routes/admin');
// const signupRoute      = require('./routes/signup');
// const loginRoute       = require('./routes/login');
const authRoutes       = require('./routes/auth');
const userRoutes       = require('./routes/users');
const betsRoutes       = require('./routes/bets');
const depositRoutes    = require('./routes/depositRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const settingsRoutes = require('./routes/settings');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with proper CORS so कि React front-end (localhost:3000) जुड़ सके
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS.split(','), // e.g. ["http://localhost:3000"]
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io globally available, ताकि controllers emit कर सकें
global.io = io;

// Middlewares
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','), // React Dev Server
  credentials: true
}));
// app.use(rateLimit({ windowMs: 60 * 1000, max: 100 }));

// Mount routes
app.use('/api/auth',       signupRoute);
app.use('/api/auth',       loginRoute);
app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/bets',       betsRoutes);
app.use('/api/deposits',   depositRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/settings', settingsRoutes);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('🟢 Client connected (socket.id):', socket.id);

  socket.on('disconnect', (reason) => {
    console.log('⚠️ Client disconnected:', socket.id, 'Reason:', reason);
  });
});

// Health Check
app.get('/', (req, res) => res.send('Server is up and running!'));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
