console.log('========= AUTH.JS IS LOADED =========');
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const authController = require('../controllers/authController'); // <-- YAHAN IMPORT KARO

// Nodemailer config (Gmail App Password required!)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

// 1. SIGNUP with OTP email send
router.post('/signup', async (req, res) => {
  // ...tumhara pura signup code bilkul sahi hai
});

// 2. VERIFY OTP
router.post('/verify-otp', async (req, res) => {
  // ...tumhara verify OTP code bhi sahi hai
});

// 3. Forgot Password (connect controller)
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// 4. LOGIN (no change)
router.post('/login', async (req, res) => {
  // ...login code sahi hai, lastActive update bhi sahi hai
});

module.exports = router;
