// Background script for handling message passing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractSkillsAndEducation') {
    handleSkillsExtraction(request.text)
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

async function handleSkillsExtraction(text) {
  try {
    // Get API key from storage
    const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
    if (!geminiApiKey) {
      throw new Error('API key not found. Please add your API key in settings.');
    }

    // Make API request to extract skills and education
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze this resume text thoroughly and extract ALL skills and education information. Be comprehensive in identifying skills from the entire resume not just one section, including:

1. Technical skills (programming languages, tools, platforms)
2. Professional skills (project management, team leadership, client relations)
3. Industry-specific skills (marketing, finance, healthcare, etc.)
4. Soft skills (communication, problem-solving, time management)
5. Process/methodology skills (Agile, Six Sigma, etc.)
6. Domain expertise (data analysis, web development, etc.)
7. Look for skills implied by achievements (e.g., "increased sales by 50%" implies sales and business development skills)
8. Consider responsibilities that indicate skills (e.g., "managed team of 5" implies leadership and team management)

For each skill, assess the level based on context, responsibilities, and achievements described, as well as number of years they have with the skill if possible. Each skill should ideally be one word, up to three words maximum.

Respond ONLY with a JSON object in this exact format:
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
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD" | null,
      "inProgress": boolean,
      "description": "Brief description or relevant coursework",
      "gpa": "GPA value" | null,
      "url": "certificate URL" | null,
      "expiryDate": "YYYY-MM-DD" | null
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
    
    return JSON.parse(jsonMatch[0]);
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

  // Create add new Q&A context menu
  chrome.contextMenus.create({
    id: 'addNewQA',
    title: 'Add as New Q&A',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'searchQA' || info.menuItemId === 'addNewQA') {
    // Get the selected text
    const selectedText = info.selectionText;
    
    // Send message to popup to either search or add new Q&A
    chrome.runtime.sendMessage({
      action: info.menuItemId,
      text: selectedText
    });
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchQA' || request.action === 'addNewQA') {
    // Forward the message to the popup if it's open
    chrome.runtime.sendMessage(request);
  }
}); 