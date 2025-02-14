// Utility class for keyword matching functionality
export class KeywordMatcher {
  // Normalize text for comparison
  static normalizeText(text) {
    return text.toLowerCase().trim();
  }

  // Find matches in resume text
  static findResumeMatches(keywords, resumeText) {
    console.log('findResumeMatches called with:', { 
      keywordsCount: keywords.length,
      resumeTextLength: resumeText?.length || 0
    });
    
    if (!resumeText) return new Map();
    const matches = new Map();
    const normalizedResume = this.normalizeText(resumeText);
    console.log('Normalized resume length:', normalizedResume.length);

    keywords.forEach(keyword => {
      const normalizedKeyword = this.normalizeText(keyword);
      console.log(`Checking keyword: "${keyword}" (normalized: "${normalizedKeyword}")`);
      
      // Check for exact match first
      if (normalizedResume.includes(normalizedKeyword)) {
        console.log(`Found exact match for: ${keyword}`);
        matches.set(keyword, 'match');
        return;
      }

      // Check for word boundary matches
      const keywordParts = normalizedKeyword.split(/\s+/);
      const allPartsMatch = keywordParts.every(part => {
        const hasMatch = normalizedResume.includes(part);
        console.log(`Checking part "${part}" of "${keyword}": ${hasMatch ? 'found' : 'not found'}`);
        return hasMatch;
      });
      
      if (allPartsMatch) {
        console.log(`Found partial match for: ${keyword}`);
        matches.set(keyword, 'partial-match');
      } else {
        console.log(`No match found for: ${keyword}`);
        matches.set(keyword, 'no-match');
      }
    });

    console.log('Final matches:', Object.fromEntries(matches));
    return matches;
  }

  // Find matches in skills database
  static findSkillMatches(keywords, skills) {
    if (!skills || !Array.isArray(skills)) return new Map();
    const matches = new Map();
    const skillNames = skills.map(s => this.normalizeText(s.skill));

    keywords.forEach(keyword => {
      const normalizedKeyword = this.normalizeText(keyword);
      
      if (skillNames.some(skill => skill === normalizedKeyword)) {
        matches.set(keyword, 'match');
      } else if (skillNames.some(skill => 
        skill.includes(normalizedKeyword) || normalizedKeyword.includes(skill)
      )) {
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