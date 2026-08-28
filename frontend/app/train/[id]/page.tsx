'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchTrainById, fetchTrainStations, fetchTrainRoute, fetchTrainPrediction, fetchIncidents } from '@/services/api';
import { Train, ScheduleItem, ETAPrediction, Incident } from '@/types';
import TrainMap from '@/components/TrainMap';
import ETATable from '@/components/ETATable';
import PredictionCard from '@/components/PredictionCard';
import ExplanationPanel from '@/components/ExplanationPanel';
import RailETAAssistant from '@/components/assistant/RailETAAssistant';
import ReportIssueModal from '@/components/incidents/ReportIssueModal';
import { ArrowLeft, Navigation, Gauge, Clock, Radio, CheckCircle2, ChevronRight, Zap, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function TrainDetailPage() {
  const params = useParams();
  const trainId = params.id as string;

  const [train, setTrain] = useState<Train | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [prediction, setPrediction] = useState<ETAPrediction | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportPrefill, setReportPrefill] = useState('');

  const { telemetryData } = useWebSocket();

  useEffect(() => {
    async function loadTrainDetails() {
      if (!trainId) return;
      setLoading(true);
      const [tData, sData, rData, pData, incData] = await Promise.all([
        fetchTrainById(trainId),
        fetchTrainStations(trainId),
        fetchTrainRoute(trainId),
        fetchTrainPrediction(trainId),
        fetchIncidents(trainId)
      ]);
      setTrain(tData);
      setSchedules(sData);
      setRouteCoords(rData);
      setPrediction(pData);
      setIncidents(incData);
      setLoading(false);
    }

    loadTrainDetails();
  }, [trainId]);


  if (loading) {
    return (
      <div className="py-12 text-center text-sm font-semibold text-[#64748B] space-y-4">
        <div className="w-12 h-12 border-4 border-[#00A9E8] border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading real-time train telemetry and route schedules...</p>
      </div>
    );
  }

  if (!train) {
    return (
      <div className="rail-card p-12 text-center my-8">
        <h2 className="text-xl font-bold text-[#10233F]">Train #{trainId} Not Found</h2>
        <p className="text-xs text-[#64748B] mt-1 mb-4">Please verify train number or return to Passenger Track.</p>
        <Link href="/passenger" className="px-4 py-2 bg-[#00A9E8] text-white text-xs font-bold rounded-lg">
          Return to Passenger Track
        </Link>
      </div>
    );
  }

  // Merge live WebSocket telemetry
  const liveStatus = telemetryData[train.number] || train.live_status;
  const currentSpeed = liveStatus?.speed || 65;
  const currentDelay = liveStatus?.delay || 12;
  const nextStationName = liveStatus?.next_station_name || train.to_station_name;
  const destEta = liveStatus?.destination_eta || train.arrival;
  const confidence = liveStatus?.confidence || 87;

  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');

  return (
    <div className="space-y-6 relative">
      {/* Navigation Back Link */}
      <div className="flex items-center justify-between">
        <Link href="/passenger" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00A9E8] hover:text-[#0082B4] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Passenger Track</span>
        </Link>

        <button
          onClick={() => setIsReportModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-xs"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Report On-Train Issue</span>
        </button>
      </div>

      {/* Active Incident Alert Banner */}
      {activeIncidents.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-200 text-red-900 space-y-2 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <h3 className="font-black text-sm text-red-900">🚨 ACTIVE ON-TRAIN INCIDENT REPORTED</h3>
            </div>
            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded bg-red-600 text-white">
              {activeIncidents[0].severity}
            </span>
          </div>
          <p className="text-xs text-red-800 font-semibold">
            {activeIncidents[0].description} (Coach {activeIncidents[0].coach_number}). Routed to On-Train Staff and {activeIncidents[0].next_station_name} Response Desk.
          </p>
        </div>
      )}

      {/* Header Summary Banner */}
      <div className="rail-card p-6 bg-white border border-[#D8E3EE] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-bold text-[#00A9E8] bg-[#E6F7FD] px-2.5 py-0.5 rounded border border-[#B8E8FA]">
              #{train.number}
            </span>
            <span className="text-xs font-extrabold text-[#64748B] uppercase">{train.type}</span>
            <span className="rail-badge-cyan px-2 py-0.5 rounded text-[11px] font-bold">
              {liveStatus?.status_label || 'SLIGHT DELAY'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#10233F]">{train.name}</h1>

          <div className="flex items-center gap-2 text-sm text-[#64748B] font-semibold mt-2">
            <span>{train.from_station_name} ({train.from_station_code})</span>
            <span className="text-[#00A9E8]">→</span>
            <span>{train.to_station_name} ({train.to_station_code})</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#E6F7FD] p-3 rounded-xl border border-[#B8E8FA] text-right">
            <span className="text-[11px] text-[#64748B] font-semibold uppercase block">DESTINATION ETA</span>
            <span className="text-2xl font-extrabold text-[#00A9E8] font-mono">{destEta}</span>
          </div>
        </div>
      </div>

      {/* Live GPS Telemetry & Satellite Location Tracker */}

      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00A9E8]/20 border border-[#00A9E8]/40 flex items-center justify-center text-[#00A9E8] font-bold text-xl shrink-0">
            📡
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">GPS SATELLITE TELEMETRY ACTIVE</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>
            {/* Location Name of the Coordinates */}
            <div className="text-lg font-extrabold text-white flex items-center gap-2">
              <span>📍 {liveStatus?.current_section ? liveStatus.current_section : `En-Route near ${nextStationName}`}</span>
            </div>
            {/* Coordinates below the Location Name */}
            <div className="font-mono text-xs font-extrabold text-[#00A9E8] mt-1 bg-slate-800/90 px-2.5 py-1 rounded-md border border-slate-700 inline-block shadow-2xs">
              Lat {liveStatus?.latitude != null ? Number(liveStatus.latitude).toFixed(4) : '20.5937'}° N, Lng {liveStatus?.longitude != null ? Number(liveStatus.longitude).toFixed(4) : '78.9629'}° E
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono font-bold bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 flex-wrap">
          <div>
            <span className="text-slate-500 uppercase text-[10px] block font-sans font-semibold">GPS SPEED</span>
            <span className="text-white text-sm font-black">{Math.round(currentSpeed)} km/h</span>
          </div>
          <div className="h-6 w-px bg-slate-700"></div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] block font-sans font-semibold">SIGNAL SYNC</span>
            <span className="text-emerald-400 text-sm font-black">12 Satellites</span>
          </div>
          <div className="h-6 w-px bg-slate-700"></div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] block font-sans font-semibold">UPDATE FEED</span>
            <span className="text-[#00A9E8] text-sm font-black">1.0s Feed</span>
          </div>
        </div>
      </div>

      {/* Real-time Status Cards Grid */}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rail-card p-4">
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold mb-1">
            <Gauge className="w-4 h-4 text-[#00A9E8]" />
            <span>CURRENT SPEED</span>
          </div>
          <span className="text-2xl font-extrabold text-[#10233F] font-mono">{Math.round(currentSpeed)} km/h</span>
        </div>

        <div className="rail-card p-4">
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold mb-1">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>CURRENT DELAY</span>
          </div>
          <span className={`text-2xl font-extrabold font-mono ${currentDelay > 15 ? 'text-rose-600' : 'text-[#10233F]'}`}>
            +{Math.round(currentDelay)} min
          </span>
        </div>

        <div className="rail-card p-4">
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold mb-1">
            <Navigation className="w-4 h-4 text-[#00A9E8]" />
            <span>NEXT STATION</span>
          </div>
          <span className="text-sm font-bold text-[#10233F] truncate block">{nextStationName}</span>
        </div>

        <div className="rail-card p-4">
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold mb-1">
            <Zap className="w-4 h-4 text-emerald-600" />
            <span>CONFIDENCE</span>
          </div>
          <span className="text-2xl font-extrabold text-emerald-700 font-mono">{Math.round(confidence)}%</span>
        </div>

        <div className="rail-card p-4">
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold mb-1">
            <Radio className="w-4 h-4 text-[#00A9E8]" />
            <span>PREDICTION METHOD</span>
          </div>
          <span className="text-xs font-extrabold text-[#00A9E8] bg-[#E6F7FD] px-2.5 py-1 rounded inline-block">
            {prediction?.prediction_method || 'XGBOOST'}
          </span>
        </div>
      </div>

      {/* AI Hero Prediction Card */}
      <PredictionCard prediction={prediction} />

      {/* Interactive Live Map */}
      <div className="rail-card p-4">
        <h3 className="font-bold text-base text-[#10233F] mb-3">Live Train Map & Section Route</h3>
        <TrainMap
          routeCoordinates={routeCoords}
          currentPosition={
            liveStatus ? [liveStatus.latitude, liveStatus.longitude] : undefined
          }
          trainName={train.name}
          trainNumber={train.number}
          stations={schedules.map((s) => ({
            code: s.station_code,
            name: s.station_name,
            latitude: s.latitude,
            longitude: s.longitude,
            timeline_status: s.timeline_status
          }))}
        />
      </div>

      {/* Visual Station Route Timeline */}
      <div className="rail-card p-6">
        <h3 className="font-bold text-base text-[#10233F] mb-4">Route Progress Timeline</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {schedules.slice(0, 8).map((st, idx) => (
            <div key={st.station_code + idx} className="flex items-center gap-2 shrink-0">
              <div
                className={`p-3 rounded-xl border text-xs font-bold ${
                  st.timeline_status === 'PASSED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : st.timeline_status === 'CURRENT'
                    ? 'bg-[#E6F7FD] text-[#00A9E8] border-[#00A9E8] shadow-xs'
                    : 'bg-white text-slate-600 border-[#D8E3EE]'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {st.timeline_status === 'PASSED' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  <span className="font-mono text-[10px] opacity-75">{st.station_code}</span>
                </div>
                <div className="truncate max-w-[100px]">{st.station_name}</div>
                <div className="text-[10px] text-[#64748B] mt-0.5 font-mono">{st.ai_predicted_eta}</div>
              </div>
              {idx < 7 && <ChevronRight className="w-4 h-4 text-[#94A3B8] shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Explainable AI SHAP Panel */}
      {prediction && (
        <ExplanationPanel
          explanations={prediction.explanations}
          predictedDelay={prediction.ai_predicted_delay}
        />
      )}

      {/* Station-by-Station ETA Comparison Table */}
      <ETATable schedules={schedules} predictionMethod={prediction?.prediction_method} />

      {/* Floating AI Voice Assistant */}
      <RailETAAssistant
        currentTrainId={train.number}
        onOpenReportModal={(prefill) => {
          if (prefill) setReportPrefill(prefill);
          setIsReportModalOpen(true);
        }}
      />

      {/* On-Train Incident Reporting Modal */}
      <ReportIssueModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        defaultTrainId={train.number}
        prefillDescription={reportPrefill}
      />
    </div>
  );
}

