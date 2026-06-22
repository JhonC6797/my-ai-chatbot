const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');
const modelSelect = document.getElementById('model-select'); 
const historyList = document.getElementById('history-list');
const newChatBtn = document.getElementById('new-chat-btn');

let currentConversationId = null; 
let loadingElement = null;

// טעינה ראשונית של האפליקציה
async function initApp() {
    await fetchConversations();
    
    // אם אין שיחות בכלל, ניצור אחת אוטומטית
    if (historyList.children.length === 0) {
        await startNewChat();
    } else {
        // אם יש שיחות, נפתח את הראשונה ברשימה
        const firstChat = historyList.children[0];
        if (firstChat) {
            const id = firstChat.getAttribute('data-id');
            await selectConversation(id);
        }
    }
}

// 1. משיכת כל השיחות מהשרת והצגתן בסיידבר
async function fetchConversations() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/conversations');
        const conversations = await response.json();
        
        historyList.innerHTML = ''; // ניקוי הרשימה הישנה
        
        conversations.forEach(conv => {
            renderHistoryItem(conv.id, conv.title);
        });
    } catch (error) {
        console.error("שגיאה בטעינת השיחות:", error);
    }
}

// 2. רינדור פריט בודד בסיידבר עם כפתורי מחיקה ועריכה
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
    
    // לחיצה על השיחה עצמה - טעינת ההודעות שלה
    item.addEventListener('click', (e) => {
        if (e.target.closest('.history-actions')) return; // מונע קליק כפול כשלוחצים על המחיקה/עריכה
        selectConversation(id);
    });
    
    // כפתור מחיקה
    item.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm("האם אתה בטוח שברצונך למחוק את השיחה הזו?")) {
            await deleteConversation(id);
        }
    });

    // כפתור עריכת שם
    item.querySelector('.edit-btn').addEventListener('click', async () => {
        const newTitle = prompt("הכנס שם חדש לשיחה:", title);
        if (newTitle && newTitle.trim()) {
            await updateConversationTitle(id, newTitle.trim());
        }
    });
    
    historyList.appendChild(item);
}

// 3. בחירת שיחה אקטיבית וטעינת ההודעות שלה למסך
async function selectConversation(id) {
    currentConversationId = id;
    
    // עדכון העיצוב בסיידבר (סימון ה-Active)
    document.querySelectorAll('.history-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-id') === id) item.classList.add('active');
    });
    
    chatMessages.innerHTML = ''; // ניקוי חלון הצ'אט
    
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

// 4. יצירת שיחה חדשה
async function startNewChat() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/conversations', { method: 'POST' });
        const newConv = await response.json();
        currentConversationId = newConv.id;
        
        await fetchConversations(); // רענון הסיידבר
        await selectConversation(newConv.id); // פתיחת הצ'אט החדש
    } catch (error) {
        console.error("שגיאה ביצירת שיחה חדשה:", error);
    }
}

// 5. מחיקת שיחה
async function deleteConversation(id) {
    try {
        await fetch('http://127.0.0.1:8000/api/conversations/' + id, { method: 'DELETE' });
        await fetchConversations();
        
        // אם מחקנו את השיחה שהיינו בה כרגע, נעבור לשיחה אחרת או נפתח חדשה
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

// 6. עדכון שם שיחה
async function updateConversationTitle(id, newTitle) {
    try {
        await fetch(`http://127.0.0.1:8000/api/conversations/${id}/title`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
        });
        await fetchConversations(); // רענון הסיידבר כדי לראות את השם החדש
    } catch (error) {
        console.error("שגיאה בעדכון השם:", error);
    }
}

// 7. הוספת הודעה למסך (תומך Markdown בעזרת marked)
function appendMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    if (role === 'user') {
        messageDiv.classList.add('user-message');
        messageDiv.innerText = text; 
    } else {
        messageDiv.classList.add('assistant-message');
        // שימוש בספריית marked כדי לרנדר קוד מודגש, בולטים וכו'
        messageDiv.innerHTML = marked.parse(text); 
    }
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight; 
}

function showLoadingIndicator() {
    if (loadingElement) return;
    loadingElement = document.createElement('div');
    loadingElement.classList.add('typing-indicator');
    for (let i = 0; i < 3; i++) {
        loadingElement.appendChild(document.createElement('span'));
    }
    chatMessages.appendChild(loadingElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoadingIndicator() {
    if (loadingElement) {
        loadingElement.remove();
        loadingElement = null;
    }
}

// האזנה לאירוע שליחת הצ'אט
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = userInput.value.trim();
    if (!messageText || !currentConversationId) return;

    appendMessage('user', messageText);
    userInput.value = '';
    showLoadingIndicator();

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
        
        // מרעננים את הסיידבר כי אולי השם של השיחה השתנה אוטומטית בהודעה הראשונה
        await fetchConversations();

    } catch (error) {
        console.error(error);
        removeLoadingIndicator();
        appendMessage('assistant', 'אופס, משהו השתבש בחיבור לשרת או למודל.');
    }
});

// חיבור כפתור "שיחה חדשה" בסיידבר
newChatBtn.addEventListener('click', startNewChat);

// הפעלה ראשונית של האפליקציה בטעינת הדף
window.addEventListener('DOMContentLoaded', initApp);