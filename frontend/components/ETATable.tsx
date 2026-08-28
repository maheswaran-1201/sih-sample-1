'use client';

import { ScheduleItem } from '@/types';
import { CheckCircle2, Clock, MapPin, Zap } from 'lucide-react';

interface ETATableProps {
  schedules: ScheduleItem[];
  predictionMethod?: string;
}

export default function ETATable({ schedules, predictionMethod = 'XGBOOST' }: ETATableProps) {
  if (!schedules || schedules.length === 0) {
    return (
      <div className="rail-card p-6 text-center text-sm font-semibold text-[#64748B]">
        No schedule data available for this train.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASSED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            PASSED
          </span>
        );
      case 'CURRENT':
        return (
          <span className="inline-flex items-center gap-1 bg-[#E6F7FD] text-[#00A9E8] border border-[#B8E8FA] px-2.5 py-0.5 rounded-full text-xs font-bold animate-pulse">
            <MapPin className="w-3 h-3 text-[#00A9E8]" />
            CURRENT
          </span>
        );
      case 'DESTINATION':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
            DESTINATION
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
            UPCOMING
          </span>
        );
    }
  };

  return (
    <div className="rail-card overflow-hidden">
      <div className="p-4 border-b border-[#D8E3EE] bg-[#EEF5F9] flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-[#10233F]">Station-by-Station Forecast & Schedule</h3>
          <p className="text-xs text-[#64748B] font-medium">
            Comparing Scheduled timings against AI Regressor & Baseline calculations
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-[#D8E3EE] text-xs font-bold text-[#00A9E8]">
          <Zap className="w-3.5 h-3.5" />
          <span>MODEL: {predictionMethod}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-white border-b border-[#D8E3EE] text-xs font-bold uppercase tracking-wider text-[#64748B]">
              <th className="py-3 px-4">Seq</th>
              <th className="py-3 px-4">Station</th>
              <th className="py-3 px-4">Sched. Arr / Dep</th>
              <th className="py-3 px-4">Baseline ETA</th>
              <th className="py-3 px-4 text-[#00A9E8]">AI Predicted ETA</th>
              <th className="py-3 px-4">Expected Delay</th>
              <th className="py-3 px-4">Confidence</th>
              <th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF5F9] font-medium">
            {schedules.map((sch, idx) => (
              <tr
                key={sch.station_code + idx}
                className={`hover:bg-[#E6F7FD]/50 transition-colors ${
                  sch.timeline_status === 'CURRENT' ? 'bg-[#E6F7FD]/30 font-semibold' : ''
                }`}
              >
                <td className="py-3 px-4 font-mono text-xs text-[#94A3B8]">{sch.sequence + 1}</td>
                <td className="py-3 px-4">
                  <div className="font-bold text-[#10233F]">{sch.station_name}</div>
                  <div className="font-mono text-xs text-[#64748B]">{sch.station_code}</div>
                </td>
                <td className="py-3 px-4 text-xs text-[#64748B]">
                  <div>{sch.scheduled_arrival !== 'None' ? sch.scheduled_arrival : '--:--'}</div>
                  <div className="text-[11px] text-[#94A3B8]">
                    Dep: {sch.scheduled_departure !== 'None' ? sch.scheduled_departure : '--:--'}
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-[#64748B]">{sch.baseline_eta}</td>
                <td className="py-3 px-4 font-mono text-sm font-bold text-[#00A9E8]">
                  {sch.ai_predicted_eta}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`font-semibold text-xs ${
                      sch.predicted_delay > 15 ? 'text-rose-600' : 'text-[#10233F]'
                    }`}
                  >
                    +{Math.round(sch.predicted_delay)} min
                  </span>
                </td>
                <td className="py-3 px-4 text-xs font-semibold text-[#64748B]">
                  {Math.round(sch.confidence)}%
                </td>
                <td className="py-3 px-4 text-right">{getStatusBadge(sch.timeline_status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
