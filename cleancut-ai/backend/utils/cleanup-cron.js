const cron = require('node-cron');
const { Project } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs').promises;

/**
 * Clean up expired projects (older than 24 hours)
 */
const cleanupExpiredProjects = async () => {
  try {
    console.log('Running cleanup job...');

    const expiredProjects = await Project.findAll({
      where: {
        expiresAt: {
          [Op.lt]: new Date()
        }
      }
    });

    console.log(`Found ${expiredProjects.length} expired projects`);

    for (const project of expiredProjects) {
      try {
        // Delete original file
        if (project.originalFilePath) {
          try {
            await fs.unlink(project.originalFilePath);
            console.log(`Deleted original file: ${project.originalFilePath}`);
          } catch (err) {
            console.error(`Failed to delete original file: ${err.message}`);
          }
        }

        // Delete result file
        if (project.resultFilePath) {
          try {
            await fs.unlink(project.resultFilePath);
            console.log(`Deleted result file: ${project.resultFilePath}`);
          } catch (err) {
            console.error(`Failed to delete result file: ${err.message}`);
          }
        }

        // Delete project from database
        await project.destroy();
        console.log(`Deleted project ${project.id} from database`);
      } catch (error) {
        console.error(`Error cleaning up project ${project.id}:`, error);
      }
    }

    console.log('Cleanup job completed');
  } catch (error) {
    console.error('Cleanup job error:', error);
  }
};

/**
 * Reset monthly upload counters (runs on 1st of each month)
 */
const resetMonthlyCounters = async () => {
  try {
    console.log('Resetting monthly upload counters...');
    
    const { User } = require('../models');
    await User.update(
      { uploadsThisMonth: 0 },
      { where: {} }
    );

    console.log('Monthly counters reset successfully');
  } catch (error) {
    console.error('Error resetting monthly counters:', error);
  }
};

/**
 * Initialize cron jobs
 */
const initializeCronJobs = () => {
  // Run cleanup every hour
  cron.schedule('0 * * * *', cleanupExpiredProjects);
  console.log('✓ Cleanup cron job scheduled (runs every hour)');

  // Reset monthly counters on 1st of each month at midnight
  cron.schedule('0 0 1 * *', resetMonthlyCounters);
  console.log('✓ Monthly reset cron job scheduled (runs on 1st of each month)');

  // Run cleanup immediately on startup
  cleanupExpiredProjects();
};

// If run directly
if (require.main === module) {
  require('dotenv').config();
  const { sequelize } = require('../config/database');
  
  sequelize.authenticate()
    .then(() => {
      console.log('Database connected');
      cleanupExpiredProjects()
        .then(() => process.exit(0))
        .catch((err) => {
          console.error(err);
          process.exit(1);
        });
    })
    .catch((err) => {
      console.error('Database connection failed:', err);
      process.exit(1);
    });
}

module.exports = {
  cleanupExpiredProjects,
  resetMonthlyCounters,
  initializeCronJobs
};
