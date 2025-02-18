// Module for managing applied jobs
export class AppliedManager {
  constructor(databaseManager, uiManager) {
    this.databaseManager = databaseManager;
    this.uiManager = uiManager;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for applied tab content updates
    document.addEventListener('appliedTabSelected', () => {
      this.refreshAppliedJobsList();
    });
  }

  async refreshAppliedJobsList() {
    const appliedJobs = await this.databaseManager.getAppliedJobs();
    this.updateAppliedJobsList(appliedJobs);
  }

  updateAppliedJobsList(appliedJobs) {
    const appliedContainer = document.getElementById('appliedJobsList');
    if (!appliedContainer) return;

    appliedContainer.innerHTML = '';

    if (appliedJobs.length === 0) {
      appliedContainer.innerHTML = '<p class="no-items-message">No applied jobs yet.</p>';
      return;
    }

    appliedJobs.forEach(job => {
      const jobElement = this.createAppliedJobElement(job);
      appliedContainer.appendChild(jobElement);
    });
  }

  createAppliedJobElement(job) {
    const jobElement = document.createElement('div');
    jobElement.className = 'applied-job-item';
    jobElement.dataset.jobId = job.id;

    const appliedDate = new Date(job.appliedDate).toLocaleDateString();
    
    jobElement.innerHTML = `
      <div class="job-header">
        <h3 class="job-title">${job.title || 'Untitled Position'}</h3>
        <span class="job-company">${job.company || 'Unknown Company'}</span>
      </div>
      <div class="job-meta">
        <span class="applied-date">Applied: ${appliedDate}</span>
        ${job.resumeId ? '<span class="has-resume" title="Resume attached">📄</span>' : ''}
        ${job.coverLetterId ? '<span class="has-cover" title="Cover Letter attached">✉️</span>' : ''}
      </div>
      <div class="job-actions">
        <button class="view-job" data-action="view">View Job Details</button>
        ${job.jobLink ? `<button class="open-job" data-action="open" data-job-link="${job.jobLink}">Open Job</button>` : ''}
        <button class="delete-job danger-button" data-action="delete" title="Delete this job">Delete</button>
      </div>
    `;

    // Add event listeners
    const viewButton = jobElement.querySelector('.view-job');
    viewButton.addEventListener('click', () => this.showJobDetailsModal(job));

    const openButton = jobElement.querySelector('.open-job');
    if (openButton) {
      openButton.addEventListener('click', () => {
        window.open(job.jobLink, '_blank');
      });
    }

    const deleteButton = jobElement.querySelector('.delete-job');
    deleteButton.addEventListener('click', () => this.confirmAndDeleteJob(job));

    return jobElement;
  }

