const Queue = require('bull');
const { Project } = require('../models');

// Create processing queue
const processingQueue = new Queue('background-removal', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD || undefined
  }
});

/**
 * Add job to processing queue
 */
const addJobToQueue = async (jobData) => {
  try {
    const priorityMap = {
      'high': 1,
      'medium': 2,
      'low': 3
    };

    const job = await processingQueue.add(jobData, {
      priority: priorityMap[jobData.priority] || 3,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: true,
      removeOnFail: false
    });

    console.log(`Job ${job.id} added to queue for project ${jobData.projectId}`);
    return job;
  } catch (error) {
    console.error('Error adding job to queue:', error);
    throw error;
  }
};

/**
 * Process jobs from queue
 */
processingQueue.process(async (job) => {
  const { projectId, type, filePath, maxResolution } = job.data;

  try {
    console.log(`Processing job ${job.id} for project ${projectId}`);

    // Update project status
    await Project.update(
      { status: 'processing', progress: 0 },
      { where: { id: projectId } }
    );

    // Update progress periodically
    const updateProgress = async (progress) => {
      await Project.update(
        { progress },
        { where: { id: projectId } }
      );
      job.progress(progress);
    };

    // Simulate processing (in production, call Python worker)
    // This is a placeholder - actual processing will be done by Python workers
    await updateProgress(10);
    
    // TODO: Call Python worker script here
    // const result = await processFile(filePath, type, maxResolution);
    
    await updateProgress(50);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
    await updateProgress(80);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await updateProgress(100);

    // For now, just mark as completed
    // In production, update with actual result file path
    await Project.update(
      { 
        status: 'completed',
        progress: 100,
        resultFilePath: filePath // Placeholder - should be actual processed file
      },
      { where: { id: projectId } }
    );

    console.log(`Job ${job.id} completed for project ${projectId}`);
    return { success: true, projectId };
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);

    await Project.update(
      { 
        status: 'failed',
        errorMessage: error.message
      },
      { where: { id: projectId } }
    );

    throw error;
  }
});

// Queue event listeners
processingQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

processingQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

processingQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} stalled`);
});

module.exports = {
  processingQueue,
  addJobToQueue
};
