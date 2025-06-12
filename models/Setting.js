const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  depositWhatsapp: { type: String, default: "" },
  withdrawWhatsapp: { type: String, default: "" },
});

module.exports = mongoose.model('Setting', SettingSchema);
