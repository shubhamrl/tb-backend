const Bet    = require('../models/Bet');
const Winner = require('../models/Winner');
const User   = require('../models/User');

// 1️⃣ Get Current Round Bets & Totals, plus existing winner (if any)
exports.getCurrentRound = async (req, res) => {
  try {
    let round = Number(req.query.round);
    if (!round) {
      // fallback: calculate based on time
      const now = new Date();
      const IST_OFFSET = 5.5 * 60 * 60 * 1000;
      const nowIST = new Date(now.getTime() + IST_OFFSET);
      const startOfDay = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate(), 0, 0, 0);
      const secondsPassed = Math.floor((nowIST - startOfDay) / 1000);
      round = Math.min(Math.floor(secondsPassed / 90) + 1, 960);
    }

    // Fetch all bets for this round
    const bets = await Bet.find({ round });
    // Compute totals per choice
    const totals = bets.reduce((acc, b) => {
      acc[b.choice] = (acc[b.choice] || 0) + b.amount;
      return acc;
    }, {});

    // Also look up if a Winner document already exists for this round
    const winDoc = await Winner.findOne({ round });
    const winnerChoice = winDoc ? winDoc.choice : null;

    return res.json({ round, bets, totals, winnerChoice });
  } catch (err) {
    console.error('getCurrentRound error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 2️⃣ Place a Bet (protected)
exports.placeBet = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { choice, amount, round } = req.body;

    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (amount <= 0 || user.balance < amount) {
      return res.status(400).json({ message: 'Invalid amount or insufficient balance' });
    }

    // Deduct balance and save bet
    user.balance -= amount;
    await user.save();

    const bet = new Bet({ user: userId, round, choice, amount });
    await bet.save();

    // Notify all clients that a bet has been placed
    global.io.emit('bet-placed', { choice, amount, round });
    return res.status(201).json({ message: 'Bet placed', bet });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

// 3️⃣ Set Manual Winner (protected)
exports.setManualWinner = async (req, res) => {
  try {
    const { choice, round } = req.body;
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }

    // Only update/create winner doc, DON'T emit socket here!
    await Winner.findOneAndUpdate(
      { round },
      { choice, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // DO NOT EMIT SOCKET HERE! Let payout API do it.
    return res.json({ message: 'Winner recorded (awaiting payout)', choice });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// 4️⃣ Distribute Payouts (protected)
exports.distributePayouts = async (req, res) => {
  try {
    const { round } = req.body;
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }

    // Try to find winner (manual)
    let winDoc = await Winner.findOne({ round });
    let choice;

    if (!winDoc) {
      // No manual winner set, auto logic

      // 1. Get all bets for the round
      const bets = await Bet.find({ round });
      if (!bets.length) {
        // No bets at all: Pick random winner from all images
        const IMAGE_LIST = [
          'umbrella', 'football', 'sun', 'diya', 'cow', 'bucket',
          'kite', 'spinningTop', 'rose', 'butterfly', 'pigeon', 'rabbit'
        ];
        choice = IMAGE_LIST[Math.floor(Math.random() * IMAGE_LIST.length)];
      } else {
        // Bets are present: Find choices with lowest total bet
        const totals = {};
        bets.forEach(b => {
          totals[b.choice] = (totals[b.choice] || 0) + b.amount;
        });
        // Find minimum
        let minAmount = Math.min(...Object.values(totals));
        // Find all choices with this min amount
        let lowestChoices = Object.entries(totals)
          .filter(([_, amt]) => amt === minAmount)
          .map(([name]) => name);
        // Randomly select among lowest (in case of tie)
        choice = lowestChoices[Math.floor(Math.random() * lowestChoices.length)];
      }

      // Save this auto-decided winner
      winDoc = await Winner.findOneAndUpdate(
        { round },
        { choice, createdAt: new Date() },
        { upsert: true, new: true }
      );
    } else {
      // Manual winner already set by admin
      choice = winDoc.choice;
    }

    // Winner-announced emit ONLY here (so user sees winner at timer 0)
    global.io.emit('winner-announced', { round, choice });

    // Find all winning bets for that round and distribute 10× payout
    const winningBets = await Bet.find({ round, choice });
    for (const wb of winningBets) {
      const user = await User.findById(wb.user);
      if (user) {
        user.balance += wb.amount * 10;
        await user.save();
      }
    }

    // Notify all clients that payouts have been distributed
    global.io.emit('payouts-distributed', { round, choice });
    return res.json({ message: 'Payouts distributed', round, choice });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};
