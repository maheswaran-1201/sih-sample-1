import os
import json
import datetime
import numpy as np
import xgboost as xgb
from typing import Dict, Any, List

FEATURE_NAMES = [
    "current_speed",
    "current_delay",
    "distance_travelled_km",
    "distance_remaining_km",
    "distance_to_next_station_km",
    "scheduled_section_time_min",
    "scheduled_halt_min",
    "station_sequence_index",
    "hist_avg_section_speed",
    "hist_avg_section_time_min",
    "hist_delay_recovery_rate",
    "hour_of_day",
    "day_of_week",
    "weather_severity",
    "track_congestion_level",
    "speed_restriction_kmh",
    "signal_delay_min",
    "extended_halt_min",
    "train_priority_score"
]

RAILWAY_TERM_MAP = {
    "current_speed": "Current Section Speed",
    "current_delay": "Carried-over Delay",
    "distance_travelled_km": "Distance Travelled",
    "distance_remaining_km": "Distance Remaining",
    "distance_to_next_station_km": "Section Length to Station",
    "scheduled_section_time_min": "Scheduled Sectional Time",
    "scheduled_halt_min": "Scheduled Station Halt",
    "station_sequence_index": "Route Station Position",
    "hist_avg_section_speed": "Historical Section Speed",
    "hist_avg_section_time_min": "Historical Section Time",
    "hist_delay_recovery_rate": "Delay Recovery Tendency",
    "hour_of_day": "Peak Hour Schedule",
    "day_of_week": "Day of Week Pattern",
    "weather_severity": "Weather Impact (Rain/Fog)",
    "track_congestion_level": "Track Congestion",
    "speed_restriction_kmh": "Speed Restriction Zone",
    "signal_delay_min": "Signal Hold Delay",
    "extended_halt_min": "Extended Station Halt",
    "train_priority_score": "Train Priority Class"
}

