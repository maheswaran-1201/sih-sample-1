from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime
import os
from pathlib import Path

# A mounted directory keeps the demo state across restarts. Locally this
# defaults to the repository root, preserving the original behaviour.
DATA_DIR = Path(os.getenv("RAILETA_DATA_DIR", ".")).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
SQLALCHEMY_DATABASE_URL = f"sqlite:///{(DATA_DIR / 'raileta.db').as_posix()}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class TrainModel(Base):
    __tablename__ = "trains"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    type = Column(String, index=True)
    zone = Column(String)
    from_station_code = Column(String)
    from_station_name = Column(String)
    to_station_code = Column(String)
    to_station_name = Column(String)
    departure = Column(String)
    arrival = Column(String)
    duration_h = Column(Integer, default=0)
    duration_m = Column(Integer, default=0)
    distance = Column(Float, default=0.0)
    classes = Column(String, default="")
    sleeper = Column(Integer, default=0)
    third_ac = Column(Integer, default=0)
    second_ac = Column(Integer, default=0)
    first_ac = Column(Integer, default=0)
    chair_car = Column(Integer, default=0)
    geometry_json = Column(Text, default="[]")

class StationModel(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    state = Column(String, default="")
    zone = Column(String, default="")
    address = Column(String, default="")
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)

class ScheduleModel(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    train_number = Column(String, index=True)
    train_name = Column(String)
    station_code = Column(String, index=True)
    station_name = Column(String)
    arrival = Column(String)
    departure = Column(String)
    day = Column(Integer, default=1)
    sequence = Column(Integer, index=True)
    distance_km = Column(Float, default=0.0)

class LiveTrainStatusModel(Base):
    __tablename__ = "live_train_status"

    id = Column(Integer, primary_key=True, index=True)
    train_number = Column(String, unique=True, index=True)
    train_name = Column(String)
    train_type = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    speed = Column(Float, default=0.0)
    delay = Column(Float, default=0.0)
    current_section = Column(String, default="")
    next_station_code = Column(String, default="")
    next_station_name = Column(String, default="")
    destination_eta = Column(String, default="")
    prediction_method = Column(String, default="XGBOOST")
    confidence = Column(Float, default=85.0)
    lower_bound_delay = Column(Float, default=0.0)
    upper_bound_delay = Column(Float, default=0.0)
    status_label = Column(String, default="ON TIME")  # ON TIME, SLIGHT DELAY, DELAYED, CRITICAL DELAY
    last_updated = Column(String, default="")

class AlertModel(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    train_number = Column(String, index=True)
    train_name = Column(String)
    severity = Column(String)  # INFO, WARNING, CRITICAL
    alert_type = Column(String)
    message = Column(String)
    timestamp = Column(String)

class IncidentModel(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String, unique=True, index=True)
    train_number = Column(String, index=True)
    train_name = Column(String)
    coach_number = Column(String)
    seat_number = Column(String, default="")
    incident_type = Column(String, index=True)
    description = Column(Text, default="")
    severity = Column(String, default="NORMAL")  # EMERGENCY, URGENT, NORMAL
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    current_section = Column(String, default="")
    current_station = Column(String, default="")
    next_station_code = Column(String, default="")
    next_station_name = Column(String, default="")
    next_station_eta = Column(String, default="")
    reported_at = Column(String, default="")
    status = Column(String, default="REPORTED")  # REPORTED, VALIDATED, ALERT_SENT, ACKNOWLEDGED, RESOLVED
    source = Column(String, default="FORM")  # VOICE, FORM, SIMULATION
    language = Column(String, default="en")
    created_at = Column(String, default="")
    updated_at = Column(String, default="")

class IncidentRecipientModel(Base):
    __tablename__ = "incident_recipients"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String, index=True)
    recipient_type = Column(String)  # ON_TRAIN_STAFF, NEXT_STATION, CONTROL_ROOM
    recipient_name = Column(String)
    delivery_status = Column(String, default="SENT")  # SENT, DELIVERED, ACKNOWLEDGED
    sent_at = Column(String, default="")
    acknowledged_at = Column(String, default="")

class OperationalEventModel(Base):
    __tablename__ = "operational_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, unique=True, index=True)
    train_number = Column(String, index=True)
    train_name = Column(String, default="")
    category = Column(String, default="TRAIN_DELAY")
    delay_minutes = Column(Float, default=0.0)
    previous_delay = Column(Float, default=0.0)
    current_delay = Column(Float, default=0.0)
    reason = Column(Text, default="")
    timestamp = Column(String, default="")
    current_section = Column(String, default="")
    next_station = Column(String, default="")
    source = Column(String, default="EMPLOYEE_DESK")
    status = Column(String, default="ACTIVE")

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
