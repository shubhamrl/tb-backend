const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Bet = require('../models/Bet');
const Winner = require('../models/Winner');

// =========== USERS TABLE & STATS ===========
// GET /api/admin/users?search=term
router.get('/users', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};

    if (search) {
      const orFilters = [{ email: new RegExp(search, 'i') }];
      if (mongoose.Types.ObjectId.isValid(search)) orFilters.push({ _id: search });
      filter.$or = orFilters;
    }

    const users = await User.find(filter).select('-password');
    const total = await User.countDocuments();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const active = await User.countDocuments({ lastActive: { $gte: tenMinutesAgo } });

    res.json({ users, total, active });
  } catch (err) {
    console.error('Error in /api/admin/users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// =========== TODAY'S ROUNDS SUMMARY ===========
// GET /api/admin/today-rounds-summary
router.get('/today-rounds-summary', async (req, res) => {
  try {
    // --- IST offset ---
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

    // All bets for today
    const bets = await Bet.find({
      createdAt: { $gte: startOfDay, $lte: nowIST }
    });

    // Bets grouped by round
    const betsByRound = {};
    bets.forEach(bet => {
      if (!betsByRound[bet.round]) betsByRound[bet.round] = [];
      betsByRound[bet.round].push(bet);
    });

    // All winners for today
    const winners = await Winner.find({ round: { $gte: 1, $lte: currentRoundNumber } });
    const winnersByRound = {};
    winners.forEach(win => {
      winnersByRound[win.round] = win.choice;
    });

    // Build summary for all rounds (even if no bets)
    const rounds = [];
    for (let r = 1; r <= currentRoundNumber; r++) {
      const winner = winnersByRound[r] || '-';
      let totalPayout = 0;
      if (winner !== '-') {
        const winnerBets = (betsByRound[r] || []).filter(b => b.choice === winner);
        totalPayout = winnerBets.reduce((acc, b) => acc + (b.amount * 10), 0);
      }
      const totalBet = (betsByRound[r] || []).reduce((acc, b) => acc + b.amount, 0);

      rounds.push({
        round: r,
        totalBet,
        winner,
        totalPayout
      });
    }

    rounds.reverse(); // Show latest round on top

    res.json({ rounds });
  } catch (err) {
    console.error('Today rounds summary error:', err);
    res.status(500).json({ message: 'Could not fetch summary' });
  }
});

// =========== OTHER ADMIN ROUTES PLACEHOLDER (add more as needed) ===========
// Example:
// router.post('/set-winner', ...);

module.exports = router;
