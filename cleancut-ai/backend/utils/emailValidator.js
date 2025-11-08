const validator = require('validator');

// List of known temporary email domains
const temporaryEmailDomains = [
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'throwaway.email',
  'temp-mail.org',
  'getnada.com',
  'maildrop.cc',
  'trashmail.com',
  'yopmail.com',
  'fakeinbox.com',
  'sharklasers.com',
  'guerrillamail.info',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.de',
  'spam4.me',
  'mailnesia.com',
  'emailondeck.com',
  'mintemail.com',
  'mytemp.email',
  'mohmal.com',
  'dispostable.com',
  'tempail.com',
  'throwawaymail.com',
  '10mail.org',
  'mailcatch.com',
  'mailtemp.info',
  'getairmail.com',
  'anonbox.net',
  'anonymbox.com'
];

/**
 * Validates if an email is legitimate and not from a temporary email provider
 * @param {string} email - Email address to validate
 * @returns {Object} - { valid: boolean, message: string }
 */
const validateEmail = (email) => {
  // Basic email format validation
  if (!validator.isEmail(email)) {
    return {
      valid: false,
      message: 'Invalid email format'
    };
  }

  // Extract domain from email
  const domain = email.split('@')[1].toLowerCase();

  // Check against temporary email domains list
  if (temporaryEmailDomains.includes(domain)) {
    return {
      valid: false,
      message: 'Temporary email addresses are not allowed. Please use a permanent email address.'
    };
  }

  // Check for suspicious patterns (very short domains, numbers only, etc.)
  if (domain.length < 5) {
    return {
      valid: false,
      message: 'Email domain appears to be invalid'
    };
  }

  // Check for common patterns in disposable emails
  const suspiciousPatterns = [
    /temp/i,
    /trash/i,
    /disposable/i,
    /throwaway/i,
    /fake/i,
    /spam/i,
    /\d{5,}/  // 5 or more consecutive digits
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(domain)) {
      return {
        valid: false,
        message: 'Temporary or disposable email addresses are not allowed'
      };
      }
  }

  return {
    valid: true,
    message: 'Email is valid'
  };
};

/**
 * Middleware to validate email during registration
 */
const validateEmailMiddleware = (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const validation = validateEmail(email);

  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  next();
};

module.exports = { validateEmail, validateEmailMiddleware, temporaryEmailDomains };
