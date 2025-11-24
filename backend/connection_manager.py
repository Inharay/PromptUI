import asyncio
import json
from typing import Dict
from fastapi import Request

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, asyncio.Queue] = {}

    async def connect(self, client_id: str):
        self.active_connections[client_id] = asyncio.Queue()
        print(f"Client {client_id} connected (SSE)")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            print(f"Client {client_id} disconnected (SSE)")

    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].put(json.dumps(message))
        else:
            print(f"Client {client_id} not connected, dropping message")

    async def event_generator(self, client_id: str, request: Request):
        if client_id not in self.active_connections:
            await self.connect(client_id)
        
        queue = self.active_connections[client_id]
        
        try:
            while True:
                if await request.is_disconnected():
                    break
                
                # Wait for message
                data = await queue.get()
                yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            print(f"SSE stream cancelled for {client_id}")
        finally:
            self.disconnect(client_id)

manager = ConnectionManager()
