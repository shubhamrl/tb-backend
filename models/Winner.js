const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
  round: {
    type: Number,
    required: true,
    unique: true
  },
  choice: {
    type: String,
    required: true
  },
  paid: { // <-- Double payout ka lock!
    type: Boolean,
    default: false
  },
  totalPayout: { // Optional, future use (rakh sakte ho)
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Winner', winnerSchema);
