import time
import json
import asyncio
import datetime
import random
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.models.database import (
    SessionLocal, TrainModel, StationModel, ScheduleModel, LiveTrainStatusModel, AlertModel
)
from backend.app.ml.predictor import ETAPredictionEngine

class SimulationEngine:
    def __init__(self, predictor_engine: ETAPredictionEngine):
        self.predictor = predictor_engine
        self.running = False
        self.active_events: Dict[str, Dict[str, Any]] = {}  # train_number -> event info
        self.train_progress: Dict[str, float] = {}  # train_number -> float progress between 0 and 1 along route
        self.train_route_coords: Dict[str, List[List[float]]] = {} # train_number -> [[lat, lng], ...]

    def start(self):
        self.running = True

    def pause(self):
        self.running = False

    def reset(self, db: Session):
        self.active_events.clear()
        self.train_progress.clear()
        # Reset live train status in DB
        statuses = db.query(LiveTrainStatusModel).all()
        for st in statuses:
            st.delay = 0.0
            st.speed = 85.0
            st.prediction_method = "XGBOOST"
            st.status_label = "ON TIME"
            train_obj = db.query(TrainModel).filter(TrainModel.number == st.train_number).first()
            if train_obj and train_obj.arrival:
                st.destination_eta = train_obj.arrival
            st.last_updated = datetime.datetime.now().strftime("%H:%M:%S")
        db.commit()

    def apply_event(
        self,
        train_number: str,
        event_type: str,
        value: Optional[float] = None,
        db: Session = None,
        custom_reason: Optional[str] = None
    ) -> Optional[LiveTrainStatusModel]:
        """
        Inject an operational disruption event or employee-logged delay into a specific train.
        """
        if db is None:
            db = SessionLocal()

        status = db.query(LiveTrainStatusModel).filter(LiveTrainStatusModel.train_number == train_number).first()
        if not status:
            return None

        event_name = event_type.upper()
        self.active_events[train_number] = {
            "event_type": event_name,
            "applied_at": datetime.datetime.now().strftime("%H:%M:%S"),
            "reason": custom_reason or ""
        }

        # Determine delay impact & target speed
        delay_delta = value if value is not None else 0.0
        speed_target = 75.0
        alert_severity = "WARNING"

        if value is None:
            if event_name == "SPEED_RESTRICTION":
                delay_delta = random.uniform(5.0, 15.0)
                speed_target = 30.0
                alert_severity = "WARNING"
            elif event_name == "CONGESTION":
                delay_delta = random.uniform(8.0, 25.0)
                speed_target = 25.0
                alert_severity = "WARNING"
            elif event_name == "HEAVY_RAIN":
                delay_delta = random.uniform(10.0, 30.0)
                speed_target = 40.0
                alert_severity = "WARNING"
            elif event_name == "SIGNAL_DELAY":
                delay_delta = random.uniform(6.0, 15.0)
                speed_target = 15.0
                alert_severity = "WARNING"
            elif event_name == "EXTENDED_HALT":
                delay_delta = random.uniform(4.0, 10.0)
                speed_target = 0.0
                alert_severity = "INFO"
            elif event_name == "UNSCHEDULED_STOP":
                delay_delta = random.uniform(12.0, 40.0)
                speed_target = 0.0
                alert_severity = "CRITICAL"
            elif event_name == "DELAY_RECOVERY":
                delay_delta = -random.uniform(4.0, 10.0)
                speed_target = 105.0
                alert_severity = "INFO"
            elif event_name == "NORMAL":
                delay_delta = 0.0
                speed_target = 85.0
                alert_severity = "INFO"
        else:
            if delay_delta <= -1:
                speed_target = 100.0
                alert_severity = "INFO"
            elif delay_delta >= 20:
                alert_severity = "CRITICAL"
            elif delay_delta > 0:
                alert_severity = "WARNING"

        # Construct alert message using employee's exact reason
        if custom_reason and custom_reason.strip():
            sign = "+" if delay_delta >= 0 else ""
            alert_msg = f"TRAIN DELAY ({status.train_name} #{train_number}): {custom_reason.strip()} ({sign}{int(round(delay_delta))}m)"
        else:
            if event_name in ["TRAIN_DELAY", "CUSTOM_DELAY"]:
                sign = "+" if delay_delta >= 0 else ""
                alert_msg = f"TRAIN DELAY ({status.train_name} #{train_number}): Operational delay logged ({sign}{int(round(delay_delta))}m)."
            elif event_name == "SPEED_RESTRICTION":
                alert_msg = f"SPEED RESTRICTION ({status.train_name} #{train_number}): Speed restricted to 30 km/h."
            elif event_name == "CONGESTION":
                alert_msg = f"TRACK CONGESTION ({status.train_name} #{train_number}): Experiencing heavy track congestion."
            elif event_name == "UNSCHEDULED_STOP":
                alert_msg = f"CRITICAL STOP ({status.train_name} #{train_number}): Unscheduled stop detected."
            elif event_name == "DELAY_RECOVERY":
                alert_msg = f"DELAY RECOVERY ({status.train_name} #{train_number}): Recovering delay on high-speed priority clearance."
            else:
                sign = "+" if delay_delta >= 0 else ""
                alert_msg = f"TRAIN DELAY ({status.train_name} #{train_number}): Operational adjustment ({sign}{int(round(delay_delta))}m)."

        # Update train status fields
        new_delay = max(0.0, status.delay + delay_delta)
        status.delay = round(new_delay, 1)
        status.speed = round(speed_target, 1)
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

        # Calculate updated AI ETA prediction for final destination
        feature_dict = self._build_feature_vector(status, event_name)

        dest_sch = db.query(ScheduleModel).filter(
            ScheduleModel.train_number == train_number
        ).order_by(ScheduleModel.sequence.desc()).first()

        train_obj = db.query(TrainModel).filter(TrainModel.number == train_number).first()

        sch_time = "18:00:00"
        if dest_sch and dest_sch.arrival and dest_sch.arrival not in ["None", ""]:
            sch_time = dest_sch.arrival
        elif train_obj and train_obj.arrival and train_obj.arrival not in ["None", ""]:
            sch_time = train_obj.arrival

        prediction_result = self.predictor.predict_eta(sch_time, feature_dict)

        status.destination_eta = prediction_result["ai_predicted_eta"]
        status.prediction_method = prediction_result["prediction_method"]
        status.confidence = prediction_result["confidence_percentage"]
        status.lower_bound_delay = prediction_result["lower_bound_minutes"]
        status.upper_bound_delay = prediction_result["upper_bound_minutes"]

        # Create Alert if applicable
        if alert_msg:
            alert = AlertModel(
                train_number=train_number,
                train_name=status.train_name,
                severity=alert_severity,
                alert_type=event_name,
                message=alert_msg,
                timestamp=datetime.datetime.now().strftime("%H:%M:%S")
            )
            db.add(alert)

        db.commit()
        return status

    def update_simulation_step(self, db: Session) -> List[Dict[str, Any]]:
        if not self.running:
            return []

        updated_statuses = []
        statuses = db.query(LiveTrainStatusModel).all()

        for status in statuses:
            train_num = status.train_number
            evt = self.active_events.get(train_num, {}).get("event_type", "NORMAL")

            # Interpolate coordinates along route
            train = db.query(TrainModel).filter(TrainModel.number == train_num).first()
            if train and train.geometry_json:
                try:
                    coords = json.loads(train.geometry_json) # [[lng, lat], ...]
                    if len(coords) >= 2:
                        prog = self.train_progress.get(train_num, 0.1)
                        # Advance progress based on current speed
                        speed_factor = (status.speed / 100.0) * 0.005
                        prog = (prog + speed_factor) % 1.0
                        self.train_progress[train_num] = prog

                        # Calculate interpolated lat, lng
                        idx_float = prog * (len(coords) - 1)
                        idx1 = int(idx_float)
                        idx2 = min(idx1 + 1, len(coords) - 1)
                        t = idx_float - idx1

                        lng1, lat1 = coords[idx1]
                        lng2, lat2 = coords[idx2]

                        status.latitude = round(lat1 + t * (lat2 - lat1), 6)
                        status.longitude = round(lng1 + t * (lng2 - lng1), 6)
                except Exception as e:
                    pass

            # Random slight fluctuation in speed
            if evt == "NORMAL":
                status.speed = round(max(50.0, min(110.0, status.speed + random.uniform(-2, 2))), 1)

            status.last_updated = datetime.datetime.now().strftime("%H:%M:%S")
            
            # Recalculate ETA for destination
            feature_dict = self._build_feature_vector(status, evt)
            dest_sch = db.query(ScheduleModel).filter(
                ScheduleModel.train_number == train_num
            ).order_by(ScheduleModel.sequence.desc()).first()

            sch_time = "18:30:00"
            if dest_sch and dest_sch.arrival and dest_sch.arrival not in ["None", ""]:
                sch_time = dest_sch.arrival
            elif train and train.arrival and train.arrival not in ["None", ""]:
                sch_time = train.arrival

            pred = self.predictor.predict_eta(sch_time, feature_dict)
            status.destination_eta = pred["ai_predicted_eta"]
            status.confidence = pred["confidence_percentage"]
            status.lower_bound_delay = pred["lower_bound_minutes"]
            status.upper_bound_delay = pred["upper_bound_minutes"]

            updated_statuses.append({
                "train_number": status.train_number,
                "train_name": status.train_name,
                "latitude": status.latitude,
                "longitude": status.longitude,
                "speed": status.speed,
                "delay": status.delay,
                "current_section": status.current_section,
                "next_station_name": status.next_station_name,
                "destination_eta": status.destination_eta,
                "prediction_method": status.prediction_method,
                "confidence": status.confidence,
                "status_label": status.status_label,
                "last_updated": status.last_updated
            })

        db.commit()
        return updated_statuses

    def _build_feature_vector(self, status: LiveTrainStatusModel, event_name: str) -> Dict[str, float]:
        weather_sev = 0.8 if event_name == "HEAVY_RAIN" else 0.1
        congestion = 0.9 if event_name == "CONGESTION" else 0.2
        speed_rest = 30.0 if event_name == "SPEED_RESTRICTION" else 0.0
        signal_delay = 12.0 if event_name == "SIGNAL_DELAY" else 0.0
        extended_halt = 8.0 if event_name == "EXTENDED_HALT" else 0.0
        recovery = 0.35 if event_name == "DELAY_RECOVERY" else 0.05

        return {
            "current_speed": status.speed,
            "current_delay": status.delay,
            "distance_travelled_km": 450.0,
            "distance_remaining_km": 350.0,
            "distance_to_next_station_km": 25.0,
            "scheduled_section_time_min": 30.0,
            "scheduled_halt_min": 5.0,
            "station_sequence_index": 12,
            "hist_avg_section_speed": 75.0,
            "hist_avg_section_time_min": 28.0,
            "hist_delay_recovery_rate": recovery,
            "hour_of_day": 14,
            "day_of_week": 3,
            "weather_severity": weather_sev,
            "track_congestion_level": congestion,
            "speed_restriction_kmh": speed_rest,
            "signal_delay_min": signal_delay,
            "extended_halt_min": extended_halt,
            "train_priority_score": 1.0 if "SF" in status.train_type or "Rajdhani" in status.train_name else 0.8
        }
