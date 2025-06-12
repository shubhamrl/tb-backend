const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');

// 1️⃣ User se withdrawal request lena
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const withdrawal = new Withdrawal({
      user: req.user.id,
      amount
    });
    await withdrawal.save();

    global.io.emit('withdrawal-request', {
      id: withdrawal._id,
      user: { id: user._id, email: user.email },
      amount
    });

    res.status(201).json({ message: 'Withdrawal request created', withdrawal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// 2️⃣ Admin ke liye: saari withdrawals list karna
exports.getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate('user', 'email balance')
      .sort({ createdAt: -1 });
    res.json({ withdrawals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// 3️⃣ Admin: withdrawal status update karna
exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' ya 'rejected'
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found' });

    withdrawal.status = status;
    await withdrawal.save();

    // Agar approved, to user balance se amount ghata do
    if (status === 'approved') {
      const user = await User.findById(withdrawal.user);
      user.balance -= withdrawal.amount;
      await user.save();
    }

    global.io.emit('withdrawal-status-updated', withdrawal);
    res.json({ message: 'Withdrawal status updated', withdrawal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
