// UI manager module for handling UI-related functionality
import { KeywordMatcher } from '../utils/keywordMatcher.js';

export class UIManager {
  constructor() {
    this.activeTab = 'assess';
    this.setupTabHandlers();
    this.currentMatchType = 'resume';
    this.setupMatchTypeHandlers();
    this.updateCurrentResumeDisplay(); // Add initial resume display update
    this.updateCurrentJobDisplay(); // Add initial job display update
  }

  setupTabHandlers() {
    console.log('UIManager.setupTabHandlers called'); // Added log
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => {
        console.log('Tab button clicked:', button.dataset.tab); // Added log
        this.switchTab(button.dataset.tab);
      });
    });
  }

  setupMatchTypeHandlers() {
    document.querySelectorAll('input[name="matchType"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.currentMatchType = e.target.value;
        this.updateKeywordMatches();
      });
    });
  }

  switchTab(tabId) {
    console.log('UIManager.switchTab called for tab:', tabId); // Added log
    // Remove active class from all tabs
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    console.log('tabButtons found:', tabButtons.length); // Added log
    console.log('tabContents found:', tabContents.length); // Added log

    tabButtons.forEach(b => {
      b.classList.remove('active');
      console.log('Removed active class from tab button:', b.dataset.tab); // Added log
    });
    tabContents.forEach(c => {
      c.classList.remove('active');
      console.log('Removed active class from tab content:', c.id); // Added log
    });
    
    // Add active class to clicked tab
    const button = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    const tabContent = document.getElementById(tabId);

    console.log('Active button element:', button); // Added log
    console.log('Active tabContent element:', tabContent); // Added log
    
    if (button && tabContent) {
      button.classList.add('active');
      tabContent.classList.add('active');
      this.activeTab = tabId;
      console.log('Added active class to tab button:', tabId); // Added log
      console.log('Added active class to tab content:', tabId); // Added log
    }
  }

  showFeedbackMessage(message, type = 'success') {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = `feedback-message ${type}`;
    feedbackDiv.textContent = message;
    document.body.appendChild(feedbackDiv);
    
    setTimeout(() => {
      feedbackDiv.remove();
    }, 2000);
  }

  showLoadingState(element, loadingText = 'Processing...') {
    if (!element) return () => {}; // Safe guard against null elements
    
    const originalContent = element.innerHTML;
    const originalDisabled = element.disabled;
    element.disabled = true;
    
    if (element.classList.contains('primary-button')) {
      const spinner = document.createElement('span');
      spinner.className = 'loading-spinner';
      element.innerHTML = loadingText;
      element.appendChild(spinner);
    } else {
      element.textContent = loadingText;
    }

    return () => {
      if (element) { // Check if element still exists
        element.disabled = originalDisabled;
        element.innerHTML = originalContent;
      }
    };
  }

  showConfirmDialog(message) {
    return confirm(message);
  }

  showModal(title, content, actions) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>${title}</h2>
        ${content}
        <div class="modal-actions">
          ${actions}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  async updateKeywordMatches() {
    try {
      const resumeText = await DatabaseManager.getField('resumeText');
      const skills = await DatabaseManager.getField('skills');
      const keywords = this.getAllKeywords();

      let matches;
      switch (this.currentMatchType) {
        case 'resume':
          matches = KeywordMatcher.findResumeMatches(keywords, resumeText);
          break;
        case 'skills':
          matches = KeywordMatcher.findSkillMatches(keywords, skills);
          break;
        case 'both':
          matches = KeywordMatcher.findCombinedMatches(keywords, resumeText, skills);
          break;
      }

      this.updateKeywordClasses(matches);
    } catch (error) {
      console.error('Error updating keyword matches:', error);
    }
  }

  getAllKeywords() {
    const keywords = new Set();
    
    // Get keywords from assessment results
    const keywordList = document.getElementById('keywordList');
    if (keywordList) {
      keywordList.querySelectorAll('li').forEach(li => keywords.add(li.textContent));
    }

    // Get keywords from saved jobs
    const savedJobsList = document.getElementById('savedJobsList');
    if (savedJobsList) {
      savedJobsList.querySelectorAll('.keyword').forEach(span => keywords.add(span.textContent));
    }

    return Array.from(keywords);
  }

  updateKeywordClasses(matches) {
    // Update assessment results keywords
    const keywordList = document.getElementById('keywordList');
    if (keywordList) {
      keywordList.querySelectorAll('li').forEach(li => {
        const keyword = li.textContent;
        const matchType = matches.get(keyword) || 'no-match';
        li.className = matchType;
      });
    }

    // Update saved jobs keywords
    const savedJobsList = document.getElementById('savedJobsList');
    if (savedJobsList) {
      savedJobsList.querySelectorAll('.keyword').forEach(span => {
        const keyword = span.textContent;
        const matchType = matches.get(keyword) || 'no-match';
        span.className = `keyword ${matchType}`;
      });
    }
  }

  updateAssessmentResults(assessment) {
    try {
      const resultsDiv = document.getElementById('assessmentResults');
      const ratingSpan = document.getElementById('ratingValue');
      const keywordList = document.getElementById('keywordList');
      
      if (!resultsDiv || !ratingSpan || !keywordList) {
        console.error('Required assessment elements not found');
        throw new Error('Assessment UI elements not found');
      }

      // Update rating
      ratingSpan.textContent = assessment.rating;
      
      // Remove existing rationale if it exists
      const existingRationale = resultsDiv.querySelector('.assessment-rationale');
      if (existingRationale) {
        existingRationale.remove();
      }
      
      // Update rationale
      const rationaleDiv = document.createElement('div');
      rationaleDiv.className = 'assessment-rationale';
      rationaleDiv.textContent = assessment.rationale;
      
      const jobKeywords = document.getElementById('jobKeywords');
      if (jobKeywords) {
        resultsDiv.insertBefore(rationaleDiv, jobKeywords);
      } else {
        resultsDiv.appendChild(rationaleDiv);
      }
      
      // Update keywords
      keywordList.innerHTML = assessment.keywords.map(keyword => 
        `<li>${keyword}</li>`
      ).join('');
      
      // Show results
      resultsDiv.style.display = 'block';
      
      // Create or update save button if it doesn't exist
      let saveButton = document.getElementById('saveJobButton');
      if (!saveButton) {
        saveButton = document.createElement('button');
        saveButton.id = 'saveJobButton';
        saveButton.className = 'primary-button';
        saveButton.textContent = 'Save Job';
        resultsDiv.appendChild(saveButton);
      }
      saveButton.style.display = 'block';

      // Update keyword matches
      this.updateKeywordMatches();
      
    } catch (error) {
      console.error('Error updating assessment results:', error);
      this.showError('Failed to display assessment results. Please try again.');
    }
  }

  showError(message) {
    const errorDiv = document.getElementById('assessmentError');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message;
    errorDiv.style.display = 'block';
  }

  hideError() {
    const errorDiv = document.getElementById('assessmentError');
    errorDiv.style.display = 'none';
  }

  updateSkillsList(skills) {
    const skillsList = document.getElementById('skillsList');
    skillsList.innerHTML = skills.map(skill => `
      <div class="skill-item">
        <div class="skill-info">
          <span class="skill-name">${skill.skill}</span>
          <span class="skill-details">
            ${skill.level}${skill.yearsExperience ? ` • ${skill.yearsExperience} years` : ''}
          </span>
        </div>
        <button class="remove-skill" data-skill="${skill.skill}">Remove</button>
      </div>
    `).join('');
  }

  updateEducationList(education) {
    const educationList = document.getElementById('educationList');
    educationList.innerHTML = education.map((item, index) => `
      <div class="education-item">
        <div class="education-item-header">
          <div>
            <h3 class="education-item-title">${item.title}</h3>
            <div class="education-item-institution">${item.institution}</div>
            <div class="education-item-dates">
              ${new Date(item.startDate).toLocaleDateString()} - 
              ${item.inProgress ? 'Present' : item.endDate ? new Date(item.endDate).toLocaleDateString() : 'N/A'}
            </div>
          </div>
          <button class="remove-button" data-index="${index}">Remove</button>
        </div>
        ${item.description ? `<div class="education-item-description">${item.description}</div>` : ''}
        <div class="education-item-meta">
          ${item.gpa ? `<span>GPA: ${item.gpa}</span>` : ''}
          ${item.url ? `<a href="${item.url}" target="_blank">View Certificate</a>` : ''}
          ${item.expiryDate ? `<span>Expires: ${new Date(item.expiryDate).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  updateLimitationsList(limitations, filterCategory = 'all') {
    const filteredLimitations = filterCategory === 'all' 
      ? limitations 
      : limitations.filter(l => l.category === filterCategory);

    const limitationsList = document.getElementById('limitationsList');
    limitationsList.innerHTML = filteredLimitations.map((item, index) => `
      <div class="limitation-item">
        <div class="limitation-item-header">
          <div>
            <span class="limitation-category ${item.category}">${item.category.charAt(0).toUpperCase() + item.category.slice(1)}</span>
            <span class="limitation-text">${item.limitation}</span>
          </div>
          <button class="remove-button" data-index="${index}">Remove</button>
        </div>
        ${item.details ? `<div class="limitation-details">${item.details}</div>` : ''}
        <div class="limitation-meta">
          <span>Added: ${new Date(item.dateAdded).toLocaleDateString()}</span>
          ${item.isTemporary ? `
            <span class="temporary-badge">
              Temporary${item.endDate ? ` (Until ${new Date(item.endDate).toLocaleDateString()})` : ''}
            </span>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  async updateCurrentJobDisplay() {
    try {
      const currentJobId = await DatabaseManager.getField('activeJobId');
      const savedJobs = await DatabaseManager.getField('savedJobs') || [];
      const currentJob = savedJobs.find(j => j.id === currentJobId);
      
      const currentJobNameElement = document.getElementById('currentJobName');
      if (currentJobNameElement) {
        if (!currentJobId || !currentJob) {
          currentJobNameElement.textContent = 'None selected';
        } else {
          currentJobNameElement.textContent = `${currentJob.title}${currentJob.company ? ` - ${currentJob.company}` : ''}`;
        }
      }
    } catch (error) {
      console.error('Error updating current job display:', error);
      const currentJobNameElement = document.getElementById('currentJobName');
      if (currentJobNameElement) {
        currentJobNameElement.textContent = 'None selected';
      }
    }
  }

  async updateSavedJobsList(savedJobs = []) {
    try {
      const savedJobsList = document.getElementById('savedJobsList');
      if (!savedJobsList) {
        console.error('Saved jobs list element not found');
        return;
      }

      // Ensure savedJobs is an array
      const jobs = Array.isArray(savedJobs) ? savedJobs : [];
      
      if (jobs.length === 0) {
        savedJobsList.innerHTML = '<p class="no-jobs">No saved jobs yet. Use the "Save Job" button after assessment to save jobs.</p>';
        return;
      }

      // Get current active job ID
      const activeJobId = await DatabaseManager.getField('activeJobId');
      
      savedJobsList.innerHTML = jobs.map(job => {
        // Ensure all required properties exist with default values
        const {
          id = '',
          title = 'Untitled Job',
          company = '',
          rating = 0,
          rationale = '',
          keywords = [],
          jobLink = '#',
          dateSaved = new Date().toISOString()
        } = job;

        const isActive = id === activeJobId;

        return `
          <div class="saved-job${isActive ? ' active' : ''}" data-job-id="${id}">
            <h3>${title}${company ? ` - ${company}` : ''}</h3>
            <div class="job-details">
              <span class="rating">Rating: ${rating}/10</span>
              <span class="date">Saved: ${new Date(dateSaved).toLocaleString()}</span>
            </div>
            <div class="assessment-rationale">
              ${rationale}
            </div>
            <div class="job-keywords">
              ${Array.isArray(keywords) ? keywords.map(keyword => 
                `<span class="keyword">${keyword}</span>`
              ).join('') : ''}
            </div>
            <div class="job-actions">
              <button class="open-job" data-job-link="${jobLink}">Open Job</button>
              <button class="select-job${isActive ? ' active' : ''}" data-job-id="${id}">
                ${isActive ? 'Selected' : 'Select'}
              </button>
              <button class="delete-job" data-job-id="${id}">Delete</button>
            </div>
          </div>
        `;
      }).join('');

      // Add event listeners for job actions
      savedJobsList.querySelectorAll('.select-job').forEach(button => {
        button.addEventListener('click', async () => {
          const jobId = button.dataset.jobId;
          const currentActiveId = await DatabaseManager.getField('activeJobId');
          
          console.log('Job selection clicked:', { jobId, currentActiveId });
          
          // If clicking the already active job, deselect it
          if (currentActiveId === jobId) {
            console.log('Deselecting current job');
            await DatabaseManager.updateField('activeJobId', null);
          } else {
            console.log('Selecting new job:', jobId);
            await DatabaseManager.updateField('activeJobId', jobId);
          }
          
          // Get fresh jobs data from database
          const updatedJobs = await DatabaseManager.getField('savedJobs') || [];
          console.log('Updated jobs data:', updatedJobs);
          
          await this.updateCurrentJobDisplay();
          this.updateSavedJobsList(updatedJobs); // Pass the fresh jobs data
        });
      });

      savedJobsList.querySelectorAll('.open-job').forEach(button => {
        button.addEventListener('click', () => {
          const jobLink = button.dataset.jobLink;
          if (jobLink && jobLink !== '#') {
            window.open(jobLink, '_blank');
          }
        });
      });

      // Update keyword matches
      this.updateKeywordMatches();
    } catch (error) {
      console.error('Error updating saved jobs list:', error);
      savedJobsList.innerHTML = '<p class="error">Error loading saved jobs</p>';
    }
  }

  clearInputs(inputIds) {
    inputIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = false;
        } else {
          element.value = '';
        }
      }
    });
  }

  async updateCurrentResumeDisplay() {
    try {
      const currentResumeId = await DatabaseManager.getField('activeResumeId');
      const resumes = await DatabaseManager.getField('resumes') || [];
      const currentResume = resumes.find(r => r.id === currentResumeId);
      
      const currentResumeNameElement = document.getElementById('currentResumeName');
      if (currentResumeNameElement) {
        currentResumeNameElement.textContent = currentResume ? currentResume.name : 'None selected';
      }
    } catch (error) {
      console.error('Error updating current resume display:', error);
    }
  }

  async updateSavedDocuments() {
    try {
      const [resumeText, coverLetterText] = await Promise.all([
        DatabaseManager.getField('resumeText'),
        DatabaseManager.getField('coverLetterText')
      ]);

      const extractSkillsButton = document.getElementById('extractSkillsButton');
      const clearResumeButton = document.getElementById('clearResumeButton');
      const clearCoverLetterButton = document.getElementById('clearCoverLetterButton');
      const resumeContent = document.getElementById('resumeContent');
      const coverLetterContent = document.getElementById('coverLetterContent');

      if (resumeText && resumeContent) {
        resumeContent.textContent = resumeText;
        if (extractSkillsButton) extractSkillsButton.style.display = 'block';
        if (clearResumeButton) clearResumeButton.style.display = 'block';
      }

      if (coverLetterText && coverLetterContent) {
        coverLetterContent.textContent = coverLetterText;
        if (clearCoverLetterButton) clearCoverLetterButton.style.display = 'block';
      }

      // Update the current resume display in header
      await this.updateCurrentResumeDisplay();
    } catch (error) {
      console.error('Error updating saved documents:', error);
    }
  }
}