  async showJobDetailsModal(job) {
    // Get resume and cover letter names if they exist
    let resumeName = '';
    let coverLetterName = '';

    if (job.resumeId) {
      const resumes = await this.databaseManager.getField('resumes') || [];
      const resume = resumes.find(r => r.id === job.resumeId);
      if (resume) {
        resumeName = resume.name;
      }
    }

    if (job.coverLetterId) {
      const coverLetters = await this.databaseManager.getField('coverLetters') || [];
      const coverLetter = coverLetters.find(c => c.id === job.coverLetterId);
      if (coverLetter) {
        coverLetterName = coverLetter.name;
      }
    }

    const modalHTML = `
      <div class="modal-content">
        <h2>${job.title || 'Untitled Position'}</h2>
        <div class="job-details-content">
          <div class="job-company-info">
            <strong>Company:</strong> ${job.company || 'Unknown Company'}
          </div>
          <div class="job-application-info">
            <strong>Applied:</strong> ${new Date(job.appliedDate).toLocaleDateString()}
            ${job.resumeId ? `<br><strong>Resume Used:</strong> ${resumeName}` : ''}
            ${job.coverLetterId ? `<br><strong>Cover Letter Used:</strong> ${coverLetterName}` : ''}
          </div>
          <div class="job-assessment">
            <strong>Job Fit Rating:</strong> ${job.rating}/10
          </div>
          ${job.rationale ? `
            <div class="job-rationale">
              <strong>Assessment:</strong>
              <p>${job.rationale}</p>
            </div>
          ` : ''}
          ${job.keywords?.length ? `
            <div class="job-keywords">
              <strong>Key Skills/Requirements:</strong>
              <div class="keyword-list">
                ${job.keywords.map(keyword => `<span class="keyword">${keyword}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          ${job.jobText ? `
            <div class="job-posting-text">
              <strong>Job Posting:</strong>
              <pre>${job.jobText}</pre>
            </div>
          ` : ''}
        </div>
        <div class="modal-actions">
          <button class="secondary-button" data-action="close">Close</button>
        </div>
      </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = modalHTML;

    // Add event listener for close button
    modal.querySelector('[data-action="close"]').addEventListener('click', () => {
      modal.remove();
    });

    document.body.appendChild(modal);
  }

  async markJobAsApplied(job, resumeId = null, coverLetterId = null) {
    try {
      const appliedJob = {
        ...job,
        resumeId,
        coverLetterId
      };

      await this.databaseManager.addAppliedJob(appliedJob);
      
      // Remove from saved jobs
      if (job.jobLink) {
        await this.databaseManager.removeSavedJob(job.jobLink);
      }

      this.uiManager.showFeedbackMessage('Job marked as applied successfully!');
      
      // Refresh both lists
      await this.refreshAppliedJobsList();
      if (typeof this.uiManager.updateSavedJobsList === 'function') {
        const savedJobs = await this.databaseManager.getField('savedJobs');
        this.uiManager.updateSavedJobsList(savedJobs);
      }
    } catch (error) {
      console.error('Error marking job as applied:', error);
      this.uiManager.showFeedbackMessage('Error marking job as applied', 'error');
    }
  }

  async showApplyModal(job) {
    const modalContent = await this.createApplyModalContent(job);
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Mark Job as Applied</h2>
        ${modalContent}
        <div class="modal-actions">
          <button class="secondary-button" data-action="cancel">Cancel</button>
          <button class="primary-button" data-action="apply">Mark as Applied</button>
        </div>
      </div>
    `;

    // Add event listeners
    const cancelButton = modal.querySelector('[data-action="cancel"]');
    const applyButton = modal.querySelector('[data-action="apply"]');

    cancelButton.addEventListener('click', () => {
      modal.remove();
    });

    applyButton.addEventListener('click', async () => {
      const resumeId = modal.querySelector('#resumeSelect').value;
      const coverLetterId = modal.querySelector('#coverLetterSelect').value;
      
      await this.markJobAsApplied(job, resumeId || null, coverLetterId || null);
      modal.remove();
    });

    document.body.appendChild(modal);
  }

  async createApplyModalContent(job) {
    const resumes = await this.databaseManager.getField('resumes') || [];
    const coverLetters = await this.databaseManager.getField('coverLetters') || [];

    return `
      <div class="modal-job-info">
        <h3>${job.title || 'Untitled Position'}</h3>
        <p>${job.company || 'Unknown Company'}</p>
      </div>
      <div class="modal-document-selectors">
        <div class="document-select-group">
          <label for="resumeSelect">Resume Used (Optional):</label>
          <select id="resumeSelect">
            <option value="">None</option>
            ${resumes.map(resume => `
              <option value="${resume.id}">${resume.name}</option>
            `).join('')}
          </select>
        </div>
        <div class="document-select-group">
          <label for="coverLetterSelect">Cover Letter Used (Optional):</label>
          <select id="coverLetterSelect">
            <option value="">None</option>
            ${coverLetters.map(letter => `
              <option value="${letter.id}">${letter.name}</option>
            `).join('')}
          </select>
        </div>
      </div>
    `;
  }

  async confirmAndDeleteJob(job) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Delete Applied Job</h2>
        <p>Are you sure you want to delete this job application record?</p>
        <div class="job-summary">
          <strong>${job.title || 'Untitled Position'}</strong>
          <span>${job.company || 'Unknown Company'}</span>
          <span>Applied: ${new Date(job.appliedDate).toLocaleDateString()}</span>
        </div>
        <div class="modal-actions">
          <button class="secondary-button" data-action="cancel">Cancel</button>
          <button class="danger-button" data-action="confirm">Delete</button>
        </div>
      </div>
    `;

    const cancelButton = modal.querySelector('[data-action="cancel"]');
    const confirmButton = modal.querySelector('[data-action="confirm"]');

    cancelButton.addEventListener('click', () => {
      modal.remove();
    });

    confirmButton.addEventListener('click', async () => {
      try {
        await this.databaseManager.removeAppliedJob(job.id);
        await this.refreshAppliedJobsList();
        this.uiManager.showFeedbackMessage('Job deleted successfully');
        modal.remove();
      } catch (error) {
        console.error('Error deleting job:', error);
        this.uiManager.showFeedbackMessage('Error deleting job', 'error');
      }
    });

    document.body.appendChild(modal);
  }
} 