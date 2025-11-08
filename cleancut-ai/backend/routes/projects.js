const express = require('express');
const router = express.Router();
const projectsController = require('../controllers/projectsController');
const { authMiddleware } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

// All routes require authentication
router.use(authMiddleware);

// Dashboard stats
router.get('/dashboard', projectsController.getDashboardStats);

// Project CRUD
router.post('/', upload.single('file'), handleUploadError, projectsController.createProject);
router.get('/', projectsController.getProjects);
router.get('/:id', projectsController.getProject);
router.get('/:id/status', projectsController.getProjectStatus);
router.get('/:id/download', projectsController.downloadProject);
router.post('/:id/cancel', projectsController.cancelProject);
router.delete('/:id', projectsController.deleteProject);

module.exports = router;
