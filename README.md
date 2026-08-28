# 🚆 RailETA AI - Smart Railway Tracking & Delay Prediction System

RailETA AI is an intelligent railway tracking, delay prediction, and control room management platform designed to optimize train operations and provide real-time updates to passengers and controllers.

---

## 🔗 Quick Access (Localhost Links)

Once the application services are running, access the portals using the following links:

| Portal / Service | Localhost URL | Description |
| :--- | :--- | :--- |
| 🪟 **Portal Selector Landing Page** | [http://localhost:3000](http://localhost:3000) | Main Access Portal Selection Landing Page |
| 🧑‍🤝‍🧑 **Passenger Portal** | [http://localhost:3000/passenger](http://localhost:3000/passenger) | Live Train Tracking & Real-Time ETA Search for Passengers |
| 👨‍✈️ **Employee & Official Portal** | [http://localhost:3000/employee](http://localhost:3000/employee) | Unified Command Hub for Controllers & Section Managers |
| 🛠️ **Control Room** | [http://localhost:3000/control-room](http://localhost:3000/control-room) | Real-Time Operational Dashboard & Section Monitoring |
| 📊 **Analytics Dashboard** | [http://localhost:3000/analytics](http://localhost:3000/analytics) | Historical Delay Analytics & Network Bottleneck Metrics |
| 🎮 **Simulation Console** | [http://localhost:3000/simulation](http://localhost:3000/simulation) | Interactive Signal Holds & Telemetry Simulation Engine |
| ⚡ **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI REST API & WebSocket Server |
| 📑 **Interactive API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger UI API Documentation & Testing Interface |

---

## ⚙️ Quick Start Guide

### Prerequisites
- **Node.js**: v18+ and `npm`
- **Python**: v3.10+

### Option 1: Run Everything Together (Recommended)

Run the root launcher script to start both the FastAPI backend and Next.js frontend concurrently:

```bash
python start_all.py
```

---

### Option 2: Run Frontend & Backend Separately

#### 1. Backend Setup (FastAPI)
```bash
# Install Python dependencies if needed
pip install -r backend/requirements.txt

# Launch FastAPI server on port 8000
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Backend runs at:* **`http://localhost:8000`** | *Docs at:* **`http://localhost:8000/docs`**

#### 2. Frontend Setup (Next.js)
```bash
cd frontend

# Install node dependencies
npm install

# Start Next.js development server on port 3000
npm run dev
```
*Frontend runs at:* **`http://localhost:3000`**

---

## 🏗️ Project Architecture

```
sih sample 2/
├── backend/            # FastAPI Python backend (REST & WebSockets)
├── frontend/           # Next.js 16 (React 19 + TailwindCSS + Lucide Icons)
│   └── app/            # App Router pages (passenger, control-room, analytics, simulation)
├── simulator/          # Real-time train telemetry simulator engine
├── raileta.db          # SQLite database containing train & station records
├── start_all.py        # Automated launcher script for Backend & Frontend
└── README.md           # Documentation & Quick Start guide
```
