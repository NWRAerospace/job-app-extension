export class ExportManager {
  constructor(databaseManager, uiManager) {
    this.db = databaseManager;
    this.ui = uiManager;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Handle all export button clicks
    document.querySelectorAll('[data-export]').forEach(button => {
      button.addEventListener('click', async (e) => {
        const exportType = e.target.dataset.export;
        await this.handleExport(exportType);
      });
    });

    // Handle profile import
    const importProfileButton = document.getElementById('importProfileButton');
    if (importProfileButton) {
      importProfileButton.addEventListener('click', () => {
        this.importProfile();
      });
    }
  }

  async handleExport(type) {
    try {
      switch (type) {
        case 'resumes':
          await this.exportResumes();
          break;
        case 'coverLetters':
          await this.exportCoverLetters();
          break;
        case 'savedJobs':
          await this.exportSavedJobs();
          break;
        case 'appliedJobs':
          await this.exportAppliedJobs();
          break;
        case 'skills':
          await this.exportSkills();
          break;
        case 'experience':
          await this.exportExperience();
          break;
        case 'education':
          await this.exportEducation();
          break;
        case 'qa':
          await this.exportQA();
          break;
        case 'all':
          await this.exportAllData();
          break;
      }
    } catch (error) {
      console.error('Export error:', error);
      this.ui.showError('Failed to export data: ' + error.message);
    }
  }

  async exportResumes() {
    const resumes = await this.db.getField('resumes') || [];
    let content = 'RESUMES\n\n';
    
    for (const resume of resumes) {
      content += `Title: ${resume.name}\n`;
      content += `Date Added: ${new Date(resume.dateAdded).toLocaleDateString()}\n`;
      content += `Content:\n${resume.textContent}\n\n`;
      content += '-------------------\n\n';
    }

    await this.saveToFile(content, 'resumes.txt');
  }

  async exportCoverLetters() {
    const coverLetters = await this.db.getField('coverLetters') || [];
    let content = 'COVER LETTERS\n\n';
    
    for (const letter of coverLetters) {
      content += `Title: ${letter.name}\n`;
      content += `Date Added: ${new Date(letter.dateAdded).toLocaleDateString()}\n`;
      content += `Content:\n${letter.textContent}\n\n`;
      content += '-------------------\n\n';
    }

    await this.saveToFile(content, 'cover_letters.txt');
  }

  async exportSavedJobs() {
    const savedJobs = await this.db.getField('savedJobs') || [];
    const includeDescriptions = await this.confirmJobDescriptions();
    let content = 'SAVED JOBS\n\n';
    
    for (const job of savedJobs) {
      content += `Title: ${job.title}\n`;
      content += `Company: ${job.company}\n`;
      content += `Date Saved: ${new Date(job.dateSaved).toLocaleDateString()}\n`;
      content += `Link: ${job.jobLink}\n`;
      content += `Rating: ${job.rating}/10\n`;
      if (job.keywords?.length) {
        content += `Keywords: ${job.keywords.join(', ')}\n`;
      }
      if (includeDescriptions && job.jobText) {
        content += '\nJob Description:\n';
        content += job.jobText + '\n';
      }
      content += '-------------------\n\n';
    }

    await this.saveToFile(content, 'saved_jobs.txt');
  }

  async exportAppliedJobs() {
    const appliedJobs = await this.db.getField('appliedJobs') || [];
    const includeDescriptions = await this.confirmJobDescriptions();
    let content = 'APPLIED JOBS\n\n';
    
    for (const job of appliedJobs) {
      content += `Title: ${job.title}\n`;
      content += `Company: ${job.company}\n`;
      content += `Date Applied: ${new Date(job.dateApplied).toLocaleDateString()}\n`;
      content += `Link: ${job.jobLink}\n`;
      if (job.status) content += `Status: ${job.status}\n`;
      if (job.keywords?.length) {
        content += `Keywords: ${job.keywords.join(', ')}\n`;
      }
      if (includeDescriptions && job.jobText) {
        content += '\nJob Description:\n';
        content += job.jobText + '\n';
      }
      content += '-------------------\n\n';
    }

    await this.saveToFile(content, 'applied_jobs.txt');
  }

  async exportSkills() {
    const skills = await this.db.getField('skills') || [];
    let content = 'SKILLS\n\n';
    
    for (const skill of skills) {
      content += `Skill: ${skill.skill}\n`;
      content += `Level: ${skill.level}\n`;
      if (skill.years) content += `Years: ${skill.years}\n`;
      content += '-------------------\n\n';
    }

    await this.saveToFile(content, 'skills.txt');
  }

  async exportExperience() {
    const experiences = await this.db.getField('experiences') || [];
    let content = 'EXPERIENCE\n\n';
    
    for (const exp of experiences) {
      content += `Title: ${exp.title}\n`;
      content += `Company: ${exp.company}\n`;
      content += `Type: ${exp.type}\n`;
      content += `Location: ${exp.location}\n`;
      content += `Start Date: ${new Date(exp.startDate).toLocaleDateString()}\n`;
      if (exp.inProgress) {
        content += 'End Date: Present\n';
      } else if (exp.endDate) {
        content += `End Date: ${new Date(exp.endDate).toLocaleDateString()}\n`;
      }
      content += '\nDescription:\n';
      content += exp.description + '\n';
      if (exp.skills?.length) {
        content += `\nRelated Skills: ${exp.skills.join(', ')}\n`;
      }
      content += '-------------------\n\n';
    }

    await this.saveToFile(content, 'experience.txt');
  }

  async exportEducation() {
    const education = await this.db.getField('education') || [];
    let content = 'EDUCATION\n\n';
    
    for (const edu of education) {
      content += `Type: ${edu.type}\n`;
      content += `Title: ${edu.title}\n`;
      content += `Institution: ${edu.institution}\n`;
      content += `Start Date: ${new Date(edu.startDate).toLocaleDateString()}\n`;
      if (edu.inProgress) {
        content += 'End Date: Present\n';
      } else if (edu.endDate) {
        content += `End Date: ${new Date(edu.endDate).toLocaleDateString()}\n`;
      }
      if (edu.gpa) content += `GPA: ${edu.gpa}\n`;
      if (edu.url) content += `Certificate URL: ${edu.url}\n`;
      if (edu.expiry) content += `Expiry Date: ${new Date(edu.expiry).toLocaleDateString()}\n`;
      if (edu.description) {
        content += '\nDescription:\n';
        content += edu.description + '\n';
      }
      content += '-------------------\n\n';
    }

    await this.saveToFile(content, 'education.txt');
  }

  async exportQA() {
    const qaPairs = await this.db.getField('qaPairs') || [];
    let content = 'QUESTIONS & ANSWERS\n\n';
    
    for (const qa of qaPairs) {
      content += `Q: ${qa.question}\n\n`;
      content += `A: ${qa.answer}\n`;
      content += '-------------------\n\n';
    }

    await this.saveToFile(content, 'qa_pairs.txt');
  }

  async exportAllData() {
    // Get current profile data
    const profile = await this.db.getActiveProfile();
    // Create a backup file in JSON format
    const backup = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      profile: profile
    };

    const content = JSON.stringify(backup, null, 2);
    await this.saveToFile(content, 'profile_backup.json');
  }

  async confirmJobDescriptions() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.display = 'block';
      
      modal.innerHTML = `
        <div class="modal-content">
          <h3>Include Job Descriptions?</h3>
          <p>Would you like to include the full job descriptions in the export?</p>
          <p>This can make the file much larger but provides more detail.</p>
          <div class="modal-actions">
            <button id="includeDescBtn" class="primary-button">Include Descriptions</button>
            <button id="excludeDescBtn" class="secondary-button">Exclude Descriptions</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('#includeDescBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(true);
      });

      modal.querySelector('#excludeDescBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(false);
      });
    });
  }

  async saveToFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    
    // Trigger the download
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async importProfile() {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const content = await file.text();
        const backup = JSON.parse(content);
        
        // Validate backup format
        if (!backup.version || !backup.profile) {
          throw new Error('Invalid backup file format');
        }

        // Show confirmation modal
        if (await this.confirmImport()) {
          // Get current profiles
          const { profiles } = await this.db.getRawStorage();
          
          // Find the active profile to replace
          const activeProfileIndex = profiles.findIndex(p => p.isActive);
          if (activeProfileIndex === -1) {
            throw new Error('No active profile found');
          }
          
          // Replace the active profile's data with the backup
          profiles[activeProfileIndex].data = backup.profile.data;
          
          // Update storage
          await this.db.updateRawStorage({ profiles });
          
          // Show success message
          this.ui.showFeedbackMessage('Profile imported successfully!');
          
          // Refresh UI
          window.location.reload();
        }
      } catch (error) {
        console.error('Import error:', error);
        this.ui.showError('Failed to import profile: ' + error.message);
      }
    });
    
    // Trigger file selection
    input.click();
  }

  async confirmImport() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.display = 'block';
      
      modal.innerHTML = `
        <div class="modal-content">
          <h3>Import Profile</h3>
          <p>This will replace all data in your current profile with the imported data.</p>
          <p>Are you sure you want to continue?</p>
          <div class="modal-actions">
            <button id="confirmImportBtn" class="primary-button">Import</button>
            <button id="cancelImportBtn" class="secondary-button">Cancel</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('#confirmImportBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(true);
      });

      modal.querySelector('#cancelImportBtn').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(false);
      });
    });
  }
} 