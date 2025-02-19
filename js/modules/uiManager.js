// UI manager module for handling UI-related functionality
import { KeywordMatcher } from '../utils/keywordMatcher.js';

export class UIManager {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
    this.activeTab = 'assess';
    this.setupTabHandlers();
    this.currentMatchType = 'resume';
    this.setupMatchTypeHandlers();
    this.setupCoverLetterHandlers();
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

  setupCoverLetterHandlers() {
    const saveCoverLetterBtn = document.getElementById('saveCoverLetter');
    const cancelCoverLetterBtn = document.getElementById('cancelCoverLetter');
    const generatedCoverLetterDiv = document.querySelector('.generated-cover-letter');
    const coverLetterContent = document.getElementById('generatedCoverLetterContent');
    const coverLetterSelect = document.getElementById('coverLetterSelect');
    const savedCoverLetterContent = document.getElementById('coverLetterContent');
    const copyCoverLetterButton = document.getElementById('copyCoverLetterButton');
    const generateFreshBtn = document.getElementById('generateFreshCoverLetter');
    const modifyCurrentBtn = document.getElementById('modifyCurrentCoverLetter');
    const warningDiv = document.getElementById('noCoverLetterWarning');

    // Add copy to clipboard functionality
    if (copyCoverLetterButton) {
      copyCoverLetterButton.addEventListener('click', async () => {
        const textToCopy = savedCoverLetterContent?.value;
        if (!textToCopy) {
          this.showFeedbackMessage('No cover letter content to copy', 'error');
          return;
        }

        try {
          await navigator.clipboard.writeText(textToCopy);
          this.showFeedbackMessage('Cover letter copied to clipboard');
        } catch (error) {
          console.error('Error copying to clipboard:', error);
          this.showFeedbackMessage('Failed to copy to clipboard', 'error');
        }
      });
    }

    // Add clear cover letters button to settings (only if it doesn't exist)
    const settingsTab = document.getElementById('settings');
    if (settingsTab && !document.getElementById('clearCoverLetters')) {
      const clearSection = document.createElement('div');
      clearSection.className = 'settings-section';
      clearSection.innerHTML = `
        <h3>Cover Letter Management</h3>
        <button id="clearCoverLetters" class="danger-button">Clear All Cover Letters</button>
      `;
      settingsTab.appendChild(clearSection);

      // Add event listener for clear button
      const clearBtn = document.getElementById('clearCoverLetters');
      if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
          if (confirm('Are you sure you want to delete all cover letters? This cannot be undone.')) {
            try {
              await this.databaseManager.updateField('coverLetters', []);
              await this.databaseManager.updateField('activeCoverLetterId', null);
              await this.updateSavedCoverLetters();
              this.showFeedbackMessage('All cover letters cleared successfully');
            } catch (error) {
              console.error('Error clearing cover letters:', error);
              this.showFeedbackMessage('Failed to clear cover letters', 'error');
            }
          }
        });
      }
    }

    if (saveCoverLetterBtn) {
      saveCoverLetterBtn.addEventListener('click', async () => {
        console.log('Save cover letter button clicked');
        
        // Get content from the correct textarea
        let textContent;
        if (generatedCoverLetterDiv?.style.display !== 'none') {
          textContent = coverLetterContent?.value;
          console.log('Getting content from generated cover letter');
        } else {
          textContent = savedCoverLetterContent?.value;
          console.log('Getting content from saved cover letter');
        }

        console.log('Content to save:', { length: textContent?.length, fromGenerated: generatedCoverLetterDiv?.style.display !== 'none' });

        if (!textContent) {
          this.showFeedbackMessage('No content to save', 'error');
          return;
        }

        const name = await this.promptForCoverLetterName();
        if (!name) return;

        try {
          console.log('Saving new cover letter:', { name, contentLength: textContent.length });
          
          // Create new cover letter object with explicit textContent field
          const newCoverLetter = {
            id: Date.now().toString(),
            name: name.trim(),
            textContent: textContent.trim(),
            createdAt: new Date().toISOString()
          };

          console.log('New cover letter object:', newCoverLetter);

          // Get existing cover letters
          let coverLetters = await this.databaseManager.getField('coverLetters');
          console.log('Retrieved cover letters from database:', coverLetters);
          
          // Ensure coverLetters is an array and create a fresh copy
          coverLetters = Array.isArray(coverLetters) ? [...coverLetters] : [];
          
          // Validate existing cover letters and remove any invalid ones
          const originalLength = coverLetters.length;
          coverLetters = coverLetters.filter(letter => {
            const isValid = letter && 
              typeof letter === 'object' && 
              letter.id && 
              letter.name && 
              typeof letter.textContent === 'string' &&
              letter.textContent.length > 0;
            
            if (!isValid) {
              console.warn('Removing invalid cover letter:', letter);
            }
            return isValid;
          });
          
          if (coverLetters.length !== originalLength) {
            console.log(`Removed ${originalLength - coverLetters.length} invalid cover letters`);
          }
          
          // Add the new cover letter
          coverLetters.push(newCoverLetter);
          console.log('Updated cover letters array:', coverLetters);

          // Save to database
          await this.databaseManager.updateField('coverLetters', coverLetters);
          await this.databaseManager.updateField('activeCoverLetterId', newCoverLetter.id);

          // Update UI
          await this.updateSavedCoverLetters();
          
          // Hide the generation UI and show success message
          if (generatedCoverLetterDiv) {
            generatedCoverLetterDiv.style.display = 'none';
          }
          this.showFeedbackMessage('Cover letter saved successfully');
        } catch (error) {
          console.error('Error saving cover letter:', error);
          this.showFeedbackMessage('Failed to save cover letter', 'error');
        }
      });
    }

    if (cancelCoverLetterBtn) {
      cancelCoverLetterBtn.addEventListener('click', () => {
        if (generatedCoverLetterDiv) {
          generatedCoverLetterDiv.style.display = 'none';
          if (coverLetterContent) {
            coverLetterContent.value = ''; // Clear the content
          }
        }
      });
    }

    // Add change handler for cover letter select
    if (coverLetterSelect) {
      coverLetterSelect.addEventListener('change', async () => {
        const selectedId = coverLetterSelect.value;
        console.log('Cover letter selected:', selectedId);
        
        if (!selectedId) {
          console.log('No cover letter selected, clearing content');
          if (savedCoverLetterContent) {
            savedCoverLetterContent.value = '';
          }
          return;
        }

        try {
          // Get cover letters from database
          let coverLetters = await this.databaseManager.getField('coverLetters');
          console.log('Retrieved cover letters from database:', coverLetters);
          
          // Ensure coverLetters is an array and create a fresh copy
          coverLetters = Array.isArray(coverLetters) ? [...coverLetters] : [];
          
          // Find the selected letter
          const selectedLetter = coverLetters.find(letter => letter.id === selectedId);
          console.log('Selected letter:', selectedLetter);
          
          if (selectedLetter?.textContent && savedCoverLetterContent) {
            console.log('Setting content, length:', selectedLetter.textContent.length);
            savedCoverLetterContent.value = selectedLetter.textContent;
            await this.databaseManager.updateField('activeCoverLetterId', selectedId);
          } else {
            console.error('Selected letter not found or invalid:', selectedId);
            if (savedCoverLetterContent) {
              savedCoverLetterContent.value = '';
            }
          }
        } catch (error) {
          console.error('Error loading cover letter:', error);
          this.showFeedbackMessage('Failed to load cover letter', 'error');
        }
      });
    }

    if (generateFreshBtn) {
      generateFreshBtn.addEventListener('click', async () => {
        // Repoll the DOM immediately on click to get the latest value.
        const specialInstructionsEl = document.getElementById('specialInstructions');
        const specialInstructions = specialInstructionsEl?.value?.trim() || '';
        
        const options = {
          paragraphCount: document.querySelector('input[name="paragraphCount"]:checked')?.value || '3',
          tone: document.querySelector('input[name="letterTone"]:checked')?.value || 'eager',
          includeResume: document.querySelector('input[name="includeResume"]')?.checked || false,
          includeExperience: document.querySelector('input[name="includeExperience"]')?.checked || false,
          includeEducation: document.querySelector('input[name="includeEducation"]')?.checked || false,
          includeSkills: document.querySelector('input[name="includeSkills"]')?.checked || false,
          specialInstructions
        };

        console.log("Cover letter options:", options);
        // ... proceed to generate cover letter with the options.
      });
    }

    if (modifyCurrentBtn) {
      modifyCurrentBtn.addEventListener('click', async () => {
        const currentJob = await this.databaseManager.getField('currentJob');
        
        if (!currentJob) {
          this.showFeedbackMessage('Please select a job in the Jobs tab first', 'error');
          if (warningDiv) {
            warningDiv.style.display = 'block';
            warningDiv.textContent = 'Please select a job in the Jobs tab first to modify the cover letter.';
          }
          return;
        }

        // Hide warning if job is selected
        if (warningDiv) {
          warningDiv.style.display = 'none';
        }

        // Get the latest value of special instructions right before generating
        const specialInstructions = document.getElementById('specialInstructions')?.value?.trim() || '';

        // ... rest of the modify cover letter logic ...
      });
    }
  }

  async promptForCoverLetterName() {
    const modal = this.showModal(
      'Save Cover Letter',
      `
        <div class="form-group">
          <label for="coverLetterName">Cover Letter Name:</label>
          <input type="text" id="coverLetterName" class="form-input" placeholder="Enter a name for this cover letter">
        </div>
      `,
      `
        <button id="confirmSaveCoverLetter" class="primary-button">Save</button>
        <button id="cancelSaveCoverLetter" class="secondary-button">Cancel</button>
      `
    );

    return new Promise((resolve) => {
      const confirmBtn = modal.querySelector('#confirmSaveCoverLetter');
      const cancelBtn = modal.querySelector('#cancelSaveCoverLetter');
      const input = modal.querySelector('#coverLetterName');

      const cleanup = () => {
        // Remove any existing modals
        document.querySelectorAll('.modal').forEach(m => m.remove());
      };

      const handleSave = () => {
        const name = input.value.trim();
        if (name) {
          cleanup();
          resolve(name);
        } else {
          input.classList.add('error');
        }
      };

      confirmBtn.addEventListener('click', handleSave);
      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      // Handle Enter key press
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleSave();
        }
      });

      input.addEventListener('input', () => {
        input.classList.remove('error');
      });

      // Focus the input
      input.focus();
    });
  }

  async updateSavedCoverLetters() {
    const select = document.getElementById('coverLetterSelect');
    const contentDisplay = document.getElementById('coverLetterContent');
    if (!select) return;

    try {
      console.log('Updating saved cover letters...');
      
      // Get cover letters from database
      let coverLetters = await this.databaseManager.getField('coverLetters');
      console.log('Retrieved cover letters from database:', coverLetters);
      
      // Ensure coverLetters is an array and create a fresh copy
      coverLetters = Array.isArray(coverLetters) ? [...coverLetters] : [];
      
      // Get active cover letter ID
      const activeCoverLetterId = await this.databaseManager.getField('activeCoverLetterId');
      console.log('Active cover letter ID:', activeCoverLetterId);
      
      // Clear existing options
      select.innerHTML = '<option value="">Select a cover letter</option>';

      // Add cover letters to select
      coverLetters.forEach(letter => {
        if (!letter?.id || !letter?.name || !letter?.textContent) {
          console.error('Invalid cover letter:', letter);
          return;
        }
        const option = document.createElement('option');
        option.value = letter.id;
        option.textContent = letter.name;
        select.appendChild(option);
      });

      // Handle content display
      if (contentDisplay) {
        if (activeCoverLetterId) {
          const activeLetter = coverLetters.find(letter => letter.id === activeCoverLetterId);
          console.log('Active letter:', activeLetter);
          
          if (activeLetter?.textContent) {
            select.value = activeCoverLetterId;
            contentDisplay.value = activeLetter.textContent;
          } else {
            console.warn('Active letter not found or invalid:', activeCoverLetterId);
            contentDisplay.value = '';
            select.value = '';
          }
        } else {
          console.log('No active cover letter');
          contentDisplay.value = '';
          select.value = '';
        }
      }
    } catch (error) {
      console.error('Error updating saved cover letters:', error);
      this.showFeedbackMessage('Failed to update cover letters', 'error');
    }
  }

  switchTab(tabId) {
    console.log('UIManager.switchTab called for tab:', tabId);
    // Remove active class from all tabs
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    // Add active class to clicked tab
    const button = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    const tabContent = document.getElementById(tabId);
    
    if (button && tabContent) {
      button.classList.add('active');
      tabContent.classList.add('active');
      this.activeTab = tabId;

      // Refresh data when switching to specific tabs
      if (tabId === 'skills') {
        this.refreshSkillsList();
      } else if (tabId === 'applied') {
        // Dispatch event for applied jobs tab selection
        document.dispatchEvent(new CustomEvent('appliedTabSelected'));
      } else if (tabId === 'jobs') {
        // Refresh jobs list when switching to jobs tab
        this.refreshJobsList();
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

    // Remove any existing modals first
    const existingModal = document.querySelector('.modal');
    if (existingModal) {
      existingModal.remove();
    }

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

    // Get keywords from jobs list
    const jobsList = document.getElementById('jobsList');
    if (jobsList) {
      jobsList.querySelectorAll('.keyword').forEach(span => keywords.add(span.textContent));
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

    // Update jobs list keywords
    const jobsList = document.getElementById('jobsList');
    if (jobsList) {
      jobsList.querySelectorAll('.keyword').forEach(span => {
        const keyword = span.textContent;
        const matchType = matches.get(keyword) || 'no-match';
        console.log(`Updating job keyword "${keyword}" with class "${matchType}"`);
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
    const savedContainer = document.getElementById('savedJobsList');
    if (!savedContainer) return;

    savedContainer.innerHTML = '';

    if (savedJobs.length === 0) {
      savedContainer.innerHTML = '<p class="no-items-message">No saved jobs yet.</p>';
      return;
    }

    savedJobs.forEach(job => {
      const jobElement = this.createSavedJobElement(job);
      savedContainer.appendChild(jobElement);
    });

    this.setupSavedJobsEventListeners(savedContainer);
  }

  createSavedJobElement(job) {
    const jobElement = document.createElement('div');
    jobElement.className = 'saved-job-item';
    jobElement.dataset.jobId = job.id;
    jobElement.dataset.jobLink = job.jobLink;

    const savedDate = new Date(job.dateSaved).toLocaleDateString();
    
    jobElement.innerHTML = `
      <div class="job-header">
        <h3 class="job-title">${job.title || 'Untitled Position'}</h3>
        <span class="job-company">${job.company || 'Unknown Company'}</span>
      </div>
      <div class="job-details">
        <span class="rating">Rating: ${job.rating}/10</span>
        <span class="date">Saved: ${savedDate}</span>
      </div>
      <div class="job-actions">
        <button class="view-job" data-action="view">View Job Details</button>
        <button class="open-job" data-action="open" data-job-link="${job.jobLink}">Open Job</button>
        <button class="select-job" data-action="select">Select Job</button>
        <button class="apply-button" data-action="apply">Mark as Applied</button>
        <button class="remove-button" data-action="remove">Delete</button>
      </div>
    `;

    // Update the select button if this is the active job
    this.updateJobSelectionState(jobElement, job.id);

    return jobElement;
  }

  async updateJobSelectionState(jobElement, jobId) {
    const activeJobId = await this.databaseManager.getField('activeJobId');
    const selectButton = jobElement.querySelector('.select-job');
    if (selectButton) {
      const isActive = activeJobId === jobId;
      selectButton.classList.toggle('active', isActive);
      selectButton.textContent = isActive ? 'Selected' : 'Select Job';
    }
  }

  setupSavedJobsEventListeners(container) {
    container.addEventListener('click', async (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      const jobElement = button.closest('.saved-job-item');
      if (!jobElement) return;

      const jobId = jobElement.dataset.jobId;
      const jobLink = jobElement.dataset.jobLink;
      const action = button.dataset.action;

      switch (action) {
        case 'view':
          const savedJobs = await this.databaseManager.getField('savedJobs');
          const job = savedJobs.find(j => j.id === jobId);
          if (job) {
            this.showJobDetailsModal(job);
          }
          break;

        case 'open':
          if (jobLink && jobLink !== '#') {
            window.open(jobLink, '_blank');
          }
          break;

        case 'remove':
          const jobToRemove = savedJobs.find(j => j.id === jobId);
          if (jobToRemove && await this.databaseManager.removeSavedJob(jobToRemove.jobLink)) {
            const updatedJobs = await this.databaseManager.getField('savedJobs');
            this.updateSavedJobsList(updatedJobs);
            this.showFeedbackMessage('Job deleted successfully');
          }
          break;

        case 'select':
          const selectedJob = savedJobs.find(j => j.id === jobId);
          if (selectedJob) {
            if (window.currentAssessment?.id === jobId) {
              // Deselect if already selected
              window.currentAssessment = null;
              await this.databaseManager.updateField('activeJobId', null);
            } else {
              // Select the job
              window.currentAssessment = selectedJob;
              await this.databaseManager.updateField('activeJobId', jobId);
            }
            await this.updateCurrentJobDisplay();
            await this.refreshJobsList();
          }
          break;

        case 'apply':
          const jobToApply = selectedJob.find(j => j.jobLink === jobLink);
          
          if (jobToApply) {
            document.dispatchEvent(new CustomEvent('showApplyModal', { detail: jobToApply }));
          }
          break;
      }
    });

    // Set up add skill buttons
    this.setupAddSkillButtons(container);
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
    `;
  }

  createAnalysisModalActions() {
    return `
      <div class="replace-toggle">
        <label>
          <input type="checkbox" id="replaceExisting"> Replace existing items
        </label>
      </div>
      <div class="button-group">
        <button class="primary-button confirm-button">Apply Selected</button>
        <button class="secondary-button cancel-button">Cancel</button>
      </div>
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

  async showJobDetailsModal(job) {
    // Get current skills to check against
    const currentSkills = await this.databaseManager.getField('skills') || [];
    const currentSkillNames = new Set(currentSkills.map(s => s.skill.toLowerCase()));

    // Get resume text for matching
    const resumeText = await this.databaseManager.getField('resumeText');

    // Create a Map of keyword matches
    let keywordMatches = new Map();
    if (job.keywords) {
      switch (this.currentMatchType) {
        case 'resume':
          keywordMatches = KeywordMatcher.findResumeMatches(job.keywords, resumeText);
          break;
        case 'skills':
          keywordMatches = KeywordMatcher.findSkillMatches(job.keywords, currentSkills);
          break;
        case 'both':
          keywordMatches = KeywordMatcher.findCombinedMatches(job.keywords, resumeText, currentSkills);
          break;
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
            <strong>Saved:</strong> ${new Date(job.dateSaved).toLocaleDateString()}
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
              <div class="keyword-match-controls">
                <label>Match Keywords Against:</label>
                <div class="toggle-group">
                  <label class="toggle-option">
                    <input type="radio" name="modalMatchType" value="resume" ${this.currentMatchType === 'resume' ? 'checked' : ''}>
                    Resume Text
                  </label>
                  <label class="toggle-option">
                    <input type="radio" name="modalMatchType" value="skills" ${this.currentMatchType === 'skills' ? 'checked' : ''}>
                    Skills
                  </label>
                  <label class="toggle-option">
                    <input type="radio" name="modalMatchType" value="both" ${this.currentMatchType === 'both' ? 'checked' : ''}>
                    Both
                  </label>
                </div>
              </div>
              <div class="keyword-list">
                ${job.keywords.map(keyword => {
                  const matchType = keywordMatches.get(keyword) || 'no-match';
                  const isInSkills = currentSkillNames.has(keyword.toLowerCase());
                  return `
                    <span class="keyword ${matchType}">
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
                }).join('')}
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

    // Add event listeners for match type radio buttons
    modal.querySelectorAll('input[name="modalMatchType"]').forEach(radio => {
      radio.addEventListener('change', async (e) => {
        this.currentMatchType = e.target.value;
        modal.remove(); // Remove the old modal first
        await this.showJobDetailsModal(job); // Then create the new modal
      });
    });

    // Add event listeners for add skill buttons
    this.setupAddSkillButtons(modal);

    document.body.appendChild(modal);
  }

  async updateJobsList(jobs = []) {
    console.log('Updating jobs list with jobs:', jobs);
    const jobsContainer = document.getElementById('jobsList');
    if (!jobsContainer) {
      console.error('Jobs container not found');
      return;
    }

    if (!jobs.length) {
      console.log('No jobs to display');
      jobsContainer.innerHTML = '<p class="no-items-message">No saved jobs yet.</p>';
      return;
    }

    // Store this for use in event handlers
    const self = this;

    // Get the active job ID from the database
    const activeJobId = await this.databaseManager.getField('activeJobId');
    console.log('Active job ID:', activeJobId);

    // Sync window.currentAssessment with database state if needed
    if (activeJobId && (!window.currentAssessment || window.currentAssessment.id !== activeJobId)) {
      window.currentAssessment = jobs.find(j => j.id === activeJobId) || null;
    }

    jobsContainer.innerHTML = jobs.map(job => {
      const isActive = job.id === (window.currentAssessment?.id || activeJobId);
      return `
        <div class="saved-job-item ${isActive ? 'active' : ''}" data-job-id="${job.id}">
          <div class="job-header">
            <h3 class="job-title">${job.title || 'Untitled Position'}</h3>
            <span class="job-company">${job.company || 'Unknown Company'}</span>
          </div>
          <div class="job-details">
            <span class="rating">Rating: ${job.rating}/10</span>
            <span class="date">Saved: ${new Date(job.dateSaved).toLocaleDateString()}</span>
          </div>
          <div class="job-actions">
            <button class="select-job ${isActive ? 'active' : ''}" data-action="select">
              ${isActive ? 'Selected' : 'Select Job'}
            </button>
            <button class="view-job" data-action="view">View Job Details</button>
            ${job.jobLink ? `<button class="open-job" data-action="open" data-job-link="${job.jobLink}">Open Job</button>` : ''}
            <button class="apply-button" data-action="apply">Mark as Applied</button>
            <button class="remove-button" data-action="remove">Delete</button>
          </div>
        </div>
      `;
    }).join('');
    console.log('Jobs list HTML updated');

    // Add event listeners for job actions
    jobsContainer.querySelectorAll('.saved-job-item').forEach(jobElement => {
      jobElement.querySelectorAll('button[data-action]').forEach(button => {
        button.addEventListener('click', async (e) => {
          const jobId = jobElement.dataset.jobId;
          const action = button.dataset.action;
          console.log('Job action clicked:', { jobId, action });
          
          switch (action) {
            case 'select':
              const selectedJob = jobs.find(j => j.id === jobId);
              if (selectedJob) {
                if (window.currentAssessment?.id === jobId) {
                  // Deselect if already selected
                  window.currentAssessment = null;
                  await self.databaseManager.updateField('activeJobId', null);
                } else {
                  // Select the job
                  window.currentAssessment = selectedJob;
                  await self.databaseManager.updateField('activeJobId', jobId);
                }
                await self.updateCurrentJobDisplay();
                await self.refreshJobsList();
              }
              break;
            case 'view':
              const job = jobs.find(j => j.id === jobId);
              if (job) {
                self.showJobDetailsModal(job);
              }
              break;
            case 'open':
              const jobLink = button.dataset.jobLink;
              if (jobLink) {
                window.open(jobLink, '_blank');
              }
              break;
            case 'apply':
              const jobToApply = jobs.find(j => j.id === jobId);
              if (jobToApply) {
                document.dispatchEvent(new CustomEvent('showApplyModal', { detail: jobToApply }));
              }
              break;
            case 'remove':
              const jobToRemove = jobs.find(j => j.id === jobId);
              if (jobToRemove && await self.databaseManager.removeSavedJob(jobToRemove.jobLink)) {
                const updatedJobs = await self.databaseManager.getField('savedJobs');
                self.updateJobsList(updatedJobs);
                self.showFeedbackMessage('Job deleted successfully');
              }
              break;
          }
        });
      });
    });
  }

  async refreshJobsList() {
    console.log('Refreshing jobs list...');
    try {
      const savedJobs = await this.databaseManager.getField('savedJobs') || [];
      console.log('Retrieved saved jobs:', savedJobs);
      await this.updateJobsList(savedJobs);
    } catch (error) {
      console.error('Error refreshing jobs list:', error);
    }
  }
}
