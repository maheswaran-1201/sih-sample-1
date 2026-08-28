'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Square, X, Send, Sparkles, AlertTriangle, RefreshCw, Languages, MessageSquare, Train as TrainIcon } from 'lucide-react';
import { queryAssistant } from '@/services/api';
import { AssistantResponse } from '@/types';

interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  speechText?: string;
  timestamp: string;
}

interface RailETAAssistantProps {
  currentTrainId?: string;
  onOpenReportModal?: (prefillIssue?: string) => void;
}

export default function RailETAAssistant({ currentTrainId, onOpenReportModal }: RailETAAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am RailETA Assistant. Ask me about any train status, ETA, delay reasons, or report an on-train issue.',
      speechText: 'Hello! I am RailETA Assistant. How can I help with your train journey today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Pre-load speech synthesis voices for Indian English (en-IN) / Hindi (hi-IN)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Setup Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = language === 'hi' ? 'hi-IN' : 'en-IN';

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(transcript);
          setIsListening(false);
          handleSend(transcript);
        };

        rec.onerror = () => {
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, [language]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        setIsListening(true);
        recognitionRef.current.start();
      } else {
        alert('Browser Speech Recognition is not supported on this browser. Please type your query.');
      }
    }
  };

  const formatTrainNumberForSpeech = (rawText: string): string => {
    if (!rawText) return '';
    const digitWords: Record<string, string> = {
      '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
      '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'
    };
    return rawText.replace(/#?(\b\d{4,5}\b)/g, (match, digits) => {
      return digits.split('').map((d: string) => digitWords[d] || d).join(' ');
    });
  };

  const getIndianVoice = (lang: 'en' | 'hi') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    if (lang === 'hi') {
      return voices.find((v) => v.lang.includes('hi') || v.name.toLowerCase().includes('hindi')) || null;
    }

    // Indian English voice priority (en-IN / Microsoft Heera / Ravi / Google Indian English)
    const indianVoice = voices.find(
      (v) =>
        v.lang === 'en-IN' ||
        v.lang === 'en_IN' ||
        v.name.toLowerCase().includes('india') ||
        v.name.toLowerCase().includes('heera') ||
        v.name.toLowerCase().includes('ravi') ||
        v.name.toLowerCase().includes('veena') ||
        v.name.toLowerCase().includes('neerja')
    );

    return indianVoice || voices.find((v) => v.lang.startsWith('en-IN')) || null;
  };

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && voiceEnabled) {
      window.speechSynthesis.cancel(); // stop current utterance
      const speechFormattedText = formatTrainNumberForSpeech(text);
      const utterance = new SpeechSynthesisUtterance(speechFormattedText);
      utterance.rate = speechRate;
      
      const targetLang = language === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.lang = targetLang;

      const selectedVoice = getIndianVoice(language);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleSend = async (customQuery?: string) => {
    const queryStr = customQuery || inputText;
    if (!queryStr.trim()) return;

    const userMsgId = Date.now().toString();
    const userMsg: MessageItem = {
      id: userMsgId,
      sender: 'user',
      text: queryStr,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res: AssistantResponse = await queryAssistant(queryStr, language, currentTrainId);

      const assistantMsg: MessageItem = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: res.response_text || "I don't have reliable live information for that request right now.",
        speechText: res.speech_text || res.response_text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (res.data?.action === 'OPEN_INCIDENT_FORM' && onOpenReportModal) {
        onOpenReportModal(queryStr);
      }

      if (voiceEnabled && res.speech_text) {
        speakText(res.speech_text);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'assistant',
          text: 'Sorry, I encountered an issue connecting to the railway server. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const exampleQueries = [
    'Where is train 12627?',
    'When will it reach next station?',
    'Why is my train delayed?',
    'Report an issue',
  ];

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open RailETA AI Assistant"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-full bg-[#00A9E8] hover:bg-[#0082B4] text-white font-extrabold text-sm shadow-xl hover:shadow-2xl transition-all hover:scale-105 group border-2 border-white"
      >
        <div className="relative">
          <Mic className="w-5 h-5 group-hover:animate-bounce" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-white animate-pulse" />
        </div>
        <span>Ask RailETA</span>
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
          <div className="w-full sm:w-[460px] bg-white h-full shadow-2xl flex flex-col justify-between border-l border-[#D8E3EE] relative">
            {/* Header */}
            <div className="p-4 bg-[#10233F] text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#00A9E8] text-white flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base tracking-tight">RailETA Assistant</h3>
                    <span className="text-[10px] bg-[#00A9E8]/30 text-[#38BDF8] px-2 py-0.5 rounded font-bold border border-[#00A9E8]/40">
                      ACCESSIBLE AI
                    </span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] font-medium">Voice & Text Railway Journey Companion</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Language Switcher */}
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'hi')}
                  aria-label="Select Language"
                  className="bg-white/10 text-white text-xs font-bold px-2 py-1 rounded border border-white/20 hover:bg-white/20 transition-colors"
                >
                  <option value="en" className="text-slate-900">English</option>
                  <option value="hi" className="text-slate-900">हिन्दी</option>
                </select>

                <button
                  onClick={() => {
                    stopSpeaking();
                    setIsOpen(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Accessible Audio Toolbar */}
            <div className="bg-[#E6F7FD] border-b border-[#B8E8FA] px-4 py-2 flex items-center justify-between text-xs font-semibold text-[#0082B4]">
              <div className="flex items-center gap-2">
                {isSpeaking ? (
                  <button
                    onClick={stopSpeaking}
                    className="flex items-center gap-1 bg-amber-500 text-white px-2.5 py-1 rounded-md text-xs font-bold hover:bg-amber-600 shadow-2xs"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop Voice</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const lastAssistantMsg = [...messages].reverse().find((m) => m.sender === 'assistant');
                      if (lastAssistantMsg) speakText(lastAssistantMsg.speechText || lastAssistantMsg.text);
                    }}
                    className="flex items-center gap-1 bg-[#00A9E8] text-white px-2.5 py-1 rounded-md text-xs font-bold hover:bg-[#0082B4] shadow-2xs"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Read Response</span>
                  </button>
                )}

                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`p-1 rounded border ${voiceEnabled ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-slate-100 border-slate-300 text-slate-600'}`}
                  title="Toggle Auto Voice Output"
                >
                  {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[11px] text-[#64748B]">Speed:</span>
                <select
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  aria-label="Speech Speed Rate"
                  className="bg-white border border-[#B8E8FA] text-[11px] font-bold rounded px-1 py-0.5 text-[#10233F]"
                >
                  <option value="0.8">0.8x</option>
                  <option value="1.0">1.0x</option>
                  <option value="1.2">1.2x</option>
                </select>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#00A9E8] text-white rounded-br-none shadow-xs font-medium'
                        : 'bg-white text-[#10233F] border border-[#D8E3EE] rounded-bl-none shadow-xs'
                    }`}
                  >
                    <p>{msg.text}</p>
                  </div>
                  <span className="text-[10px] text-[#94A3B8] font-semibold mt-1 px-1">{msg.timestamp}</span>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 p-3.5 bg-white rounded-2xl border border-[#D8E3EE] text-xs font-semibold text-[#00A9E8] w-fit animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Fetching live railway data...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Prompt Pills */}
            <div className="bg-white border-t border-[#EEF5F9] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Example Questions</span>
                {onOpenReportModal && (
                  <button
                    onClick={() => onOpenReportModal()}
                    className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded border border-red-200"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Report Issue</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {exampleQueries.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (q === 'Report an issue' && onOpenReportModal) {
                        onOpenReportModal();
                      } else {
                        handleSend(q);
                      }
                    }}
                    className="text-xs font-semibold bg-[#F1F5F9] hover:bg-[#E6F7FD] hover:text-[#00A9E8] text-[#475569] px-2.5 py-1 rounded-full border border-[#E2E8F0] transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-white border-t border-[#D8E3EE] space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                {/* Voice Mic Button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  aria-label={isListening ? "Stop Speech Listening" : "Start Voice Input"}
                  className={`p-3 rounded-xl text-white font-bold transition-all shadow-xs ${
                    isListening ? 'bg-red-500 animate-pulse ring-4 ring-red-200' : 'bg-[#10233F] hover:bg-[#1E3A8A]'
                  }`}
                  title={isListening ? 'Listening... Speak now' : 'Click to speak'}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isListening ? 'Listening to your voice...' : 'Type train number, name, or station...'}
                  className="flex-1 bg-[#F8FAFC] border border-[#D8E3EE] rounded-xl px-4 py-3 text-sm text-[#10233F] focus:outline-none focus:border-[#00A9E8] font-medium"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || loading}
                  aria-label="Send Query"
                  className="p-3 bg-[#00A9E8] hover:bg-[#0082B4] disabled:opacity-50 text-white rounded-xl font-bold shadow-xs transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>

              {isListening && (
                <div className="text-center text-xs text-red-600 font-bold animate-pulse flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span>Listening... Speak your train query now</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
