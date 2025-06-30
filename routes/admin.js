// server/routes/admin.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Bet = require('../models/Bet');
const Winner = require('../models/Winner');

// ---------- USERS TABLE ROUTE: GET /api/admin/users ----------
router.get('/users', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};

    if (search) {
      // Search by email or userId (Mongo _id)
      const orFilters = [{ email: new RegExp(search, 'i') }];
      if (mongoose.Types.ObjectId.isValid(search)) orFilters.push({ _id: search });
      filter.$or = orFilters;
    }

    // All users (no password)
    const users = await User.find(filter).select('-password');
    // Total users (ignore search)
    const total = await User.countDocuments();
    // Active users (last 10 min)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const active = await User.countDocuments({ lastActive: { $gte: tenMinutesAgo } });

    res.json({ users, total, active });
  } catch (err) {
    console.error('Error in /api/admin/users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------ (Put your other admin routes here, like today-rounds-summary etc.) ------------

// EXAMPLE: (already in your code)
router.get('/today-rounds-summary', async (req, res) => {
  // ...your summary code here...
});

module.exports = router;
