// sidepanel.js
const ANTHROPIC_API_KEY = '???';

// Global configuration object
const CONFIG = {
    API: {
        KEY: ANTHROPIC_API_KEY,
        ENDPOINT: 'https://api.anthropic.com/v1/messages',
        VERSION: '2023-06-01',
        MODEL: 'claude-3-5-sonnet-20241022',
        MAX_TOKENS: 1024
    },
    SELECTORS: {
        TARGET_CONTAINER: 'body',
        UI: {
            MESSAGES: '#messages',
            INPUT: '#question-input',
            ASK_BUTTON: '#ask-button'
        }
    },
    UI_TEXT: {
        WELCOME_MESSAGE: {
            GREETING: `👋 Welcome to Page Assistant!`,
            SUBTITLE: 'Here\'s what I found on this page:',
        },
        BUTTON: {
            ASK: 'Ask',
            LOADING: 'Loading...'
        },
        INPUT: {
            PLACEHOLDER: 'Ask a question about this page...'
        },
        ERRORS: {
            NO_TAB: 'No active tab found',
            NO_CONTAINER: (selector) => `Container not found: ${selector}`,
            INIT_FAILED: 'Failed to initialize the assistant. Please check your API key and try reloading.',
            API_ERROR: (error) => `API error: ${error}`,
            GENERIC: 'An unexpected error occurred. Please check the console for details.'
        }
    },
    PROMPTS: {
        SYSTEM: (content) =>
            `You are a helpful web page assistant analyzing the following content: """${content}"""\n\n` +
            'Your role is to help users understand this content by answering their questions and suggesting relevant follow-up questions. ' +
            'Your responses should be clear, concise, and directly related to the content provided. ' +
            'After each response, you must suggest 3 follow-up questions that explore different aspects of the content. ' +
            'These questions should be formatted as a JSON array at the end of your response.\n\n' +
            'Response format:\n' +
            '1. First, provide your answer or analysis\n' +
            '2. End with exactly 3 follow-up questions in a JSON array, e.g., ["Question 1?", "Question 2?", "Question 3?"]\n\n' +
            'Keep your responses focused on the provided content.',

        INITIAL_QUESTION: 'Please provide a concise summary of the main points in this content.',

        FORMAT_USER_QUESTION: (question) => `Question about the content: ${question}`
    }
};

class PageAssistant {
    constructor(config) {
        this.config = config;
        this.pageContent = null;
        this.systemPrompt = null;

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
    }

    // UI Methods
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
            console.log('Content retrieved:', result.substring(0, 100) + '...');
            return result;
        } catch (error) {
            console.error('Error getting page content:', error);
            throw error;
        }
    }

    // API Methods
    async makeApiRequest(userPrompt) {
        try {
            const response = await fetch(this.config.API.ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.config.API.KEY,
                    'anthropic-version': this.config.API.VERSION,
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model: this.config.API.MODEL,
                    max_tokens: this.config.API.MAX_TOKENS,
                    system: this.systemPrompt,
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
                throw new Error(this.config.UI_TEXT.ERRORS.API_ERROR(
                    data.error?.message || JSON.stringify(data.error) || 'Unknown error'
                ));
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    parseResponse(response) {
        const fullResponse = response.content[0].text;
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

            // Use initial question for welcome message, otherwise format user question
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
            this.setLoading(true);
            await this.processQuestion('', true);
            this.setLoading(false);

            // Event listeners
            this.elements.askButton.addEventListener('click', this.handleQuestion);
            this.elements.input.addEventListener('keypress', this.handleKeyPress);
        } catch (error) {
            console.error('Initialization failed:', error);
            this.addMessage(this.config.UI_TEXT.ERRORS.INIT_FAILED, 'error');
            this.setLoading(false);
        }
    }
}

// Initialize the assistant
document.addEventListener('DOMContentLoaded', () => {
    const assistant = new PageAssistant(CONFIG);
    assistant.initialize();
});