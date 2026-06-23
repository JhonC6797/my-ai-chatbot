const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');
const modelSelect = document.getElementById('model-select'); 
const historyList = document.getElementById('history-list');
const newChatBtn = document.getElementById('new-chat-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const langToggleBtn = document.getElementById('lang-toggle-btn');
const sendBtn = document.getElementById('send-btn');

// אלמנטים של המודאלים
const renameModal = document.getElementById('rename-modal');
const renameInput = document.getElementById('rename-input');
const renameConfirmBtn = document.getElementById('rename-confirm-btn');
const renameCancelBtn = document.getElementById('rename-cancel-btn');

const deleteModal = document.getElementById('delete-modal');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');

// 🌟 אלמנטים חדשים: Mini-Dock, קריסת סיידבר, חיפוש וסטטיסטיקות
const sidebarPanel = document.getElementById('sidebar-panel');
const dockSearchBtn = document.getElementById('dock-search-btn');
const dockNewChatBtn = document.getElementById('dock-new-chat-btn');
const dockStatsBtn = document.getElementById('dock-stats-btn');
const dockClearBtn = document.getElementById('dock-clear-btn');
const sidebarSearchInput = document.getElementById('sidebar-search-input');
const statsModal = document.getElementById('stats-modal');
const statsCloseBtn = document.getElementById('stats-close-btn');

let currentConversationId = null; 
let loadingElement = null;
let currentLang = localStorage.getItem('lang') || 'he'; 

const translations = {
    he: {
        newChat: "שיחה חדשה",
        recentChats: "שיחות אחרונות",
        activeEngine: "מנוע אקטיבי:",
        statusBadge: "<span class='status-dot animate-pulse'></span>סוכן חכם + חיפוש ברשת פעיל",
        placeholder: "שאל את הסוכן או בקש חיפוש... (Enter לשליחה, Shift+Enter לשורה חדשה)",
        searchPlaceholder: "חפש שיחה...",
        send: "שלח",
        welcome: "היי! ברוך הבא ל-<strong>AgentP</strong>. אני מחובר כעת לאינטרנט בזמן אמת ומסוגל לבצע עבורך מחקרים, בדיקות ואוטומציות. מה התוכנית להיום?",
        emptyChat: "השיחה הזו ריקה. שאל אותי משהו כדי להתחיל!",
        loadingText: "הסוכן מעבד נתונים ומחפש ברשת...",
        renameTitle: "שנה שם שיחה",
        deleteTitle: "מחיקת שיחה",
        deleteText: "האם אתה בטוח שברצונך למחוק את השיחה הזו לצמיתות?",
        cancel: "ביטול",
        save: "שמור",
        delete: "מחק"
    },
    en: {
        newChat: "New Chat",
        recentChats: "Recent Conversations",
        activeEngine: "Active Engine:",
        statusBadge: "<span class='status-dot animate-pulse'></span>Smart Agent + Web Search Active",
        placeholder: "Ask the agent or search... (Enter to send, Shift+Enter for new line)",
        searchPlaceholder: "Search chats...",
        send: "Send",
        welcome: "Hi! Welcome to <strong>AgentP</strong>. I am currently connected to the internet in real-time and capable of conducting research, analysis, and automations for you. What's the plan today?",
        emptyChat: "This conversation is empty. Ask me anything to get started!",
        loadingText: "Agent is processing data and searching the web...",
        renameTitle: "Rename Conversation",
        deleteTitle: "Delete Conversation",
        deleteText: "Are you sure you want to permanently delete this conversation?",
        cancel: "Cancel",
        save: "Save",
        delete: "Delete"
    }
};

async function initApp() {
    initTheme();
    initLanguage();
    setupTextarea();
    setupModalEvents();
    setupDockAndSearchEvents(); // 🌟 הפעלת מאזיני האירועים החדשים ל-Dock
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

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark-theme';
    document.body.className = savedTheme;

    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        const newTheme = isDark ? 'light-theme' : 'dark-theme';
        document.body.className = newTheme;
        localStorage.setItem('theme', newTheme);
    });
}

function initLanguage() {
    applyLanguage(currentLang);

    langToggleBtn.addEventListener('click', async () => {
        currentLang = currentLang === 'he' ? 'en' : 'he';
        localStorage.setItem('lang', currentLang);
        applyLanguage(currentLang);
        await fetchConversations(); 
    });
}

function applyLanguage(lang) {
    const t = translations[lang];
    
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    
    document.getElementById('txt-new-chat').textContent = t.newChat;
    document.getElementById('txt-recent-chats').textContent = t.recentChats;
    document.getElementById('txt-active-engine').textContent = t.activeEngine;
    document.getElementById('txt-status-badge').innerHTML = t.statusBadge;
    document.getElementById('txt-send').textContent = t.send;
    userInput.placeholder = t.placeholder;
    sidebarSearchInput.placeholder = t.searchPlaceholder;
    
    document.getElementById('modal-rename-title').textContent = t.renameTitle;
    document.getElementById('modal-delete-title').textContent = t.deleteTitle;
    document.getElementById('modal-delete-text').textContent = t.deleteText;
    document.getElementById('rename-cancel-btn').textContent = t.cancel;
    document.getElementById('rename-confirm-btn').textContent = t.save;
    document.getElementById('delete-cancel-btn').textContent = t.cancel;
    document.getElementById('delete-confirm-btn').textContent = t.delete;

    if (chatMessages.children.length <= 1) {
        chatMessages.innerHTML = `<div class="message assistant-message">${t.welcome}</div>`;
    }
}

