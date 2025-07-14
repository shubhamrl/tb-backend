// /controllers/adminController.js

const Bet = require('../models/Bet');

async function getTodaySummary(req, res) {
  try {
    const now = new Date();
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + IST_OFFSET);
    const startOfDay = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate(), 0, 0, 0);
    const endOfDay = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate(), 23, 59, 59);

    const bets = await Bet.find({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
    const totalBetsAmount = bets.reduce((sum, bet) => sum + (bet.amount || 0), 0);
    const totalPayout = bets.reduce((sum, bet) => sum + (bet.payout || 0), 0);
    const profit = totalBetsAmount - totalPayout;

    res.json({ totalBetsAmount, totalPayout, profit });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  getTodaySummary
};
