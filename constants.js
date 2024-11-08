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
            INIT_FAILED: 'Failed to initialize the assistant.',
            API_ERROR: (error) => `API error: ${error}`,
            GENERIC: 'An unexpected error occurred. Please check the console for details.'
        }
    }
};