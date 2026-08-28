from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import datetime
import json

from backend.app.models.database import (
    get_db, TrainModel, StationModel, ScheduleModel, LiveTrainStatusModel, AlertModel, IncidentModel, IncidentRecipientModel, OperationalEventModel
)
from backend.app.models.schemas import (
    TrainSchema, StationSchema, ScheduleSchema, LiveTrainStatusSchema,
    ETAPredictionResponse, AlertSchema, SimulationEventRequest,
    IncidentCreateSchema, IncidentResponseSchema,
    AssistantQueryRequest, AssistantQueryResponse,
    AssistantIncidentExtractRequest, AssistantIncidentExtractResponse,
    OperationalDelayRequest, OperationalDelayResponse
)
from backend.app.ml.predictor import ETAPredictionEngine
from backend.app.services.assistant_service import RailETAAssistantService
from backend.app.services.incident_service import RailETAIncidentService
from backend.app.websocket.manager import ws_manager
from simulator.train_simulator import SimulationEngine

router = APIRouter()

# Global Instances
predictor_engine = ETAPredictionEngine()
assistant_service = RailETAAssistantService()
incident_service = RailETAIncidentService()
sim_engine = SimulationEngine(predictor_engine)
sim_engine.start() # Autostart background loop


@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "RailETA AI Engine",
        "timestamp": datetime.datetime.now().isoformat(),
        "disclaimer": "Prototype Disclaimer: Demonstration uses railway data and simulated real-time telemetry. Production deployment requires authorized Indian Railways data sources and operational integration."
    }

