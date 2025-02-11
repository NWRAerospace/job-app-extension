// Database structure and management
const DEFAULT_DB_STRUCTURE = {
  personalInfo: {
    name: "",
    email: "",
    phone: ""
  },
  skills: [],  // Array of {skill, level, yearsExperience}
  jobs: [],    // Array of {company, title, dates, description, relevantSkills}
  education: [
    // Array of {
    //   type: "degree" | "certification" | "course",
    //   title: string,
    //   institution: string,
    //   startDate: string,
    //   endDate: string | null,  // null if ongoing
    //   inProgress: boolean,
    //   description: string,
    //   gpa: string | null,
    //   relevantCoursework: string[] | null,
    //   url: string | null,  // For certificates/badges
    //   expiryDate: string | null  // For certificates that expire
    // }
  ],
  certifications: [],
  cantDos: [],
  defaultResume: "",
  defaultCoverLetterTemplate: "",
  limitations: [
    // Array of {
    //   category: "legal" | "physical" | "technical" | "other",
    //   limitation: string,
    //   details: string | null,
    //   isTemporary: boolean,
    //   endDate: string | null  // For temporary limitations
    // }
  ],
  savedJobs: [],  // Array of {jobTitle, dateSaved, rating, jobLink, jobPostingText, extractedKeywords}
  resumes: [
    // Array of {
    //   id: string,
    //   name: string,
    //   type: "text" | "docx",
    //   content: string, // Base64 string for docx, plain text for text type
    //   textContent: string, // Converted text content for display/use
    //   dateAdded: string,
    //   lastUsed: string
    // }
  ],
  coverLetters: [
    // Array of {
    //   id: string,
    //   name: string,
    //   type: "text" | "docx",
    //   content: string, // Base64 string for docx, plain text for text type
    //   textContent: string, // Converted text content for display/use
    //   dateAdded: string,
    //   lastUsed: string
    // }
  ],
  activeResumeId: null,
  activeCoverLetterId: null
};