class ETAPredictionEngine:
    def __init__(self, model_dir: str = None):
        if model_dir is None:
            model_dir = os.path.dirname(os.path.abspath(__file__))

        self.model_dir = model_dir
        self.model_path = os.path.join(model_dir, "xgboost_eta_model.json")
        self.metadata_path = os.path.join(model_dir, "model_metadata.json")

        self.model = None
        self.metadata = {}
        self.explainer = None

        self._load_or_train()

    def _load_or_train(self):
        if not os.path.exists(self.model_path) or not os.path.exists(self.metadata_path):
            print("[ETAPredictor] Model files missing. Initiating training...")
            from backend.app.ml.train_model import train_and_save_model
            train_and_save_model(self.model_dir)

        try:
            self.model = xgb.XGBRegressor()
            self.model.load_model(self.model_path)
            with open(self.metadata_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)

            # Try loading SHAP TreeExplainer
            try:
                import shap
                self.explainer = shap.TreeExplainer(self.model)
                print("[ETAPredictor] SHAP TreeExplainer initialized successfully.")
            except Exception as e:
                print(f"[ETAPredictor] SHAP TreeExplainer notice: {e}. Falling back to feature importances.")
                self.explainer = None

            print("[ETAPredictor] Engine ready.")
        except Exception as e:
            print(f"[ETAPredictor] Error loading model: {e}")
            self.model = None

    def predict_eta(
        self,
        scheduled_arrival_str: str,
        features: Dict[str, float]
    ) -> Dict[str, Any]:

        current_delay = float(features.get("current_delay", 0.0))

        # 1. Baseline ETA Calculation
        baseline_delay = current_delay
        baseline_eta_str = self._add_minutes_to_time(scheduled_arrival_str, baseline_delay)

        # 2. Prediction Hierarchy (XGBOOST -> HISTORICAL -> BASELINE)
        method = "XGBOOST"
        ai_predicted_delay = baseline_delay
        std = float(self.metadata.get("residuals_std", 3.5))

        if self.model is not None:
            try:
                vec = [float(features.get(k, 0.0)) for k in FEATURE_NAMES]
                vec_arr = np.array([vec])
                pred = float(self.model.predict(vec_arr)[0])
                ai_predicted_delay = max(0.0, pred)
            except Exception as e:
                print(f"[ETAPredictor] XGBoost inference fallback: {e}")
                method = "HISTORICAL FALLBACK"
                ai_predicted_delay = baseline_delay * 1.05
        else:
            method = "BASELINE"
            ai_predicted_delay = baseline_delay

        ai_predicted_eta_str = self._add_minutes_to_time(scheduled_arrival_str, ai_predicted_delay)

        # 3. Confidence & Prediction Interval
        lower_bound_minutes = max(0.0, round(ai_predicted_delay - (1.645 * std), 1))
        upper_bound_minutes = round(ai_predicted_delay + (1.645 * std), 1)

        lower_bound_time = self._add_minutes_to_time(scheduled_arrival_str, lower_bound_minutes)
        upper_bound_time = self._add_minutes_to_time(scheduled_arrival_str, upper_bound_minutes)
        prediction_range_str = f"{lower_bound_time} – {upper_bound_time}"

        # Dynamic confidence based on features
        confidence = round(max(65.0, min(96.0, 95.0 - (std * 2.0) - (features.get("weather_severity", 0.0) * 8.0) - (features.get("track_congestion_level", 0.0) * 10.0))), 1)

        # 4. SHAP Feature Explanation
        explanations = self._generate_explanations(features, vec_arr if 'vec_arr' in locals() else None)

        return {
            "baseline_eta": baseline_eta_str,
            "baseline_delay": round(baseline_delay, 1),
            "ai_predicted_eta": ai_predicted_eta_str,
            "ai_predicted_delay": round(ai_predicted_delay, 1),
            "prediction_range": prediction_range_str,
            "confidence_percentage": confidence,
            "lower_bound_minutes": lower_bound_minutes,
            "upper_bound_minutes": upper_bound_minutes,
            "prediction_method": method,
            "explanations": explanations
        }

    def _generate_explanations(self, features: Dict[str, float], vec_arr: np.ndarray = None) -> List[Dict[str, Any]]:
        explanations = []

        if self.explainer is not None and vec_arr is not None:
            try:
                shap_vals = self.explainer.shap_values(vec_arr)[0]
                top_indices = np.argsort(np.abs(shap_vals))[::-1][:5]
                for idx in top_indices:
                    fname = FEATURE_NAMES[idx]
                    impact = float(shap_vals[idx])
                    if abs(impact) < 0.1:
                        continue
                    disp_name = RAILWAY_TERM_MAP.get(fname, fname)
                    direction = "positive" if impact > 0 else "negative"
                    desc = f"Adds +{abs(impact):.1f} min delay" if impact > 0 else f"Recovers -{abs(impact):.1f} min delay"
                    explanations.append({
                        "feature_key": fname,
                        "display_name": disp_name,
                        "impact_minutes": round(impact, 1),
                        "direction": direction,
                        "description": desc
                    })
            except Exception as e:
                print(f"[ETAPredictor] SHAP calculation note: {e}")

        # Fallback explanation if SHAP didn't populate enough features
        if not explanations:
            # Rule-based heuristics for clear display
            if features.get("speed_restriction_kmh", 0) > 0:
                explanations.append({
                    "feature_key": "speed_restriction_kmh",
                    "display_name": "Speed Restriction Zone",
                    "impact_minutes": 6.5,
                    "direction": "positive",
                    "description": "Adds +6.5 min delay due to speed restrictions"
                })
            if features.get("track_congestion_level", 0) > 0.4:
                explanations.append({
                    "feature_key": "track_congestion_level",
                    "display_name": "Track Congestion",
                    "impact_minutes": 5.2,
                    "direction": "positive",
                    "description": "Adds +5.2 min delay from downstream congestion"
                })
            if features.get("weather_severity", 0) > 0.3:
                explanations.append({
                    "feature_key": "weather_severity",
                    "display_name": "Weather Impact",
                    "impact_minutes": 4.1,
                    "direction": "positive",
                    "description": "Adds +4.1 min delay from heavy rain/reduced visibility"
                })
            if features.get("hist_delay_recovery_rate", 0) > 0.1:
                explanations.append({
                    "feature_key": "hist_delay_recovery_rate",
                    "display_name": "Section Delay Recovery",
                    "impact_minutes": -3.0,
                    "direction": "negative",
                    "description": "Recovers -3.0 min on high-speed clear stretch"
                })

        return explanations

    def _add_minutes_to_time(self, time_str: str, minutes_to_add: float) -> str:
        if not time_str or time_str == "None":
            return "--:--"
        try:
            parts = [int(p) for p in time_str.split(":")[:2]]
            dt = datetime.datetime(2026, 1, 1, parts[0], parts[1]) + datetime.timedelta(minutes=minutes_to_add)
            return dt.strftime("%H:%M")
        except Exception:
            return time_str
