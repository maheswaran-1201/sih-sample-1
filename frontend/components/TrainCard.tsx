'use client';

import Link from 'next/link';
import { Train } from '@/types';
import { Clock, Navigation, Gauge, ChevronRight } from 'lucide-react';

interface TrainCardProps {
  train: Train;
}

export default function TrainCard({ train }: TrainCardProps) {
  const status = train.live_status;
  const delay = status ? status.delay : 0;
  const speed = status ? status.speed : 65;
  const statusLabel = status ? status.status_label : 'ON TIME';
  const currentSection = status ? status.current_section : `${train.from_station_code} → ${train.to_station_code}`;

  const getStatusBadge = (label: string) => {
    switch (label) {
      case 'ON TIME':
        return <span className="rail-badge-green px-2.5 py-1 rounded-full text-xs font-bold">ON TIME</span>;
      case 'SLIGHT DELAY':
        return <span className="rail-badge-warning px-2.5 py-1 rounded-full text-xs font-bold">SLIGHT DELAY (+{Math.round(delay)}m)</span>;
      case 'DELAYED':
        return <span className="rail-badge-warning px-2.5 py-1 rounded-full text-xs font-bold">DELAYED (+{Math.round(delay)}m)</span>;
      case 'CRITICAL DELAY':
        return <span className="rail-badge-danger px-2.5 py-1 rounded-full text-xs font-bold">CRITICAL (+{Math.round(delay)}m)</span>;
      default:
        return <span className="rail-badge-cyan px-2.5 py-1 rounded-full text-xs font-bold">{label}</span>;
    }
  };

  return (
    <div className="rail-card p-5 flex flex-col justify-between hover:border-[#00A9E8] transition-all">
      <div>
        {/* Header: Train Number, Name & Type */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-[#00A9E8] bg-[#E6F7FD] px-2 py-0.5 rounded border border-[#B8E8FA]">
                #{train.number}
              </span>
              <span className="text-xs font-semibold text-[#64748B] uppercase">{train.type}</span>
            </div>
            <h3 className="font-bold text-lg text-[#10233F] mt-1 line-clamp-1 group-hover:text-[#00A9E8]">
              {train.name}
            </h3>
          </div>
          <div>{getStatusBadge(statusLabel)}</div>
        </div>

        {/* Route Info */}
        <div className="flex items-center gap-2 text-sm text-[#10233F] font-semibold mb-4 bg-[#EEF5F9] p-2.5 rounded-lg border border-[#D8E3EE]">
          <span className="truncate">{train.from_station_name}</span>
          <span className="text-[#94A3B8]">→</span>
          <span className="truncate">{train.to_station_name}</span>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-4">
          <div className="bg-white p-2 rounded-md border border-[#D8E3EE]">
            <div className="flex items-center gap-1 text-[#64748B] font-medium mb-0.5">
              <Gauge className="w-3.5 h-3.5 text-[#00A9E8]" />
              <span>Speed</span>
            </div>
            <span className="font-bold text-sm text-[#10233F]">{Math.round(speed)} km/h</span>
          </div>

          <div className="bg-white p-2 rounded-md border border-[#D8E3EE]">
            <div className="flex items-center gap-1 text-[#64748B] font-medium mb-0.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Delay</span>
            </div>
            <span className={`font-bold text-sm ${delay > 15 ? 'text-rose-600' : 'text-[#10233F]'}`}>
              +{Math.round(delay)} min
            </span>
          </div>

          <div className="bg-white p-2 rounded-md border border-[#D8E3EE]">
            <div className="flex items-center gap-1 text-[#64748B] font-medium mb-0.5">
              <Navigation className="w-3.5 h-3.5 text-[#00A9E8]" />
              <span>ETA</span>
            </div>
            <span className="font-bold text-sm text-[#00A9E8]">
              {status?.destination_eta || train.arrival || '16:45'}
            </span>
          </div>
        </div>

        {/* Section & Live GPS Info */}
        <div className="flex items-center justify-between gap-2 text-xs text-[#64748B] font-medium mb-4">
          <div className="truncate">
            <span className="text-[#94A3B8]">Section: </span>
            <span className="text-[#10233F] font-semibold">{currentSection}</span>
          </div>
          <div className="shrink-0 font-mono text-[11px] text-[#00A9E8] font-bold bg-[#E6F7FD] px-2 py-0.5 rounded border border-[#B8E8FA] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span>📍 {status?.latitude ? status.latitude.toFixed(3) : '20.594'}°, {status?.longitude ? status.longitude.toFixed(3) : '78.963'}°</span>
          </div>
        </div>
      </div>

      {/* Track Button */}
      <Link
        href={`/train/${train.number}`}
        className="w-full bg-[#E6F7FD] hover:bg-[#00A9E8] text-[#00A9E8] hover:text-white font-bold text-sm py-2.5 px-4 rounded-lg border border-[#B8E8FA] hover:border-[#00A9E8] transition-all flex items-center justify-center gap-2 group"
      >
        <span>TRACK TRAIN & VIEW ETA</span>
        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
}
