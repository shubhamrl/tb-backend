const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const auth = require('../middlewares/authMiddleware'); // agar auth lagana hai

// Get current settings
router.get('/', async (req, res) => {
  const setting = await Setting.findOne();

  res.json({
    depositWhatsapp: setting?.depositWhatsapp || '',
    withdrawWhatsapp: setting?.withdrawWhatsapp || ''
  });
});

// Update settings (admin only)
router.put('/', auth, async (req, res) => {
  const { depositWhatsapp, withdrawWhatsapp } = req.body;
  let setting = await Setting.findOne();
  if (!setting) {
    setting = new Setting();
  }
  if (depositWhatsapp !== undefined) setting.depositWhatsapp = depositWhatsapp;
  if (withdrawWhatsapp !== undefined) setting.withdrawWhatsapp = withdrawWhatsapp;
  await setting.save();
  res.json(setting);
});

module.exports = router;
