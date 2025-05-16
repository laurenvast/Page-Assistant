import { CONFIG } from "./constants.js"
import { addFormattedMessage } from "./formatter.js";

class PageAssistant {
    constructor(config) {
        this.config = config;
        this.pageContent = null;
        this.systemPrompt = null;
        this.isInitialLoad = true;
        this.originalTab = null;
        this.currentTab = null;
        this.originalTabInfoSet = false; // Flag to track if we've already set the original tab info
        this.usingOriginalTab = true; // Flag to track if we're using the original tab content

        // Cache DOM elements
        this.elements = {
            messages: document.querySelector(config.SELECTORS.UI.MESSAGES),
            input: document.querySelector(config.SELECTORS.UI.INPUT),
            askButton: document.querySelector(config.SELECTORS.UI.ASK_BUTTON)
        };

        // Set initial UI text
        this.elements.input.placeholder = config.UI_TEXT.INPUT.PLACEHOLDER;
        this.elements.askButton.textContent = config.UI_TEXT.BUTTON.ASK;

        // Bind methods
        this.handleQuestion = this.handleQuestion.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.navigateToOriginalTab = this.navigateToOriginalTab.bind(this);
        this.refreshWithCurrentTab = this.refreshWithCurrentTab.bind(this);

        this.loadingTimeout = null;
        this.isLoading = false;  // Add this to track loading state

        // Create header elements for tab info and navigation
        this.createHeaderElements();
    }

