const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    default: 0
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },

  // ===== Forgot password fields (start) =====
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  // ===== Forgot password fields (end) =====

  // ===== Referral System fields (start) =====
  referrerId: { // Kisne refer kiya (parent)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralRewarded: { // Pehli deposit par reward diya gaya ya nahi
    type: Boolean,
    default: false
  },
  referralRewardedAt: { // Kab reward mila (for admin/history)
    type: Date,
    default: null
  },
  referralEarnings: { // Total referral se kamai (referrer ke liye)
    type: Number,
    default: 0
  },
  referralHistory: [
    {
      referredUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      amount: Number,
      date: { type: Date, default: Date.now },
      note: String // "Rewarded for first deposit"
    }
  ]
  // ===== Referral System fields (end) =====
});

// Password hash middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Password comparison method
userSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
