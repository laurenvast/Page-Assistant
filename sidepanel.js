import { CONFIG } from "./constants.js"
import { addFormattedMessage } from "./formatter.js";

class PageAssistant {
    constructor(config) {
        this.config = config;
        this.pageContent = null;
        this.systemPrompt = null;
        this.isInitialLoad = true;

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

        this.loadingTimeout = null;
        this.isLoading = false;  // Add this to track loading state

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
            await this.processQuestion('', true);
            this.setLoading(false);

            this.elements.askButton.addEventListener('click', this.handleQuestion);
            this.elements.input.addEventListener('keypress', this.handleKeyPress);
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