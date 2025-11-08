const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');
const { authMiddleware } = require('../middleware/auth');

// Webhook endpoint (no auth, raw body needed)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentsController.handleWebhook);

// Protected routes
router.post('/checkout', authMiddleware, paymentsController.createCheckoutSession);
router.get('/billing', authMiddleware, paymentsController.getBillingInfo);
router.post('/cancel-subscription', authMiddleware, paymentsController.cancelSubscription);

module.exports = router;
