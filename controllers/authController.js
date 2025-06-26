// server/controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { email, password, referrerId } = req.body;
    // पहले चेक करें कि यूज़र मौजूद तो नहीं
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    // नया यूज़र बनाएँ (pre save middleware पासवर्ड हैश कर देगा)
    const user = new User({ email, password });

    // Referral logic: agar referrerId diya hai to validate aur save karo
    if (referrerId) {
      try {
        const refUser = await User.findById(referrerId);
        if (refUser) user.referrerId = referrerId;
      } catch (e) {
        // invalid id diya to ignore
      }
    }

    await user.save();
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // यूज़र लोड करें
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    // टोकन साइन करें
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
