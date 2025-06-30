// models/LastWins.js
const mongoose = require('mongoose');
const lastWinsSchema = new mongoose.Schema({
  wins: [String]   // yahan sirf choice ya image ka naam store ho
}, { timestamps: true });

module.exports = mongoose.model('LastWins', lastWinsSchema);
