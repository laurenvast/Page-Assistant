export const TEST_RESPONSES = {
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

import { CONFIG } from "./constants.js"

// Mock API function that simulates delay
export function getMockResponse(messages) {
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
    }, 3000); // Simulate network delay
  });
}

