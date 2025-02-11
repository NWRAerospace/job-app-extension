// Education manager module for handling education-related functionality
export class EducationManager {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
  }

  async addEducation(educationData) {
    if (!this.validateEducation(educationData)) {
      throw new Error('Invalid education data');
    }

    const success = await this.databaseManager.addEducationItem(educationData);
    if (!success) {
      throw new Error('Failed to add education item');
    }
  }

  async updateEducation(index, updatedData) {
    try {
      const success = await this.databaseManager.updateEducationItem(index, updatedData);
      if (!success) {
        throw new Error('Education item not found');
      }
      return true;
    } catch (error) {
      console.error('Error updating education:', error);
      throw new Error(`Failed to update education: ${error.message}`);
    }
  }

  async removeEducation(index) {
    const success = await this.databaseManager.removeEducationItem(index);
    if (!success) {
      throw new Error('Failed to remove education item');
    }
  }

  async getAllEducation() {
    return await this.databaseManager.getField('education') || [];
  }

  async getEducationByType(type) {
    return await this.databaseManager.getEducationByType(type);
  }

  validateEducation(education) {
    if (!education.type || !['degree', 'certification', 'course'].includes(education.type)) {
      throw new Error('Invalid education type');
    }
    if (!education.title) {
      throw new Error('Title is required');
    }
    if (!education.institution) {
      throw new Error('Institution is required');
    }
    if (!education.startDate) {
      throw new Error('Start date is required');
    }
    if (!education.inProgress && !education.endDate) {
      throw new Error('End date is required for completed education');
    }
    return true;
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  async addExtractedEducation(selectedEducation, replaceExisting = false) {
    try {
      if (replaceExisting) {
        await this.databaseManager.updateField('education', selectedEducation);
      } else {
        const currentEducation = await this.getAllEducation();
        const newEducation = [...currentEducation];
        
        for (const edu of selectedEducation) {
          if (!this.isDuplicateEducation(edu, currentEducation)) {
            newEducation.push(edu);
          }
        }
        
        await this.databaseManager.updateField('education', newEducation);
      }
    } catch (error) {
      throw new Error(`Failed to add education: ${error.message}`);
    }
  }

  isDuplicateEducation(newEdu, existingEducation) {
    return existingEducation.some(edu => 
      edu.type === newEdu.type &&
      edu.title.toLowerCase() === newEdu.title.toLowerCase() &&
      edu.institution.toLowerCase() === newEdu.institution.toLowerCase()
    );
  }
} 