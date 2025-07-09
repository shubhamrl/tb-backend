const Bet = require('../models/Bet');
const Winner = require('../models/Winner');
const User = require('../models/User');
const LastWins = require('../models/LastWins');

// ------------ LAST WINS MAINTAIN ------------
async function addLastWin(choice, round) {
  let doc = await LastWins.findOne();
  if (!doc) doc = await LastWins.create({ wins: [] });
  if (doc.wins[0] && doc.wins[0].round === round && doc.wins[0].choice === choice) return;
  doc.wins.unshift({ round, choice });
  if (doc.wins.length > 10) doc.wins = doc.wins.slice(0, 10);
  await doc.save();
}
async function getLastWins() {
  let doc = await LastWins.findOne();
  return doc ? doc.wins : [];
}

// ========== 1️⃣ GET CURRENT ROUND ==========
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
    const userId = req.user.id || req.user._id;
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

// ========== 2️⃣ PLACE A BET ==========
async function placeBet(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { choice, amount, round } = req.body;

    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (amount <= 0 || user.balance < amount) {
      return res.status(400).json({ message: 'Invalid amount or insufficient balance' });
    }

    user.balance -= amount;
    user.lastActive = new Date();
    await user.save();

    // ⭐️ Calculate sessionId
    const sessionId = Math.floor((round - 1) / 960) + 1;

    const bet = new Bet({ user: userId, round, choice, amount, sessionId });
    await bet.save();

    global.io.emit('bet-placed', { choice, amount, round });
    return res.status(201).json({ message: 'Bet placed', bet });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}

// ========== 3️⃣ SET MANUAL WINNER ==========
async function setManualWinner(req, res) {
  try {
    const { choice, round } = req.body;
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }
    await Winner.findOneAndUpdate(
      { round },
      { choice, createdAt: new Date(), paid: false },
      { upsert: true, new: true }
    );
    global.io.emit('winner-announced', { round, choice });
    return res.json({ message: 'Winner recorded (awaiting payout)', choice });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
}

// ========== 4️⃣ DISTRIBUTE PAYOUTS ==========
async function distributePayouts(req, res) {
  try {
    const { round } = req.body;
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }

    let winDoc = await Winner.findOne({ round });
    let choice;

    if (winDoc && winDoc.paid) {
      return res.status(400).json({ message: 'Payout already done for this round' });
    }

    if (!winDoc) {
      const bets = await Bet.find({ round });
      if (!bets.length) {
        const IMAGE_LIST = [
          'umbrella', 'football', 'sun', 'diya', 'cow', 'bucket',
          'kite', 'spinningTop', 'rose', 'butterfly', 'pigeon', 'rabbit'
        ];
        choice = IMAGE_LIST[Math.floor(Math.random() * IMAGE_LIST.length)];
      } else {
        const totals = {};
        bets.forEach(b => {
          totals[b.choice] = (totals[b.choice] || 0) + b.amount;
        });
        let minAmount = Math.min(...Object.values(totals));
        const lowestChoices = Object.entries(totals)
          .filter(([_, amt]) => amt === minAmount)
          .map(([name]) => name);
        choice = lowestChoices[Math.floor(Math.random() * lowestChoices.length)];
      }

      winDoc = await Winner.create({ round, choice, createdAt: new Date(), paid: false });
      await addLastWin(choice, round);
      global.io.emit('winner-announced', { round, choice });
    } else {
      choice = winDoc.choice;
      global.io.emit('winner-announced', { round, choice });
    }

    winDoc = await Winner.findOne({ round });
    if (winDoc && winDoc.paid) {
      return res.status(400).json({ message: 'Payout already done for this round' });
    }

    // ⭐️ Distribute payouts and update win/payout in Bet
    const allBets = await Bet.find({ round });
    const winningBets = allBets.filter(b => b.choice === choice);

    for (const wb of winningBets) {
      const user = await User.findById(wb.user);
      if (user) {
        user.balance += wb.amount * 10;
        await user.save();
      }
      wb.payout = wb.amount * 10;
      wb.win = true;
      await wb.save();
    }

    // Optionally, mark all losing bets
    for (const lb of allBets) {
      if (lb.choice !== choice) {
        lb.payout = 0;
        lb.win = false;
        await lb.save();
      }
    }

    await Winner.findOneAndUpdate({ round }, { paid: true });

    global.io.emit('payouts-distributed', { round, choice });

    return res.json({ message: 'Payouts distributed', round, choice });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
}

// ========== 5️⃣ WINNER ANNOUNCE (NO PAYOUT) ==========
async function announceWinner(req, res) {
  try {
    const { round } = req.body;
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }
    let winDoc = await Winner.findOne({ round });
    let choice;

    if (!winDoc) {
      const bets = await Bet.find({ round });
      if (!bets.length) {
        const IMAGE_LIST = [
          'umbrella', 'football', 'sun', 'diya', 'cow', 'bucket',
          'kite', 'spinningTop', 'rose', 'butterfly', 'pigeon', 'rabbit'
        ];
        choice = IMAGE_LIST[Math.floor(Math.random() * IMAGE_LIST.length)];
      } else {
        const totals = {};
        bets.forEach(b => {
          totals[b.choice] = (totals[b.choice] || 0) + b.amount;
        });
        let minAmount = Math.min(...Object.values(totals));
        const lowestChoices = Object.entries(totals)
          .filter(([_, amt]) => amt === minAmount)
          .map(([name]) => name);
        choice = lowestChoices[Math.floor(Math.random() * lowestChoices.length)];
      }

      winDoc = await Winner.create({ round, choice, createdAt: new Date(), paid: false });
      await addLastWin(choice, round);
      global.io.emit('winner-announced', { round, choice });
      return res.json({ message: 'Winner announced', round, choice });
    } else {
      choice = winDoc.choice;
      global.io.emit('winner-announced', { round, choice });
      return res.json({ message: 'Winner already announced', round, choice });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
}

// ========== 6️⃣ LAST 10 WINS ==========
async function getLastWinsController(req, res) {
  try {
    const wins = await getLastWins();
    res.json({ wins });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

// ========== 7️⃣ MY BET HISTORY (Only for logged-in user, only current session) ==========
async function myBetHistory(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    // User ke latest sessionId wali bets dikhani hai
    const lastBet = await Bet.findOne({ user: userId }).sort({ sessionId: -1, round: -1 });
    const sessionId = lastBet ? lastBet.sessionId : 1;

    const bets = await Bet.find({ user: userId, sessionId });

    // Group by round, aggregate bets & winAmount
    const roundMap = {};
    bets.forEach(bet => {
      if (!roundMap[bet.round]) {
        roundMap[bet.round] = { round: bet.round, bets: [], winAmount: 0 };
      }
      roundMap[bet.round].bets.push({ choice: bet.choice, amount: bet.amount });
      if (bet.win && bet.payout > 0) {
        roundMap[bet.round].winAmount += bet.payout;
      }
    });

    // Prepare array sorted by round desc
    const history = Object.values(roundMap)
      .sort((a, b) => b.round - a.round)
      .map(row => ({
        round: row.round,
        bets: row.bets,
        winAmount: row.winAmount
      }));

    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

// EXPORTS
module.exports = {
  getCurrentRound,
  placeBet,
  setManualWinner,
  distributePayouts,
  getLastWins: getLastWinsController,
  announceWinner,
  myBetHistory
};
