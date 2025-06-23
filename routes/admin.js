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

    // List of users for table
    const users = await User.find(filter).select('-password');

    // Total users (ignoring search)
    const total = await User.countDocuments();

    // Active users: last 10 minutes me jis user ka lastActive field update hua
    // NOTE: 'lastActive' field User schema me hona chahiye! Nahi hai to add karo.
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const active = await User.countDocuments({ lastActive: { $gte: tenMinsAgo } });

    return res.json({ users, total, active });
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

// GET /api/admin/today-rounds-summary
router.get('/today-rounds-summary', async (req, res) => {
  try {
    // Today ka midnight (00:00:00) se abhi tak
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();

    // 1. Get all bets of today
    const bets = await Bet.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    // 2. Group by round number (har round ka total bet)
    const rounds = {};
    bets.forEach(bet => {
      const rnd = bet.round;
      if (!rounds[rnd]) {
        rounds[rnd] = { round: rnd, totalBet: 0 };
      }
      rounds[rnd].totalBet += bet.amount;
    });

    // 3. Find winners for these rounds
    const roundNumbers = Object.keys(rounds).map(Number);
    const winners = await Winner.find({ round: { $in: roundNumbers } });

    winners.forEach(win => {
      if (rounds[win.round]) {
        rounds[win.round].winner = win.choice;
        rounds[win.round].totalPayout = win.totalPayout || 0;
      }
    });

    // 4. Output as array, latest round first
    const output = Object.values(rounds)
      .map(r => ({
        round: r.round,
        totalBet: r.totalBet,
        winner: r.winner || '-',
        totalPayout: r.totalPayout || 0
      }))
      .sort((a, b) => b.round - a.round);

    res.json({ rounds: output });
  } catch (err) {
    console.error('Today rounds summary error:', err);
    res.status(500).json({ message: 'Could not fetch summary' });
  }
});


module.exports = router;
