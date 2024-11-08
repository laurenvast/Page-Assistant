function formatMessageContent(text) {
    const lines = text.split('\n');
    const formattedLines = [];
    let currentList = null;
    let lastNumberedItem = null;
    let lastListType = null;

    function getListType(line) {
        if (/^\d+[\.\)]/.test(line)) return 'numbered';
        if (/^[-*•]/.test(line)) return 'bullet';
        if (/^[a-z][\.\)]/i.test(line)) return 'letter';
        return null;
    }

    function createListItem(text, listType) {
        const li = document.createElement('li');
        if (listType === 'numbered') {
            text = text.replace(/^\d+[\.\)]\s*/, '');
        } else if (listType === 'bullet') {
            text = text.replace(/^[-*•]\s*/, '');
        } else if (listType === 'letter') {
            text = text.replace(/^[a-z][\.\)]\s*/i, '');
        }
        li.textContent = text.trim();
        return li;
    }

    function handleNumberedItem(line) {
        if (!currentList || currentList.tagName !== 'OL') {
            currentList = document.createElement('ol');
            formattedLines.push(currentList);
        }
        lastNumberedItem = createListItem(line, 'numbered');
        currentList.appendChild(lastNumberedItem);
        lastListType = 'numbered';
        return lastNumberedItem;
    }

    function findLastNumberedItem() {
        if (lastNumberedItem) return lastNumberedItem;
        if (!currentList || !currentList.lastElementChild) return null;
        return currentList.lastElementChild;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const listType = getListType(line);
        if (!listType) {
            currentList = null;
            lastNumberedItem = null;
            lastListType = null;
            const div = document.createElement('div');
            div.textContent = line;
            formattedLines.push(div);
            continue;
        }

        if (listType === 'numbered') {
            handleNumberedItem(line);
        } else {
            // For bullet or letter lists
            const parentItem = findLastNumberedItem();

            if (parentItem) {
                // Get or create the nested list
                let nestedList = parentItem.querySelector(listType === 'letter' ? 'ol' : 'ul');
                if (!nestedList) {
                    nestedList = document.createElement(listType === 'letter' ? 'ol' : 'ul');
                    parentItem.appendChild(nestedList);
                    // currentList = nestedList;
                }
                const li = createListItem(line, listType);
                //currentList.appendChild(li);
                nestedList.appendChild(li);
            } else {
                // If no parent item found, create a new top-level list
                if (!currentList || currentList.tagName !== (listType === 'letter' ? 'OL' : 'UL')) {
                    currentList = document.createElement(listType === 'letter' ? 'ol' : 'ul');
                    formattedLines.push(currentList);
                }
                const li = createListItem(line, listType);
                currentList.appendChild(li);
            }
            lastListType = listType;
        }
    }

    return formattedLines;
}

export function addFormattedMessage(container, text, className) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${className}`;

    const formattedContent = formatMessageContent(text);
    formattedContent.forEach(element => {
        messageDiv.appendChild(element);
    });

    container.appendChild(messageDiv);
    return messageDiv;
}