const { Project, User } = require('../models');
const { canUserUpload, getMaxResolution, getProcessingPriority } = require('../utils/planLimits');
const { addJobToQueue } = require('../utils/jobQueue');
const fs = require('fs').promises;
const path = require('path');
const { Op } = require('sequelize');

/**
 * Create new project (upload file)
 */
const createProject = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = req.user;

    // Check if user can upload
    const uploadCheck = canUserUpload(user);
    if (!uploadCheck.allowed) {
      // Delete uploaded file
      await fs.unlink(req.file.path);
      return res.status(403).json({ error: uploadCheck.message });
    }

    // Reset daily counter if needed
    if (uploadCheck.resetDaily) {
      await user.update({ uploadsToday: 0 });
    }

    // Determine project type
    const type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    // Set expiration time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.PROJECT_RETENTION_HOURS || 24));

    // Create project
    const project = await Project.create({
      userId: user.id,
      type,
      originalFileName: req.file.originalname,
      originalFilePath: req.file.path,
      status: 'pending',
      expiresAt,
      fileSize: req.file.size,
      metadata: {
        mimetype: req.file.mimetype,
        uploadedAt: new Date(),
        priority: getProcessingPriority(user.plan)
      }
    });

    // Update user upload counts
    const today = new Date().toISOString().split('T')[0];
    const lastUpload = user.lastUploadDate ? user.lastUploadDate.toISOString().split('T')[0] : null;

    if (lastUpload !== today) {
      await user.update({
        uploadsToday: 1,
        uploadsThisMonth: user.uploadsThisMonth + 1,
        lastUploadDate: new Date()
      });
    } else {
      await user.update({
        uploadsToday: user.uploadsToday + 1,
        uploadsThisMonth: user.uploadsThisMonth + 1,
        lastUploadDate: new Date()
      });
    }

    // Add job to processing queue
    await addJobToQueue({
      projectId: project.id,
      type,
      filePath: req.file.path,
      priority: getProcessingPriority(user.plan),
      maxResolution: getMaxResolution(user.plan)
    });

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Create project error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete file:', unlinkError);
      }
    }
    
    res.status(500).json({ error: 'Failed to create project' });
  }
};

/**
 * Get all projects for current user
 */
const getProjects = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const where = { userId: req.user.id };
    
    if (status) where.status = status;
    if (type) where.type = type;

    const { count, rows: projects } = await Project.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      projects,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

/**
 * Get single project by ID
 */
const getProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

/**
 * Get project status
 */
const getProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      where: {
        id,
        userId: req.user.id
      },
      attributes: ['id', 'status', 'progress', 'errorMessage', 'createdAt', 'expiresAt']
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ 
      status: project.status,
      progress: project.progress,
      errorMessage: project.errorMessage,
      createdAt: project.createdAt,
      expiresAt: project.expiresAt,
      timeRemaining: Math.max(0, new Date(project.expiresAt) - new Date())
    });
  } catch (error) {
    console.error('Get project status error:', error);
    res.status(500).json({ error: 'Failed to fetch project status' });
  }
};

/**
 * Download project result
 */
const downloadProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.status !== 'completed') {
      return res.status(400).json({ error: 'Project is not completed yet' });
    }

    if (!project.resultFilePath) {
      return res.status(404).json({ error: 'Result file not found' });
    }

    // Check if file exists
    try {
      await fs.access(project.resultFilePath);
    } catch {
      return res.status(404).json({ error: 'Result file not found on server' });
    }

    const fileName = `cleancut_${project.type}_${Date.now()}${path.extname(project.resultFilePath)}`;
    res.download(project.resultFilePath, fileName);
  } catch (error) {
    console.error('Download project error:', error);
    res.status(500).json({ error: 'Failed to download project' });
  }
};

/**
 * Cancel project processing
 */
const cancelProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!['pending', 'processing'].includes(project.status)) {
      return res.status(400).json({ error: 'Cannot cancel project in current status' });
    }

    await project.update({ status: 'cancelled' });

    // TODO: Cancel job in queue

    res.json({ message: 'Project cancelled successfully' });
  } catch (error) {
    console.error('Cancel project error:', error);
    res.status(500).json({ error: 'Failed to cancel project' });
  }
};

/**
 * Delete project
 */
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete files
    try {
      if (project.originalFilePath) {
        await fs.unlink(project.originalFilePath);
      }
      if (project.resultFilePath) {
        await fs.unlink(project.resultFilePath);
      }
    } catch (fileError) {
      console.error('Error deleting files:', fileError);
    }

    await project.destroy();

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

/**
 * Get dashboard statistics
 */
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const totalProjects = await Project.count({ where: { userId } });
    const completedProjects = await Project.count({ where: { userId, status: 'completed' } });
    const processingProjects = await Project.count({ where: { userId, status: 'processing' } });
    const failedProjects = await Project.count({ where: { userId, status: 'failed' } });

    const recentProjects = await Project.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    res.json({
      stats: {
        total: totalProjects,
        completed: completedProjects,
        processing: processingProjects,
        failed: failedProjects
      },
      recentProjects,
      user: {
        plan: req.user.plan,
        uploadsToday: req.user.uploadsToday,
        uploadsThisMonth: req.user.uploadsThisMonth,
        planEndDate: req.user.planEndDate
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProject,
  getProjectStatus,
  downloadProject,
  cancelProject,
  deleteProject,
  getDashboardStats
};
