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
const authRoutes       = require('./routes/auth');
const userRoutes       = require('./routes/users');
const betsRoutes       = require('./routes/bets');
const winnerRoutes     = require('./routes/winner');           // ⭐️ ADD THIS LINE
const depositRoutes    = require('./routes/depositRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const settingsRoutes   = require('./routes/settings');
const spinRoutes       = require('./routes/spin');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with proper CORS for React frontend
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS.split(','), // ["http://localhost:3000"]
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io globally available for emit in controllers
global.io = io;

// Middlewares
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true
}));
// app.use(rateLimit({ windowMs: 60 * 1000, max: 100 }));

// Mount all routes (unchanged)
// app.use('/api/auth',       signupRoute);
// app.use('/api/auth',       loginRoute);
app.use('/api/auth',        authRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/bets',        betsRoutes);
app.use('/api/winner',      winnerRoutes);          // ⭐️ MOUNT WINNER ROUTES
app.use('/api/deposits',    depositRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/settings',    settingsRoutes);
app.use('/api/spin',        spinRoutes);

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
