// Limitations manager module for handling limitations-related functionality
export class LimitationsManager {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
  }

  async addLimitation(limitationData) {
    if (!this.validateLimitation(limitationData)) {
      throw new Error('Invalid limitation data');
    }

    const success = await this.databaseManager.addLimitation(limitationData);
    if (!success) {
      throw new Error('Failed to add limitation');
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
    const success = await this.databaseManager.removeLimitation(index);
    if (!success) {
      throw new Error('Failed to remove limitation');
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
    if (!limitation.category || !['legal', 'physical', 'technical', 'other'].includes(limitation.category)) {
      throw new Error('Invalid limitation category');
    }
    if (!limitation.limitation || limitation.limitation.trim().length === 0) {
      throw new Error('Limitation description is required');
    }
    if (limitation.isTemporary && !limitation.endDate) {
      throw new Error('End date is required for temporary limitations');
    }
    return true;
  }
} 