// server/routes/admin.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');

// GET /api/admin/users?search=term
router.get('/users', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};

    if (search) {
      // Build OR filters: email regex plus optional _id match
      const orFilters = [{ email: new RegExp(search, 'i') }];
      if (mongoose.Types.ObjectId.isValid(search)) {
        orFilters.push({ _id: search });
      }
      filter.$or = orFilters;
    }

    const users = await User.find(filter).select('-password');
    return res.json({ users });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/users/:id/balance
router.put('/users/:id/balance', async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.balance = user.balance + Number(amount);
    await user.save();
    return res.json({ message: 'Balance updated', balance: user.balance });
  } catch (err) {
    console.error('Error updating balance:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
