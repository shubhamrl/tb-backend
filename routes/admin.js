const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const mongoose = require('mongoose');
const User = require('../models/User');
const Bet = require('../models/Bet');
const Winner = require('../models/Winner');

// All your existing admin routes below...

// ====== USERS LIST/SEARCH ===========
router.get('/users', async (req, res) => {
  // ...tumhara pura code same as before...
});

// ====== UPDATE USER BALANCE =========
router.put('/users/:id/balance', async (req, res) => {
  // ...tumhara pura code same as before...
});

// ====== REWARD REFERRAL ============
router.post('/users/:id/reward-referral', async (req, res) => {
  // ...tumhara pura code same as before...
});

// ====== TODAY ROUNDS SUMMARY ========
router.get('/today-rounds-summary', async (req, res) => {
  // ...tumhara pura code same as before...
});

// ====== ADD THIS: TODAY OVERALL SUMMARY ========
router.get('/summary', adminController.getTodaySummary);

module.exports = router;
