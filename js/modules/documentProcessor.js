// Document processor module for handling resume and cover letter processing
export class DocumentProcessor {
  static async processFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    try {
      if (file.name.toLowerCase().endsWith('.docx')) {
        if (typeof window.mammoth === 'undefined') {
          throw new Error('Document processing library not properly loaded');
        }

        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        
        if (!result || !result.value) {
          throw new Error('Could not extract text from DOCX file');
        }
        return result.value;
      } else if (file.name.toLowerCase().endsWith('.txt')) {
        return await file.text();
      } else {
        throw new Error('Unsupported file type. Please upload a .docx or .txt file');
      }
    } catch (error) {
      console.error('File processing error:', error);
      throw error;
    }
  }

  static async uploadResume(file, databaseManager) {
    const text = await this.processFile(file);
    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the file');
    }

    await databaseManager.updateField('resumeText', text);
    return text;
  }

  static async uploadCoverLetter(file, databaseManager) {
    const text = await this.processFile(file);
    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the file');
    }

    await databaseManager.updateField('coverLetterText', text);
    return text;
  }

  static async clearResume(databaseManager) {
    await databaseManager.updateField('resumeText', '');
  }

  static async clearCoverLetter(databaseManager) {
    await databaseManager.updateField('coverLetterText', '');
  }
} 