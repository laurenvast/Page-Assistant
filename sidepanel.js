// sidepanel.js

class PageAssistant {
    constructor() {
        this.config = null;
        this.pageContent = null;
        this.systemPrompt = null;
        this.initialized = false;

        // Cache DOM elements (will be set after config is loaded)
        this.elements = {};

        // Bind methods
        this.handleQuestion = this.handleQuestion.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
    }

    // UI Methods
    initializeElements() {
        this.elements = {
            messages: document.querySelector(this.config.SELECTORS.UI.MESSAGES),
            input: document.querySelector(this.config.SELECTORS.UI.INPUT),
            askButton: document.querySelector(this.config.SELECTORS.UI.ASK_BUTTON)
        };

        // Set initial UI text
        this.elements.input.placeholder = this.config.UI_TEXT.INPUT.PLACEHOLDER;
        this.elements.askButton.textContent = this.config.UI_TEXT.BUTTON.ASK;
    }

    addMessage(text, className) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${className}`;
        messageDiv.textContent = text;
        this.elements.messages.appendChild(messageDiv);
        this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        return messageDiv;
    }

    addFollowUpQuestions(questions) {
        const questionsContainer = document.createElement('div');
        questionsContainer.className = 'follow-up-questions';

        questions.forEach(question => {
            const button = document.createElement('button');
            button.className = 'follow-up-button';
            button.textContent = question;
            button.addEventListener('click', () => {
                this.elements.input.value = question;
                this.elements.askButton.click();
            });
            questionsContainer.appendChild(button);
        });

        this.addMessage('', 'follow-up-container').appendChild(questionsContainer);
    }

    setLoading(isLoading) {
        this.elements.askButton.disabled = isLoading;
        this.elements.input.disabled = isLoading;
        this.elements.askButton.textContent = isLoading ?
            this.config.UI_TEXT.BUTTON.LOADING :
            this.config.UI_TEXT.BUTTON.ASK;
    }

    // Content Methods
    async getPageContent() {
        if (this.pageContent) return this.pageContent;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error(this.config.UI_TEXT.ERRORS.NO_TAB);

            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (targetSelector) => {
                    const container = document.querySelector(targetSelector);
                    return container ? container.innerText : null;
                },
                args: [this.config.SELECTORS.TARGET_CONTAINER]
            });

            if (!result) throw new Error(
                this.config.UI_TEXT.ERRORS.NO_CONTAINER(this.config.SELECTORS.TARGET_CONTAINER)
            );

            this.pageContent = result;
            return result;
        } catch (error) {
            console.error('Error getting page content:', error);
            throw error;
        }
    }

    // API Methods
    async makeApiRequest(userPrompt) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: this.systemPrompt
                },
                {
                    role: 'user',
                    content: userPrompt
                }
            ];

            const response = await chrome.runtime.sendMessage({
                type: 'MAKE_API_REQUEST',
                messages
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
        const fullResponse = response.content || response.message?.content || '';
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

    // Main Methods
    async processQuestion(question = '', isInitialLoad = false) {
        try {
            if (!isInitialLoad) {
                this.addMessage(question, 'user-message');
            }

            // Get page content and set system prompt if not already set
            if (!this.pageContent) {
                this.pageContent = await this.getPageContent();
                this.systemPrompt = this.config.PROMPTS.SYSTEM(this.pageContent);
            }

            const userPrompt = isInitialLoad ?
                this.config.PROMPTS.INITIAL_QUESTION :
                this.config.PROMPTS.FORMAT_USER_QUESTION(question);

            const response = await this.makeApiRequest(userPrompt);
            const { mainResponse, followUpQuestions } = this.parseResponse(response);

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
            this.addMessage(
                `Error: ${error.message}. ${this.config.UI_TEXT.ERRORS.GENERIC}`,
                'assistant-message error'
            );
        }
    }

    // Event Handlers
    async handleQuestion() {
        const question = this.elements.input.value.trim();
        if (question) {
            this.setLoading(true);
            this.elements.input.value = '';
            await this.processQuestion(question);
            this.setLoading(false);
        }
    }

    handleKeyPress(event) {
        if (event.key === 'Enter') {
            this.handleQuestion();
        }
    }

    // Initialization
    async initialize() {
        try {
            // Get config from background script
            this.config = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, resolve);
            });

            // Initialize UI elements
            this.initializeElements();

            // Start loading sequence
            this.setLoading(true);
            await this.processQuestion('', true);
            this.setLoading(false);

            // Add event listeners
            this.elements.askButton.addEventListener('click', this.handleQuestion);
            this.elements.input.addEventListener('keypress', this.handleKeyPress);

            this.initialized = true;
        } catch (error) {
            console.error('Initialization failed:', error);
            this.addMessage(this.config.UI_TEXT.ERRORS.INIT_FAILED, 'error');
            this.setLoading(false);
        }
    }
}

// Initialize the assistant
document.addEventListener('DOMContentLoaded', () => {
    const assistant = new PageAssistant();
    assistant.initialize();
});