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
    return res.json({ message: 'Winner recorded (awaiting payout)', choice });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
}

// ========== 3.5️⃣ LOCK WINNER (TIMER 10) ==========
async function lockWinner(req, res) {
  try {
    const { round } = req.body;
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }
    let winDoc = await Winner.findOne({ round });
    if (winDoc && winDoc.choice) {
      // Already locked by admin
      return res.json({ alreadyLocked: true, choice: winDoc.choice });
    }
    // Lock with auto logic
    const bets = await Bet.find({ round });
    let choice;
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
    // Save to DB (upsert)
    await Winner.findOneAndUpdate(
      { round },
      { choice, createdAt: new Date(), paid: false },
      { upsert: true, new: true }
    );
    return res.json({ locked: true, choice });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
}

// ========== 4️⃣ DISTRIBUTE PAYOUTS (FIXED: Total payout ek baar) ==========
async function distributePayouts(req, res) {
  try {
    const { round } = req.body;
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }

    // ========== ATOMIC UPDATE: Only 1 payout per round ==========
    let winDoc = await Winner.findOneAndUpdate(
      { round, paid: false },
      { paid: true },
      { new: true }
    );

    if (!winDoc) {
      return res.status(400).json({ message: 'Payout already done for this round' });
    }

    let choice = winDoc.choice;

    // If winner not yet set (should never happen now), set winner
    if (!choice) {
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
      await Winner.findOneAndUpdate({ round }, { choice }, { new: true });
      await addLastWin(choice, round);
    } else {
      await addLastWin(choice, round);
    }

    // ------- 🟢🟢 Payout logic: Group by user, total bet per user (on winner image) 🟢🟢 -------
    const allBets = await Bet.find({ round });
    const winningBets = allBets.filter(b => b.choice === choice);

    // 1. Group bets by userId, sum total bet per user on winner choice
    const userTotalBets = {};
    for (const bet of winningBets) {
      const uid = String(bet.user);
      if (!userTotalBets[uid]) userTotalBets[uid] = 0;
      userTotalBets[uid] += bet.amount;
    }

    // 2. Give payout once per user (total*10)
    for (const userId of Object.keys(userTotalBets)) {
      const totalAmount = userTotalBets[userId];
      const payout = totalAmount * 10;
      await User.findByIdAndUpdate(userId, { $inc: { balance: payout } });
    }

    // 3. Mark each winning bet as win:true, payout:0 (optional: can keep payout per bet, but total credited above)
    for (const bet of winningBets) {
      bet.payout = 0; // payout shown 0 per bet, or you can set bet.amount*10 for 1st bet, rest 0
      bet.win = true;
      await bet.save();
    }

    // 4. Losing bets
    for (const lb of allBets) {
      if (lb.choice !== choice) {
        lb.payout = 0;
        lb.win = false;
        await lb.save();
      }
    }

    global.io.emit('winner-announced', { round, choice });
    global.io.emit('payouts-distributed', { round, choice });

    return res.json({ message: 'Payouts distributed', round, choice });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
}

// ========== 5️⃣ ANNOUNCE WINNER (TIMER = 5) ==========
async function announceWinner(req, res) {
  try {
    const { round } = req.body;
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }

    let winDoc = await Winner.findOne({ round });
    let choice = winDoc ? winDoc.choice : null;

    if (!choice) {
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
    }

    await addLastWin(choice, round);

    global.io.emit('winner-announced', { round, choice });
    return res.json({ message: 'Winner announced', round, choice });
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

// ========== 7️⃣ MY BET HISTORY (WINNER INCLUDED) ==========
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
      .select('round choice -_id')
      .lean();

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

// ========== 8️⃣ TODAY'S SUMMARY ==========
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
  getCurrentRound,
  placeBet,
  setManualWinner,
  lockWinner,
  distributePayouts, // <-- FIXED!
  getLastWins: getLastWinsController,
  announceWinner,
  myBetHistory,
  getTodaySummary
};
