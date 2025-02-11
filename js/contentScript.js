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