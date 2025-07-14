const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const {
  setManualWinner,
  lockWinner,
  distributePayouts,
  announceWinner,
  getLastWins
} = require('../controllers/winnerController');

// 1️⃣ Set manual winner (admin)
router.post('/set-winner', auth, setManualWinner);

// 2️⃣ Lock winner (timer 10)
router.post('/lock-winner', auth, lockWinner);

// 3️⃣ Distribute payouts (auto/manual at round end)
router.post('/distribute-payouts', auth, distributePayouts);

// 4️⃣ Announce winner early (timer 5 pe, payout nahi)
router.post('/announce-winner', auth, announceWinner);

// 5️⃣ Last 10 wins
router.get('/last-wins', getLastWins);

module.exports = router;
