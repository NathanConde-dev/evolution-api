/**
 * Plan limits and features configuration
 */
const planLimits = {
  free: {
    name: 'Free Trial',
    duration: 7, // days
    dailyUploads: parseInt(process.env.FREE_DAILY_UPLOADS) || 3,
    monthlyUploads: null,
    maxResolution: parseInt(process.env.FREE_MAX_RESOLUTION) || 720,
    priority: 'low',
    price: 0,
    features: [
      '3 uploads per day',
      'Up to 720p resolution',
      '7 days trial',
      'Basic support'
    ]
  },
  intermediate: {
    name: 'Intermediate',
    duration: 365, // days (12 months)
    dailyUploads: null,
    monthlyUploads: parseInt(process.env.INTERMEDIATE_MONTHLY_UPLOADS) || 30,
    maxResolution: parseInt(process.env.INTERMEDIATE_MAX_RESOLUTION) || 1080,
    priority: 'medium',
    price: 50, // R$ per month
    features: [
      '30 uploads per month',
      'Up to 1080p resolution',
      'Medium priority processing',
      'Email support',
      '12-month commitment'
    ]
  },
  premium: {
    name: 'Premium',
    duration: 365, // days (12 months)
    dailyUploads: null,
    monthlyUploads: parseInt(process.env.PREMIUM_MONTHLY_UPLOADS) || 999,
    maxResolution: parseInt(process.env.PREMIUM_MAX_RESOLUTION) || 2160,
    priority: 'high',
    price: 360, // R$ per month (with 40% discount)
    originalPrice: 600,
    discount: 40,
    features: [
      'Unlimited uploads',
      'Up to 4K resolution',
      'High priority processing',
      'Priority support',
      '12-month commitment',
      '40% discount'
    ]
  }
};

/**
 * Check if user can upload based on their plan limits
 * @param {Object} user - User object with plan and upload counts
 * @returns {Object} - { allowed: boolean, message: string }
 */
const canUserUpload = (user) => {
  const limits = planLimits[user.plan];

  if (!limits) {
    return { allowed: false, message: 'Invalid plan' };
  }

  // Check daily limit for free plan
  if (limits.dailyUploads !== null) {
    const today = new Date().toISOString().split('T')[0];
    const lastUpload = user.lastUploadDate ? user.lastUploadDate.toISOString().split('T')[0] : null;

    // Reset daily counter if it's a new day
    if (lastUpload !== today) {
      return { allowed: true, message: 'Upload allowed', resetDaily: true };
    }

    if (user.uploadsToday >= limits.dailyUploads) {
      return { 
        allowed: false, 
        message: `Daily upload limit reached (${limits.dailyUploads} uploads per day). Upgrade to continue.` 
      };
    }
  }

  // Check monthly limit for paid plans
  if (limits.monthlyUploads !== null) {
    if (user.uploadsThisMonth >= limits.monthlyUploads) {
      return { 
        allowed: false, 
        message: `Monthly upload limit reached (${limits.monthlyUploads} uploads per month). Upgrade to continue.` 
      };
    }
  }

  // Check if plan has expired
  if (user.planEndDate && new Date(user.planEndDate) < new Date()) {
    return { 
      allowed: false, 
      message: 'Your plan has expired. Please renew to continue.' 
    };
  }

  return { allowed: true, message: 'Upload allowed' };
};

/**
 * Get resolution limit for user's plan
 * @param {string} plan - Plan name
 * @returns {number} - Maximum resolution height
 */
const getMaxResolution = (plan) => {
  return planLimits[plan]?.maxResolution || 720;
};

/**
 * Get processing priority for user's plan
 * @param {string} plan - Plan name
 * @returns {string} - Priority level
 */
const getProcessingPriority = (plan) => {
  return planLimits[plan]?.priority || 'low';
};

module.exports = {
  planLimits,
  canUserUpload,
  getMaxResolution,
  getProcessingPriority
};
