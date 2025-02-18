// UI manager module for handling UI-related functionality
import { KeywordMatcher } from '../utils/keywordMatcher.js';

export class UIManager {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
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

      // Refresh data when switching to specific tabs
      if (tabId === 'skills') {
        this.refreshSkillsList();
      }
    }
  }

  // Add new method to refresh skills list
  async refreshSkillsList() {
    try {
      const skills = await this.databaseManager.getField('skills') || [];
      this.updateSkillsList(skills);
    } catch (error) {
      console.error('Error refreshing skills list:', error);
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
      console.log('updateKeywordMatches called');
      const resumeText = await this.databaseManager.getField('resumeText');
      console.log('Retrieved resume text length:', resumeText?.length || 0);
      
      const skills = await this.databaseManager.getField('skills');
      console.log('Retrieved skills:', skills?.length || 0);
      
      const keywords = this.getAllKeywords();
      console.log('Retrieved keywords:', keywords);

      let matches;
      switch (this.currentMatchType) {
        case 'resume':
          console.log('Using resume matching');
          matches = KeywordMatcher.findResumeMatches(keywords, resumeText);
          break;
        case 'skills':
          console.log('Using skills matching');
          matches = KeywordMatcher.findSkillMatches(keywords, skills);
          break;
        case 'both':
          console.log('Using combined matching');
          matches = KeywordMatcher.findCombinedMatches(keywords, resumeText, skills);
          break;
      }

      console.log('Matches before UI update:', Object.fromEntries(matches));
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
    console.log('updateKeywordClasses called with matches:', Object.fromEntries(matches));
    
    // Update assessment results keywords
    const keywordList = document.getElementById('keywordList');
    if (keywordList) {
      keywordList.querySelectorAll('li').forEach(li => {
        const keyword = li.textContent;
        const matchType = matches.get(keyword) || 'no-match';
        console.log(`Updating keyword "${keyword}" with class "${matchType}"`);
        li.className = matchType;
      });
    }

    // Update saved jobs keywords
    const savedJobsList = document.getElementById('savedJobsList');
    if (savedJobsList) {
      savedJobsList.querySelectorAll('.keyword').forEach(span => {
        const keyword = span.textContent;
        const matchType = matches.get(keyword) || 'no-match';
        console.log(`Updating saved job keyword "${keyword}" with class "${matchType}"`);
        span.className = `keyword ${matchType}`;
      });
    }
  }

  async updateAssessmentResults(assessment) {
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
      
      // Get current skills to check against
      const currentSkills = await this.databaseManager.getField('skills') || [];
      const currentSkillNames = new Set(currentSkills.map(s => s.skill.toLowerCase()));
      
      // Update keywords with add button for missing skills
      keywordList.innerHTML = assessment.keywords.map(keyword => {
        const isInSkills = currentSkillNames.has(keyword.toLowerCase());
        return `
          <li>
            ${keyword}
            ${!isInSkills ? `
              <button class="add-skill-button" title="Add to my skills" data-skill="${keyword}">
                <svg viewBox="0 0 24 24">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </button>
            ` : `
              <button class="add-skill-button added" title="Already in skills" disabled>
                <svg viewBox="0 0 24 24">
                  <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                </svg>
              </button>
            `}
          </li>
        `;
      }).join('');
      
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

      // Add event listeners for add skill buttons
      this.setupAddSkillButtons(keywordList);
      
      // Update keyword matches
      this.updateKeywordMatches();

      // Update the current job display with the assessed job
      this.updateCurrentJobDisplay();
      
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
    skillsList.innerHTML = skills.map((skill, index) => `
      <div class="skill-item" data-index="${index}">
        <div class="skill-info">
          <div class="skill-content">
            <span class="skill-name">${skill.skill}</span>
            <span class="skill-details">
              ${skill.level}${skill.yearsExperience ? ` • ${skill.yearsExperience} years` : ''}
            </span>
          </div>
          <div class="skill-edit-form" style="display: none;">
            <input type="text" class="edit-skill-name" value="${skill.skill}">
            <select class="edit-skill-level">
              <option value="Beginner" ${skill.level === 'Beginner' ? 'selected' : ''}>Beginner</option>
              <option value="Intermediate" ${skill.level === 'Intermediate' ? 'selected' : ''}>Intermediate</option>
              <option value="Expert" ${skill.level === 'Expert' ? 'selected' : ''}>Expert</option>
            </select>
            <input type="number" class="edit-skill-years" value="${skill.yearsExperience || ''}" placeholder="Years" min="0" max="50">
            <div class="edit-actions">
              <button class="save-edit">Save</button>
              <button class="cancel-edit">Cancel</button>
            </div>
          </div>
        </div>
        <div class="skill-actions">
          <button class="edit-skill">Edit</button>
          <button class="remove-skill" data-skill="${skill.skill}">Remove</button>
        </div>
      </div>
    `).join('');

    // Add event listeners for edit buttons
    skillsList.querySelectorAll('.edit-skill').forEach(button => {
      button.addEventListener('click', (e) => {
        const skillItem = e.target.closest('.skill-item');
        const content = skillItem.querySelector('.skill-content');
        const editForm = skillItem.querySelector('.skill-edit-form');
        content.style.display = 'none';
        editForm.style.display = 'block';
      });
    });

    // Add event listeners for cancel buttons
    skillsList.querySelectorAll('.cancel-edit').forEach(button => {
      button.addEventListener('click', (e) => {
        const skillItem = e.target.closest('.skill-item');
        const content = skillItem.querySelector('.skill-content');
        const editForm = skillItem.querySelector('.skill-edit-form');
        content.style.display = 'block';
        editForm.style.display = 'none';
      });
    });

    // Add event listeners for save buttons
    skillsList.querySelectorAll('.save-edit').forEach(button => {
      button.addEventListener('click', async (e) => {
        const skillItem = e.target.closest('.skill-item');
        const index = parseInt(skillItem.dataset.index);
        const newName = skillItem.querySelector('.edit-skill-name').value.trim();
        const newLevel = skillItem.querySelector('.edit-skill-level').value;
        const newYears = skillItem.querySelector('.edit-skill-years').value;

        if (!newName) {
          this.showFeedbackMessage('Skill name cannot be empty', 'error');
          return;
        }

        try {
          const currentSkills = await this.databaseManager.getField('skills') || [];
          currentSkills[index] = {
            skill: newName,
            level: newLevel,
            yearsExperience: newYears ? parseInt(newYears) : null
          };

          await this.databaseManager.updateField('skills', currentSkills);
          this.updateSkillsList(currentSkills);
          this.showFeedbackMessage('Skill updated successfully!');
        } catch (error) {
          this.showFeedbackMessage('Failed to update skill', 'error');
        }
      });
    });
  }

  updateEducationList(education) {
    const educationList = document.getElementById('educationList');
    educationList.innerHTML = education.map((item, index) => `
      <div class="education-item" data-index="${index}">
        <div class="education-content">
          <div class="education-item-header">
            <div>
              <h3 class="education-item-title">${item.title}</h3>
              <div class="education-item-institution">${item.institution}</div>
              <div class="education-item-dates">
                ${new Date(item.startDate).toLocaleDateString()} - 
                ${item.inProgress ? 'Present' : item.endDate ? new Date(item.endDate).toLocaleDateString() : 'N/A'}
              </div>
            </div>
            <div class="education-actions">
              <button class="edit-education">Edit</button>
              <button class="remove-button" data-index="${index}">Remove</button>
            </div>
          </div>
          ${item.description ? `<div class="education-item-description">${item.description}</div>` : ''}
          <div class="education-item-meta">
            ${item.gpa ? `<span>GPA: ${item.gpa}</span>` : ''}
            ${item.url ? `<a href="${item.url}" target="_blank">View Certificate</a>` : ''}
            ${item.expiryDate ? `<span>Expires: ${new Date(item.expiryDate).toLocaleDateString()}</span>` : ''}
          </div>
        </div>

        <div class="education-edit-form" style="display: none;">
          <select class="edit-education-type">
            <option value="degree" ${item.type === 'degree' ? 'selected' : ''}>Degree</option>
            <option value="certification" ${item.type === 'certification' ? 'selected' : ''}>Certification</option>
            <option value="course" ${item.type === 'course' ? 'selected' : ''}>Course</option>
          </select>
          <input type="text" class="edit-education-title" value="${item.title}" placeholder="Title/Degree Name">
          <input type="text" class="edit-education-institution" value="${item.institution}" placeholder="Institution">
          <div class="date-group">
            <div class="date-input">
              <label>Start Date:</label>
              <input type="date" class="edit-education-start-date" value="${item.startDate}">
            </div>
            <div class="date-input">
              <label>End Date:</label>
              <input type="date" class="edit-education-end-date" value="${item.endDate || ''}" ${item.inProgress ? 'disabled' : ''}>
            </div>
          </div>
          <label class="checkbox-label">
            <input type="checkbox" class="edit-education-in-progress" ${item.inProgress ? 'checked' : ''}>
            Currently In Progress
          </label>
          <div class="optional-fields">
            <input type="text" class="edit-education-gpa" value="${item.gpa || ''}" placeholder="GPA (optional)">
            <input type="url" class="edit-education-url" value="${item.url || ''}" placeholder="Certificate URL (optional)">
            <input type="date" class="edit-education-expiry" value="${item.expiryDate || ''}" placeholder="Expiry Date (optional)">
            <textarea class="edit-education-description" placeholder="Description or relevant coursework (optional)">${item.description || ''}</textarea>
          </div>
          <div class="edit-actions">
            <button class="save-education-edit">Save</button>
            <button class="cancel-education-edit">Cancel</button>
          </div>
        </div>
      </div>
    `).join('');

    // Add event listeners for edit buttons
    educationList.querySelectorAll('.edit-education').forEach(button => {
      button.addEventListener('click', (e) => {
        const educationItem = e.target.closest('.education-item');
        const content = educationItem.querySelector('.education-content');
        const editForm = educationItem.querySelector('.education-edit-form');
        content.style.display = 'none';
        editForm.style.display = 'block';
      });
    });

    // Add event listeners for cancel buttons
    educationList.querySelectorAll('.cancel-education-edit').forEach(button => {
      button.addEventListener('click', (e) => {
        const educationItem = e.target.closest('.education-item');
        const content = educationItem.querySelector('.education-content');
        const editForm = educationItem.querySelector('.education-edit-form');
        content.style.display = 'block';
        editForm.style.display = 'none';
      });
    });

    // Add event listeners for in-progress checkboxes
    educationList.querySelectorAll('.edit-education-in-progress').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const endDateInput = e.target.closest('.education-edit-form').querySelector('.edit-education-end-date');
        endDateInput.disabled = e.target.checked;
        if (e.target.checked) {
          endDateInput.value = '';
        }
      });
    });

    // Add event listeners for save buttons
    educationList.querySelectorAll('.save-education-edit').forEach(button => {
      button.addEventListener('click', async (e) => {
        const educationItem = e.target.closest('.education-item');
        const index = parseInt(educationItem.dataset.index);
        const form = educationItem.querySelector('.education-edit-form');

        const newEducation = {
          type: form.querySelector('.edit-education-type').value,
          title: form.querySelector('.edit-education-title').value.trim(),
          institution: form.querySelector('.edit-education-institution').value.trim(),
          startDate: form.querySelector('.edit-education-start-date').value,
          inProgress: form.querySelector('.edit-education-in-progress').checked,
          endDate: form.querySelector('.edit-education-in-progress').checked ? null : form.querySelector('.edit-education-end-date').value,
          description: form.querySelector('.edit-education-description').value.trim(),
          gpa: form.querySelector('.edit-education-gpa').value.trim(),
          url: form.querySelector('.edit-education-url').value.trim(),
          expiryDate: form.querySelector('.edit-education-expiry').value
        };

        if (!newEducation.title || !newEducation.institution || !newEducation.startDate) {
          this.showFeedbackMessage('Title, institution, and start date are required', 'error');
          return;
        }

        try {
          const currentEducation = await this.databaseManager.getField('education') || [];
          currentEducation[index] = newEducation;
          await this.databaseManager.updateField('education', currentEducation);
          this.updateEducationList(currentEducation);
          this.showFeedbackMessage('Education updated successfully!');
        } catch (error) {
          this.showFeedbackMessage('Failed to update education', 'error');
        }
      });
    });
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
      const currentJobId = await this.databaseManager.getField('activeJobId');
      const savedJobs = await this.databaseManager.getField('savedJobs') || [];
      const currentAssessment = window.currentAssessment;
      
      console.log('Updating current job display:', { currentJobId, currentAssessment });
      
      const currentJobNameElement = document.getElementById('currentJobName');
      if (currentJobNameElement) {
        if (currentAssessment) {
          // Show assessed job
          const jobTitle = `${currentAssessment.title}${currentAssessment.company ? ` - ${currentAssessment.company}` : ''}`;
          currentJobNameElement.textContent = jobTitle;
        } else if (currentJobId && savedJobs.length > 0) {
          // Show selected job
          const currentJob = savedJobs.find(j => j.id === currentJobId);
          if (currentJob) {
            const jobTitle = `${currentJob.title}${currentJob.company ? ` - ${currentJob.company}` : ''}`;
            currentJobNameElement.textContent = jobTitle;
          } else {
            currentJobNameElement.textContent = 'No job selected';
          }
        } else {
          currentJobNameElement.textContent = 'No job selected';
        }
      }
    } catch (error) {
      console.error('Error updating current job display:', error);
      const currentJobNameElement = document.getElementById('currentJobName');
      if (currentJobNameElement) {
        currentJobNameElement.textContent = 'No job selected';
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

      // Get current skills to check against
      const currentSkills = await this.databaseManager.getField('skills') || [];
      const currentSkillNames = new Set(currentSkills.map(s => s.skill.toLowerCase()));

      // Get current active job ID
      const activeJobId = await this.databaseManager.getField('activeJobId');
      
      savedJobsList.innerHTML = jobs.map(job => {
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

        const keywordsHtml = keywords.map(keyword => {
          const isInSkills = currentSkillNames.has(keyword.toLowerCase());
          return `
            <span class="keyword">
              ${keyword}
              ${!isInSkills ? `
                <button class="add-skill-button" title="Add to my skills" data-skill="${keyword}">
                  <svg viewBox="0 0 24 24">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                </button>
              ` : `
                <button class="add-skill-button added" title="Already in skills" disabled>
                  <svg viewBox="0 0 24 24">
                    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                  </svg>
                </button>
              `}
            </span>
          `;
        }).join('');

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
              ${keywordsHtml}
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

      // Add event listeners
      this.setupSavedJobsEventListeners(savedJobsList);
      this.setupAddSkillButtons(savedJobsList);

      // Update keyword matches
      this.updateKeywordMatches();
    } catch (error) {
      console.error('Error updating saved jobs list:', error);
      savedJobsList.innerHTML = '<p class="error">Error loading saved jobs</p>';
    }
  }

  setupSavedJobsEventListeners(container) {
    container.querySelectorAll('.select-job').forEach(button => {
      button.addEventListener('click', async () => {
        const jobId = button.dataset.jobId;
        const currentActiveId = await this.databaseManager.getField('activeJobId');
        
        console.log('Job selection clicked:', { jobId, currentActiveId });
        
        // If clicking the already active job, deselect it
        if (currentActiveId === jobId) {
          console.log('Deselecting current job');
          await this.databaseManager.updateField('activeJobId', null);
        } else {
          console.log('Selecting new job:', jobId);
          await this.databaseManager.updateField('activeJobId', jobId);
        }
        
        // Get fresh jobs data from database
        const updatedJobs = await this.databaseManager.getField('savedJobs') || [];
        console.log('Updated jobs data:', updatedJobs);
        
        await this.updateCurrentJobDisplay();
        await this.updateSavedJobsList(updatedJobs); // Pass the fresh jobs data
      });
    });

    container.querySelectorAll('.open-job').forEach(button => {
      button.addEventListener('click', () => {
        const jobLink = button.dataset.jobLink;
        if (jobLink && jobLink !== '#') {
          window.open(jobLink, '_blank');
        }
      });
    });

    // Add event listeners for delete buttons
    container.querySelectorAll('.delete-job').forEach(button => {
      button.addEventListener('click', async () => {
        const jobId = button.dataset.jobId;
        const savedJobs = await this.databaseManager.getField('savedJobs') || [];
        const jobToDelete = savedJobs.find(job => job.id === jobId);
        
        if (jobToDelete) {
          if (confirm('Are you sure you want to delete this job?')) {
            console.log('Deleting job:', jobId);
            
            // Remove the job from saved jobs
            const updatedJobs = savedJobs.filter(job => job.id !== jobId);
            await this.databaseManager.updateField('savedJobs', updatedJobs);
            
            // If this was the active job, clear the active job
            const activeJobId = await this.databaseManager.getField('activeJobId');
            if (activeJobId === jobId) {
              await this.databaseManager.updateField('activeJobId', null);
              await this.updateCurrentJobDisplay();
            }
            
            // Update the UI
            await this.updateSavedJobsList(updatedJobs);
            this.showFeedbackMessage('Job deleted successfully');
          }
        } else {
          console.error('Job not found:', jobId);
          this.showFeedbackMessage('Error deleting job', 'error');
        }
      });
    });
  }

  setupAddSkillButtons(container) {
    container.querySelectorAll('.add-skill-button:not([disabled])').forEach(button => {
      button.addEventListener('click', async (e) => {
        e.stopPropagation();
        const skillName = button.dataset.skill;
        
        try {
          const currentSkills = await this.databaseManager.getField('skills') || [];
          
          // Check if skill already exists
          if (currentSkills.some(s => s.skill.toLowerCase() === skillName.toLowerCase())) {
            this.showFeedbackMessage('Skill already exists', 'error');
            return;
          }

          // Add the new skill
          currentSkills.push({
            skill: skillName,
            level: 'Beginner',
            yearsExperience: null
          });

          await this.databaseManager.updateField('skills', currentSkills);
          
          // Update the button to show added state
          button.classList.add('added');
          button.disabled = true;
          button.title = 'Already in skills';
          button.innerHTML = `
            <svg viewBox="0 0 24 24">
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
            </svg>
          `;

          this.showFeedbackMessage('Skill added successfully!');
          
          // Update skills list if visible
          const skillsList = document.getElementById('skillsList');
          if (skillsList && skillsList.offsetParent !== null) {
            this.updateSkillsList(currentSkills);
          }

          // Update keyword matches
          this.updateKeywordMatches();
        } catch (error) {
          console.error('Error adding skill:', error);
          this.showFeedbackMessage('Failed to add skill', 'error');
        }
      });
    });
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
      const currentResumeId = await this.databaseManager.getField('activeResumeId');
      const resumes = await this.databaseManager.getField('resumes') || [];
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
        this.databaseManager.getField('resumeText'),
        this.databaseManager.getField('coverLetterText')
      ]);

      const extractSkillsButton = document.getElementById('extractSkillsButton');
      const clearResumeButton = document.getElementById('clearResumeButton');
      const clearCoverLetterButton = document.getElementById('clearCoverLetterButton');
      const resumeContent = document.getElementById('resumeContent');
      const coverLetterContent = document.getElementById('coverLetterContent');

      if (resumeText && resumeContent) {
        resumeContent.textContent = resumeText;
        if (extractSkillsButton) {
          extractSkillsButton.style.display = 'block';
          // Add click handler for extract skills button
          extractSkillsButton.addEventListener('click', async () => {
            try {
              const restoreButton = this.showLoadingState(extractSkillsButton, 'Extracting...');
              
              // Get the current resume ID and content
              const activeResumeId = await this.databaseManager.getField('activeResumeId');
              const resumes = await this.databaseManager.getField('resumes') || [];
              const activeResume = resumes.find(r => r.id === activeResumeId);
              
              if (!activeResume || !activeResume.textContent) {
                throw new Error('No resume text found. Please select a resume first.');
              }

              // Get the API key
              const apiKey = await this.databaseManager.getField('geminiApiKey');
              if (!apiKey) {
                throw new Error('API Key is required. Please add it in the Settings tab.');
              }

              // Send to background script for processing
              const response = await chrome.runtime.sendMessage({
                action: 'extractSkillsAndEducation',
                text: activeResume.textContent,
                apiKey: apiKey
              });

              if (response.error) {
                throw new Error(response.error);
              }

              // Show confirmation modal with extracted data
              const modal = this.showModal(
                'Extracted Skills & Education',
                this.createAnalysisModalContent(response),
                this.createAnalysisModalActions()
              );

              // Setup handlers for the modal
              this.setupAnalysisModalHandlers(modal, response);

            } catch (error) {
              console.error('Error extracting skills and education:', error);
              this.showFeedbackMessage(error.message, 'error');
            } finally {
              restoreButton();
            }
          });
        }
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

  createAnalysisModalContent(analysis) {
    return `
      <div class="analysis-section">
        <h3>Skills Found (${analysis.skills?.length || 0})</h3>
        <div class="skill-toggles">
          ${analysis.skills?.map((skill, i) => `
            <div class="skill-toggle">
              <label>
                <input type="radio" name="skill_${i}" value="add" checked> Add
                <input type="radio" name="skill_${i}" value="skip"> Skip
                <span class="skill-name">${skill.skill}</span>
                <span class="skill-details">
                  ${skill.level}${skill.yearsExperience ? ' · ' + skill.yearsExperience + 'yrs' : ''}
                </span>
              </label>
            </div>
          `).join('') || 'No skills found'}
        </div>
      </div>

      <div class="analysis-section">
        <h3>Education Found (${analysis.education?.length || 0})</h3>
        <div class="education-toggles">
          ${analysis.education?.map((edu, i) => `
            <div class="education-toggle">
              <label>
                <input type="radio" name="edu_${i}" value="add" checked> Add
                <input type="radio" name="edu_${i}" value="skip"> Skip
                <div class="education-details">
                  <strong>${edu.title}</strong>
                  <div>${edu.institution}</div>
                  <div class="education-dates">
                    ${new Date(edu.startDate).toLocaleDateString()} - 
                    ${edu.inProgress ? 'Present' : edu.endDate ? new Date(edu.endDate).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </label>
            </div>
          `).join('') || 'No education found'}
        </div>
      </div>

      <div class="replace-toggle">
        <label>
          <input type="checkbox" id="replaceExisting"> Replace existing items instead of adding
        </label>
      </div>
    `;
  }

  createAnalysisModalActions() {
    return `
      <button class="secondary-button cancel-button">Cancel</button>
      <button class="primary-button confirm-button">Apply Selected</button>
    `;
  }

  setupAnalysisModalHandlers(modal, analysis) {
    const confirmButton = modal.querySelector('.confirm-button');
    const cancelButton = modal.querySelector('.cancel-button');
    const replaceCheckbox = modal.querySelector('#replaceExisting');

    confirmButton.addEventListener('click', async () => {
      const restoreButton = this.showLoadingState(confirmButton, 'Applying...');

      try {
        const selectedSkills = analysis.skills?.filter((_, i) => 
          modal.querySelector(`input[name="skill_${i}"][value="add"]`).checked
        ) || [];

        const selectedEducation = analysis.education?.filter((_, i) => 
          modal.querySelector(`input[name="edu_${i}"][value="add"]`).checked
        ) || [];

        const shouldReplace = replaceCheckbox.checked;

        if (shouldReplace) {
          await this.databaseManager.updateField('skills', selectedSkills);
          await this.databaseManager.updateField('education', selectedEducation);
        } else {
          // Add to existing items
          const existingSkills = await this.databaseManager.getField('skills') || [];
          const existingEducation = await this.databaseManager.getField('education') || [];

          await this.databaseManager.updateField('skills', [...existingSkills, ...selectedSkills]);
          await this.databaseManager.updateField('education', [...existingEducation, ...selectedEducation]);
        }

        this.updateSkillsList(await this.databaseManager.getField('skills'));
        this.updateEducationList(await this.databaseManager.getField('education'));
        this.showFeedbackMessage('Skills and education updated successfully!');
        modal.remove();
      } catch (error) {
        this.showFeedbackMessage(error.message, 'error');
      } finally {
        restoreButton();
      }
    });

    cancelButton.addEventListener('click', () => modal.remove());
  }
}
