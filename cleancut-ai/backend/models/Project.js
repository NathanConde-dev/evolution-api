const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('video', 'image'),
    allowNull: false
  },
  originalFileName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalFilePath: {
    type: DataTypes.STRING,
    allowNull: false
  },
  resultFilePath: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled'),
    defaultValue: 'pending'
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  resolution: {
    type: DataTypes.STRING,
    allowNull: true
  },
  duration: {
    type: DataTypes.FLOAT,
    allowNull: true
  }
}, {
  tableName: 'projects',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['expiresAt']
    }
  ]
});

module.exports = Project;
