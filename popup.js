// Main popup script that coordinates all modules
import { DocumentProcessor } from './js/modules/documentProcessor.js';
import { JobAssessor } from './js/modules/jobAssessor.js';
import { SkillsManager } from './js/modules/skillsManager.js';
import { EducationManager } from './js/modules/educationManager.js';
import { LimitationsManager } from './js/modules/limitationsManager.js';
import { UIManager } from './js/modules/uiManager.js';
import { EventHandlers } from './js/utils/eventHandlers.js';

document.addEventListener('DOMContentLoaded', async function() {
  // Initialize database first
  await DatabaseManager.initializeDB();

  // Initialize managers
  const jobAssessor = new JobAssessor(DatabaseManager);
  const skillsManager = new SkillsManager(DatabaseManager);
  const educationManager = new EducationManager(DatabaseManager);
  const limitationsManager = new LimitationsManager(DatabaseManager);
  const uiManager = new UIManager(DatabaseManager);

  // Load API Key
  const apiKey = await DatabaseManager.getField('geminiApiKey');
  if (apiKey) {
    document.getElementById('geminiApiKey').value = apiKey;
  }

  // Initial UI updates
  await Promise.all([
    uiManager.updateCurrentJobDisplay(),
    uiManager.updateCurrentResumeDisplay(),
    refreshAllLists()
  ]);

  // Setup event handlers
  setupEventHandlers();

  // Load saved documents
  await loadSavedDocuments();

  async function refreshAllLists() {
    const savedJobs = await DatabaseManager.getField('savedJobs') || [];
    await uiManager.updateSavedJobsList(savedJobs);
    const [skills, education, limitations] = await Promise.all([
      DatabaseManager.getField('skills') || [],
      DatabaseManager.getField('education') || [],
      DatabaseManager.getField('limitations') || []
    ]);

    uiManager.updateSkillsList(skills);
    uiManager.updateEducationList(education);
    uiManager.updateLimitationsList(limitations);
  }

  async function loadSavedDocuments() {
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
    } catch (error) {
      console.error('Error loading saved documents:', error);
    }
  }

  function setupEventHandlers() {
    // Assess job button handler
    const assessJobButton = document.getElementById('assessJobButton');
    assessJobButton.addEventListener('click', async function() {
      uiManager.hideError();
      const restoreButton = uiManager.showLoadingState(this);

      try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          throw new Error('No active tab found');
        }

        // Check if content script is ready
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'isContentScriptReady' });
          if (!response?.ready) {
            throw new Error('Content script not ready');
          }
        } catch (error) {
          console.error('Content script check failed:', error);
          throw new Error('Please refresh the page and try again.');
        }

        // Get selected text using messaging
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
        if (!response || !response.text) {
          throw new Error('Please select some text from the job posting first.');
        }

        const selectedText = response.text;
        const apiKey = await DatabaseManager.getField('geminiApiKey');
        if (!apiKey) {
          throw new Error('Please enter your API key in the Settings tab first.');
        }

        const assessment = await jobAssessor.assessJob(selectedText, apiKey);
        
        // Store the current assessment and job text for saving later
        window.currentAssessment = {
          id: generateUniqueId(),
          title: assessment.title || 'Untitled Job',
          company: assessment.company || '',
          rating: assessment.rating || 0,
          rationale: assessment.rationale || '',
          keywords: assessment.keywords || [],
          jobText: selectedText,
          jobLink: tab.url,
          dateSaved: new Date().toISOString()
        };
        
        uiManager.updateAssessmentResults(assessment);
      } catch (error) {
        console.error('Assessment error:', error);
        uiManager.showError(error.message || 'Failed to assess job posting. Please try again.');
      } finally {
        restoreButton();
      }
    });

    // Save job button handler
    document.getElementById('saveJobButton').addEventListener('click', async function() {
      const restoreButton = uiManager.showLoadingState(this);
      
      try {
        if (!window.currentAssessment) {
          throw new Error('No job assessment available to save');
        }

        const saveResult = await jobAssessor.saveJob(window.currentAssessment);
        
        if (saveResult.status === 'exists') {
          // Show confirmation modal for updating existing job
          const modal = uiManager.showModal(
            'Update Existing Job',
            `<p>${saveResult.message}</p>`,
            `
              <button class="secondary-button cancel-button">Cancel</button>
              <button class="primary-button confirm-button">Update</button>
            `
          );

          EventHandlers.setupModalHandlers(modal, async () => {
            await jobAssessor.updateSavedJob(window.currentAssessment.jobLink, window.currentAssessment);
            await refreshAllLists();
            uiManager.showFeedbackMessage('Job updated successfully!');
          });
        } else if (saveResult.status === 'limit') {
          // Show confirmation modal for replacing oldest job
          const modal = uiManager.showModal(
            'Replace Oldest Job',
            `<p>${saveResult.message}</p>
             <p>Oldest job: ${saveResult.oldestJob.title}</p>`,
            `
              <button class="secondary-button cancel-button">Cancel</button>
              <button class="primary-button confirm-button">Replace</button>
            `
          );

          EventHandlers.setupModalHandlers(modal, async () => {
            await jobAssessor.removeSavedJob(saveResult.oldestJob.jobLink);
            await jobAssessor.saveJob(window.currentAssessment);
            await refreshAllLists();
            uiManager.showFeedbackMessage('Job saved successfully!');
          });
        } else {
          // Normal save
          await refreshAllLists();
          uiManager.showFeedbackMessage(saveResult.message);
        }
      } catch (error) {
        console.error('Error saving job:', error);
        uiManager.showError(error.message || 'Failed to save job. Please try again.');
      } finally {
        restoreButton();
      }
    });

    // Save API Key handler
    EventHandlers.setupApiKeyHandler(
      document.getElementById('geminiApiKey'),
      document.getElementById('saveApiKeyButton'),
      async (apiKey) => {
        await DatabaseManager.updateField('geminiApiKey', apiKey);
        uiManager.showFeedbackMessage('API Key Saved!');
      }
    );

    // Skills management handlers
    setupSkillsHandlers();

    // Education management handlers
    setupEducationHandlers();

    // Limitations management handlers
    setupLimitationsHandlers();

    // Document management handlers
    setupDocumentHandlers();
  }

  function setupSkillsHandlers() {
    const skillNameInput = document.getElementById('skillName');
    const skillLevelSelect = document.getElementById('skillLevel');
    const skillYearsInput = document.getElementById('skillYears');
    const addSkillButton = document.getElementById('addSkillButton');

    EventHandlers.setupSkillInputHandler(skillNameInput, addSkillButton);

    addSkillButton.addEventListener('click', async () => {
      try {
        await skillsManager.addSkill(
          skillNameInput.value.trim(),
          skillLevelSelect.value,
          skillYearsInput.value
        );
        
        uiManager.clearInputs(['skillName', 'skillYears']);
        skillLevelSelect.value = 'Intermediate';
        
        const skills = await skillsManager.getAllSkills();
        uiManager.updateSkillsList(skills);
        uiManager.showFeedbackMessage('Skill added!');
      } catch (error) {
        uiManager.showFeedbackMessage(error.message, 'error');
      }
    });

    // Skill removal handler
    document.getElementById('skillsList').addEventListener('click', async (e) => {
      if (e.target.classList.contains('remove-skill')) {
        const skillName = e.target.dataset.skill;
        await skillsManager.removeSkill(skillName);
        const skills = await skillsManager.getAllSkills();
        uiManager.updateSkillsList(skills);
        uiManager.showFeedbackMessage('Skill removed!');
      }
    });
  }

  function setupEducationHandlers() {
    const addEducationButton = document.getElementById('addEducationButton');
    const educationType = document.getElementById('educationType');
    const educationInProgress = document.getElementById('educationInProgress');
    const educationEndDate = document.getElementById('educationEndDate');
    const educationURL = document.getElementById('educationURL');
    const educationExpiry = document.getElementById('educationExpiry');
    const educationGPA = document.getElementById('educationGPA');

    EventHandlers.setupEducationToggleHandler(educationInProgress, educationEndDate);
    EventHandlers.setupEducationTypeHandler(educationType, educationURL, educationExpiry, educationGPA);

    addEducationButton.addEventListener('click', async () => {
      try {
        const educationData = {
          type: educationType.value,
          title: document.getElementById('educationTitle').value.trim(),
          institution: document.getElementById('educationInstitution').value.trim(),
          startDate: document.getElementById('educationStartDate').value,
          endDate: educationInProgress.checked ? null : educationEndDate.value,
          inProgress: educationInProgress.checked,
          description: document.getElementById('educationDescription').value.trim(),
          gpa: educationGPA.value.trim() || null,
          url: educationURL.value.trim() || null,
          expiryDate: educationExpiry.value || null
        };

        await educationManager.addEducation(educationData);
        const education = await educationManager.getAllEducation();
        uiManager.updateEducationList(education);
        uiManager.showFeedbackMessage('Education item added successfully!');
        
        uiManager.clearInputs([
          'educationTitle', 'educationInstitution', 'educationStartDate',
          'educationEndDate', 'educationInProgress', 'educationGPA',
          'educationURL', 'educationExpiry', 'educationDescription'
        ]);
      } catch (error) {
        uiManager.showFeedbackMessage(error.message, 'error');
      }
    });

    // Education removal handler
    document.getElementById('educationList').addEventListener('click', async (e) => {
      if (e.target.classList.contains('remove-button')) {
        const index = parseInt(e.target.dataset.index);
        await educationManager.removeEducation(index);
        const education = await educationManager.getAllEducation();
        uiManager.updateEducationList(education);
        uiManager.showFeedbackMessage('Education item removed!');
      }
    });
  }

  function setupLimitationsHandlers() {
    const addLimitationButton = document.getElementById('addLimitationButton');
    const isTemporary = document.getElementById('isTemporary');
    const limitationEndDate = document.getElementById('limitationEndDate');

    EventHandlers.setupLimitationToggleHandler(isTemporary, limitationEndDate);
    
    EventHandlers.setupLimitationFilterHandlers(
      document.querySelectorAll('.filter-button'),
      async (category) => {
        const limitations = await limitationsManager.getAllLimitations();
        uiManager.updateLimitationsList(limitations, category);
      }
    );

    addLimitationButton.addEventListener('click', async () => {
      try {
        const limitationData = {
          category: document.getElementById('limitationCategory').value,
          limitation: document.getElementById('limitationText').value.trim(),
          details: document.getElementById('limitationDetails').value.trim() || null,
          isTemporary: isTemporary.checked,
          endDate: isTemporary.checked ? limitationEndDate.value : null
        };

        await limitationsManager.addLimitation(limitationData);
        const limitations = await limitationsManager.getAllLimitations();
        uiManager.updateLimitationsList(limitations);
        uiManager.showFeedbackMessage('Limitation added successfully!');
        
        uiManager.clearInputs([
          'limitationText', 'limitationDetails', 'isTemporary', 'limitationEndDate'
        ]);
      } catch (error) {
        uiManager.showFeedbackMessage(error.message, 'error');
      }
    });

    // Limitation removal handler
    document.getElementById('limitationsList').addEventListener('click', async (e) => {
      if (e.target.classList.contains('remove-button')) {
        const index = parseInt(e.target.dataset.index);
        await limitationsManager.removeLimitation(index);
        const limitations = await limitationsManager.getAllLimitations();
        uiManager.updateLimitationsList(limitations);
        uiManager.showFeedbackMessage('Limitation removed!');
      }
    });
  }

  function setupDocumentHandlers() {
    // Resume handlers
    const resumeSelect = document.getElementById('resumeSelect');
    const resumeContent = document.getElementById('resumeContent');
    const uploadResumeButton = document.getElementById('uploadResumeButton');
    const resumeFileInput = document.getElementById('resumeFileInput');
    const removeResumeButton = document.getElementById('removeResumeButton');
    const extractSkillsButton = document.getElementById('extractSkillsButton');

    // Cover letter handlers
    const coverLetterSelect = document.getElementById('coverLetterSelect');
    const coverLetterContent = document.getElementById('coverLetterContent');
    const uploadCoverLetterButton = document.getElementById('uploadCoverLetterButton');
    const coverLetterFileInput = document.getElementById('coverLetterFileInput');
    const removeCoverLetterButton = document.getElementById('removeCoverLetterButton');

    // Modal handlers
    const uploadModal = document.getElementById('uploadModal');
    const documentTitle = document.getElementById('documentTitle');
    const selectedFileName = document.getElementById('selectedFileName');
    const confirmUploadButton = document.getElementById('confirmUploadButton');
    const cancelUploadButton = document.getElementById('cancelUploadButton');

    // Load initial documents
    loadResumes();
    loadCoverLetters();

    let currentUploadType = null;
    let currentFile = null;

    // Resume event handlers
    resumeSelect.addEventListener('change', async () => {
      const id = resumeSelect.value;
      if (id) {
        const resumes = await DatabaseManager.getField('resumes') || [];
        const resume = resumes.find(r => r.id === id);
        if (resume) {
          resumeContent.value = resume.textContent;
          removeResumeButton.style.display = 'block';
          document.getElementById('extractSkillsButton').style.display = 'block';
          await DatabaseManager.setActiveResume(id);
          await uiManager.updateCurrentResumeDisplay();
        }
      } else {
        resumeContent.value = '';
        removeResumeButton.style.display = 'none';
        document.getElementById('extractSkillsButton').style.display = 'none';
        await DatabaseManager.setActiveResume(null);
        await uiManager.updateCurrentResumeDisplay();
      }
    });

    uploadResumeButton.addEventListener('click', () => {
      currentUploadType = 'resume';
      resumeFileInput.click();
    });

    resumeFileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        currentFile = file;
        documentTitle.value = file.name.replace('.docx', '');
        selectedFileName.textContent = file.name;
        uploadModal.style.display = 'flex';
      }
    });

    removeResumeButton.addEventListener('click', async () => {
      const id = resumeSelect.value;
      if (id && confirm('Are you sure you want to remove this resume?')) {
        await DatabaseManager.removeResume(id);
        await loadResumes();
        resumeContent.value = '';
        removeResumeButton.style.display = 'none';
        document.getElementById('extractSkillsButton').style.display = 'none';
      }
    });

    // Cover letter event handlers
    coverLetterSelect.addEventListener('change', async () => {
      const id = coverLetterSelect.value;
      if (id) {
        const coverLetters = await DatabaseManager.getField('coverLetters') || [];
        const coverLetter = coverLetters.find(c => c.id === id);
        if (coverLetter) {
          coverLetterContent.value = coverLetter.textContent;
          removeCoverLetterButton.style.display = 'block';
          await DatabaseManager.setActiveCoverLetter(id);
        }
      } else {
        coverLetterContent.value = '';
        removeCoverLetterButton.style.display = 'none';
        await DatabaseManager.setActiveCoverLetter(null);
      }
    });

    uploadCoverLetterButton.addEventListener('click', () => {
      currentUploadType = 'coverLetter';
      coverLetterFileInput.click();
    });

    coverLetterFileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        currentFile = file;
        documentTitle.value = file.name.replace('.docx', '');
        selectedFileName.textContent = file.name;
        uploadModal.style.display = 'flex';
      }
    });

    removeCoverLetterButton.addEventListener('click', async () => {
      const id = coverLetterSelect.value;
      if (id && confirm('Are you sure you want to remove this cover letter?')) {
        await DatabaseManager.removeCoverLetter(id);
        await loadCoverLetters();
        coverLetterContent.value = '';
        removeCoverLetterButton.style.display = 'none';
      }
    });

    // Modal event handlers
    confirmUploadButton.addEventListener('click', async () => {
      if (!currentFile || !documentTitle.value.trim()) {
        alert('Please provide a title for the document');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target.result;
        
        try {
          // Check if mammoth is available
          if (typeof mammoth === 'undefined') {
            throw new Error('Mammoth.js is not loaded. Please check the script inclusion.');
          }

          console.log('Converting document with mammoth.js...');
          console.log('File size:', content.byteLength, 'bytes');
          
          // Convert ArrayBuffer to base64
          const base64Content = btoa(String.fromCharCode(...new Uint8Array(content)));
          
          // Convert to text using mammoth
          const result = await new Promise((resolve, reject) => {
            try {
              mammoth.extractRawText({ arrayBuffer: content })
                .then(result => {
                  console.log('Conversion successful:', result);
                  resolve(result);
                })
                .catch(err => {
                  console.error('Mammoth conversion error:', err);
                  reject(err);
                });
            } catch (err) {
              reject(err);
            }
          });

          console.log('Conversion successful:', result);
          
          if (!result || !result.value) {
            throw new Error('Document conversion produced no text output');
          }

          if (currentUploadType === 'resume') {
            console.log('Adding new resume...');
            const id = await DatabaseManager.addResume(documentTitle.value.trim(), 'docx', base64Content);
            console.log('Resume added with ID:', id);
            await DatabaseManager.updateResumeText(id, result.value);
            console.log('Resume text updated');
            
            // Refresh the resumes list
            await loadResumes();
            console.log('Resumes list refreshed');
            
            // Set the new resume as active
            resumeSelect.value = id;
            resumeContent.value = result.value;
            removeResumeButton.style.display = 'block';
            document.getElementById('extractSkillsButton').style.display = 'block';
            await DatabaseManager.setActiveResume(id);
            console.log('New resume set as active:', id);
          } else {
            console.log('Adding new cover letter...');
            const id = await DatabaseManager.addCoverLetter(documentTitle.value.trim(), 'docx', base64Content);
            console.log('Cover letter added with ID:', id);
            await DatabaseManager.updateCoverLetterText(id, result.value);
            console.log('Cover letter text updated');
            
            // Refresh the cover letters list
            await loadCoverLetters();
            console.log('Cover letters list refreshed');
            
            // Set the new cover letter as active
            coverLetterSelect.value = id;
            coverLetterContent.value = result.value;
            removeCoverLetterButton.style.display = 'block';
            await DatabaseManager.setActiveCoverLetter(id);
            console.log('New cover letter set as active:', id);
          }
          
          // Reset and close modal
          closeUploadModal();
        } catch (error) {
          console.error('Document processing error:', error);
          alert('Error processing document: ' + (error.message || 'Unknown error occurred'));
        }
      };

      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        alert('Error reading file: ' + (error.message || 'Unknown error occurred'));
      };
      
      try {
        reader.readAsArrayBuffer(currentFile);
      } catch (error) {
        console.error('Error starting file read:', error);
        alert('Error reading file: ' + (error.message || 'Unknown error occurred'));
      }
    });

    cancelUploadButton.addEventListener('click', closeUploadModal);

    function closeUploadModal() {
      uploadModal.style.display = 'none';
      documentTitle.value = '';
      selectedFileName.textContent = 'No file selected';
      currentFile = null;
      currentUploadType = null;
      resumeFileInput.value = '';
      coverLetterFileInput.value = '';
    }

    // Extract skills button handler
    extractSkillsButton.addEventListener('click', async () => {
      const resumeId = resumeSelect.value;
      if (!resumeId) {
        alert('Please select a resume first');
        return;
      }

      try {
        console.log('Extracting skills from resume:', resumeId);
        const resumes = await DatabaseManager.getField('resumes') || [];
        const resume = resumes.find(r => r.id === resumeId);
        
        if (!resume || !resume.textContent) {
          throw new Error('No resume text content found');
        }

        // Show loading state
        extractSkillsButton.disabled = true;
        extractSkillsButton.textContent = 'Extracting...';

        // Extract skills and education
        const response = await chrome.runtime.sendMessage({
          action: 'extractSkillsAndEducation',
          text: resume.textContent
        });

        console.log('Extraction response:', response);

        if (response.error) {
          throw new Error(response.error);
        }

        // Show modal with extracted items
        const modal = uiManager.showModal(
          'Extracted Skills & Education',
          uiManager.createAnalysisModalContent(response),
          uiManager.createAnalysisModalActions()
        );

        // Setup handlers for the modal
        uiManager.setupAnalysisModalHandlers(modal, response);

      } catch (error) {
        console.error('Error extracting skills and education:', error);
        alert('Error extracting skills and education: ' + error.message);
      } finally {
        // Reset button state
        extractSkillsButton.disabled = false;
        extractSkillsButton.textContent = 'Extract Skills & Education';
      }
    });
  }

  async function loadResumes() {
    console.log('Loading resumes...');
    try {
      // Initialize DB if needed
      await DatabaseManager.initializeDB();
      
      const resumes = await DatabaseManager.getField('resumes');
      const activeId = await DatabaseManager.getField('activeResumeId');
      const resumeSelect = document.getElementById('resumeSelect');
      
      console.log('Retrieved resumes from database:', resumes);
      console.log('Active resume ID:', activeId);
      
      // Ensure resumes is an array
      if (!Array.isArray(resumes)) {
        console.warn('Resumes is not an array:', resumes);
        await DatabaseManager.updateField('resumes', []);
        return;
      }
      
      // Clear existing options
      while (resumeSelect.firstChild) {
        resumeSelect.removeChild(resumeSelect.firstChild);
      }
      
      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select a resume...';
      resumeSelect.appendChild(defaultOption);
      console.log('Added default option to dropdown');
      
      // Add options for each resume
      if (resumes.length > 0) {
        resumes.forEach(resume => {
          if (!resume || !resume.id || !resume.name) {
            console.warn('Invalid resume object:', resume);
            return;
          }
          console.log('Processing resume:', resume);
          const option = document.createElement('option');
          option.value = resume.id;
          option.textContent = resume.name;
          resumeSelect.appendChild(option);
          console.log('Added resume option:', resume.name, resume.id);
        });
      } else {
        console.log('No resumes found in database');
      }
      
      // Set active resume if exists
      if (activeId && resumes.some(r => r.id === activeId)) {
        console.log('Setting active resume:', activeId);
        resumeSelect.value = activeId;
        const resume = resumes.find(r => r.id === activeId);
        if (resume) {
          document.getElementById('resumeContent').value = resume.textContent;
          document.getElementById('removeResumeButton').style.display = 'block';
          document.getElementById('extractSkillsButton').style.display = 'block';
        }
      }
      
      // Log final state of dropdown
      console.log('Final dropdown options:', Array.from(resumeSelect.options).map(opt => ({
        value: opt.value,
        text: opt.textContent
      })));
    } catch (error) {
      console.error('Error loading resumes:', error);
    }
  }

  async function loadCoverLetters() {
    console.log('Loading cover letters...');
    const coverLetters = await DatabaseManager.getField('coverLetters') || [];
    const activeId = await DatabaseManager.getField('activeCoverLetterId');
    const coverLetterSelect = document.getElementById('coverLetterSelect');
    
    console.log('Current cover letters:', coverLetters);
    console.log('Active cover letter ID:', activeId);
    
    // Clear existing options
    coverLetterSelect.innerHTML = '<option value="">Select a cover letter...</option>';
    
    // Add options for each cover letter
    coverLetters.forEach(coverLetter => {
      const option = document.createElement('option');
      option.value = coverLetter.id;
      option.textContent = coverLetter.name;
      coverLetterSelect.appendChild(option);
      console.log('Added cover letter option:', coverLetter.name, coverLetter.id);
    });
    
    // Set active cover letter if exists
    if (activeId && coverLetters.some(c => c.id === activeId)) {
      console.log('Setting active cover letter:', activeId);
      coverLetterSelect.value = activeId;
      const coverLetter = coverLetters.find(c => c.id === activeId);
      document.getElementById('coverLetterContent').value = coverLetter.textContent;
      document.getElementById('removeCoverLetterButton').style.display = 'block';
    }
  }

  function createAnalysisModalContent(analysis) {
    return `
      <div class="analysis-section">
        <h3>Skills Found (${analysis.skills.length})</h3>
        <div class="skill-toggles">
          ${analysis.skills.map((skill, i) => `
            <div class="skill-toggle">
              <label>
                <input type="checkbox" class="skill-checkbox" data-index="${i}" checked>
                <span class="skill-name">${skill.skill}</span>
                <span class="skill-details">
                  ${skill.level}${skill.yearsExperience ? ' · ' + skill.yearsExperience + 'yrs' : ''}
                </span>
              </label>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="analysis-section">
        <h3>Education Found (${analysis.education.length})</h3>
        <div class="education-toggles">
          ${analysis.education.map((edu, i) => `
            <div class="education-toggle">
              <label>
                <input type="checkbox" class="education-checkbox" data-index="${i}" checked>
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
          `).join('')}
        </div>
      </div>
    `;
  }

  function createAnalysisModalActions() {
    return `
      <label class="replace-toggle">
        <input type="checkbox" id="replaceExisting"> Replace existing items
      </label>
      <div class="button-group">
        <button class="secondary-button cancel-button">Cancel</button>
        <button class="primary-button confirm-button">Apply Selected</button>
      </div>
    `;
  }

  function setupAnalysisModalHandlers(modal, analysis) {
    const confirmButton = modal.querySelector('.confirm-button');
    const cancelButton = modal.querySelector('.cancel-button');
    const replaceCheckbox = modal.querySelector('#replaceExisting');

    confirmButton.addEventListener('click', async () => {
      const restoreButton = uiManager.showLoadingState(confirmButton, 'Applying...');

      try {
        const selectedSkills = [...modal.querySelectorAll('.skill-checkbox:checked')]
          .map(checkbox => analysis.skills[parseInt(checkbox.dataset.index)])
          .filter(skill => skill);

        const selectedEducation = [...modal.querySelectorAll('.education-checkbox:checked')]
          .map(checkbox => analysis.education[parseInt(checkbox.dataset.index)])
          .filter(edu => edu);

        await Promise.all([
          skillsManager.addExtractedSkills(selectedSkills, replaceCheckbox.checked),
          educationManager.addExtractedEducation(selectedEducation, replaceCheckbox.checked)
        ]);

        await refreshAllLists();
        uiManager.showFeedbackMessage('Resume analysis applied successfully!');
        modal.remove();
      } catch (error) {
        uiManager.showFeedbackMessage(error.message, 'error');
      } finally {
        restoreButton();
      }
    });

    cancelButton.addEventListener('click', () => modal.remove());
  }

  async function saveJob() {
    try {
      const jobText = await DatabaseManager.getField('currentJobText');
      const assessment = await DatabaseManager.getField('currentAssessment');
      
      if (!assessment) {
        throw new Error('No assessment available to save');
      }

      const jobLink = await getCurrentTabUrl();
      const newJob = {
        id: generateUniqueId(),
        title: extractJobTitle(jobText) || 'Untitled Job',
        company: extractCompanyName(jobText) || '',
        jobText: jobText, // Store the full job text
        rating: assessment.rating,
        rationale: assessment.rationale,
        keywords: assessment.keywords,
        jobLink: jobLink,
        dateSaved: new Date().toISOString()
      };

      // Get existing saved jobs
      const savedJobs = await DatabaseManager.getField('savedJobs') || [];
      
      // Check if job with same URL already exists
      const existingJobIndex = savedJobs.findIndex(job => job.jobLink === jobLink);
      
      if (existingJobIndex !== -1) {
        const confirmed = await uiManager.showConfirmDialog(
          'A job with this URL already exists. Would you like to update it?'
        );
        
        if (confirmed) {
          savedJobs[existingJobIndex] = newJob;
        } else {
          return;
        }
      } else {
        // Check if we've reached the maximum number of saved jobs
        if (savedJobs.length >= MAX_SAVED_JOBS) {
          const confirmed = await uiManager.showConfirmDialog(
            `You've reached the maximum of ${MAX_SAVED_JOBS} saved jobs. Would you like to replace the oldest job?`
          );
          
          if (confirmed) {
            savedJobs.shift(); // Remove the oldest job
            savedJobs.push(newJob);
          } else {
            return;
          }
        } else {
          savedJobs.push(newJob);
        }
      }

      // Save the updated jobs list
      await DatabaseManager.updateField('savedJobs', savedJobs);
      
      // Set this as the active job
      await DatabaseManager.updateField('activeJobId', newJob.id);
      await uiManager.updateCurrentJobDisplay();
      
      // Update the saved jobs list in the UI
      uiManager.updateSavedJobsList(savedJobs);
      uiManager.showFeedbackMessage('Job saved successfully!');
      
    } catch (error) {
      console.error('Error saving job:', error);
      uiManager.showFeedbackMessage(`Error saving job: ${error.message}`, 'error');
    }
  }

  function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function extractJobTitle(jobText) {
    // Simple extraction - take first line or return empty
    const lines = jobText.split('\n');
    return lines[0]?.trim() || '';
  }

  function extractCompanyName(jobText) {
    // This is a placeholder - you might want to implement more sophisticated company name extraction
    return '';
  }
});
