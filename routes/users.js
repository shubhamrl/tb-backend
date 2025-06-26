// server/routes/users.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Token verify middleware
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'No token' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// GET /api/users/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      id: user._id,
      email: user.email,
      balance: user.balance,
      referralEarnings: user.referralEarnings || 0,
      referralHistory: user.referralHistory || []
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// Optionally, ek separate API bana sakte ho for referral/summary, but abhi abhi /me se ho jayega.

module.exports = router;
