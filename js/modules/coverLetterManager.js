export class CoverLetterManager {
    constructor(databaseManager) {
        this.db = databaseManager;
        this.tonePrompts = {
            eager: `Use an enthusiastic and eager tone. Show genuine excitement about the opportunity while maintaining professionalism. Use words that convey enthusiasm and eagerness to contribute, but avoid being overly informal or unprofessional.`,
            
            professional: `Use a confident, seasoned professional tone. Focus on facts and achievements without supplicative language. Make strong, authoritative statements about capabilities and fit. Avoid words like "excited," "hoping," or "would love to." Instead, use phrases that demonstrate proven expertise and assured capability.`,
            
            expressive: `Use eloquent, creative language while maintaining professionalism. Incorporate thoughtful metaphors or analogies where appropriate. Use varied vocabulary and expressive phrasing to demonstrate personality and creative thinking, while ensuring all statements remain relevant to the position.`
        };

        this.basePrompt = `You are a professional cover letter writer. Create a cover letter that demonstrates the candidate's qualifications and fit for the role.

CRITICAL REQUIREMENTS (ALWAYS FOLLOW THESE):
1. NEVER make up or assume ANY details about the candidate's:
   - Education
   - Work experience
   - Skills
   - Certifications
   - Personal characteristics
   - Or any other qualifications
2. Do not make claims about security clearances or clearance eligibility
3. Structure the letter with EXACTLY:
   - A greeting (e.g., "Dear Hiring Manager,")
   - The specified number of body paragraphs between the greeting and sign-off
   - A professional sign-off (e.g., "Best regards," or "Sincerely,")
4. First paragraph MUST:
   - Begin with a strong introduction
   - State the position being applied for
   - If education is included, mention it here
   - If no education is included, lead with the most relevant work experience
5. Remaining paragraphs should:
   - Focus on connecting experience from the resume to job requirements
   - If skills list is included, incorporate relevant skills naturally
   - Never mention skills or qualifications not explicitly provided
6. Prioritize information in this order:
   a. Education (if included, always in first paragraph)
   b. Direct experience from resume matching job requirements
   c. Skills from skills list (if included) that aren't mentioned in resume
7. Write a compelling letter using ONLY the information explicitly provided

The response must be a valid JSON object with exactly these fields:
1. cover_letter_text: The complete cover letter text
2. explanation: A one-sentence explanation of how this cover letter matches the job requirements

Do not include any markdown formatting or code blocks in your response. The response should be pure JSON.`;
    }

    async generateCoverLetter(jobPosting, skills, options = {}, resumeText = null, existingCoverLetter = null) {
        try {
            const apiKey = await this.db.getField('geminiApiKey');
            if (!apiKey) {
                throw new Error('Please enter your API key in the Settings tab first.');
            }

            if (!resumeText) {
                throw new Error('Please select a resume before generating a cover letter. The AI needs your resume to create a targeted letter.');
            }

            // Get education data only if it should be included
            let educationString = '';
            if (options.includeEducation) {
                const education = await this.db.getField('education') || [];
                educationString = education.map(edu => 
                    `${edu.type}: ${edu.title} from ${edu.institution}${edu.inProgress ? ' (In Progress)' : edu.endDate ? ` (Completed ${new Date(edu.endDate).getFullYear()})` : ''}`
                ).join('; ');
            }

            // Format skills into a concise string only if they should be included
            let skillsString = '';
            if (options.includeSkills) {
                skillsString = skills.map(s => 
                    `${s.skill} (${s.level}${s.yearsExperience ? `, ${s.yearsExperience} years` : ''})`
                ).join('; ');
            }

            // Get tone-specific instructions
            const toneInstructions = this.tonePrompts[options.tone || 'eager'];

            // Create paragraph count instruction
            const paragraphCount = options.paragraphCount || 3;
            const paragraphInstruction = `CRITICAL INSTRUCTION: The cover letter must have EXACTLY ${paragraphCount} body paragraphs between the greeting ("Dear...") and the sign-off ("Sincerely..." etc). This is a strict requirement. The final structure must be:
1. Greeting line ("Dear...")
2. Exactly ${paragraphCount} body paragraphs
3. Sign-off line ("Sincerely..." etc)`;

            // Add data inclusion instructions
            const dataInclusion = `CONTENT INCLUSION INSTRUCTIONS:
${options.includeEducation ? '- Include education information in the first paragraph' : '- Lead with most relevant work experience'}
${options.includeSkills ? '- Incorporate provided skills list where relevant' : '- Focus solely on experience from resume'}`;

            // Prepare the prompt for the AI
            let prompt = {
                task: existingCoverLetter ? 'modify_cover_letter' : 'generate_cover_letter',
                instructions: `${this.basePrompt}

${toneInstructions}

${paragraphInstruction}

${dataInclusion}

${existingCoverLetter ? 'Modify the existing cover letter to better match the job requirements while maintaining the exact paragraph structure specified above.' : ''}`,
                job_posting: jobPosting,
                candidate_skills: skillsString,
                candidate_education: educationString,
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