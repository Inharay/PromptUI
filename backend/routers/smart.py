from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Form
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
import shutil
import os
from ..smart_service import SmartService
from ..connection_manager import manager

router = APIRouter(prefix="/api/smart", tags=["smart"])
smart_service = SmartService()

KB_DIR = "uploads/knowledge_base"
os.makedirs(KB_DIR, exist_ok=True)

class ChatRequest(BaseModel):
    message: str

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        response = await run_in_threadpool(smart_service.chat, request.message)
        return {"response": response}
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
                "url": f"/outputs/{gen_file['name']}",
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

@router.post("/upload_kb")
async def upload_kb(file: UploadFile = File(...)):
    try:
        file_location = f"{KB_DIR}/{file.filename}"
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        
        return {"filename": file.filename, "message": "Knowledge base file uploaded successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
