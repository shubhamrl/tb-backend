const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const {
  getCurrentRound,
  placeBet,
  setManualWinner,
  lockWinner, // ⭐️ Yeh import karo!
  distributePayouts,
  getLastWins,
  announceWinner,
  myBetHistory,
  getTodaySummary
} = require('../controllers/betsController');

router.get('/my-bet-history', auth, myBetHistory);

// 1️⃣ Current round details
router.get('/current-round', getCurrentRound);

// 2️⃣ Live state (used by game for timer, bets, winner etc)
router.get('/live-state', auth, async (req, res) => {
  try {
    const now = new Date();
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + IST_OFFSET);
    const startOfDay = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate(), 0, 0, 0);
    const secondsPassed = Math.floor((nowIST - startOfDay) / 1000);
    const round = Math.min(Math.floor(secondsPassed / 90) + 1, 960);
    const currentRoundStart = startOfDay.getTime() + ((round - 1) * 90 * 1000);
    const currentRoundEnd = currentRoundStart + (90 * 1000);
    const timer = Math.max(0, Math.floor((currentRoundEnd - nowIST.getTime()) / 1000));

    const Bet = require('../models/Bet');
    const bets = await Bet.find({ round });

    const totals = bets.reduce((acc, b) => {
      acc[b.choice] = (acc[b.choice] || 0) + b.amount;
      return acc;
    }, {});

    const userBets = {};
    if (req.user) {
      const userId = req.user.id;
      bets.forEach(b => {
        if (b.user.toString() === userId) {
          userBets[b.choice] = (userBets[b.choice] || 0) + b.amount;
        }
      });
    }

    const Winner = require('../models/Winner');
    const winDoc = await Winner.findOne({ round });
    const winnerChoice = winDoc ? winDoc.choice : null;

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
      userBets,
      winnerChoice,
      balance,
    });
  } catch (e) {
    console.error('Error in /live-state:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// 3️⃣ Place bet
router.post('/place-bet', auth, placeBet);

// 4️⃣ Set manual winner (admin)
router.post('/set-winner', auth, setManualWinner);

// ⭐️ ⭐️ NEW 5️⃣ Lock Winner (timer 10 pe)
router.post('/lock-winner', auth, lockWinner);

// 6️⃣ Distribute payouts (auto/manual at round end)
router.post('/distribute-payouts', auth, distributePayouts);

// 7️⃣ Announce winner early (timer 5 pe, payout nahi)
router.post('/announce-winner', auth, announceWinner);

// 8️⃣ Last 10 wins
router.get('/last-wins', getLastWins);

// 9️⃣ Today's payout/profit summary (admin can use this)
router.get('/today-summary', getTodaySummary);

module.exports = router;
