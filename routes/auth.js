// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 1. Signup/Register (OTP email send)
router.post('/signup', authController.register);

// 2. Verify OTP (for new user registration)
router.post('/verify-otp', authController.verifyOtp);

// 3. Login
router.post('/login', authController.login);

// 4. Forgot Password
router.post('/forgot-password', authController.forgotPassword);

// 5. Reset Password
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;
