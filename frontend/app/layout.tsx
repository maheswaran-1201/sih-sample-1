import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'RailETA AI — Dynamic Forecast of Expected Time of Arrival for Coaching Trains',
  description: 'Smart India Hackathon prototype for real-time Indian Railways coaching train ETA forecasting using XGBoost machine learning and telemetry simulation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F5F9FC] text-[#10233F] antialiased min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="bg-white border-t border-[#D8E3EE] py-6 text-center text-xs text-[#64748B] font-medium">
          <div className="max-w-7xl mx-auto px-4">
            <p>RailETA AI Prototype &copy; 2026 — Smart India Hackathon Demonstration Platform</p>
            <p className="text-[#94A3B8] text-[11px] mt-1">
              Demonstration uses railway data and simulated real-time telemetry. Production deployment requires authorized Indian Railways operational integration.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
