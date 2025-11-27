// SSE Connection
const clientId = Date.now().toString();
// Use a fixed conversation ID for simulation
const conversationId = "fixed-simulation-conversation-id";
const employeeId = "emp_001"; // Mock employee ID

const eventSource = new EventSource(`/events/${clientId}`);

eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    if (data.type === 'smart_upload_result') {
        const containerId = 'chat-container-smart';
        removeTypingIndicator(containerId);
        appendMessage(containerId, 'ai', data.message, data.result_file);
    } else if (data.type === 'unstructured_upload_result') {
        const containerId = 'chat-container-unstructured';
        removeTypingIndicator(containerId);
        appendMessage(containerId, 'ai', data.message, data.result_file);
    } else if (data.type === 'error') {
        console.error("Async processing error:", data.message);
        alert(data.message);
    }
};

eventSource.onopen = function() {
    console.log("SSE connected");
}

// KB Management State
// Removed dynamic KB list logic
/*
let currentKB = {
    name: null,
    type: null // 'kb' (structured) or 'unstructured'
};

async function loadKBList(type) {
    // ...
}

async function createKB(type) {
    // ...
}

async function deleteKB(name, type) {
    // ...
}
*/

// Extraction Mode Logic
let isExtractionMode = false;

function toggleExtractionMode(checkbox) {
    isExtractionMode = checkbox.checked;
    const input = document.getElementById('input-unstructured');
    const sendBtn = input.parentElement.querySelector('button[onclick^="sendMessage"]');

    // Create or get the message span
    let msgSpan = document.getElementById('extraction-msg');
    if (!msgSpan) {
        msgSpan = document.createElement('span');
        msgSpan.id = 'extraction-msg';
        msgSpan.className = 'flex-1 text-gray-400 text-sm py-2 italic select-none';
        msgSpan.innerText = '非结构化提取模式：请点击左侧回形针上传文件...';
        msgSpan.style.display = 'none';
        input.parentElement.insertBefore(msgSpan, input);
    }

    if (isExtractionMode) {
        // Hide input and button, show message
        input.style.display = 'none';
        if(sendBtn) sendBtn.style.display = 'none';
        msgSpan.style.display = 'block';
    } else {
        // Show input and button, hide message
        input.style.display = '';
        if(sendBtn) sendBtn.style.display = '';
        msgSpan.style.display = 'none';
        input.focus();
    }
}

// Tab Switching Logic
function switchTab(tabName) {
    const tabs = ['smart-query', 'unstructured'];
    
    tabs.forEach(t => {
        const tabBtn = document.getElementById(`tab-${t}`);
        const view = document.getElementById(`view-${t}`);
        
        if (t === tabName) {
            tabBtn.classList.remove('tab-inactive');
            tabBtn.classList.add('tab-active');
            view.classList.remove('hidden');
        } else {
            tabBtn.classList.remove('tab-active');
            tabBtn.classList.add('tab-inactive');
            view.classList.add('hidden');
        }
    });
}

// Auto-resize textarea
document.addEventListener('input', function (e) {
    if (e.target.tagName.toLowerCase() === 'textarea') {
        e.target.style.height = 'auto';
        e.target.style.height = (e.target.scrollHeight) + 'px';
    }
});

// Handle Enter key to send
function handleEnter(event, type) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage(type);
    }
}

// Send Message Logic
async function sendMessage(type) {
    const inputId = `input-${type}`;
    const containerId = `chat-container-${type}`;
    const input = document.getElementById(inputId);
    const message = input.value.trim();

    if (!message) return;

    // Add User Message
    appendMessage(containerId, 'user', message);
    input.value = '';
    input.style.height = 'auto';

    // Show Typing Indicator
    showTypingIndicator(containerId);
    
    // Determine endpoint based on type
    // type is 'smart' or 'unstructured'
    const endpoint = type === 'smart' ? '/api/smart/chat' : '/api/unstructured/chat';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                prompt: message,
                conversation_id: conversationId,
                employee_id: employeeId
            }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        removeTypingIndicator(containerId);
        const bubble = appendMessage(containerId, 'ai', '');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            aiResponse += chunk;
            
            // Check for citations delimiter
            const parts = aiResponse.split('\n\n__CITATIONS__\n\n');
            const mainContent = parts[0];
            
            bubble.innerHTML = marked.parse(mainContent);
            
            if (parts.length > 1 && parts[1].trim() !== '') {
                try {
                    const citations = JSON.parse(parts[1]);
                    renderCitations(bubble, citations);
                } catch (e) {
                    // Incomplete JSON, wait for more chunks
                }
            }

            scrollToBottom(document.getElementById(containerId));
        }

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator(containerId);
        appendMessage(containerId, 'ai', '抱歉，连接服务器失败，请检查后端服务是否启动。');
    }
}

