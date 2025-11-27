from openai import OpenAI
import os
import time
import zipfile
import threading
import json
from .config import UNSTRUCTURED_OUTPUT_DIR

class UnstructuredService:
    def __init__(self):
        # 配置 OpenAI 客户端
        self.client = OpenAI(
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            api_key="sk-c13d96e9c2b0486bb3a2c2ed6016e9b5"
        )
        self.model = "qwen-max" 
        self.history = {} # In-memory storage for chat history: {conversation_id: [messages]}

    def _simulate_zip_creation(self, zip_path: str, delay: int = 5):
        """
        模拟生成 ZIP 文件的后台任务
        """
        def create_zip():
            time.sleep(delay)
            try:
                with zipfile.ZipFile(zip_path, 'w') as zf:
                    zf.writestr('readme.txt', 'This is a simulated result file.')
                print(f"Simulated ZIP created at: {zip_path}")
            except Exception as e:
                print(f"Error creating simulated ZIP: {e}")

        threading.Thread(target=create_zip, daemon=True).start()

    def chat_stream(self, prompt: str, conversation_id: str, employee_id: str):
        """
        Unstructured Analysis Chat with History (Streaming)
        """
        system_prompt = "请记住你是一个非结构化文本分析专家。请对用户输入的内容进行深度解析和提炼。"
        
        # Initialize history for this conversation if not exists
        if conversation_id not in self.history:
            self.history[conversation_id] = []

        # Add user message to history
        self.history[conversation_id].append({"role": "user", "content": prompt})

        # Construct messages for the API call
        messages = [{"role": "system", "content": system_prompt}] + self.history[conversation_id]

        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                stream=True
            )
            
            full_response = ""
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    yield content
            
            # Add assistant response to history
            self.history[conversation_id].append({"role": "assistant", "content": full_response})
            
            # Simulate Citations
            citations = [
                {"title": "产品技术规格书_v2.pdf", "url": "#", "source": "非结构化知识库"},
                {"title": "用户操作手册.docx", "url": "#", "source": "非结构化知识库"}
            ]
            yield "\n\n__CITATIONS__\n\n"
            yield json.dumps(citations)

        except Exception as e:
            print(f"Error calling LLM: {e}")
            yield f"调用大模型失败: {str(e)}。"

    def chat(self, prompt: str, conversation_id: str, employee_id: str) -> str:
        """
        Unstructured Analysis Chat with History
        """
        system_prompt = "请记住你是一个非结构化文本分析专家。请对用户输入的内容进行深度解析和提炼。"
        
        # Initialize history for this conversation if not exists
        if conversation_id not in self.history:
            self.history[conversation_id] = []

        # Add user message to history
        self.history[conversation_id].append({"role": "user", "content": prompt})

        # Construct messages for the API call
        messages = [{"role": "system", "content": system_prompt}] + self.history[conversation_id]

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
            )
            response_content = response.choices[0].message.content
            
            # Add assistant response to history
            self.history[conversation_id].append({"role": "assistant", "content": response_content})
            
            return response_content
        except Exception as e:
            print(f"Error calling LLM: {e}")
            return f"调用大模型失败: {str(e)}。"

    def clear_history(self, conversation_id: str):
        """
        Clear chat history for a specific conversation
        """
        if conversation_id in self.history:
            del self.history[conversation_id]
            return True
        return False

    def get_history(self, conversation_id: str) -> list:
        """
        Get chat history for a specific conversation
        """
        return self.history.get(conversation_id, [])

    def analyze_file(self, file_path: str) -> dict:
        """
        非结构化文件分析
        """
        filename = os.path.basename(file_path)
        file_content = ""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                file_content = f.read(10000)
        except Exception:
            file_content = "(文件内容无法读取或非文本文件)"

        prompt = f"请分析以下文件内容（文件名：{filename}）：\n\n{file_content}\n\n请生成一份详细的分析报告。"
        
        try:
            # analysis_result = self.chat(prompt)
            analysis_result = "test"

        except Exception as e:
            analysis_result = f"分析失败: {str(e)}"

        result_filename = f"analysis_report_{filename}.txt"
        result_path = os.path.join(UNSTRUCTURED_OUTPUT_DIR, result_filename)
        
        with open(result_path, "w", encoding="utf-8") as f:
            f.write(f"Analysis Report for {filename}\n")
            f.write("="*30 + "\n")
            f.write(f"Mode: Unstructured Analysis\n")
            f.write(f"Generated by: {self.model}\n")
            f.write("-" * 20 + "\n\n")
            f.write(analysis_result)
            
        return {
            "message": f"非结构化文件 {filename} 分析完成，请查看生成的报告。",
            "generated_file": {
                "name": result_filename,
                "path": result_path,
                "size": os.path.getsize(result_path)
            }
        }

    def extract_data_from_file(self, file_path: str) -> dict:
        """
        非结构化信息提取：轮询固定目录是否有处理完的对应文件名的压缩包
        """
        filename = os.path.basename(file_path)
        # 假设处理完的文件名是原文件名加 .zip 后缀
        target_zip_name = f"{filename}.zip"
        # 假设监控的输出目录是 outputs
        target_zip_path = os.path.join(UNSTRUCTURED_OUTPUT_DIR, target_zip_name)

        # --- 模拟生成文件 (测试用，生产环境请删除) ---
        self._simulate_zip_creation(target_zip_path, delay=1)
        # ----------------------------------------

        # 轮询等待文件生成，最多等待 60 秒
        max_retries = 60
        for _ in range(max_retries):
            if os.path.exists(target_zip_path):
                break
            time.sleep(1)
        else:
            # 超时未找到文件
            return {
                "message": f"文件 {filename} 处理超时，未找到结果文件。",
            }

        return {
            "message": f"文件 {filename} 提取完成，请下载结果文件。",
            "generated_file": {
                "name": target_zip_name,
                "path": target_zip_path,
                "size": os.path.getsize(target_zip_path)
            }
        }
