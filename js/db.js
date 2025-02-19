async updateField(field, value) {
  console.log(`Attempting to update field "${field}" with value:`, value);
  try {
    const activeProfile = await this.getActiveProfile();
    if (!activeProfile) {
      throw new Error('No active profile found');
    }
    
    console.log('Current profile data before update:', activeProfile.data);
    activeProfile.data[field] = value;
    console.log('Updated profile data:', activeProfile.data);
    
    await this.saveProfiles();
    return true;
  } catch (error) {
    console.error(`Error updating field "${field}":`, error);
    throw error;
  }
} 