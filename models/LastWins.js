const mongoose = require('mongoose');

const lastWinsSchema = new mongoose.Schema({
  wins: [
    {
      round: Number,
      choice: String
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('LastWins', lastWinsSchema);
