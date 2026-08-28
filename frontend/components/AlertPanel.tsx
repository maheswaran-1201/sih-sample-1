'use client';

import { Alert } from '@/types';
import { AlertTriangle, AlertCircle, Info, Bell } from 'lucide-react';

interface AlertPanelProps {
  alerts: Alert[];
}

export default function AlertPanel({ alerts }: AlertPanelProps) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="rail-card p-5 text-center text-xs font-semibold text-[#64748B]">
        No active network alerts.
      </div>
    );
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="rail-badge-danger px-2 py-0.5 rounded text-[10px] font-extrabold">CRITICAL</span>;
      case 'WARNING':
        return <span className="rail-badge-warning px-2 py-0.5 rounded text-[10px] font-extrabold">WARNING</span>;
      default:
        return <span className="rail-badge-cyan px-2 py-0.5 rounded text-[10px] font-extrabold">INFO</span>;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />;
      case 'WARNING':
        return <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-[#00A9E8] shrink-0" />;
    }
  };

  return (
    <div className="rail-card overflow-hidden">
      <div className="p-3.5 bg-[#EEF5F9] border-b border-[#D8E3EE] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#00A9E8]" />
          <h3 className="font-bold text-sm text-[#10233F]">Live Operational Disruption Alerts</h3>
        </div>
        <span className="text-xs font-bold text-[#64748B]">{alerts.length} Recent</span>
      </div>

      <div className="divide-y divide-[#EEF5F9] max-h-80 overflow-y-auto">
        {alerts.map((alert, idx) => (
          <div key={alert.id || idx} className="p-3 hover:bg-[#E6F7FD]/30 transition-colors flex items-start gap-3">
            {getSeverityIcon(alert.severity)}
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#10233F]">#{alert.train_number}</span>
                  <span className="text-xs font-bold text-[#10233F]">{alert.train_name}</span>
                </div>
                <div>{getSeverityBadge(alert.severity)}</div>
              </div>
              <p className="text-xs text-[#64748B] font-medium leading-snug">{alert.message}</p>
              <span className="text-[10px] text-[#94A3B8] font-medium block mt-1">{alert.timestamp}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
