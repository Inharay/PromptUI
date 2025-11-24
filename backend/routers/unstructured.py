from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
import shutil
import os
from ..unstructured_service import UnstructuredService
from ..connection_manager import manager

router = APIRouter(prefix="/api/unstructured", tags=["unstructured"])
unstructured_service = UnstructuredService()

UNSTRUCTURED_DIR = "uploads/unstructured_data"
os.makedirs(UNSTRUCTURED_DIR, exist_ok=True)

class ChatRequest(BaseModel):
    message: str

@router.post("/chat")
def chat_endpoint(request: ChatRequest):
    try:
        response = unstructured_service.chat(request.message)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def process_unstructured_file(file_location: str, filename: str, is_extraction: bool, client_id: str):
    try:
        if is_extraction:
             result = await run_in_threadpool(unstructured_service.extract_data_from_file, file_location)
        else:
             result = await run_in_threadpool(unstructured_service.analyze_file, file_location)
        
        response_data = {
            "type": "unstructured_upload_result",
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
        print(f"Error in process_unstructured_file: {e}")
        await manager.send_personal_message({
            "type": "error",
            "message": f"Error processing file {filename}: {str(e)}"
        }, client_id)

@router.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...), is_extraction: bool = Form(False), client_id: str = Form(...)):
    try:
        file_location = f"{UNSTRUCTURED_DIR}/{file.filename}"
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        
        background_tasks.add_task(process_unstructured_file, file_location, file.filename, is_extraction, client_id)
        
        return {"message": "File uploaded. Processing started.", "status": "processing"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload_data")
async def upload_data(file: UploadFile = File(...)):
    try:
        file_location = f"{UNSTRUCTURED_DIR}/{file.filename}"
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        
        return {"filename": file.filename, "message": "Unstructured data file uploaded successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
