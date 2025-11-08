const { sequelize } = require('../config/database');
const User = require('./User');
const Project = require('./Project');
const Payment = require('./Payment');

// Define associations
User.hasMany(Project, { foreignKey: 'userId', as: 'projects' });
Project.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force });
    console.log('✓ Database synchronized successfully');
  } catch (error) {
    console.error('✗ Database sync failed:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  User,
  Project,
  Payment,
  syncDatabase
};
