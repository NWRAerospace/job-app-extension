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
   - Include only information that has been explicitly provided and allowed
5. Information sources and their use:
   - Resume text: General background and full work history (if included)
   - Experience entries: Specific, curated work and project experience (if included)
   - Education entries: Academic background and certifications (if included)
   - Skills list: Technical and professional capabilities (if included)
6. Content guidelines:
   - Only mention information from sources marked as included
   - When both resume and experience are included, prioritize experience entries as they are more curated
   - Focus on connecting provided information to job requirements
   - Never mention information that was not provided or was marked as not to be included
7. Write a compelling letter using ONLY the information explicitly provided and allowed

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

            if (!resumeText && options.includeResume) {
                throw new Error('Please select a resume before generating a cover letter with resume information.');
            }

            // Get education data only if it should be included
            let educationString = '';
            if (options.includeEducation) {
                const education = await this.db.getField('education') || [];
                educationString = education.map(edu => 
                    `${edu.type}: ${edu.title} from ${edu.institution}${edu.inProgress ? ' (In Progress)' : edu.endDate ? ` (Completed ${new Date(edu.endDate).getFullYear()})` : ''}`
                ).join('; ');
            }

            // Get experience data if it should be included
            let experienceString = '';
            if (options.includeExperience) {
                const experiences = await this.db.getField('experiences') || [];
                experienceString = experiences.map(exp => 
                    `${exp.type}: ${exp.title} at ${exp.company}${exp.location ? ` in ${exp.location}` : ''}` +
                    `${exp.inProgress ? ' (Current)' : exp.endDate ? ` (${new Date(exp.startDate).getFullYear()} - ${new Date(exp.endDate).getFullYear()})` : ''}` +
                    `${exp.description ? ` - ${exp.description}` : ''}`
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
${options.includeResume ? '- Use information from the provided resume' : '- Do not use information from the resume'}
${options.includeExperience ? '- Include work and project experience provided in the experience section' : '- Do not include work or project experience'}
${options.includeEducation ? '- Include education information in the first paragraph' : '- Do not include education information'}
${options.includeSkills ? '- Incorporate provided skills list where relevant' : '- Do not mention skills from the skills list'}`;

            // Get special instructions from options
            const specialInstructions = options.specialInstructions || '';

            // Prepare the prompt for the AI
            let prompt = {
                task: existingCoverLetter ? 'modify_cover_letter' : 'generate_cover_letter',
                instructions: `${this.basePrompt}

${toneInstructions}

${paragraphInstruction}

${dataInclusion}

SPECIAL USER REQUEST (HIGH PRIORITY):
${specialInstructions ? specialInstructions : 'No special instructions provided.'}

${existingCoverLetter ? 'Modify the existing cover letter to better match the job requirements while maintaining the exact paragraph structure specified above.' : ''}`,
                job_posting: jobPosting,
                candidate_skills: skillsString,
                candidate_education: educationString,
                candidate_experience: experienceString,
                resume: options.includeResume ? resumeText : null,
                existing_cover_letter: existingCoverLetter,
                specialInstructions: specialInstructions
            };

            // Debug: log the prompt before sending
            console.log("Prompt object to be sent to AI:", prompt);

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