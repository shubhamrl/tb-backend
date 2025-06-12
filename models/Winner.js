const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
  round: {
    type: String,
    required: true,
    unique: true
  },
  choice: {
    type: String,    // image name ya number
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Winner', winnerSchema);
