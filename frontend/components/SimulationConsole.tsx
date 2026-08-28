'use client';

import { useState, useEffect } from 'react';
import { controlSimulation, triggerSimulationEvent, fetchTrains, submitIncident } from '@/services/api';
import { Train } from '@/types';
import { Play, Pause, RotateCcw, AlertTriangle, CloudRain, AlertOctagon, Zap, ShieldAlert, CheckCircle2, Clock, Send } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function SimulationConsole() {
  const [isSimRunning, setIsSimRunning] = useState(true);
  const [trains, setTrains] = useState<Train[]>([]);
  const [selectedTrainNumber, setSelectedTrainNumber] = useState<string>('12627');
  const [lastEventMsg, setLastEventMsg] = useState<string>('Simulator running in continuous mode.');
  const { telemetryData } = useWebSocket();

  // Custom Employee Disruption Form State
  const [customDelay, setCustomDelay] = useState<string>('15');
  const [customReason, setCustomReason] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('TRAIN_DELAY');

  useEffect(() => {
    async function loadTrains() {
      const data = await fetchTrains('', 15);
      setTrains(data.trains);
      if (data.trains.length > 0) {
        setSelectedTrainNumber(data.trains[0].number);
      }
    }
    loadTrains();
  }, []);

  const activeTrain = trains.find((t) => t.number === selectedTrainNumber);
  const activeStatus = telemetryData[selectedTrainNumber] || activeTrain?.live_status;

  const handleStart = async () => {
    await controlSimulation('start');
    setIsSimRunning(true);
    setLastEventMsg('Simulation started.');
  };

  const handlePause = async () => {
    await controlSimulation('pause');
    setIsSimRunning(false);
    setLastEventMsg('Simulation paused.');
  };

  const handleReset = async () => {
    await controlSimulation('reset');
    setLastEventMsg('Simulation reset to baseline state.');
  };

  const handleCustomDisruptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customReason.trim()) {
      alert('Please enter the employee disruption reason / remark.');
      return;
    }

    const val = parseFloat(customDelay) || 0;
    const res = await triggerSimulationEvent(selectedTrainNumber, customCategory, val, customReason.trim());
    if (res) {
      setLastEventMsg(`[EMPLOYEE LOG] Injected custom delay (${val >= 0 ? '+' : ''}${val}m) for Train #${selectedTrainNumber}: "${customReason.trim()}".`);
      setCustomReason('');
    }
  };

  const events = [
    { type: 'NORMAL', label: 'NORMAL RUNNING', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2, delay: '0', reason: 'Resumed normal speed' },
    { type: 'SPEED_RESTRICTION', label: 'SPEED RESTRICTION (+10m)', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: Zap, delay: '10', reason: 'Speed restriction imposed at Kanpur curve section km 142' },
    { type: 'CONGESTION', label: 'TRACK CONGESTION (+15m)', color: 'bg-orange-50 text-orange-800 border-orange-200', icon: AlertTriangle, delay: '15', reason: 'Heavy track congestion at Delhi outer junction' },
    { type: 'HEAVY_RAIN', label: 'HEAVY RAIN / MONSOON (+20m)', color: 'bg-blue-50 text-blue-800 border-blue-200', icon: CloudRain, delay: '20', reason: 'Heavy monsoon rainfall causing track visibility restrictions' },
    { type: 'SIGNAL_DELAY', label: 'SIGNAL DELAY (+10m)', color: 'bg-yellow-50 text-yellow-800 border-yellow-200', icon: Clock, delay: '10', reason: 'Held at signal junction waiting for line clearance' },
    { type: 'EXTENDED_HALT', label: 'EXTENDED HALT (+6m)', color: 'bg-slate-50 text-slate-800 border-slate-200', icon: AlertOctagon, delay: '6', reason: 'Extended station halt due to high passenger boarding volume' },
    { type: 'UNSCHEDULED_STOP', label: 'UNSCHEDULED STOP (+30m)', color: 'bg-rose-50 text-rose-800 border-rose-200', icon: ShieldAlert, delay: '30', reason: 'Loco engine technical inspection at platform 3' },
    { type: 'DELAY_RECOVERY', label: 'DELAY RECOVERY (-8m)', color: 'bg-teal-50 text-teal-800 border-teal-200', icon: Zap, delay: '-8', reason: 'High-speed priority track clearance awarded' },
  ];

  return (
    <div className="space-y-6 py-2">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-[#D8E3EE] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#10233F]">Real-Time Telemetry Simulation Console</h1>
          </div>
          <p className="text-xs text-[#64748B] font-medium">
            Simulate operational disruptions, track speed restrictions, enter employee delay logs, and monitor real-time AI ETA recalculations.
          </p>
        </div>

        {/* Global Control Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleStart}
            disabled={isSimRunning}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              isSimRunning
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>START</span>
          </button>

          <button
            onClick={handlePause}
            disabled={!isSimRunning}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              !isSimRunning
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
            }`}
          >
            <Pause className="w-4 h-4" />
            <span>PAUSE</span>
          </button>

          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-xl bg-white border border-[#D8E3EE] hover:bg-[#F8FAFC] text-[#10233F] font-extrabold text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <RotateCcw className="w-4 h-4 text-[#64748B]" />
            <span>RESET</span>
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-[#10233F] text-white p-4 rounded-xl flex items-center justify-between text-xs font-semibold">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#38BDF8]" />
          <span>SIMULATOR FEED: <strong className="text-[#38BDF8]">{lastEventMsg}</strong></span>
        </div>
        <span className="text-[11px] font-bold text-[#94A3B8]">WebSocket Status: Broadcast Active</span>
      </div>

      {/* Target Train Selection */}
      <div className="rail-card p-6">
        <label className="block text-xs font-extrabold text-[#64748B] uppercase tracking-wider mb-2">
          SELECT SIMULATION TARGET TRAIN
        </label>
        <select
          value={selectedTrainNumber}
          onChange={(e) => setSelectedTrainNumber(e.target.value)}
          className="w-full bg-[#EEF5F9] border border-[#D8E3EE] text-[#10233F] font-bold text-base rounded-xl p-3 focus:outline-none focus:border-[#00A9E8]"
        >
          {trains.map((t) => (
            <option key={t.number} value={t.number}>
              #{t.number} — {t.name} ({t.from_station_name} → {t.to_station_name})
            </option>
          ))}
        </select>
      </div>

      {/* Live Telemetry Display for Selected Train */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rail-card p-4">
          <span className="text-xs text-[#64748B] font-semibold block">Simulated Speed</span>
          <span className="text-2xl font-extrabold text-[#00A9E8] font-mono">
            {Math.round(activeStatus?.speed || 75)} km/h
          </span>
        </div>

        <div className="rail-card p-4">
          <span className="text-xs text-[#64748B] font-semibold block">Current Delay</span>
          <span className="text-2xl font-extrabold text-amber-700 font-mono">
            +{Math.round(activeStatus?.delay || 12)} min
          </span>
        </div>

        <div className="rail-card p-4">
          <span className="text-xs text-[#64748B] font-semibold block">Recalculated AI ETA</span>
          <span className="text-2xl font-extrabold text-[#10233F] font-mono">
            {activeStatus?.destination_eta || '16:45'}
          </span>
        </div>

        <div className="rail-card p-4">
          <span className="text-xs text-[#64748B] font-semibold block">Prediction Confidence</span>
          <span className="text-2xl font-extrabold text-emerald-700 font-mono">
            {Math.round(activeStatus?.confidence || 87)}%
          </span>
        </div>
      </div>

      {/* EMPLOYEE CUSTOM DELAY & REASON LOG FORM */}
      <div className="rail-card p-6 bg-gradient-to-r from-white via-white to-[#E6F7FD]/40 border-2 border-[#00A9E8] space-y-4">
        <div className="flex items-center justify-between border-b border-[#D8E3EE] pb-3">
          <div>
            <h3 className="font-extrabold text-base text-[#10233F] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Employee Custom Delay Time & Reason Logger</span>
            </h3>
            <p className="text-xs text-[#64748B] font-medium mt-0.5">
              Enter custom delay minutes and operational reason directly from employee input.
            </p>
          </div>
        </div>

        <form onSubmit={handleCustomDisruptionSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-[#334155] uppercase mb-1">
                Disruption Category
              </label>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
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

            <div>
              <label className="block text-xs font-extrabold text-[#334155] uppercase mb-1">
                Delay Time (Minutes) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  value={customDelay}
                  onChange={(e) => setCustomDelay(e.target.value)}
                  placeholder="e.g. 15 or -10"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-xs font-mono font-bold text-[#10233F] focus:border-[#00A9E8] outline-none pr-12 shadow-2xs"
                  required
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-bold text-[#64748B]">min</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#334155] uppercase mb-1">
                Quick Preset Autofill
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {events.slice(1, 5).map((evt) => (
                  <button
                    key={evt.type}
                    type="button"
                    onClick={() => {
                      setCustomCategory(evt.type);
                      setCustomDelay(evt.delay);
                      setCustomReason(evt.reason);
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-extrabold rounded border border-slate-300 transition-colors"
                  >
                    {evt.type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#334155] uppercase mb-1">
              Employee Operational Reason / Remarks <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Enter exact operational reason (e.g. Engine overheating at Kanpur km 142, Loco pilot change)..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-xs font-semibold text-[#10233F] focus:border-[#00A9E8] focus:ring-2 focus:ring-[#00A9E8]/20 outline-none shadow-2xs"
              required
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#10233F] hover:bg-[#1E3A8A] text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4 text-[#38BDF8]" />
              <span>Submit Employee Custom Disruption</span>
            </button>
          </div>
        </form>
      </div>

      {/* Interactive Disruption Event Preset Trigger Grid */}
      <div className="rail-card p-6">
        <h3 className="font-bold text-base text-[#10233F] mb-1">Quick Preset Disruption Injectors</h3>
        <p className="text-xs text-[#64748B] font-medium mb-4">
          Click any preset to autofill the form or immediately trigger operational events.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {events.map((evt) => {
            const Icon = evt.icon;
            return (
              <button
                key={evt.type}
                onClick={() => {
                  setCustomCategory(evt.type);
                  setCustomDelay(evt.delay);
                  setCustomReason(evt.reason);
                }}
                className={`p-3.5 rounded-xl border text-left font-bold text-xs transition-all hover:scale-[1.02] shadow-2xs flex flex-col justify-between ${evt.color}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-white/80">FILL FORM</span>
                </div>
                <span>{evt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
