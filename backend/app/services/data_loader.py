import json
import os
import math
from sqlalchemy.orm import Session
from backend.app.models.database import (
    TrainModel, StationModel, ScheduleModel, LiveTrainStatusModel, init_db, SessionLocal
)

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def load_data_if_needed(db: Session, data_dir: str = "."):
    # Check if DB already populated
    if db.query(TrainModel).count() > 0:
        print("[DataLoader] Database already populated. Skipping load.")
        return

    print("[DataLoader] Ingesting JSON datasets into SQLite...")
    
    # 1. Load Stations
    stations_path = os.path.join(data_dir, "stations.json")
    station_coords_map = {}
    if os.path.exists(stations_path):
        with open(stations_path, "r", encoding="utf-8") as f:
            st_data = json.load(f)
            features = st_data.get("features", [])
            print(f"[DataLoader] Found {len(features)} stations in stations.json")
            station_objs = []
            seen_codes = set()
            for feat in features:
                props = feat.get("properties", {})
                code = props.get("code")
                if not code or code in seen_codes:
                    continue
                seen_codes.add(code)
                geom = feat.get("geometry") or {}
                coords = geom.get("coordinates") if geom else None
                lng, lat = (coords[0], coords[1]) if (coords and len(coords) >= 2) else (0.0, 0.0)
                station_coords_map[code] = (lat, lng)

                st_obj = StationModel(
                    code=code,
                    name=props.get("name", code),
                    state=props.get("state", ""),
                    zone=props.get("zone", ""),
                    address=props.get("address", ""),
                    latitude=lat,
                    longitude=lng
                )
                station_objs.append(st_obj)
            
            db.bulk_save_objects(station_objs)
            db.commit()
            print(f"[DataLoader] Successfully inserted {len(station_objs)} stations.")

    # 2. Load Trains
    trains_path = os.path.join(data_dir, "trains.json")
    if os.path.exists(trains_path):
        with open(trains_path, "r", encoding="utf-8") as f:
            t_data = json.load(f)
            features = t_data.get("features", [])
            print(f"[DataLoader] Found {len(features)} trains in trains.json")
            train_objs = []
            seen_numbers = set()
            for feat in features:
                props = feat.get("properties", {})
                num = props.get("number")
                if not num or num in seen_numbers:
                    continue
                seen_numbers.add(num)
                geom = feat.get("geometry") or {}
                coords = geom.get("coordinates", [])

                t_obj = TrainModel(
                    number=str(num),
                    name=props.get("name", f"Train {num}"),
                    type=props.get("type", "Exp"),
                    zone=props.get("zone", ""),
                    from_station_code=props.get("from_station_code", ""),
                    from_station_name=props.get("from_station_name", ""),
                    to_station_code=props.get("to_station_code", ""),
                    to_station_name=props.get("to_station_name", ""),
                    departure=props.get("departure", ""),
                    arrival=props.get("arrival", ""),
                    duration_h=int(props.get("duration_h") or 0),
                    duration_m=int(props.get("duration_m") or 0),
                    distance=float(props.get("distance") or 0.0),
                    classes=str(props.get("classes") or ""),
                    sleeper=int(props.get("sleeper") or 0),
                    third_ac=int(props.get("third_ac") or 0),
                    second_ac=int(props.get("second_ac") or 0),
                    first_ac=int(props.get("first_ac") or 0),
                    chair_car=int(props.get("chair_car") or 0),
                    geometry_json=json.dumps(coords)
                )
                train_objs.append(t_obj)

            db.bulk_save_objects(train_objs)
            db.commit()
            print(f"[DataLoader] Successfully inserted {len(train_objs)} trains.")

    # 3. Load Schedules
    schedules_path = os.path.join(data_dir, "schedules.json")
    if os.path.exists(schedules_path):
        with open(schedules_path, "r", encoding="utf-8") as f:
            sch_data = json.load(f)
            print(f"[DataLoader] Ingesting {len(sch_data)} schedule items...")
            
            # Group by train_number to sequence them cleanly
            schedules_by_train = {}
            for item in sch_data:
                num = str(item.get("train_number", ""))
                if not num:
                    continue
                if num not in schedules_by_train:
                    schedules_by_train[num] = []
                schedules_by_train[num].append(item)

            schedule_objs = []
            for num, items in schedules_by_train.items():
                cum_dist = 0.0
                prev_lat, prev_lng = None, None
                for idx, it in enumerate(items):
                    st_code = it.get("station_code", "")
                    curr_lat, curr_lng = station_coords_map.get(st_code, (None, None))
                    if prev_lat is not None and curr_lat is not None:
                        cum_dist += haversine_distance(prev_lat, prev_lng, curr_lat, curr_lng)
                    if curr_lat is not None:
                        prev_lat, prev_lng = curr_lat, curr_lng

                    sch_obj = ScheduleModel(
                        train_number=num,
                        train_name=it.get("train_name", ""),
                        station_code=st_code,
                        station_name=it.get("station_name", st_code),
                        arrival=str(it.get("arrival")),
                        departure=str(it.get("departure")),
                        day=int(it.get("day") or 1),
                        sequence=idx,
                        distance_km=round(cum_dist, 2)
                    )
                    schedule_objs.append(sch_obj)

            # Insert in chunks of 50,000 for SQLite performance
            chunk_size = 50000
            for i in range(0, len(schedule_objs), chunk_size):
                db.bulk_save_objects(schedule_objs[i:i + chunk_size])
                db.commit()
            print(f"[DataLoader] Successfully inserted {len(schedule_objs)} schedule records.")

    # 4. Seed LiveTrainStatus for popular active trains
    init_live_statuses(db)

def init_live_statuses(db: Session):
    popular_numbers = ["12627", "12951", "11019", "04728", "11017", "04601"]
    active_trains = db.query(TrainModel).filter(TrainModel.number.in_(popular_numbers)).all()
    if not active_trains:
        # Fallback to first 10 trains
        active_trains = db.query(TrainModel).limit(10).all()

    for train in active_trains:
        schs = db.query(ScheduleModel).filter(ScheduleModel.train_number == train.number).order_by(ScheduleModel.sequence).all()
        start_lat, start_lng = 20.0, 77.0
        next_st_code, next_st_name = "DEST", train.to_station_name
        if schs:
            first_st = db.query(StationModel).filter(StationModel.code == schs[0].station_code).first()
            if first_st and first_st.latitude != 0:
                start_lat, start_lng = first_st.latitude, first_st.longitude
            if len(schs) > 1:
                next_st_code = schs[1].station_code
                next_st_name = schs[1].station_name

        existing = db.query(LiveTrainStatusModel).filter(LiveTrainStatusModel.train_number == train.number).first()
        if not existing:
            status = LiveTrainStatusModel(
                train_number=train.number,
                train_name=train.name,
                train_type=train.type,
                latitude=start_lat,
                longitude=start_lng,
                speed=65.0,
                delay=12.0,
                current_section=f"{train.from_station_code} - {next_st_code}",
                next_station_code=next_st_code,
                next_station_name=next_st_name,
                destination_eta="16:45",
                prediction_method="XGBOOST",
                confidence=87.0,
                lower_bound_delay=8.0,
                upper_bound_delay=16.0,
                status_label="SLIGHT DELAY",
                last_updated="Just now"
            )
            db.add(status)
    db.commit()
    print("[DataLoader] Initialized live statuses for key active trains.")
