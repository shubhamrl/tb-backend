// server/routes/auth.js
const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

// POST /api/auth/signup
router.post('/signup', register);

// POST /api/auth/login
router.post('/login', login);

module.exports = router;
