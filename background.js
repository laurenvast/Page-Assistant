import { getMockResponse } from './mock-api.js';
import { CONFIG } from './constants.js';

// Development mode will be controlled via options page
let IS_DEVELOPMENT = false;

// Load development mode setting from storage
chrome.storage.local.get({ devMode: false }, function(data) {
  IS_DEVELOPMENT = data.devMode;
  console.log('Development mode loaded from storage:', IS_DEVELOPMENT);
});

// Listen for changes to the development mode setting
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local' && changes.devMode) {
    IS_DEVELOPMENT = changes.devMode.newValue;
    console.log('Development mode updated:', IS_DEVELOPMENT);
  }
});

const API_CONFIG = {
  ENDPOINT: 'https://openai-server-lauren.vercel.app/api/chat'
};

// Track the original tab that opened the sidepanel
// This is the tab that the chat content is about and should not change when navigating
let originalTab = null;

// Function to save the original tab to storage
const saveOriginalTab = async (tab) => {
  try {
    await chrome.storage.local.set({ originalTab: tab });
    console.log('Original tab saved to storage:', tab);
  } catch (error) {
    console.error('Error saving original tab to storage:', error);
  }
};

// Function to load the original tab from storage
const loadOriginalTab = async () => {
  try {
    const data = await chrome.storage.local.get(['originalTab']);
    if (data.originalTab) {
      originalTab = data.originalTab;
      console.log('Original tab loaded from storage:', originalTab);
    }
  } catch (error) {
    console.error('Error loading original tab from storage:', error);
  }
};

// Load the original tab from storage when the background script starts
loadOriginalTab();

// Function to get full tab information
const getFullTabInfo = async (tabId) => {
  try {
    return await chrome.tabs.get(tabId);
  } catch (error) {
    console.error('Error getting tab info:', error);
    return null;
  }
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

  if (request.type === 'GET_ORIGINAL_TAB') {
    console.log('GET_ORIGINAL_TAB request received, current originalTab:', originalTab);
    
    // If originalTab is null, try to load it from storage first
    if (!originalTab) {
      // We need to load from storage and then respond
      chrome.storage.local.get(['originalTab'], (data) => {
        if (data.originalTab) {
          originalTab = data.originalTab;
          console.log('Loaded originalTab from storage:', originalTab);
          
          // Now check if we have a valid tab and get the latest info
          if (originalTab && originalTab.id) {
            getFullTabInfo(originalTab.id).then(tabInfo => {
              console.log('Sending updated tab info:', tabInfo);
              if (tabInfo) {
                originalTab = tabInfo; // Update our stored tab with latest info
                saveOriginalTab(originalTab); // Save the updated tab info
              }
              sendResponse({ tab: originalTab });
            }).catch(error => {
              console.error('Error getting tab info:', error);
              sendResponse({ tab: originalTab });
            });
          } else {
            sendResponse({ tab: originalTab });
          }
        } else {
          console.log('No originalTab found in storage');
          sendResponse({ tab: null });
        }
      });
      return true; // Keep the message channel open for async response
    }
    
    // If we have an originalTab with an ID, get the latest info
    if (originalTab && originalTab.id) {
      getFullTabInfo(originalTab.id).then(tabInfo => {
        console.log('Sending updated tab info:', tabInfo);
        if (tabInfo) {
          originalTab = tabInfo; // Update our stored tab with latest info
          saveOriginalTab(originalTab); // Save the updated tab info
        }
        sendResponse({ tab: originalTab });
      }).catch(error => {
        console.error('Error getting tab info:', error);
        sendResponse({ tab: originalTab });
      });
      return true; // Keep the message channel open for async response
    } else {
      // If we don't have an originalTab, just send what we have
      sendResponse({ tab: originalTab });
      return false;
    }
  }

  if (request.type === 'NAVIGATE_TO_ORIGINAL_TAB') {
    // Get the tab ID and URL directly from the request
    const tabId = request.tabId;
    const url = request.url;
    console.log('NAVIGATE_TO_ORIGINAL_TAB request received with tabId:', tabId, 'and url:', url);
    
    if (tabId) {
      // First check if the tab still exists
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.log('Tab no longer exists:', chrome.runtime.lastError.message);
          
          // If the tab doesn't exist but we have a URL, open a new tab with that URL
          if (url) {
            console.log('Opening new tab with URL:', url);
            chrome.tabs.create({ url: url, active: true }, (newTab) => {
              console.log('New tab created:', newTab);
              sendResponse({ success: true, newTab: true, tabId: newTab.id });
            });
          } else {
            console.error('Tab no longer exists and no URL provided');
            sendResponse({ success: false, error: 'Tab no longer exists and no URL provided' });
          }
        } else {
          // Tab exists, activate it
          chrome.tabs.update(tabId, { active: true }, (updatedTab) => {
            if (chrome.runtime.lastError) {
              console.error('Chrome runtime error:', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('Tab activated with ID:', tabId);
              sendResponse({ success: true, newTab: false });
            }
          });
        }
      });
      return true; // Keep the message channel open for async response
    } else if (url) {
      // No tab ID but we have a URL, so open a new tab
      console.log('No tab ID but opening new tab with URL:', url);
      chrome.tabs.create({ url: url, active: true }, (newTab) => {
        console.log('New tab created:', newTab);
        sendResponse({ success: true, newTab: true, tabId: newTab.id });
      });
      return true;
    } else {
      console.error('No tab ID or URL provided in the request');
      sendResponse({ success: false, error: 'No tab ID or URL provided' });
      return false;
    }
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

chrome.action.onClicked.addListener(async (tab) => {
  console.log('Action clicked, tab:', tab);
  // Store the original tab when the sidepanel is opened
  // Get full tab information to ensure we have complete details
  const fullTabInfo = await getFullTabInfo(tab.id);
  originalTab = fullTabInfo || tab;
  
  // Save the original tab to storage for persistence
  await saveOriginalTab(originalTab);
  
  console.log('Stored original tab:', originalTab);
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for tab updates to keep originalTab information current
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (originalTab && tabId === originalTab.id) {
    console.log('Original tab updated:', changeInfo);
    // Only update the properties that have changed, preserving other properties
    originalTab = { ...originalTab, ...tab };
    console.log('Updated originalTab:', originalTab);
    
    // Notify the sidepanel about the tab update
    notifySidepanelAboutTabChange('tab-updated', originalTab);
  }
});

// Listen for tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log('Tab activated:', activeInfo);
  // Notify the sidepanel about tab activation
  notifySidepanelAboutTabChange('tab-activated', activeInfo);
});

// Listen for tab removal (when a tab is closed)
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log('Tab removed:', tabId, removeInfo);
  if (originalTab && tabId === originalTab.id) {
    console.log('Original tab was closed');
  }
  // Notify the sidepanel about tab removal
  notifySidepanelAboutTabChange('tab-removed', { tabId, removeInfo });
});

// Function to notify the sidepanel about tab changes
function notifySidepanelAboutTabChange(changeType, data) {
  // Send a message to the sidepanel
  chrome.runtime.sendMessage({
    type: 'TAB_STATUS_CHANGED',
    changeType: changeType,
    data: data
  }).catch(error => {
    // It's normal for this to fail if the sidepanel is not open
    console.log('Could not notify sidepanel (it may not be open):', error);
  });
}