@router.get("/trains")
def get_trains(
    query: Optional[str] = Query(None, description="Search by train number, train name, or station"),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    q = db.query(TrainModel)
    if query:
        search_pattern = f"%{query}%"
        q = q.filter(
            (TrainModel.number.like(search_pattern)) |
            (TrainModel.name.like(search_pattern)) |
            (TrainModel.from_station_name.like(search_pattern)) |
            (TrainModel.to_station_name.like(search_pattern)) |
            (TrainModel.from_station_code.like(search_pattern)) |
            (TrainModel.to_station_code.like(search_pattern))
        )
    total = q.count()
    trains = q.offset(offset).limit(limit).all()

    res = []
    for t in trains:
        # Fetch live status if exists
        status = db.query(LiveTrainStatusModel).filter(LiveTrainStatusModel.train_number == t.number).first()
        res.append({
            "number": t.number,
            "name": t.name,
            "type": t.type,
            "zone": t.zone,
            "from_station_code": t.from_station_code,
            "from_station_name": t.from_station_name,
            "to_station_code": t.to_station_code,
            "to_station_name": t.to_station_name,
            "departure": t.departure,
            "arrival": t.arrival,
            "duration_h": t.duration_h,
            "duration_m": t.duration_m,
            "distance": t.distance,
            "live_status": {
                "speed": status.speed if status else 65.0,
                "delay": status.delay if status else 0.0,
                "current_section": status.current_section if status else f"{t.from_station_code} - {t.to_station_code}",
                "status_label": status.status_label if status else "ON TIME",
                "destination_eta": status.destination_eta if status else t.arrival
            } if status else None
        })

    return {"total": total, "trains": res}

@router.get("/trains/{train_id}")
def get_train_by_id(train_id: str, db: Session = Depends(get_db)):
    t = db.query(TrainModel).filter(TrainModel.number == train_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Train not found")
    
    status = db.query(LiveTrainStatusModel).filter(LiveTrainStatusModel.train_number == train_id).first()
    
    return {
        "number": t.number,
        "name": t.name,
        "type": t.type,
        "zone": t.zone,
        "from_station_code": t.from_station_code,
        "from_station_name": t.from_station_name,
        "to_station_code": t.to_station_code,
        "to_station_name": t.to_station_name,
        "departure": t.departure,
        "arrival": t.arrival,
        "duration_h": t.duration_h,
        "duration_m": t.duration_m,
        "distance": t.distance,
        "classes": t.classes,
        "live_status": {
            "latitude": status.latitude if status else 20.5,
            "longitude": status.longitude if status else 77.5,
            "speed": status.speed if status else 70.0,
            "delay": status.delay if status else 10.0,
            "current_section": status.current_section if status else f"{t.from_station_code} - {t.to_station_code}",
            "next_station_code": status.next_station_code if status else t.to_station_code,
            "next_station_name": status.next_station_name if status else t.to_station_name,
            "destination_eta": status.destination_eta if status else t.arrival,
            "prediction_method": status.prediction_method if status else "XGBOOST",
            "confidence": status.confidence if status else 87.0,
            "status_label": status.status_label if status else "SLIGHT DELAY",
            "last_updated": status.last_updated if status else "Just now"
        } if status else None
    }

@router.get("/trains/{train_id}/stations")
def get_train_stations(train_id: str, db: Session = Depends(get_db)):
    schedules = db.query(ScheduleModel).filter(ScheduleModel.train_number == train_id).order_by(ScheduleModel.sequence).all()
    if not schedules:
        raise HTTPException(status_code=404, detail="Schedules not found for train")

    status = db.query(LiveTrainStatusModel).filter(LiveTrainStatusModel.train_number == train_id).first()
    curr_delay = status.delay if status else 12.0

    res = []
    for idx, sch in enumerate(schedules):
        st = db.query(StationModel).filter(StationModel.code == sch.station_code).first()

        # Compute Baseline & AI ETA
        sch_arr = sch.arrival if (sch.arrival and sch.arrival != "None") else sch.departure
        baseline_eta = predictor_engine._add_minutes_to_time(sch_arr, curr_delay)
        ai_eta = predictor_engine._add_minutes_to_time(sch_arr, curr_delay * 1.1)

        # Timeline state
        st_state = "UPCOMING"
        if idx == 0:
            st_state = "PASSED"
        elif status and status.next_station_code == sch.station_code:
            st_state = "CURRENT"
        elif idx == len(schedules) - 1:
            st_state = "DESTINATION"
        elif idx < 2:
            st_state = "PASSED"

        res.append({
            "sequence": sch.sequence,
            "station_code": sch.station_code,
            "station_name": sch.station_name,
            "state": sch.state if hasattr(sch, 'state') else st.state if st else "",
            "latitude": st.latitude if st else 0.0,
            "longitude": st.longitude if st else 0.0,
            "scheduled_arrival": sch.arrival,
            "scheduled_departure": sch.departure,
            "day": sch.day,
            "distance_km": sch.distance_km,
            "baseline_eta": baseline_eta,
            "ai_predicted_eta": ai_eta,
            "predicted_delay": curr_delay,
            "confidence": 87.0 if st_state == "CURRENT" else 84.0,
            "timeline_status": st_state
        })

    return res

@router.get("/trains/{train_id}/route")
def get_train_route_coordinates(train_id: str, db: Session = Depends(get_db)):
    t = db.query(TrainModel).filter(TrainModel.number == train_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Train not found")

    coords = []
    if t.geometry_json:
        try:
            coords = json.loads(t.geometry_json) # [[lng, lat], ...]
            # Format as [[lat, lng], ...] for Leaflet
            coords = [[c[1], c[0]] for c in coords if len(c) >= 2]
        except Exception:
            pass

    if not coords:
        # Fallback to schedule stations coordinates
        schedules = db.query(ScheduleModel).filter(ScheduleModel.train_number == train_id).order_by(ScheduleModel.sequence).all()
        for sch in schedules:
            st = db.query(StationModel).filter(StationModel.code == sch.station_code).first()
            if st and st.latitude != 0:
                coords.append([st.latitude, st.longitude])

    return {"train_number": train_id, "coordinates": coords}

@router.get("/trains/{train_id}/prediction")
def get_train_prediction(train_id: str, db: Session = Depends(get_db)):
    status = db.query(LiveTrainStatusModel).filter(LiveTrainStatusModel.train_number == train_id).first()
    if not status:
        raise HTTPException(status_code=404, detail="Live status not found for train")

    sch = db.query(ScheduleModel).filter(
        ScheduleModel.train_number == train_id,
        ScheduleModel.station_code == status.next_station_code
    ).first()

    sch_time = sch.arrival if (sch and sch.arrival and sch.arrival != "None") else "18:30:00"
    evt = sim_engine.active_events.get(train_id, {}).get("event_type", "NORMAL")
    feature_dict = sim_engine._build_feature_vector(status, evt)

    pred = predictor_engine.predict_eta(sch_time, feature_dict)

    return {
        "train_number": train_id,
        "train_name": status.train_name,
        "next_station_code": status.next_station_code,
        "next_station_name": status.next_station_name,
        "scheduled_arrival": sch_time,
        "baseline_eta": pred["baseline_eta"],
        "baseline_delay": pred["baseline_delay"],
        "ai_predicted_eta": pred["ai_predicted_eta"],
        "ai_predicted_delay": pred["ai_predicted_delay"],
        "prediction_range": pred["prediction_range"],
        "confidence_percentage": pred["confidence_percentage"],
        "lower_bound_minutes": pred["lower_bound_minutes"],
        "upper_bound_minutes": pred["upper_bound_minutes"],
        "prediction_method": pred["prediction_method"],
        "explanations": pred["explanations"]
    }

@router.get("/trains/{train_id}/explanation")
def get_train_explanation(train_id: str, db: Session = Depends(get_db)):
    pred = get_train_prediction(train_id, db)
    return {
        "train_number": train_id,
        "prediction_method": pred["prediction_method"],
        "ai_predicted_delay": pred["ai_predicted_delay"],
        "explanations": pred["explanations"]
    }

@router.get("/network/status")
def get_network_status(db: Session = Depends(get_db)):
    total_trains = db.query(TrainModel).count()
    active_statuses = db.query(LiveTrainStatusModel).all()
    
    delayed_count = sum(1 for s in active_statuses if s.delay > 15)
    ontime_count = len(active_statuses) - delayed_count
    avg_delay = round(sum(s.delay for s in active_statuses) / max(1, len(active_statuses)), 1)
    critical_alerts = db.query(AlertModel).filter(AlertModel.severity == "CRITICAL").count()

    return {
        "active_trains_count": len(active_statuses),
        "total_trains_network": total_trains,
        "delayed_trains": delayed_count,
        "ontime_trains": ontime_count,
        "average_network_delay_min": avg_delay,
        "critical_alerts_count": critical_alerts,
        "system_status": "OPERATIONAL"
    }

@router.get("/alerts")
def get_alerts(limit: int = 20, db: Session = Depends(get_db)):
    alerts = db.query(AlertModel).order_by(AlertModel.id.desc()).limit(limit).all()
    return [
        {
            "id": a.id,
            "train_number": a.train_number,
            "train_name": a.train_name,
            "severity": a.severity,
            "alert_type": a.alert_type,
            "message": a.message,
            "timestamp": a.timestamp
        }
        for a in alerts
    ]

@router.get("/model/status")
def get_model_status():
    return {
        "status": "LOADED" if predictor_engine.model else "FALLBACK",
        "engine": "XGBoost Regressor + SHAP TreeExplainer",
        "metadata": predictor_engine.metadata
    }

@router.get("/model/metrics")
def get_model_metrics():
    return predictor_engine.metadata

@router.post("/simulation/start")
def start_simulation():
    sim_engine.start()
    return {"status": "started", "running": True}

@router.post("/simulation/pause")
def pause_simulation():
    sim_engine.pause()
    return {"status": "paused", "running": False}

@router.post("/simulation/reset")
def reset_simulation(db: Session = Depends(get_db)):
    sim_engine.reset(db)
    return {"status": "reset", "running": sim_engine.running}

@router.post("/trains/{train_id}/operational-delay", response_model=OperationalDelayResponse)
def log_operational_delay(
    train_id: str,
    req: OperationalDelayRequest,
    db: Session = Depends(get_db)
):
    import random
    # 1. Find live train status by train_number or ID
    status = db.query(LiveTrainStatusModel).filter(
        LiveTrainStatusModel.train_number == train_id
    ).first()

    if not status and train_id.isdigit():
        train_obj = db.query(TrainModel).filter(TrainModel.id == int(train_id)).first()
        if train_obj:
            status = db.query(LiveTrainStatusModel).filter(LiveTrainStatusModel.train_number == train_obj.number).first()

    if not status:
        train_obj = db.query(TrainModel).filter(TrainModel.number == train_id).first()
        if train_obj:
            status = db.query(LiveTrainStatusModel).filter(LiveTrainStatusModel.train_number == train_obj.number).first()

    if not status:
        raise HTTPException(status_code=404, detail=f"Train '{train_id}' not found in live tracking")

    train_number = status.train_number

    # 2. Validate reason
    if not req.reason or not req.reason.strip():
        raise HTTPException(status_code=400, detail="Operational disruption reason is required")

    category = (req.category or "TRAIN_DELAY").upper()
    added_delay = float(req.delay_minutes)
    previous_delay = float(status.delay or 0.0)
    previous_eta = status.destination_eta or "14:25:00"

    # 3. Calculate new total delay: NEW CURRENT DELAY = PREVIOUS CURRENT DELAY + EMPLOYEE ENTERED DELAY
    new_delay = max(0.0, round(previous_delay + added_delay, 1))
    status.delay = new_delay
    status.last_updated = datetime.datetime.now().strftime("%H:%M:%S")

    # Determine status label
    if new_delay <= 5.0:
        status.status_label = "ON TIME"
    elif new_delay <= 15.0:
        status.status_label = "SLIGHT DELAY"
    elif new_delay <= 30.0:
        status.status_label = "DELAYED"
    else:
        status.status_label = "CRITICAL DELAY"

    # 4. Store Operational Event in DB
    event_id = f"EVT-2026-{random.randint(1000, 9999)}"
    op_event = OperationalEventModel(
        event_id=event_id,
        train_number=train_number,
        train_name=status.train_name,
        category=category,
        delay_minutes=added_delay,
        previous_delay=previous_delay,
        current_delay=new_delay,
        reason=req.reason.strip(),
        timestamp=datetime.datetime.now().strftime("%H:%M:%S"),
        current_section=status.current_section or "",
        next_station=status.next_station_name or "",
        source="EMPLOYEE_DESK",
        status="ACTIVE"
    )
    db.add(op_event)

    # Store event in sim_engine active_events
    sim_engine.active_events[train_number] = {
        "event_type": category,
        "applied_at": datetime.datetime.now().strftime("%H:%M:%S"),
        "reason": req.reason.strip()
    }

    # 5. Threshold-based Alert Generation
    if new_delay >= 60.0:
        severity = "CRITICAL"
        alert_msg = f"Critical delay (+{int(new_delay)}m) — operational intervention recommended. ({req.reason.strip()})"
    elif new_delay >= 30.0:
        severity = "WARNING"
        alert_msg = f"Significant delay (+{int(new_delay)}m) — control room attention required. ({req.reason.strip()})"
    else:
        severity = "INFO" if added_delay <= 0 else "WARNING"
        sign = "+" if added_delay >= 0 else ""
        alert_msg = f"Operational delay detected ({sign}{int(added_delay)}m): {req.reason.strip()}"

    alert = AlertModel(
        train_number=train_number,
        train_name=status.train_name,
        severity=severity,
        alert_type=category,
        message=alert_msg,
        timestamp=datetime.datetime.now().strftime("%H:%M:%S")
    )
    db.add(alert)

    # 6. Run Prediction Engine for updated Destination ETA & Explainability
    feature_dict = sim_engine._build_feature_vector(status, category)
    feature_dict["current_delay"] = new_delay
    feature_dict["operational_event_delay"] = added_delay

    dest_sch = db.query(ScheduleModel).filter(
        ScheduleModel.train_number == train_number
    ).order_by(ScheduleModel.sequence.desc()).first()
    train_obj = db.query(TrainModel).filter(TrainModel.number == train_number).first()

    sch_time = "18:00:00"
    if dest_sch and dest_sch.arrival and dest_sch.arrival not in ["None", ""]:
        sch_time = dest_sch.arrival
    elif train_obj and train_obj.arrival and train_obj.arrival not in ["None", ""]:
        sch_time = train_obj.arrival

    pred_res = predictor_engine.predict_eta(sch_time, feature_dict)

    status.destination_eta = pred_res["ai_predicted_eta"]
    status.prediction_method = pred_res["prediction_method"]
    status.confidence = pred_res["confidence_percentage"]
    status.lower_bound_delay = pred_res["lower_bound_minutes"]
    status.upper_bound_delay = pred_res["upper_bound_minutes"]
    status.last_updated = datetime.datetime.now().strftime("%H:%M:%S")

    db.commit()
    db.refresh(status)

    # 7. WebSocket Broadcast TRAIN_STATE_UPDATED & ETA_UPDATED
    broadcast_data = {
        "type": "TRAIN_STATE_UPDATED",
        "event_type": "TRAIN_STATE_UPDATED",
        "train_id": train_number,
        "train_number": train_number,
        "train_name": status.train_name,
        "previous_delay": previous_delay,
        "added_delay": added_delay,
        "current_delay": status.delay,
        "previous_eta": previous_eta,
        "destination_eta": status.destination_eta,
        "new_eta": status.destination_eta,
        "next_station": status.next_station_name,
        "next_station_code": status.next_station_code,
        "current_speed": status.speed,
        "latitude": status.latitude,
        "longitude": status.longitude,
        "prediction_method": status.prediction_method,
        "confidence": status.confidence,
        "status_label": status.status_label,
        "active_events": sim_engine.active_events.get(train_number, {}),
        "updated_at": status.last_updated,
        "reason": req.reason.strip()
    }

    import asyncio
    try:
        asyncio.run(ws_manager.broadcast(broadcast_data))
    except Exception as e:
        print(f"[WebSocket Broadcast Note]: {e}")

    return {
        "success": True,
        "train_id": train_number,
        "previous_delay": previous_delay,
        "added_delay": added_delay,
        "current_delay": status.delay,
        "previous_eta": previous_eta,
        "new_eta": status.destination_eta,
        "prediction_method": status.prediction_method,
        "confidence": status.confidence,
        "event_id": event_id
    }

@router.post("/simulation/event")
def trigger_simulation_event(req: SimulationEventRequest, db: Session = Depends(get_db)):
    val = req.value
    if val is None:
        evt = req.event_type.upper()
        if evt == "SPEED_RESTRICTION": val = 10.0
        elif evt == "CONGESTION": val = 15.0
        elif evt == "UNSCHEDULED_STOP": val = 25.0
        elif evt == "DELAY_RECOVERY": val = -8.0
        else: val = 15.0

    reason_str = req.reason or f"Simulated disruption event ({req.event_type})"
    op_req = OperationalDelayRequest(category=req.event_type, delay_minutes=val, reason=reason_str)
    res = log_operational_delay(train_id=req.train_number, req=op_req, db=db)

    return {
        "status": "success",
        "event_applied": req.event_type,
        "train_number": req.train_number,
        "current_delay": res["current_delay"],
        "current_speed": 75.0,
        "status_label": "DELAYED" if res["current_delay"] > 5 else "ON TIME",
        "destination_eta": res["new_eta"],
        "previous_delay": res["previous_delay"],
        "added_delay": res["added_delay"]
    }

# ============================================================
# RAILeta AI ASSISTANT ENDPOINTS
# ============================================================

@router.post("/assistant/query", response_model=AssistantQueryResponse)
def query_assistant(req: AssistantQueryRequest, db: Session = Depends(get_db)):
    res = assistant_service.process_query(
        db=db,
        message=req.message,
        language=req.language or "en",
        context_train_id=req.train_id
    )
    return res

@router.post("/assistant/incident-extract", response_model=AssistantIncidentExtractResponse)
def extract_incident_info(req: AssistantIncidentExtractRequest):
    extracted = assistant_service.extract_incident_info(req.message)
    extracted["train_id"] = req.train_id
    return extracted

# ============================================================
# ON-TRAIN INCIDENT REPORTING & ESCALATION ENDPOINTS
# ============================================================

@router.post("/incidents", response_model=IncidentResponseSchema)
async def create_incident(payload: IncidentCreateSchema, db: Session = Depends(get_db)):
    incident = incident_service.create_incident(db, payload)
    
    recipients = db.query(IncidentRecipientModel).filter(IncidentRecipientModel.incident_id == incident.incident_id).all()
    
    res = {
        "id": incident.id,
        "incident_id": incident.incident_id,
        "train_number": incident.train_number,
        "train_name": incident.train_name,
        "coach_number": incident.coach_number,
        "seat_number": incident.seat_number,
        "incident_type": incident.incident_type,
        "description": incident.description,
        "severity": incident.severity,
        "latitude": incident.latitude,
        "longitude": incident.longitude,
        "current_section": incident.current_section,
        "current_station": incident.current_station,
        "next_station_code": incident.next_station_code,
        "next_station_name": incident.next_station_name,
        "next_station_eta": incident.next_station_eta,
        "reported_at": incident.reported_at,
        "status": incident.status,
        "source": incident.source,
        "language": incident.language,
        "created_at": incident.created_at,
        "recipients": [
            {
                "id": r.id,
                "incident_id": r.incident_id,
                "recipient_type": r.recipient_type,
                "recipient_name": r.recipient_name,
                "delivery_status": r.delivery_status,
                "sent_at": r.sent_at,
                "acknowledged_at": r.acknowledged_at
            }
            for r in recipients
        ]
    }

    # Broadcast via WebSocket to Control Room
    try:
        await ws_manager.broadcast({
            "type": "INCIDENT_CREATED",
            "incident": res
        })
    except Exception as e:
        print(f"[WebSocket Broadcast Error]: {e}")

    return res

@router.get("/incidents")
def get_incidents(
    train_number: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    incidents = incident_service.get_incidents(db, train_number, status)
    result = []
    for inc in incidents:
        recipients = db.query(IncidentRecipientModel).filter(IncidentRecipientModel.incident_id == inc.incident_id).all()
        result.append({
            "id": inc.id,
            "incident_id": inc.incident_id,
            "train_number": inc.train_number,
            "train_name": inc.train_name,
            "coach_number": inc.coach_number,
            "seat_number": inc.seat_number,
            "incident_type": inc.incident_type,
            "description": inc.description,
            "severity": inc.severity,
            "latitude": inc.latitude,
            "longitude": inc.longitude,
            "current_section": inc.current_section,
            "current_station": inc.current_station,
            "next_station_code": inc.next_station_code,
            "next_station_name": inc.next_station_name,
            "next_station_eta": inc.next_station_eta,
            "reported_at": inc.reported_at,
            "status": inc.status,
            "source": inc.source,
            "language": inc.language,
            "created_at": inc.created_at,
            "recipients": [
                {
                    "id": r.id,
                    "incident_id": r.incident_id,
                    "recipient_type": r.recipient_type,
                    "recipient_name": r.recipient_name,
                    "delivery_status": r.delivery_status,
                    "sent_at": r.sent_at,
                    "acknowledged_at": r.acknowledged_at
                }
                for r in recipients
            ]
        })
    return result

@router.post("/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(incident_id: str, db: Session = Depends(get_db)):
    incident = incident_service.update_incident_status(db, incident_id, "ACKNOWLEDGED")
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    try:
        await ws_manager.broadcast({
            "type": "INCIDENT_ACKNOWLEDGED",
            "incident_id": incident_id,
            "status": "ACKNOWLEDGED"
        })
    except Exception:
        pass

    return {"status": "ACKNOWLEDGED", "incident_id": incident_id}

@router.post("/incidents/{incident_id}/escalate")
async def escalate_incident(incident_id: str, db: Session = Depends(get_db)):
    incident = incident_service.update_incident_status(db, incident_id, "ESCALATED")
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    try:
        await ws_manager.broadcast({
            "type": "INCIDENT_ESCALATED",
            "incident_id": incident_id,
            "status": "ESCALATED"
        })
    except Exception:
        pass

    return {"status": "ESCALATED", "incident_id": incident_id}

@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str, db: Session = Depends(get_db)):
    incident = incident_service.update_incident_status(db, incident_id, "RESOLVED")
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    try:
        await ws_manager.broadcast({
            "type": "INCIDENT_RESOLVED",
            "incident_id": incident_id,
            "status": "RESOLVED"
        })
    except Exception:
        pass

    return {"status": "RESOLVED", "incident_id": incident_id}

