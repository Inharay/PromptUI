# AI 智能助手前端

这是一个简洁的 AI 聊天前端界面，包含“智能问数”和“非结构化分析”两个功能模块。

## 功能特点

- **双模式切换**：支持在智能问数和非结构化分析之间无缝切换。
- **聊天交互**：模拟 AI 对话体验。
- **文件处理**：
  - 支持文件上传（点击回形针图标）。
  - 支持文件下载（点击聊天记录中的文件气泡）。
- **响应式设计**：简洁朴素的 UI，适配不同屏幕尺寸。

## 如何运行

### 1. 前端
由于这是一个纯静态的 HTML/JS 项目，您无需安装任何依赖。
1.  直接在浏览器中打开 `index.html` 文件即可。
2.  或者使用 VS Code 的 "Live Server" 插件运行。

### 2. 后端 (Python)
为了使用 AI 对话和文件上传功能，您需要启动 Python 后端。

1.  确保已安装 Python 3.8+。
2.  安装依赖：
    ```bash
    pip install -r backend/requirements.txt
    ```
3.  启动服务：
    ```bash
    cd backend
    python main.py
    ```
    服务默认将在 `http://localhost:8000` 启动。

## 技术栈

- **前端**: HTML5, Vanilla JavaScript, Tailwind CSS (Local), Lucide Icons (Local)
- **后端**: Python, FastAPI, Uvicorn
