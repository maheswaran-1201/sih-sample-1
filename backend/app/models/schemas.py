from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class StationSchema(BaseModel):
    code: str
    name: str
    state: str = ""
    zone: str = ""
    address: str = ""
    latitude: float = 0.0
    longitude: float = 0.0

    class Config:
        from_attributes = True

class TrainSchema(BaseModel):
    number: str
    name: str
    type: str
    zone: str
    from_station_code: str
    from_station_name: str
    to_station_code: str
    to_station_name: str
    departure: str
    arrival: str
    duration_h: int
    duration_m: int
    distance: float
    classes: str = ""
    sleeper: int = 0
    third_ac: int = 0
    second_ac: int = 0
    first_ac: int = 0
    chair_car: int = 0
    geometry: List[List[float]] = []

    class Config:
        from_attributes = True

class ScheduleSchema(BaseModel):
    sequence: int
    station_code: str
    station_name: str
    arrival: Optional[str] = "None"
    departure: Optional[str] = "None"
    day: int = 1
    distance_km: float = 0.0
    scheduled_eta: Optional[str] = None
    predicted_eta: Optional[str] = None
    predicted_delay: float = 0.0
    baseline_eta: Optional[str] = None
    confidence: float = 85.0
    status: str = "UPCOMING"  # PASSED, CURRENT, UPCOMING, DESTINATION

    class Config:
        from_attributes = True

class LiveTrainStatusSchema(BaseModel):
    train_number: str
    train_name: str
    train_type: str
    latitude: float
    longitude: float
    speed: float
    delay: float
    current_section: str
    next_station_code: str
    next_station_name: str
    destination_eta: str
    prediction_method: str
    confidence: float
    lower_bound_delay: float
    upper_bound_delay: float
    status_label: str
    last_updated: str

    class Config:
        from_attributes = True

class FeatureContribution(BaseModel):
    feature_key: str
    display_name: str
    impact_minutes: float
    direction: str  # 'positive' (adds delay) or 'negative' (reduces delay)
    description: str

class ETAPredictionResponse(BaseModel):
    train_number: str
    train_name: str
    next_station_code: str
    next_station_name: str
    scheduled_arrival: str
    baseline_eta: str
    baseline_delay: float
    ai_predicted_eta: str
    ai_predicted_delay: float
    prediction_range: str  # e.g. "22:43 – 22:54"
    confidence_percentage: float
    lower_bound_minutes: float
    upper_bound_minutes: float
    prediction_method: str  # XGBOOST, HISTORICAL FALLBACK, BASELINE
    explanations: List[FeatureContribution] = []

class AlertSchema(BaseModel):
    id: Optional[int] = None
    train_number: str
    train_name: str
    severity: str  # INFO, WARNING, CRITICAL
    alert_type: str
    message: str
    timestamp: str

    class Config:
        from_attributes = True

class SimulationEventRequest(BaseModel):
    train_number: str
    event_type: str  # NORMAL, SPEED_RESTRICTION, CONGESTION, HEAVY_RAIN, SIGNAL_DELAY, EXTENDED_HALT, UNSCHEDULED_STOP, DELAY_RECOVERY, CUSTOM_DELAY, TRAIN_DELAY
    value: Optional[float] = None
    reason: Optional[str] = None

class OperationalDelayRequest(BaseModel):
    category: Optional[str] = "TRAIN_DELAY"
    delay_minutes: float
    reason: str

class OperationalDelayResponse(BaseModel):
    success: bool
    train_id: str
    previous_delay: float
    added_delay: float
    current_delay: float
    previous_eta: str
    new_eta: str
    prediction_method: str
    confidence: float
    event_id: str

class IncidentCreateSchema(BaseModel):
    train_number: str
    train_name: Optional[str] = None
    coach_number: str
    seat_number: Optional[str] = ""
    incident_type: str
    description: Optional[str] = ""
    severity: Optional[str] = "NORMAL"  # EMERGENCY, URGENT, NORMAL
    source: Optional[str] = "FORM"  # VOICE, FORM, SIMULATION
    language: Optional[str] = "en"

class IncidentRecipientSchema(BaseModel):
    id: Optional[int] = None
    incident_id: str
    recipient_type: str  # ON_TRAIN_STAFF, NEXT_STATION, CONTROL_ROOM
    recipient_name: str
    delivery_status: str = "SENT"
    sent_at: str = ""
    acknowledged_at: Optional[str] = ""

    class Config:
        from_attributes = True

class IncidentResponseSchema(BaseModel):
    id: int
    incident_id: str
    train_number: str
    train_name: str
    coach_number: str
    seat_number: Optional[str] = ""
    incident_type: str
    description: str
    severity: str
    latitude: float = 0.0
    longitude: float = 0.0
    current_section: str = ""
    current_station: str = ""
    next_station_code: str = ""
    next_station_name: str = ""
    next_station_eta: str = ""
    reported_at: str
    status: str
    source: str
    language: str
    created_at: str
    recipients: List[IncidentRecipientSchema] = []

    class Config:
        from_attributes = True

class AssistantQueryRequest(BaseModel):
    message: str
    language: Optional[str] = "en"
    train_id: Optional[str] = None
    conversation_id: Optional[str] = None

class AssistantQueryResponse(BaseModel):
    intent: str
    response_text: str
    speech_text: str
    train_id: Optional[str] = None
    train_name: Optional[str] = None
    data: Dict[str, Any] = {}

class AssistantIncidentExtractRequest(BaseModel):
    message: str
    train_id: Optional[str] = None

class AssistantIncidentExtractResponse(BaseModel):
    incident_type: str
    coach_number: Optional[str] = None
    severity: str
    description: str
    train_id: Optional[str] = None

