const urlParams = new URLSearchParams(window.location.search);
const kbType = urlParams.get('type'); // 'kb' or 'unstructured'

let currentPage = 1;
const pageSize = 10;
let totalPages = 1;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!kbType) {
        alert('缺少知识库参数');
        window.location.href = '/';
        return;
    }

    document.getElementById('kb-title').innerText = kbType === 'kb' ? '结构化知识库' : '非结构化知识库';
    document.getElementById('kb-subtitle').innerText = kbType === 'kb' ? '数据库表格管理' : '文档资料管理';
    
    loadFiles();
    lucide.createIcons();
});

async function loadFiles() {
    const tbody = document.getElementById('file-list-body');
    tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-gray-400">加载中...</td></tr>';

    const endpoint = kbType === 'kb' 
        ? `/api/smart/kb/files?page=${currentPage}&page_size=${pageSize}` 
        : `/api/unstructured/kb/files?page=${currentPage}&page_size=${pageSize}`;

    try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Failed to fetch files');
        
        const data = await response.json();
        const files = data.files || [];
        totalPages = data.total_pages || 1;
        const totalFiles = data.total || 0;

        document.getElementById('total-files').innerText = `共 ${totalFiles} 个文件`;
        document.getElementById('page-info').innerText = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
        
        document.getElementById('prev-btn').disabled = currentPage <= 1;
        document.getElementById('next-btn').disabled = currentPage >= totalPages;

        tbody.innerHTML = '';
        
        if (files.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-gray-400 flex flex-col items-center gap-2"><i data-lucide="folder-open" class="w-8 h-8 text-gray-300"></i><span>暂无文件</span></td></tr>';
            lucide.createIcons({ root: tbody });
            return;
        }

        files.forEach((filename, index) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 transition-colors group";
            
            tr.innerHTML = `
                <td class="px-6 py-4 text-gray-400 text-xs">${(currentPage - 1) * pageSize + index + 1}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-blue-50 rounded flex items-center justify-center text-blue-500">
                            <i data-lucide="file-text" class="w-4 h-4"></i>
                        </div>
                        <span class="font-medium text-gray-700">${filename}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${kbType === 'kb' && filename.toLowerCase().endsWith('.csv') ? `
                        <button onclick="previewFile('${filename}')" class="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="预览数据">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>` : ''}
                        <button onclick="downloadFile('${filename}')" class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="下载">
                            <i data-lucide="download" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteFile('${filename}')" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="删除">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
        
        lucide.createIcons({ root: tbody });

    } catch (error) {
        console.error('Error loading files:', error);
        tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-red-400">加载失败</td></tr>';
    }
}

function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        loadFiles();
    }
}

async function handleUpload(input) {
    const files = input.files;
    if (!files || files.length === 0) return;

    // Show loading state (simple alert or toast would be better, but let's just refresh for now)
    // Or add a temporary row
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const endpoint = kbType === 'kb' 
            ? `/api/smart/kb/upload` 
            : `/api/unstructured/kb/upload`;

        try {
            await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });
        } catch (e) {
            console.error(`Failed to upload ${file.name}`, e);
            alert(`文件 ${file.name} 上传失败`);
        }
    }
    
    input.value = '';
    loadFiles();
}

function downloadFile(filename) {
    const endpoint = kbType === 'kb' 
        ? `/api/smart/kb/files/${filename}` 
        : `/api/unstructured/kb/files/${filename}`;
    window.open(endpoint, '_blank');
}

async function deleteFile(filename) {
    if (!confirm(`确定要删除文件 "${filename}" 吗？`)) return;
    
    const endpoint = kbType === 'kb' 
        ? `/api/smart/kb/files/${filename}` 
        : `/api/unstructured/kb/files/${filename}`;
    
    try {
        const response = await fetch(endpoint, { method: 'DELETE' });
        if (response.ok) {
            loadFiles();
        } else {
            alert('删除失败');
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        alert('删除出错');
    }
}

async function previewFile(filename) {
    const modal = document.getElementById('preview-modal');
    const title = document.getElementById('preview-title');
    const content = document.getElementById('preview-content');
    
    title.innerText = `数据预览: ${filename}`;
    content.innerHTML = '<div class="flex justify-center py-10"><i data-lucide="loader-2" class="w-8 h-8 animate-spin text-blue-500"></i></div>';
    lucide.createIcons({ root: content });
    modal.classList.remove('hidden');

    try {
        const response = await fetch(`/api/smart/kb/data/${filename}`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to load data');
        }
        
        const data = await response.json();
        
        if (!data.columns || data.columns.length === 0) {
            content.innerHTML = '<div class="text-center text-gray-400 py-10">暂无数据或格式不支持</div>';
            return;
        }

        // Build Table
        let html = '<table class="w-full text-left border-collapse text-sm">';
        
        // Header
        html += '<thead class="bg-gray-50 sticky top-0"><tr>';
        data.columns.forEach(col => {
            html += `<th class="px-4 py-2 border border-gray-200 font-semibold text-gray-600 whitespace-nowrap">${col}</th>`;
        });
        html += '</tr></thead>';
        
        // Body
        html += '<tbody>';
        data.rows.forEach((row, i) => {
            html += `<tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50">`;
            row.forEach((cell, index) => {
                const colName = data.columns[index];
                const formattedContent = formatCell(cell, colName);
                
                // Show all content fully without truncation
                const tdClass = "px-4 py-2 border border-gray-200 min-w-[150px]";

                html += `<td class="${tdClass}" title="${cell}">${formattedContent}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        
        content.innerHTML = html;

    } catch (error) {
        console.error('Preview error:', error);
        content.innerHTML = `<div class="text-center text-red-500 py-10">加载失败: ${error.message}</div>`;
    }
}

function formatCell(cell, colName) {
    if (!cell) return '';

    // Handle "同义词" and "标签" columns specifically
    if (colName === '同义词' || colName === '标签') {
        if (typeof cell === 'string' && cell.includes(',')) {
            const items = cell.split(',').map(item => item.trim()).filter(item => item);
            
            return `<div class="flex flex-wrap gap-1">
                ${items.map(item => {
                    let content = item;
                    let styleClass = "bg-gray-100 text-gray-700 border-gray-200"; // Default style
                    
                    // If it looks like [TAG:Value], extract content and use blue style
                    if (item.startsWith('[') && item.endsWith(']')) {
                        content = item.slice(1, -1);
                        styleClass = "bg-blue-100 text-blue-700 border-blue-200";
                    }
                    
                    return `<span class="px-2 py-0.5 rounded text-xs border ${styleClass}">${content}</span>`;
                }).join('')}
            </div>`;
        }
    }

    // Fallback for other columns or if no comma found (but still check for tag format just in case)
    if (typeof cell === 'string' && cell.trim().startsWith('[') && cell.trim().endsWith(']')) {
        const items = cell.split(',').map(item => item.trim());
        const isTagList = items.every(item => item.startsWith('[') && item.endsWith(']'));
        
        if (isTagList) {
            return `<div class="flex flex-wrap gap-1">
                ${items.map(item => {
                    const content = item.slice(1, -1);
                    return `<span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs border border-blue-200">${content}</span>`;
                }).join('')}
            </div>`;
        }
    }
    return cell;
}

function closePreview() {
    document.getElementById('preview-modal').classList.add('hidden');
}