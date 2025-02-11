// Utility class for keyword matching functionality
export class KeywordMatcher {
  static NGRAM_SIZE = 3; // Size of ngrams for fuzzy matching
  
  // Generate ngrams from a string
  static generateNgrams(text) {
    if (!text) return new Set();
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = normalized.split(/\s+/);
    const ngrams = new Set();
    
    words.forEach(word => {
      if (word.length < this.NGRAM_SIZE) {
        ngrams.add(word);
      } else {
        for (let i = 0; i <= word.length - this.NGRAM_SIZE; i++) {
          ngrams.add(word.slice(i, i + this.NGRAM_SIZE));
        }
      }
    });
    
    return ngrams;
  }

  // Calculate similarity between two sets of ngrams
  static calculateSimilarity(ngrams1, ngrams2) {
    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);
    return intersection.size / union.size;
  }

  // Check if two strings are similar enough
  static isSimilar(str1, str2, threshold = 0.3) {
    const ngrams1 = this.generateNgrams(str1);
    const ngrams2 = this.generateNgrams(str2);
    return this.calculateSimilarity(ngrams1, ngrams2) >= threshold;
  }

  // Find matches in resume text
  static findResumeMatches(keywords, resumeText) {
    if (!resumeText) return new Map();
    const resumeNgrams = this.generateNgrams(resumeText);
    const matches = new Map();

    keywords.forEach(keyword => {
      const keywordNgrams = this.generateNgrams(keyword);
      const similarity = this.calculateSimilarity(keywordNgrams, resumeNgrams);
      
      if (similarity >= 0.7) {
        matches.set(keyword, 'match');
      } else if (similarity >= 0.3) {
        matches.set(keyword, 'partial-match');
      } else {
        matches.set(keyword, 'no-match');
      }
    });

    return matches;
  }

  // Find matches in skills database
  static findSkillMatches(keywords, skills) {
    if (!skills || !Array.isArray(skills)) return new Map();
    const matches = new Map();
    const skillNames = skills.map(s => s.skill.toLowerCase());

    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      if (skillNames.some(skill => this.isSimilar(skill, keywordLower, 0.7))) {
        matches.set(keyword, 'match');
      } else if (skillNames.some(skill => this.isSimilar(skill, keywordLower, 0.3))) {
        matches.set(keyword, 'partial-match');
      } else {
        matches.set(keyword, 'no-match');
      }
    });

    return matches;
  }

  // Find matches against both resume and skills
  static findCombinedMatches(keywords, resumeText, skills) {
    const resumeMatches = this.findResumeMatches(keywords, resumeText);
    const skillMatches = this.findSkillMatches(keywords, skills);
    const combinedMatches = new Map();

    keywords.forEach(keyword => {
      const resumeMatch = resumeMatches.get(keyword);
      const skillMatch = skillMatches.get(keyword);
      
      if (resumeMatch === 'match' || skillMatch === 'match') {
        combinedMatches.set(keyword, 'match');
      } else if (resumeMatch === 'partial-match' || skillMatch === 'partial-match') {
        combinedMatches.set(keyword, 'partial-match');
      } else {
        combinedMatches.set(keyword, 'no-match');
      }
    });

    return combinedMatches;
  }
} 