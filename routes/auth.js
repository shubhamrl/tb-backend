// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 1. Signup/Register
router.post('/signup', authController.register);

// 2. Login
router.post('/login', authController.login);

// 3. Forgot Password
router.post('/forgot-password', authController.forgotPassword);

// 4. Reset Password
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;
