const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');
const modelSelect = document.getElementById('model-select'); 
const historyList = document.getElementById('history-list');
const newChatBtn = document.getElementById('new-chat-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const langToggleBtn = document.getElementById('lang-toggle-btn');
const sendBtn = document.getElementById('send-btn');

const renameModal = document.getElementById('rename-modal');
const renameInput = document.getElementById('rename-input');
const renameConfirmBtn = document.getElementById('rename-confirm-btn');
const renameCancelBtn = document.getElementById('rename-cancel-btn');

const deleteModal = document.getElementById('delete-modal');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');

const sidebarPanel = document.getElementById('sidebar-panel');
const dockSearchBtn = document.getElementById('dock-search-btn');
const dockNewChatBtn = document.getElementById('dock-new-chat-btn');
const dockStatsBtn = document.getElementById('dock-stats-btn');
const dockClearBtn = document.getElementById('dock-clear-btn');
const sidebarSearchInput = document.getElementById('sidebar-search-input');
const statsModal = document.getElementById('stats-modal');
const statsCloseBtn = document.getElementById('stats-close-btn');

// אלמנטים לניהול קבצים (RAG)
const attachBtn = document.getElementById('attach-btn');
const uploadMenu = document.getElementById('upload-menu');
const fileInput = document.getElementById('file-input');
const filePreviewBar = document.getElementById('file-preview-bar');

let currentConversationId = null; 
let loadingElement = null;
let currentLang = localStorage.getItem('lang') || 'he'; 
let selectedFiles = []; // שמירת קבצים פעילים במערכת

// מנגנון ניהול עצירת חשיבה 
let isGenerating = false;
let currentAbortController = null;

const translations = {
    he: {
        newChat: "שיחה חדשה", recentChats: "שיחות אחרונות", activeEngine: "מנוע אקטיבי:",
        statusBadge: "<span class='status-dot animate-pulse'></span>סוכן אוטונומי • מחובר",
        placeholder: "שאל את הסוכן או בקש חיפוש... (Enter לשליחה)", searchPlaceholder: "חפש שיחה...", send: "שלח",
        welcome: "היי! ברוך הבא ל-<strong>AgentP</strong>. מה התוכנית להיום?",
        emptyChat: "השיחה הזו ריקה. שאל אותי משהו כדי להתחיל!",
        loadingText: "הסוכן שוקל את צעדיו...",
        serverOffline: "⚠️ השרת כבוי או מנותק כעת.", serverError: "אופס, משהו השתבש בתקשורת עם השרת.",
        renameTitle: "שנה שם שיחה", deleteTitle: "מחיקת שיחה", deleteText: "האם אתה בטוח שברצונך למחוק את השיחה הזו לצמיתות?",
        cancel: "ביטול", save: "שמור", delete: "מחק"
    },
    en: {
        newChat: "New Chat", recentChats: "Recent Conversations", activeEngine: "Active Engine:",
        statusBadge: "<span class='status-dot animate-pulse'></span>Autonomous Agent • Connected",
        placeholder: "Ask the agent or search...", searchPlaceholder: "Search chats...", send: "Send",
        welcome: "Hi! Welcome to <strong>AgentP</strong>. What's the plan today?",
        emptyChat: "This conversation is empty. Ask me anything to get started!",
        loadingText: "Agent is thinking...",
        serverOffline: "⚠️ The server is currently offline.", serverError: "Oops, something went wrong.",
        renameTitle: "Rename Conversation", deleteTitle: "Delete Conversation", deleteText: "Are you sure you want to permanently delete this conversation?",
        cancel: "Cancel", save: "Save", delete: "Delete"
    }
};

async function initApp() {
    initTheme(); initLanguage(); setupTextarea(); setupModalEvents(); setupDockAndSearchEvents(); setupFileUploadEvents();
    await fetchConversations();
    if (historyList.children.length === 0) { await startNewChat(); } else { await selectConversation(historyList.children[0].getAttribute('data-id')); }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark-theme';
    document.body.className = savedTheme;
    themeToggleBtn.addEventListener('click', () => {
        const newTheme = document.body.classList.contains('dark-theme') ? 'light-theme' : 'dark-theme';
        document.body.className = newTheme; localStorage.setItem('theme', newTheme);
    });
}

function initLanguage() {
    applyLanguage(currentLang);
    langToggleBtn.addEventListener('click', async () => {
        currentLang = currentLang === 'he' ? 'en' : 'he'; localStorage.setItem('lang', currentLang);
        applyLanguage(currentLang); await fetchConversations(); 
    });
}

function applyLanguage(lang) {
    const t = translations[lang]; document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'; document.documentElement.lang = lang;
    document.getElementById('txt-new-chat').textContent = t.newChat; document.getElementById('txt-recent-chats').textContent = t.recentChats;
    document.getElementById('txt-active-engine').textContent = t.activeEngine; document.getElementById('txt-status-badge').innerHTML = t.statusBadge;
    userInput.placeholder = t.placeholder; sidebarSearchInput.placeholder = t.searchPlaceholder;
    document.getElementById('modal-rename-title').textContent = t.renameTitle; document.getElementById('modal-delete-title').textContent = t.deleteTitle;
    document.getElementById('modal-delete-text').textContent = t.deleteText; document.getElementById('rename-cancel-btn').textContent = t.cancel;
    document.getElementById('rename-confirm-btn').textContent = t.save; document.getElementById('delete-cancel-btn').textContent = t.cancel; document.getElementById('delete-confirm-btn').textContent = t.delete;
    if (chatMessages.children.length <= 1) { chatMessages.innerHTML = `<div class="message assistant-message">${t.welcome}</div>`; }
}

function setupDockAndSearchEvents() {
    const dockSparkBtn = document.getElementById('dock-spark-btn');
    const logoContainer = document.querySelector('.logo-container');

    // פונקציה מרכזית לפתיחה וסגירה של הסיידבר
    function toggleSidebar() {
        const isCollapsed = sidebarPanel.classList.toggle('collapsed');
        if (isCollapsed) { 
            dockSearchBtn.classList.remove('active-dock'); 
        } else { 
            dockSearchBtn.classList.add('active-dock'); 
            sidebarSearchInput.focus(); 
        }
    }

    // הפעלה בלחיצה על כפתור חיפוש, לוגו המותג, או פרי עצמו
    dockSearchBtn.addEventListener('click', toggleSidebar);
    if (dockSparkBtn) dockSparkBtn.addEventListener('click', toggleSidebar);
    if (logoContainer) logoContainer.addEventListener('click', toggleSidebar);

    sidebarSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.style.display = item.querySelector('.history-title').textContent.toLowerCase().includes(query) ? 'flex' : 'none';
        });
    });

    dockNewChatBtn.addEventListener('click', () => { 
        sidebarPanel.classList.remove('collapsed'); 
        dockSearchBtn.classList.add('active-dock'); 
        startNewChat(); 
    });
    dockStatsBtn.addEventListener('click', () => statsModal.classList.add('show'));
    statsCloseBtn.addEventListener('click', () => statsModal.classList.remove('show'));
    dockClearBtn.addEventListener('click', () => { if (currentConversationId) openDeleteModal(currentConversationId); });
}

