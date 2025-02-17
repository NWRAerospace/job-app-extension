// Q&A Manager Module
import { AIHelper } from '../utils/aiHelper.js';

export class QAManager {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.currentQAPair = null;
    this.updateQACount();
    this.setupMessageListener();
  }

  initializeElements() {
    // Search elements
    this.searchInput = document.getElementById('qaSearchInput');
    this.searchResults = document.getElementById('qaSearchResults');
    
    // Display elements
    this.selectedQuestion = document.getElementById('selectedQuestion');
    this.selectedAnswer = document.getElementById('selectedAnswer');
    this.copyButton = document.getElementById('copyAnswerButton');
    this.editButton = document.getElementById('editAnswerButton');
    this.generateAIButton = document.getElementById('generateAIAnswerButton');
    
    // Editor elements
    this.qaEditor = document.querySelector('.qa-editor');
    this.questionInput = document.getElementById('questionInput');
    this.answerInput = document.getElementById('answerInput');
    this.saveButton = document.getElementById('saveQAButton');
    this.cancelButton = document.getElementById('cancelQAButton');
    this.addNewButton = document.getElementById('addNewQAButton');
    this.generateAIEditorButton = document.getElementById('generateAIAnswerEditorButton');
    
    // Stats
    this.qaPairCount = document.getElementById('qaPairCount');
  }

  setupEventListeners() {
    // Search functionality
    this.searchInput.addEventListener('input', this.handleSearch.bind(this));
    this.searchResults.addEventListener('click', this.handleSearchResultClick.bind(this));
    
    // Button actions
    this.copyButton.addEventListener('click', this.copyAnswerToClipboard.bind(this));
    this.editButton.addEventListener('click', this.startEditing.bind(this));
    this.saveButton.addEventListener('click', this.saveQAPair.bind(this));
    this.cancelButton.addEventListener('click', this.cancelEditing.bind(this));
    this.addNewButton.addEventListener('click', this.startNewQAPair.bind(this));
    this.generateAIButton.addEventListener('click', () => this.generateAIAnswer(false));
    this.generateAIEditorButton.addEventListener('click', () => this.generateAIAnswer(true));

    // Listen for text selection on the page
    document.addEventListener('mouseup', this.handleTextSelection.bind(this));
  }

  setupMessageListener() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'searchQA') {
        this.handleExternalSearch(request.text);
      } else if (request.action === 'addNewQA') {
        this.handleExternalAdd(request.text);
      }
    });
  }

  async handleExternalSearch(text) {
    // Switch to Q&A tab if openQATab is true
    const qaTab = document.querySelector('[data-tab="qa"]');
    if (qaTab) {
      qaTab.click();
    }
    
    // Set search text and perform search
    this.searchInput.value = text;
    await this.handleSearch();
    
    // Ensure the search results are visible
    this.searchResults.classList.add('active');
  }

  handleExternalAdd(text) {
    // Switch to Q&A tab
    document.querySelector('[data-tab="qa"]').click();
    
    // Start new Q&A with the selected text as question
    this.startNewQAPair();
    this.questionInput.value = text;
  }

  displayNoResultsWithAdd(searchText) {
    this.searchResults.innerHTML = `
      <div class="qa-search-item no-results">
        No matching questions found
        <button class="add-as-new-button">Add as New Question</button>
      </div>
    `;
    
    const addButton = this.searchResults.querySelector('.add-as-new-button');
    addButton.addEventListener('click', () => {
      this.startNewQAPair();
      this.questionInput.value = searchText;
      this.searchResults.classList.remove('active');
    });
    
    this.searchResults.classList.add('active');
  }

  async handleSearch() {
    const query = this.searchInput.value.trim();
    if (!query) {
      this.searchResults.innerHTML = '';
      this.searchResults.classList.remove('active');
      return;
    }

    const results = await DatabaseManager.searchQAPairs(query);
    if (results.length === 0) {
      this.displayNoResultsWithAdd(query);
    } else {
      this.displaySearchResults(results);
    }
  }

  displaySearchResults(results) {
    this.searchResults.innerHTML = '';
    
    // Add search results
    results.forEach(result => {
      const div = document.createElement('div');
      div.className = 'qa-search-item';
      div.textContent = result.question;
      div.dataset.qaId = result.id;
      this.searchResults.appendChild(div);
    });
    
    // Always add the "Add as New Question" option
    const addNewDiv = document.createElement('div');
    addNewDiv.className = 'qa-search-item add-new-option';
    addNewDiv.innerHTML = `
      <span>Add as New Question:</span>
      <span class="new-question-text">"${this.searchInput.value.trim()}"</span>
      <button class="add-as-new-button">Add New</button>
    `;
    
    const addButton = addNewDiv.querySelector('.add-as-new-button');
    addButton.addEventListener('click', () => {
      this.startNewQAPair();
      this.questionInput.value = this.searchInput.value.trim();
      this.searchResults.classList.remove('active');
    });
    
    this.searchResults.appendChild(addNewDiv);
    this.searchResults.classList.add('active');
  }

  async handleSearchResultClick(event) {
    const item = event.target.closest('.qa-search-item');
    if (!item) return;

    const qaId = item.dataset.qaId;
    if (!qaId) return;

    const qaPairs = await DatabaseManager.getAllQAPairs();
    const selectedQA = qaPairs.find(qa => qa.id === qaId);
    
    if (selectedQA) {
      this.displayQAPair(selectedQA);
      this.searchResults.classList.remove('active');
      this.searchInput.value = '';
    }
  }

  displayQAPair(qaPair) {
    this.currentQAPair = qaPair;
    this.selectedQuestion.textContent = qaPair.question;
    this.selectedAnswer.textContent = qaPair.answer;
    this.copyButton.style.display = 'inline-block';
    this.editButton.style.display = 'inline-block';
    this.generateAIButton.style.display = 'inline-block';
    this.qaEditor.style.display = 'none';
  }

  async copyAnswerToClipboard() {
    if (this.currentQAPair) {
      try {
        await navigator.clipboard.writeText(this.currentQAPair.answer);
        // Show a brief success message
        const originalText = this.copyButton.textContent;
        this.copyButton.textContent = 'Copied!';
        setTimeout(() => {
          this.copyButton.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    }
  }

  startEditing() {
    if (this.currentQAPair) {
      this.questionInput.value = this.currentQAPair.question;
      this.answerInput.value = this.currentQAPair.answer;
    }
    this.qaEditor.style.display = 'block';
    this.selectedQuestion.textContent = '';
    this.selectedAnswer.textContent = '';
    this.copyButton.style.display = 'none';
    this.editButton.style.display = 'none';
    this.generateAIButton.style.display = 'none';
  }

  startNewQAPair() {
    this.currentQAPair = null;
    this.questionInput.value = '';
    this.answerInput.value = '';
    this.qaEditor.style.display = 'block';
    this.selectedQuestion.textContent = '';
    this.selectedAnswer.textContent = '';
    this.copyButton.style.display = 'none';
    this.editButton.style.display = 'none';
    this.generateAIButton.style.display = 'none';
  }

  async saveQAPair() {
    const question = this.questionInput.value.trim();
    const answer = this.answerInput.value.trim();
    
    if (!question || !answer) {
      alert('Both question and answer are required');
      return;
    }

    try {
      if (this.currentQAPair) {
        // Update existing Q&A pair
        await DatabaseManager.updateQAPair(this.currentQAPair.id, {
          question,
          answer
        });
      } else {
        // Add new Q&A pair
        const newQAPair = await DatabaseManager.addQAPair({
          question,
          answer
        });
        this.currentQAPair = newQAPair;
      }

      this.qaEditor.style.display = 'none';
      this.displayQAPair(this.currentQAPair);
      this.updateQACount();
    } catch (err) {
      console.error('Failed to save Q&A pair:', err);
      alert('Failed to save Q&A pair. Please try again.');
    }
  }

  cancelEditing() {
    this.qaEditor.style.display = 'none';
    if (this.currentQAPair) {
      this.displayQAPair(this.currentQAPair);
    } else {
      this.selectedQuestion.textContent = '';
      this.selectedAnswer.textContent = '';
      this.copyButton.style.display = 'none';
      this.editButton.style.display = 'none';
      this.generateAIButton.style.display = 'none';
    }
  }

  async handleTextSelection() {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      // Only search if the text is long enough to be a question
      if (selectedText.length > 10) {
        this.searchInput.value = selectedText;
        await this.handleSearch();
      }
    }
  }

  async updateQACount() {
    const qaPairs = await DatabaseManager.getAllQAPairs();
    this.qaPairCount.textContent = qaPairs.length;
  }

  setButtonLoadingState(button, isLoading) {
    if (isLoading) {
      button.disabled = true;
      button.originalText = button.textContent;
      button.innerHTML = `
        <span class="loading-spinner"></span>
        Generating Answer...
      `;
    } else {
      button.disabled = false;
      button.textContent = button.originalText;
    }
  }

  async generateAIAnswer(isEditing) {
    const button = isEditing ? this.generateAIEditorButton : this.generateAIButton;
    
    try {
      this.setButtonLoadingState(button, true);
      
      const apiKey = await DatabaseManager.getField('geminiApiKey');
      if (!apiKey) {
        alert('Please set your Gemini API key in the settings tab first.');
        return;
      }

      const question = isEditing ? this.questionInput.value : this.selectedQuestion.textContent;
      if (!question.trim()) {
        alert('Please enter a question first.');
        return;
      }

      // Get user's resume, skills, and education
      const resumeText = await DatabaseManager.getField('resumeText');
      const skills = await DatabaseManager.getField('skills') || [];
      const education = await DatabaseManager.getField('education') || [];

      if (!resumeText) {
        alert('Please upload a resume first.');
        return;
      }

      const response = await AIHelper.generateQAResponse(
        question,
        resumeText,
        skills,
        education,
        apiKey
      );

      if (response && response.answer) {
        if (isEditing) {
          this.answerInput.value = response.answer;
        } else {
          // Open editor with AI response
          this.startEditing();
          this.questionInput.value = question;
          this.answerInput.value = response.answer;
        }
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (error) {
      console.error('Failed to generate AI answer:', error);
      alert('Failed to generate AI answer. Please try again.');
    } finally {
      this.setButtonLoadingState(button, false);
    }
  }
} 