function renderCitations(bubble, citations) {
    let citationsContainer = bubble.querySelector('.citations-container');
    if (!citationsContainer) {
        citationsContainer = document.createElement('div');
        citationsContainer.className = 'citations-container mt-4 pt-3 border-t border-gray-200';
        bubble.appendChild(citationsContainer);
    }
    
    citationsContainer.innerHTML = `
        <div class="text-xs font-semibold text-gray-500 mb-2">引用文档：</div>
        <div class="flex flex-wrap gap-2">
            ${citations.map(c => `
                <a href="${c.url}" class="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 transition-colors" target="_blank">
                    <i data-lucide="file-text" class="w-3 h-3"></i>
                    <span>${c.title}</span>
                </a>
            `).join('')}
        </div>
    `;
    lucide.createIcons({ root: citationsContainer });
}

// File Upload Logic
async function handleFileUpload(input, type) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const containerId = `chat-container-${type}`;
        
        // Add User File Message
        appendFileMessage(containerId, 'user', file);
        
        // Reset input
        input.value = '';

        // Show Typing Indicator
        showTypingIndicator(containerId);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('client_id', clientId);
        
        let endpoint = '';
        if (type === 'smart') {
            endpoint = '/api/smart/upload';
        } else {
            endpoint = '/api/unstructured/upload';
            if (isExtractionMode) {
                formData.append('is_extraction', 'true');
            }
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            // Don't remove typing indicator here, wait for WS message
            // removeTypingIndicator(containerId);
            
            // Show immediate status if needed, or just wait
            // appendMessage(containerId, 'ai', data.message); 
            
        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator(containerId);
            appendMessage(containerId, 'ai', '抱歉，文件上传失败，请检查后端服务是否启动。');
        }
    }
}

// KB Modal Management
function openKB(type) {
    window.location.href = `/kb_manager.html?type=${type}`;
}

// Removed Modal Logic
/*
function closeKBManager() {
    document.getElementById('kb-manager-modal').classList.add('hidden');
    currentKB = { name: null, type: null };
}
*/

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    initFeatureToggles();
    loadHistory('smart');
    if (ENABLE_UNSTRUCTURED_ANALYSIS) {
        loadHistory('unstructured');
    }
    // loadKBList('kb'); // Removed
});

