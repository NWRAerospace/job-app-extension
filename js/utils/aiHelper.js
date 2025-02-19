// AI Helper module for handling Gemini API interactions
export class AIHelper {
  static async getJobAssessment(jobText, userSkills, apiKey) {
    const model = await this._getSelectedModel();
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    const prompt = `Analyze this job posting and the candidate's skills. Extract ONLY concise keywords that an employer's ATS (Applicant Tracking System) would scan for. Each keyword must be 1-3 words maximum. Respond ONLY with a JSON object in this exact format:
{
  "title": "Job title extracted from posting",
  "company": "Company/organization name from posting (or null if not found)",
  "rating": number from 1-10 indicating fit,
  "keywords": exactly 15 most important skills/requirements from the job posting as an array of strings. Each keyword MUST be 1-3 words maximum and represent a specific skill, technology, qualification, or requirement. Do not include full sentences or long phrases.,
  "rationale": "Brief assessment focusing on key matches and gaps. Maximum 50 words."
}

Job Posting:
${jobText}

Candidate Skills:
${userSkills.map(s => `${s.skill} (${s.level}${s.yearsExperience ? `, ${s.yearsExperience}yrs` : ''})`).join(', ')}`;

    return await this._makeGeminiRequest(geminiApiUrl, prompt, apiKey);
  }

  static async analyzeResume(resumeText, apiKey) {
    const model = await this._getSelectedModel();
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    const prompt = `Analyze this resume text and extract skills, education, and work/volunteer experience information. Be thorough and try to identify ALL relevant information. IMPORTANT: All dates MUST be in YYYY-MM-DD format. Respond ONLY with a JSON object in this exact format:
{
  "skills": [
    {
      "skill": "Name of skill",
      "level": "Beginner" | "Intermediate" | "Expert",
      "yearsExperience": number | null
    }
  ],
  "education": [
    {
      "type": "degree" | "certification" | "course",
      "title": "Full title/name",
      "institution": "Institution name",
      "startDate": "YYYY-MM-DD", // MUST be in this exact format
      "endDate": "YYYY-MM-DD" | null, // MUST be in this exact format if not null
      "inProgress": boolean,
      "description": "Brief description or relevant coursework",
      "gpa": "GPA value" | null,
      "url": "certificate URL" | null,
      "expiryDate": "YYYY-MM-DD" | null // MUST be in this exact format if not null
    }
  ],
  "experiences": [
    {
      "type": "job" | "volunteer" | "internship" | "project",
      "title": "Job/position title",
      "company": "Company/organization name",
      "location": "City, State/Country" | null,
      "startDate": "YYYY-MM-DD", // MUST be in this exact format
      "endDate": "YYYY-MM-DD" | null, // MUST be in this exact format if not null
      "inProgress": boolean,
      "description": "Brief description of responsibilities and achievements",
      "linkedSkills": [] // Will be populated by user later
    }
  ]
}

For dates where only month and year are available, use the first day of the month (e.g., "2020-06-01"). For dates where only year is available, use January 1st (e.g., "2020-01-01").

Resume Text:
${resumeText}`;

    return await this._makeGeminiRequest(geminiApiUrl, prompt, apiKey);
  }

