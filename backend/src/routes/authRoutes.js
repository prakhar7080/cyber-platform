// routes/authRoutes.js
import express from 'express';
import { signup, login, verifyOTP, resendOTP, getCurrentUser, updateProfile, getProfileStats, changePassword, requestPasswordReset, resetPasswordWithOTP, deleteAccount } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/register', signup); // alias for legacy clients
router.post('/login', login);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPasswordWithOTP);
router.get('/me', authMiddleware, getCurrentUser);
router.patch('/me', authMiddleware, updateProfile);
router.delete('/me', authMiddleware, deleteAccount);
router.get('/stats', authMiddleware, getProfileStats);
router.post('/change-password', authMiddleware, changePassword);

export default router;