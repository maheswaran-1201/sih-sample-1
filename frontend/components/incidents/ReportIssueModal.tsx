'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, Mic, Send, ShieldAlert, CheckCircle2, RefreshCw, Radio, UserCheck, MapPin } from 'lucide-react';
import { submitIncident, extractIncidentFromVoice, fetchTrains } from '@/services/api';
import { Incident } from '@/types';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTrainId?: string;
  prefillDescription?: string;
}

export default function ReportIssueModal({ isOpen, onClose, defaultTrainId, prefillDescription }: ReportIssueModalProps) {
  const [trainNumber, setTrainNumber] = useState(defaultTrainId || '12627');
  const [coachNumber, setCoachNumber] = useState('B4');
  const [seatNumber, setSeatNumber] = useState('');
  const [incidentType, setIncidentType] = useState('MEDICAL_EMERGENCY');
  const [description, setDescription] = useState(prefillDescription || '');
  const [severity, setSeverity] = useState<'EMERGENCY' | 'URGENT' | 'NORMAL'>('EMERGENCY');
  
  const [isVoiceReporting, setIsVoiceReporting] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [step, setStep] = useState<'FORM' | 'CONFIRM' | 'SUCCESS'>('FORM');
  const [submitting, setSubmitting] = useState(false);
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    if (defaultTrainId) setTrainNumber(defaultTrainId);
    if (prefillDescription) setDescription(prefillDescription);
  }, [defaultTrainId, prefillDescription]);

  if (!isOpen) return null;

  const incidentCategories = [
    { value: 'MEDICAL_EMERGENCY', label: 'Medical Emergency', severity: 'EMERGENCY' },
    { value: 'FIRE_SMOKE', label: 'Fire / Smoke', severity: 'EMERGENCY' },
    { value: 'SECURITY_CONCERN', label: 'Security Concern / Threat', severity: 'EMERGENCY' },
    { value: 'HARASSMENT', label: 'Harassment / Safety Threat', severity: 'EMERGENCY' },
    { value: 'SUSPICIOUS_ACTIVITY', label: 'Suspicious Unattended Bag', severity: 'URGENT' },
    { value: 'ELECTRICAL_PROBLEM', label: 'Electrical Failure / Sparking', severity: 'URGENT' },
    { value: 'DOOR_PROBLEM', label: 'Door Lock Failure', severity: 'URGENT' },
    { value: 'AC_PROBLEM', label: 'Air-Conditioning Failure', severity: 'NORMAL' },
    { value: 'WATER_PROBLEM', label: 'No Water in Washroom', severity: 'NORMAL' },
    { value: 'CLEANLINESS', label: 'Washroom / Coach Cleanliness', severity: 'NORMAL' },
    { value: 'PASSENGER_ASSISTANCE', label: 'Elderly / Wheelchair Assistance', severity: 'NORMAL' },
    { value: 'OTHER_ISSUE', label: 'Other Issue', severity: 'NORMAL' },
  ];

  const handleVoiceExtract = async (text: string) => {
    setVoiceText(text);
    const extracted = await extractIncidentFromVoice(text, trainNumber);
    if (extracted) {
      if (extracted.incident_type) setIncidentType(extracted.incident_type);
      if (extracted.coach_number) setCoachNumber(extracted.coach_number);
      if (extracted.severity) setSeverity(extracted.severity as any);
      if (extracted.description) setDescription(extracted.description);
    }
  };

  const handleStartVoice = () => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => setIsVoiceReporting(true);
        rec.onresult = (e: any) => {
          const transcript = e.results[0][0].transcript;
          setIsVoiceReporting(false);
          handleVoiceExtract(transcript);
        };
        rec.onerror = () => setIsVoiceReporting(false);
        rec.onend = () => setIsVoiceReporting(false);

        rec.start();
      } else {
        alert('Browser speech recognition is not available. Please type the incident details.');
      }
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await submitIncident({
        train_number: trainNumber,
        coach_number: coachNumber,
        seat_number: seatNumber,
        incident_type: incidentType,
        description: description || `${incidentType} reported in coach ${coachNumber}`,
        severity: severity,
        source: voiceText ? 'VOICE' : 'FORM',
        language: 'en'
      });

      if (res) {
        setCreatedIncident(res);
        setStep('SUCCESS');
      }
    } catch (err) {
      alert('Error submitting incident. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-[#D8E3EE] shadow-2xl overflow-hidden relative flex flex-col">
        {/* Header */}
        <div className="bg-[#10233F] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg tracking-tight">Report On-Train Incident</h3>
                <span className="text-[10px] bg-red-500/30 text-red-300 px-2 py-0.5 rounded font-bold border border-red-400/40">
                  SIMULATED ESCALATION
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] font-medium">Route emergency alerts to train staff & section control desk</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body based on Step */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          {step === 'FORM' && (
            <div className="space-y-5">
              {/* Voice Incident Shortcut */}
              <div className="p-4 rounded-2xl bg-[#E6F7FD] border border-[#B8E8FA] flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-[#0082B4]">Report via Voice Command</p>
                  <p className="text-[11px] text-[#64748B] font-medium">Speak e.g. "There is smoke in coach B4 of train 12627"</p>
                </div>
                <button
                  type="button"
                  onClick={handleStartVoice}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 shadow-xs transition-all ${
                    isVoiceReporting ? 'bg-red-600 animate-pulse' : 'bg-[#00A9E8] hover:bg-[#0082B4]'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>{isVoiceReporting ? 'Listening...' : 'Voice Report'}</span>
                </button>
              </div>

              {/* Train & Coach Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#10233F]">Train Number / Name</label>
                  <input
                    type="text"
                    value={trainNumber}
                    onChange={(e) => setTrainNumber(e.target.value)}
                    placeholder="e.g. 12627"
                    className="w-full bg-[#F8FAFC] border border-[#D8E3EE] rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#10233F]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#10233F]">Coach Number *</label>
                  <input
                    type="text"
                    required
                    value={coachNumber}
                    onChange={(e) => setCoachNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. B4, S5, A1"
                    className="w-full bg-[#F8FAFC] border border-[#D8E3EE] rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-[#10233F]"
                  />
                </div>
              </div>

              {/* Seat & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#10233F]">Seat / Berth (Optional)</label>
                  <input
                    type="text"
                    value={seatNumber}
                    onChange={(e) => setSeatNumber(e.target.value)}
                    placeholder="e.g. 42"
                    className="w-full bg-[#F8FAFC] border border-[#D8E3EE] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#10233F]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#10233F]">Problem Category *</label>
                  <select
                    value={incidentType}
                    onChange={(e) => {
                      setIncidentType(e.target.value);
                      const cat = incidentCategories.find((c) => c.value === e.target.value);
                      if (cat) setSeverity(cat.severity as any);
                    }}
                    className="w-full bg-[#F8FAFC] border border-[#D8E3EE] rounded-xl px-3 py-2.5 text-xs font-bold text-[#10233F]"
                  >
                    {incidentCategories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Severity Selection */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-[#10233F]">Incident Severity</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['EMERGENCY', 'URGENT', 'NORMAL'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverity(sev)}
                      className={`py-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                        severity === sev
                          ? sev === 'EMERGENCY'
                            ? 'bg-red-600 text-white border-red-600 shadow-xs'
                            : sev === 'URGENT'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-[#F8FAFC] text-[#64748B] border-[#D8E3EE] hover:bg-[#EEF5F9]'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#10233F]">Problem Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue occurring inside your coach..."
                  className="w-full bg-[#F8FAFC] border border-[#D8E3EE] rounded-xl p-3 text-xs text-[#10233F] font-medium"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setStep('CONFIRM')}
                  className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span>Proceed to Confirm Incident</span>
                </button>
              </div>
            </div>
          )}

          {step === 'CONFIRM' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold space-y-1">
                <p className="font-extrabold text-amber-900">CONFIRMATION PREVIEW</p>
                <p>Please review the generated incident summary before dispatching simulated alerts.</p>
              </div>

              <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#D8E3EE] space-y-3 text-xs">
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="text-[#64748B] font-bold">Train:</span>
                  <span className="font-extrabold text-[#10233F]">{trainNumber}</span>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="text-[#64748B] font-bold">Coach & Seat:</span>
                  <span className="font-extrabold text-[#10233F]">Coach {coachNumber} {seatNumber ? `(Seat ${seatNumber})` : ''}</span>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="text-[#64748B] font-bold">Category:</span>
                  <span className="font-extrabold text-red-600">{incidentType}</span>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="text-[#64748B] font-bold">Severity:</span>
                  <span className={`font-extrabold px-2 py-0.5 rounded text-[11px] ${
                    severity === 'EMERGENCY' ? 'bg-red-100 text-red-800' : severity === 'URGENT' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {severity}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="text-[#64748B] font-bold">Simulated Recipient 1:</span>
                  <span className="font-bold text-[#10233F]">On-Train Captain / TTE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B] font-bold">Simulated Recipient 2:</span>
                  <span className="font-bold text-[#10233F]">Next Station Control Desk</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('FORM')}
                  className="w-1/3 py-3 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#10233F] font-bold text-xs rounded-xl"
                >
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-2/3 py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>DISPATCH SIMULATED ALERT</span>
                </button>
              </div>
            </div>
          )}

          {step === 'SUCCESS' && createdIncident && (
            <div className="space-y-5 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  SIMULATED ALERT DISPATCHED
                </span>
                <h4 className="text-2xl font-black text-[#10233F] mt-3">Incident Registered Successfully</h4>
                <p className="text-xs text-[#64748B] font-medium mt-1">Incident ID: <strong className="text-[#10233F]">{createdIncident.incident_id}</strong></p>
              </div>

              <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#D8E3EE] text-left text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Routed to On-Train Staff Channel: SENT</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>Routed to Next Station Desk ({createdIncident.next_station_name}): SENT</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <ShieldAlert className="w-4 h-4 text-emerald-600" />
                  <span>Control Room WebSocket Alert Broadcasted</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3.5 bg-[#10233F] hover:bg-[#1E3A8A] text-white font-extrabold text-xs rounded-xl shadow-md"
              >
                Close & Return to Journey
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
