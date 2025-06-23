// server/routes/admin.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Bet = require('../models/Bet');
const Winner = require('../models/Winner');

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
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const now = new Date();
    const elapsedSeconds = Math.floor((now - startOfDay) / 1000);
    const roundInterval = 90;
    const currentRoundNumber = Math.ceil(elapsedSeconds / roundInterval);

    // All today's bets
    const bets = await Bet.find({
      createdAt: { $gte: startOfDay, $lte: now }
    });

    // Group bets by round
    const betsByRound = {};
    bets.forEach(bet => {
      if (!betsByRound[bet.round]) betsByRound[bet.round] = 0;
      betsByRound[bet.round] += bet.amount;
    });

    // Find all winners for today
    const winners = await Winner.find({ round: { $gte: 1, $lte: currentRoundNumber } });
    const winnersByRound = {};
    winners.forEach(win => {
      winnersByRound[win.round] = {
        winner: win.choice,
        totalPayout: win.totalPayout || 0
      };
    });

    // Prepare output for all rounds, even if bet/payout is zero
    const rounds = [];
    for (let r = 1; r <= currentRoundNumber; r++) {
      rounds.push({
        round: r,
        totalBet: betsByRound[r] || 0,
        winner: winnersByRound[r]?.winner || '-',
        totalPayout: winnersByRound[r]?.totalPayout || 0
      });
    }

    rounds.reverse(); // latest round on top

    res.json({ rounds });
  } catch (err) {
    console.error('Today rounds summary error:', err);
    res.status(500).json({ message: 'Could not fetch summary' });
  }
});

module.exports = router;
