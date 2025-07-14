const mongoose = require('mongoose');
const User = require('../models/User');
const Bet = require('../models/Bet');
const Winner = require('../models/Winner');

// 1️⃣ USERS LIST, TOTAL, ACTIVE, SEARCH
async function getUsers(req, res) {
  try {
    const { search } = req.query;
    const filter = {};

    if (search) {
      // Email search (case-insensitive), OR by _id if it's a valid ObjectId
      const orFilters = [{ email: new RegExp(search, 'i') }];
      if (mongoose.Types.ObjectId.isValid(search)) {
        orFilters.push({ _id: search });
      }
      filter.$or = orFilters;
    }

    const users = await User.find(filter).select('-password');
    const total = await User.countDocuments();
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const active = await User.countDocuments({ lastActive: { $gte: tenMinsAgo } });

    return res.json({ users, total, active });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

// 2️⃣ UPDATE USER BALANCE
async function updateUserBalance(req, res) {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.balance = user.balance + Number(amount);
    await user.save();
    return res.json({ message: 'Balance updated', balance: user.balance });
  } catch (err) {
    console.error('Error updating balance:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

// 3️⃣ REWARD REFERRAL (DEMO, customize if you want!)
async function rewardReferral(req, res) {
  try {
    const referred = await User.findById(req.params.id);
    if (!referred) return res.status(404).json({ message: 'User not found' });
    if (referred.referralRewarded) {
      return res.status(400).json({ message: 'Reward already given' });
    }
    if (!referred.referrerId) {
      return res.status(400).json({ message: 'No referrer found for this user' });
    }
    const referrer = await User.findById(referred.referrerId);
    if (!referrer) {
      return res.status(400).json({ message: 'Referrer not found' });
    }
    // Give reward
    referrer.balance += 100;
    referred.balance += 50;
    // Track history (optional)
    referrer.referralEarnings = (referrer.referralEarnings || 0) + 100;
    referrer.referralHistory = referrer.referralHistory || [];
    referrer.referralHistory.push({
      referredUser: referred._id,
      amount: 100,
      note: 'Rewarded for first deposit',
      date: new Date()
    });
    referred.referralRewarded = true;
    referred.referralRewardedAt = new Date();
    await referrer.save();
    await referred.save();
    res.json({ message: "Referral reward given!", referrerBalance: referrer.balance, referredBalance: referred.balance });
  } catch (err) {
    console.error('Reward error:', err);
    res.status(500).json({ message: 'Error rewarding referral' });
  }
}

// 4️⃣ TODAY'S ROUNDS SUMMARY (ROUND WISE)
async function todayRoundsSummary(req, res) {
  try {
    const now = new Date();
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + IST_OFFSET);
    const startOfDay = new Date(
      nowIST.getFullYear(),
      nowIST.getMonth(),
      nowIST.getDate(),
      0, 0, 0
    );
    const secondsPassed = Math.floor((nowIST - startOfDay) / 1000);
    const currentRoundNumber = Math.min(Math.floor(secondsPassed / 90) + 1, 960);

    const bets = await Bet.find({
      createdAt: { $gte: startOfDay, $lte: nowIST }
    });

    // Group bets by round
    const betsByRound = {};
    bets.forEach(bet => {
      if (!betsByRound[bet.round]) betsByRound[bet.round] = [];
      betsByRound[bet.round].push(bet);
    });

    // Find all winners for today
    const winners = await Winner.find({ round: { $gte: 1, $lte: currentRoundNumber } });
    const winnersByRound = {};
    winners.forEach(win => {
      winnersByRound[win.round] = win.choice;
    });

    // Prepare output for all rounds, even if bet/payout is zero
    const rounds = [];
    for (let r = 1; r <= currentRoundNumber; r++) {
      const winner = winnersByRound[r] || '-';
      let totalPayout = 0;
      if (winner !== '-') {
        const winnerBets = (betsByRound[r] || []).filter(b => b.choice === winner);
        totalPayout = winnerBets.reduce((acc, b) => acc + (b.amount * 10), 0);
      }
      const totalBet = (betsByRound[r] || []).reduce((acc, b) => acc + b.amount, 0);

      rounds.push({
        round: r,
        totalBet,
        winner,
        totalPayout
      });
    }

    rounds.reverse(); // latest round on top

    res.json({ rounds });
  } catch (err) {
    console.error('Today rounds summary error:', err);
    res.status(500).json({ message: 'Could not fetch summary' });
  }
}

// 5️⃣ TODAY OVERALL SUMMARY (PROFIT/LOSS)
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
  getUsers,
  updateUserBalance,
  rewardReferral,
  todayRoundsSummary,
  getTodaySummary
};
