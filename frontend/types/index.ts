export interface LiveTrainStatus {
  latitude: number;
  longitude: number;
  speed: number;
  delay: number;
  current_section: string;
  next_station_code: string;
  next_station_name: string;
  destination_eta: string;
  prediction_method: string;
  confidence: number;
  lower_bound_delay?: number;
  upper_bound_delay?: number;
  status_label: string;
  last_updated: string;
}

export interface Train {
  number: string;
  name: string;
  type: string;
  zone: string;
  from_station_code: string;
  from_station_name: string;
  to_station_code: string;
  to_station_name: string;
  departure: string;
  arrival: string;
  duration_h: number;
  duration_m: number;
  distance: number;
  classes?: string;
  live_status?: LiveTrainStatus | null;
}

export interface ScheduleItem {
  sequence: number;
  station_code: string;
  station_name: string;
  state?: string;
  latitude: number;
  longitude: number;
  scheduled_arrival: string;
  scheduled_departure: string;
  day: number;
  distance_km: number;
  baseline_eta: string;
  ai_predicted_eta: string;
  predicted_delay: number;
  confidence: number;
  timeline_status: 'PASSED' | 'CURRENT' | 'UPCOMING' | 'DESTINATION';
}

export interface FeatureContribution {
  feature_key: string;
  display_name: string;
  impact_minutes: number;
  direction: 'positive' | 'negative';
  description: string;
}

export interface ETAPrediction {
  train_number: string;
  train_name: string;
  next_station_code: string;
  next_station_name: string;
  scheduled_arrival: string;
  baseline_eta: string;
  baseline_delay: number;
  ai_predicted_eta: string;
  ai_predicted_delay: number;
  prediction_range: string;
  confidence_percentage: number;
  lower_bound_minutes: number;
  upper_bound_minutes: number;
  prediction_method: string;
  explanations: FeatureContribution[];
}

export interface Alert {
  id?: number;
  train_number: string;
  train_name: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  alert_type: string;
  message: string;
  timestamp: string;
}

export interface NetworkStatus {
  active_trains_count: number;
  total_trains_network: number;
  delayed_trains: number;
  ontime_trains: number;
  average_network_delay_min: number;
  critical_alerts_count: number;
  system_status: string;
}

export interface IncidentRecipient {
  id?: number;
  incident_id: string;
  recipient_type: 'ON_TRAIN_STAFF' | 'NEXT_STATION' | 'CONTROL_ROOM';
  recipient_name: string;
  delivery_status: 'SENT' | 'DELIVERED' | 'ACKNOWLEDGED' | 'RESOLVED';
  sent_at: string;
  acknowledged_at?: string;
}

export interface Incident {
  id: number;
  incident_id: string;
  train_number: string;
  train_name: string;
  coach_number: string;
  seat_number?: string;
  incident_type: string;
  description: string;
  severity: 'EMERGENCY' | 'URGENT' | 'NORMAL';
  latitude: number;
  longitude: number;
  current_section?: string;
  current_station?: string;
  next_station_code?: string;
  next_station_name?: string;
  next_station_eta?: string;
  reported_at: string;
  status: 'REPORTED' | 'VALIDATED' | 'ALERT_SENT' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED';
  source: 'VOICE' | 'FORM' | 'SIMULATION';
  language: string;
  created_at: string;
  recipients?: IncidentRecipient[];
}

export interface AssistantResponse {
  intent: string;
  response_text: string;
  speech_text: string;
  train_id?: string | null;
  train_name?: string | null;
  data?: Record<string, any>;
}

