const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { User, Payment } = require('../models');
const { planLimits } = require('../utils/planLimits');

/**
 * Create checkout session for plan subscription
 */
const createCheckoutSession = async (req, res) => {
  try {
    const { plan } = req.body;
    const user = req.user;

    if (!['intermediate', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const planConfig = planLimits[plan];

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id
        }
      });
      customerId = customer.id;
      await user.update({ stripeCustomerId: customerId });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `CleanCut IA - ${planConfig.name}`,
              description: planConfig.features.join(', ')
            },
            unit_amount: planConfig.price * 100, // Convert to cents
            recurring: {
              interval: 'month',
              interval_count: 1
            }
          },
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?cancelled=true`,
      metadata: {
        userId: user.id,
        plan
      }
    });

    res.json({ 
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};

/**
 * Handle Stripe webhooks
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

/**
 * Handle successful checkout
 */
const handleCheckoutCompleted = async (session) => {
  const { userId, plan } = session.metadata;

  const user = await User.findByPk(userId);
  if (!user) {
    console.error('User not found:', userId);
    return;
  }

  const planConfig = planLimits[plan];
  const planStartDate = new Date();
  const planEndDate = new Date();
  planEndDate.setDate(planEndDate.getDate() + planConfig.duration);

  await user.update({
    plan,
    planStartDate,
    planEndDate,
    stripeSubscriptionId: session.subscription
  });

  await Payment.create({
    userId,
    plan,
    amount: planConfig.price,
    currency: 'BRL',
    status: 'completed',
    stripePaymentId: session.payment_intent,
    metadata: { sessionId: session.id }
  });

  console.log(`Plan activated for user ${userId}: ${plan}`);
};

/**
 * Handle subscription update
 */
const handleSubscriptionUpdated = async (subscription) => {
  const user = await User.findOne({
    where: { stripeSubscriptionId: subscription.id }
  });

  if (!user) {
    console.error('User not found for subscription:', subscription.id);
    return;
  }

  // Handle subscription status changes
  if (subscription.status === 'active') {
    console.log(`Subscription active for user ${user.id}`);
  } else if (subscription.status === 'canceled') {
    await user.update({
      plan: 'free',
      planStartDate: new Date(),
      planEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    console.log(`Subscription cancelled for user ${user.id}`);
  }
};

/**
 * Handle subscription deletion
 */
const handleSubscriptionDeleted = async (subscription) => {
  const user = await User.findOne({
    where: { stripeSubscriptionId: subscription.id }
  });

  if (!user) {
    console.error('User not found for subscription:', subscription.id);
    return;
  }

  await user.update({
    plan: 'free',
    planStartDate: new Date(),
    planEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    stripeSubscriptionId: null
  });

  console.log(`Subscription deleted for user ${user.id}`);
};

/**
 * Handle successful payment
 */
const handlePaymentSucceeded = async (invoice) => {
  console.log('Payment succeeded:', invoice.id);
  
  const user = await User.findOne({
    where: { stripeCustomerId: invoice.customer }
  });

  if (user) {
    await Payment.create({
      userId: user.id,
      plan: user.plan,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency.toUpperCase(),
      status: 'completed',
      stripeInvoiceId: invoice.id
    });
  }
};

/**
 * Handle failed payment
 */
const handlePaymentFailed = async (invoice) => {
  console.error('Payment failed:', invoice.id);
  
  const user = await User.findOne({
    where: { stripeCustomerId: invoice.customer }
  });

  if (user) {
    await Payment.create({
      userId: user.id,
      plan: user.plan,
      amount: invoice.amount_due / 100,
      currency: invoice.currency.toUpperCase(),
      status: 'failed',
      stripeInvoiceId: invoice.id
    });
  }
};

/**
 * Get user's billing information
 */
const getBillingInfo = async (req, res) => {
  try {
    const user = req.user;

    const payments = await Payment.findAll({
      where: { userId: user.id },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    let subscription = null;
    if (user.stripeSubscriptionId) {
      try {
        subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      } catch (error) {
        console.error('Error fetching subscription:', error);
      }
    }

    res.json({
      plan: user.plan,
      planStartDate: user.planStartDate,
      planEndDate: user.planEndDate,
      subscription,
      payments,
      planLimits: planLimits[user.plan]
    });
  } catch (error) {
    console.error('Get billing info error:', error);
    res.status(500).json({ error: 'Failed to fetch billing information' });
  }
};

/**
 * Cancel subscription
 */
const cancelSubscription = async (req, res) => {
  try {
    const user = req.user;

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    await stripe.subscriptions.cancel(user.stripeSubscriptionId);

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

module.exports = {
  createCheckoutSession,
  handleWebhook,
  getBillingInfo,
  cancelSubscription
};
