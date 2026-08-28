'use client';

import Link from 'next/link';
import { Train, Activity, BarChart3, Sliders, ArrowRight, Sparkles, ShieldCheck, Radio, Clock, Zap } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function Home() {
  const { isConnected } = useWebSocket();

  return (
    <div className="space-y-10 py-4">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#10233F] via-[#1A365D] to-[#0A192F] text-white p-8 sm:p-14 rounded-3xl shadow-xl overflow-hidden border border-[#1E3A8A]/40">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00A9E8]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-[#00A9E8]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00A9E8]/20 border border-[#00A9E8]/40 text-[#38BDF8] font-extrabold text-xs tracking-wider uppercase backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-[#38BDF8]" />
            <span>INDIAN RAILWAYS AI DECISION SUPPORT PLATFORM</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            RailETA AI Platform
          </h1>

          <p className="text-base sm:text-lg text-[#94A3B8] font-normal leading-relaxed">
            Dynamic Machine Learning forecast engine for Coaching Trains ETA, operational bottleneck detection, and section control simulation. Select your access portal below to continue.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[#CBD5E1] font-medium">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
              <Radio className="w-4 h-4 text-[#38BDF8]" />
              <span>Real-Time Telemetry Feed</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
              <Zap className="w-4 h-4 text-[#38BDF8]" />
              <span>XGBoost Delay Engine</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
              <ShieldCheck className="w-4 h-4 text-[#38BDF8]" />
              <span>Smart India Hackathon Prototype</span>
            </div>
          </div>
        </div>
      </div>

      {/* Portal Selection Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#10233F] tracking-tight">Select Application Portal</h2>
            <p className="text-sm text-[#64748B] font-medium">Choose between the public passenger tracking experience or official railway control tools.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E6F7FD] text-[#00A9E8] text-xs font-bold border border-[#B8E8FA]">
            <span className="w-2 h-2 rounded-full bg-[#00A9E8] animate-ping" />
            {isConnected ? 'LIVE TELEMETRY ONLINE' : 'TELEMETRY INITIALIZING'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Passenger Portal Card */}
          <div className="group bg-white rounded-2xl border border-[#D8E3EE] p-8 shadow-sm hover:shadow-xl hover:border-[#00A9E8] transition-all flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#E6F7FD] rounded-bl-full -z-0 transition-transform group-hover:scale-110" />
            
            <div className="relative z-10 space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-[#00A9E8] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Train className="w-8 h-8" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#00A9E8] uppercase tracking-wider bg-[#E6F7FD] px-2.5 py-1 rounded-md border border-[#B8E8FA]">
                    Public Access
                  </span>
                </div>
                <h3 className="text-2xl font-black text-[#10233F] mt-2 group-hover:text-[#00A9E8] transition-colors">
                  Passenger Portal
                </h3>
                <p className="text-sm text-[#64748B] font-medium mt-2 leading-relaxed">
                  Real-time train tracking, PNR/train search, live station schedule forecasts, platform numbers, and transparent AI delay explanations.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#EEF5F9] text-xs font-semibold text-[#475569]">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00A9E8]" />
                  <span>Search Trains by Name, Number, or Station</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00A9E8]" />
                  <span>Dynamic ETA & Platform Confirmation</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00A9E8]" />
                  <span>AI Delay Cause Explanation Panel</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-6 mt-6">
              <Link
                href="/passenger"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#00A9E8] hover:bg-[#0082B4] text-white font-bold text-sm shadow-md transition-all group-hover:translate-x-1"
              >
                <span>Enter Passenger Portal</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Employee & Official Portal Card */}
          <div className="group bg-white rounded-2xl border border-[#D8E3EE] p-8 shadow-sm hover:shadow-xl hover:border-[#1E3A8A] transition-all flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F1F5F9] rounded-bl-full -z-0 transition-transform group-hover:scale-110" />

            <div className="relative z-10 space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-[#10233F] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Activity className="w-8 h-8 text-[#38BDF8]" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider bg-[#F1F5F9] px-2.5 py-1 rounded-md border border-[#CBD5E1]">
                    Operational & Official Access
                  </span>
                </div>
                <h3 className="text-2xl font-black text-[#10233F] mt-2 group-hover:text-[#1E3A8A] transition-colors">
                  Employee & Official Portal
                </h3>
                <p className="text-sm text-[#64748B] font-medium mt-2 leading-relaxed">
                  Section Controller dashboard, speed compliance oversight, network delay analytics, signal holds, and real-time telemetry simulation console.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#EEF5F9] text-xs font-semibold text-[#475569]">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A]" />
                  <span>Control Room Section Monitoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A]" />
                  <span>Historical & Real-Time Delay Analytics</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A]" />
                  <span>Interactive Telemetry & Signal Simulation Console</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-6 mt-6">
              <Link
                href="/employee"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#10233F] hover:bg-[#1E3A8A] text-white font-bold text-sm shadow-md transition-all group-hover:translate-x-1"
              >
                <span>Enter Employee Portal</span>
                <ArrowRight className="w-4 h-4 text-[#38BDF8]" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* System Status Overview Bar */}
      <div className="bg-white rounded-2xl border border-[#D8E3EE] p-6 shadow-xs grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <p className="text-2xl font-extrabold text-[#10233F]">12+</p>
          <p className="text-xs text-[#64748B] font-semibold mt-0.5">Active Monitored Trains</p>
        </div>
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <p className="text-2xl font-extrabold text-[#00A9E8]">94.8%</p>
          <p className="text-xs text-[#64748B] font-semibold mt-0.5">AI Forecast Accuracy</p>
        </div>
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <p className="text-2xl font-extrabold text-emerald-600">3 Seconds</p>
          <p className="text-xs text-[#64748B] font-semibold mt-0.5">Telemetry Update Rate</p>
        </div>
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <p className="text-2xl font-extrabold text-[#1E3A8A]">4 Sections</p>
          <p className="text-xs text-[#64748B] font-semibold mt-0.5">Network Corridors</p>
        </div>
      </div>
    </div>
  );
}

