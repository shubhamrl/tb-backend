const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Register, login, verify OTP (as you already have them)...

// ========== Forgot Password Controller ==========
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1hr
    await user.save();

    // Nodemailer Setup (env vars required!)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const resetLink = `https://YOUR_FRONTEND_URL/reset-password/${resetToken}`;
    await transporter.sendMail({
      to: user.email,
      subject: 'Password Reset',
      text: `Click the following link to reset your password: ${resetLink}`,
      html: `<p>Click the following link to reset your password:</p><a href="${resetLink}">${resetLink}</a>`
    });

    res.json({ message: 'Reset link sent to your email.' });
  } catch (err) {
    console.error('Forgot Password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ========== Reset Password Controller ==========
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired token.' });

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset Password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
