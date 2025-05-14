import { getMockResponse } from './mock-api.js';
import { CONFIG } from './constants.js';
const IS_DEVELOPMENT = false; // Toggle this for development/production

const API_CONFIG = {
  ENDPOINT: 'https://openai-server-lauren.vercel.app/api/chat'
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

// Handle getting page content
async function handleApiRequest({ content, messages }) {

  if (IS_DEVELOPMENT) {
    try {
      const response = await getMockResponse(messages);

      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  try {
    const response = await fetch(API_CONFIG.ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-project-name': 'PageAssis'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: CONFIG.PROMPTS.SYSTEM(content) },
          ...messages
        ],
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      throw new Error(response.error?.message || JSON.stringify(response.error) || 'Unknown error');
    }

    const data = await response.json();
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
