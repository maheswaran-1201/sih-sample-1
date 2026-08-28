'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Clock, MapPin, RefreshCw, ArrowUpRight, Check, XCircle } from 'lucide-react';
import { fetchIncidents, acknowledgeIncident, escalateIncident, resolveIncident } from '@/services/api';
import { Incident } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function LiveIncidentsPanel() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const { isConnected } = useWebSocket();

  const loadIncidents = async () => {
    setLoading(true);
    const data = await fetchIncidents();
    setIncidents(data);
    if (data.length > 0 && !selectedIncident) {
      setSelectedIncident(data[0]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (incidentId: string) => {
    await acknowledgeIncident(incidentId);
    loadIncidents();
  };

  const handleEscalate = async (incidentId: string) => {
    await escalateIncident(incidentId);
    loadIncidents();
  };

  const handleResolve = async (incidentId: string) => {
    await resolveIncident(incidentId);
    loadIncidents();
  };

  const filtered = incidents.filter((inc) => {
    if (filterSeverity === 'ALL') return true;
    return inc.severity === filterSeverity;
  });

  const criticalCount = incidents.filter((i) => i.severity === 'EMERGENCY' && i.status !== 'RESOLVED').length;
  const urgentCount = incidents.filter((i) => i.severity === 'URGENT' && i.status !== 'RESOLVED').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED').length;

  return (
    <div className="bg-white rounded-2xl border border-[#D8E3EE] p-6 shadow-xs space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F1F5F9] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-extrabold text-[#10233F]">Live On-Train Incidents & Escalation Desk</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-red-100 text-red-800 border border-red-200">
              {criticalCount} CRITICAL ACTIVE
            </span>
          </div>
          <p className="text-xs text-[#64748B] font-medium mt-1">Real-time WebSocket incident dispatch feed for Section Controllers & Station Desks.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadIncidents}
            className="p-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#EEF5F9] text-[#10233F] transition-colors"
            title="Refresh feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-xl border border-[#E2E8F0] text-xs font-bold">
            {(['ALL', 'EMERGENCY', 'URGENT', 'NORMAL'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterSeverity === sev ? 'bg-[#10233F] text-white shadow-xs' : 'text-[#64748B] hover:text-[#10233F]'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-3 gap-4 text-center text-xs font-bold">
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900">
          <p className="text-xl font-black">{criticalCount}</p>
          <p className="text-[11px]">Active Emergency Reports</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
          <p className="text-xl font-black">{urgentCount}</p>
          <p className="text-[11px]">Active Urgent Alerts</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
          <p className="text-xl font-black">{resolvedCount}</p>
          <p className="text-[11px]">Resolved Incidents</p>
        </div>
      </div>

      {/* Main Grid: Incident List + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Incident List (5 Cols) */}
        <div className="lg:col-span-5 space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
              No active incidents found for this filter.
            </div>
          ) : (
            filtered.map((inc) => {
              const isSelected = selectedIncident?.incident_id === inc.incident_id;
              return (
                <div
                  key={inc.incident_id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#E6F7FD] border-[#00A9E8] shadow-xs'
                      : inc.severity === 'EMERGENCY'
                      ? 'bg-red-50/50 border-red-200 hover:border-red-400'
                      : 'bg-white border-[#D8E3EE] hover:border-[#10233F]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        inc.severity === 'EMERGENCY' ? 'bg-red-600 text-white' : inc.severity === 'URGENT' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {inc.severity}
                      </span>
                      <span className="font-extrabold text-xs text-[#10233F]">{inc.train_number} ({inc.coach_number})</span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-semibold">{inc.reported_at.split(' ')[1] || inc.reported_at}</span>
                  </div>

                  <p className="text-xs font-bold text-[#10233F] mt-2 line-clamp-1">{inc.description}</p>
                  <p className="text-[11px] text-[#64748B] font-medium mt-1">Next: {inc.next_station_name} (ETA {inc.next_station_eta})</p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#EEF5F9] text-[10px] font-bold">
                    <span className="text-[#00A9E8]">{inc.incident_id}</span>
                    <span className={`px-2 py-0.5 rounded ${
                      inc.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : inc.status === 'ACKNOWLEDGED' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inc.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Inspector Panel (7 Cols) */}
        <div className="lg:col-span-7 bg-[#F8FAFC] rounded-2xl border border-[#D8E3EE] p-5 space-y-5">
          {selectedIncident ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-[#10233F]">{selectedIncident.incident_id}</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-[#10233F] text-white">
                      Train {selectedIncident.train_number} ({selectedIncident.coach_number})
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] font-medium mt-0.5">Reported at {selectedIncident.reported_at} via {selectedIncident.source} Input</p>
                </div>

                {/* Status Badge */}
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                  selectedIncident.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  STATUS: {selectedIncident.status}
                </span>
              </div>

              {/* Details List */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-[#E2E8F0]">
                  <p className="text-[#64748B] font-bold">Category</p>
                  <p className="font-extrabold text-[#10233F] mt-0.5">{selectedIncident.incident_type}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#E2E8F0]">
                  <p className="text-[#64748B] font-bold">Next Station Response Desk</p>
                  <p className="font-extrabold text-[#10233F] mt-0.5">{selectedIncident.next_station_name} ({selectedIncident.next_station_code})</p>
                </div>
              </div>

              {/* Description */}
              <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] space-y-1">
                <p className="text-xs text-[#64748B] font-bold">Passenger Description</p>
                <p className="text-xs text-[#10233F] font-medium leading-relaxed">{selectedIncident.description}</p>
              </div>

              {/* Timeline */}
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                <p className="text-xs font-extrabold text-[#10233F]">Incident Timeline & Routing Audit</p>

                <div className="space-y-1.5 text-xs font-semibold text-[#475569]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Reported by Passenger ({selectedIncident.reported_at})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Dispatched to On-Train Staff (TTE / Guard)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Dispatched to {selectedIncident.next_station_name} Response Desk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedIncident.status === 'RESOLVED' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500 animate-spin" />
                    )}
                    <span>
                      {selectedIncident.status === 'RESOLVED'
                        ? 'Incident Formally Resolved & Closed'
                        : selectedIncident.status === 'ACKNOWLEDGED'
                        ? 'Acknowledged by Section Controller'
                        : 'Awaiting Controller Acknowledgement'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-3 pt-3 border-t border-[#E2E8F0]">
                <button
                  onClick={() => handleAcknowledge(selectedIncident.incident_id)}
                  disabled={selectedIncident.status === 'RESOLVED'}
                  className="flex-1 py-2.5 bg-[#10233F] hover:bg-[#1E3A8A] disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Acknowledge</span>
                </button>

                <button
                  onClick={() => handleEscalate(selectedIncident.incident_id)}
                  disabled={selectedIncident.status === 'RESOLVED'}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Escalate</span>
                </button>

                <button
                  onClick={() => handleResolve(selectedIncident.incident_id)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Resolve</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs font-semibold text-[#64748B]">
              Select an incident from the left feed to inspect timeline & operational controls.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
