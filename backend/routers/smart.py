from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import shutil
import os
from smart_service import SmartService

router = APIRouter(prefix="/api/smart", tags=["smart"])
smart_service = SmartService()

KB_DIR = "uploads/knowledge_base"
os.makedirs(KB_DIR, exist_ok=True)

class ChatRequest(BaseModel):
    message: str

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        response = smart_service.chat(request.message)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_location = f"{KB_DIR}/{file.filename}"
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        
        result = smart_service.analyze_file(file_location)
        
        response_data = {
            "filename": file.filename,
            "message": result["message"],
        }

        if "generated_file" in result:
            gen_file = result["generated_file"]
            response_data["result_file"] = {
                "name": gen_file["name"],
                "url": f"http://localhost:8000/outputs/{gen_file['name']}",
                "size": gen_file["size"]
            }

        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