    createHeaderElements() {
        // Create header container
        const headerContainer = document.createElement('div');
        headerContainer.id = 'tab-header';
        headerContainer.className = 'tab-header';

        // Create favicon element
        this.elements.tabFavicon = document.createElement('div');
        this.elements.tabFavicon.id = 'tab-favicon';
        this.elements.tabFavicon.className = 'tab-favicon';

        // Create favicon image element
        const faviconImg = document.createElement('img');
        faviconImg.alt = '';
        // We'll set the actual favicon URL when we get tab info
        this.elements.tabFavicon.appendChild(faviconImg);

        // Create tab title element
        this.elements.tabTitle = document.createElement('div');
        this.elements.tabTitle.id = 'tab-title';
        this.elements.tabTitle.className = 'tab-title';
        this.elements.tabTitle.textContent = 'Loading...';

        // Create return button (hidden by default)
        this.elements.returnButton = document.createElement('button');
        this.elements.returnButton.id = 'return-button';
        this.elements.returnButton.className = 'return-button';
        this.elements.returnButton.textContent = 'Return to Tab';
        this.elements.returnButton.style.display = 'none';
        this.elements.returnButton.addEventListener('click', this.navigateToOriginalTab);

        // Create refresh button for current tab
        this.elements.refreshButton = document.createElement('button');
        this.elements.refreshButton.id = 'refresh-button';
        this.elements.refreshButton.className = 'refresh-button';
        this.elements.refreshButton.title = 'Use Current Tab';
        this.elements.refreshButton.style.display = 'none';
        this.elements.refreshButton.addEventListener('click', this.refreshWithCurrentTab);

        // Create SVG icon for refresh button
        const refreshSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        refreshSvg.setAttribute('width', '18');
        refreshSvg.setAttribute('height', '18');
        refreshSvg.setAttribute('viewBox', '0 0 24 24');
        refreshSvg.setAttribute('fill', 'none');
        refreshSvg.setAttribute('stroke', 'currentColor');
        refreshSvg.setAttribute('stroke-width', '3');
        refreshSvg.setAttribute('stroke-linecap', 'round');
        refreshSvg.setAttribute('stroke-linejoin', 'round');

        // Create the path for the refresh icon
        const refreshPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        refreshPath.setAttribute('d', 'M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16');

        // Add the path to the SVG
        refreshSvg.appendChild(refreshPath);

        // Add the SVG to the button
        this.elements.refreshButton.appendChild(refreshSvg);

        // Create a container for the buttons
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'buttons-container';

        // Add buttons to the container
        buttonsContainer.appendChild(this.elements.returnButton);
        buttonsContainer.appendChild(this.elements.refreshButton);

        // Add elements to header
        headerContainer.appendChild(this.elements.tabFavicon);
        headerContainer.appendChild(this.elements.tabTitle);
        headerContainer.appendChild(buttonsContainer);

        // Insert header at the top of chat container
        const chatContainer = document.getElementById('chat-container');
        chatContainer.insertBefore(headerContainer, chatContainer.firstChild);

        // Set up visibility change listener to show/hide return button
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

        // Add focus event listener to update status when sidepanel gains focus
        window.addEventListener('focus', () => {
            console.log('Sidepanel gained focus, updating tab status');
            this.checkTabStatus();
            this.updateButtonVisibility();
        });

        // Set up listener for tab status change messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'TAB_STATUS_CHANGED') {
                console.log('Received tab status change:', message.changeType, message.data);

                // Handle different types of tab changes
                if (message.changeType === 'tab-removed' &&
                    this.originalTab &&
                    message.data.tabId === this.originalTab.id) {
                    // Original tab was closed, update button text
                    console.log('Original tab was closed, updating button text');
                    this.elements.returnButton.textContent = 'Reopen Page';
                } else if (message.changeType === 'tab-activated') {
                    // A tab was activated, check if we need to show/hide the return button
                    console.log('Tab activated, updating return button visibility');
                    this.updateButtonVisibility();
                }

                // Send a response to acknowledge receipt
                sendResponse({ received: true });
            }
        });
    }

    checkTabStatus() {
        if (this.originalTab && this.originalTab.id) {
            chrome.tabs.get(this.originalTab.id, (tab) => {
                if (chrome.runtime.lastError) {
                    // Tab no longer exists, update button text
                    this.elements.returnButton.textContent = 'Reopen Page';
                } else {
                    // Tab still exists, keep original text
                    this.elements.returnButton.textContent = 'Return to Tab';
                }
            });
        }
    }

    handleVisibilityChange() {
        if (!document.hidden) {
            // When the sidepanel becomes visible, check tab status
            console.log('Sidepanel became visible, updating tab status');
            this.checkTabStatus();
            this.updateButtonVisibility();
        }
    }

    navigateToOriginalTab() {
        console.log('Attempting to navigate to original tab:', this.originalTab);
        if (this.originalTab) {
            const tabId = this.originalTab.id;
            const url = this.originalTab.url;

            console.log('Sending NAVIGATE_TO_ORIGINAL_TAB message for tab ID:', tabId, 'and URL:', url);
            try {
                chrome.runtime.sendMessage(
                    {
                        type: 'NAVIGATE_TO_ORIGINAL_TAB',
                        tabId: tabId, // Pass the tab ID
                        url: url      // Also pass the URL for reopening if needed
                    },
                    (response) => {
                        console.log('Got navigation response:', response);
                        if (response && response.success) {
                            console.log('Navigation successful, hiding return button');
                            this.elements.returnButton.style.display = 'none';

                            // If a new tab was created, update our original tab info
                            if (response.newTab && response.tabId) {
                                console.log('Updating original tab ID to new tab:', response.tabId);
                                this.originalTab.id = response.tabId;
                            }
                        } else {
                            console.error('Navigation failed:', response?.error || 'Unknown error');
                            // Show an error message to the user
                            alert('Could not navigate to page: ' + (response?.error || 'Unknown error'));
                        }
                    }
                );
            } catch (error) {
                console.error('Error sending navigation message:', error);
            }
        } else {
            console.error('Cannot navigate: No valid original tab information');
            alert('Cannot navigate to page: Tab information not available');
        }
    }

    updateTabInfo() {
        // Only update tab info if it hasn't been set yet or we're in the initial load
        if (!this.originalTabInfoSet) {
            console.log('Requesting original tab info...');
            chrome.runtime.sendMessage({ type: 'GET_ORIGINAL_TAB' }, (response) => {
                console.log('Got tab info response:', response);
                if (response && response.tab) {
                    this.originalTab = response.tab;
                    this.originalTabInfoSet = true; // Mark that we've set the original tab info
                    console.log('Original tab title:', response.tab.title);

                    // Extract domain from URL
                    let domain = '';
                    if (response.tab.url) {
                        try {
                            const url = new URL(response.tab.url);
                            domain = url.hostname;
                        } catch (e) {
                            console.error('Error parsing URL:', e);
                        }
                    }

                    // Update tab title with title and domain
                    if (domain) {
                        // Clear the tab title element first
                        this.elements.tabTitle.innerHTML = '';

                        // Create title span
                        const titleSpan = document.createElement('span');
                        titleSpan.className = 'tab-title-text';
                        titleSpan.textContent = response.tab.title || 'Unknown Tab';
                        this.elements.tabTitle.appendChild(titleSpan);

                        // Create domain span
                        const domainSpan = document.createElement('span');
                        domainSpan.className = 'tab-domain';
                        domainSpan.textContent = domain;
                        this.elements.tabTitle.appendChild(domainSpan);

                        // Update favicon
                        if (this.elements.tabFavicon) {
                            const faviconImg = this.elements.tabFavicon.querySelector('img');
                            if (faviconImg) {
                                // Get favicon URL using Google's favicon service
                                const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                                faviconImg.src = faviconUrl;
                            }
                        }
                    } else {
                        // Fallback if no domain is available
                        this.elements.tabTitle.textContent = response.tab.title || 'Unknown Tab';
                    }

                    // Update document title with tab name and domain
                    document.title = domain ?
                        `${response.tab.title || 'Unknown Tab'} - ${domain}` :
                        `Page Assistant - ${response.tab.title || 'Unknown Tab'}`;
                } else {
                    console.error('No valid tab information received');
                    // Try to get current active tab as fallback
                    this.getActiveTabInfo();
                }
            });
        } else {
            console.log('Using existing original tab info:', this.originalTab?.title);
            // Just check if we need to show the return button
            this.updateButtonVisibility();
        }
    }

    updateButtonVisibility() {
        // Check if we have an original tab and if the current active tab is different
        if (this.originalTab && this.originalTab.id) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    const currentTab = tabs[0];
                    this.currentTab = currentTab;
                    const isDifferentTab = currentTab.id !== this.originalTab.id;
                    console.log('Current tab:', currentTab.id, 'Original tab:', this.originalTab.id, 'Different:', isDifferentTab);

                    if (isDifferentTab) {
                        // If we're on a different tab than the reference tab
                        // Always show both buttons regardless of whether we're using original tab or not
                        this.elements.returnButton.style.display = 'block';
                        this.elements.refreshButton.style.display = 'block';
                    } else {
                        // We're on the same tab as the reference tab
                        // Hide both buttons
                        this.elements.returnButton.style.display = 'none';
                        this.elements.refreshButton.style.display = 'none';
                    }
                }
            });
        } else {
            // No original tab, hide the buttons
            this.elements.returnButton.style.display = 'none';
            this.elements.refreshButton.style.display = 'none';
        }
    }

    getActiveTabInfo() {
        // Only get active tab info if we haven't set the original tab info yet
        if (!this.originalTabInfoSet) {
            console.log('Trying to get active tab as fallback...');
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                console.log('Active tabs:', tabs);
                if (tabs && tabs.length > 0) {
                    const activeTab = tabs[0];
                    this.originalTab = activeTab;
                    this.originalTabInfoSet = true; // Mark that we've set the original tab info

                    // Extract domain from URL
                    let domain = '';
                    if (activeTab.url) {
                        try {
                            const url = new URL(activeTab.url);
                            domain = url.hostname;
                        } catch (e) {
                            console.error('Error parsing URL:', e);
                        }
                    }

                    // Update tab title with title and domain
                    if (domain) {
                        // Clear the tab title element first
                        this.elements.tabTitle.innerHTML = '';

                        // Create title span
                        const titleSpan = document.createElement('span');
                        titleSpan.className = 'tab-title-text';
                        titleSpan.textContent = activeTab.title || 'Current Tab';
                        this.elements.tabTitle.appendChild(titleSpan);

                        // Create domain span
                        const domainSpan = document.createElement('span');
                        domainSpan.className = 'tab-domain';
                        domainSpan.textContent = domain;
                        this.elements.tabTitle.appendChild(domainSpan);

                        // Update favicon
                        if (this.elements.tabFavicon) {
                            const faviconImg = this.elements.tabFavicon.querySelector('img');
                            if (faviconImg) {
                                // Get favicon URL using Google's favicon service
                                const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                                faviconImg.src = faviconUrl;
                            }
                        }
                    } else {
                        // Fallback if no domain is available
                        this.elements.tabTitle.textContent = activeTab.title || 'Current Tab';
                    }

                    // Update document title with tab name and domain
                    document.title = domain ?
                        `${activeTab.title || 'Current Tab'} - ${domain}` :
                        `Page Assistant - ${activeTab.title || 'Current Tab'}`;
                }
            });
        }
    }

    smoothScrollToBottom() {
        if (!this.isInitialLoad) {
            this.elements.messages.scrollTo({
                top: this.elements.messages.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    addMessage(text, className) {
        const messageDiv = addFormattedMessage(this.elements.messages, text, className);
        this.smoothScrollToBottom();
        return messageDiv;
    }

    addFollowUpQuestions(questions) {
        if (this.isInitialLoad) {
            // Add follow-ups immediately without animation during initial load
            const questionsContainer = document.createElement('div');
            questionsContainer.className = 'follow-up-questions';

            questions.forEach(question => {
                const button = document.createElement('button');
                button.className = 'follow-up-button';
                button.textContent = question;
                button.addEventListener('click', () => {
                    if (!button.disabled) {
                        // Add selected class to clicked button and disable only this button
                        button.classList.add('selected');
                        button.disabled = true;

                        this.elements.input.value = question;
                        this.elements.askButton.click();
                    }
                });
                questionsContainer.appendChild(button);
            });

            const container = document.createElement('div');
            container.className = 'message follow-up-container';
            container.appendChild(questionsContainer);
            this.elements.messages.appendChild(container);
        } else {
            // Animated follow-ups for user interactions
            setTimeout(() => {
                const questionsContainer = document.createElement('div');
                questionsContainer.className = 'follow-up-questions';

                questions.forEach(question => {
                    const button = document.createElement('button');
                    button.className = 'follow-up-button';
                    button.textContent = question;
                    button.addEventListener('click', () => {
                        if (!button.disabled) {
                            // Add selected class to clicked button and disable only this button
                            button.classList.add('selected');
                            button.disabled = true;

                            this.elements.input.value = question;
                            this.elements.askButton.click();
                        }
                    });
                    questionsContainer.appendChild(button);
                });

                const container = document.createElement('div');
                container.className = 'message follow-up-container';
                container.style.opacity = '0';
                container.style.transition = 'opacity 0.3s ease-in-out';
                container.appendChild(questionsContainer);

                this.elements.messages.appendChild(container);
                this.smoothScrollToBottom();

                setTimeout(() => {
                    container.style.opacity = '1';
                }, 50);
            }, 500);
        }
    }

    createLoadingAnimation() {
        const loadingHTML = `
            <div class="loading-animation">
                <div class="scan-grid"></div>
                <div class="scan-box">
                    <div class="corner-mark top-left"></div>
                    <div class="corner-mark top-right"></div>
                    <div class="corner-mark bottom-left"></div>
                    <div class="corner-mark bottom-right"></div>
                </div>
                <div class="scan-details"></div>
                <div class="scan-glow"></div>
            </div>
        `;
        const container = document.createElement('div');
        container.className = 'message loading-container';
        container.innerHTML = loadingHTML;
        return container;
    }

    setLoading(isLoading, isInitialLoad = false) {
        if (this.isLoading === isLoading) return; // Prevent duplicate loading states
        this.isLoading = isLoading;

        this.elements.askButton.disabled = isLoading;
        this.elements.input.disabled = isLoading;

        // Remove any existing loading animations
        const existingLoading = document.querySelector('.loading-container');
        if (existingLoading) {
            existingLoading.remove();
        }

        // Add new loading animation if needed
        if (isLoading) {
            if (isInitialLoad) {
                // Show loading immediately for initial load
                const loadingElement = this.createLoadingAnimation();
                this.elements.messages.appendChild(loadingElement);
                this.smoothScrollToBottom();
            } else {
                // Delay loading animation for user messages
                setTimeout(() => {
                    if (!this.isLoading) return; // Check if still loading
                    const loadingElement = this.createLoadingAnimation();
                    loadingElement.style.opacity = '0';
                    this.elements.messages.appendChild(loadingElement);

                    // Force a reflow before starting the transition
                    loadingElement.offsetHeight;

                    loadingElement.style.transition = 'opacity 0.3s ease-in-out';
                    loadingElement.style.opacity = '1';

                    this.smoothScrollToBottom();
                }, 400);
            }
        }
    }

    async getPageContent() {
        try {
            // Determine which tab to use based on the usingOriginalTab flag
            const targetTab = this.usingOriginalTab ? this.originalTab : this.currentTab;

            // If we have a target tab, use that
            if (targetTab && targetTab.id) {
                const response = await chrome.runtime.sendMessage({
                    type: 'GET_PAGE_CONTENT',
                    tabId: targetTab.id
                });

                if (response.success) {
                    return response.data;
                } else {
                    throw new Error(response.error || 'Failed to get page content');
                }
            } else {
                // If we don't have a target tab, get the active tab
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs.length > 0) {
                    const activeTab = tabs[0];
                    // Update our current tab reference
                    this.currentTab = activeTab;

                    const response = await chrome.runtime.sendMessage({
                        type: 'GET_PAGE_CONTENT',
                        tabId: activeTab.id
                    });

                    if (response.success) {
                        return response.data;
                    } else {
                        throw new Error(response.error || 'Failed to get page content');
                    }
                } else {
                    throw new Error('No active tab found');
                }
            }
        } catch (error) {
            console.error('Error getting page content:', error);
            throw error;
        }
    }

    async makeApiRequest(userPrompt) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'MAKE_API_REQUEST',
                data: {
                    content: this.pageContent,
                    messages: [
                        {
                            role: 'user',
                            content: userPrompt
                        }
                    ]
                }
            });

            if (!response.success) {
                throw new Error(response.error);
            }

            return response.data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    parseResponse(response) {
        // Handle OpenAI API response format
        let fullResponse;
        if (response.choices && response.choices[0] && response.choices[0].message) {
            // This is the OpenAI API format
            fullResponse = response.choices[0].message.content;
        } else if (response.content && response.content[0] && response.content[0].text) {
            // This is the original format
            fullResponse = response.content[0].text;
        } else {
            console.error('Unexpected response format:', response);
            return { mainResponse: 'Error: Unexpected response format', followUpQuestions: [] };
        }

        let mainResponse = fullResponse;
        let followUpQuestions = [];

        const jsonMatch = fullResponse.match(/\[.*\]/s);
        if (jsonMatch) {
            try {
                followUpQuestions = JSON.parse(jsonMatch[0]);
                mainResponse = fullResponse.substring(0, jsonMatch.index).trim();
            } catch (error) {
                console.error('Error parsing follow-up questions:', error);
            }
        }
        return { mainResponse, followUpQuestions };
    }

    async processQuestion(question = '', isInitialLoad = false) {
        try {
            this.isInitialLoad = isInitialLoad;

            if (!isInitialLoad) {
                const messageElement = this.addMessage(question, 'user-message');
                this.smoothScrollToBottom();
                this.setLoading(true, false);
            }

            if (!this.pageContent) {
                this.setLoading(true, true);
                this.pageContent = await this.getPageContent();
                this.systemPrompt = this.config.PROMPTS.SYSTEM(this.pageContent);
            }

            const userPrompt = isInitialLoad ?
                this.config.PROMPTS.INITIAL_QUESTION :
                this.config.PROMPTS.FORMAT_USER_QUESTION(question);

            const response = await this.makeApiRequest(userPrompt);
            const { mainResponse, followUpQuestions } = this.parseResponse(response);

            this.setLoading(false);

            if (isInitialLoad) {
                this.addMessage(
                    `${this.config.UI_TEXT.WELCOME_MESSAGE.GREETING}\n\n${this.config.UI_TEXT.WELCOME_MESSAGE.SUBTITLE}`,
                    'welcome-message'
                );
            }

            this.addMessage(mainResponse, 'assistant-message');

            if (followUpQuestions.length > 0) {
                this.addFollowUpQuestions(followUpQuestions);
            }
        } catch (error) {
            console.error('Error processing question:', error);
            this.setLoading(false);
            this.addMessage(
                `Error: ${error.message}. ${this.config.UI_TEXT.ERRORS.GENERIC}`,
                'assistant-message error'
            );
        }
    }

    async handleQuestion() {
        const question = this.elements.input.value.trim();
        if (question) {
            this.elements.input.value = '';
            await this.processQuestion(question);
        }
    }

    handleKeyPress(event) {
        if (event.key === 'Enter') {
            this.handleQuestion();
        }
    }

    async refreshWithCurrentTab() {
        try {
            // Reset the chat and start with the current tab content
            this.usingOriginalTab = false;
            this.pageContent = null;
            this.systemPrompt = null;

            // Clear existing messages
            if (this.elements.messages) {
                this.elements.messages.innerHTML = '';
            }

            // Update tab title and button visibility
            if (this.elements.tabTitle && this.currentTab) {
                // Extract domain from URL
                let domain = '';
                if (this.currentTab.url) {
                    try {
                        const url = new URL(this.currentTab.url);
                        domain = url.hostname;
                    } catch (e) {
                        console.error('Error parsing URL:', e);
                    }
                }

                // Clear the tab title element first
                this.elements.tabTitle.innerHTML = '';

                // Create title span
                const titleSpan = document.createElement('span');
                titleSpan.className = 'tab-title-text';
                titleSpan.textContent = this.currentTab.title || 'Unknown Page';
                this.elements.tabTitle.appendChild(titleSpan);

                // Create domain span
                if (domain) {
                    const domainSpan = document.createElement('span');
                    domainSpan.className = 'tab-domain';
                    domainSpan.textContent = domain;
                    this.elements.tabTitle.appendChild(domainSpan);

                    // Update favicon
                    if (this.elements.tabFavicon) {
                        const faviconImg = this.elements.tabFavicon.querySelector('img');
                        if (faviconImg) {
                            // Get favicon URL using Google's favicon service
                            const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                            faviconImg.src = faviconUrl;
                        }
                    }
                }

                // Store the current tab as the new reference tab
                // This will be used to detect if the user navigates away again
                this.originalTab = { ...this.currentTab };
                console.log('New reference tab set:', this.originalTab.id, this.originalTab.title);
            }

            this.updateButtonVisibility();

            // Process initial question with new tab content
            await this.processQuestion('', true);

            // Add a message indicating we've switched to the current tab
            this.addMessage('Now using content from the current tab.', 'system-message');
        } catch (error) {
            console.error('Error refreshing with current tab:', error);
            this.addMessage(`Error: ${error.message}. Failed to refresh with current tab content.`, 'error');
        }
    }

    async initialize() {
        try {
            this.setLoading(true);

            // Get tab information
            this.updateTabInfo();

            await this.processQuestion('', true);
            this.setLoading(false);

            this.elements.askButton.addEventListener('click', this.handleQuestion);
            this.elements.input.addEventListener('keypress', this.handleKeyPress);

            // Set up periodic tab info updates
            setInterval(() => this.updateTabInfo(), 5000);
        } catch (error) {
            console.error('Initialization failed:', error);
            this.addMessage(this.config.UI_TEXT.ERRORS.INIT_FAILED, 'error');
            this.setLoading(false);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const assistant = new PageAssistant(CONFIG);
    assistant.initialize();
});