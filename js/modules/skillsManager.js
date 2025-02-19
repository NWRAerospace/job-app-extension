// Skills manager module for handling skills-related functionality
import { AIHelper } from '../utils/aiHelper.js';

export class SkillsManager {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
  }

  async addSkill(skillName, level, years) {
    if (!skillName) {
      throw new Error('Please enter a skill name');
    }

    // Check for duplicate skill
    const existingSkills = await this.databaseManager.getField('skills') || [];
    if (existingSkills.some(s => s.skill.toLowerCase() === skillName.toLowerCase())) {
      throw new Error('This skill already exists');
    }

    const newSkill = {
      skill: skillName,
      level: level,
      yearsExperience: years ? parseInt(years) : null
    };

    const success = await this.databaseManager.addSkill(newSkill);
    if (!success) {
      throw new Error('Failed to add skill');
    }

    return newSkill;
  }

  async removeSkill(skillName) {
    const success = await this.databaseManager.removeSkill(skillName);
    if (!success) {
      throw new Error('Failed to remove skill');
    }
  }

  async getAllSkills() {
    return await this.databaseManager.getField('skills') || [];
  }

  async extractSkillsFromResume(apiKey) {
    const resumeText = await this.databaseManager.getField('resumeText');
    if (!resumeText) {
      throw new Error('No resume text found. Please upload a resume first.');
    }

    if (!apiKey) {
      throw new Error('API Key required. Please add it in the Settings tab.');
    }

    const analysis = await AIHelper.analyzeResume(resumeText, apiKey);
    return {
      skills: analysis.skills || [],
      education: analysis.education || []
    };
  }

  async addExtractedSkills(selectedSkills, replaceExisting = false) {
    try {
      if (replaceExisting) {
        await this.databaseManager.updateField('skills', selectedSkills);
      } else {
        for (const skill of selectedSkills) {
          try {
            await this.databaseManager.addSkill(skill);
          } catch (error) {
            console.warn(`Skipping duplicate skill: ${skill.skill}`);
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to add skills: ${error.message}`);
    }
  }

  validateSkill(skill) {
    if (!skill.skill || typeof skill.skill !== 'string') {
      throw new Error('Invalid skill name');
    }
    if (!['Beginner', 'Intermediate', 'Expert'].includes(skill.level)) {
      throw new Error('Invalid skill level');
    }
    if (skill.yearsExperience !== null && 
        (typeof skill.yearsExperience !== 'number' || 
         skill.yearsExperience < 0 || 
         skill.yearsExperience > 50)) {
      throw new Error('Invalid years of experience');
    }
    return true;
  }
}

// Add to your initialization code
const toggleAddSkillForm = document.getElementById('toggleAddSkillForm');
const skillInputForm = document.querySelector('.skill-input-form');
const cancelAddSkill = document.getElementById('cancelAddSkill');

toggleAddSkillForm.addEventListener('click', () => {
  skillInputForm.classList.add('active');
  document.getElementById('skillName').focus();
});

cancelAddSkill.addEventListener('click', () => {
  skillInputForm.classList.remove('active');
  // Clear the inputs
  document.getElementById('skillName').value = '';
  document.getElementById('skillLevel').value = 'Intermediate';
  document.getElementById('skillYears').value = '';
});

// Also clear and hide form after successful skill addition
// Add this to your addSkill success handler
skillInputForm.classList.remove('active'); 