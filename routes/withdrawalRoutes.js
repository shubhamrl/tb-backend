const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const {
  requestWithdrawal,
  getAllWithdrawals,
  updateWithdrawalStatus
} = require('../controllers/withdrawalController');

// User request withdrawal
router.post('/', auth, requestWithdrawal);

// Admin list all withdrawals
router.get('/', auth, getAllWithdrawals);

// Admin update status
router.patch('/:id', auth, updateWithdrawalStatus);

module.exports = router;