// 🌟 פונקציה חדשה: מאזיני אירועים ללוגיקת החיפוש הדינמי וה-Dock האנכי
function setupDockAndSearchEvents() {
    // א) לוגיקת קריסת/פתיחת ה-Sidebar דרך כפתור החיפוש ב-Dock
    dockSearchBtn.addEventListener('click', () => {
        const isCollapsed = sidebarPanel.classList.toggle('collapsed');
        if (isCollapsed) {
            dockSearchBtn.classList.remove('active-dock');
        } else {
            dockSearchBtn.classList.add('active-dock');
            sidebarSearchInput.focus(); // שם פוקוס מיידי על החיפוש
        }
    });

    // ב) לוגיקת חיפוש וסינון שיחות בזמן אמת (Live Frontend Filter)
    sidebarSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = historyList.querySelectorAll('.history-item');
        
        items.forEach(item => {
            const title = item.querySelector('.history-title').textContent.toLowerCase();
            if (title.includes(query)) {
                item.style.display = 'flex'; // מציג אם תואם
            } else {
                item.style.display = 'none'; // מעלים אם לא תואם
            }
        });
    });

    // ג) קיצור דרך מה-Dock: פתיחת שיחה חדשה בלחיצה על העיפרון
    dockNewChatBtn.addEventListener('click', () => {
        sidebarPanel.classList.remove('collapsed');
        dockSearchBtn.classList.add('active-dock');
        startNewChat();
    });

    // ד) פתיחת מודאל הסטטיסטיקות המגניב
    dockStatsBtn.addEventListener('click', () => statsModal.classList.add('show'));
    statsCloseBtn.addEventListener('click', () => statsModal.classList.remove('show'));

    // ה) כפתור הניקוי הכללי - מוחק את השיחה הנוכחית מהמסך במהירות
    dockClearBtn.addEventListener('click', () => {
        if (currentConversationId) {
            openDeleteModal(currentConversationId);
        }
    });
}

function setupTextarea() {
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            if (!userInput.disabled) {
                chatForm.requestSubmit(); 
            }
        }
    });
}

async function fetchConversations() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/conversations');
        const conversations = await response.json();
        
        historyList.innerHTML = ''; 
        conversations.forEach(conv => {
            renderHistoryItem(conv.id, conv.title);
        });
        
        // נקה את תיבת החיפוש בריענון רשימה
        sidebarSearchInput.value = '';
    } catch (error) {
        console.error("שגיאה בטעינת השיחות:", error);
    }
}

function renderHistoryItem(id, title) {
    const item = document.createElement('div');
    item.classList.add('history-item');
    if (id === currentConversationId) item.classList.add('active');
    item.setAttribute('data-id', id);
    
    const displayedTitle = title === "שיחה חדשה" ? translations[currentLang].newChat : title;
    
    item.innerHTML = `
        <span class="history-title">${displayedTitle}</span>
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
    
    item.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(id));
    item.querySelector('.edit-btn').addEventListener('click', () => openRenameModal(id, title));
    
    historyList.prepend(item);
}

let activeModalConversationId = null;

function setupModalEvents() {
    renameCancelBtn.addEventListener('click', () => renameModal.classList.remove('show'));
    deleteCancelBtn.addEventListener('click', () => deleteModal.classList.remove('show'));
    
    renameConfirmBtn.addEventListener('click', async () => {
        const newTitle = renameInput.value.trim();
        if (newTitle && activeModalConversationId) {
            await updateConversationTitle(activeModalConversationId, newTitle);
            renameModal.classList.remove('show');
        }
    });
    
    deleteConfirmBtn.addEventListener('click', async () => {
        if (activeModalConversationId) {
            await deleteConversation(activeModalConversationId);
            deleteModal.classList.remove('show');
        }
    });
}

function openRenameModal(id, currentTitle) {
    activeModalConversationId = id;
    renameInput.value = currentTitle === "שיחה חדשה" ? translations[currentLang].newChat : currentTitle;
    renameModal.classList.add('show');
    renameInput.focus();
}

function openDeleteModal(id) {
    activeModalConversationId = id;
    deleteModal.classList.add('show');
}

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
            chatMessages.innerHTML = `<div class="message assistant-message">${translations[currentLang].emptyChat}</div>`;
        } else {
            messages.forEach(msg => appendMessage(msg.role, msg.content));
        }
    } catch (error) {
        console.error("שגיאה במשיכת הודעות:", error);
    }
}

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

function showLoadingIndicator(statusText = translations[currentLang].loadingText) {
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

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = userInput.value.trim();
    if (!messageText || !currentConversationId) return;

    appendMessage('user', messageText);
    userInput.value = '';
    userInput.style.height = 'auto'; 

    userInput.disabled = true;
    sendBtn.disabled = true;
    
    showLoadingIndicator(translations[currentLang].loadingText);
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
        appendMessage('assistant', currentLang === 'he' ? 'אופס, משהו השתבש.' : 'Oops, something went wrong.');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
});

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