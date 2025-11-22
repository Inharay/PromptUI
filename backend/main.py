from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import shutil
import os
from llm_service import LLMService

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Mount outputs directory to serve generated files
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# Serve Frontend
@app.get("/")
async def read_root():
    # Assuming running from backend directory
    if os.path.exists("../index.html"):
        return FileResponse("../index.html")
    return {"error": "Frontend not found"}

@app.get("/script.js")
async def read_script():
    if os.path.exists("../script.js"):
        return FileResponse("../script.js")
    return {"error": "Script not found"}

# Initialize LLM Service
llm_service = LLMService()

class ChatRequest(BaseModel):
    message: str
    mode: str

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        response = llm_service.chat(request.message, request.mode)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), mode: str = Form(...)):
    try:
        file_location = f"{UPLOAD_DIR}/{file.filename}"
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        
        # Trigger analysis
        result = llm_service.analyze_file(file.filename, mode)
        
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