  static async enhanceResume(resumeText, jobText, options, skills, education, experiences, apiKey) {
    const model = await this._getSelectedModel();
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    const targetWordCount = options.resumeLength === 'one' ? '450-650' : '800-1200';
    const rewriteMode = options.enhancementMode;
    
    let prompt = `Enhance this resume to better target the provided job posting. Follow these specific instructions:

1. Target Length: ${targetWordCount} words
2. Enhancement Mode: ${rewriteMode === 'minor' ? 'Conservative improvements with minimal changes' : 'Comprehensive restructuring'}
3. Format: Return plain text with clear section headers and bullet points
4. Keywords: ONLY incorporate keywords that appear in the job posting. Do not add skills from the candidate's background unless they are specifically mentioned in the job posting.
5. STAR Format: Each bullet point should tell a complete story in a single sentence that naturally incorporates:
   - The Situation/context
   - The specific Task/challenge
   - The Actions taken
   - The measurable Results/impact
   Example: "Reduced processing time by 40% by designing and implementing an automated workflow system to address critical bottlenecks in the company's data pipeline."
   NOT: "Situation: ... Task: ... Action: ... Result: ..."
6. Sections to Include: ${[
      options.includeSkills ? 'Skills' : null,
      options.includeEducation ? 'Education' : null,
      options.includeExperience ? 'Experience' : null
    ].filter(Boolean).join(', ')}

Enhancement Guidelines:
${rewriteMode === 'minor' ? `
- Make minimal changes to improve clarity and impact
- Only add keywords that appear in the job posting
- Improve poorly written sentences
- Convert relevant experience points to STAR format in a natural way
- Maintain most of the original content and structure` : `
- Comprehensively restructure the resume
- Prioritize experiences most relevant to the job
- Only incorporate keywords from the job posting
- Rewrite experience points in STAR format naturally
- Focus on achievements and measurable results
- Optimize section ordering for this specific role`}

Job Posting:
${jobText}

Current Resume:
${resumeText}

${options.includeSkills ? `Skills to Consider:\n${skills.map(s => `${s.skill} (${s.level}${s.yearsExperience ? `, ${s.yearsExperience}yrs` : ''})`).join(', ')}` : ''}

${options.includeEducation ? `Education to Consider:\n${education.map(e => `${e.title} from ${e.institution}`).join('\n')}` : ''}

${options.includeExperience ? `Experience to Consider:\n${experiences.map(e => `${e.title} at ${e.company}`).join('\n')}` : ''}

Respond ONLY with a JSON object in this exact format:
{
  "enhanced_resume": "The complete enhanced resume text with proper formatting",
  "word_count": number,
  "changes_made": [
    "List of main changes/improvements made"
  ],
  "keywords_added": [
    "List of relevant keywords from the job posting that were incorporated"
  ]
}`;

    return await this._makeGeminiRequest(geminiApiUrl, prompt, apiKey);
  }

  static async generateQAResponse(question, resume, skills, education, apiKey, jobContext = null, limitOptions = null) {
    const model = await this._getSelectedModel();
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    const prompt = `Given the following job application question and candidate information, generate a concise, professional answer. ${
      limitOptions 
        ? `Keep the answer within ${limitOptions.limit} ${limitOptions.type} (STRICT LIMIT).` 
        : 'Unless the question specifically asks for multiple paragraphs or specifies a word/paragraph count, provide only one short paragraph.'
    }

Question: ${question}

${jobContext ? `Job Context:\n${jobContext}\n\n` : ''}Candidate Information:
Resume: ${resume}
Skills: ${skills.map(s => `${s.skill} (${s.level}${s.yearsExperience ? `, ${s.yearsExperience}yrs` : ''})`).join(', ')}
Education: ${education.map(e => `${e.title} from ${e.institution}`).join(', ')}

Respond ONLY with a JSON object in this exact format:
{
  "answer": "The generated answer text",
  "wordCount": number,
  "charCount": number,
  "confidence": number from 0-1 indicating how well the answer matches the candidate's background
}`;

    return await this._makeGeminiRequest(geminiApiUrl, prompt, apiKey);
  }

  static async _getSelectedModel() {
    try {
      const model = await DatabaseManager.getField('geminiModel');
      return model || 'gemini-pro'; // Default to gemini-pro if not set
    } catch (error) {
      console.warn('Error getting model from database, using default:', error);
      return 'gemini-pro';
    }
  }

  static async _makeGeminiRequest(apiUrl, prompt, apiKey) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        }),
      });

      if (!response.ok) {
        const errorDetails = await response.json();
        console.error('API Error Details:', errorDetails);
        throw new Error(`API Error: ${errorDetails.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!responseText) {
        throw new Error('Empty response from API');
      }

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Gemini API request error:', error);
      throw new Error(`API request failed: ${error.message}`);
    }
  }
} 