// import { getMockResponse } from './mock-api.js';]
import { CONFIG } from "./constants.js"
const IS_DEVELOPMENT = true; // Toggle this for development/production

const TEST_RESPONSES = {
  "initialSummary": {
    "id": "msg_123abc",
    "type": "message",
    "role": "assistant",
    "model": "claude-3-5-sonnet-20241022",
    "content": [
      {
        "type": "text",
        "text": "This appears to be a Chrome extension called 'Page Assistant' that creates an interactive side panel for webpage content analysis. The extension includes several key components:\n\n1. A manifest file configuring the extension's permissions and structure\n2. UI components with styles for a chat-like interface\n3. Background scripts for handling API communication\n4. A sidepanel implementation for user interactions\n5. Integration with the Anthropic API for content analysis\n\nThe extension allows users to ask questions about webpage content and receive AI-powered responses with follow-up suggestions.\n\n[\"What security measures and permissions does the extension require?\", \"How does the extension handle the communication between the frontend and the Anthropic API?\", \"What are the key UI components and how do they enhance user experience?\"]"
      }
    ]
  },
  "default": {
    "id": "msg_default",
    "type": "message",
    "role": "assistant",
    "model": "claude-3-5-sonnet-20241022",
    "content": [
      {
        "type": "text",
        "text": "I've analyzed the content and here's what I found:\n\nThis appears to be some webpage content that you'd like to understand better. I'll help you break it down and explore its key points.\n\n[\"Would you like to explore any specific aspect?\", \"Should we analyze the main topics in detail?\", \"What particular part interests you the most?\"]"
      }
    ]
  },
  "error": {
    "id": "msg_error",
    "type": "message",
    "role": "assistant",
    "model": "claude-3-5-sonnet-20241022",
    "content": [
      {
        "type": "text",
        "text": "I apologize, but I encountered an error while processing your request. Please try rephrasing your question or try again later.\n\n[\"Would you like to try a different question?\", \"Should we start with a simpler query?\", \"Would you like to refresh and try again?\"]"
      }
    ]
  }
};

// Mock API function that simulates delay
function getMockResponse(messages) {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const question = messages[0]?.content;

        // Return different responses based on the question
        if (!question || question === CONFIG.PROMPTS.INITIAL_QUESTION) {
          return resolve(TEST_RESPONSES.initialSummary);
        } else if (question.toLowerCase().includes('error')) {
          return resolve(TEST_RESPONSES.error);
        } else {
          return resolve(TEST_RESPONSES.default);
        }
      } catch (error) {
        console.log(error);
        resolve(TEST_RESPONSES.error);
      }
    }, 1000); // Simulate network delay
  });
}




const API_CONFIG = {
  ENDPOINT: 'https://api-backend-gamma-two.vercel.app/api/chat'
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
      },
      body: JSON.stringify({
        content: content,  // Send the page content
        messages: messages
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