// Limitations manager module for handling limitations-related functionality
export class LimitationsManager {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
  }

  async addLimitation(limitationData) {
    // Validate required fields
    if (!limitationData.category || !limitationData.limitation) {
      throw new Error('Missing required limitation fields');
    }

    // Validate category
    if (!['legal', 'physical', 'technical', 'other'].includes(limitationData.category)) {
      throw new Error('Invalid limitation category');
    }

    // Check for duplicates
    const exists = await this.databaseManager.hasLimitation(limitationData.limitation);
    if (exists) {
      throw new Error('This limitation already exists');
    }

    try {
      const success = await this.databaseManager.addLimitation(limitationData);
      if (!success) {
        throw new Error('Failed to add limitation');
      }
      return true;
    } catch (error) {
      console.error('Error adding limitation:', error);
      throw new Error(`Failed to add limitation: ${error.message}`);
    }
  }

  async updateLimitation(index, updatedData) {
    try {
      const success = await this.databaseManager.updateLimitation(index, updatedData);
      if (!success) {
        throw new Error('Limitation not found');
      }
      return true;
    } catch (error) {
      console.error('Error updating limitation:', error);
      throw new Error(`Failed to update limitation: ${error.message}`);
    }
  }

  async removeLimitation(index) {
    try {
      const success = await this.databaseManager.removeLimitation(index);
      if (!success) {
        throw new Error('Limitation not found');
      }
      return true;
    } catch (error) {
      console.error('Error removing limitation:', error);
      throw new Error(`Failed to remove limitation: ${error.message}`);
    }
  }

  async getAllLimitations() {
    return await this.databaseManager.getField('limitations') || [];
  }

  async getLimitationsByCategory(category) {
    return await this.databaseManager.getLimitationsByCategory(category);
  }

  async getActiveLimitations() {
    return await this.databaseManager.getActiveLimitations();
  }

  validateLimitation(limitation) {
    const errors = [];

    if (!limitation.category || 
        !['legal', 'physical', 'technical', 'other'].includes(limitation.category)) {
      errors.push('Invalid limitation category');
    }

    if (!limitation.limitation || limitation.limitation.trim().length === 0) {
      errors.push('Limitation description is required');
    }

    if (limitation.isTemporary && limitation.endDate) {
      const endDate = new Date(limitation.endDate);
      if (isNaN(endDate.getTime())) {
        errors.push('Invalid end date');
      } else if (endDate < new Date()) {
        errors.push('End date cannot be in the past');
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    return true;
  }
} 