// Job assessor module for handling job assessment functionality
import { AIHelper } from '../utils/aiHelper.js';

export class JobAssessor {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
  }

  async assessJob(jobText, apiKey) {
    if (!apiKey) {
      throw new Error('API Key is required');
    }

    const skills = await this.databaseManager.getField('skills');
    if (!skills || skills.length === 0) {
      throw new Error('Please enter your skills before assessing a job');
    }

    const assessment = await AIHelper.getJobAssessment(jobText, skills, apiKey);
    return assessment;
  }

  async saveJob(jobData) {
    const saveResult = await this.databaseManager.addSavedJob(jobData);

    if (saveResult.status === 'exists') {
      return {
        status: 'exists',
        message: 'This job is already saved. Would you like to update it with this new assessment?',
        existingJob: saveResult.existingJob
      };
    } else if (saveResult.status === 'limit') {
      return {
        status: 'limit',
        message: 'You have reached the maximum of 10 saved jobs. Would you like to replace the oldest saved job?',
        oldestJob: saveResult.oldestJob
      };
    }

    return { status: 'saved', message: 'Job saved successfully!' };
  }

  async updateSavedJob(jobLink, jobData) {
    const success = await this.databaseManager.updateSavedJob(jobLink, jobData);
    if (!success) {
      throw new Error('Failed to update saved job');
    }
    return { status: 'updated', message: 'Job assessment updated!' };
  }

  async removeSavedJob(jobLink) {
    const success = await this.databaseManager.removeSavedJob(jobLink);
    if (!success) {
      throw new Error('Failed to remove saved job');
    }
    return { status: 'removed', message: 'Job removed successfully!' };
  }

  async getSavedJobs() {
    return await this.databaseManager.getField('savedJobs') || [];
  }

  getSelectedText() {
    return window.getSelection().toString();
  }
} 