// Experience manager module for handling experience-related functionality
export class ExperienceManager {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
  }

  async addExperience(experienceData) {
    if (!this.validateExperience(experienceData)) {
      throw new Error('Invalid experience data');
    }

    const experiences = await this.databaseManager.getField('experiences') || [];
    experiences.push(experienceData);
    await this.databaseManager.updateField('experiences', experiences);
    return true;
  }

  async updateExperience(index, updatedData) {
    try {
      const experiences = await this.databaseManager.getField('experiences') || [];
      if (index < 0 || index >= experiences.length) {
        throw new Error('Experience item not found');
      }
      
      if (!this.validateExperience(updatedData)) {
        throw new Error('Invalid experience data');
      }

      experiences[index] = updatedData;
      await this.databaseManager.updateField('experiences', experiences);
      return true;
    } catch (error) {
      console.error('Error updating experience:', error);
      throw new Error(`Failed to update experience: ${error.message}`);
    }
  }

  async removeExperience(index) {
    const experiences = await this.databaseManager.getField('experiences') || [];
    if (index < 0 || index >= experiences.length) {
      throw new Error('Experience item not found');
    }

    experiences.splice(index, 1);
    await this.databaseManager.updateField('experiences', experiences);
    return true;
  }

  async getAllExperiences() {
    return await this.databaseManager.getField('experiences') || [];
  }

  async addSkillToExperience(experienceIndex, skillName) {
    const experiences = await this.getAllExperiences();
    const skills = await this.databaseManager.getField('skills') || [];

    if (!skills.some(s => s.skill === skillName)) {
      throw new Error('Skill not found');
    }

    if (experienceIndex < 0 || experienceIndex >= experiences.length) {
      throw new Error('Experience not found');
    }

    if (!experiences[experienceIndex].linkedSkills) {
      experiences[experienceIndex].linkedSkills = [];
    }

    if (!experiences[experienceIndex].linkedSkills.includes(skillName)) {
      experiences[experienceIndex].linkedSkills.push(skillName);
      await this.databaseManager.updateField('experiences', experiences);
    }

    return true;
  }

  async removeSkillFromExperience(experienceIndex, skillName) {
    const experiences = await this.getAllExperiences();
    
    if (experienceIndex < 0 || experienceIndex >= experiences.length) {
      throw new Error('Experience not found');
    }

    if (!experiences[experienceIndex].linkedSkills) {
      return true;
    }

    const skillIndex = experiences[experienceIndex].linkedSkills.indexOf(skillName);
    if (skillIndex !== -1) {
      experiences[experienceIndex].linkedSkills.splice(skillIndex, 1);
      await this.databaseManager.updateField('experiences', experiences);
    }

    return true;
  }

  async getExperiencesForSkill(skillName) {
    const experiences = await this.getAllExperiences();
    return experiences.filter(exp => 
      exp.linkedSkills && exp.linkedSkills.includes(skillName)
    );
  }

  validateExperience(experience) {
    if (!experience.title) {
      throw new Error('Title is required');
    }
    if (!experience.company) {
      throw new Error('Company/Institution is required');
    }
    if (!experience.startDate) {
      throw new Error('Start date is required');
    }
    if (!experience.inProgress && !experience.endDate) {
      throw new Error('End date is required for completed experiences');
    }
    if (!experience.type || !['job', 'volunteer', 'internship', 'project'].includes(experience.type)) {
      throw new Error('Invalid experience type');
    }

    // Optional fields that need validation if present
    if (experience.location && typeof experience.location !== 'string') {
      throw new Error('Location must be a string');
    }
    if (experience.linkedSkills && !Array.isArray(experience.linkedSkills)) {
      throw new Error('Linked skills must be an array');
    }
    if (experience.description && typeof experience.description !== 'string') {
      throw new Error('Description must be a string');
    }

    return true;
  }

  async addExtractedExperiences(selectedExperiences, replaceExisting = false) {
    try {
      if (replaceExisting) {
        await this.databaseManager.updateField('experiences', selectedExperiences);
      } else {
        const currentExperiences = await this.getAllExperiences();
        const newExperiences = [...currentExperiences];
        
        for (const exp of selectedExperiences) {
          if (!this.isDuplicateExperience(exp, currentExperiences)) {
            newExperiences.push(exp);
          }
        }
        
        await this.databaseManager.updateField('experiences', newExperiences);
      }
    } catch (error) {
      throw new Error(`Failed to add experiences: ${error.message}`);
    }
  }

  isDuplicateExperience(newExp, existingExperiences) {
    return existingExperiences.some(exp => 
      exp.type === newExp.type &&
      exp.title.toLowerCase() === newExp.title.toLowerCase() &&
      exp.company.toLowerCase() === newExp.company.toLowerCase() &&
      exp.startDate === newExp.startDate
    );
  }
} 