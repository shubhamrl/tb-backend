const Bet = require('../models/Bet');
const Winner = require('../models/Winner');
const User = require('../models/User');
const LastWins = require('../models/LastWins');

// Utility: Last 10 win maintain (reuse in payout/announce)
async function addLastWin(choice, round) {
  let doc = await LastWins.findOne();
  if (!doc) doc = await LastWins.create({ wins: [] });
  if (doc.wins[0] && doc.wins[0].round === round && doc.wins[0].choice === choice) return;
  doc.wins.unshift({ round, choice });
  if (doc.wins.length > 10) doc.wins = doc.wins.slice(0, 10);
  await doc.save();
}
async function getLastWinsController(req, res) {
  try {
    let doc = await LastWins.findOne();
    res.json({ wins: doc ? doc.wins : [] });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

// Admin sets manual winner for round
async function setManualWinner(req, res) {
  try {
    const { choice, round } = req.body;
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }
    // Always allow admin to override winner for round
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

// LOCK/Auto-winner (only if admin hasn't set)
async function lockWinner(req, res) {
  try {
    const { round } = req.body;
    console.log('[LOCK_WINNER]', { round, time: Date.now() });
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }
    // (1) Admin already set winner? Just return.
    let winDoc = await Winner.findOne({ round });
    if (winDoc && winDoc.choice) {
      return res.json({ alreadyLocked: true, choice: winDoc.choice });
    }

    // (2) Nahi set kiya, toh auto logic:
    const bets = await Bet.find({ round });
    let choice;
    if (!bets.length) {
      // No bets at all, random
      const IMAGE_LIST = [
        'umbrella', 'football', 'sun', 'diya', 'cow', 'bucket',
        'kite', 'spinningTop', 'rose', 'butterfly', 'pigeon', 'rabbit'
      ];
      choice = IMAGE_LIST[Math.floor(Math.random() * IMAGE_LIST.length)];
    } else {
      // Lowest total bet wala
      const totals = {};
      bets.forEach(b => { totals[b.choice] = (totals[b.choice] || 0) + b.amount; });
      let minAmount = Math.min(...Object.values(totals));
      const lowestChoices = Object.entries(totals)
        .filter(([_, amt]) => amt === minAmount)
        .map(([name]) => name);
      choice = lowestChoices[Math.floor(Math.random() * lowestChoices.length)];
    }
    // Save winner
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

// Announce winner for round (timer=5), only run if not already set by admin
async function announceWinner(req, res) {
  try {
    const { round } = req.body;
    
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }
    // (1) Already set? Use existing!
    let winDoc = await Winner.findOne({ round });
    let choice = winDoc ? winDoc.choice : null;
    if (choice) {
      await addLastWin(choice, round);
      global.io.emit('winner-announced', { round, choice });
      return res.json({ message: 'Winner announced', round, choice });
    }

    // (2) Auto logic as per above
    const bets = await Bet.find({ round });
    if (!bets.length) {
      const IMAGE_LIST = [
        'umbrella', 'football', 'sun', 'diya', 'cow', 'bucket',
        'kite', 'spinningTop', 'rose', 'butterfly', 'pigeon', 'rabbit'
      ];
      choice = IMAGE_LIST[Math.floor(Math.random() * IMAGE_LIST.length)];
    } else {
      const totals = {};
      bets.forEach(b => { totals[b.choice] = (totals[b.choice] || 0) + b.amount; });
      let minAmount = Math.min(...Object.values(totals));
      const lowestChoices = Object.entries(totals)
        .filter(([_, amt]) => amt === minAmount)
        .map(([name]) => name);
      choice = lowestChoices[Math.floor(Math.random() * lowestChoices.length)];
    }
    await Winner.findOneAndUpdate(
      { round },
      { choice, createdAt: new Date(), paid: false },
      { upsert: true, new: true }
    );
    await addLastWin(choice, round);
    global.io.emit('winner-announced', { round, choice });
    return res.json({ message: 'Winner announced', round, choice });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
}

// Payout distribution (called at round end)
async function distributePayouts(req, res) {
  try {
    const { round } = req.body;
    if (!round || typeof round !== 'number' || round < 1 || round > 960) {
      return res.status(400).json({ message: 'Invalid round' });
    }
    let winDoc = await Winner.findOneAndUpdate(
      { round, paid: false },
      { paid: true },
      { new: true }
    );
    if (!winDoc) {
      return res.status(400).json({ message: 'Payout already done for this round' });
    }
    let choice = winDoc.choice;
    if (!choice) {
      // Fallback: winner not set? Do logic now
      const bets = await Bet.find({ round });
      if (!bets.length) {
        const IMAGE_LIST = [
          'umbrella', 'football', 'sun', 'diya', 'cow', 'bucket',
          'kite', 'spinningTop', 'rose', 'butterfly', 'pigeon', 'rabbit'
        ];
        choice = IMAGE_LIST[Math.floor(Math.random() * IMAGE_LIST.length)];
      } else {
        const totals = {};
        bets.forEach(b => { totals[b.choice] = (totals[b.choice] || 0) + b.amount; });
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
    // Payout logic (as before)
    const allBets = await Bet.find({ round });
    const winningBets = allBets.filter(b => b.choice === choice);
    const userTotalBets = {};
    for (const bet of winningBets) {
      const uid = String(bet.user);
      if (!userTotalBets[uid]) userTotalBets[uid] = 0;
      userTotalBets[uid] += bet.amount;
    }
    for (const userId of Object.keys(userTotalBets)) {
      const totalAmount = userTotalBets[userId];
      const payout = totalAmount * 10;
      await User.findByIdAndUpdate(userId, { $inc: { balance: payout } });
    }
    for (const bet of winningBets) {
      bet.payout = 0; bet.win = true; await bet.save();
    }
    for (const lb of allBets) {
      if (lb.choice !== choice) { lb.payout = 0; lb.win = false; await lb.save(); }
    }
    global.io.emit('winner-announced', { round, choice });
    global.io.emit('payouts-distributed', { round, choice });
    return res.json({ message: 'Payouts distributed', round, choice });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  setManualWinner,
  lockWinner,
  announceWinner,
  distributePayouts,
  getLastWins: getLastWinsController
};
