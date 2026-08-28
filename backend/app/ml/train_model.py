import os
import json
import datetime
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb

from backend.app.ml.synthetic_data import generate_synthetic_historical_data

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

TARGET_NAME = "future_arrival_delay_minutes"

def train_and_save_model(model_dir: str = None):
    if model_dir is None:
        model_dir = os.path.dirname(os.path.abspath(__file__))

    os.makedirs(model_dir, exist_ok=True)

    print("[ML Pipeline] Generating synthetic historical dataset...")
    df = generate_synthetic_historical_data(n_samples=6000, random_seed=42)

    X = df[FEATURE_NAMES]
    y = df[TARGET_NAME]

    # Time-aware / Stratified train-test split (80% train, 20% validation)
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    print(f"[ML Pipeline] Training XGBoost Regressor on {len(X_train)} samples...")
    model = xgb.XGBRegressor(
        n_estimators=150,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42
    )

    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_val)
    mae = float(mean_absolute_error(y_val, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_val, y_pred)))
    r2 = float(r2_score(y_val, y_pred))
    residuals_std = float(np.std(y_val - y_pred))

    print(f"[ML Evaluation] Validation MAE: {mae:.2f} min, RMSE: {rmse:.2f} min, R²: {r2:.4f}")

    # Save XGBoost Model
    model_path = os.path.join(model_dir, "xgboost_eta_model.json")
    model.save_model(model_path)
    print(f"[ML Pipeline] Model saved to {model_path}")

    # Save Model Metadata
    metadata = {
        "model_version": "1.0.0-xgb",
        "training_date": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "training_sample_count": len(X_train),
        "validation_sample_count": len(X_val),
        "feature_names": FEATURE_NAMES,
        "target_name": TARGET_NAME,
        "mae_minutes": round(mae, 2),
        "rmse_minutes": round(rmse, 2),
        "r2_score": round(r2, 4),
        "residuals_std": round(residuals_std, 2)
    }

    metadata_path = os.path.join(model_dir, "model_metadata.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"[ML Pipeline] Metadata saved to {metadata_path}")

    return model, metadata

if __name__ == "__main__":
    train_and_save_model()
