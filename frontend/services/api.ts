import { Train, ScheduleItem, ETAPrediction, Alert, NetworkStatus } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function fetchTrains(query: string = '', limit: number = 20, offset: number = 0): Promise<{ total: number; trains: Train[] }> {
  try {
    const url = new URL(`${API_BASE_URL}/trains`);
    if (query) url.searchParams.append('query', query);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] fetchTrains error:', err);
    return { total: 0, trains: [] };
  }
}

export async function fetchTrainById(trainId: string): Promise<Train | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/trains/${trainId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[API] fetchTrainById error:', err);
    return null;
  }
}

export async function fetchTrainStations(trainId: string): Promise<ScheduleItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/trains/${trainId}/stations`, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('[API] fetchTrainStations error:', err);
    return [];
  }
}

export async function fetchTrainRoute(trainId: string): Promise<[number, number][]> {
  try {
    const res = await fetch(`${API_BASE_URL}/trains/${trainId}/route`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.coordinates || [];
  } catch (err) {
    console.warn('[API] fetchTrainRoute error:', err);
    return [];
  }
}

export async function fetchTrainPrediction(trainId: string): Promise<ETAPrediction | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/trains/${trainId}/prediction`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[API] fetchTrainPrediction error:', err);
    return null;
  }
}

export async function fetchNetworkStatus(): Promise<NetworkStatus | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/network/status`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[API] fetchNetworkStatus error:', err);
    return null;
  }
}

export async function fetchAlerts(limit: number = 20): Promise<Alert[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts?limit=${limit}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('[API] fetchAlerts error:', err);
    return [];
  }
}

export async function submitOperationalDelay(trainId: string, category: string, delayMinutes: number, reason: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/trains/${encodeURIComponent(trainId)}/operational-delay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, delay_minutes: delayMinutes, reason })
    });
    return await res.json();
  } catch (err) {
    console.warn('[API] submitOperationalDelay error:', err);
    return null;
  }
}

export async function triggerSimulationEvent(trainNumber: string, eventType: string, value?: number, reason?: string) {
  return submitOperationalDelay(trainNumber, eventType, value ?? 15, reason || `Simulated event (${eventType})`);
}

export async function controlSimulation(action: 'start' | 'pause' | 'reset') {
  try {
    const res = await fetch(`${API_BASE_URL}/simulation/${action}`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    console.warn('[API] controlSimulation error:', err);
    return null;
  }
}

export async function queryAssistant(message: string, language: string = 'en', trainId?: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/assistant/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, language, train_id: trainId })
    });
    return await res.json();
  } catch (err) {
    console.warn('[API] queryAssistant error:', err);
    return {
      intent: 'ERROR',
      response_text: "I'm having trouble connecting to live railway servers right now.",
      speech_text: "Connection issue. Please try again."
    };
  }
}

export async function extractIncidentFromVoice(message: string, trainId?: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/assistant/incident-extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, train_id: trainId })
    });
    return await res.json();
  } catch (err) {
    console.warn('[API] extractIncidentFromVoice error:', err);
    return null;
  }
}

export async function submitIncident(payload: any) {
  try {
    const res = await fetch(`${API_BASE_URL}/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.warn('[API] submitIncident error:', err);
    return null;
  }
}

export async function fetchIncidents(trainNumber?: string, status?: string) {
  try {
    const url = new URL(`${API_BASE_URL}/incidents`);
    if (trainNumber) url.searchParams.append('train_number', trainNumber);
    if (status) url.searchParams.append('status', status);

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('[API] fetchIncidents error:', err);
    return [];
  }
}

export async function acknowledgeIncident(incidentId: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/incidents/${incidentId}/acknowledge`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    console.warn('[API] acknowledgeIncident error:', err);
    return null;
  }
}

export async function escalateIncident(incidentId: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/incidents/${incidentId}/escalate`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    console.warn('[API] escalateIncident error:', err);
    return null;
  }
}

export async function resolveIncident(incidentId: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/incidents/${incidentId}/resolve`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    console.warn('[API] resolveIncident error:', err);
    return null;
  }
}

