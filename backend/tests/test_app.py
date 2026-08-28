import pytest
from fastapi.testclient import TestClient
import sys, os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.main import app
from backend.app.models.database import init_db, SessionLocal
from backend.app.services.data_loader import load_data_if_needed

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()
    db = SessionLocal()
    load_data_if_needed(db, data_dir=".")
    db.close()

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Prototype Disclaimer" in data["disclaimer"]

def test_get_trains():
    response = client.get("/api/trains?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "trains" in data
    assert len(data["trains"]) > 0

def test_train_search():
    response = client.get("/api/trains?query=12627")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert data["trains"][0]["number"] == "12627"

def test_get_train_detail():
    response = client.get("/api/trains/12627")
    assert response.status_code == 200
    data = response.json()
    assert data["number"] == "12627"
    assert "name" in data

def test_get_train_prediction():
    response = client.get("/api/trains/12627/prediction")
    assert response.status_code == 200
    data = response.json()
    assert "ai_predicted_eta" in data
    assert "baseline_eta" in data
    assert "prediction_range" in data

def test_model_status():
    response = client.get("/api/model/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["LOADED", "FALLBACK"]

def test_simulation_event():
    response = client.post("/api/simulation/event", json={
        "train_number": "12627",
        "event_type": "SPEED_RESTRICTION"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["event_applied"] == "SPEED_RESTRICTION"
