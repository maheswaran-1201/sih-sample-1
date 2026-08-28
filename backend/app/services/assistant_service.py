import re
import os
import json
import urllib.request
import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.app.models.database import TrainModel, LiveTrainStatusModel, ScheduleModel, StationModel
from backend.app.ml.predictor import ETAPredictionEngine

class RailETAAssistantService:
    def __init__(self):
        self.predictor = ETAPredictionEngine()

    def _call_gemini_api(self, prompt: str) -> Optional[str]:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("NEXT_PUBLIC_GEMINI_API_KEY")
        if not api_key:
            return None

        models = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash"]
        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 300}
        }).encode("utf-8")

        for model_name in models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=6) as response:
                    res_data = json.loads(response.read().decode("utf-8"))
                    candidates = res_data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"].strip()
            except Exception as e:
                continue

        return None

    def _format_speech_text(self, text: str) -> str:
        if not text:
            return ""
        digit_map = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'}
        def replace_train_num(match):
            digits = match.group(1)
            return " ".join(digit_map.get(d, d) for d in digits)
        return re.sub(r'#?(\b\d{4,5}\b)', replace_train_num, text)

    def process_query(
        self,
        db: Session,
        message: str,
        language: str = "en",
        context_train_id: Optional[str] = None
    ) -> Dict[str, Any]:
        msg_lower = message.strip().lower()

        # Extract train identification if mentioned in text
        extracted_train_id = self._extract_train_number(db, msg_lower)
        target_train_id = extracted_train_id or context_train_id

        # Intent classification
        intent = self._classify_intent(msg_lower)

        # Handle Help or Incident Routing
        if intent == "HELP":
            return {
                "intent": "HELP",
                "response_text": "I can help you track live trains, get AI ETA forecasts, check delay reasons, or report an on-train issue. Try asking: 'Where is train 12627?' or 'Why is Karnataka Express delayed?'",
                "speech_text": "I can help you track live trains, check delay reasons, or report on-train issues. Ask me about any train number or name.",
                "train_id": target_train_id,
                "data": {}
            }

        if intent == "INCIDENT_REPORT":
            return {
                "intent": "INCIDENT_REPORT",
                "response_text": "I can help you log an on-train incident immediately. Please specify your coach number and the problem occurring, or click 'Report an Issue'.",
                "speech_text": "I can help you report an incident immediately. Please state your coach number and the issue.",
                "train_id": target_train_id,
                "data": {"action": "OPEN_INCIDENT_FORM"}
            }

        # If train is required but missing, prompt user
        if not target_train_id:
            # Try finding any default active train in DB
            first_train = db.query(TrainModel).first()
            if first_train:
                target_train_id = first_train.number
            else:
                return {
                    "intent": "UNKNOWN",
                    "response_text": "I don't have reliable live information for that request right now. Please specify a train number or name like 12627 Karnataka Express.",
                    "speech_text": "Please provide a train number or train name so I can check live details for you.",
                    "train_id": None,
                    "data": {}
                }

        # Fetch train metadata & live status
        train = db.query(TrainModel).filter(TrainModel.number == target_train_id).first()
        if not train:
            return {
                "intent": "NOT_FOUND",
                "response_text": f"I couldn't locate train {target_train_id} in our current timetable database.",
                "speech_text": f"I could not find train {target_train_id} in our system.",
                "train_id": target_train_id,
                "data": {}
            }

        live_status = db.query(LiveTrainStatusModel).filter(LiveTrainStatusModel.train_number == target_train_id).first()

        # Try Gemini AI LLM Generation with Live Context
        delay_min = int(round(live_status.delay)) if live_status else 0
        speed = int(round(live_status.speed)) if live_status else 65
        next_stn = live_status.next_station_name if live_status and live_status.next_station_name else train.to_station_name
        curr_sec = live_status.current_section if live_status and live_status.current_section else f"{train.from_station_name} - {train.to_station_name}"

        gemini_prompt = f"""You are RailETA AI Assistant, an expert Indian Railways AI assistant.
Answer the user's question concisely (2-3 sentences max) based on this live telemetry context:

- Train: #{train.number} {train.name} ({train.from_station_name} to {train.to_station_name})
- Current Status: {live_status.status_label if live_status else 'ON TIME'}
- Current Speed: {speed} km/h
- Current Delay: {delay_min} minutes
- Current Location/Section: {curr_sec}
- Next Station: {next_stn}
- Destination ETA: {live_status.destination_eta if live_status else train.arrival}

User Question: "{message}"
"""

        gemini_reply = self._call_gemini_api(gemini_prompt)
        if gemini_reply:
            return {
                "intent": intent,
                "response_text": gemini_reply,
                "speech_text": self._format_speech_text(gemini_reply),
                "train_id": train.number,
                "train_name": train.name,
                "data": {"engine": "Google Gemini 2.5 Flash AI", "delay": delay_min}
            }

        # Fallback to local rule engine if offline / Gemini API unavailable
        if intent == "WHY_DELAYED":
            return self._handle_why_delayed(db, train, live_status)
        elif intent in ["TRAIN_ETA", "STATION_ETA", "DESTINATION_ETA"]:
            return self._handle_eta_query(db, train, live_status, msg_lower)
        elif intent in ["TRAIN_LOCATION", "NEXT_STATION"]:
            return self._handle_location_query(db, train, live_status)
        else: # TRAIN_STATUS / GENERAL
            return self._handle_general_status(db, train, live_status)

    def extract_incident_info(self, message: str) -> Dict[str, Any]:
        msg_lower = message.lower()
        
        # Severity rules
        severity = "NORMAL"
        if any(w in msg_lower for w in ["fire", "smoke", "medical", "heart", "attack", "blood", "violence", "threat", "harassment", "emergency"]):
            severity = "EMERGENCY"
        elif any(w in msg_lower for w in ["water", "ac", "electrical", "spark", "door", "stuck", "leak"]):
            severity = "URGENT"

        # Incident type rules
        incident_type = "OTHER_ISSUE"
        if "smoke" in msg_lower or "fire" in msg_lower:
            incident_type = "FIRE_SMOKE"
        elif "medical" in msg_lower or "doctor" in msg_lower or "sick" in msg_lower:
            incident_type = "MEDICAL_EMERGENCY"
        elif "security" in msg_lower or "thief" in msg_lower or "threat" in msg_lower:
            incident_type = "SECURITY_CONCERN"
        elif "harass" in msg_lower:
            incident_type = "HARASSMENT"
        elif "ac" in msg_lower or "cooling" in msg_lower:
            incident_type = "AC_PROBLEM"
        elif "water" in msg_lower or "toilet" in msg_lower or "washroom" in msg_lower:
            incident_type = "WATER_PROBLEM"
        elif "clean" in msg_lower or "dirt" in msg_lower or "garbage" in msg_lower:
            incident_type = "CLEANLINESS"
        elif "door" in msg_lower:
            incident_type = "DOOR_PROBLEM"

        # Extract coach identifier (e.g., B4, S5, A1, H1, D2, M1)
        coach_match = re.search(r'\b([sSaAbBhHdDmM]\d{1,2})\b', message)
        coach_number = coach_match.group(1).upper() if coach_match else "General"

        return {
            "incident_type": incident_type,
            "coach_number": coach_number,
            "severity": severity,
            "description": message.strip()
        }

    def _extract_train_number(self, db: Session, text: str) -> Optional[str]:
        # Regex for 5-digit Indian Railways train numbers
        match = re.search(r'\b(\d{5})\b', text)
        if match:
            return match.group(1)

        # Keyword train name matching
        trains = db.query(TrainModel).all()
        for t in trains:
            if t.name.lower() in text or t.number in text:
                return t.number
            # Match main name words (e.g., Rajdhani, Karnataka, Shatabdi)
            name_parts = t.name.lower().split()
            for part in name_parts:
                if len(part) > 4 and part in text:
                    return t.number

        return None

    def _classify_intent(self, text: str) -> str:
        if any(w in text for w in ["why", "reason", "cause", "factor"]):
            return "WHY_DELAYED"
        if any(w in text for w in ["eta", "reach", "arrive", "when will", "expected at"]):
            return "TRAIN_ETA"
        if any(w in text for w in ["where", "location", "position", "section", "next station"]):
            return "TRAIN_LOCATION"
        if any(w in text for w in ["late", "delay", "behind", "on time"]):
            return "TRAIN_DELAY"
        if any(w in text for w in ["report", "issue", "problem", "smoke", "fire", "emergency", "complaint"]):
            return "INCIDENT_REPORT"
        if any(w in text for w in ["help", "what can you do", "commands"]):
            return "HELP"
        return "TRAIN_STATUS"

    def _get_prediction_for_train(self, db: Session, train: TrainModel, live_status: Optional[LiveTrainStatusModel]) -> Dict[str, Any]:
        if not live_status:
            return {"ai_predicted_eta": train.arrival, "prediction_range": "", "ai_predicted_delay": 0, "next_station_name": train.to_station_name, "explanations": []}
        
        sch = db.query(ScheduleModel).filter(
            ScheduleModel.train_number == train.number,
            ScheduleModel.station_code == live_status.next_station_code
        ).first()
        sch_time = sch.arrival if (sch and sch.arrival and sch.arrival != "None") else "18:30:00"
        
        try:
            from backend.app.api.endpoints import sim_engine
            feature_dict = sim_engine._build_feature_vector(live_status, "NORMAL")
            return self.predictor.predict_eta(sch_time, feature_dict)
        except Exception:
            return {
                "ai_predicted_eta": train.arrival,
                "prediction_range": f"{train.arrival} (+/- 5m)",
                "ai_predicted_delay": live_status.delay,
                "next_station_name": live_status.next_station_name or train.to_station_name,
                "explanations": []
            }

    def _handle_why_delayed(self, db: Session, train: TrainModel, live_status: Optional[LiveTrainStatusModel]) -> Dict[str, Any]:
        delay_min = int(round(live_status.delay)) if live_status else 0
        if delay_min <= 2:
            return {
                "intent": "WHY_DELAYED",
                "response_text": f"{train.number} {train.name} is currently running ON TIME (delay negligible under 2 mins).",
                "speech_text": f"{train.name} is currently running on time.",
                "train_id": train.number,
                "train_name": train.name,
                "data": {"delay_minutes": delay_min}
            }

        # Predict AI factor breakdown
        pred_res = self._get_prediction_for_train(db, train, live_status)
        explanations = pred_res.get("explanations", [])
        
        reasons_summary = []
        for exp in explanations[:3]:
            impact = int(round(exp.get("impact_minutes", 0)))
            if impact > 0:
                reasons_summary.append(f"{exp.get('display_name')}: +{impact} mins")

        reasons_str = ", ".join(reasons_summary) if reasons_summary else "Track congestion and operational speed restrictions"

        resp_text = (
            f"Train {train.number} ({train.name}) is delayed by approximately {delay_min} minutes. "
            f"Key AI delay factors: {reasons_str}."
        )
        speech_text = (
            f"{train.name} is currently {delay_min} minutes late. "
            f"The delay is mainly caused by {reasons_str}."
        )

        return {
            "intent": "WHY_DELAYED",
            "response_text": resp_text,
            "speech_text": speech_text,
            "train_id": train.number,
            "train_name": train.name,
            "data": {
                "delay_minutes": delay_min,
                "explanations": explanations
            }
        }

    def _handle_eta_query(self, db: Session, train: TrainModel, live_status: Optional[LiveTrainStatusModel], msg: str) -> Dict[str, Any]:
        pred_res = self._get_prediction_for_train(db, train, live_status)
        eta_time = pred_res.get("ai_predicted_eta", train.arrival)
        eta_range = pred_res.get("prediction_range", "")
        delay_min = int(round(pred_res.get("ai_predicted_delay", 0)))
        next_station = pred_res.get("next_station_name", train.to_station_name)

        resp_text = (
            f"For train {train.number} ({train.name}), the AI forecast arrival at {next_station} is {eta_time} "
            f"(expected window: {eta_range}). The train is currently running {delay_min} minutes late."
        )
        speech_text = (
            f"The AI forecast for {train.name} at {next_station} is {eta_time}. "
            f"It is currently running {delay_min} minutes late."
        )

        return {
            "intent": "TRAIN_ETA",
            "response_text": resp_text,
            "speech_text": speech_text,
            "train_id": train.number,
            "train_name": train.name,
            "data": pred_res
        }

    def _handle_location_query(self, db: Session, train: TrainModel, live_status: Optional[LiveTrainStatusModel]) -> Dict[str, Any]:
        curr_section = live_status.current_section if live_status and live_status.current_section else f"{train.from_station_name} - {train.to_station_name}"
        next_stn = live_status.next_station_name if live_status and live_status.next_station_name else train.to_station_name
        speed = int(round(live_status.speed)) if live_status else 65
        delay_min = int(round(live_status.delay)) if live_status else 0

        resp_text = (
            f"Train {train.number} ({train.name}) is currently near {curr_section}, running at {speed} km/h. "
            f"The next station is {next_stn} and current delay is {delay_min} minutes."
        )
        speech_text = (
            f"Train {train.number}, {train.name}, is currently near {curr_section}, running at {speed} kilometers per hour. "
            f"The next station is {next_stn}."
        )

        return {
            "intent": "TRAIN_LOCATION",
            "response_text": resp_text,
            "speech_text": speech_text,
            "train_id": train.number,
            "train_name": train.name,
            "data": {
                "current_section": curr_section,
                "next_station": next_stn,
                "speed": speed,
                "delay": delay_min
            }
        }

    def _handle_general_status(self, db: Session, train: TrainModel, live_status: Optional[LiveTrainStatusModel]) -> Dict[str, Any]:
        delay_min = int(round(live_status.delay)) if live_status else 0
        speed = int(round(live_status.speed)) if live_status else 65
        status_label = live_status.status_label if live_status else "ON TIME"
        dest_eta = live_status.destination_eta if live_status else train.arrival

        resp_text = (
            f"Train {train.number} ({train.name}) status: {status_label}. "
            f"Current speed: {speed} km/h, Delay: {delay_min} mins. Destination ETA: {dest_eta}."
        )
        speech_text = (
            f"Train {train.number} {train.name} is currently {status_label.lower()}, running {delay_min} minutes late."
        )

        return {
            "intent": "TRAIN_STATUS",
            "response_text": resp_text,
            "speech_text": speech_text,
            "train_id": train.number,
            "train_name": train.name,
            "data": {
                "delay": delay_min,
                "speed": speed,
                "status_label": status_label,
                "destination_eta": dest_eta
            }
        }
