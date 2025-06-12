const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const {
  getCurrentRound,
  placeBet,
  setManualWinner,
  distributePayouts
} = require('../controllers/betsController');

router.get('/current-round', getCurrentRound);

// --- Combined API (no auth needed for admin panel, user ke liye lagana ho to laga sakte ho)
router.get('/live-state', auth, async (req, res) => {
  try {
    // Time calculations
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

    const round = Math.min(Math.floor(secondsPassed / 90) + 1, 960);
    const currentRoundStart = startOfDay.getTime() + ((round - 1) * 90 * 1000);
    const currentRoundEnd = currentRoundStart + (90 * 1000);
    const timer = Math.max(0, Math.floor((currentRoundEnd - nowIST.getTime()) / 1000));

    // ⬇️ Get all bets for this round and calculate totals
    const Bet = require('../models/Bet');
    const bets = await Bet.find({ round });
    const totals = bets.reduce((acc, b) => {
      acc[b.choice] = (acc[b.choice] || 0) + b.amount;
      return acc;
    }, {});

    // Winner for current round
    const Winner = require('../models/Winner');
    const winDoc = await Winner.findOne({ round });
    const winnerChoice = winDoc ? winDoc.choice : null;

    // User balance (if user authenticated)
    let balance = null;
    try {
      if (req.user) {
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        balance = user ? user.balance : null;
      }
    } catch {}

    res.json({
      round,
      timer,
      totals,
      winnerChoice,
      balance,
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});


router.post('/place-bet', auth, placeBet);
router.post('/set-winner', auth, setManualWinner);
router.post('/distribute-payouts', auth, distributePayouts);

module.exports = router;
