import asyncio
import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Ensure backend package is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.models.database import init_db, get_db, SessionLocal
from backend.app.services.data_loader import load_data_if_needed
from backend.app.api.endpoints import router as api_router, sim_engine
from backend.app.websocket.manager import ws_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[RailETA Backend] Initializing database and data loading...")
    init_db()
    db = SessionLocal()
    try:
        load_data_if_needed(db, data_dir=".")
    finally:
        db.close()

    # Start background WebSocket telemetry broadcast task
    broadcast_task = asyncio.create_task(simulation_broadcast_loop())
    print("[RailETA Backend] Background simulation telemetry stream active.")

    yield

    broadcast_task.cancel()
    print("[RailETA Backend] Shutdown complete.")

async def simulation_broadcast_loop():
    while True:
        await asyncio.sleep(2.0) # Broadcast telemetry every 2 seconds
        try:
            db = SessionLocal()
            try:
                updated_statuses = sim_engine.update_simulation_step(db)
                if updated_statuses:
                    await ws_manager.broadcast({
                        "type": "TELEMETRY_UPDATE",
                        "timestamp": asyncio.get_event_loop().time(),
                        "data": updated_statuses
                    })
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Broadcast Loop Error]: {e}")

app = FastAPI(
    title="RailETA AI Backend",
    description="Dynamic Forecast of Expected Time of Arrival (ETA) for Indian Railways Coaching Trains",
    version="1.0.0",
    lifespan=lifespan
)

# The production container exposes UI and API from the same origin, so CORS
# is intentionally disabled by default. Set ALLOWED_ORIGINS only for a
# deliberately separate frontend, as a comma-separated allowlist.
allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") if origin.strip()]
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

# Include REST routes
app.include_router(api_router, prefix="/api")

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "RailETA AI Engine"}

@app.websocket("/ws/trains")
async def websocket_trains_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Receive client ping or commands if any
            data = await websocket.receive_text()
            print(f"[WebSocket Received]: {data}")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        ws_manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
