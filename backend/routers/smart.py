from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Form, Body
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import shutil
import os
from ..smart_service import SmartService
from ..connection_manager import manager
from ..config import KB_DIR, SMART_OUTPUT_SUBDIR

router = APIRouter(prefix="/api/smart", tags=["smart"])
smart_service = SmartService()

class ChatRequest(BaseModel):
    prompt: str
    conversation_id: str
    employee_id: str

@router.post("/chat")
async def chat(request: ChatRequest):
    try:
        return StreamingResponse(smart_service.chat_stream(request.prompt, request.conversation_id, request.employee_id), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history/{conversation_id}")
async def clear_history(conversation_id: str):
    try:
        smart_service.clear_history(conversation_id)
        return {"message": "History cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{conversation_id}")
async def get_history(conversation_id: str):
    try:
        history = smart_service.get_history(conversation_id)
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def process_smart_file(file_location: str, filename: str, client_id: str):
    try:
        result = await run_in_threadpool(smart_service.analyze_file, file_location)
        
        response_data = {
            "type": "smart_upload_result",
            "filename": filename,
            "message": result["message"],
        }

        if "generated_file" in result:
            gen_file = result["generated_file"]
            response_data["result_file"] = {
                "name": gen_file["name"],
                "url": f"/outputs/{SMART_OUTPUT_SUBDIR}/{gen_file['name']}",
                "size": gen_file["size"]
            }
        
        await manager.send_personal_message(response_data, client_id)
    except Exception as e:
        print(f"Error in process_smart_file: {e}")
        await manager.send_personal_message({
            "type": "error",
            "message": f"Error processing file {filename}: {str(e)}"
        }, client_id)

@router.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...), client_id: str = Form(...)):
    try:
        file_location = f"{KB_DIR}/{file.filename}"
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        
        background_tasks.add_task(process_smart_file, file_location, file.filename, client_id)
        
        return {"message": "File uploaded. Processing started.", "status": "processing"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- KB Management Endpoints ---

@router.get("/kb/files")
def get_kb_files(page: int = 1, page_size: int = 10):
    kb_path = KB_DIR
    files = []
    total_files = 0
    if os.path.exists(kb_path):
        all_files = [f for f in os.listdir(kb_path) if os.path.isfile(os.path.join(kb_path, f))]
        # Sort files by modification time (newest first)
        all_files.sort(key=lambda x: os.path.getmtime(os.path.join(kb_path, x)), reverse=True)
        
        total_files = len(all_files)
        start = (page - 1) * page_size
        end = start + page_size
        files = all_files[start:end]
        
    return {
        "files": files,
        "total": total_files,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_files + page_size - 1) // page_size if page_size > 0 else 0
    }

@router.post("/kb/upload")
async def upload_kb_file(file: UploadFile = File(...)):
    kb_path = KB_DIR
    if not os.path.exists(kb_path):
        os.makedirs(kb_path)
    
    file_location = os.path.join(kb_path, file.filename)
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
    
    return {"filename": file.filename, "message": "File uploaded successfully"}

@router.delete("/kb/files/{filename}")
def delete_kb_file(filename: str):
    file_path = os.path.join(KB_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"message": "File deleted"}
    raise HTTPException(status_code=404, detail="File not found")

import csv

@router.get("/kb/files/{filename}")
def download_kb_file(filename: str):
    file_path = os.path.join(KB_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, filename=filename)
    raise HTTPException(status_code=404, detail="File not found")

@router.get("/kb/data/{filename}")
def get_kb_file_data(filename: str, limit: int = 50):
    file_path = os.path.join(KB_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    if not filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Currently only CSV files are supported for preview")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            # Use Sniffer to detect dialect
            sample = f.read(1024)
            f.seek(0)
            dialect = csv.Sniffer().sniff(sample)
            
            reader = csv.reader(f, dialect)
            header = next(reader, None)
            
            if not header:
                return {"columns": [], "rows": []}
                
            rows = []
            for i, row in enumerate(reader):
                if i >= limit:
                    break
                rows.append(row)
                
            return {"columns": header, "rows": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

