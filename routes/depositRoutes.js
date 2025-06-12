const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const {
  requestDeposit,
  getAllDeposits,
  updateDepositStatus
} = require('../controllers/depositController');

// User request deposit
router.post('/', auth, requestDeposit);

// Admin list all deposits
router.get('/', auth, getAllDeposits);

// Admin update status
router.patch('/:id', auth, updateDepositStatus);

module.exports = router;
