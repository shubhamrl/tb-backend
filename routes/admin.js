// server/routes/admin.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Bet = require('../models/Bet');
const Winner = require('../models/Winner');

// ... (other routes like /users, /balance, /reward-referral etc.)

// GET /api/admin/today-rounds-summary
router.get('/today-rounds-summary', async (req, res) => {
  try {
    // IST offset ka use karo
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

    // Sare bets fetch karo aaj ke din ke
    const bets = await Bet.find({
      createdAt: { $gte: startOfDay, $lte: nowIST }
    });

    // Bets group karo round wise
    const betsByRound = {};
    bets.forEach(bet => {
      if (!betsByRound[bet.round]) betsByRound[bet.round] = [];
      betsByRound[bet.round].push(bet);
    });

    // Sare winners bhi fetch karo round wise (today)
    const winners = await Winner.find({ round: { $gte: 1, $lte: currentRoundNumber } });
    const winnersByRound = {};
    winners.forEach(win => {
      winnersByRound[win.round] = win.choice;
    });

    // Sare rounds ke liye ek array banao
    const rounds = [];
    for (let r = 1; r <= currentRoundNumber; r++) {
      const winner = winnersByRound[r] || '-';
      let totalPayout = 0;
      if (winner !== '-') {
        // Us round ke jitne bhi winning bets hai
        const winnerBets = (betsByRound[r] || []).filter(b => b.choice === winner);
        totalPayout = winnerBets.reduce((acc, b) => acc + (b.amount * 10), 0);
      }
      // Round ka total bet
      const totalBet = (betsByRound[r] || []).reduce((acc, b) => acc + b.amount, 0);

      rounds.push({
        round: r,
        totalBet,
        winner,
        totalPayout
      });
    }

    rounds.reverse(); // Latest round top pe

    res.json({ rounds });
  } catch (err) {
    console.error('Today rounds summary error:', err);
    res.status(500).json({ message: 'Could not fetch summary' });
  }
});

module.exports = router;
