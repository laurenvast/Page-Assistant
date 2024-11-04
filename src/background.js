import { API_KEY } from './config';

const API_CONFIG = {
  ENDPOINT: 'https://api.anthropic.com/v1/messages',
  VERSION: '2023-06-01',
  MODEL: 'claude-3-5-sonnet-20241022',
  MAX_TOKENS: 1024,
  KEY: API_KEY
};

// Handle messages from sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_PAGE_CONTENT') {
    handleGetPageContent(request.tabId).then(sendResponse);
    return true; // Keep the message channel open for async response
  }

  if (request.type === 'MAKE_API_REQUEST') {
    handleApiRequest(request.data).then(sendResponse);
    return true;
  }
});

// Handle getting page content
async function handleGetPageContent(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (targetSelector) => {
        const container = document.querySelector(targetSelector);
        return container ? container.innerText : null;
      },
      args: ['body'] // Default to body, can be made configurable
    });

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle API requests
async function handleApiRequest({ systemPrompt, userPrompt }) {
  try {
    const response = await fetch(API_CONFIG.ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_CONFIG.KEY,
        'anthropic-version': API_CONFIG.VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: API_CONFIG.MODEL,
        max_tokens: API_CONFIG.MAX_TOKENS,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || JSON.stringify(data.error) || 'Unknown error');
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Set up side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});