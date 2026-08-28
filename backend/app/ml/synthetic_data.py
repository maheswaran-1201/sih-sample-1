import numpy as np
import pandas as pd

def generate_synthetic_historical_data(n_samples: int = 5000, random_seed: int = 42) -> pd.DataFrame:
    np.random.seed(random_seed)

    # 1. Base Train & Route Features
    train_priority_scores = np.random.choice([1.0, 0.8, 0.6], size=n_samples, p=[0.3, 0.5, 0.2])
    station_sequence_index = np.random.randint(1, 35, size=n_samples)
    distance_travelled_km = station_sequence_index * np.random.uniform(25, 55, size=n_samples)
    distance_remaining_km = np.random.uniform(50, 1200, size=n_samples)
    distance_to_next_station_km = np.random.uniform(5, 60, size=n_samples)

    scheduled_section_time_min = distance_to_next_station_km / np.random.uniform(60, 95, size=n_samples) * 60.0
    scheduled_halt_min = np.random.choice([2, 5, 10, 15], size=n_samples)

    # 2. Real-time Telemetry Features
    base_speed = np.random.uniform(45, 110, size=n_samples) * train_priority_scores
    current_delay = np.random.exponential(scale=12, size=n_samples) # right-skewed realistic delay distribution

    # 3. Weather & Congestion Features
    weather_severity = np.random.beta(a=0.5, b=2.0, size=n_samples) # 0 to 1
    track_congestion_level = np.random.beta(a=0.8, b=1.5, size=n_samples) # 0 to 1

    # 4. Operational Disruptions
    has_speed_restriction = np.random.choice([0, 1], size=n_samples, p=[0.75, 0.25])
    speed_restriction_kmh = has_speed_restriction * np.random.uniform(20, 50, size=n_samples)

    signal_delay_min = np.random.exponential(scale=3, size=n_samples) * (track_congestion_level > 0.5)
    extended_halt_min = np.random.exponential(scale=2, size=n_samples)

    # Effective Speed adjustment
    current_speed = np.clip(
        base_speed - (weather_severity * 25) - (track_congestion_level * 30) - (speed_restriction_kmh * 0.4),
        a_min=10, a_max=130
    )

    # 5. Historical Trends
    hist_avg_section_speed = base_speed * np.random.uniform(0.9, 1.1, size=n_samples)
    hist_avg_section_time_min = scheduled_section_time_min * np.random.uniform(0.95, 1.25, size=n_samples)
    hist_delay_recovery_rate = np.random.uniform(-0.1, 0.4, size=n_samples) * train_priority_scores

    # 6. Temporal Features
    hour_of_day = np.random.randint(0, 24, size=n_samples)
    day_of_week = np.random.randint(0, 7, size=n_samples)

    # Target calculation: Future arrival delay in minutes at downstream station
    # Real-world physics & correlations:
    delay_delta = (
        (weather_severity * 14.0) +
        (track_congestion_level * 18.0) +
        (signal_delay_min * 1.1) +
        (extended_halt_min * 0.9) +
        (np.maximum(0, 65 - current_speed) * 0.2) -
        (hist_delay_recovery_rate * 8.0) +
        np.random.normal(loc=0.0, scale=3.0, size=n_samples)
    )

    future_arrival_delay_minutes = np.maximum(0, current_delay + delay_delta)

    df = pd.DataFrame({
        "current_speed": current_speed,
        "current_delay": current_delay,
        "distance_travelled_km": distance_travelled_km,
        "distance_remaining_km": distance_remaining_km,
        "distance_to_next_station_km": distance_to_next_station_km,
        "scheduled_section_time_min": scheduled_section_time_min,
        "scheduled_halt_min": scheduled_halt_min,
        "station_sequence_index": station_sequence_index,
        "hist_avg_section_speed": hist_avg_section_speed,
        "hist_avg_section_time_min": hist_avg_section_time_min,
        "hist_delay_recovery_rate": hist_delay_recovery_rate,
        "hour_of_day": hour_of_day,
        "day_of_week": day_of_week,
        "weather_severity": weather_severity,
        "track_congestion_level": track_congestion_level,
        "speed_restriction_kmh": speed_restriction_kmh,
        "signal_delay_min": signal_delay_min,
        "extended_halt_min": extended_halt_min,
        "train_priority_score": train_priority_scores,
        "future_arrival_delay_minutes": future_arrival_delay_minutes
    })

    return df

if __name__ == "__main__":
    df = generate_synthetic_historical_data()
    print("Generated synthetic dataset shape:", df.shape)
    print(df.head())
