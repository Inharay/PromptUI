// Batch Upload Logic
async function handleBatchUpload(input, type) {
    const files = input.files;
    if (!files || files.length === 0) return;

    const statusArea = document.getElementById('upload-status-area');
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Create status item
        const statusItem = document.createElement('div');
        statusItem.className = "flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100";
        statusItem.innerHTML = `
            <div class="flex items-center gap-2 overflow-hidden">
                <i data-lucide="loader-2" class="w-3 h-3 animate-spin text-blue-500"></i>
                <span class="truncate max-w-[120px]">${file.name}</span>
            </div>
            <span class="text-gray-400 text-[10px]">上传中...</span>
        `;
        statusArea.prepend(statusItem);
        lucide.createIcons({ root: statusItem });

        // Determine endpoint and params
        let endpoint = '';
        const formData = new FormData();
        formData.append('file', file);

        if (type === 'kb') {
            // KB -> Smart (No model call)
            endpoint = '/api/smart/upload_kb';
        } else {
            // Unstructured (No model call)
            endpoint = '/api/unstructured/upload_data';
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                statusItem.innerHTML = `
                    <div class="flex items-center gap-2 overflow-hidden">
                        <i data-lucide="check-circle-2" class="w-3 h-3 text-green-500"></i>
                        <span class="truncate max-w-[120px]">${file.name}</span>
                    </div>
                    <span class="text-green-600 text-[10px]">完成</span>
                `;
            } else {
                throw new Error('Upload failed');
            }
        } catch (e) {
            statusItem.innerHTML = `
                <div class="flex items-center gap-2 overflow-hidden">
                    <i data-lucide="x-circle" class="w-3 h-3 text-red-500"></i>
                    <span class="truncate max-w-[120px]">${file.name}</span>
                </div>
                <span class="text-red-600 text-[10px]">失败</span>
            `;
        }
        lucide.createIcons({ root: statusItem });
    }
    
    input.value = ''; // Reset input
}

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
            body: JSON.stringify({ message: message }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        removeTypingIndicator(containerId);
        appendMessage(containerId, 'ai', data.response);

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator(containerId);
        appendMessage(containerId, 'ai', '抱歉，连接服务器失败，请检查后端服务是否启动。');
    }
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
            removeTypingIndicator(containerId);
            
            // Show analysis message
            appendMessage(containerId, 'ai', data.message);
            
            // Show result file if exists
            if (data.result_file) {
                appendFileMessage(containerId, 'ai', data.result_file);
            }

        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator(containerId);
            appendMessage(containerId, 'ai', '抱歉，文件上传失败，请检查后端服务是否启动。');
        }
    }
}

// Helper: Append Text Message
function appendMessage(containerId, sender, text) {
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
    
    contentCol.appendChild(name);
    contentCol.appendChild(bubble);
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(contentCol);
    
    container.appendChild(wrapper);
    lucide.createIcons({ root: wrapper });
    scrollToBottom(container);
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
