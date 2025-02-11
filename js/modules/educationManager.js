// Education manager module for handling education-related functionality
export class EducationManager {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
  }

  async addEducation(educationData) {
    // Validate required fields
    if (!educationData.type || !educationData.title || !educationData.institution) {
      throw new Error('Missing required education fields');
    }

    // Add dates if not provided
    if (!educationData.startDate) {
      educationData.startDate = new Date().toISOString();
    }

    // Handle end date based on in-progress status
    if (educationData.inProgress) {
      educationData.endDate = null;
    }

    try {
      await this.databaseManager.addEducationItem(educationData);
      return true;
    } catch (error) {
      console.error('Error adding education:', error);
      throw new Error(`Failed to add education: ${error.message}`);
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
    try {
      const success = await this.databaseManager.removeEducationItem(index);
      if (!success) {
        throw new Error('Education item not found');
      }
      return true;
    } catch (error) {
      console.error('Error removing education:', error);
      throw new Error(`Failed to remove education: ${error.message}`);
    }
  }

  async getAllEducation() {
    return await this.databaseManager.getField('education') || [];
  }

  async getEducationByType(type) {
    return await this.databaseManager.getEducationByType(type);
  }

  validateEducation(education) {
    const errors = [];

    if (!education.type || !['degree', 'certification', 'course'].includes(education.type)) {
      errors.push('Invalid education type');
    }

    if (!education.title || education.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!education.institution || education.institution.trim().length === 0) {
      errors.push('Institution is required');
    }

    if (!education.startDate) {
      errors.push('Start date is required');
    }

    if (!education.inProgress && !education.endDate) {
      errors.push('End date is required for completed education');
    }

    // Additional validation for certifications
    if (education.type === 'certification') {
      if (education.expiryDate) {
        const expiry = new Date(education.expiryDate);
        if (isNaN(expiry.getTime())) {
          errors.push('Invalid expiry date');
        }
      }
      
      if (education.url && !this.isValidUrl(education.url)) {
        errors.push('Invalid certificate URL');
      }
    }

    // Additional validation for degrees
    if (education.type === 'degree' && education.gpa) {
      const gpa = parseFloat(education.gpa);
      if (isNaN(gpa) || gpa < 0 || gpa > 4.0) {
        errors.push('Invalid GPA value');
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
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
        for (const education of selectedEducation) {
          try {
            await this.databaseManager.addEducationItem(education);
          } catch (error) {
            console.warn(`Skipping invalid education item: ${education.title}`, error);
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to add education items: ${error.message}`);
    }
  }
} 