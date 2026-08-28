'use client';

import { useState, useEffect, useRef } from 'react';
import { LiveTrainStatus } from '@/types';

const getWebSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/trains`;
};

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [telemetryData, setTelemetryData] = useState<Record<string, LiveTrainStatus>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function connect() {
      try {
        const ws = new WebSocket(getWebSocketUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WebSocket] Connected to telemetry stream.');
          setIsConnected(true);
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'TELEMETRY_UPDATE' && Array.isArray(payload.data)) {
              setTelemetryData((prev) => {
                const updated = { ...prev };
                payload.data.forEach((item: any) => {
                  if (item.train_number) {
                    updated[item.train_number] = item;
                  }
                });
                return updated;
              });
            } else if (
              payload.type === 'TRAIN_STATE_UPDATED' ||
              payload.type === 'ETA_UPDATED' ||
              payload.event_type === 'TRAIN_STATE_UPDATED'
            ) {
              const trainNum = payload.train_number || payload.train_id;
              if (trainNum) {
                setTelemetryData((prev) => {
                  const existing = prev[trainNum] || {};
                  return {
                    ...prev,
                    [trainNum]: {
                      ...existing,
                      delay: payload.current_delay ?? payload.delay ?? existing.delay ?? 0,
                      destination_eta: payload.destination_eta ?? payload.new_eta ?? existing.destination_eta ?? '',
                      speed: payload.current_speed ?? payload.speed ?? existing.speed ?? 0,
                      status_label: payload.status_label ?? existing.status_label ?? 'ON TIME',
                      prediction_method: payload.prediction_method ?? existing.prediction_method ?? 'XGBOOST',
                      confidence: payload.confidence ?? existing.confidence ?? 85,
                      last_updated: payload.updated_at ?? new Date().toLocaleTimeString()
                    }
                  };
                });
              }
            }
          } catch (e) {
            console.error('[WebSocket] Message parse error:', e);
          }
        };

        ws.onclose = () => {
          console.warn('[WebSocket] Disconnected. Reconnecting in 3s...');
          setIsConnected(false);
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          console.warn('[WebSocket] Connection attempt failed or interrupted.');
          try {
            ws.close();
          } catch (_) {}
        };
      } catch (err) {
        console.warn('[WebSocket] Setup exception:', err);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return { isConnected, telemetryData };
}
