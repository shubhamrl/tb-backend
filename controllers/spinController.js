const SpinBet = require('../models/SpinBet');
const User = require('../models/User');
const mongoose = require('mongoose');

// In-memory round info for demo (aap DB me bhi rakh sakte ho)
let roundInfo = {
  currentRound: 1,
  timer: 90,
  roundStart: Date.now(),
  manualWinner: {}, // { round: number }
  last10Wins: [], // [{ round, winner }]
};

// Start/Increment Round Helper
function startNewRound() {
  roundInfo.currentRound += 1;
  roundInfo.timer = 90;
  roundInfo.roundStart = Date.now();
  // Manual winner remove
  roundInfo.manualWinner = {};
}

function getTimeLeft() {
  let time = 90 - Math.floor((Date.now() - roundInfo.roundStart) / 1000);
  return time > 0 ? time : 0;
}

// 1. Place Bet
exports.placeBet = async (req, res) => {
  try {
    const { choice, amount } = req.body;
    const userId = req.user.id;

    // Basic validation
    if (typeof choice !== 'number' || choice < 0 || choice > 9 || !amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid bet' });
    }

    // User balance check
    const user = await User.findById(userId);
    if (!user || user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Round time check
    if (getTimeLeft() < 15) {
      return res.status(400).json({ error: 'Betting closed' });
    }

    // Deduct balance & save bet
    user.balance -= amount;
    await user.save();

    await SpinBet.create({
      user: userId,
      round: roundInfo.currentRound,
      choice,
      amount
    });

    return res.json({ success: true, balance: user.balance });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to place bet' });
  }
};

// 2. Get Current Round & Timer
exports.getCurrentRound = async (req, res) => {
  return res.json({
    round: roundInfo.currentRound,
    timer: getTimeLeft()
  });
};

// 3. Get Bets For Round (Admin)
exports.getBetsForRound = async (req, res) => {
  try {
    const { round } = req.params;
    const bets = await SpinBet.find({ round: Number(round) });
    return res.json({ bets });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch bets' });
  }
};

// 4. Set Manual Winner (Admin Only)
exports.setManualWinner = async (req, res) => {
  try {
    const { round, winner } = req.body;

    // Admin check
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Not authorized' });

    // Save manual winner (memory or db)
    roundInfo.manualWinner = { round: Number(round), winner: Number(winner) };

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to set winner' });
  }
};

// 5. Get Winner For Round (user & frontend use)
exports.getWinner = async (req, res) => {
  try {
    const round = Number(req.params.round);

    // Manual Winner
    if (
      roundInfo.manualWinner &&
      roundInfo.manualWinner.round === round
    ) {
      return res.json({ winner: roundInfo.manualWinner.winner });
    }

    // Auto winner logic (lowest bet)
    const bets = await SpinBet.find({ round });
    if (!bets.length) {
      // No bets, random winner
      return res.json({ winner: Math.floor(Math.random() * 10) });
    }
    // Find lowest total bet
    let betSums = Array(10).fill(0);
    bets.forEach(bet => { betSums[bet.choice] += bet.amount; });

    let min = Math.min(...betSums.filter(b => b > 0));
    let candidates = [];
    betSums.forEach((sum, idx) => {
      if (sum === min) candidates.push(idx);
    });
    // If all zero, random
    if (!min || !candidates.length) {
      return res.json({ winner: Math.floor(Math.random() * 10) });
    }
    // Multiple candidates, pick random
    const winner = candidates[Math.floor(Math.random() * candidates.length)];
    return res.json({ winner });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get winner' });
  }
};

// 6. Last 10 Wins
exports.getLast10Wins = async (req, res) => {
  try {
    return res.json({ wins: roundInfo.last10Wins.slice(-10).reverse() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch last wins' });
  }
};

/*
  NEW: Get Bet Totals By Number for Manual Winner Page
  Route: /api/spin/bets/summary/:round
  Response: { round, totals: [amtOn0, amtOn1, ... amtOn9] }
*/
exports.getBetTotalsByNumber = async (req, res) => {
  try {
    const round = Number(req.params.round);
    const bets = await SpinBet.find({ round });
    let totals = Array(10).fill(0);
    bets.forEach(bet => { totals[bet.choice] += bet.amount; });

    return res.json({ round, totals });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get bet totals' });
  }
};

/*
  NEW: Get Round Summary for summary page
  Route: /api/spin/summary/:round
  Response: { round, totalBet, winner, totalPayout }
*/
exports.getRoundSummary = async (req, res) => {
  try {
    const round = Number(req.params.round);
    const bets = await SpinBet.find({ round });
    if (!bets.length) {
      return res.json({
        round,
        totalBet: 0,
        winner: null,
        totalPayout: 0
      });
    }

    const totalBet = bets.reduce((a, b) => a + b.amount, 0);

    // Winner (manual ya auto, jaise pehle)
    let winner = null;
    if (roundInfo.manualWinner && roundInfo.manualWinner.round === round) {
      winner = roundInfo.manualWinner.winner;
    } else {
      let totals = Array(10).fill(0);
      bets.forEach(bet => { totals[bet.choice] += bet.amount; });
      let min = Math.min(...totals.filter(x => x > 0));
      let candidates = [];
      totals.forEach((sum, idx) => {
        if (sum === min) candidates.push(idx);
      });
      if (!min || !candidates.length) {
        winner = Math.floor(Math.random() * 10);
      } else {
        winner = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    // Total payout (winner par jitne bet the unka *10)
    const totalPayout = bets.filter(b => b.choice === winner).reduce((a, b) => a + (b.amount * 10), 0);

    return res.json({
      round,
      totalBet,
      winner,
      totalPayout
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch round summary' });
  }
};