function setupTextarea() {
    userInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; });
    userInput.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatForm.requestSubmit(); } });
}

function setupFileUploadEvents() {
    attachBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadMenu.classList.toggle('show');
    });
    document.addEventListener('click', () => uploadMenu.classList.remove('show'));
    
    fileInput.addEventListener('change', () => {
        selectedFiles = [...selectedFiles, ...fileInput.files];
        renderFilePreview();
    });
}

function renderFilePreview() {
    filePreviewBar.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const badge = document.createElement('div');
        badge.classList.add('file-badge');
        badge.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
            <span>${file.name}</span>
            <span class="remove-file" onclick="removeFile(${index})">✕</span>
        `;
        filePreviewBar.appendChild(badge);
    });
}

window.removeFile = (index) => {
    selectedFiles.splice(index, 1);
    renderFilePreview();
};

async function fetchConversations() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/conversations'); const conversations = await response.json();
        historyList.innerHTML = ''; conversations.forEach(conv => renderHistoryItem(conv.id, conv.title));
    } catch (error) { console.error(error); }
}

function renderHistoryItem(id, title) {
    const item = document.createElement('div'); item.classList.add('history-item'); if (id === currentConversationId) item.classList.add('active');
    item.setAttribute('data-id', id); const displayedTitle = title === "שיחה חדשה" ? translations[currentLang].newChat : title;
    item.innerHTML = `<span class="history-title">${displayedTitle}</span><div class="history-actions"><button class="action-btn edit-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button class="action-btn delete-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div>`;
    item.addEventListener('click', (e) => { if (!e.target.closest('.history-actions')) selectConversation(id); });
    item.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(id));
    item.querySelector('.edit-btn').addEventListener('click', () => openRenameModal(id, title));
    historyList.appendChild(item);
}

let activeModalConversationId = null;
function setupModalEvents() {
    renameCancelBtn.addEventListener('click', () => renameModal.classList.remove('show'));
    deleteCancelBtn.addEventListener('click', () => deleteModal.classList.remove('show'));
    renameConfirmBtn.addEventListener('click', async () => { if (renameInput.value.trim() && activeModalConversationId) { await updateConversationTitle(activeModalConversationId, renameInput.value.trim()); renameModal.classList.remove('show'); } });
    deleteConfirmBtn.addEventListener('click', async () => { if (activeModalConversationId) { await deleteConversation(activeModalConversationId); deleteModal.classList.remove('show'); } });
}

function openRenameModal(id, currentTitle) { activeModalConversationId = id; renameInput.value = currentTitle === "שיחה חדשה" ? translations[currentLang].newChat : currentTitle; renameModal.classList.add('show'); renameInput.focus(); }
function openDeleteModal(id) { activeModalConversationId = id; deleteModal.classList.add('show'); }

async function selectConversation(id) {
    currentConversationId = id;
    document.querySelectorAll('.history-item').forEach(item => { item.classList.remove('active'); if (item.getAttribute('data-id') === id) item.classList.add('active'); });
    chatMessages.innerHTML = '';
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/conversations/${id}/messages`); const messages = await response.json();
        if (messages.length === 0) { chatMessages.innerHTML = `<div class="message assistant-message">${translations[currentLang].emptyChat}</div>`; } 
        else { messages.forEach(msg => appendMessage(msg.role, msg.content, msg.thoughts, true)); } 
    } catch (error) { console.error(error); }
}

