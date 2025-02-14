export class CoverLetterManager {
    constructor(databaseManager) {
        this.db = databaseManager;
    }

    async generateCoverLetter(jobPosting, skills, resumeText = null, existingCoverLetter = null) {
        try {
            const apiKey = await this.db.getField('geminiApiKey');
            if (!apiKey) {
                throw new Error('Please enter your API key in the Settings tab first.');
            }

            // Format skills into a concise string
            const skillsString = skills.map(s => 
                `${s.skill} (${s.level}${s.yearsExperience ? `, ${s.yearsExperience} years` : ''})`
            ).join('; ');

            // Prepare the prompt for the AI
            let prompt = {
                task: existingCoverLetter ? 'modify_cover_letter' : 'generate_cover_letter',
                instructions: `You are a professional cover letter writer. ${
                    existingCoverLetter 
                        ? 'Please modify the existing cover letter to better match the job requirements while maintaining its general structure.' 
                        : 'Please write a professional cover letter that demonstrates why the candidate would be a great fit for this role.'
                }
                
                The response must be a valid JSON object with exactly these fields:
                1. cover_letter_text: The complete cover letter text
                2. explanation: A one-sentence explanation of how this cover letter matches the job requirements
                
                Do not include any markdown formatting or code blocks in your response. The response should be pure JSON.`,
                job_posting: jobPosting,
                candidate_skills: skillsString,
                resume: resumeText,
                existing_cover_letter: existingCoverLetter
            };

            // Call the Gemini API
            const model = await this.db.getField('geminiModel') || 'gemini-1.5-pro';
            const response = await fetch('https://generativelanguage.googleapis.com/v1/models/' + model + ':generateContent?key=' + apiKey, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: JSON.stringify(prompt)
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate cover letter. Please try again.');
            }

            const data = await response.json();
            
            // Parse the response text as JSON
            try {
                // Clean up the response text by removing any markdown formatting
                let responseText = data.candidates[0].content.parts[0].text;
                responseText = responseText.replace(/```json\n?|\n?```/g, '').trim();
                
                const aiResponse = JSON.parse(responseText);
                
                // Validate the response has the required fields
                if (!aiResponse.cover_letter_text || !aiResponse.explanation) {
                    throw new Error('Invalid response format from AI');
                }
                
                return {
                    coverLetterText: aiResponse.cover_letter_text,
                    explanation: aiResponse.explanation
                };
            } catch (error) {
                console.error('Error parsing AI response:', error);
                throw new Error('Failed to parse AI response. Please try again.');
            }
        } catch (error) {
            console.error('Error generating cover letter:', error);
            throw error;
        }
    }
} 