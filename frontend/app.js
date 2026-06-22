const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');
const modelSelect = document.getElementById('model-select'); 
const historyList = document.getElementById('history-list');
const newChatBtn = document.getElementById('new-chat-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const sendBtn = document.getElementById('send-btn');

let currentConversationId = null; 
let loadingElement = null;

// טעינה ראשונית של האפליקציה ומצבי התצוגה והקלט
async function initApp() {
    initTheme();
    setupTextarea();
    await fetchConversations();
    
    if (historyList.children.length === 0) {
        await startNewChat();
    } else {
        const firstChat = historyList.children[0];
        if (firstChat) {
            const id = firstChat.getAttribute('data-id');
            await selectConversation(id);
        }
    }
}

// ניהול ושמירת מצב Dark/Light Mode בדפדפן
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark-theme';
    document.body.className = savedTheme;

    themeToggleBtn.addEventListener('click', () => {
        if (document.body.classList.contains('dark-theme')) {
            document.body.classList.replace('dark-theme', 'light-theme');
            localStorage.setItem('theme', 'light-theme');
        } else {
            document.body.classList.replace('light-theme', 'dark-theme');
            localStorage.setItem('theme', 'dark-theme');
        }
    });
}

// הגדרת התנהגות מולטי-ליין חכמה לקלט (Textarea)
function setupTextarea() {
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    userInput.addEventListener('keydown', function(e) {
        // שליחה בלחיצה על Enter בלבד, ללא Shift
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            if (!userInput.disabled) {
                chatForm.requestSubmit(); 
            }
        }
    });
}

// משיכת השיחות מהסרבר
async function fetchConversations() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/conversations');
        const conversations = await response.json();
        
        historyList.innerHTML = ''; 
        conversations.forEach(conv => {
            renderHistoryItem(conv.id, conv.title);
        });
    } catch (error) {
        console.error("שגיאה בטעינת השיחות:", error);
    }
}

// רינדור פריט שיחה בודד
function renderHistoryItem(id, title) {
    const item = document.createElement('div');
    item.classList.add('history-item');
    if (id === currentConversationId) item.classList.add('active');
    item.setAttribute('data-id', id);
    
    item.innerHTML = `
        <span class="history-title">${title}</span>
        <div class="history-actions">
            <button class="action-btn edit-btn" title="שנה שם">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="action-btn delete-btn" title="מחק שיחה">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>
    `;
    
    item.addEventListener('click', (e) => {
        if (e.target.closest('.history-actions')) return; 
        selectConversation(id);
    });
    
    item.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm("האם אתה בטוח שברצונך למחוק את השיחה הזו?")) {
            await deleteConversation(id);
        }
    });

    item.querySelector('.edit-btn').addEventListener('click', async () => {
        const newTitle = prompt("הכנס שם חדש לשיחה:", title);
        if (newTitle && newTitle.trim()) {
            await updateConversationTitle(id, newTitle.trim());
        }
    });
    
    historyList.appendChild(item);
}

// בחירת שיחה וטעינת היסטוריית ההודעות
async function selectConversation(id) {
    currentConversationId = id;
    
    document.querySelectorAll('.history-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-id') === id) item.classList.add('active');
    });
    
    chatMessages.innerHTML = ''; 
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/conversations/${id}/messages`);
        const messages = await response.json();
        
        if (messages.length === 0) {
            appendMessage('assistant', "השיחה הזו ריקה. שאל אותי משהו כדי להתחיל!");
        } else {
            messages.forEach(msg => appendMessage(msg.role, msg.content));
        }
    } catch (error) {
        console.error("שגיאה במשיכת הודעות:", error);
    }
}

// יצירת שיחה חדשה
async function startNewChat() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/conversations', { method: 'POST' });
        const newConv = await response.json();
        currentConversationId = newConv.id;
        
        await fetchConversations(); 
        await selectConversation(newConv.id); 
    } catch (error) {
        console.error("שגיאה ביצירת שיחה חדשה:", error);
    }
}

// מחיקת שיחה
async function deleteConversation(id) {
    try {
        await fetch('http://127.0.0.1:8000/api/conversations/' + id, { method: 'DELETE' });
        await fetchConversations();
        
        if (currentConversationId === id) {
            if (historyList.children.length > 0) {
                const nextId = historyList.children[0].getAttribute('data-id');
                await selectConversation(nextId);
            } else {
                await startNewChat();
            }
        }
    } catch (error) {
        console.error("שגיאה במחיקת שיחה:", error);
    }
}

// עדכון כותרת השיחה
async function updateConversationTitle(id, newTitle) {
    try {
        await fetch(`http://127.0.0.1:8000/api/conversations/${id}/title`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
        });
        await fetchConversations(); 
    } catch (error) {
        console.error("שגיאה בעדכון השם:", error);
    }
}

