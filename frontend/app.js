const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');
const modelSelect = document.getElementById('model-select'); // <--- אלמנט חדש

let chatHistory = [];

function appendMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    if (role === 'user') messageDiv.classList.add('user-message');
    else messageDiv.classList.add('assistant-message');
    messageDiv.innerText = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = userInput.value.trim();
    if (!messageText) return;

    appendMessage('user', messageText);
    chatHistory.push({ role: 'user', content: messageText });
    userInput.value = '';

    // שליפת המודל הנבחר ברגע הלחיצה (cloud או local)
    const selectedModel = modelSelect.value; 

    try {
        const response = await fetch('http://127.0.0.1:8000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // אנחנו שולחים לשרת גם את ההיסטוריה וגם את סוג המודל המבוקש!
            body: JSON.stringify({ 
                history: chatHistory,
                model_type: selectedModel 
            })
        });

        if (!response.ok) throw new Error('שגיאה בתקשורת עם השרת');

        const data = await response.json();
        const aiResponse = data.response;

        appendMessage('assistant', aiResponse);
        chatHistory.push({ role: 'assistant', content: aiResponse });

    } catch (error) {
        console.error(error);
        appendMessage('assistant', 'אופס, משהו השתבש בחיבור לשרת. ודא שה-Backend רץ בפורט 8000.');
    }
});