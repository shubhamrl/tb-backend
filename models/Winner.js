const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
  round: {
    type: Number,    // <-- string nahi, number rakho! (bet ke round jaise)
    required: true,
    unique: true
  },
  choice: {
    type: String,    // image name ya number
    required: true
  },
  totalPayout: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Winner', winnerSchema);
