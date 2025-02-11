// Database structure and management
const DEFAULT_PROFILE = {
  id: "profile1",
  name: "Profile 1",
  isActive: true,
  data: {
    personalInfo: {
      name: "",
      email: "",
      phone: ""
    },
    skills: [],
    jobs: [],
    education: [],
    certifications: [],
    cantDos: [],
    defaultResume: "",
    defaultCoverLetterTemplate: "",
    limitations: [],
    savedJobs: [],
    resumes: [],
    coverLetters: [],
    activeResumeId: null,
    activeCoverLetterId: null,
    activeJobId: null,
    geminiApiKey: null,
    qaPairs: [] // Add Q&A pairs storage
  }
};

const DEFAULT_DB_STRUCTURE = {
  profiles: [
    { ...DEFAULT_PROFILE },
    { ...DEFAULT_PROFILE, id: "profile2", name: "Profile 2", isActive: false },
    { ...DEFAULT_PROFILE, id: "profile3", name: "Profile 3", isActive: false }
  ]
};

class DatabaseManager {
  static async initializeDB() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        console.log('Current storage state:', result);
        if (!result.profiles) {
          // First time initialization or migration
          console.log('Initializing database with default structure');
          if (Object.keys(result).length === 0) {
            // Brand new installation
            chrome.storage.local.set(DEFAULT_DB_STRUCTURE, () => {
              resolve(DEFAULT_DB_STRUCTURE);
            });
          } else {
            // Migrate existing data to profile1
            const profile1 = {
              ...DEFAULT_PROFILE,
              data: { ...DEFAULT_PROFILE.data, ...result }
            };
            const newState = {
              profiles: [
                profile1,
                { ...DEFAULT_PROFILE, id: "profile2", name: "Profile 2", isActive: false },
                { ...DEFAULT_PROFILE, id: "profile3", name: "Profile 3", isActive: false }
              ]
            };
            chrome.storage.local.set(newState, () => {
              resolve(newState);
            });
          }
        } else {
          resolve(result);
        }
      });
    });
  }

  static async getActiveProfile() {
    const { profiles } = await this.getRawStorage();
    return profiles.find(p => p.isActive) || profiles[0];
  }

  static async switchProfile(profileId) {
    const { profiles } = await this.getRawStorage();
    const updatedProfiles = profiles.map(p => ({
      ...p,
      isActive: p.id === profileId
    }));
    await this.updateRawStorage({ profiles: updatedProfiles });
    return this.getActiveProfile();
  }

  static async updateProfileName(profileId, newName) {
    const { profiles } = await this.getRawStorage();
    const updatedProfiles = profiles.map(p => 
      p.id === profileId ? { ...p, name: newName } : p
    );
    await this.updateRawStorage({ profiles: updatedProfiles });
  }

  static async getRawStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        resolve(result);
      });
    });
  }

  static async updateRawStorage(newState) {
    return new Promise((resolve) => {
      chrome.storage.local.set(newState, () => {
        resolve();
      });
    });
  }

  static async getField(field) {
    const activeProfile = await this.getActiveProfile();
    return activeProfile.data[field];
  }

  static async updateField(field, value) {
    return new Promise(async (resolve, reject) => {
      try {
        const { profiles } = await this.getRawStorage();
        const updatedProfiles = profiles.map(p => {
          if (p.isActive) {
            return {
              ...p,
              data: {
                ...p.data,
                [field]: value
              }
            };
          }
          return p;
        });
        
        await this.updateRawStorage({ profiles: updatedProfiles });
        resolve();
      } catch (error) {
        console.error('Error updating field:', error);
        reject(error);
      }
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

  static async setActiveJob(id) {
    console.log('Setting active job:', id);
    const savedJobs = await this.getField('savedJobs') || [];
    if (id === null || savedJobs.some(j => j.id === id)) {
      await this.updateField('activeJobId', id);
      return true;
    }
    return false;
  }

  static async getActiveJob() {
    const activeJobId = await this.getField('activeJobId');
    if (!activeJobId) return null;
    
    const savedJobs = await this.getField('savedJobs') || [];
    return savedJobs.find(job => job.id === activeJobId) || null;
  }

  static async addQAPair(qaPair) {
    const qaPairs = await this.getField('qaPairs') || [];
    
    // Add unique ID and timestamp
    const newQAPair = {
      ...qaPair,
      id: crypto.randomUUID(),
      dateAdded: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
    
    qaPairs.push(newQAPair);
    await this.updateField('qaPairs', qaPairs);
    return newQAPair;
  }

  static async updateQAPair(id, updatedQAPair) {
    const qaPairs = await this.getField('qaPairs') || [];
    const index = qaPairs.findIndex(qa => qa.id === id);
    
    if (index !== -1) {
      qaPairs[index] = {
        ...qaPairs[index],
        ...updatedQAPair,
        lastModified: new Date().toISOString()
      };
      await this.updateField('qaPairs', qaPairs);
      return qaPairs[index];
    }
    return null;
  }

  static async removeQAPair(id) {
    const qaPairs = await this.getField('qaPairs') || [];
    const filteredPairs = qaPairs.filter(qa => qa.id !== id);
    if (filteredPairs.length !== qaPairs.length) {
      await this.updateField('qaPairs', filteredPairs);
      return true;
    }
    return false;
  }

  static async searchQAPairs(query) {
    const qaPairs = await this.getField('qaPairs') || [];
    if (!query) return [];
    
    // Convert query to lowercase for case-insensitive search
    const lowerQuery = query.toLowerCase();
    
    // Search using various matching techniques
    return qaPairs.map(qa => {
      const questionScore = this.getMatchScore(qa.question, lowerQuery);
      return {
        ...qa,
        score: questionScore
      };
    })
    .filter(qa => qa.score > 0)
    .sort((a, b) => b.score - a.score);
  }

  static getMatchScore(text, query) {
    if (!text || !query) return 0;
    
    const lowerText = text.toLowerCase();
    let score = 0;
    
    // Exact match
    if (lowerText === query) {
      score += 100;
    }
    
    // Contains full query
    if (lowerText.includes(query)) {
      score += 50;
    }
    
    // Word matching
    const queryWords = query.split(/\s+/);
    const textWords = lowerText.split(/\s+/);
    
    queryWords.forEach(qWord => {
      if (textWords.some(tWord => tWord === qWord)) {
        score += 10;
      }
      if (textWords.some(tWord => tWord.includes(qWord))) {
        score += 5;
      }
    });
    
    return score;
  }

  static async getAllQAPairs() {
    return await this.getField('qaPairs') || [];
  }
}

// Export for use in other files
window.DatabaseManager = DatabaseManager; 