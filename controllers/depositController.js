const Deposit = require('../models/Deposit');
const User = require('../models/User');

// 1️⃣ User se deposit request lena
exports.requestDeposit = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const deposit = new Deposit({
      user: req.user.id,
      amount
    });
    await deposit.save();

    // Notify admin via socket.io
    global.io.emit('deposit-request', { 
      id: deposit._id, 
      user: { id: user._id, email: user.email }, 
      amount 
    });

    res.status(201).json({ message: 'Deposit request created', deposit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// 2️⃣ Admin ke liye: saari deposits list karna
exports.getAllDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find()
      .populate('user', 'email balance')
      .sort({ createdAt: -1 });
    res.json({ deposits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// 3️⃣ Admin: deposit ka status update karna
exports.updateDepositStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' ya 'rejected'
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ message: 'Deposit not found' });

    deposit.status = status;
    await deposit.save();

    // Agar approved, to user balance update karo
    if (status === 'approved') {
      const user = await User.findById(deposit.user);
      user.balance += deposit.amount;
      await user.save();
    }

    global.io.emit('deposit-status-updated', deposit);
    res.json({ message: 'Deposit status updated', deposit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