async function startNewChat() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/conversations', { method: 'POST' }); const newConv = await response.json();
        currentConversationId = newConv.id; await fetchConversations(); await selectConversation(newConv.id);
    } catch (error) { console.error(error); }
}

async function deleteConversation(id) {
    try {
        await fetch('http://127.0.0.1:8000/api/conversations/' + id, { method: 'DELETE' }); await fetchConversations();
        if (currentConversationId === id) { if (historyList.children.length > 0) { await selectConversation(historyList.children[0].getAttribute('data-id')); } else { await startNewChat(); } }
    } catch (error) { console.error(error); }
}

async function updateConversationTitle(id, newTitle) {
    try {
        await fetch(`http://127.0.0.1:8000/api/conversations/${id}/title`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) });
        await fetchConversations();
    } catch (error) { console.error(error); }
}

function appendMessage(role, text, thoughts = null, isHistory = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    
    if (role === 'user') {
        messageDiv.classList.add('user-message'); messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
    } else {
        messageDiv.classList.add('assistant-message');
        document.querySelectorAll('.message-thought-trigger, .inline-thought-box').forEach(el => el.remove());
        
        let htmlContent = `<div class="message-text-content">${marked.parse(text)}</div>`;
        
        if (thoughts && !isHistory) {
            htmlContent += `
                <button class="message-thought-trigger" title="הצג חשיבה בלייב">
                    <svg class="thought-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="inline-thought-box">${thoughts}</div>
            `;
        }
        
        messageDiv.innerHTML = htmlContent;
        chatMessages.appendChild(messageDiv);
        
        if (thoughts && !isHistory) {
            const btn = messageDiv.querySelector('.message-thought-trigger');
            const box = messageDiv.querySelector('.inline-thought-box');
            btn.addEventListener('click', () => { box.classList.toggle('open'); btn.classList.toggle('open'); });
        }
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendErrorMessage(text) {
    const messageDiv = document.createElement('div'); messageDiv.classList.add('message', 'error-message'); messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv); chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showLoadingIndicator(statusText = translations[currentLang].loadingText) {
    if (loadingElement) { loadingElement.querySelector('.indicator-status-text').innerText = statusText; return; }
    loadingElement = document.createElement('div'); loadingElement.classList.add('typing-indicator');
    const statusDiv = document.createElement('div'); statusDiv.classList.add('indicator-status-text'); statusDiv.innerText = statusText; loadingElement.appendChild(statusDiv);
    const dotsWrapper = document.createElement('div'); dotsWrapper.classList.add('dots-wrapper'); for (let i = 0; i < 3; i++) { dotsWrapper.appendChild(document.createElement('span')); }
    loadingElement.appendChild(dotsWrapper); chatMessages.appendChild(loadingElement); chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoadingIndicator() { if (loadingElement) { loadingElement.remove(); loadingElement = null; } }

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (isGenerating) {
        if (currentAbortController) { currentAbortController.abort(); }
        return;
    }

    const messageText = userInput.value.trim();
    if (!messageText || !currentConversationId) return;

    appendMessage('user', messageText);

    const formData = new FormData();
    formData.append('message', messageText);
    formData.append('provider', modelSelect.value);
    selectedFiles.forEach(file => formData.append('files', file));

    userInput.value = '';
    selectedFiles = [];
    renderFilePreview(); 
    
    userInput.style.height = 'auto';
    userInput.disabled = true; 
    
    isGenerating = true;
    sendBtn.classList.add('stop-mode');
    sendBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg>`;

    showLoadingIndicator(translations[currentLang].loadingText);

    currentAbortController = new AbortController();

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/conversations/${currentConversationId}/chat`, {
            method: 'POST',
            body: formData,
            signal: currentAbortController.signal
        });

        if (!response.ok) throw new Error('server_error');

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let accumulatedThoughts = "";
        let accumulatedFinalText = "";
        
        document.querySelectorAll('.message-thought-trigger, .inline-thought-box').forEach(el => el.remove());
        const assistantMessageDiv = document.createElement('div');
        assistantMessageDiv.classList.add('message', 'assistant-message');
        assistantMessageDiv.innerHTML = `
            <button class="message-thought-trigger">
                <svg class="thought-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="message-text-content"></div>
            <div class="inline-thought-box"></div>
        `;
        chatMessages.appendChild(assistantMessageDiv);
        
        const textContentDiv = assistantMessageDiv.querySelector('.message-text-content');
        const thoughtBoxDiv = assistantMessageDiv.querySelector('.inline-thought-box');
        const arrowBtn = assistantMessageDiv.querySelector('.message-thought-trigger');
        
        arrowBtn.addEventListener('click', () => { thoughtBoxDiv.classList.toggle('open'); arrowBtn.classList.toggle('open'); });

        while (true) {
            const { value, done } = await reader.read(); if (done) break;
            
            buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n\n"); buffer = lines.pop();
            
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const event = JSON.parse(line.slice(6).trim());
                    
                    if (event.type === 'status') {
                        showLoadingIndicator(event.text); 
                    } else if (event.type === 'thought_chunk') {
                        accumulatedThoughts += event.text;
                        thoughtBoxDiv.textContent = accumulatedThoughts; 
                    } else if (event.type === 'final_chunk') {
                        removeLoadingIndicator(); 
                        accumulatedFinalText += event.text;
                        textContentDiv.innerHTML = marked.parse(accumulatedFinalText); 
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                }
            }
        }
        await fetchConversations();

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('הזרמת המידע הופסקה על ידי המשתמש.');
            appendErrorMessage("❌ התהליך הופסק על ידי המשתמש.");
        } else {
            console.error(error);
            const errMsg = error instanceof TypeError ? translations[currentLang].serverOffline : translations[currentLang].serverError;
            appendErrorMessage(errMsg);
        }
        removeLoadingIndicator();
    } finally { 
        isGenerating = false;
        currentAbortController = null;
        userInput.disabled = false; 
        sendBtn.classList.remove('stop-mode');
        sendBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
        userInput.focus(); 
    }
});

document.addEventListener('mousemove', (e) => {
    const pupils = document.querySelectorAll('.pupil');
    pupils.forEach(pupil => {
        const rect = pupil.parentElement.getBoundingClientRect();
        const angle = Math.atan2(e.clientY - (rect.top + rect.height / 2), e.clientX - (rect.left + rect.width / 2));
        pupil.style.transform = `translate(${Math.cos(angle) * 3}px, ${Math.sin(angle) * 3}px)`;
    });
});

newChatBtn.addEventListener('click', startNewChat); window.addEventListener('DOMContentLoaded', initApp);