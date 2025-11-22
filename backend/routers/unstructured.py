from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
import shutil
import os
from unstructured_service import UnstructuredService

router = APIRouter(prefix="/api/unstructured", tags=["unstructured"])
unstructured_service = UnstructuredService()

UNSTRUCTURED_DIR = "uploads/unstructured_data"
os.makedirs(UNSTRUCTURED_DIR, exist_ok=True)

class ChatRequest(BaseModel):
    message: str

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        response = unstructured_service.chat(request.message)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), is_extraction: bool = Form(False)):
    try:
        file_location = f"{UNSTRUCTURED_DIR}/{file.filename}"
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        
        if is_extraction:
             result = unstructured_service.extract_data_from_file(file_location)
        else:
             result = unstructured_service.analyze_file(file_location)
        
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

@router.post("/upload_data")
async def upload_data(file: UploadFile = File(...)):
    try:
        file_location = f"{UNSTRUCTURED_DIR}/{file.filename}"
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        
        return {"filename": file.filename, "message": "Unstructured data file uploaded successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
