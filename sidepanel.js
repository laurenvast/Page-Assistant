import { CONFIG } from "./constants.js"
import { addFormattedMessage } from "./formatter.js";

class PageAssistant {
    constructor(config) {
        this.config = config;
        this.pageContent = null;
        this.systemPrompt = null;
        this.isInitialLoad = true;
        this.originalTab = null;
        this.originalTabInfoSet = false; // Flag to track if we've already set the original tab info

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
        
        // Add elements to header
        headerContainer.appendChild(this.elements.tabTitle);
        headerContainer.appendChild(this.elements.returnButton);
        
        // Insert header at the top of chat container
        const chatContainer = document.getElementById('chat-container');
        chatContainer.insertBefore(headerContainer, chatContainer.firstChild);
        
        // Set up visibility change listener to show/hide return button
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
    
    handleVisibilityChange() {
        if (document.visibilityState === 'visible' && this.originalTab) {
            // Update the return button visibility when tab visibility changes
            this.updateReturnButtonVisibility();
        }
    }
    
    navigateToOriginalTab() {
        console.log('Attempting to navigate to original tab:', this.originalTab);
        if (this.originalTab && this.originalTab.id) {
            const tabId = this.originalTab.id;
            console.log('Sending NAVIGATE_TO_ORIGINAL_TAB message for tab ID:', tabId);
            try {
                chrome.runtime.sendMessage(
                    { 
                        type: 'NAVIGATE_TO_ORIGINAL_TAB', 
                        tabId: tabId // Directly pass the tab ID
                    },
                    (response) => {
                        console.log('Got navigation response:', response);
                        if (response && response.success) {
                            console.log('Navigation successful, hiding return button');
                            this.elements.returnButton.style.display = 'none';
                        } else {
                            console.error('Navigation failed:', response?.error || 'Unknown error');
                            // Show an error message to the user
                            alert('Could not return to original tab: ' + (response?.error || 'Unknown error'));
                        }
                    }
                );
            } catch (error) {
                console.error('Error sending navigation message:', error);
            }
        } else {
            console.error('Cannot navigate: No valid original tab information');
            alert('Cannot return to original tab: Tab information not available');
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
            this.updateReturnButtonVisibility();
        }
    }
    
    updateReturnButtonVisibility() {
        if (this.originalTab) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0 && tabs[0].id !== this.originalTab.id) {
                    this.elements.returnButton.style.display = 'block';
                } else {
                    this.elements.returnButton.style.display = 'none';
                }
            });
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
        if (this.pageContent) return this.pageContent;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error(this.config.UI_TEXT.ERRORS.NO_TAB);

            const response = await chrome.runtime.sendMessage({
                type: 'GET_PAGE_CONTENT',
                tabId: tab.id
            });

            if (!response.success) {
                throw new Error(response.error);
            }

            if (!response.data) {
                throw new Error(this.config.UI_TEXT.ERRORS.NO_CONTAINER(this.config.SELECTORS.TARGET_CONTAINER));
            }

            this.pageContent = response.data;
            console.log('Content retrieved:', response.data.substring(0, 100) + '...');
            return response.data;
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