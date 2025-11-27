from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import os
from .routers import smart, unstructured
from .connection_manager import manager
from .config import OUTPUT_DIR

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SSE Endpoint
@app.get("/events/{client_id}")
async def sse_endpoint(request: Request, client_id: str):
    return StreamingResponse(manager.event_generator(client_id, request), media_type="text/event-stream")

# Mount outputs directory to serve generated files
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# Mount static directory for frontend assets
base_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(base_dir, "../static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include Routers
app.include_router(smart.router)
app.include_router(unstructured.router)

# Serve Frontend
@app.get("/")
async def read_root():
    index_path = os.path.join(base_dir, "../index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": f"Frontend not found at {index_path}"}

@app.get("/script.js")
async def read_script():
    script_path = os.path.join(base_dir, "../script.js")
    if os.path.exists(script_path):
        return FileResponse(script_path)
    return {"error": "Script not found"}

@app.get("/kb_manager.html")
async def read_kb_manager():
    page_path = os.path.join(base_dir, "../kb_manager.html")
    if os.path.exists(page_path):
        return FileResponse(page_path)
    return {"error": "Page not found"}

@app.get("/kb_manager.js")
async def read_kb_manager_js():
    script_path = os.path.join(base_dir, "../kb_manager.js")
    if os.path.exists(script_path):
        return FileResponse(script_path)
    return {"error": "Script not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
