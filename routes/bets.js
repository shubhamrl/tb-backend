const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const {
  getCurrentRound,
  placeBet,
  myBetHistory
} = require('../controllers/betsController');

// 1️⃣ Current round details
router.get('/current-round', getCurrentRound);

// 2️⃣ Place bet
router.post('/place-bet', auth, placeBet);

// 3️⃣ My bet history (today's)
router.get('/my-bet-history', auth, myBetHistory);

module.exports = router;
