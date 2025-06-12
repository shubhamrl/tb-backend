// server/routes/signup.js
const express = require('express');
const router = express.Router();
const { register } = require('../controllers/authController');

// POST /api/auth/signup
router.post('/signup', register);

module.exports = router;
