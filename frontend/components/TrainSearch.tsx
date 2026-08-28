'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Train as TrainIcon, MapPin, ArrowRight } from 'lucide-react';
import { fetchTrains } from '@/services/api';
import { Train } from '@/types';

interface TrainSearchProps {
  onSearchSubmit?: (query: string) => void;
}

export default function TrainSearch({ onSearchSubmit }: TrainSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Train[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const data = await fetchTrains(query.trim(), 6);
      setResults(data.trains);
      setIsOpen(true);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTrain = (trainNumber: string) => {
    setIsOpen(false);
    router.push(`/train/${trainNumber}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchSubmit) {
      onSearchSubmit(query);
    }
    if (results.length > 0) {
      handleSelectTrain(results[0].number);
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-[#00A9E8]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            placeholder="Search train by number (e.g. 12627), name, or station (BPL, Bhopal)..."
            className="w-full pl-12 pr-28 py-3.5 bg-white text-[#10233F] placeholder-[#94A3B8] font-medium text-base rounded-xl border border-[#D8E3EE] shadow-sm focus:outline-none focus:border-[#00A9E8] focus:ring-2 focus:ring-[#E6F7FD] transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 px-4 py-2 bg-[#00A9E8] hover:bg-[#0082B4] text-white font-bold text-sm rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>SEARCH</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-[#D8E3EE] shadow-lg z-50 overflow-hidden max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs font-semibold text-[#64748B]">
              Searching live dataset...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-xs font-semibold text-[#64748B]">
              No trains or stations matching "{query}"
            </div>
          ) : (
            <div className="divide-y divide-[#EEF5F9]">
              {results.map((train) => (
                <div
                  key={train.number}
                  onClick={() => handleSelectTrain(train.number)}
                  className="p-3.5 hover:bg-[#E6F7FD] cursor-pointer transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#EEF5F9] text-[#00A9E8] flex items-center justify-center font-bold text-xs group-hover:bg-[#00A9E8] group-hover:text-white transition-colors">
                      <TrainIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#00A9E8] bg-[#E6F7FD] px-1.5 py-0.5 rounded">
                          #{train.number}
                        </span>
                        <span className="font-bold text-sm text-[#10233F]">{train.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-0.5">
                        <MapPin className="w-3 h-3 text-[#94A3B8]" />
                        <span>{train.from_station_name}</span>
                        <span>→</span>
                        <span>{train.to_station_name}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#00A9E8] opacity-0 group-hover:opacity-100 transition-opacity">
                    Track →
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
