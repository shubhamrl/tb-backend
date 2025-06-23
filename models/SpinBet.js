const mongoose = require('mongoose');

const spinBetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  round: { type: Number, required: true },
  choice: { type: Number, required: true }, // 0-9
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SpinBet', spinBetSchema);
