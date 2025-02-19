// Main popup script that coordinates all modules
import { DocumentProcessor } from './js/modules/documentProcessor.js';
import { JobAssessor } from './js/modules/jobAssessor.js';
import { SkillsManager } from './js/modules/skillsManager.js';
import { EducationManager } from './js/modules/educationManager.js';
import { LimitationsManager } from './js/modules/limitationsManager.js';
import { UIManager } from './js/modules/uiManager.js';
import { EventHandlers } from './js/utils/eventHandlers.js';
import { QAManager } from './js/modules/qaManager.js';
import { CoverLetterManager } from './js/modules/coverLetterManager.js';
import { ExperienceManager } from './js/modules/experienceManager.js';
import { AIHelper } from './js/utils/aiHelper.js';
import { AppliedManager } from './js/modules/appliedManager.js';
import { ExportManager } from './js/modules/exportManager.js';

// Function to update modify button visibility
function updateModifyButtonVisibility() {
  const modifyCurrentCoverLetterBtn = document.getElementById('modifyCurrentCoverLetter');
  const coverLetterContent = document.getElementById('coverLetterContent');
  if (coverLetterContent && coverLetterContent.value.trim()) {
    modifyCurrentCoverLetterBtn.style.display = 'block';
  } else if (modifyCurrentCoverLetterBtn) {
    modifyCurrentCoverLetterBtn.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  console.log('DOM Content Loaded');
  // Initialize database first
  await DatabaseManager.initializeDB();
  console.log('Database initialized');

  // Initialize managers
  const jobAssessor = new JobAssessor(DatabaseManager);
  const skillsManager = new SkillsManager(DatabaseManager, new UIManager(DatabaseManager));
  const educationManager = new EducationManager(DatabaseManager, new UIManager(DatabaseManager));
  const limitationsManager = new LimitationsManager(DatabaseManager);
  const uiManager = new UIManager(DatabaseManager);
  const coverLetterManager = new CoverLetterManager(DatabaseManager, uiManager);
  const experienceManager = new ExperienceManager(DatabaseManager, uiManager);
  const qaManager = new QAManager(DatabaseManager, uiManager);
  const appliedManager = new AppliedManager(DatabaseManager, uiManager);
  const exportManager = new ExportManager(DatabaseManager, uiManager);
  console.log('Managers initialized');

  // Variable for tracking experience being edited
  let editingIndex = null;

  // Load saved settings
  const [apiKey, model] = await Promise.all([
    DatabaseManager.getField('geminiApiKey'),
    DatabaseManager.getField('geminiModel')
  ]);
  console.log('Settings loaded');

  if (apiKey) {
    document.getElementById('geminiApiKey').value = apiKey;
  }
  
  if (model) {
    document.getElementById('geminiModel').value = model;
  }

  // Initial UI updates
  console.log('Starting initial UI updates');
  await Promise.all([
    uiManager.updateCurrentJobDisplay(),
    uiManager.updateCurrentResumeDisplay(),
    refreshAllLists()
  ]);
  console.log('Initial UI updates completed');

  // Setup event handlers - pass necessary managers as parameters
  setupEventHandlers({
    jobAssessor,
    skillsManager,
    educationManager,
    limitationsManager,
    uiManager,
    coverLetterManager,
    qaManager,
    DatabaseManager,
    experienceManager,
    appliedManager
  });

  // Load saved documents
  await loadSavedDocuments();

  // Profile Management
  await initializeProfileUI();

  // Experience tab functionality
  initializeExperienceTab(experienceManager);

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'assessJobPosting' && request.text) {
      // Store the text to be assessed
      window.jobTextToAssess = request.text;
      // Trigger assessment
      const assessJobButton = document.getElementById('assessJobButton');
      if (assessJobButton) {
        assessJobButton.click();
      }
    }
    // Always return true to indicate we'll respond asynchronously
    return true;
  });

  // Set up event listener for apply modal
  document.addEventListener('showApplyModal', (e) => {
    appliedManager.showApplyModal(e.detail);
  });

  async function refreshAllLists() {
    console.log('Refreshing all lists');
    const savedJobs = await DatabaseManager.getField('savedJobs') || [];
    console.log('Retrieved saved jobs for initial load:', savedJobs);
    await uiManager.updateJobsList(savedJobs);
    const [skills, education, limitations] = await Promise.all([
      DatabaseManager.getField('skills') || [],
      DatabaseManager.getField('education') || [],
      DatabaseManager.getField('limitations') || []
    ]);

    uiManager.updateSkillsList(skills);
    uiManager.updateEducationList(education);
    uiManager.updateLimitationsList(limitations);
    console.log('All lists refreshed');
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
        updateModifyButtonVisibility();
      }
    } catch (error) {
      console.error('Error loading saved documents:', error);
    }
  }

  function setupEventHandlers(managers) {
    const {
      jobAssessor,
      skillsManager,
      educationManager,
      limitationsManager,
      uiManager,
      coverLetterManager,
      qaManager,
      DatabaseManager,
      experienceManager,
      appliedManager
    } = managers;

    // Data Management Buttons
    const clearCoverLettersBtn = document.getElementById('clearCoverLetters');
    const clearResumesBtn = document.getElementById('clearResumes');
    const clearSkillsBtn = document.getElementById('clearSkills');
    const clearQABtn = document.getElementById('clearQA');
    const clearEducationBtn = document.getElementById('clearEducation');
    const clearExperienceBtn = document.getElementById('clearExperience');
    const wipeProfileBtn = document.getElementById('wipeProfile');
    const deleteAllJobsBtn = document.getElementById('deleteAllJobs');
    const deleteAllAppliedJobsBtn = document.getElementById('deleteAllAppliedJobs');

    clearCoverLettersBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all cover letters? This cannot be undone.')) {
        try {
          await DatabaseManager.updateField('coverLetters', []);
          await DatabaseManager.updateField('activeCoverLetterId', null);
          uiManager.showFeedbackMessage('All cover letters cleared successfully');
          await uiManager.updateSavedCoverLetters();
        } catch (error) {
          console.error('Error clearing cover letters:', error);
          uiManager.showFeedbackMessage('Failed to clear cover letters', 'error');
        }
      }
    });

    clearResumesBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all resumes? This cannot be undone.')) {
        try {
          await DatabaseManager.updateField('resumes', []);
          await DatabaseManager.updateField('activeResumeId', null);
          await DatabaseManager.updateField('resumeText', '');
          uiManager.showFeedbackMessage('All resumes cleared successfully');
          await uiManager.updateCurrentResumeDisplay();
        } catch (error) {
          console.error('Error clearing resumes:', error);
          uiManager.showFeedbackMessage('Failed to clear resumes', 'error');
        }
      }
    });

    clearSkillsBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all skills? This cannot be undone.')) {
        try {
          await DatabaseManager.updateField('skills', []);
          uiManager.showFeedbackMessage('All skills cleared successfully');
          await skillsManager.updateSkillsDisplay();
        } catch (error) {
          console.error('Error clearing skills:', error);
          uiManager.showFeedbackMessage('Failed to clear skills', 'error');
        }
      }
    });

    clearQABtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all Q&A pairs? This cannot be undone.')) {
        try {
          await DatabaseManager.updateField('qaPairs', []);
          uiManager.showFeedbackMessage('All Q&A pairs cleared successfully');
          await qaManager.updateQADisplay();
        } catch (error) {
          console.error('Error clearing Q&A pairs:', error);
          uiManager.showFeedbackMessage('Failed to clear Q&A pairs', 'error');
        }
      }
    });

    clearEducationBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all education entries? This cannot be undone.')) {
        try {
          await DatabaseManager.updateField('education', []);
          uiManager.showFeedbackMessage('All education entries cleared successfully');
          await educationManager.updateEducationDisplay();
        } catch (error) {
          console.error('Error clearing education entries:', error);
          uiManager.showFeedbackMessage('Failed to clear education entries', 'error');
        }
      }
    });

    clearExperienceBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all experience entries? This cannot be undone.')) {
        try {
          await DatabaseManager.updateField('experiences', []);
          uiManager.showFeedbackMessage('All experience entries cleared successfully');
          // Update experience list using the existing refresh function
          await refreshExperienceList();
        } catch (error) {
          console.error('Error clearing experience entries:', error);
          uiManager.showFeedbackMessage('Failed to clear experience entries', 'error');
        }
      }
    });

    wipeProfileBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to wipe your entire profile? This will delete ALL data and cannot be undone.')) {
        try {
          await DatabaseManager.updateField('coverLetters', []);
          await DatabaseManager.updateField('resumes', []);
          await DatabaseManager.updateField('skills', []);
          await DatabaseManager.updateField('education', []);
          await DatabaseManager.updateField('experience', []);
          await DatabaseManager.updateField('qa', []);
          await DatabaseManager.updateField('savedJobs', []);
          await DatabaseManager.updateField('appliedJobs', []);
          await DatabaseManager.updateField('activeCoverLetterId', null);
          await DatabaseManager.updateField('activeResumeId', null);
          await DatabaseManager.updateField('activeJobId', null);
          uiManager.showFeedbackMessage('Profile wiped successfully');
          refreshAllLists();
        } catch (error) {
          uiManager.showError('Failed to wipe profile: ' + error.message);
        }
      }
    });

    deleteAllJobsBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all saved jobs? This cannot be undone.')) {
        try {
          await DatabaseManager.updateField('savedJobs', []);
          await DatabaseManager.updateField('activeJobId', null);
          uiManager.updateJobsList([]);
          uiManager.showFeedbackMessage('All saved jobs deleted successfully');
        } catch (error) {
          uiManager.showError('Failed to delete saved jobs: ' + error.message);
        }
      }
    });

    deleteAllAppliedJobsBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all applied jobs? This cannot be undone.')) {
        try {
          await DatabaseManager.updateField('appliedJobs', []);
          appliedManager.refreshAppliedJobsList();
          uiManager.showFeedbackMessage('All applied jobs deleted successfully');
        } catch (error) {
          uiManager.showError('Failed to delete applied jobs: ' + error.message);
        }
      }
    });

    // Assess job button handler
    const assessJobButton = document.getElementById('assessJobButton');
    assessJobButton.addEventListener('click', async function() {
      uiManager.hideError();
      const restoreButton = uiManager.showLoadingState(this);

      try {
        let selectedText = '';
        let currentTab = null;
        
        // Get the current tab regardless of assessment method
        try {
          [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        } catch (error) {
          console.warn('Could not get current tab:', error);
        }
        
        // If we have text from context menu, use that
        if (window.jobTextToAssess) {
          selectedText = window.jobTextToAssess;
          window.jobTextToAssess = null; // Clear it after use
        } else {
          // Otherwise get selected text from the page
          if (!currentTab) {
            throw new Error('No active tab found');
          }

          // Check if content script is ready
          try {
            const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'isContentScriptReady' });
            if (!response?.ready) {
              throw new Error('Content script not ready');
            }
          } catch (error) {
            console.error('Content script check failed:', error);
            throw new Error('Please refresh the page and try again.');
          }

          // Get selected text using messaging
          const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'getSelectedText' });
          if (!response || !response.text) {
            throw new Error('Please select some text from the job posting first.');
          }
          selectedText = response.text;
        }

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
          jobLink: currentTab?.url || '',
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

    // Model selection handler
    const modelSelect = document.getElementById('geminiModel');
    modelSelect.addEventListener('change', async () => {
      try {
        await DatabaseManager.updateField('geminiModel', modelSelect.value);
        uiManager.showFeedbackMessage('Model preference saved!');
      } catch (error) {
        console.error('Error saving model preference:', error);
        uiManager.showError('Failed to save model preference');
      }
    });

    // Skills management handlers
    setupSkillsHandlers({
      skillsManager,
      uiManager
    });

    // Education management handlers
    setupEducationHandlers({
      educationManager,
      uiManager
    });

    // Limitations management handlers
    setupLimitationsHandlers({
      limitationsManager,
      uiManager
    });

    // Document management handlers
    setupDocumentHandlers({
      skillsManager,
      educationManager,
      uiManager,
      DatabaseManager
    });

    // Q&A document import handlers
    const importQAButton = document.getElementById('importQAButton');
    const qaImportModal = document.getElementById('qaImportModal');
    const selectQAFileButton = document.getElementById('selectQAFileButton');
    const qaFileInput = document.getElementById('qaFileInput');
    const confirmQAImportButton = document.getElementById('confirmQAImportButton');
    const cancelQAImportButton = document.getElementById('cancelQAImportButton');
    const qaSelectedFileName = document.getElementById('qaSelectedFileName');

    importQAButton.addEventListener('click', () => {
      qaImportModal.style.display = 'block';
      qaFileInput.value = '';
      qaSelectedFileName.textContent = 'No file selected';
      confirmQAImportButton.disabled = true;
    });

    selectQAFileButton.addEventListener('click', () => {
      qaFileInput.click();
    });

    qaFileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (file) {
        qaSelectedFileName.textContent = file.name;
        confirmQAImportButton.disabled = false;
      } else {
        qaSelectedFileName.textContent = 'No file selected';
        confirmQAImportButton.disabled = true;
      }
    });

    confirmQAImportButton.addEventListener('click', async () => {
      const file = qaFileInput.files[0];
      if (!file) return;

      const restoreButton = uiManager.showLoadingState(confirmQAImportButton);
      
      try {
        // Get API key
        const apiKey = await DatabaseManager.getField('geminiApiKey');
        if (!apiKey) {
          throw new Error('API Key is required. Please add it in the Settings tab.');
        }

        // Convert DOCX to text using mammoth
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;

        if (!text || text.trim().length === 0) {
          throw new Error('No text could be extracted from the document');
        }

        console.log('Starting QA document processing...');
        
        // Process the document text
        const processedQA = await DocumentProcessor.processQADocument(text, apiKey);
        
        console.log('Document processed successfully:', processedQA);
        
        if (!processedQA.qa_pairs || processedQA.qa_pairs.length === 0) {
          throw new Error('No question-answer pairs were found in the document');
        }

        // Add each QA pair to the database
        for (const pair of processedQA.qa_pairs) {
          await DatabaseManager.addQAPair(pair);
        }
        
        // Close the modal
        qaImportModal.style.display = 'none';
        
        // Show success message
        uiManager.showFeedbackMessage(`Successfully imported ${processedQA.qa_pairs.length} Q&A pairs!`);
        
        // Update the QA count display
        qaManager.updateQACount();
      } catch (error) {
        console.error('Error processing document:', error);
        uiManager.showError(error.message || 'Failed to process document. Please try again.');
      } finally {
        restoreButton();
      }
    });

    cancelQAImportButton.addEventListener('click', () => {
      qaImportModal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
      if (event.target === qaImportModal) {
        qaImportModal.style.display = 'none';
      }
    });

    // Cover Letter Generation Handlers
    const generateFreshCoverLetterBtn = document.getElementById('generateFreshCoverLetter');
    const modifyCurrentCoverLetterBtn = document.getElementById('modifyCurrentCoverLetter');
    const copyToClipboardBtn = document.getElementById('copyToClipboard');
    const generatedCoverLetterContent = document.getElementById('generatedCoverLetterContent');
    const noCoverLetterWarning = document.getElementById('noCoverLetterWarning');
    const coverLetterContent = document.getElementById('coverLetterContent');

    // Check for cover letter content when tab is shown
    document.querySelector('[data-tab="cover"]').addEventListener('click', updateModifyButtonVisibility);

    // Check after document load
    updateModifyButtonVisibility();

    generateFreshCoverLetterBtn.addEventListener('click', async () => {
      const restoreButton = uiManager.showLoadingState(generateFreshCoverLetterBtn, 'Generating...');
      try {
        // First check if we have a current assessment or selected job
        let currentJob = window.currentAssessment;
        if (!currentJob) {
          // Try to get the selected job as fallback
          const activeJobId = await DatabaseManager.getField('activeJobId');
          const savedJobs = await DatabaseManager.getField('savedJobs') || [];
          currentJob = savedJobs.find(j => j.id === activeJobId);
          
          if (!currentJob) {
            uiManager.showError('Please assess a job posting or select a saved job first.');
            return;
          }
        }

        const skills = await DatabaseManager.getField('skills') || [];
        const resumeText = await DatabaseManager.getField('resumeText');
        
        if (!resumeText) {
          uiManager.showError('Please select a resume first. The AI needs your resume to create a targeted letter.');
          return;
        }

        // Get selected options
        const paragraphCount = document.querySelector('input[name="paragraphCount"]:checked').value;
        const tone = document.querySelector('input[name="letterTone"]:checked').value;
        const includeResume = document.querySelector('input[name="includeResume"]').checked;
        const includeExperience = document.querySelector('input[name="includeExperience"]').checked;
        const includeEducation = document.querySelector('input[name="includeEducation"]').checked;
        const includeSkills = document.querySelector('input[name="includeSkills"]').checked;

        const options = {
          paragraphCount: parseInt(paragraphCount),
          tone: tone,
          includeResume: includeResume,
          includeExperience: includeExperience,
          includeEducation: includeEducation,
          includeSkills: includeSkills
        };

        const result = await coverLetterManager.generateCoverLetter(currentJob.jobText, skills, options, resumeText);
        
        document.getElementById('generatedCoverLetterContent').value = result.coverLetterText;
        document.getElementById('aiExplanation').textContent = result.explanation;
        document.querySelector('.generated-cover-letter').style.display = 'block';
        document.getElementById('modifyCurrentCoverLetter').style.display = 'block';
      } catch (error) {
        uiManager.showError(error.message);
      } finally {
        restoreButton();
      }
    });

    modifyCurrentCoverLetterBtn.addEventListener('click', async () => {
      const restoreButton = uiManager.showLoadingState(modifyCurrentCoverLetterBtn, 'Modifying...');
      try {
        // First check if we have a current assessment or selected job
        let currentJob = window.currentAssessment;
        if (!currentJob) {
          // Try to get the selected job as fallback
          const activeJobId = await DatabaseManager.getField('activeJobId');
          const savedJobs = await DatabaseManager.getField('savedJobs') || [];
          currentJob = savedJobs.find(j => j.id === activeJobId);
          
          if (!currentJob) {
            uiManager.showError('Please assess a job posting or select a saved job first.');
            return;
          }
        }

        const skills = await DatabaseManager.getField('skills') || [];
        const resumeText = await DatabaseManager.getField('resumeText');
        const currentCoverLetter = document.getElementById('generatedCoverLetterContent').value;

        // Get selected options
        const paragraphCount = document.querySelector('input[name="paragraphCount"]:checked').value;
        const tone = document.querySelector('input[name="letterTone"]:checked').value;
        const includeResume = document.querySelector('input[name="includeResume"]').checked;
        const includeExperience = document.querySelector('input[name="includeExperience"]').checked;
        const includeEducation = document.querySelector('input[name="includeEducation"]').checked;
        const includeSkills = document.querySelector('input[name="includeSkills"]').checked;

        const options = {
          paragraphCount: parseInt(paragraphCount),
          tone: tone,
          includeResume: includeResume,
          includeExperience: includeExperience,
          includeEducation: includeEducation,
          includeSkills: includeSkills
        };

        const result = await coverLetterManager.generateCoverLetter(
          currentJob.jobText, 
          skills, 
          options,
          resumeText,
          currentCoverLetter
        );
        
        document.getElementById('generatedCoverLetterContent').value = result.coverLetterText;
        document.getElementById('aiExplanation').textContent = result.explanation;
        document.querySelector('.generated-cover-letter').style.display = 'block';
      } catch (error) {
        uiManager.showError(error.message);
      } finally {
        restoreButton();
      }
    });

    copyToClipboardBtn.addEventListener('click', function() {
      const textToCopy = generatedCoverLetterContent.value;
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy)
          .then(() => {
            uiManager.showFeedbackMessage('Cover letter copied to clipboard!');
          })
          .catch(err => {
            console.error('Failed to copy text:', err);
            uiManager.showError('Failed to copy to clipboard. Please try again.');
          });
      }
    });

    // Update cover letter UI when job changes
    document.addEventListener('jobSelected', function() {
      const currentJob = window.currentAssessment;
      if (currentJob) {
        noCoverLetterWarning.style.display = 'none';
      } else {
        noCoverLetterWarning.style.display = 'block';
      }
    });

    // Show modify button only when a cover letter is selected
    document.getElementById('coverLetterSelect').addEventListener('change', function() {
      if (coverLetterContent.value) {
        modifyCurrentCoverLetterBtn.style.display = 'block';
      } else {
        modifyCurrentCoverLetterBtn.style.display = 'none';
      }
    });

    // Enhance resume button handler
    const enhanceResumeButton = document.getElementById('enhanceResumeButton');
    enhanceResumeButton.addEventListener('click', async () => {
      try {
        // First check if we have a current assessment or selected job
        let currentJob = window.currentAssessment;
        if (!currentJob) {
          // Try to get the selected job as fallback
          const activeJobId = await DatabaseManager.getField('activeJobId');
          const savedJobs = await DatabaseManager.getField('savedJobs') || [];
          currentJob = savedJobs.find(j => j.id === activeJobId);
          
          if (!currentJob) {
            uiManager.showError('Please assess a job posting or select a saved job first.');
            return;
          }
        }

        // Get the current resume
        const activeResumeId = await DatabaseManager.getField('activeResumeId');
        const resumes = await DatabaseManager.getField('resumes') || [];
        const activeResume = resumes.find(r => r.id === activeResumeId);
        
        if (!activeResume || !activeResume.textContent) {
          uiManager.showError('Please select a resume first.');
          return;
        }

        // Get the API key
        const apiKey = await DatabaseManager.getField('geminiApiKey');
        if (!apiKey) {
          uiManager.showError('API Key is required. Please add it in the Settings tab.');
          return;
        }

        // Show loading state
        const restoreButton = uiManager.showLoadingState(enhanceResumeButton, 'Enhancing...');

        // Get enhancement options
        const options = {
          enhancementMode: document.querySelector('input[name="enhancementMode"]:checked').value,
          resumeLength: document.querySelector('input[name="resumeLength"]:checked').value,
          includeSkills: document.querySelector('input[name="includeSkills"]').checked,
          includeEducation: document.querySelector('input[name="includeEducation"]').checked,
          includeExperience: document.querySelector('input[name="includeExperience"]').checked
        };

        // Validate options for major rewrite
        if (options.enhancementMode === 'major' && 
            (!options.includeSkills || !options.includeEducation || !options.includeExperience)) {
          uiManager.showError('Major rewrite requires all sections (Skills, Education, Experience) to be included.');
          return;
        }

        // Get user data
        const [skills, education, experiences] = await Promise.all([
          DatabaseManager.getField('skills') || [],
          DatabaseManager.getField('education') || [],
          DatabaseManager.getField('experiences') || []
        ]);

        // Call AI to enhance resume
        const result = await AIHelper.enhanceResume(
          activeResume.textContent,
          currentJob.jobText,
          options,
          skills,
          education,
          experiences,
          apiKey
        );

        if (!result || !result.enhanced_resume) {
          throw new Error('Failed to enhance resume. Please try again.');
        }

        // Show the enhanced resume in a modal for review
        const modalContent = `
          <div class="enhanced-resume-preview">
            <h4>Enhanced Resume (${result.word_count} words)</h4>
            
            <div class="save-options" style="margin-bottom: 15px;">
              <label>
                <input type="radio" name="saveOption" value="overwrite" checked>
                Overwrite current resume
              </label>
              <label>
                <input type="radio" name="saveOption" value="new">
                Save as new resume
              </label>
              <div class="new-resume-name" style="display: none; margin-top: 10px;">
                <input type="text" id="newResumeName" class="form-input" 
                       placeholder="Enter name for new resume" 
                       style="width: 100%; padding: 8px; margin-bottom: 5px;">
              </div>
            </div>

            <div class="preview-section">
              <textarea class="enhanced-text" style="width: 100%; height: 300px; margin-bottom: 15px;">${result.enhanced_resume}</textarea>
            </div>
            <div class="changes-section">
              <h4>Changes Made</h4>
              <ul>
                ${result.changes_made.map(change => `<li>${change}</li>`).join('')}
              </ul>
              <h4>Keywords Added</h4>
              <ul>
                ${result.keywords_added.map(keyword => `<li>${keyword}</li>`).join('')}
              </ul>
            </div>
          </div>
        `;

        const modalActions = `
          <button class="confirm-button primary-button">Apply Changes</button>
          <button class="cancel-button secondary-button">Cancel</button>
        `;

        const modal = uiManager.showModal('Enhanced Resume Preview', modalContent, modalActions);

        // Setup modal handlers
        const confirmButton = modal.querySelector('.confirm-button');
        const cancelButton = modal.querySelector('.cancel-button');
        const saveOptions = modal.querySelectorAll('input[name="saveOption"]');
        const newResumeNameContainer = modal.querySelector('.new-resume-name');
        const newResumeNameInput = modal.querySelector('#newResumeName');

        // Show/hide new resume name input based on save option
        saveOptions.forEach(option => {
          option.addEventListener('change', () => {
            newResumeNameContainer.style.display = 
              option.value === 'new' ? 'block' : 'none';
            
            if (option.value === 'new' && !newResumeNameInput.value) {
              // Set a default name based on current resume
              const currentResume = document.querySelector('#resumeSelect option:checked');
              if (currentResume && currentResume.text) {
                newResumeNameInput.value = `${currentResume.text} - Enhanced`;
              } else {
                newResumeNameInput.value = 'Enhanced Resume';
              }
            }
          });
        });

        confirmButton.addEventListener('click', async () => {
          const restoreButton = uiManager.showLoadingState(confirmButton, 'Applying...');

          try {
            const saveOption = modal.querySelector('input[name="saveOption"]:checked').value;
            
            if (saveOption === 'new') {
              const newName = newResumeNameInput.value.trim();
              if (!newName) {
                throw new Error('Please enter a name for the new resume');
              }
              
              // Create new resume
              const newId = await DatabaseManager.addResume(newName, 'text', null);
              await DatabaseManager.updateResumeText(newId, result.enhanced_resume);
              
              // Set as active resume
              await DatabaseManager.setActiveResume(newId);
              
              // Refresh resume list and select new resume
              await loadResumes({ DatabaseManager });
              document.getElementById('resumeSelect').value = newId;
            } else {
              // Overwrite existing resume
              await DatabaseManager.updateResumeText(activeResumeId, result.enhanced_resume);
            }
            
            // Update the display
            document.getElementById('resumeContent').value = result.enhanced_resume;
            
            // Update current resume display in header
            await uiManager.updateCurrentResumeDisplay();
            
            uiManager.showFeedbackMessage('Resume enhanced successfully!');
            modal.remove();
            restoreButton(); // Reset the enhance button state
          } catch (error) {
            uiManager.showError('Failed to apply changes: ' + error.message);
          } finally {
            if (restoreButton) restoreButton(); // Add null check
          }
        });

        cancelButton.addEventListener('click', () => {
          modal.remove();
          restoreButton(); // Reset the enhance button state
        });

      } catch (error) {
        console.error('Error enhancing resume:', error);
        uiManager.showError(error.message);
      } finally {
        if (!document.querySelector('.modal')) { // Only restore if modal isn't showing
          restoreButton();
        }
      }
    });
  }

  function setupSkillsHandlers({ skillsManager, uiManager }) {
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

  function setupEducationHandlers({ educationManager, uiManager }) {
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

  function setupLimitationsHandlers({ limitationsManager, uiManager }) {
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

  function setupDocumentHandlers({ skillsManager, educationManager, uiManager, DatabaseManager }) {
    const resumeSelect = document.getElementById('resumeSelect');
    resumeSelect.addEventListener('change', async (e) => {
      const id = e.target.value;
      try {
        if (id) {
          const resumes = await DatabaseManager.getField('resumes');
          const resume = resumes.find(r => r.id === id);
          if (resume) {
            document.getElementById('resumeContent').value = resume.textContent;
            document.getElementById('removeResumeButton').style.display = 'block';
            document.getElementById('extractSkillsButton').style.display = 'block';
            await DatabaseManager.updateField('activeResumeId', id);
            // Update resumeText in database for keyword matching
            await DatabaseManager.updateField('resumeText', resume.textContent);
            // Trigger keyword matching update
            uiManager.updateKeywordMatches();
            await uiManager.updateCurrentResumeDisplay();
          }
        } else {
          document.getElementById('resumeContent').value = '';
          document.getElementById('removeResumeButton').style.display = 'none';
          document.getElementById('extractSkillsButton').style.display = 'none';
          await DatabaseManager.updateField('activeResumeId', null);
          // Clear resumeText when no resume is selected
          await DatabaseManager.updateField('resumeText', '');
          // Trigger keyword matching update
          uiManager.updateKeywordMatches();
          await uiManager.updateCurrentResumeDisplay();
        }
      } catch (error) {
        console.error('Error handling resume selection:', error);
      }
    });

    // Resume handlers
    const resumeContent = document.getElementById('resumeContent');
    const uploadResumeButton = document.getElementById('uploadResumeButton');
    const resumeFileInput = document.getElementById('resumeFileInput');
    const removeResumeButton = document.getElementById('removeResumeButton');
    const extractSkillsButton = document.getElementById('extractSkillsButton');
    const enhanceResumeButton = document.getElementById('enhanceResumeButton');

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
    loadResumes({ DatabaseManager });
    loadCoverLetters({ DatabaseManager });

    let currentUploadType = null;
    let currentFile = null;

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
        await loadResumes({ DatabaseManager });
        resumeContent.value = '';
        removeResumeButton.style.display = 'none';
        document.getElementById('extractSkillsButton').style.display = 'none';
        await uiManager.updateCurrentResumeDisplay();
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
        await loadCoverLetters({ DatabaseManager });
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
            // Only store the text content
            const id = await DatabaseManager.addResume(documentTitle.value.trim(), result.value);
            console.log('Resume added with ID:', id);
            
            // Refresh the resumes list
            await loadResumes({ DatabaseManager });
            console.log('Resumes list refreshed');
            
            // Set the new resume as active
            resumeSelect.value = id;
            resumeContent.value = result.value;
            removeResumeButton.style.display = 'block';
            document.getElementById('extractSkillsButton').style.display = 'block';
            await DatabaseManager.setActiveResume(id);
            await DatabaseManager.updateField('resumeText', result.value);
            await uiManager.updateCurrentResumeDisplay();
            console.log('New resume set as active:', id);
          } else {
            console.log('Adding new cover letter...');
            // Only store the text content
            const id = await DatabaseManager.addCoverLetter(documentTitle.value.trim(), result.value);
            console.log('Cover letter added with ID:', id);
            
            // Refresh the cover letters list
            await loadCoverLetters({ DatabaseManager });
            console.log('Cover letters list refreshed');
            
            // Set the new cover letter as active
            coverLetterSelect.value = id;
            coverLetterContent.value = result.value;
            removeCoverLetterButton.style.display = 'block';
            await DatabaseManager.setActiveCoverLetter(id);
            updateModifyButtonVisibility();
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

        // Get API key
        const apiKey = await DatabaseManager.getField('geminiApiKey');
        if (!apiKey) {
          throw new Error('API Key is required. Please add it in the Settings tab.');
        }

        // Extract skills and education
        console.log('Sending resume text to AI for analysis:', resume.textContent.substring(0, 100) + '...');
        const response = await chrome.runtime.sendMessage({
          action: 'extractSkillsAndEducation',
          text: resume.textContent,
          apiKey: apiKey
        });

        console.log('Raw AI response:', response);
        
        if (response.error) {
          throw new Error(response.error);
        }

        // Verify the structure of the response
        if (!response.skills || !response.education || !response.experiences) {
          console.error('Incomplete response structure:', response);
          throw new Error('AI response is missing required data');
        }

        console.log('Processed response:', {
          skillsCount: response.skills.length,
          educationCount: response.education.length,
          experiencesCount: response.experiences?.length || 0
        });

        // Show modal with extracted items
        const modal = uiManager.showModal(
          'Extracted Skills & Education',
          createAnalysisModalContent(response),
          createAnalysisModalActions()
        );

        // Setup handlers for the modal
        setupAnalysisModalHandlers(modal, response);

      } catch (error) {
        console.error('Error extracting data:', error);
        uiManager.showError('Error extracting data: ' + error.message);
      } finally {
        // Reset button state
        extractSkillsButton.disabled = false;
        extractSkillsButton.textContent = 'Extract Skills, Education & Experience';
      }
    });
  }

  async function loadResumes({ DatabaseManager }) {
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
          // Update resumeText in database for keyword matching
          await DatabaseManager.updateField('resumeText', resume.textContent);
          // Trigger keyword matching update
          uiManager.updateKeywordMatches();
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

  async function loadCoverLetters({ DatabaseManager }) {
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

  function formatDate(dateString, inProgress) {
    if (inProgress) return 'Present';
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      // Format as MMM YYYY (e.g., "Jan 2022")
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    } catch (e) {
      console.error('Date formatting error:', e);
      return 'N/A';
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
                    ${formatDate(edu.startDate)} - ${formatDate(edu.endDate, edu.inProgress)}
                  </div>
                </div>
              </label>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="analysis-section">
        <h3>Experience Found (${analysis.experiences.length})</h3>
        <div class="experience-toggles">
          ${analysis.experiences.map((exp, i) => `
            <div class="experience-toggle">
              <label>
                <input type="checkbox" class="experience-checkbox" data-index="${i}" checked>
                <div class="experience-details">
                  <strong>${exp.title}</strong>
                  <div>${exp.company}</div>
                  ${exp.location ? `<div>${exp.location}</div>` : ''}
                  <div class="experience-dates">
                    ${formatDate(exp.startDate)} - ${formatDate(exp.endDate, exp.inProgress)}
                  </div>
                  ${exp.description ? `<div class="experience-description">${exp.description}</div>` : ''}
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
          
        const selectedExperiences = [...modal.querySelectorAll('.experience-checkbox:checked')]
          .map(checkbox => analysis.experiences[parseInt(checkbox.dataset.index)])
          .filter(exp => exp);

        console.log('Selected items:', {
          skills: selectedSkills,
          education: selectedEducation,
          experiences: selectedExperiences
        });

        const replaceExisting = modal.querySelector('#replaceExisting').checked;
        console.log('Replace existing:', replaceExisting);

        // Add these individual try-catch blocks to isolate where the failure might be
        try {
          await skillsManager.addExtractedSkills(selectedSkills, replaceExisting);
          console.log('Skills added successfully');
        } catch (error) {
          console.error('Error adding skills:', error);
        }

        try {
          await educationManager.addExtractedEducation(selectedEducation, replaceExisting);
          console.log('Education added successfully');
        } catch (error) {
          console.error('Error adding education:', error);
        }

        try {
          await experienceManager.addExtractedExperiences(selectedExperiences, replaceExisting);
          console.log('Experiences added successfully');
        } catch (error) {
          console.error('Error adding experiences:', error);
        }

        await refreshAllLists();
        uiManager.showFeedbackMessage('Resume analysis applied successfully!');
        modal.remove();
      } catch (error) {
        uiManager.showFeedbackMessage(error.message, 'error');
      } finally {
        if (restoreButton) restoreButton(); // Add null check
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
      
      // Update the jobs list in the UI
      uiManager.updateJobsList(savedJobs);
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

  // Profile Management
  async function initializeProfileUI() {
    const profileSelect = document.getElementById('profileSelect');
    const profileName = document.getElementById('profileName');
    const saveProfileNameButton = document.getElementById('saveProfileNameButton');
    const currentProfileName = document.getElementById('currentProfileName');

    // Get current profiles
    const { profiles } = await DatabaseManager.getRawStorage();
    const activeProfile = await DatabaseManager.getActiveProfile();

    // Populate profile selector
    profileSelect.innerHTML = profiles.map(p => 
      `<option value="${p.id}" ${p.isActive ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    // Set current profile name in header
    currentProfileName.textContent = activeProfile.name;

    // Set current profile name in input
    profileName.value = activeProfile.name;

    // Handle profile switching
    profileSelect.addEventListener('change', async (e) => {
      const newProfileId = e.target.value;
      const newActiveProfile = await DatabaseManager.switchProfile(newProfileId);
      
      // Update UI
      currentProfileName.textContent = newActiveProfile.name;
      profileName.value = newActiveProfile.name;
      
      // Clear all current displays
      clearAllDisplays();
      
      // Refresh all data displays
      await refreshAllData();

      // Show profile switch message
      const modal = uiManager.showModal(
        'Profile Switched',
        `<p>Successfully switched to profile "${newActiveProfile.name}".</p>
         <p>The extension will now close. Please reopen it to ensure all data is properly loaded.</p>`,
        `<button class="primary-button confirm-button">OK</button>`
      );

      // Close extension when user clicks OK
      modal.querySelector('.confirm-button').addEventListener('click', () => {
        window.close();
      });
    });

    // Handle profile name saving
    saveProfileNameButton.addEventListener('click', async () => {
      const newName = profileName.value.trim();
      if (newName) {
        await DatabaseManager.updateProfileName(activeProfile.id, newName);
        
        // Update UI
        currentProfileName.textContent = newName;
        const option = profileSelect.querySelector(`option[value="${activeProfile.id}"]`);
        if (option) {
          option.textContent = newName;
        }
        uiManager.showFeedbackMessage('Profile name updated successfully!');
      }
    });
  }

  function clearAllDisplays() {
    // Clear resume displays
    document.getElementById('resumeContent').value = '';
    document.getElementById('removeResumeButton').style.display = 'none';
    document.getElementById('extractSkillsButton').style.display = 'none';
    document.getElementById('resumeSelect').innerHTML = '<option value="">Select a resume...</option>';
    
    // Clear cover letter displays
    document.getElementById('coverLetterContent').value = '';
    document.getElementById('removeCoverLetterButton').style.display = 'none';
    document.getElementById('coverLetterSelect').innerHTML = '<option value="">Select a cover letter...</option>';
    
    // Clear skills list
    document.getElementById('skillsList').innerHTML = '';
    
    // Clear education list
    document.getElementById('educationList').innerHTML = '';
    
    // Clear limitations list
    document.getElementById('limitationsList').innerHTML = '';
    
    // Clear saved jobs list
    document.getElementById('savedJobsList').innerHTML = '';
    
    // Clear current selections in header
    document.getElementById('currentResumeName').textContent = 'None selected';
    document.getElementById('currentJobName').textContent = 'None selected';
    
    // Clear API key
    document.getElementById('geminiApiKey').value = '';
    
    // Clear any assessment results
    document.getElementById('assessmentResults').style.display = 'none';
    document.getElementById('keywordList').innerHTML = '';
  }

  async function refreshAllData() {
    try {
      // Refresh all lists
      const [skills, education, limitations, savedJobs] = await Promise.all([
        DatabaseManager.getField('skills'),
        DatabaseManager.getField('education'),
        DatabaseManager.getField('limitations'),
        DatabaseManager.getField('savedJobs')
      ]);

      // Update UI with new data
      uiManager.updateSkillsList(skills || []);
      uiManager.updateEducationList(education || []);
      uiManager.updateLimitationsList(limitations || []);
      uiManager.updateJobsList(savedJobs || []);

      // Refresh documents
      await Promise.all([
        loadResumes({ DatabaseManager }),
        loadCoverLetters({ DatabaseManager })
      ]);

      // Update current selections
      await Promise.all([
        uiManager.updateCurrentResumeDisplay(),
        uiManager.updateCurrentJobDisplay()
      ]);

      // Refresh API key
      const apiKey = await DatabaseManager.getField('geminiApiKey');
      document.getElementById('geminiApiKey').value = apiKey || '';
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }

  // Experience tab functionality
  function initializeExperienceTab(experienceManager) {
    const addExperienceButton = document.getElementById('addExperienceButton');
    const experienceModal = document.getElementById('experienceModal');
    const saveExperienceButton = document.getElementById('saveExperienceButton');
    const cancelExperienceButton = document.getElementById('cancelExperienceButton');
    const experienceInProgress = document.getElementById('experienceInProgress');
    const experienceEndDate = document.getElementById('experienceEndDate');

    addExperienceButton.addEventListener('click', () => {
      editingIndex = null;
      document.getElementById('experienceModalTitle').textContent = 'Add Experience';
      resetExperienceForm();
      experienceModal.style.display = 'block';
    });

    cancelExperienceButton.addEventListener('click', () => {
      experienceModal.style.display = 'none';
    });

    experienceInProgress.addEventListener('change', (e) => {
      experienceEndDate.disabled = e.target.checked;
      if (e.target.checked) {
        experienceEndDate.value = '';
      }
    });

    saveExperienceButton.addEventListener('click', async () => {
      try {
        const experienceData = {
          type: document.getElementById('experienceType').value,
          title: document.getElementById('experienceTitle').value,
          company: document.getElementById('experienceCompany').value,
          location: document.getElementById('experienceLocation').value,
          startDate: document.getElementById('experienceStartDate').value,
          endDate: experienceInProgress.checked ? null : document.getElementById('experienceEndDate').value,
          inProgress: experienceInProgress.checked,
          description: document.getElementById('experienceDescription').value,
          linkedSkills: Array.from(document.querySelectorAll('#experienceSkillsList input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value)
        };

        if (editingIndex !== null) {
          await experienceManager.updateExperience(editingIndex, experienceData);
        } else {
          await experienceManager.addExperience(experienceData);
        }

        experienceModal.style.display = 'none';
        await Promise.all([
          refreshExperienceList(),
          refreshSkillsList()
        ]);
        showFeedback('Experience saved successfully');
      } catch (error) {
        showFeedback(error.message, true);
      }
    });

    // Initialize the experience list
    refreshExperienceList();
  }

  async function refreshExperienceList() {
    const experienceItems = document.getElementById('experienceItems');
    const experiences = await experienceManager.getAllExperiences();
    const skills = await DatabaseManager.getField('skills') || [];

    experienceItems.innerHTML = '';

    experiences.forEach((exp, index) => {
      const experienceElement = document.createElement('div');
      experienceElement.className = 'experience-item';
      
      const dateRange = exp.inProgress 
        ? `${formatDate(exp.startDate)} - Present`
        : `${formatDate(exp.startDate)} - ${formatDate(exp.endDate)}`;

      experienceElement.innerHTML = `
        <div class="experience-item-header">
          <div>
            <h3 class="experience-item-title">${exp.title}</h3>
            <div class="experience-item-company">${exp.company}</div>
            <div class="experience-item-dates">${dateRange}</div>
            ${exp.location ? `<div class="experience-item-location">${exp.location}</div>` : ''}
          </div>
          <div class="experience-item-actions">
            <button class="edit-experience secondary-button">Edit</button>
            <button class="remove-experience danger-button">Remove</button>
          </div>
        </div>
        <div class="experience-item-description">${exp.description}</div>
        <div class="experience-item-skills">
          ${(exp.linkedSkills || []).map(skill => `
            <span class="skill-tag">${skill}</span>
          `).join('')}
        </div>
      `;

      experienceElement.querySelector('.edit-experience').addEventListener('click', () => {
        editingIndex = index;
        document.getElementById('experienceModalTitle').textContent = 'Edit Experience';
        populateExperienceForm(exp);
        document.getElementById('experienceModal').style.display = 'block';
      });

      experienceElement.querySelector('.remove-experience').addEventListener('click', async () => {
        if (confirm('Are you sure you want to remove this experience?')) {
          await experienceManager.removeExperience(index);
          await Promise.all([
            refreshExperienceList(),
            refreshSkillsList()
          ]);
          showFeedback('Experience removed successfully');
        }
      });

      experienceItems.appendChild(experienceElement);
    });

    // Update skills list in modal
    const skillsList = document.getElementById('experienceSkillsList');
    skillsList.innerHTML = skills.map(skill => `
      <label class="skill-checkbox">
        <input type="checkbox" value="${skill.skill}">
        ${skill.skill}
      </label>
    `).join('');
  }

  function resetExperienceForm() {
    document.getElementById('experienceType').value = 'job';
    document.getElementById('experienceTitle').value = '';
    document.getElementById('experienceCompany').value = '';
    document.getElementById('experienceLocation').value = '';
    document.getElementById('experienceStartDate').value = '';
    document.getElementById('experienceEndDate').value = '';
    document.getElementById('experienceInProgress').checked = false;
    document.getElementById('experienceEndDate').disabled = false;
    document.getElementById('experienceDescription').value = '';
    
    const checkboxes = document.querySelectorAll('#experienceSkillsList input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = false);
  }

  function populateExperienceForm(experience) {
    document.getElementById('experienceType').value = experience.type;
    document.getElementById('experienceTitle').value = experience.title;
    document.getElementById('experienceCompany').value = experience.company;
    document.getElementById('experienceLocation').value = experience.location || '';
    document.getElementById('experienceStartDate').value = experience.startDate;
    document.getElementById('experienceEndDate').value = experience.endDate || '';
    document.getElementById('experienceInProgress').checked = experience.inProgress;
    document.getElementById('experienceEndDate').disabled = experience.inProgress;
    document.getElementById('experienceDescription').value = experience.description || '';

    const checkboxes = document.querySelectorAll('#experienceSkillsList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = (experience.linkedSkills || []).includes(checkbox.value);
    });
  }

  function formatDate(dateString, inProgress) {
    if (inProgress) return 'Present';
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      // Format as MMM YYYY (e.g., "Jan 2022")
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    } catch (e) {
      console.error('Date formatting error:', e);
      return 'N/A';
    }
  }

  // Update the skills tab to show linked experiences
  async function refreshSkillsList() {
    // ... existing skill list refresh code ...
    
    const skills = await DatabaseManager.getField('skills') || [];
    const skillsList = document.getElementById('skillsList');
    
    skillsList.innerHTML = '';
    
    for (const skill of skills) {
      const linkedExperiences = await experienceManager.getExperiencesForSkill(skill.skill);
      
      const skillElement = document.createElement('div');
      skillElement.className = 'skill-item';
      skillElement.innerHTML = `
        <div class="skill-info">
          <div class="skill-content">
            <span class="skill-name">${skill.skill}</span>
            <span class="skill-details">
              ${skill.level}${skill.yearsExperience ? `, ${skill.yearsExperience}yrs` : ''}
            </span>
            ${linkedExperiences.length > 0 ? `
              <div class="linked-experiences">
                Used in: ${linkedExperiences.map(exp => exp.title).join(', ')}
              </div>
            ` : ''}
          </div>
          <div class="skill-actions">
            <button class="edit-skill secondary-button">Edit</button>
            <button class="remove-skill danger-button">Remove</button>
          </div>
        </div>
      `;
      
      // ... existing skill event handlers ...
      
      skillsList.appendChild(skillElement);
    }
  }
});
