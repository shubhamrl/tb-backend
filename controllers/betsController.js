const Bet = require('../models/Bet');
const Winner = require('../models/Winner');
const User = require('../models/User');

// GET CURRENT ROUND
async function getCurrentRound(req, res) {
  try {
    let round = Number(req.query.round);
    if (!round) {
      const now = new Date();
      const IST_OFFSET = 5.5 * 60 * 60 * 1000;
      const nowIST = new Date(now.getTime() + IST_OFFSET);
      const startOfDay = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate(), 0, 0, 0);
      const secondsPassed = Math.floor((nowIST - startOfDay) / 1000);
      round = Math.min(Math.floor(secondsPassed / 90) + 1, 960);
    }
    const userId = req.user?.id || req.user?._id;
    const bets = await Bet.find({ round });
    const totals = bets.reduce((acc, b) => {
      acc[b.choice] = (acc[b.choice] || 0) + b.amount;
      return acc;
    }, {});
    const userBets = bets.reduce((acc, b) => {
      if (String(b.user) === String(userId)) {
        acc[b.choice] = (acc[b.choice] || 0) + b.amount;
      }
      return acc;
    }, {});
    const winDoc = await Winner.findOne({ round });
    const winnerChoice = winDoc ? winDoc.choice : null;
    return res.json({ round, totals, userBets, winnerChoice });
  } catch (err) {
    console.error('getCurrentRound error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

// PLACE BET
async function placeBet(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { choice, amount, round } = req.body;
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }
    if (amount <= 0) {
      return res.status(400).json({ message: 'Invalid bet amount' });
    }
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, balance: { $gte: amount } },
      { $inc: { balance: -amount }, $set: { lastActive: new Date() } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    const sessionId = Math.floor((round - 1) / 960) + 1;
    const bet = new Bet({ user: userId, round, choice, amount, sessionId });
    await bet.save();
    global.io.emit('bet-placed', { choice, amount, round });
    return res.status(201).json({ message: 'Bet placed', bet });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}

// MY BET HISTORY (TODAY)
async function myBetHistory(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const now = new Date();
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + IST_OFFSET);
    const startOfDay = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate(), 0, 0, 0);
    const endOfDay = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate(), 23, 59, 59);
    const bets = await Bet.find({
      user: userId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });
    const roundNumbers = [...new Set(bets.map(bet => bet.round))];
    const winners = await Winner.find({ round: { $in: roundNumbers } })
      .select('round choice -_id').lean();
    const roundToWinner = {};
    winners.forEach(w => { roundToWinner[w.round] = w.choice; });
    const roundMap = {};
    bets.forEach(bet => {
      if (!roundMap[bet.round]) {
        roundMap[bet.round] = { round: bet.round, bets: [], winAmount: 0, winner: roundToWinner[bet.round] || null };
      }
      roundMap[bet.round].bets.push({ choice: bet.choice, amount: bet.amount });
      if (bet.win && bet.payout > 0) {
        roundMap[bet.round].winAmount += bet.payout;
      }
    });
    const history = Object.values(roundMap)
      .sort((a, b) => b.round - a.round)
      .map(row => ({
        round: row.round,
        bets: row.bets,
        winner: row.winner,
        winAmount: row.winAmount
      }));
    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

// ADMIN: GET BET AMOUNTS FOR EACH IMAGE (for manual winner UI)
async function getRoundBetsSummary(req, res) {
  try {
    const round = Number(req.query.round);
    if (!round) return res.status(400).json({ message: 'Invalid round' });
    const bets = await Bet.find({ round });
    const totals = {};
    bets.forEach(b => {
      totals[b.choice] = (totals[b.choice] || 0) + b.amount;
    });
    const IMAGE_LIST = [
      'umbrella', 'football', 'sun', 'diya', 'cow', 'bucket',
      'kite', 'spinningTop', 'rose', 'butterfly', 'pigeon', 'rabbit'
    ];
    const result = {};
    IMAGE_LIST.forEach(img => {
      result[img] = totals[img] || 0;
    });
    res.json({ round, bets: result });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  getCurrentRound,
  placeBet,
  myBetHistory,
  getRoundBetsSummary
};
