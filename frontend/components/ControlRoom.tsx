'use client';

import { useState, useEffect } from 'react';
import { NetworkStatus, Train, Alert } from '@/types';
import { fetchNetworkStatus, fetchTrains, fetchAlerts, triggerSimulationEvent } from '@/services/api';
import TrainMap from '@/components/TrainMap';
import AlertPanel from '@/components/AlertPanel';
import LiveIncidentsPanel from '@/components/incidents/LiveIncidentsPanel';
import { Activity, Clock, ShieldAlert, CheckCircle, AlertTriangle, Radio, RefreshCw, X, Zap, Send } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function ControlRoom() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);
  const [loading, setLoading] = useState(true);
  const { telemetryData } = useWebSocket();

  // Employee Custom Delay & Reason Form State
  const [customDelayMinutes, setCustomDelayMinutes] = useState<string>('15');
  const [customReason, setCustomReason] = useState<string>('');
  const [customEventType, setCustomEventType] = useState<string>('TRAIN_DELAY');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [net, tData, aData] = await Promise.all([
        fetchNetworkStatus(),
        fetchTrains('', 50),
        fetchAlerts(15)
      ]);
      setNetworkStatus(net);
      setTrains(tData.trains);
      setAlerts(aData);
      if (tData.trains.length > 0) {
        setSelectedTrain(tData.trains[0]);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrain) return;

    if (!customReason.trim()) {
      alert('Please enter the employee disruption reason / remark.');
      return;
    }

    const val = parseFloat(customDelayMinutes) || 0;
    setIsSubmitting(true);
    setSubmitSuccessMsg(null);

    const res = await triggerSimulationEvent(
      selectedTrain.number,
      customEventType,
      val,
      customReason.trim()
    );

    setIsSubmitting(false);

    if (res) {
      const updatedDelay = Math.round(res.current_delay ?? 0);
      const updatedEta = res.destination_eta || selectedTrain.arrival;

      const predMethod = res.prediction_method || 'XGBOOST';
      const confidenceVal = res.confidence ? Math.round(res.confidence) : 87;

      setSubmitSuccessMsg(
        `✓ Delay updated successfully! Current delay: +${updatedDelay} min | New destination ETA: ${updatedEta} | Method: ${predMethod} (${confidenceVal}% confidence)`
      );

      // Immediately update selectedTrain state with the new delay & AI destination ETA
      setSelectedTrain((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          live_status: {
            ...prev.live_status,
            delay: res.current_delay,
            speed: res.current_speed,
            status_label: res.status_label,
            destination_eta: res.destination_eta,
            latitude: prev.live_status?.latitude || 20.5,
            longitude: prev.live_status?.longitude || 78.5,
            last_updated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            train_number: prev.number,
            train_name: prev.name,
            current_section: prev.live_status?.current_section || '',
            next_station_code: prev.live_status?.next_station_code || '',
            next_station_name: prev.live_status?.next_station_name || '',
            confidence: prev.live_status?.confidence || 87,
            prediction_method: prev.live_status?.prediction_method || 'XGBOOST',
            lower_bound_delay: prev.live_status?.lower_bound_delay || 0,
            upper_bound_delay: prev.live_status?.upper_bound_delay || 0
          }
        };
      });

      // Refresh trains table & alerts list
      const [tData, updatedAlerts] = await Promise.all([
        fetchTrains('', 50),
        fetchAlerts(15)
      ]);
      setTrains(tData.trains);
      setAlerts(updatedAlerts);

      // Clear success message after 5 seconds
      setTimeout(() => setSubmitSuccessMsg(null), 5000);
    }
  };

  const autofillPreset = (eventType: string, delay: string, defaultReason: string) => {
    setCustomEventType(eventType);
    setCustomDelayMinutes(delay);
    setCustomReason(defaultReason);
  };

  // Live status for selected train
  const selectedTrainLiveStatus = selectedTrain
    ? telemetryData[selectedTrain.number] || selectedTrain.live_status
    : null;

  // Projected live delay preview
  const currentBaseDelay = Math.round(selectedTrainLiveStatus?.delay ?? 0);
  const enteredAdditionalDelay = parseFloat(customDelayMinutes) || 0;
  const projectedTotalDelay = Math.max(0, currentBaseDelay + enteredAdditionalDelay);

  // Build live map coordinates from selected train
  const mapCoords: [number, number][] = trains.map((t) => [
    t.live_status?.latitude || 20.5,
    t.live_status?.longitude || 78.5
  ]);

  return (
    <div className="space-y-6 py-2">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#10233F] text-white p-6 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider">Live Section Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">Control Room Command Dashboard</h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-medium">
            Real-time track section monitoring, speed compliance, employee disruption logging, and live incident escalations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/15">
            <span className="text-[10px] text-[#94A3B8] font-bold uppercase block">ACTIVE TRAINS</span>
            <span className="text-xl font-extrabold text-white font-mono">{networkStatus?.active_trains_count || trains.length}</span>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/15">
            <span className="text-[10px] text-[#94A3B8] font-bold uppercase block">ON-TIME RATE</span>
            <span className="text-xl font-extrabold text-emerald-400 font-mono">
              {networkStatus && networkStatus.total_trains_network ? `${Math.round((networkStatus.ontime_trains / networkStatus.total_trains_network) * 100)}%` : '92%'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Live Map & Alert Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="rail-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base text-[#10233F] flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#00A9E8] animate-pulse" />
                <span>Live Train Positions & Railway Section Map</span>
              </h2>
              <span className="text-xs font-semibold text-[#64748B]">Showing {trains.length} active trains</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 bg-[#EEF5F9] p-3 rounded-xl border border-[#D8E3EE] text-xs font-semibold">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="text-[#10233F] font-extrabold text-sm">
                    📍 {selectedTrain ? `${selectedTrain.name} (#${selectedTrain.number}) Section` : 'Selected Train GPS Location'}
                  </span>
                </div>
                <div className="font-mono text-[#00A9E8] font-black text-xs mt-0.5 ml-4">
                  Lat {selectedTrainLiveStatus?.latitude != null ? Number(selectedTrainLiveStatus.latitude).toFixed(4) : '20.5937'}° N, Lng {selectedTrainLiveStatus?.longitude != null ? Number(selectedTrainLiveStatus.longitude).toFixed(4) : '78.9629'}° E
                </div>
              </div>
              <span className="text-xs text-[#10233F] font-mono font-black bg-white px-2.5 py-1 rounded-md border border-[#D8E3EE] self-start sm:self-center">
                Speed: {Math.round(selectedTrainLiveStatus?.speed || 75)} km/h
              </span>
            </div>

            <TrainMap
              routeCoordinates={mapCoords}
              currentPosition={
                selectedTrainLiveStatus
                  ? [selectedTrainLiveStatus.latitude, selectedTrainLiveStatus.longitude]
                  : undefined
              }
              trainName={selectedTrain?.name}
              trainNumber={selectedTrain?.number}
              hasIncident={selectedTrainLiveStatus?.status_label === 'CRITICAL DELAY'}
            />
          </div>
        </div>

        <div className="lg:col-span-4">
          <AlertPanel alerts={alerts} />
        </div>
      </div>

      {/* Live Passenger Complaints Desk Integration */}
      <LiveIncidentsPanel />

      {/* Active Trains Table */}
      <div className="rail-card p-6 bg-white border border-[#D8E3EE]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-[#10233F]">Monitored Section Trains</h2>
          <span className="text-xs font-bold text-[#64748B]">Click a train row to open Dispatch Inspector</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                <th className="p-3">Train #</th>
                <th className="p-3">Name</th>
                <th className="p-3">Route</th>
                <th className="p-3">Speed</th>
                <th className="p-3">Delay</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] font-medium text-[#10233F]">
              {trains.map((t) => {
                const live = telemetryData[t.number] || t.live_status;
                const isSelected = selectedTrain?.number === t.number;
                const delay = live?.delay || 0;

                return (
                  <tr
                    key={t.number}
                    onClick={() => {
                      setSelectedTrain(t);
                      setCustomReason('');
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#E6F7FD] font-bold' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <td className="p-3 font-mono font-bold text-[#00A9E8]">#{t.number}</td>
                    <td className="p-3 font-bold">{t.name}</td>
                    <td className="p-3 text-[#64748B]">
                      {t.from_station_code} → {t.to_station_code}
                    </td>
                    <td className="p-3 font-mono">{Math.round(live?.speed || 65)} km/h</td>
                    <td className={`p-3 font-mono font-bold ${delay > 15 ? 'text-rose-600' : 'text-[#10233F]'}`}>
                      +{Math.round(delay)}m
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        delay > 20 ? 'bg-red-100 text-red-800' : delay > 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {live?.status_label || 'ON TIME'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button className="px-2.5 py-1 bg-[#10233F] text-white font-bold rounded text-[11px]">
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Train Inspector Drawer with Custom Employee Time & Reason Form */}
      {selectedTrain && (
        <div className="rail-card p-6 bg-gradient-to-r from-white via-white to-[#E6F7FD]/30 border-2 border-[#00A9E8] space-y-5">
          <div className="flex items-center justify-between border-b border-[#D8E3EE] pb-3">
            <div>
              <span className="text-xs uppercase font-bold text-[#00A9E8] tracking-wider">DISPATCH INSPECTOR PANEL</span>
              <h3 className="text-xl font-bold text-[#10233F]">
                #{selectedTrain.number} {selectedTrain.name}
              </h3>
            </div>
            <button
              onClick={() => setSelectedTrain(null)}
              className="p-1.5 text-[#64748B] hover:text-[#10233F] rounded-lg hover:bg-[#EEF5F9]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-white p-3 rounded-xl border border-[#D8E3EE] shadow-2xs">
              <span className="text-[#64748B] font-semibold block">Route</span>
              <span className="font-bold text-sm text-[#10233F]">
                {selectedTrain.from_station_name} → {selectedTrain.to_station_name}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-[#D8E3EE] shadow-2xs">
              <span className="text-[#64748B] font-semibold block">Current Telemetry Speed</span>
              <span className="font-bold text-sm text-[#00A9E8] font-mono">
                {Math.round(selectedTrainLiveStatus?.speed || 65)} km/h
              </span>
            </div>

            <div className="bg-[#FFFBEB] p-3 rounded-xl border border-[#FDE68A] shadow-2xs">
              <span className="text-[#92400E] font-extrabold block uppercase tracking-wider text-[10px]">Current Delay</span>
              <span className="font-bold text-base text-amber-800 font-mono">
                +{Math.round(selectedTrainLiveStatus?.delay ?? 0)} min
              </span>
            </div>

            <div className="bg-[#F0F9FF] p-3 rounded-xl border border-[#BAE6FD] shadow-2xs">
              <span className="text-[#0369A1] font-extrabold block uppercase tracking-wider text-[10px]">AI Destination ETA</span>
              <span className="font-bold text-base text-[#0284C7] font-mono">
                {selectedTrainLiveStatus?.destination_eta || selectedTrain.arrival}
              </span>
            </div>
          </div>

          {/* EMPLOYEE CUSTOM DELAY TIME & REASON FORM */}
          <div className="bg-[#EEF5F9] p-5 rounded-2xl border border-[#B8E8FA] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D8E3EE] pb-3">
              <div>
                <span className="text-xs font-extrabold text-[#10233F] uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  EMPLOYEE OPERATIONAL DISRUPTION & DELAY LOG ENTRY
                </span>
                <p className="text-xs text-[#64748B] font-medium mt-0.5">
                  Enter exact delay time and operational reason directly from the controller desk.
                </p>
              </div>

              <span className="text-[11px] font-bold px-2.5 py-1 bg-white border border-[#CBD5E1] text-[#10233F] rounded-lg shrink-0">
                Train #{selectedTrain.number}
              </span>
            </div>

            {submitSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold rounded-xl flex items-center gap-2 animate-fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{submitSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Category */}
                <div>
                  <label className="block text-xs font-extrabold text-[#334155] uppercase mb-1">
                    Disruption Category
                  </label>
                  <select
                    value={customEventType}
                    onChange={(e) => setCustomEventType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-xs font-bold text-[#10233F] focus:border-[#00A9E8] outline-none shadow-2xs"
                  >
                    <option value="TRAIN_DELAY">Train Delay (Operational Cause)</option>
                    <option value="SPEED_RESTRICTION">Speed Restriction Delay</option>
                    <option value="CONGESTION">Track Congestion Delay</option>
                    <option value="SIGNAL_DELAY">Signal Junction Delay</option>
                    <option value="UNSCHEDULED_STOP">Unscheduled Stop Delay</option>
                    <option value="DELAY_RECOVERY">Delay Recovery (-Mins)</option>
                  </select>
                </div>

                {/* 2. Custom Delay Time */}
                <div>
                  <label className="block text-xs font-extrabold text-[#334155] uppercase mb-1">
                    Delay Time (Minutes) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      value={customDelayMinutes}
                      onChange={(e) => setCustomDelayMinutes(e.target.value)}
                      placeholder="e.g. 15 or -10"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-xs font-mono font-bold text-[#10233F] focus:border-[#00A9E8] outline-none pr-12 shadow-2xs"
                      required
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs font-bold text-[#64748B]">min</span>
                  </div>
                </div>

                {/* 3. Quick Preset Buttons */}
                <div>
                  <label className="block text-xs font-extrabold text-[#334155] uppercase mb-1">
                    Quick Preset Autofill
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => autofillPreset('SPEED_RESTRICTION', '10', 'Speed restriction imposed at Kanpur curve section km 142')}
                      className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-extrabold rounded-md border border-amber-300 transition-colors"
                    >
                      +10m Speed
                    </button>
                    <button
                      type="button"
                      onClick={() => autofillPreset('CONGESTION', '15', 'Heavy track congestion at Delhi outer junction')}
                      className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-900 text-[10px] font-extrabold rounded-md border border-orange-300 transition-colors"
                    >
                      +15m Congestion
                    </button>
                    <button
                      type="button"
                      onClick={() => autofillPreset('UNSCHEDULED_STOP', '25', 'Loco engine technical inspection at platform 3')}
                      className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 text-[10px] font-extrabold rounded-md border border-rose-300 transition-colors"
                    >
                      +25m Halt
                    </button>
                    <button
                      type="button"
                      onClick={() => autofillPreset('DELAY_RECOVERY', '-8', 'High-speed priority track clearance awarded')}
                      className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-extrabold rounded-md border border-emerald-300 transition-colors"
                    >
                      -8m Recovery
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom Employee Reason Input */}
              <div>
                <label className="block text-xs font-extrabold text-[#334155] uppercase mb-1">
                  Employee Operational Disruption Reason / Remarks <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter exact operational reason from controller (e.g. Loco pilot replacement at Agra, Overhead cable repair, Track maintenance)..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-xs font-semibold text-[#10233F] focus:border-[#00A9E8] focus:ring-2 focus:ring-[#00A9E8]/20 outline-none shadow-2xs"
                  required
                />
              </div>

              {/* Live Impact Preview */}
              <div className="p-3 bg-white/80 border border-[#CBD5E1] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-[#10233F] shadow-2xs">
                <span className="text-[#475569] font-extrabold uppercase text-[11px]">Live Telemetry Calculation Preview:</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-600">Base (+{currentBaseDelay}m)</span>
                  <span className="text-slate-400">+</span>
                  <span className="text-amber-700">Added ({enteredAdditionalDelay >= 0 ? '+' : ''}{enteredAdditionalDelay}m)</span>
                  <span className="text-slate-400">=</span>
                  <span className="px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded font-black text-sm">
                    +{projectedTotalDelay} min Total Delay
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-[#CBD5E1]/60">
                <p className="text-[11px] text-[#64748B] font-medium">
                  Submitting will instantly add this delay time to the train and recalculate the AI Destination ETA across all dashboards.
                </p>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#10233F] hover:bg-[#1E3A8A] text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 shrink-0"
                >
                  <Send className="w-4 h-4 text-[#38BDF8]" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Employee Delay & Reason'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
