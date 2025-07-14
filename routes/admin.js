const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// USERS LIST, TOTAL, ACTIVE, SEARCH
router.get('/users', adminController.getUsers);

// UPDATE USER BALANCE
router.put('/users/:id/balance', adminController.updateUserBalance);

// REWARD REFERRAL
router.post('/users/:id/reward-referral', adminController.rewardReferral);

// TODAY ROUNDS SUMMARY (ROUND WISE)
router.get('/today-rounds-summary', adminController.todayRoundsSummary);

// TODAY OVERALL SUMMARY (TOTAL PROFIT/LOSS)
router.get('/summary', adminController.getTodaySummary);

module.exports = router;
