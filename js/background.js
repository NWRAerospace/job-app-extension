// Background script for handling message passing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractSkillsAndEducation') {
    handleSkillsExtraction(request.text, request.apiKey)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Will respond asynchronously
  }
});

// Handle connections from popup
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'jobApp') {
    port.onMessage.addListener(async (msg) => {
      if (msg.action === 'getSelectedText') {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id) throw new Error('No active tab found');
          
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
          port.postMessage({ text: response?.text || '' });
        } catch (error) {
          port.postMessage({ error: error.message });
        }
      }
    });
  }
});

async function handleSkillsExtraction(text, apiKey) {
  try {
    // Check API key
    if (!apiKey) {
      throw new Error('API key not found. Please add your API key in settings.');
    }

    // Make API request to extract skills and education
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze this resume text thoroughly and extract ALL skills, education, and work/volunteer experience information. Be comprehensive in identifying information from the entire resume, including:

1. Skills:
   - Technical skills (programming languages, tools, platforms)
   - Professional skills (project management, team leadership)
   - Industry-specific skills (marketing, finance, healthcare)
   - Soft skills (communication, problem-solving)
   - Process/methodology skills (Agile, Six Sigma)
   - Domain expertise (data analysis, web development)
   - Skills implied by achievements
   - Skills indicated by responsibilities

2. Education:
   - Degrees and certifications
   - Courses and training
   - Academic achievements
   - Relevant coursework

3. Experience:
   - Job positions and roles
   - Company/organization names
   - Dates (MUST be in format YYYY-MM-DD, e.g. "2022-03-15")
   - Locations
   - Brief summary of role (STRICT 15-20 WORD LIMIT)

For each skill, assess the level based on context, responsibilities, and achievements described.

IMPORTANT FORMATTING RULES:
1. DATE FORMATTING:
   - All dates MUST be in YYYY-MM-DD format
   - For dates with only month and year, use the first of the month (e.g., "2022-03-01")
   - For dates with only a year, use January 1st (e.g., "2022-01-01")
   - Current/ongoing dates should have inProgress set to true and endDate as null
   - Never return "invalid date" or partial dates

2. EXPERIENCE DESCRIPTIONS:
   - STRICT 15-20 word limit for each description
   - Focus on core responsibilities and key achievements only
   - Omit articles (a, an, the) when possible to save word count
   - No bullet points or lists

Respond ONLY with a JSON object in this exact format:
{
  "skills": [
    {
      "skill": "Name of skill (1-3 words maximum)",
      "level": "Beginner" | "Intermediate" | "Expert",
      "yearsExperience": number | null
    }
  ],
  "education": [
    {
      "type": "degree" | "certification" | "course",
      "title": "Full title/name",
      "institution": "Institution name",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD" | null,
      "inProgress": boolean,
      "description": "Brief description or relevant coursework",
      "gpa": "GPA value" | null,
      "url": "certificate URL" | null,
      "expiryDate": "YYYY-MM-DD" | null
    }
  ],
  "experiences": [
    {
      "type": "job" | "volunteer" | "internship" | "project",
      "title": "Job/position title",
      "company": "Company/organization name",
      "location": "City, State/Country" | null,
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD" | null,
      "inProgress": boolean,
      "description": "Brief summary of role (15-20 words maximum)"
    }
  ]
}

Resume Text:
${text}`
          }]
        }]
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error('Empty response from API');
    }

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }
    
    const parsedResponse = JSON.parse(jsonMatch[0]);
    console.log('Parsed AI response:', parsedResponse);
    
    // Ensure all required fields exist
    if (!parsedResponse.skills || !parsedResponse.education || !parsedResponse.experiences) {
      console.error('Missing required fields in response:', parsedResponse);
      throw new Error('AI response is missing required data fields');
    }
    
    return parsedResponse;
  } catch (error) {
    console.error('Skills extraction error:', error);
    throw error;
  }
}

// Create context menu items
chrome.runtime.onInstalled.addListener(() => {
  // Create Q&A search context menu
  chrome.contextMenus.create({
    id: 'searchQA',
    title: 'Search Q&A for "%s"',
    contexts: ['selection']
  });

  // Create job assessment context menu
  chrome.contextMenus.create({
    id: 'assessJob',
    title: 'Assess Job Posting',
    contexts: ['page']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'searchQA') {
    // Get the selected text
    const selectedText = info.selectionText;
    
    // Open the extension popup if not already open
    await chrome.action.openPopup();
    
    // Send message to popup to search Q&A
    chrome.runtime.sendMessage({
      action: 'searchQA',
      text: selectedText,
      openQATab: true // Signal to open Q&A tab
    });
  } else if (info.menuItemId === 'assessJob') {
    try {
      // Get job content from the page
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractJobContent' });
      
      if (response.error) {
        throw new Error(response.error);
      }

      // Open the popup
      await chrome.action.openPopup();

      // Wait a short moment for the popup to initialize
      setTimeout(() => {
        // Send the job content to the popup for assessment
        chrome.runtime.sendMessage({
          action: 'assessJobPosting',
          text: `${response.title ? response.title + '\n\n' : ''}${response.description}`
        });
      }, 500); // Give the popup time to initialize

    } catch (error) {
      console.error('Error assessing job:', error);
      // Show an error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'Job Assessment Error',
        message: 'Failed to extract job content. Please try refreshing the page.'
      });
    }
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchQA' || request.action === 'addNewQA') {
    // Forward the message to the popup if it's open
    chrome.runtime.sendMessage(request);
  }
}); 