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
      console.log('Adding extracted education:', selectedEducation);
      
      // Validate and format each education item before adding
      const validatedEducation = selectedEducation.map(edu => {
        console.log('Validating education item:', edu);
        
        // Ensure dates are in correct format
        const startDate = this.formatDate(edu.startDate);
        const endDate = edu.inProgress ? null : this.formatDate(edu.endDate);
        
        console.log('Formatted dates:', { startDate, endDate });
        
        if (!startDate) {
          throw new Error(`Invalid start date for education: ${edu.title}`);
        }
        
        if (!edu.inProgress && !endDate) {
          throw new Error(`Invalid end date for education: ${edu.title}`);
        }

        const validatedItem = {
          type: edu.type || 'degree', // Default to degree if not specified
          title: edu.title.trim(),
          institution: edu.institution.trim(),
          startDate,
          endDate,
          inProgress: Boolean(edu.inProgress),
          description: edu.description?.trim() || '',
          gpa: edu.gpa || null,
          url: edu.url || null,
          expiryDate: edu.expiryDate ? this.formatDate(edu.expiryDate) : null
        };
        
        console.log('Validated education item:', validatedItem);
        return validatedItem;
      });

      console.log('All education items validated:', validatedEducation);

      if (replaceExisting) {
        console.log('Replacing existing education');
        const updateSuccess = await this.databaseManager.updateField('education', validatedEducation);
        console.log('Update success:', updateSuccess);
        if (!updateSuccess) {
          throw new Error('Database update failed');
        }
      } else {
        console.log('Adding to existing education');
        const currentEducation = await this.getAllEducation();
        console.log('Current education:', currentEducation);
        
        const newEducation = [...currentEducation];
        
        for (const edu of validatedEducation) {
          if (!this.isDuplicateEducation(edu, currentEducation)) {
            console.log('Adding new education item:', edu);
            newEducation.push(edu);
          } else {
            console.log('Skipping duplicate education item:', edu);
          }
        }
        
        console.log('Final education array:', newEducation);
        const updateSuccess = await this.databaseManager.updateField('education', newEducation);
        console.log('Update success:', updateSuccess);
        if (!updateSuccess) {
          throw new Error('Database update failed');
        }
      }
    } catch (error) {
      console.error('Error in addExtractedEducation:', error);
      throw new Error(`Failed to add education: ${error.message}`);
    }
  }

  formatDate(dateString) {
    if (!dateString) return null;
    
    try {
      // Handle various date formats
      let date;
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Already in YYYY-MM-DD format
        date = new Date(dateString);
      } else {
        // Try to parse other formats
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      // Return in YYYY-MM-DD format
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Date formatting error:', error);
      return null;
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