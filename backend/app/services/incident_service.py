import datetime
import random
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.models.database import IncidentModel, IncidentRecipientModel, TrainModel, LiveTrainStatusModel, ScheduleModel
from backend.app.models.schemas import IncidentCreateSchema

class RailETAIncidentService:
    def create_incident(self, db: Session, payload: IncidentCreateSchema) -> IncidentModel:
        # Validate train
        train = db.query(TrainModel).filter(TrainModel.number == payload.train_number).first()
        train_name = payload.train_name or (train.name if train else f"Train {payload.train_number}")

        # Fetch live telemetry position & next station
        live_status = db.query(LiveTrainStatusModel).filter(LiveTrainStatusModel.train_number == payload.train_number).first()
        
        lat = live_status.latitude if live_status else 26.8467
        lng = live_status.longitude if live_status else 80.9462
        curr_section = live_status.current_section if live_status else (f"{train.from_station_code} - {train.to_station_code}" if train else "Main Line")
        next_code = live_status.next_station_code if live_status else (train.to_station_code if train else "NDLS")
        next_name = live_status.next_station_name if live_status else (train.to_station_name if train else "New Delhi")
        next_eta = live_status.destination_eta if live_status else "23:45"

        # Check duplicate submission within last 5 minutes
        five_mins_ago = (datetime.datetime.now() - datetime.timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S")
        existing = db.query(IncidentModel).filter(
            IncidentModel.train_number == payload.train_number,
            IncidentModel.coach_number == payload.coach_number,
            IncidentModel.incident_type == payload.incident_type,
            IncidentModel.created_at >= five_mins_ago
        ).first()

        if existing:
            return existing

        # Generate unique incident ID
        rand_suffix = random.randint(1000, 9999)
        incident_id = f"INC-2026-{rand_suffix}"
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Create Incident record
        incident = IncidentModel(
            incident_id=incident_id,
            train_number=payload.train_number,
            train_name=train_name,
            coach_number=payload.coach_number.upper(),
            seat_number=payload.seat_number or "",
            incident_type=payload.incident_type,
            description=payload.description or f"{payload.incident_type} reported in coach {payload.coach_number}",
            severity=payload.severity or "NORMAL",
            latitude=lat,
            longitude=lng,
            current_section=curr_section,
            current_station=curr_section.split("-")[0].strip() if "-" in curr_section else curr_section,
            next_station_code=next_code,
            next_station_name=next_name,
            next_station_eta=next_eta,
            reported_at=now_str,
            status="REPORTED",
            source=payload.source or "FORM",
            language=payload.language or "en",
            created_at=now_str,
            updated_at=now_str
        )

        db.add(incident)
        db.commit()
        db.refresh(incident)

        # Create simulated recipients
        recipient_1 = IncidentRecipientModel(
            incident_id=incident_id,
            recipient_type="ON_TRAIN_STAFF",
            recipient_name=f"Train Captain / TTE (Train {payload.train_number})",
            delivery_status="SENT",
            sent_at=now_str
        )
        recipient_2 = IncidentRecipientModel(
            incident_id=incident_id,
            recipient_type="NEXT_STATION",
            recipient_name=f"{next_name} ({next_code}) Station Control Desk",
            delivery_status="SENT",
            sent_at=now_str
        )
        recipient_3 = IncidentRecipientModel(
            incident_id=incident_id,
            recipient_type="CONTROL_ROOM",
            recipient_name="Section Operations Command Center",
            delivery_status="SENT",
            sent_at=now_str
        )

        db.add_all([recipient_1, recipient_2, recipient_3])
        db.commit()

        return incident

    def get_incidents(self, db: Session, train_number: Optional[str] = None, status: Optional[str] = None) -> List[IncidentModel]:
        q = db.query(IncidentModel)
        if train_number:
            q = q.filter(IncidentModel.train_number == train_number)
        if status:
            q = q.filter(IncidentModel.status == status)
        return q.order_by(IncidentModel.id.desc()).all()

    def update_incident_status(self, db: Session, incident_id: str, new_status: str) -> Optional[IncidentModel]:
        incident = db.query(IncidentModel).filter(IncidentModel.incident_id == incident_id).first()
        if not incident:
            return None

        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        incident.status = new_status
        incident.updated_at = now_str

        # Update recipient delivery status
        recipients = db.query(IncidentRecipientModel).filter(IncidentRecipientModel.incident_id == incident_id).all()
        for r in recipients:
            if new_status in ["ACKNOWLEDGED", "RESOLVED"]:
                r.delivery_status = new_status
                r.acknowledged_at = now_str

        db.commit()
        db.refresh(incident)
        return incident
