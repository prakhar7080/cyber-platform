import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { sendOTP, sendPasswordResetOTP } from '../utils/emailService.js';
import crypto from 'crypto';
import Enrollment from '../models/Enrollment.js';
import Certificate from '../models/Certificate.js';

const generateOTP = () => crypto.randomInt(100000, 999999).toString();
const parseBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
  }
  if (typeof value === 'number') return value === 1;
  return fallback;
};

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES) || 10;

const shouldExposeDebugOtp = (() => {
  if (typeof process.env.EXPOSE_DEBUG_OTP !== 'undefined') {
    return parseBool(process.env.EXPOSE_DEBUG_OTP, false);
  }
  return process.env.NODE_ENV !== 'production';
})();

const attachOtpDebugInfo = (payload, debugData) => {
  if (!shouldExposeDebugOtp || !debugData?.otp) return payload;
  return {
    ...payload,
    debugOtp: debugData.otp,
    emailDelivery: debugData.reason ?? 'mock',
  };
};

const normalizeEmail = (email = '') => email.toLowerCase().trim();

const formatUserResponse = (userDoc) => {
  if (!userDoc) return null;

  const plainUser = userDoc.toObject ? userDoc.toObject() : userDoc;
  return {
    id: plainUser._id?.toString() ?? plainUser.id,
    _id: plainUser._id?.toString() ?? plainUser.id,
    name: plainUser.name,
    email: plainUser.email,
    role: plainUser.role,
    summary: plainUser.summary,
    profilePicUrl: plainUser.profilePicUrl,
    themePreference: plainUser.themePreference,
    preferences: plainUser.preferences,
    isEmailVerified: plainUser.isEmailVerified,
    createdAt: plainUser.createdAt,
    updatedAt: plainUser.updatedAt,
  };
};

// Rate limiting for OTP resend
const otpResendAttempts = new Map();
const MAX_OTP_ATTEMPTS = 5;
const MAX_PASSWORD_RESET_ATTEMPTS = 5;
const RESET_TIME_MS = 60 * 60 * 1000; // 1 hour

export const signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Input validation
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User already exists. Please login or use a different email.' 
      });
    }

    // Create user
    const user = new User({
      email: email.toLowerCase().trim(),
      password,
      name: name.trim(),
    });

    // Generate and save OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
      attempts: 0,
      lastSent: new Date()
    };

    await user.save();

    // Send OTP email
    const emailResult = await sendOTP(email, otp);

    res.status(201).json(attachOtpDebugInfo({
      success: true,
      message: emailResult?.mocked
        ? 'Account created. OTP logged to server because email delivery is in mock mode.'
        : 'Verification OTP sent to your email.',
      userId: user._id,
      email: user.email,
      emailDelivery: emailResult?.mocked ? (emailResult.reason ?? 'mock') : 'sent'
    }, emailResult));

  } catch (error) {
    console.error('Signup error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: Object.values(error.errors).map(val => val.message).join(', ')
      });
    }
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration. Please try again.' 
    });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID and OTP are required' 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found. Please register again.' 
      });
    }

    // Check if OTP exists and is not expired
    if (!user.otp || !user.otp.code) {
      return res.status(400).json({ 
        success: false,
        message: 'No OTP found. Please request a new one.' 
      });
    }

    // Check if OTP is expired
    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({ 
        success: false,
        message: 'OTP has expired. Please request a new one.' 
      });
    }

    // Check if OTP matches
    if (user.otp.code !== otp) {
      // Increment failed attempts
      user.otp.attempts = (user.otp.attempts || 0) + 1;
      await user.save();
      
      const remainingAttempts = Math.max(0, 5 - user.otp.attempts);
      
      return res.status(400).json({ 
        success: false,
        message: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
        remainingAttempts
      });
    }

    // Mark email as verified and clear OTP
    user.isEmailVerified = true;
    user.otp = undefined;
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        role: user.role,
        isEmailVerified: true 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Increased token expiry
    );

    res.json({ 
      success: true,
      message: 'Email verified successfully',
      token,
      user: formatUserResponse(user)
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'An error occurred during OTP verification' 
    });
  }
};

