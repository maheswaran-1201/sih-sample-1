'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Train, Activity, BarChart3, Sliders, ShieldAlert, Wifi, WifiOff, Users, Briefcase, ArrowLeftRight, Home } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function Navbar() {
  const pathname = usePathname();
  const { isConnected } = useWebSocket();

  // Determine current active portal mode based on path
  const isEmployeeSide = pathname.startsWith('/employee') || 
                          pathname.startsWith('/control-room') || 
                          pathname.startsWith('/analytics') || 
                          pathname.startsWith('/simulation');

  const passengerNavItems = [
    { name: 'Passenger Track', href: '/passenger', icon: Train },
  ];

  const employeeNavItems = [
    { name: 'Employee Hub', href: '/employee', icon: Briefcase },
    { name: 'Complaints Desk', href: '/employee#complaints', icon: ShieldAlert },
    { name: 'Control Room', href: '/control-room', icon: Activity },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Simulation', href: '/simulation', icon: Sliders },
  ];

  const currentNavItems = isEmployeeSide ? employeeNavItems : passengerNavItems;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#D8E3EE] shadow-xs">
      {/* Top Banner Disclaimer */}
      <div className="bg-[#E6F7FD] border-b border-[#B8E8FA] px-4 py-1 text-xs text-[#0082B4] flex items-center justify-between font-medium">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-[#00A9E8] shrink-0" />
            <span>
              <strong>Prototype Disclaimer:</strong> Real-time telemetry demonstration. Production requires authorized Indian Railways data sources.
            </span>
          </div>

          <Link href="/" className="hover:underline flex items-center gap-1 font-bold text-[#00A9E8]">
            <Home className="w-3.5 h-3.5" />
            <span>Portal Home</span>
          </Link>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Branding */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform ${
                isEmployeeSide ? 'bg-[#10233F]' : 'bg-[#00A9E8]'
              }`}>
                {isEmployeeSide ? <Briefcase className="w-5 h-5 text-[#38BDF8]" /> : <Train className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xl tracking-tight text-[#10233F]">RailETA AI</span>
                  <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded border ${
                    isEmployeeSide 
                      ? 'bg-[#F1F5F9] text-[#1E3A8A] border-[#CBD5E1]'
                      : 'bg-[#E6F7FD] text-[#00A9E8] border-[#B8E8FA]'
                  }`}>
                    {isEmployeeSide ? 'OFFICIAL PORTAL' : 'PASSENGER VIEW'}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] font-medium hidden sm:block">
                  {isEmployeeSide ? 'Section Control & Analytics Suite' : 'Indian Railways Coaching Trains Forecast'}
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {currentNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? isEmployeeSide 
                        ? 'bg-[#10233F] text-white shadow-xs' 
                        : 'bg-[#E6F7FD] text-[#00A9E8] shadow-xs'
                      : 'text-[#64748B] hover:text-[#10233F] hover:bg-[#EEF5F9]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? (isEmployeeSide ? 'text-[#38BDF8]' : 'text-[#00A9E8]') : 'text-[#64748B]'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Section: Quick Switcher & Telemetry Status */}
          <div className="flex items-center gap-3">
            {/* Quick Switch Portal Toggle */}
            <Link
              href={isEmployeeSide ? '/passenger' : '/employee'}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold border shadow-2xs transition-all ${
                isEmployeeSide
                  ? 'bg-[#E6F7FD] text-[#00A9E8] border-[#B8E8FA] hover:bg-[#B8E8FA]/40'
                  : 'bg-[#10233F] text-white border-[#1E3A8A] hover:bg-[#1E3A8A]'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{isEmployeeSide ? 'Switch to Passenger View' : 'Switch to Employee Portal'}</span>
            </Link>

            {/* Live Telemetry WebSocket Status */}
            <div
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  <span className="hidden lg:inline">LIVE TELEMETRY</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden lg:inline">CONNECTING...</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

