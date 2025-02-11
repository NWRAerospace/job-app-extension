// Q&A Manager Module
export class QAManager {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.currentQAPair = null;
    this.updateQACount();
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
    
    // Editor elements
    this.qaEditor = document.querySelector('.qa-editor');
    this.questionInput = document.getElementById('questionInput');
    this.answerInput = document.getElementById('answerInput');
    this.saveButton = document.getElementById('saveQAButton');
    this.cancelButton = document.getElementById('cancelQAButton');
    this.addNewButton = document.getElementById('addNewQAButton');
    
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

    // Listen for text selection on the page
    document.addEventListener('mouseup', this.handleTextSelection.bind(this));
  }

  async handleSearch() {
    const query = this.searchInput.value.trim();
    if (!query) {
      this.searchResults.innerHTML = '';
      this.searchResults.classList.remove('active');
      return;
    }

    const results = await DatabaseManager.searchQAPairs(query);
    this.displaySearchResults(results);
  }

  displaySearchResults(results) {
    this.searchResults.innerHTML = '';
    
    if (results.length === 0) {
      this.searchResults.innerHTML = '<div class="qa-search-item">No matching questions found</div>';
    } else {
      results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'qa-search-item';
        div.textContent = result.question;
        div.dataset.qaId = result.id;
        this.searchResults.appendChild(div);
      });
    }
    
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
      this.qaEditor.style.display = 'block';
    }
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
} 