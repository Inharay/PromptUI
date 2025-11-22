from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os
from routers import smart, unstructured

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
OUTPUT_DIR = "outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Mount outputs directory to serve generated files
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# Include Routers
app.include_router(smart.router)
app.include_router(unstructured.router)

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
