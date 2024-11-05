import { CONFIG } from "./constants.js"

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
                    content: this.pageContent,  // Send the page content instead of system prompt
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

    async processQuestion(question = '', isInitialLoad = false) {
        try {
            if (!isInitialLoad) {
                this.addMessage(question, 'user-message');
            }

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