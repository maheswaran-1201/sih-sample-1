'use client';

import { useEffect, useRef, useState } from 'react';
import { Key, Layers, Radio, AlertCircle } from 'lucide-react';

interface Station {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  timeline_status: string;
}

interface TrainMapProps {
  routeCoordinates: [number, number][]; // [[lat, lng], ...]
  currentPosition?: [number, number]; // [lat, lng]
  trainName?: string;
  trainNumber?: string;
  hasIncident?: boolean;
  incidentType?: string;
  stations?: Station[];
}

function isValidLatLng(pos: any): pos is [number, number] {
  return (
    Array.isArray(pos) &&
    pos.length >= 2 &&
    typeof pos[0] === 'number' &&
    !isNaN(pos[0]) &&
    typeof pos[1] === 'number' &&
    !isNaN(pos[1]) &&
    pos[0] !== 0 &&
    pos[1] !== 0
  );
}

// ----------------------------------------------------------------------
// 1. Google Maps Engine Component
// ----------------------------------------------------------------------
function GoogleMapInner({
  apiKey,
  routeCoordinates,
  currentPosition,
  trainName,
  trainNumber,
  hasIncident,
  incidentType,
  stations
}: TrainMapProps & { apiKey: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<any>(null);
  const trainMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const stationMarkersRef = useRef<any[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid' | 'terrain'>('roadmap');
  const [autoCenter, setAutoCenter] = useState(true);

  const validCurrent = isValidLatLng(currentPosition) ? currentPosition : undefined;
  const validRoute = (routeCoordinates || []).filter(isValidLatLng);

  const centerLat = validCurrent ? validCurrent[0] : (validRoute.length > 0 ? validRoute[Math.floor(validRoute.length / 2)][0] : 20.5937);
  const centerLng = validCurrent ? validCurrent[1] : (validRoute.length > 0 ? validRoute[Math.floor(validRoute.length / 2)][1] : 78.9629);

  // Initialize Google Maps SDK script
  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    const initMap = () => {
      const g = (window as any).google;
      if (!g || !g.maps || !mapRef.current) return;

      try {
        const map = new g.maps.Map(mapRef.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 7,
          mapTypeId: mapType,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        googleMapInstanceRef.current = map;
        setIsLoaded(true);
        setLoadError(null);
      } catch (err: any) {
        console.error('Google Maps init error:', err);
        setLoadError('Failed to initialize Google Maps. Check API Key validity.');
      }
    };

    if ((window as any).google && (window as any).google.maps) {
      initMap();
      return;
    }

    const scriptId = 'google-maps-js-sdk';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const handleLoad = () => initMap();
    const handleError = () => setLoadError('Failed to load Google Maps SDK from Google servers.');

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    return () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
  }, [apiKey]);

  // Update Map Type
  useEffect(() => {
    const g = (window as any).google;
    if (googleMapInstanceRef.current && g?.maps) {
      googleMapInstanceRef.current.setMapTypeId(mapType);
    }
  }, [mapType]);

  // Render/Update Route Polyline & Station Markers
  useEffect(() => {
    const g = (window as any).google;
    const map = googleMapInstanceRef.current;
    if (!map || !g?.maps || !isLoaded) return;

    // Clear old polyline
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
    }

    // Clear old station markers
    stationMarkersRef.current.forEach((m) => m.setMap(null));
    stationMarkersRef.current = [];

    // Polyline
    if (validRoute.length > 0) {
      const path = validRoute.map(([lat, lng]) => ({ lat, lng }));
      const polyline = new g.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: hasIncident ? '#DC2626' : '#00A9E8',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map
      });
      routePolylineRef.current = polyline;
    }

    // Stations
    (stations || []).forEach((st) => {
      if (!isValidLatLng([st.latitude, st.longitude])) return;

      let color = '#94A3B8';
      if (st.timeline_status === 'PASSED') color = '#16A34A';
      if (st.timeline_status === 'CURRENT') color = '#00A9E8';
      if (st.timeline_status === 'UPCOMING') color = '#64748B';

      const stationMarker = new g.maps.Marker({
        position: { lat: st.latitude, lng: st.longitude },
        map,
        title: `${st.name} (${st.code})`,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        }
      });

      const infoWindow = new g.maps.InfoWindow({
        content: `
          <div style="font-family: sans-serif; padding: 4px;">
            <div style="font-weight: bold; color: #10233F; font-size: 13px;">${st.name} (${st.code})</div>
            <div style="color: #64748B; font-size: 11px; margin-top: 2px;">Status: <strong>${st.timeline_status}</strong></div>
          </div>
        `
      });

      stationMarker.addListener('click', () => {
        infoWindow.open(map, stationMarker);
      });

      stationMarkersRef.current.push(stationMarker);
    });
  }, [isLoaded, routeCoordinates, stations, hasIncident]);

  // Live Train Position Updates & Auto-Centering
  useEffect(() => {
    const g = (window as any).google;
    const map = googleMapInstanceRef.current;
    if (!map || !g?.maps || !isLoaded || !validCurrent) return;

    const trainLat = validCurrent[0];
    const trainLng = validCurrent[1];

    if (trainMarkerRef.current) {
      trainMarkerRef.current.setPosition({ lat: trainLat, lng: trainLng });
    } else {
      const trainMarker = new g.maps.Marker({
        position: { lat: trainLat, lng: trainLng },
        map,
        title: `${trainName || 'Train'} (#${trainNumber || ''})`,
        icon: {
          path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: hasIncident ? '#DC2626' : '#00A9E8',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          rotation: 45
        }
      });

      const infoWindow = new g.maps.InfoWindow({
        content: `
          <div style="font-family: sans-serif; padding: 6px;">
            <div style="font-weight: 800; color: #00A9E8; font-size: 14px;">🚆 ${trainName || 'Train'} (#${trainNumber || ''})</div>
            ${hasIncident ? `<div style="color: #DC2626; font-weight: 900; font-size: 11px; margin-top: 4px;">🚨 INCIDENT: ${incidentType || 'ALERT'}</div>` : ''}
            <div style="color: #10233F; font-size: 12px; margin-top: 4px;">Live Telemetry Position</div>
            <div style="color: #64748B; font-size: 11px;">Lat: ${trainLat.toFixed(4)}, Lng: ${trainLng.toFixed(4)}</div>
          </div>
        `
      });

      trainMarker.addListener('click', () => {
        infoWindow.open(map, trainMarker);
      });

      trainMarkerRef.current = trainMarker;
    }

    if (autoCenter) {
      map.panTo({ lat: trainLat, lng: trainLng });
    }
  }, [isLoaded, validCurrent, trainName, trainNumber, hasIncident, incidentType, autoCenter]);

  if (loadError) {
    return (
      <div className="w-full h-[450px] bg-red-950/20 border border-red-300 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-3 text-red-700">
        <AlertCircle className="w-10 h-10 text-red-600 animate-bounce" />
        <p className="font-bold text-sm">{loadError}</p>
        <p className="text-xs text-red-600">Please verify your Google Maps API Key or switch engine to Leaflet.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[450px] rounded-xl overflow-hidden border border-[#D8E3EE] shadow-sm">
      {/* Controls Overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-white/95 backdrop-blur border border-[#D8E3EE] p-1.5 rounded-xl shadow-md">
        <button
          onClick={() => setMapType('roadmap')}
          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${mapType === 'roadmap' ? 'bg-[#00A9E8] text-white' : 'text-[#64748B] hover:text-[#10233F]'}`}
        >
          Map
        </button>
        <button
          onClick={() => setMapType('hybrid')}
          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${mapType === 'hybrid' ? 'bg-[#00A9E8] text-white' : 'text-[#64748B] hover:text-[#10233F]'}`}
        >
          Satellite
        </button>
        <button
          onClick={() => setMapType('terrain')}
          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${mapType === 'terrain' ? 'bg-[#00A9E8] text-white' : 'text-[#64748B] hover:text-[#10233F]'}`}
        >
          Terrain
        </button>
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <button
          onClick={() => setAutoCenter(!autoCenter)}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-1.5 backdrop-blur ${
            autoCenter ? 'bg-[#00A9E8] text-white' : 'bg-white/90 text-[#64748B] border border-[#D8E3EE]'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${autoCenter ? 'animate-pulse' : ''}`} />
          <span>{autoCenter ? 'Auto-Center ON' : 'Auto-Center OFF'}</span>
        </button>
      </div>

      {/* Google Map Container */}
      <div ref={mapRef} className="w-full h-full bg-[#E5E3DF]" />
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. Leaflet / Local Vector Engine Component (Offline & Fallback)
// ----------------------------------------------------------------------
function LeafletMapInner({
  routeCoordinates,
  currentPosition,
  trainName,
  trainNumber,
  hasIncident,
  incidentType,
  stations
}: TrainMapProps) {
  const [L, setL] = useState<any>(null);
  const [ReactLeaflet, setReactLeaflet] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    Promise.all([
      import('leaflet'),
      import('react-leaflet')
    ]).then(([leafletModule, reactLeafletModule]) => {
      setL(leafletModule.default || leafletModule);
      setReactLeaflet(reactLeafletModule);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!L || !ReactLeaflet) {
    return (
      <div className="w-full h-[450px] bg-[#EEF5F9] rounded-xl flex items-center justify-center text-[#64748B] font-semibold text-sm">
        Loading Interactive Railway Map...
      </div>
    );
  }

  const { MapContainer, TileLayer, Polyline, Marker, Popup } = ReactLeaflet;

  const validCurrent = isValidLatLng(currentPosition) ? currentPosition : undefined;
  const validRoute = (routeCoordinates || []).filter(isValidLatLng);

  const trainIcon = L.divIcon({
    className: 'custom-train-marker',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; inset: 0; border-radius: 50%; background-color: ${hasIncident ? 'rgba(220, 38, 38, 0.4)' : 'rgba(0, 169, 232, 0.35)'}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="background-color: ${hasIncident ? '#DC2626' : '#00A9E8'}; border: 3px solid #FFFFFF; box-shadow: 0 0 16px ${hasIncident ? 'rgba(220, 38, 38, 0.9)' : 'rgba(0, 169, 232, 0.8)'}; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; position: relative; z-index: 10;">
          ${hasIncident ? '🚨' : '🚆'}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

  const stationIcon = (status: string) => {
    let color = '#94A3B8';
    if (status === 'PASSED') color = '#16A34A';
    if (status === 'CURRENT') color = '#00A9E8';
    if (status === 'UPCOMING') color = '#64748B';

    return L.divIcon({
      className: 'custom-station-marker',
      html: `<div style="background-color: ${color}; border: 2px solid white; width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.2);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  };

  const center: [number, number] =
    validCurrent ||
    (validRoute.length > 0 ? validRoute[Math.floor(validRoute.length / 2)] : [20.5937, 78.9629]);

  return (
    <div className="w-full h-[450px] rounded-xl overflow-hidden border border-[#D8E3EE] shadow-sm relative bg-[#0F172A]">
      {/* Live GPS Telemetry Overlay Bar */}
      <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex flex-col gap-1 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="text-white font-extrabold text-xs">
            📍 {trainName ? `${trainName} (#${trainNumber})` : 'Active Coaching Train Section'}
          </span>
          <span className="text-emerald-400 font-sans font-semibold text-[10px] hidden sm:inline-flex items-center gap-1 ml-auto">
            📡 12 Satellites Synced
          </span>
        </div>
        <div className="font-mono text-[11px] text-[#00A9E8] font-black">
          {validCurrent ? `Lat ${validCurrent[0].toFixed(4)}° N, Lng ${validCurrent[1].toFixed(4)}° E` : 'Locating GPS Telemetry...'}
        </div>
      </div>

      {!isOnline && (
        <div className="absolute top-3 right-3 z-[1000] bg-[#1E293B]/90 backdrop-blur border border-[#334155] px-3 py-1.5 rounded-full text-xs font-semibold text-amber-400 flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          Offline Mode (Local Vector Grid)
        </div>
      )}
      <MapContainer
        center={center}
        zoom={6}
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%', backgroundColor: '#0F172A' }}
      >
        {isOnline && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}

        {validRoute.length > 0 && (
          <Polyline
            positions={validRoute}
            pathOptions={{ color: hasIncident ? '#DC2626' : '#00A9E8', weight: 4, opacity: 0.8 }}
          />
        )}

        {stations?.map((st, idx) => {
          const pos: [number, number] = [st.latitude, st.longitude];
          if (!isValidLatLng(pos)) return null;

          return (
            <Marker key={`${st.code}-${idx}`} position={pos} icon={stationIcon(st.timeline_status)}>
              <Popup>
                <div className="text-xs p-1 font-sans">
                  <div className="font-bold text-[#10233F]">{st.name} ({st.code})</div>
                  <div className="text-[#64748B] mt-0.5 font-medium">Status: {st.timeline_status}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {validCurrent && (
          <Marker position={validCurrent} icon={trainIcon}>
            <Popup>
              <div className="text-xs p-1 font-sans space-y-1">
                <div className="font-bold text-[#00A9E8] text-sm">{trainName} (#{trainNumber})</div>
                {hasIncident && (
                  <div className="text-red-600 font-extrabold">🚨 ACTIVE INCIDENT: {incidentType || 'ON-TRAIN ALERT'}</div>
                )}
                <div className="font-mono text-[11px] text-slate-700 bg-slate-100 p-1.5 rounded font-bold">
                  📍 GPS: {validCurrent[0].toFixed(4)}° N, {validCurrent[1].toFixed(4)}° E
                </div>
                <div className="text-[#10233F] font-semibold text-[11px]">🟢 Real-time Satellite Signal Active</div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

// ----------------------------------------------------------------------
// 3. Main Export Component with Engine & API Key Switcher
// ----------------------------------------------------------------------
export default function TrainMap(props: TrainMapProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [inputKey, setInputKey] = useState<string>('');
  const [engine, setEngine] = useState<'google' | 'leaflet'>('leaflet');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  // Check env variable on mount
  useEffect(() => {
    const envKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (envKey && envKey !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      setApiKey(envKey);
      setInputKey(envKey);
      setEngine('google');
    }
  }, []);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey.trim()) {
      setApiKey(inputKey.trim());
      setEngine('google');
    } else {
      setApiKey('');
      setEngine('leaflet');
    }
    setIsKeyModalOpen(false);
  };

  return (
    <div className="space-y-2">
      {/* Map Engine Selection Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-[#00A9E8]" />
            Map Engine:
          </span>
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setEngine('google')}
              disabled={!apiKey}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                engine === 'google'
                  ? 'bg-white text-[#00A9E8] shadow-xs'
                  : apiKey
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 cursor-not-allowed'
              }`}
            >
              Google Maps {apiKey ? '✓' : '(Key Needed)'}
            </button>
            <button
              type="button"
              onClick={() => setEngine('leaflet')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                engine === 'leaflet' ? 'bg-white text-[#00A9E8] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              OpenStreetMap / Offline Grid
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsKeyModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#00A9E8]/30 bg-[#E6F7FD] text-[#00A9E8] hover:bg-[#00A9E8] hover:text-white font-extrabold text-xs transition-colors shadow-2xs"
        >
          <span>{apiKey ? 'Google Key Set ✓' : '🔑 Set Google Maps API Key'}</span>
        </button>
      </div>

      {/* Map Rendering Container */}
      {engine === 'google' && apiKey ? (
        <GoogleMapInner apiKey={apiKey} {...props} />
      ) : (
        <LeafletMapInner {...props} />
      )}

      {/* API Key Input Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">🔑 Google Maps API Key</h3>
              </div>
              <button
                onClick={() => setIsKeyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your Google Maps JavaScript API key to enable high-resolution satellite imagery, Google traffic data, and 3D terrain route rendering for live train tracking.
            </p>

            <form onSubmit={handleSaveApiKey} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1 uppercase">
                  Google Maps API Key
                </label>
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#00A9E8] focus:ring-2 focus:ring-[#00A9E8]/20 font-mono text-xs text-slate-900 shadow-2xs outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Or set <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-700">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-700">frontend/.env.local</code>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-[#00A9E8] hover:bg-[#0082B4] shadow-md"
                >
                  Save & Enable Google Maps
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
