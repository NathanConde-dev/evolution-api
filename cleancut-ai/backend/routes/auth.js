const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { validateEmailMiddleware } = require('../utils/emailValidator');
const rateLimit = require('express-rate-limit');

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many attempts, please try again later'
});

// Public routes
router.post('/register', validateEmailMiddleware, authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/password-reset/request', authLimiter, authController.requestPasswordReset);
router.post('/password-reset/confirm', authLimiter, authController.resetPassword);

// Protected routes
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;
