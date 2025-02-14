// Content script for handling communication between extension and web pages
console.log('Content script loaded');

// Flag to track if the content script is ready
let isReady = false;

// Function to initialize the content script
function initialize() {
  if (isReady) return;
  isReady = true;
  
  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    try {
      if (request.action === 'getSelectedText') {
        const selectedText = window.getSelection().toString().trim();
        console.log('Selected text:', selectedText);
        sendResponse({ text: selectedText });
      } else if (request.action === 'isContentScriptReady') {
        sendResponse({ ready: true });
      } else if (request.action === 'extractJobContent') {
        const jobContent = extractJobContent();
        sendResponse(jobContent);
      }
    } catch (error) {
      console.error('Content script error:', error);
      sendResponse({ error: error.message });
    }
    
    return true; // Required to use sendResponse asynchronously
  });

  // Notify that content script is ready
  chrome.runtime.sendMessage({ action: 'contentScriptReady' })
    .catch(error => console.log('Failed to notify ready state:', error));
}

// Initialize immediately since we're using document_start
initialize();

// Also initialize when the document is fully loaded (backup)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Listen for messages from the extension
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'jobApp') {
    port.onMessage.addListener((msg) => {
      if (msg.action === 'getSelectedText') {
        const selectedText = window.getSelection().toString();
        port.postMessage({ text: selectedText });
      }
    });
  }
});

// Function to extract job posting content
function extractJobContent() {
  // Get the main content of the page
  const body = document.body.innerText;
  
  // Try to find the job title - look for common heading elements
  const possibleTitleElements = document.querySelectorAll('h1, [class*="title" i], [class*="position" i]');
  let title = '';
  for (const element of possibleTitleElements) {
    if (element.innerText.length > 0 && element.innerText.length < 200) {
      title = element.innerText.trim();
      break;
    }
  }

  // Try to find the job description - look for common job description containers
  const possibleDescElements = document.querySelectorAll('[class*="description" i], [class*="details" i], [class*="content" i], article, main');
  let description = '';
  for (const element of possibleDescElements) {
    const text = element.innerText.trim();
    if (text.length > 200) { // Assuming job descriptions are usually longer
      description = text;
      break;
    }
  }

  // If no specific container found, use the body text
  if (!description) {
    description = body;
  }

  return {
    title,
    description
  };
} 