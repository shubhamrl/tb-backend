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
    // --- Same current round logic (as before) ---
    const now = new Date();
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + IST_OFFSET);
    const startOfDay = new Date(
      nowIST.getFullYear(),
      nowIST.getMonth(),
      nowIST.getDate(),
      0, 0, 0
    );
    const secondsPassed = Math.floor((nowIST - startOfDay) / 1000);
    const currentRoundNumber = Math.min(Math.floor(secondsPassed / 90) + 1, 960);

    // All today's bets
    const Bet = require('../models/Bet');
    const bets = await Bet.find({
      createdAt: { $gte: startOfDay, $lte: nowIST }
    });

    // Group bets by round
    const betsByRound = {};
    bets.forEach(bet => {
      if (!betsByRound[bet.round]) betsByRound[bet.round] = [];
      betsByRound[bet.round].push(bet);
    });

    // Find all winners for today
    const Winner = require('../models/Winner');
    const winners = await Winner.find({ round: { $gte: 1, $lte: currentRoundNumber } });
    const winnersByRound = {};
    winners.forEach(win => {
      winnersByRound[win.round] = win.choice;
    });

    // Prepare output for all rounds, even if bet/payout is zero
    const rounds = [];
    for (let r = 1; r <= currentRoundNumber; r++) {
      const winner = winnersByRound[r] || '-';
      let totalPayout = 0;
      if (winner !== '-') {
        // All winning bets for this round
        const winnerBets = (betsByRound[r] || []).filter(b => b.choice === winner);
        totalPayout = winnerBets.reduce((acc, b) => acc + (b.amount * 10), 0);
      }

      // Total bet for the round
      const totalBet = (betsByRound[r] || []).reduce((acc, b) => acc + b.amount, 0);

      rounds.push({
        round: r,
        totalBet,
        winner,
        totalPayout
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