class DatabaseManager {
  static async initializeDB() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        console.log('Current storage state:', result);
        if (Object.keys(result).length === 0) {
          // First time initialization
          console.log('Initializing database with default structure');
          chrome.storage.local.set(DEFAULT_DB_STRUCTURE, () => {
            resolve(DEFAULT_DB_STRUCTURE);
          });
        } else {
          // Ensure all required fields exist
          const newState = { ...DEFAULT_DB_STRUCTURE, ...result };
          chrome.storage.local.set(newState, () => {
            resolve(newState);
          });
        }
      });
    });
  }

  static async getField(field) {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        console.log('Full storage state:', result);
        console.log(`Retrieved ${field}:`, result[field]);
        
        // Initialize arrays if undefined
        if ((field === 'resumes' || field === 'coverLetters') && !result[field]) {
          resolve([]);
        } else {
          resolve(result[field]);
        }
      });
    });
  }

  static async updateField(field, value) {
    return new Promise((resolve, reject) => {
      // Validate arrays
      if ((field === 'resumes' || field === 'coverLetters') && !Array.isArray(value)) {
        console.error(`Attempting to save non-array value to ${field}:`, value);
        value = [];
      }
      
      console.log(`Updating ${field}:`, field === 'resumes' ? 
        value.map(r => ({ id: r.id, name: r.name })) : 
        value
      );
      
      // First get the current state
      chrome.storage.local.get(null, (currentState) => {
        // Create new state with updated field
        const newState = { ...currentState, [field]: value };
        
        // Save entire state
        chrome.storage.local.set(newState, () => {
          if (chrome.runtime.lastError) {
            console.error('Error updating field:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log(`${field} updated successfully. New state:`, newState);
            resolve();
          }
        });
      });
    });
  }

  static async addSkill(skill) {
    const skills = await this.getField('skills') || [];
    if (!skills.some(s => s.skill === skill.skill)) {
      skills.push(skill);
      await this.updateField('skills', skills);
      return true;
    }
    return false;
  }

  static async removeSkill(skillName) {
    const skills = await this.getField('skills') || [];
    const filteredSkills = skills.filter(s => s.skill !== skillName);
    if (filteredSkills.length !== skills.length) {
      await this.updateField('skills', filteredSkills);
      return true;
    }
    return false;
  }

  static async addSavedJob(job) {
    const savedJobs = await this.getField('savedJobs') || [];
    
    // Check if job with same URL already exists
    const existingJobIndex = savedJobs.findIndex(j => j.jobLink === job.jobLink);
    
    // If we already have this job saved, return false to indicate need for overwrite confirmation
    if (existingJobIndex !== -1) {
      return { status: 'exists', existingJob: savedJobs[existingJobIndex] };
    }
    
    // If we have 10 jobs and this is a new one, return 'limit' status
    if (savedJobs.length >= 10 && existingJobIndex === -1) {
      return { status: 'limit', oldestJob: savedJobs[0] };
    }
    
    // If we're at the limit, remove the oldest job
    if (savedJobs.length >= 10) {
      savedJobs.shift();
    }
    
    // Add the new job
    savedJobs.push({
      ...job,
      dateSaved: new Date().toISOString()
    });
    
    await this.updateField('savedJobs', savedJobs);
    return { status: 'saved' };
  }

  static async updateSavedJob(jobLink, newJobData) {
    const savedJobs = await this.getField('savedJobs') || [];
    const jobIndex = savedJobs.findIndex(j => j.jobLink === jobLink);
    
    if (jobIndex !== -1) {
      savedJobs[jobIndex] = {
        ...newJobData,
        dateSaved: new Date().toISOString()
      };
      await this.updateField('savedJobs', savedJobs);
      return true;
    }
    return false;
  }

  static async removeSavedJob(jobLink) {
    const savedJobs = await this.getField('savedJobs') || [];
    const filteredJobs = savedJobs.filter(j => j.jobLink !== jobLink);
    if (filteredJobs.length !== savedJobs.length) {
      await this.updateField('savedJobs', filteredJobs);
      return true;
    }
    return false;
  }

  static async updatePersonalInfo(info) {
    const currentInfo = await this.getField('personalInfo') || {};
    await this.updateField('personalInfo', { ...currentInfo, ...info });
    return true;
  }

  static async addEducationItem(educationItem) {
    const education = await this.getField('education') || [];
    
    // Validate required fields
    if (!educationItem.type || !educationItem.title || !educationItem.institution) {
      throw new Error('Missing required education fields');
    }

    // Add dates if not provided
    if (!educationItem.startDate) {
      educationItem.startDate = new Date().toISOString();
    }

    education.push(educationItem);
    await this.updateField('education', education);
    return true;
  }

  static async updateEducationItem(index, updatedItem) {
    const education = await this.getField('education') || [];
    if (index >= 0 && index < education.length) {
      education[index] = {
        ...education[index],
        ...updatedItem
      };
      await this.updateField('education', education);
      return true;
    }
    return false;
  }

  static async removeEducationItem(index) {
    const education = await this.getField('education') || [];
    if (index >= 0 && index < education.length) {
      education.splice(index, 1);
      await this.updateField('education', education);
      return true;
    }
    return false;
  }

  static async addLimitation(limitation) {
    const limitations = await this.getField('limitations') || [];
    
    // Validate required fields
    if (!limitation.category || !limitation.limitation) {
      throw new Error('Missing required limitation fields');
    }

    // Check for duplicates
    if (limitations.some(l => l.limitation.toLowerCase() === limitation.limitation.toLowerCase())) {
      return false;
    }

    limitations.push({
      ...limitation,
      dateAdded: new Date().toISOString()
    });
    await this.updateField('limitations', limitations);
    return true;
  }

  static async updateLimitation(index, updatedLimitation) {
    const limitations = await this.getField('limitations') || [];
    if (index >= 0 && index < limitations.length) {
      limitations[index] = {
        ...limitations[index],
        ...updatedLimitation,
        lastUpdated: new Date().toISOString()
      };
      await this.updateField('limitations', limitations);
      return true;
    }
    return false;
  }

  static async removeLimitation(index) {
    const limitations = await this.getField('limitations') || [];
    if (index >= 0 && index < limitations.length) {
      limitations.splice(index, 1);
      await this.updateField('limitations', limitations);
      return true;
    }
    return false;
  }

  static async getEducationByType(type) {
    const education = await this.getField('education') || [];
    return education.filter(item => item.type === type);
  }

  static async getLimitationsByCategory(category) {
    const limitations = await this.getField('limitations') || [];
    return limitations.filter(item => item.category === category);
  }

  // Helper method to check if a limitation exists
  static async hasLimitation(limitationText) {
    const limitations = await this.getField('limitations') || [];
    return limitations.some(l => l.limitation.toLowerCase() === limitationText.toLowerCase());
  }

  // Helper method to get active limitations (excluding expired temporary ones)
  static async getActiveLimitations() {
    const limitations = await this.getField('limitations') || [];
    const now = new Date();
    
    return limitations.filter(limitation => {
      if (!limitation.isTemporary) return true;
      if (!limitation.endDate) return true;
      return new Date(limitation.endDate) > now;
    });
  }

  static async addResume(name, type, content) {
    const resumes = await this.getField('resumes') || [];
    console.log('Current resumes before adding:', resumes);
    
    // Ensure resumes is an array
    if (!Array.isArray(resumes)) {
      console.warn('Resumes is not an array, initializing new array');
      await this.updateField('resumes', []);
    }
    
    const id = crypto.randomUUID();
    
    const newResume = {
      id,
      name,
      type,
      content,
      textContent: type === 'text' ? content : '',
      dateAdded: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    
    console.log('Adding new resume:', { ...newResume, content: 'CONTENT_OMITTED' });
    resumes.push(newResume);
    
    await this.updateField('resumes', resumes);
    console.log('Resumes after update:', resumes.map(r => ({ id: r.id, name: r.name })));
    return id;
  }

  static async updateResumeText(id, textContent) {
    const resumes = await this.getField('resumes') || [];
    console.log('Current resumes before text update:', resumes.map(r => ({ id: r.id, name: r.name })));
    
    const index = resumes.findIndex(r => r.id === id);
    
    if (index !== -1) {
      resumes[index].textContent = textContent;
      resumes[index].lastUsed = new Date().toISOString();
      console.log('Updating resume text for ID:', id);
      await this.updateField('resumes', resumes);
      console.log('Resumes after text update:', resumes.map(r => ({ id: r.id, name: r.name })));
      return true;
    }
    console.warn('Resume not found for text update:', id);
    return false;
  }

  static async removeResume(id) {
    const resumes = await this.getField('resumes') || [];
    const filteredResumes = resumes.filter(r => r.id !== id);
    
    if (filteredResumes.length !== resumes.length) {
      console.log('Removing resume:', id);
      await this.updateField('resumes', filteredResumes);
      
      // If we removed the active resume, set active to null
      const activeId = await this.getField('activeResumeId');
      if (activeId === id) {
        await this.updateField('activeResumeId', null);
      }
      return true;
    }
    return false;
  }

  static async addCoverLetter(name, type, content) {
    const coverLetters = await this.getField('coverLetters') || [];
    const id = crypto.randomUUID();
    
    const newCoverLetter = {
      id,
      name,
      type,
      content,
      textContent: type === 'text' ? content : '',
      dateAdded: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    
    coverLetters.push(newCoverLetter);
    console.log('Adding new cover letter:', newCoverLetter);
    await this.updateField('coverLetters', coverLetters);
    return id;
  }

  static async updateCoverLetterText(id, textContent) {
    const coverLetters = await this.getField('coverLetters') || [];
    const index = coverLetters.findIndex(c => c.id === id);
    
    if (index !== -1) {
      coverLetters[index].textContent = textContent;
      coverLetters[index].lastUsed = new Date().toISOString();
      console.log('Updating cover letter text:', id, coverLetters[index]);
      await this.updateField('coverLetters', coverLetters);
      return true;
    }
    return false;
  }

  static async removeCoverLetter(id) {
    const coverLetters = await this.getField('coverLetters') || [];
    const filteredCoverLetters = coverLetters.filter(c => c.id !== id);
    
    if (filteredCoverLetters.length !== coverLetters.length) {
      console.log('Removing cover letter:', id);
      await this.updateField('coverLetters', filteredCoverLetters);
      
      // If we removed the active cover letter, set active to null
      const activeId = await this.getField('activeCoverLetterId');
      if (activeId === id) {
        await this.updateField('activeCoverLetterId', null);
      }
      return true;
    }
    return false;
  }

  static async setActiveResume(id) {
    const resumes = await this.getField('resumes') || [];
    if (id === null || resumes.some(r => r.id === id)) {
      console.log('Setting active resume:', id);
      await this.updateField('activeResumeId', id);
      return true;
    }
    return false;
  }

  static async setActiveCoverLetter(id) {
    const coverLetters = await this.getField('coverLetters') || [];
    if (id === null || coverLetters.some(c => c.id === id)) {
      console.log('Setting active cover letter:', id);
      await this.updateField('activeCoverLetterId', id);
      return true;
    }
    return false;
  }
}

// Export for use in other files
window.DatabaseManager = DatabaseManager; 