// models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  profilePicUrl: {
    type: String,
  },
  summary: {
    type: String,
    default: '',
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  otp: {
    code: { type: String },
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0 },
    lastSent: { type: Date },
  },
  passwordReset: {
    code: { type: String },
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0 },
    requestedAt: { type: Date },
  },
  themePreference: {
    type: String,
    enum: ['dark', 'light'],
    default: 'dark',
  },
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true,
    },
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'instructor'],
    default: 'user',
  },
}, { timestamps: true });

// Add any existing methods or pre-save hooks you have
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};
const User = mongoose.model('User', userSchema);
export default User;