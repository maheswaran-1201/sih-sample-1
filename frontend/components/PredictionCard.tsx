'use client';

import { ETAPrediction } from '@/types';
import { Sparkles, Clock, Target, ShieldCheck, RefreshCw } from 'lucide-react';

interface PredictionCardProps {
  prediction: ETAPrediction | null;
  loading?: boolean;
}

export default function PredictionCard({ prediction, loading = false }: PredictionCardProps) {
  if (loading || !prediction) {
    return (
      <div className="rail-card p-6 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
        <div className="h-10 bg-slate-200 rounded w-1/2 mb-2" />
        <div className="h-4 bg-slate-200 rounded w-2/3" />
      </div>
    );
  }

  return (
    <div className="rail-card p-6 bg-gradient-to-br from-white via-white to-[#E6F7FD]/40 border-2 border-[#B8E8FA] relative overflow-hidden shadow-md">
      {/* Background Accent */}
      <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-[#00A9E8]/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#00A9E8] text-white flex items-center justify-center font-bold shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-[#00A9E8] tracking-wider">AI PREDICTED ETA</span>
            <h3 className="text-sm font-bold text-[#10233F]">Upcoming Station: {prediction.next_station_name}</h3>
          </div>
        </div>

        <span className="bg-[#E6F7FD] text-[#00A9E8] border border-[#B8E8FA] text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
          {prediction.prediction_method} ENGINE
        </span>
      </div>

      {/* Hero ETA Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4 items-center bg-white p-5 rounded-xl border border-[#D8E3EE] shadow-2xs">
        {/* Main Predicted Arrival */}
        <div className="md:col-span-1">
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Expected Arrival</span>
          <div className="text-4xl font-extrabold text-[#00A9E8] tracking-tight mt-1 font-mono">
            {prediction.ai_predicted_eta}
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 mt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Confidence: {prediction.confidence_percentage}%</span>
          </div>
        </div>

        {/* Expected Delay */}
        <div>
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Forecast Delay</span>
          <div className="text-2xl font-bold text-[#10233F] mt-1">
            +{Math.round(prediction.ai_predicted_delay)} min
          </div>
          <span className="text-xs text-[#94A3B8] font-medium">
            Baseline (Sched + Current): +{Math.round(prediction.baseline_delay)} min
          </span>
        </div>

        {/* Prediction Interval Range */}
        <div>
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Expected Arrival Window</span>
          <div className="text-lg font-bold text-[#10233F] mt-1 font-mono">
            {prediction.prediction_range}
          </div>
          <span className="text-xs text-[#64748B] font-medium flex items-center gap-1 mt-0.5">
            <Target className="w-3.5 h-3.5 text-[#00A9E8]" />
            <span>Residual 95% Confidence Interval</span>
          </span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-[#64748B] font-medium pt-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span>Scheduled Arrival: <strong>{prediction.scheduled_arrival}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-[#00A9E8]">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Dynamically updating telemetry</span>
        </div>
      </div>
    </div>
  );
}
