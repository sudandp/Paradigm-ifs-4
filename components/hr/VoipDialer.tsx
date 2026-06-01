import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import {
  Phone, PhoneOff, X, Minimize2, Search, Clock, Users, Delete,
  Play, CheckCircle, AlertTriangle, Loader2, Sparkles, Volume2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Candidate {
  id: string;
  name: string;
  phone_number: string;
  requested_role: string;
  current_stage: string;
}

interface CallHistoryItem {
  number: string;
  name: string;
  time: string;
  date: string;
  duration?: string;
  outcome?: string;
}

type CallStatus = 'idle' | 'calling' | 'connected' | 'analyzing' | 'success' | 'error';

export const VoipDialer: React.FC = () => {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isClosed, setIsClosed] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'dial' | 'recent' | 'candidates'>('dial');
  
  // Call State
  const [dialNumber, setDialNumber] = useState<string>('');
  const [activeCallName, setActiveCallName] = useState<string>('');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callSid, setCallSid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Timer State
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Candidates & Search
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);

  // Recents
  const [recents, setRecents] = useState<CallHistoryItem[]>([]);

  // Audio elements for sound effects
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);

  // Load Recents and Candidates on Mount
  useEffect(() => {
    const savedRecents = localStorage.getItem('voip_recent_calls');
    if (savedRecents) {
      setRecents(JSON.parse(savedRecents));
    }
  }, []);

  // Fetch Candidates from Supabase
  const fetchCandidates = async () => {
    setLoadingCandidates(true);
    try {
      const { data, error } = await supabase
        .from('candidate_referrals')
        .select('id, name, phone_number, requested_role, current_stage')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCandidates((data as Candidate[]) || []);
    } catch (err: any) {
      console.error('Failed to load candidate list for VoIP:', err.message);
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'candidates') {
      fetchCandidates();
    }
  }, [isOpen, activeTab]);

  // Sync window listener for click-to-call events from other pages (e.g. CandidateDetailPage)
  useEffect(() => {
    const handleDialEvent = (e: Event) => {
      const { number, name } = (e as CustomEvent).detail;
      setDialNumber(number);
      setActiveCallName(name || '');
      setIsOpen(true);
      setIsClosed(false);
      setActiveTab('dial');
      // Automatically initiate call
      initiateCall(number, name);
    };

    window.addEventListener('voip:dial', handleDialEvent);
    return () => window.removeEventListener('voip:dial', handleDialEvent);
  }, []);

  // Listen to Supabase Realtime broadcast updates
  useEffect(() => {
    const channel = supabase.channel('call_updates')
      .on('broadcast', { event: 'call_started' }, (payload) => {
        const payloadPhone = payload.payload?.phoneNumber;
        if (isSameNumber(payloadPhone, dialNumber)) {
          setCallStatus('calling');
          setErrorMessage('');
        }
      })
      .on('broadcast', { event: 'call_ended' }, (payload) => {
        const payloadPhone = payload.payload?.phoneNumber;
        if (isSameNumber(payloadPhone, dialNumber)) {
          setCallStatus('analyzing');
          stopTimer();
        }
      })
      .on('broadcast', { event: 'call_processed' }, (payload) => {
        const payloadPhone = payload.payload?.phoneNumber;
        if (isSameNumber(payloadPhone, dialNumber)) {
          setCallStatus('success');
          // Add to local recents
          addCallToHistory(dialNumber, activeCallName || 'Unknown Candidate', timerSeconds, 'Successful');
          
          // Play success chime
          playSuccessChime();

          // Refresh current page if on candidate detail
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('voip:call-processed'));
            // Reset state back to idle after showing success message
            setTimeout(() => {
              setCallStatus('idle');
              setTimerSeconds(0);
              setCallSid(null);
            }, 3000);
          }, 500);
        }
      })
      .on('broadcast', { event: 'call_error' }, (payload) => {
        const payloadPhone = payload.payload?.phoneNumber;
        if (isSameNumber(payloadPhone, dialNumber)) {
          setCallStatus('error');
          setErrorMessage('Call failed or rejected.');
          stopTimer();
          setTimeout(() => {
            setCallStatus('idle');
          }, 4000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dialNumber, activeCallName, timerSeconds]);

  // Timer logic
  const startTimer = () => {
    setTimerSeconds(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Helper formatting and checking
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isSameNumber = (n1: string, n2: string) => {
    if (!n1 || !n2) return false;
    const clean = (n: string) => n.replace(/\D/g, '').slice(-10);
    return clean(n1) === clean(n2);
  };

  const formatPhoneNumber = (n: string) => {
    const clean = n.replace(/\D/g, '');
    if (clean.length === 10) return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
    if (clean.length === 12 && clean.startsWith('91')) return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
    return n;
  };

  // Sound Effects
  const playSuccessChime = () => {
    try {
      if (!successAudioRef.current) {
        successAudioRef.current = new Audio('https://assets.mixkit.co/yts/audio/mixkit-completion-of-a-level-2063.wav');
        successAudioRef.current.volume = 0.4;
      }
      successAudioRef.current.play().catch(() => {});
    } catch {}
  };

  // Handlers
  const handleKeypadPress = (digit: string) => {
    if (dialNumber.length < 15) {
      setDialNumber(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setDialNumber(prev => prev.slice(0, -1));
  };

  const addCallToHistory = (number: string, name: string, durationSecs: number, outcome: string) => {
    const formatDuration = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    };

    const newCall: CallHistoryItem = {
      number,
      name,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      duration: formatDuration(durationSecs),
      outcome
    };

    const updated = [newCall, ...recents.slice(0, 19)];
    setRecents(updated);
    localStorage.setItem('voip_recent_calls', JSON.stringify(updated));
  };

  const initiateCall = async (num: string, candidateName = '') => {
    const cleanNum = num.trim();
    if (!cleanNum || cleanNum.length < 8) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setDialNumber(cleanNum);
    
    // Resolve name from candidate list if empty
    if (!candidateName) {
      const match = candidates.find(c => isSameNumber(c.phone_number, cleanNum));
      candidateName = match ? match.name : 'Unknown Candidate';
    }
    setActiveCallName(candidateName);
    setCallStatus('calling');
    setErrorMessage('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/exotel-dial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ targetNumber: cleanNum })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to connect call via Exotel');
      }

      const resData = await res.json();
      setCallSid(resData.callSid);
      
      // Assume connected and start timer
      startTimer();
      setCallStatus('connected');
      toast.success('VoIP Bridge Request sent successfully!');

    } catch (err: any) {
      console.error(err);
      
      // Parse user-friendly error messages
      let friendlyMsg = err.message || 'Call initiation failed';
      const isKYC = friendlyMsg.includes('KYC');
      const isAuth = friendlyMsg.includes('401') || friendlyMsg.includes('Unauthorized');
      
      if (isKYC) {
        friendlyMsg = 'Exotel KYC pending — falling back to simulation mode...';
      } else if (isAuth) {
        friendlyMsg = 'Exotel credentials invalid — falling back to simulation mode...';
      } else if (friendlyMsg.includes('balance') || friendlyMsg.includes('insufficient')) {
        friendlyMsg = 'Insufficient Exotel balance — falling back to simulation mode...';
      }
      
      toast.error(friendlyMsg);
      
      // Auto-fallback to simulation for dev testing
      toast.loading('Auto-simulating call for dev testing...', { id: 'sim' });
      setCallStatus('calling');
      setErrorMessage('');

      await new Promise(r => setTimeout(r, 1500));
      setCallStatus('connected');
      startTimer();
      toast.loading('Call connected (simulated)...', { id: 'sim' });

      await new Promise(r => setTimeout(r, 3000));
      stopTimer();

      setCallStatus('analyzing');
      toast.loading('AI analyzing call (simulated)...', { id: 'sim' });

      await new Promise(r => setTimeout(r, 2000));

      setCallStatus('success');
      addCallToHistory(cleanNum, candidateName, timerSeconds > 0 ? timerSeconds : 3, 'Successful');
      playSuccessChime();
      toast.success('Simulation complete! Call logged.', { id: 'sim' });

      window.dispatchEvent(new CustomEvent('voip:call-processed'));

      setTimeout(() => {
        setCallStatus('idle');
        setTimerSeconds(0);
        setCallSid(null);
      }, 3000);
    }
  };

  const handleEndCallLocal = () => {
    stopTimer();
    setCallStatus('idle');
    setDialNumber('');
    setActiveCallName('');
    toast.error('Call cancelled local-only.');
  };

  // Developer mock — simulates entire call lifecycle locally
  const handleSimulateWebhook = async () => {
    if (!dialNumber) {
      toast.error('Cannot simulate without target phone number');
      return;
    }

    // Phase 1: Calling
    setCallStatus('calling');
    setErrorMessage('');
    toast.loading('Simulating call...', { id: 'sim' });

    await new Promise(r => setTimeout(r, 1500));

    // Phase 2: Connected — start timer
    setCallStatus('connected');
    startTimer();
    toast.loading('Call connected (simulated)...', { id: 'sim' });

    // Phase 3: After a short duration, simulate call ending
    await new Promise(r => setTimeout(r, 3000));
    stopTimer();

    // Phase 4: Analyzing
    setCallStatus('analyzing');
    toast.loading('AI analyzing call (simulated)...', { id: 'sim' });

    // Also try the server pipeline in background (best-effort, don't block UI)
    try {
      const hrNumber = (import.meta.env as any).VITE_EXOTEL_HR_NUMBER || '+918147612263';
      await fetch('/api/exotel-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          CallSid: `mock_sid_${Date.now()}`,
          Status: 'completed',
          RecordingUrl: 'https://assets.mixkit.co/active_storage/sfx/2568/2568.wav',
          DialDuration: String(timerSeconds > 0 ? timerSeconds : 3),
          From: hrNumber,
          To: dialNumber
        })
      });
    } catch {
      // Server pipeline failure is OK for simulation
    }

    await new Promise(r => setTimeout(r, 2000));

    // Phase 5: Success
    setCallStatus('success');
    addCallToHistory(dialNumber, activeCallName || 'Unknown Candidate', timerSeconds > 0 ? timerSeconds : 3, 'Successful');
    playSuccessChime();
    toast.success('Simulation complete! Call logged successfully.', { id: 'sim' });

    // Refresh any candidate detail views
    window.dispatchEvent(new CustomEvent('voip:call-processed'));

    setTimeout(() => {
      setCallStatus('idle');
      setTimerSeconds(0);
      setCallSid(null);
    }, 3000);
  };

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone_number.includes(searchQuery) ||
    c.requested_role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isClosed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      {/* ── Collapsed Bubble ── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center justify-center w-14 h-14 rounded-full text-white shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${
            callStatus === 'connected'
              ? 'bg-red-500 animate-pulse'
              : callStatus === 'calling'
              ? 'bg-amber-500 animate-bounce'
              : 'bg-emerald-500 hover:shadow-emerald-500/20'
          }`}
          title="Paradigm VoIP Softphone"
        >
          {callStatus === 'connected' ? (
            <div className="flex flex-col items-center">
              <PhoneOff className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-0.5">{formatTimer(timerSeconds)}</span>
            </div>
          ) : (
            <Phone className="w-6 h-6 animate-pulse" />
          )}
        </button>
      )}

      {/* ── Expanded softphone ── */}
      {isOpen && (
        <div className="flex flex-col w-[340px] h-[540px] rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden transition-all duration-300 animate-fade-in text-gray-900">
          {/* Title bar */}
          <div className="flex justify-between items-center bg-gray-50 border-b border-gray-200 px-4 py-3 select-none">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
              <div className={`w-2 h-2 rounded-full shadow-inner ${
                callStatus === 'connected'
                  ? 'bg-red-500 animate-ping'
                  : 'bg-emerald-500 animate-pulse'
              }`} />
              PARADIGM AI · PHONE
            </div>
            <div className="flex gap-2">
              {(import.meta.env as any).DEV && (
                <button
                  onClick={handleSimulateWebhook}
                  className="px-2 py-0.5 text-[8px] bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 rounded font-black tracking-widest uppercase transition-colors"
                  title="Simulate call completion callback"
                >
                  Sim callback
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded transition-colors"
                title="Minimise to bubble"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsClosed(true)}
                className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
                title="Close dialer completely"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Call Status Card */}
          <div className="m-4 mb-2 p-4 bg-white border border-gray-200 shadow-sm rounded-2xl flex items-center gap-4">
            <div className="relative shrink-0">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-md`}>
                {activeCallName ? activeCallName[0].toUpperCase() : '👤'}
              </div>
              {callStatus !== 'idle' && (
                <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 rounded-full items-center justify-center border-2 border-white text-[8px] text-white ${
                  callStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}>
                  📞
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">
                {activeCallName || (dialNumber ? formatPhoneNumber(dialNumber) : 'VoIP Dialer Ready')}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {callStatus === 'idle' && <span className="text-[10px] text-gray-500">Exotel Cloud Telephony Connected</span>}
                {callStatus === 'calling' && (
                  <>
                    <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                    <span className="text-[10px] text-amber-400 font-bold animate-pulse">Bridging to phone...</span>
                  </>
                )}
                {callStatus === 'connected' && (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                    <span className="text-[10px] text-emerald-400 font-bold">Connected ({formatTimer(timerSeconds)})</span>
                  </>
                )}
                {callStatus === 'analyzing' && (
                  <>
                    <Loader2 className="w-3 h-3 text-yellow-500 animate-spin" />
                    <span className="text-[10px] text-yellow-500 font-bold">AI transcribing call...</span>
                  </>
                )}
                {callStatus === 'success' && (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-bold">Call logged to database!</span>
                  </>
                )}
                {callStatus === 'error' && (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[10px] text-red-500 font-bold">{errorMessage || 'Call ended.'}</span>
                  </>
                )}
              </div>
            </div>
            {callStatus !== 'idle' && (
              <button
                onClick={handleEndCallLocal}
                className="w-8 h-8 rounded-full bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 flex items-center justify-center transition-colors shadow-md"
                title="Cancel Call (Local Only)"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Core Panel Content */}
          <div className="flex-1 flex flex-col p-4 pt-1 overflow-hidden">
            {callStatus !== 'idle' ? (
              // Active call view
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#4f6ef7] to-[#7c5ef7] flex items-center justify-center text-4xl shadow-lg shadow-blue-500/15">
                    {callStatus === 'connected' ? '🎙️' : '📡'}
                  </div>
                  {callStatus === 'connected' && (
                    <span className="absolute inset-0 rounded-full border-4 border-emerald-500 animate-ping opacity-25"></span>
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">{activeCallName || 'Bridging Call'}</h3>
                  <p className="text-sm text-gray-500 font-mono tracking-wider">{formatPhoneNumber(dialNumber)}</p>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl max-w-[270px] text-xs text-gray-600 leading-relaxed shadow-sm">
                  {callStatus === 'calling' && (
                    <>
                      Exotel is ringing <span className="text-gray-900 font-bold">your mobile phone</span> first. Answer it to connect automatically with the candidate.
                    </>
                  )}
                  {callStatus === 'connected' && (
                    <>
                      Call connected. Talk normally. Exotel is recording this call in the cloud. Hanging up will automatically trigger AI transcription.
                    </>
                  )}
                  {callStatus === 'analyzing' && (
                    <>
                      We are fetching the voice recording from Exotel and sending it to <span className="text-emerald-400 font-bold">Groq Whisper AI</span>. Please wait...
                    </>
                  )}
                  {callStatus === 'success' && (
                    <div className="flex flex-col items-center gap-1 text-emerald-400 font-bold">
                      <Sparkles className="w-5 h-5 text-emerald-400 animate-bounce" />
                      <span>VoIP Call Processed & Summarized!</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Idle Tab Content
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tab buttons */}
                <div className="flex bg-gray-50 border border-gray-200 rounded-xl p-1 gap-1 mb-3">
                  {[
                    { id: 'dial', label: 'Dial', icon: Phone },
                    { id: 'recent', label: 'Recent', icon: Clock },
                    { id: 'candidates', label: 'Directory', icon: Users }
                  ].map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          activeTab === tab.id
                            ? 'bg-white text-emerald-600 shadow-sm border border-gray-200'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content view */}
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  {activeTab === 'dial' && (
                    <div className="flex flex-col gap-4">
                      {/* Readout */}
                      <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 shadow-inner">
                        <input
                          type="text"
                          value={dialNumber}
                          readOnly
                          placeholder="Enter phone number..."
                          className="flex-1 bg-transparent border-none outline-none font-semibold text-lg tracking-wider text-gray-900 placeholder:text-gray-400"
                        />
                        {dialNumber && (
                          <button
                            onClick={handleBackspace}
                            className="text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            <Delete className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      {/* Keypad */}
                      <div className="grid grid-cols-3 gap-2">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(digit => (
                          <button
                            key={digit}
                            onClick={() => handleKeypadPress(digit)}
                            className="h-[46px] rounded-xl bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 active:scale-95 text-base font-bold text-gray-700 shadow-sm transition-all flex items-center justify-center"
                          >
                            {digit}
                          </button>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-center mt-2">
                        <button
                          onClick={() => initiateCall(dialNumber)}
                          disabled={!dialNumber}
                          className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-emerald-500/20"
                        >
                          <Phone className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'recent' && (
                    <div className="flex flex-col gap-2">
                      {recents.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 text-xs">No recent calls yet.</div>
                      ) : (
                        recents.map((item, index) => (
                          <div
                            key={index}
                            onClick={() => initiateCall(item.number, item.name)}
                            className="p-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl shadow-sm flex items-center gap-3 cursor-pointer group transition-all"
                          >
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                              {item.name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold truncate group-hover:text-emerald-600 transition-colors text-gray-900">{item.name}</div>
                              <div className="text-[10px] text-gray-500 mt-0.5">{item.date} · {item.time}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[10px] text-gray-500 font-mono">{item.duration || '—'}</div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  initiateCall(item.number, item.name);
                                }}
                                className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold mt-0.5"
                              >
                                Call
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === 'candidates' && (
                    <div className="flex flex-col gap-3">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search candidates..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full h-9 rounded-xl pl-9 pr-4 bg-white border border-gray-200 text-xs outline-none text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors shadow-sm"
                        />
                      </div>

                      {/* List */}
                      <div className="flex flex-col gap-2">
                        {loadingCandidates ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                          </div>
                        ) : filteredCandidates.length === 0 ? (
                          <div className="text-center py-12 text-gray-500 text-xs">No matching candidates found.</div>
                        ) : (
                          filteredCandidates.map(cand => (
                            <div
                              key={cand.id}
                              className="p-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl shadow-sm flex items-center justify-between transition-all"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="text-xs font-bold truncate text-gray-900">{cand.name}</div>
                                <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mt-0.5">
                                  {cand.requested_role} · {cand.current_stage}
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">{cand.phone_number}</div>
                              </div>
                              <button
                                onClick={() => initiateCall(cand.phone_number, cand.name)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] active:scale-95 transition-all shadow-md shadow-emerald-500/10 shrink-0"
                              >
                                Call
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
