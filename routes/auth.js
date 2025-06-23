// server/routes/auth.js
console.log('========= AUTH.JS IS LOADED =========');
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');


// Nodemailer config (Gmail App Password required!)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,   // ✔️ .env variable
    pass: process.env.EMAIL_PASS,   // ✔️ .env variable
  }
});

// 1. SIGNUP with OTP email send
router.post('/signup', async (req, res) => {
    console.log('======== SIGNUP ENDPOINT HIT ========');
  try {
    const { email, password } = req.body;

    // Check user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save user (with isVerified: false & otp)
    const user = new User({ email, password, isVerified: false, otp });
    await user.save();

    // Send OTP email
   try {
  const info = await transporter.sendMail({
    from: '"Titali Bhavara" <shubhamlasankar10@gmail.com>',
    to: email,
    subject: 'Verify Your Email',
    text: `Your OTP is: ${otp}`,
    html: `<h2>Your OTP is: <b>${otp}</b></h2>`
  });
  console.log('Email sent:', info.response);
} catch (err) {
  console.error('Email send error:', err);
}

    res.status(201).json({ message: 'Signup successful. OTP sent to email.' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Signup failed. Please try again.' });
  }
});

// 2. VERIFY OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ message: 'Already verified.' });

    if (user.otp === otp) {
      user.isVerified = true;
      user.otp = null;
      await user.save();
      return res.status(200).json({ message: 'Email verified successfully!' });
    } else {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }
  } catch (err) {
    res.status(500).json({ message: 'OTP verification failed.' });
  }
});

// 3. LOGIN (Allow only if verified)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: 'User not found' });
    if (!user.isVerified) return res.status(401).json({ message: 'Please verify your email first.' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // ✅ lastActive update karo!
    user.lastActive = new Date();
    await user.save();

    // Yahan JWT token generate karo
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token, // <- yahi token frontend ko bhejna hai!
      user: {
        id: user._id,
        email: user.email,
        balance: user.balance,
        role: user.role || 'user'
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed' });
  }
});

module.exports = router;
