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
            text: `Extract skills and education from this resume text. Respond ONLY with a JSON object in this exact format:
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