// הוספת בועת הודעה למסך (מוגן מהזרקות קוד)
function appendMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    if (role === 'user') {
        messageDiv.classList.add('user-message');
        messageDiv.textContent = text; 
    } else {
        messageDiv.classList.add('assistant-message');
        messageDiv.innerHTML = marked.parse(text); 
    }
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight; 
}

// שליטה באינדיקטור הטעינה והסטטוס
function showLoadingIndicator(statusText = "הסוכן חושב...") {
    if (loadingElement) {
        const textNode = loadingElement.querySelector('.indicator-status-text');
        if (textNode) textNode.innerText = statusText;
        return;
    }
    
    loadingElement = document.createElement('div');
    loadingElement.classList.add('typing-indicator');
    
    const statusDiv = document.createElement('div');
    statusDiv.classList.add('indicator-status-text');
    statusDiv.innerText = statusText;
    loadingElement.appendChild(statusDiv);
    
    const dotsWrapper = document.createElement('div');
    dotsWrapper.classList.add('dots-wrapper');
    for (let i = 0; i < 3; i++) {
        dotsWrapper.appendChild(document.createElement('span'));
    }
    loadingElement.appendChild(dotsWrapper);
    
    chatMessages.appendChild(loadingElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoadingIndicator() {
    if (loadingElement) {
        loadingElement.remove();
        loadingElement = null;
    }
}

// האזנה לאירוע שליחת הטופס
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = userInput.value.trim();
    if (!messageText || !currentConversationId) return;

    appendMessage('user', messageText);
    userInput.value = '';
    userInput.style.height = 'auto'; 

    // הגנה מפני שליחות כפולות (Race Conditions)
    userInput.disabled = true;
    sendBtn.disabled = true;
    
    showLoadingIndicator("הסוכן מעבד נתונים ומחפש ברשת...");
    const selectedModel = modelSelect.value; 

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/conversations/${currentConversationId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: messageText,
                provider: selectedModel 
            })
        });

        if (!response.ok) throw new Error('שגיאה בתקשורת עם השרת');

        const data = await response.json();
        removeLoadingIndicator();
        appendMessage('assistant', data.response);
        await fetchConversations();

    } catch (error) {
        console.error(error);
        removeLoadingIndicator();
        appendMessage('assistant', 'אופס, משהו השתבש בחיבור לשרת או שהסוכן נתקל בשגיאה בחיפוש.');
    } finally {
        // שחרור הפקדים והחזרת פוקוס
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
});

// מנגנון מעקב עיניים עבור פרי הפלטיפוס
document.addEventListener('mousemove', (e) => {
    const pupils = document.querySelectorAll('.pupil');
    
    pupils.forEach(pupil => {
        const eye = pupil.parentElement;
        const rect = eye.getBoundingClientRect();
        
        const eyeX = rect.left + rect.width / 2;
        const eyeY = rect.top + rect.height / 2;
        
        const angle = Math.atan2(e.clientY - eyeY, e.clientX - eyeX);
        const maxDistance = 3; 
        
        const x = Math.cos(angle) * maxDistance;
        const y = Math.sin(angle) * maxDistance;
        
        pupil.style.transform = `translate(${x}px, ${y}px)`;
    });
});

newChatBtn.addEventListener('click', startNewChat);
window.addEventListener('DOMContentLoaded', initApp);