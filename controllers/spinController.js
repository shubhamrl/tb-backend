// controllers/spinController.js
const SpinBet = require('../models/SpinBet');
const User = require('../models/User');

// --- Helper for IST daily round calculation (90s round, 960/day) ---
function getCurrentRoundInfo() {
  const now = new Date();
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(now.getTime() + IST_OFFSET);
  const startOfDay = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate(), 0, 0, 0);
  const secondsPassed = Math.floor((nowIST - startOfDay) / 1000);
  const round = Math.min(Math.floor(secondsPassed / 90) + 1, 960);
  const currentRoundStart = startOfDay.getTime() + ((round - 1) * 90 * 1000);
  const currentRoundEnd = currentRoundStart + (90 * 1000);
  const timer = Math.max(0, Math.floor((currentRoundEnd - nowIST.getTime()) / 1000));
  return { round, timer };
}

// --- IN-MEMORY FOR MANUAL WINNER, LAST 10 WINS ---
let manualWinner = {}; // { [round]: number }
let last10Wins = []; // [{ round, winner }]

// 1️⃣ Place Bet
exports.placeBet = async (req, res) => {
  try {
    const { round, timer } = getCurrentRoundInfo();
    const { choice, amount } = req.body;
    const userId = req.user.id;

    // Validation
    if (typeof choice !== 'number' || choice < 0 || choice > 9 || !amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid bet' });
    }

    // User
    const user = await User.findById(userId);
    if (!user || user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Time check
    if (timer < 15) {
      return res.status(400).json({ error: 'Betting closed' });
    }

    // Deduct balance & save bet
    user.balance -= amount;
    user.lastActive = new Date();
    await user.save();

    await SpinBet.create({
      user: userId,
      round,
      choice,
      amount
    });

    return res.json({ success: true, balance: user.balance });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to place bet' });
  }
};

// 2️⃣ Get Current Round & Timer
exports.getCurrentRound = async (req, res) => {
  const info = getCurrentRoundInfo();
  res.json(info);
};

// 3️⃣ Get All Bets For Round (Admin & UserBets)
exports.getBetsForRound = async (req, res) => {
  try {
    const round = Number(req.params.round);
    const bets = await SpinBet.find({ round });
    return res.json({ bets });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch bets' });
  }
};

// 4️⃣ Set Manual Winner (Admin Only)
exports.setManualWinner = async (req, res) => {
  try {
    const { round, winner } = req.body;
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Not authorized' });
    manualWinner[round] = winner;
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to set winner' });
  }
};

// 5️⃣ Get Winner For Round
exports.getWinner = async (req, res) => {
  try {
    const round = Number(req.params.round);

    // 1. Manual Winner
    if (manualWinner[round] !== undefined) {
      return res.json({ winner: manualWinner[round] });
    }

    // 2. Auto winner logic (lowest bet)
    const bets = await SpinBet.find({ round });
    if (!bets.length) {
      // No bets, random winner
      return res.json({ winner: Math.floor(Math.random() * 10) });
    }
    // Find lowest total bet
    let betSums = Array(10).fill(0);
    bets.forEach(bet => { betSums[bet.choice] += bet.amount; });

    let min = Math.min(...betSums.filter(b => b > 0));
    let candidates = [];
    betSums.forEach((sum, idx) => {
      if (sum === min) candidates.push(idx);
    });
    if (!min || !candidates.length) {
      return res.json({ winner: Math.floor(Math.random() * 10) });
    }
    const winner = candidates[Math.floor(Math.random() * candidates.length)];
    return res.json({ winner });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get winner' });
  }
};

// 6️⃣ Last 10 Wins
exports.getLast10Wins = async (req, res) => {
  try {
    return res.json({ wins: last10Wins.slice(-10).reverse() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch last wins' });
  }
};

// 7️⃣ Bet Totals By Number for Manual Winner Page
exports.getBetTotalsByNumber = async (req, res) => {
  try {
    const round = Number(req.params.round);
    const bets = await SpinBet.find({ round });
    let totals = Array(10).fill(0);
    bets.forEach(bet => { totals[bet.choice] += bet.amount; });

    return res.json({ round, totals });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get bet totals' });
  }
};

// 8️⃣ Round Summary for summary page
exports.getRoundSummary = async (req, res) => {
  try {
    const round = Number(req.params.round);
    const bets = await SpinBet.find({ round });
    if (!bets.length) {
      return res.json({
        round,
        totalBet: 0,
        winner: null,
        totalPayout: 0
      });
    }

    const totalBet = bets.reduce((a, b) => a + b.amount, 0);

    // Winner (manual ya auto, jaise pehle)
    let winner = null;
    if (manualWinner[round] !== undefined) {
      winner = manualWinner[round];
    } else {
      let totals = Array(10).fill(0);
      bets.forEach(bet => { totals[bet.choice] += bet.amount; });
      let min = Math.min(...totals.filter(x => x > 0));
      let candidates = [];
      totals.forEach((sum, idx) => {
        if (sum === min) candidates.push(idx);
      });
      if (!min || !candidates.length) {
        winner = Math.floor(Math.random() * 10);
      } else {
        winner = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    // Total payout (winner par jitne bet the unka *10)
    const totalPayout = bets.filter(b => b.choice === winner).reduce((a, b) => a + (b.amount * 10), 0);

    return res.json({
      round,
      totalBet,
      winner,
      totalPayout
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch round summary' });
  }
};