export const resendOTP = async (req, res) => {
  try {
    const { userId, email } = req.body;
    
    if (!userId && !email) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID or email is required' 
      });
    }

    // Find user by ID or email
    const user = userId 
      ? await User.findById(userId)
      : await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check rate limiting
    const now = Date.now();
    const userAttempts = otpResendAttempts.get(user._id) || { count: 0, lastAttempt: 0 };

    if (userAttempts.count >= MAX_OTP_ATTEMPTS) {
      const timeLeft = Math.ceil((userAttempts.lastAttempt + RESET_TIME_MS - now) / 60000);
      if (timeLeft > 0) {
        return res.status(429).json({ 
          success: false,
          message: `Too many attempts. Please try again in ${timeLeft} minutes.` 
        });
      } else {
        // Reset counter if time has passed
        otpResendAttempts.delete(user._id);
      }
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(now + 10 * 60 * 1000); // 10 minutes from now

    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
      attempts: 0,
      lastSent: new Date()
    };

    await user.save();

    // Update rate limiting
    otpResendAttempts.set(user._id, {
      count: (userAttempts.count || 0) + 1,
      lastAttempt: now
    });

    const emailResult = await sendOTP(user.email, otp);
    
    if (emailResult?.mocked && !shouldExposeDebugOtp) {
      return res.status(200).json({
        success: true,
        message: 'OTP generated but email delivery is disabled. Contact support.',
        emailDelivery: 'mock'
      });
    }

    res.json(attachOtpDebugInfo({ 
      success: true,
      message: emailResult?.mocked
        ? 'OTP logged to server because email delivery is in mock mode.'
        : 'New OTP has been sent to your email',
      userId: user._id,
      email: user.email,
      emailDelivery: emailResult?.mocked ? (emailResult.reason ?? 'mock') : 'sent'
    }, emailResult));

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ 
      success: false,
      message: 'An error occurred while resending OTP' 
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide both email and password' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({ 
        success: false,
        message: 'Please verify your email before logging in',
        needsVerification: true,
        userId: user._id,
        email: user.email
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        role: user.role,
        isEmailVerified: user.isEmailVerified 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: formatUserResponse(user)
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'An error occurred during login' 
    });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account does not exist with this email',
      });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    user.passwordReset = {
      code: otp,
      expiresAt: otpExpiry,
      attempts: 0,
      requestedAt: new Date(),
    };

    await user.save();

    const emailResult = await sendPasswordResetOTP(user.email, otp);

    return res.json(
      attachOtpDebugInfo(
        {
          success: true,
          message: emailResult?.mocked
            ? 'Password reset OTP generated but email delivery is disabled.'
            : 'Password reset OTP sent to your email.',
          email: user.email,
          emailDelivery: emailResult?.mocked ? (emailResult.reason ?? 'mock') : 'sent',
        },
        emailResult,
      ),
    );
  } catch (error) {
    console.error('Password reset request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate password reset. Please try again.',
    });
  }
};

export const resetPasswordWithOTP = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account does not exist with this email',
      });
    }

    const resetData = user.passwordReset;
    if (!resetData || !resetData.code) {
      return res.status(400).json({
        success: false,
        message: 'No password reset request found for this account',
      });
    }

    if (new Date() > resetData.expiresAt) {
      user.passwordReset = undefined;
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    if (resetData.code !== otp) {
      user.passwordReset.attempts = (user.passwordReset.attempts || 0) + 1;
      await user.save();

      const remainingAttempts = Math.max(
        0,
        MAX_PASSWORD_RESET_ATTEMPTS - user.passwordReset.attempts,
      );

      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
        remainingAttempts,
      });
    }

    user.password = newPassword;
    user.passwordReset = undefined;
    await user.save();

    return res.json({
      success: true,
      message: 'Password updated successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password. Please try again.',
    });
  }
};

// Clean up expired OTPs
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of otpResendAttempts.entries()) {
    if (now - data.lastAttempt > RESET_TIME_MS) {
      otpResendAttempts.delete(userId);
    }
  }
}, 3600000); // Run every hour

export const getCurrentUser = (req, res) => {
  try {
    const user = formatUserResponse(req.user);
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load user profile'
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, summary, themePreference, profilePicUrl, preferences } = req.body;
    const updates = {};

    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }

    if (typeof summary === 'string') {
      updates.summary = summary.trim();
    }

    if (typeof profilePicUrl === 'string') {
      updates.profilePicUrl = profilePicUrl.trim();
    }

    if (typeof themePreference === 'string' && ['dark', 'light'].includes(themePreference)) {
      updates.themePreference = themePreference;
    }

    if (preferences && typeof preferences === 'object') {
      updates.preferences = {
        emailNotifications: typeof preferences.emailNotifications === 'boolean'
          ? preferences.emailNotifications
          : req.user.preferences?.emailNotifications ?? true
      };
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided to update'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    );

    res.json({
      success: true,
      user: formatUserResponse(updatedUser)
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update password'
    });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const confirmation = (req.body?.confirmation || '').trim().toLowerCase();
    if (confirmation !== 'delete'.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Please type "Delete" to confirm account removal'
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await Promise.all([
      Enrollment.deleteMany({ user: userId }),
      Certificate.deleteMany({ user: userId })
    ]);

    await User.deleteOne({ _id: userId });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account. Please try again.'
    });
  }
};

const extractActivityDates = (enrollments = []) => {
  const dates = new Set();
  enrollments.forEach((enrollment) => {
    ['createdAt', 'updatedAt', 'completedAt'].forEach((field) => {
      const value = enrollment?.[field];
      if (value) {
        const dayKey = new Date(value).toISOString().slice(0, 10);
        dates.add(dayKey);
      }
    });
  });
  return dates;
};

const computeLearningStreak = (datesSet) => {
  let streak = 0;
  const checkDate = new Date();

  while (true) {
    const key = checkDate.toISOString().slice(0, 10);
    if (datesSet.has(key)) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
};

export const getProfileStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const enrollments = await Enrollment.find({ user: userId }).lean();
    const certificates = await Certificate.countDocuments({ user: userId });

    const quizScores = [];
    enrollments.forEach((enrollment) => {
      if (typeof enrollment.finalQuizScore === 'number') {
        quizScores.push(enrollment.finalQuizScore);
      }
      if (Array.isArray(enrollment.completedQuizzes)) {
        enrollment.completedQuizzes.forEach((entry) => {
          if (typeof entry.score === 'number') {
            quizScores.push(entry.score);
          }
        });
      }
    });

    const avgQuizScore =
      quizScores.length > 0
        ? Number((quizScores.reduce((acc, score) => acc + score, 0) / quizScores.length).toFixed(1))
        : 0;

    const activityDates = extractActivityDates(enrollments);
    const learningStreakDays = computeLearningStreak(activityDates);

    res.json({
      success: true,
      stats: {
        avgQuizScore,
        learningStreakDays,
        certificateCount: certificates,
      },
    });
  } catch (error) {
    console.error('Get profile stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load profile stats',
    });
  }
};