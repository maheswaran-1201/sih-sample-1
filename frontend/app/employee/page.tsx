'use client';

import Link from 'next/link';
import { Activity, BarChart3, Sliders, ShieldAlert, AlertTriangle, ArrowRight, Zap, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import LiveIncidentsPanel from '@/components/incidents/LiveIncidentsPanel';

export default function EmployeePortalPage() {
  const { isConnected, telemetryData } = useWebSocket();
  const activeTrainsCount = Object.keys(telemetryData).length;

  const employeeModules = [
    {
      title: 'Passenger Complaints Desk',
      description: 'Live feed of grievances submitted by passengers. Acknowledge, dispatch medical/security, and resolve on-train complaints.',
      href: '#complaints',
      icon: ShieldAlert,
      badge: 'Live Passenger Feed',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
      actionText: 'View Complaints Desk',
      highlights: ['Real-Time Passenger Complaints', 'RPF & Medical Escalation', 'Coach & Station Dispatch'],
    },
    {
      title: 'Control Room Dashboard',
      description: 'Real-time section controller view, speed compliance, train movement monitoring, and emergency delay interventions.',
      href: '/control-room',
      icon: Activity,
      badge: 'Operational',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      actionText: 'Open Control Room',
      highlights: ['Section Speed Compliance', 'Live Signal Status', 'Dispatcher Hold Controls'],
    },
    {
      title: 'Delay & Bottleneck Analytics',
      description: 'Historical delay distribution, section throughput analysis, weather correlation metrics, and XGBoost AI model evaluation.',
      href: '/analytics',
      icon: BarChart3,
      badge: 'Insights',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      actionText: 'Open Analytics Dashboard',
      highlights: ['Section Delay Heatmaps', 'Feature Importance Ranks', 'Model Precision Metrics'],
    },
    {
      title: 'Telemetry Simulation Engine',
      description: 'Interactive controller simulator to inject signal stops, speed restrictions, weather alerts, and monitor live ETA adjustments.',
      href: '/simulation',
      icon: Sliders,
      badge: 'Interactive',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      actionText: 'Launch Simulator',
      highlights: ['Signal Hold Injector', 'Weather Disruption Tests', 'Speed Override Controls'],
    },
  ];

  return (
    <div className="space-y-8 py-2">
      {/* Top Banner */}
      <div className="bg-[#10233F] text-white p-6 sm:p-10 rounded-3xl border border-[#1E3A8A]/50 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#38BDF8]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#38BDF8] text-xs font-bold border border-white/15">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>OFFICIAL OPERATIONAL PORTAL</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Railway Operations & Employee Control Portal
            </h1>

            <p className="text-sm text-[#94A3B8] font-normal leading-relaxed">
              Unified command suite for Indian Railways controllers, station staff, and section managers. Receive live passenger complaints, monitor section speeds, review AI delay forecasts, and simulate network disruptions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <p className="text-xs text-[#94A3B8] font-semibold">Telemetry WebSocket</p>
                <p className="text-sm font-bold text-white">{isConnected ? 'Connected (Live)' : 'Connecting...'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl">
              <Zap className="w-4 h-4 text-[#38BDF8]" />
              <div>
                <p className="text-xs text-[#94A3B8] font-semibold">Live Signals Streamed</p>
                <p className="text-sm font-bold text-white">{activeTrainsCount > 0 ? `${activeTrainsCount} Active Feeds` : 'Simulation Ready'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controller Tools Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-[#10233F] tracking-tight">Employee Command Modules</h2>
          <span className="text-xs text-[#64748B] font-semibold">Role: Railway Employee / Section Controller</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {employeeModules.map((module) => {
            const Icon = module.icon;
            return (
              <div
                key={module.title}
                className="bg-white rounded-2xl border border-[#D8E3EE] p-6 shadow-xs hover:shadow-md hover:border-[#10233F] transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] text-[#10233F] flex items-center justify-center border border-[#E2E8F0]">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${module.badgeColor}`}>
                      {module.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-[#10233F]">{module.title}</h3>
                    <p className="text-xs text-[#64748B] font-medium mt-1.5 leading-relaxed">{module.description}</p>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-[#F1F5F9]">
                    {module.highlights.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-semibold text-[#475569]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-4">
                  <Link
                    href={module.href}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#10233F] hover:bg-[#1E3A8A] text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    <span>{module.actionText}</span>
                    <ArrowRight className="w-4 h-4 text-[#38BDF8]" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Embedded Live Passenger Complaints Section */}
      <div id="complaints" className="space-y-4 pt-4 scroll-mt-20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-[#10233F] tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <span>Passenger Complaints & Grievance Desk</span>
            </h2>
            <p className="text-xs text-[#64748B] font-medium mt-0.5">
              Incoming real-time passenger complaints submitted via Passenger View, AI Assistant, and On-Train Report Forms.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-red-50 border border-red-200 text-red-700 rounded-full">
            Live Escalation Feed
          </span>
        </div>

        <LiveIncidentsPanel />
      </div>
    </div>
  );
}
