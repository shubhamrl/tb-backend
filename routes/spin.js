const express = require('express');
const router = express.Router();
const spinController = require('../controllers/spinController');
const authMiddleware = require('../middlewares/authMiddleware'); // <<-- yahi name rakho

// Bet place
router.post('/bet', authMiddleware, spinController.placeBet);

// Get current round and timer
router.get('/round', authMiddleware, spinController.getCurrentRound);

// Get all bets for current round (for admin, last 15 sec)
router.get('/bets/:round', authMiddleware, spinController.getBetsForRound);

// Set manual winner (admin only)
router.post('/set-winner', authMiddleware, spinController.setManualWinner);

// Get winner for round
router.get('/winner/:round', authMiddleware, spinController.getWinner);

// Get last 10 wins
router.get('/last-wins', authMiddleware, spinController.getLast10Wins);

// NEW: Get total bets on each number for manual winner page
router.get('/bets/summary/:round', authMiddleware, spinController.getBetTotalsByNumber);

// NEW: Get round summary (totalBet, winner, payout) for summary page
router.get('/summary/:round', authMiddleware, spinController.getRoundSummary);

module.exports = router;
