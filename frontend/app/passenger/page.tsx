'use client';

import { useState, useEffect } from 'react';
import TrainSearch from '@/components/TrainSearch';
import TrainCard from '@/components/TrainCard';
import RailETAAssistant from '@/components/assistant/RailETAAssistant';
import ReportIssueModal from '@/components/incidents/ReportIssueModal';
import { fetchTrains } from '@/services/api';
import { Train } from '@/types';
import { Sparkles, Train as TrainIcon, RefreshCw, Zap, Mic, AlertTriangle } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function PassengerTrackPage() {
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportPrefill, setReportPrefill] = useState('');
  const { telemetryData } = useWebSocket();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await fetchTrains(query, 12);
      setTrains(data.trains);
      setLoading(false);
    }
    loadData();
  }, [query]);

  // Merge live telemetry data into active trains
  const activeTrains = trains.map((t) => {
    if (telemetryData[t.number]) {
      return {
        ...t,
        live_status: {
          ...t.live_status,
          ...telemetryData[t.number]
        }
      };
    }
    return t;
  });

  return (
    <div className="space-y-8 relative">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-white via-white to-[#E6F7FD]/60 p-8 sm:p-12 rounded-2xl border border-[#D8E3EE] shadow-sm text-center overflow-hidden">
        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00A9E8]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E6F7FD] border border-[#B8E8FA] text-[#00A9E8] font-extrabold text-xs tracking-wider uppercase mb-4 shadow-2xs">
          <Sparkles className="w-4 h-4" />
          <span>DYNAMIC MACHINE LEARNING FORECASTING</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-[#10233F] tracking-tight mb-4 max-w-4xl mx-auto">
          Track Indian Railways Coaching Trains in Real-Time
        </h1>

        <p className="text-base sm:text-lg text-[#64748B] font-medium max-w-3xl mx-auto mb-6 leading-relaxed">
          RailETA AI predicts arrival times at upcoming stations using current speed, historical sectional running times, delay trends, track congestion, weather, and operational factors.
        </p>

        {/* Quick Voice & Incident Action Bar */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <button
            onClick={() => {
              const askBtn = document.querySelector('button[aria-label="Open RailETA AI Assistant"]') as HTMLButtonElement;
              if (askBtn) askBtn.click();
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00A9E8] hover:bg-[#0082B4] text-white font-extrabold text-xs shadow-md transition-all"
          >
            <Mic className="w-4 h-4" />
            <span>🎙 ASK RAILeta VOICE ASSISTANT</span>
          </button>

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>🚨 REPORT AN ON-TRAIN ISSUE</span>
          </button>
        </div>

        {/* Large Multi-field Search Box */}
        <TrainSearch onSearchSubmit={(q) => setQuery(q)} />
      </div>

      {/* Active Coaching Trains Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrainIcon className="w-5 h-5 text-[#00A9E8]" />
            <h2 className="text-xl font-extrabold text-[#10233F]">Active Coaching Trains</h2>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
            <Zap className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>Telemetry Active ({activeTrains.length} Trains)</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="rail-card p-6 h-64 animate-pulse bg-slate-100/60" />
            ))}
          </div>
        ) : activeTrains.length === 0 ? (
          <div className="rail-card p-12 text-center">
            <h3 className="text-base font-bold text-[#10233F]">No trains found</h3>
            <p className="text-xs text-[#64748B] mt-1">Try searching for train number like "12627" or station code like "BPL".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeTrains.map((train) => (
              <TrainCard key={train.number} train={train} />
            ))}
          </div>
        )}
      </div>

      {/* Floating AI Voice Assistant */}
      <RailETAAssistant
        onOpenReportModal={(prefill) => {
          if (prefill) setReportPrefill(prefill);
          setIsReportModalOpen(true);
        }}
      />

      {/* On-Train Incident Reporting Modal */}
      <ReportIssueModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        prefillDescription={reportPrefill}
      />
    </div>
  );
}

