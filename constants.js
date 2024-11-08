export const CONFIG = {
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
            GREETING: '👋 Welcome to Page Assistant!',
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
            `Your role is to help users understand this content by answering their questions and suggesting relevant follow-up questions. ` +
            `Your responses should be clear, concise, and directly related to the content provided. ` +
            `After each response, you must suggest 3 follow-up questions that explore different aspects of the content. ` +
            `These questions should be formatted as a JSON array at the end of your response.\n\n` +
            `Response format:\n'` +
            `1. First, provide your answer or analysis\n` +
            `2. End with exactly 3 follow-up questions in a JSON array, e.g., ["Question 1?", "Question 2?", "Question 3?"]\n\n` +
            `Keep your responses focused on the provided content.`,

        INITIAL_QUESTION: 'Please provide a concise summary of the main points in this content.',

        FORMAT_USER_QUESTION: (question) => `Question about the content: ${question}`
    }
};