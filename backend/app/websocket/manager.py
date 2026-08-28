import asyncio
import json
from typing import List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[WebSocket] Client connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[WebSocket] Client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        
        payload = json.dumps(message)
        disconnected_clients = []
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception as e:
                disconnected_clients.append(connection)

        for conn in disconnected_clients:
            self.disconnect(conn)

ws_manager = ConnectionManager()