// Helper: Append Text Message
function appendMessage(containerId, sender, text, file = null) {
    const container = document.getElementById(containerId);
    const isUser = sender === 'user';
    
    const wrapper = document.createElement('div');
    wrapper.className = `flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`;
    
    const avatar = document.createElement('div');
    avatar.className = `w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-gray-800 text-white' : (containerId.includes('smart') ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600')}`;
    avatar.innerHTML = isUser ? '<i data-lucide="user" class="w-5 h-5"></i>' : (containerId.includes('smart') ? '<i data-lucide="bot" class="w-5 h-5"></i>' : '<i data-lucide="sparkles" class="w-5 h-5"></i>');
    
    const contentCol = document.createElement('div');
    contentCol.className = `flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`;
    
    const name = document.createElement('span');
    name.className = "text-xs text-gray-500";
    name.innerText = isUser ? '您' : (containerId.includes('smart') ? 'AI 助手' : '分析助手');
    
    const bubble = document.createElement('div');
    bubble.className = `p-3 rounded-2xl text-sm leading-relaxed ${isUser ? 'bg-gray-800 text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none prose max-w-none'}`;
    
    if (isUser) {
        bubble.innerText = text;
    } else {
        // Parse Markdown for AI response
        bubble.innerHTML = marked.parse(text);
    }

    // Append File if exists (Inside the same bubble)
    if (file) {
        // Divider
        const divider = document.createElement('hr');
        divider.className = "my-3 border-gray-300";
        bubble.appendChild(divider);

        // File Container
        const fileContainer = document.createElement('div');
        fileContainer.className = "flex items-center gap-3 cursor-pointer hover:bg-gray-200 p-2 rounded-lg transition-colors group";
        
        fileContainer.onclick = () => {
            if (file.url) {
                const a = document.createElement('a');
                a.href = file.url;
                a.download = file.name || 'download';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                alert(`模拟下载文件: ${file.name}`);
            }
        };
        
        const iconBox = document.createElement('div');
        iconBox.className = "w-10 h-10 bg-white rounded-lg flex items-center justify-center text-red-500 shadow-sm";
        iconBox.innerHTML = '<i data-lucide="file-text" class="w-6 h-6"></i>';
        
        const fileInfo = document.createElement('div');
        fileInfo.className = "flex flex-col flex-1 min-w-0";
        
        const fileName = document.createElement('span');
        fileName.className = "font-medium text-gray-700 truncate group-hover:text-blue-600 transition-colors";
        fileName.innerText = file.name;
        
        const fileSize = document.createElement('span');
        fileSize.className = "text-xs text-gray-500";
        fileSize.innerText = formatFileSize(file.size);
        
        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileSize);
        
        const downloadIcon = document.createElement('div');
        downloadIcon.className = "text-gray-400 group-hover:text-blue-600";
        downloadIcon.innerHTML = '<i data-lucide="download" class="w-5 h-5"></i>';

        fileContainer.appendChild(iconBox);
        fileContainer.appendChild(fileInfo);
        fileContainer.appendChild(downloadIcon);
        
        bubble.appendChild(fileContainer);
    }
    
    contentCol.appendChild(name);
    contentCol.appendChild(bubble);
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(contentCol);
    
    container.appendChild(wrapper);
    lucide.createIcons({ root: wrapper });
    scrollToBottom(container);

    return bubble;
}

// Helper: Append File Message
function appendFileMessage(containerId, sender, file) {
    const container = document.getElementById(containerId);
    const isUser = sender === 'user';
    
    const wrapper = document.createElement('div');
    wrapper.className = `flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`;
    
    const avatar = document.createElement('div');
    avatar.className = `w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-gray-800 text-white' : (containerId.includes('smart') ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600')}`;
    avatar.innerHTML = isUser ? '<i data-lucide="user" class="w-5 h-5"></i>' : (containerId.includes('smart') ? '<i data-lucide="bot" class="w-5 h-5"></i>' : '<i data-lucide="sparkles" class="w-5 h-5"></i>');
    
    const contentCol = document.createElement('div');
    contentCol.className = `flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`;
    
    const name = document.createElement('span');
    name.className = "text-xs text-gray-500";
    name.innerText = isUser ? '您' : (containerId.includes('smart') ? 'AI 助手' : '分析助手');
    
    // File Bubble
    const bubble = document.createElement('div');
    bubble.className = `p-3 rounded-2xl text-sm leading-relaxed border ${isUser ? 'bg-white border-gray-200 rounded-tr-none' : 'bg-white border-gray-200 rounded-tl-none'} flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors group`;
    
    bubble.onclick = () => {
        if (file.url) {
            const a = document.createElement('a');
            a.href = file.url;
            a.download = file.name || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert(`模拟下载文件: ${file.name}`);
        }
    };
    
    const iconBox = document.createElement('div');
    iconBox.className = "w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-500";
    iconBox.innerHTML = '<i data-lucide="file-text" class="w-6 h-6"></i>';
    
    const fileInfo = document.createElement('div');
    fileInfo.className = "flex flex-col";
    
    const fileName = document.createElement('span');
    fileName.className = "font-medium text-gray-700 group-hover:text-blue-600 transition-colors";
    fileName.innerText = file.name;
    
    const fileSize = document.createElement('span');
    fileSize.className = "text-xs text-gray-400";
    fileSize.innerText = formatFileSize(file.size);
    
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    
    const downloadIcon = document.createElement('div');
    downloadIcon.className = "text-gray-300 group-hover:text-blue-500 ml-2";
    downloadIcon.innerHTML = '<i data-lucide="download" class="w-5 h-5"></i>';

    bubble.appendChild(iconBox);
    bubble.appendChild(fileInfo);
    bubble.appendChild(downloadIcon);
    
    contentCol.appendChild(name);
    contentCol.appendChild(bubble);
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(contentCol);
    
    container.appendChild(wrapper);
    lucide.createIcons({ root: wrapper });
    scrollToBottom(container);
}

