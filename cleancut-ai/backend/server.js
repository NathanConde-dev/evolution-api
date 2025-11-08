const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const { testConnection, sequelize } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { syncDatabase } = require('./models');
const { initializeCronJobs } = require('./utils/cleanup-cron');

// Import routes
const authRoutes = require('./routes/auth');
const projectsRoutes = require('./routes/projects');
const paymentsRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
// Note: Webhook route needs raw body, so we handle it separately
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/payments', paymentsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'CleanCut IA API',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile',
        passwordReset: 'POST /api/auth/password-reset/request'
      },
      projects: {
        create: 'POST /api/projects',
        list: 'GET /api/projects',
        get: 'GET /api/projects/:id',
        status: 'GET /api/projects/:id/status',
        download: 'GET /api/projects/:id/download',
        cancel: 'POST /api/projects/:id/cancel',
        delete: 'DELETE /api/projects/:id',
        dashboard: 'GET /api/projects/dashboard'
      },
      payments: {
        checkout: 'POST /api/payments/checkout',
        billing: 'GET /api/payments/billing',
        cancel: 'POST /api/payments/cancel-subscription',
        webhook: 'POST /api/payments/webhook'
      }
    }
  });
});

// Serve frontend pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
});

app.get('/video-removal', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/video-removal.html'));
});

app.get('/image-removal', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/image-removal.html'));
});

app.get('/projects', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/projects.html'));
});

app.get('/billing', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/billing.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize server
const startServer = async () => {
  try {
    console.log('🚀 Starting CleanCut IA Server...\n');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Sync database models
    await syncDatabase(false); // Set to true to drop and recreate tables

    // Connect to Redis
    const redisConnected = await connectRedis();
    if (!redisConnected) {
      console.warn('⚠️  Redis connection failed - queue functionality will be limited');
    }

    // Initialize cron jobs for cleanup
    initializeCronJobs();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV}`);
      console.log(`✓ Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`\n📚 API Documentation: http://localhost:${PORT}/api`);
      console.log(`🏠 Frontend: http://localhost:${PORT}\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