// Helper: Typing Indicator
function showTypingIndicator(containerId) {
    const container = document.getElementById(containerId);
    const wrapper = document.createElement('div');
    wrapper.id = `typing-${containerId}`;
    wrapper.className = "flex gap-4";
    
    const avatar = document.createElement('div');
    avatar.className = `w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${containerId.includes('smart') ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`;
    avatar.innerHTML = containerId.includes('smart') ? '<i data-lucide="bot" class="w-5 h-5"></i>' : '<i data-lucide="sparkles" class="w-5 h-5"></i>';
    
    const bubble = document.createElement('div');
    bubble.className = "bg-gray-100 p-3 rounded-2xl rounded-tl-none flex items-center gap-1";
    bubble.innerHTML = `
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
    `;
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    lucide.createIcons({ root: wrapper });
    scrollToBottom(container);
}

function removeTypingIndicator(containerId) {
    const indicator = document.getElementById(`typing-${containerId}`);
    if (indicator) indicator.remove();
}

function scrollToBottom(container) {
    container.scrollTop = container.scrollHeight;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Static Feature Toggle
const ENABLE_UNSTRUCTURED_ANALYSIS = false; // Set to true to enable Unstructured Analysis Tab

// Feature Toggle Logic
function initFeatureToggles() {
    const tabBtn = document.getElementById('tab-unstructured');
    const sidebarSection = document.getElementById('sidebar-unstructured-section');
    
    // Always show Unstructured Knowledge Management
    if (sidebarSection) sidebarSection.classList.remove('hidden');
    // loadKBList('unstructured'); // Removed

    if (ENABLE_UNSTRUCTURED_ANALYSIS) {
        // Show Tab
        if (tabBtn) tabBtn.classList.remove('hidden');
    } else {
        // Hide Tab
        if (tabBtn) tabBtn.classList.add('hidden');
    }
}

// Clear History Logic
async function clearHistory(type) {
    if (!confirm('确定要清空当前对话历史吗？')) return;

    const containerId = `chat-container-${type}`;
    const container = document.getElementById(containerId);
    
    // Clear UI (keep the welcome message if possible, or just clear all)
    // Let's keep the first child (welcome message) if it exists
    const welcomeMsg = container.firstElementChild;
    container.innerHTML = '';
    if (welcomeMsg) {
        container.appendChild(welcomeMsg);
    }

    // Call Backend API
    const endpoint = type === 'smart' ? `/api/smart/history/${conversationId}` : `/api/unstructured/history/${conversationId}`;
    
    try {
        const response = await fetch(endpoint, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        // Optional: Add a system message saying history cleared
        // appendMessage(containerId, 'ai', '对话历史已清空。');

    } catch (error) {
        console.error('Error clearing history:', error);
        alert('清空历史失败，请检查网络连接。');
    }
}

// Load History Logic
async function loadHistory(type) {
    const containerId = `chat-container-${type}`;
    const endpoint = type === 'smart' ? `/api/smart/history/${conversationId}` : `/api/unstructured/history/${conversationId}`;

    try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Failed to load history');
        
        const data = await response.json();
        const history = data.history || [];
        
        history.forEach(msg => {
            // Skip system messages
            if (msg.role === 'system') return;
            
            const sender = msg.role === 'user' ? 'user' : 'ai';
            appendMessage(containerId, sender, msg.content);
        });
        
    } catch (error) {
        console.error('Error loading history:', error);
    }
}
