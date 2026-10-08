import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Plus, ShieldAlert, Users, Settings, ThumbsUp, ThumbsDown,
  Volume2, VolumeX, Copy, Check, Sparkles, MessageSquare, Menu,
  X, AlertTriangle, ArrowRight, BookOpen, Search, Mic, MicOff,
  ArrowLeft, PanelLeftClose, PanelLeftOpen, Phone, ExternalLink,
  ShieldCheck, HelpCircle, CheckCircle2, Clock, Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAssistStore, AssistMessage } from '../../store/assistStore';
import AssistBotAvatar from '../../components/assist/AssistBotAvatar';
import EmergencyModal from '../../components/assist/EmergencyModal';
import RosterModal from '../../components/assist/RosterModal';
import toast from 'react-hot-toast';

export const ParadigmAssistPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    conversations,
    activeConversationId,
    messages,
    sites,
    selectedSiteId,
    isLoading,
    init,
    fetchConversations,
    selectConversation,
    startNewConversation,
    setSelectedSiteId,
    sendMessage,
    sendFeedback
  } = useAssistStore();

  const [input, setInput] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [searchConv, setSearchConv] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize store on mount
  useEffect(() => {
    init();
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Adjust textarea height dynamically
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  const handleSend = async (queryToSend?: string) => {
    const q = queryToSend || input;
    if (!q.trim() || isLoading) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await sendMessage(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (text: string) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Text-to-speech not supported on this browser');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/[*#_`~>]/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/\n+/g, '. ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const siteDisplayName = selectedSite ? selectedSite.name : 'All Paradigm Sites';

  const isAdminOrMgmt = user && ['admin', 'super_admin', 'management', 'operation_manager', 'hr', 'developer'].includes(user.role);

  const quickPrompts = [
    { title: '⚡ DG Cold Start SOP', desc: 'Battery voltage, fuel level, and AMF sequence', query: 'What is the SOP and checklist to start a cold Diesel Generator (DG)?' },
    { title: '💧 STP Aeration & DO', desc: 'Dissolved oxygen, MLSS, and blower checks', query: 'What are the normal dissolved oxygen and MLSS parameters for the STP aeration tank?' },
    { title: '🛗 Lift Entrapment Rescue', desc: 'Passenger reassurance, brake release, and landing key', query: 'What is the step-by-step procedure when a passenger is trapped in the lift?' },
    { title: '👥 Who is on Duty Today?', desc: 'Site Facility Manager, Electrician & Plumber contacts', query: 'Who is the facility manager and electrician on duty today?' },
    { title: '📅 Shift & Weekly Off Rules', desc: 'Shift A, B, C timings and 14h double duty combinations', query: 'How is weekly off calculated for site staff and what are the double duty shift rules?' },
    { title: '🚨 Fire & Gas Emergency', desc: 'Manual call points, valve isolation, and L1-L3 escalation', query: 'What is the emergency escalation matrix and procedure for fire outbreak or gas leak?' },
  ];

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchConv.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* ── TOP APPLICATION HEADER ── */}
      <header className="h-16 px-4 md:px-6 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-xl flex items-center justify-between gap-3 flex-shrink-0 z-30 shadow-lg">
        {/* Left Side: Back to ERP, Brand, and Collapse Toggle */}
        <div className="flex items-center space-x-3 min-w-0">
          {/* Back to ERP / Office Button */}
          <button
            onClick={() => navigate('/verification/dashboard')}
            className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            title="Return to Paradigm Office ERP"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Office</span>
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Sidebar Toggle for Desktop */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={sidebarCollapsed ? "Expand History Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>

          {/* Mobile Drawer Toggle */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand Identity with Animated Bot Avatar */}
          <div className="flex items-center space-x-2.5 min-w-0">
            <AssistBotAvatar size="sm" isThinking={isLoading} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm md:text-base font-extrabold tracking-tight text-white">
                  Paradigm Assist
                </span>
                <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  4.0 AI Copilot
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden lg:block leading-none">
                Zero-Hallucination Operations Manual & Roster Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Center / Right Side: Site Selector, Emergency, Roster, Admin, User Profile */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          {/* Site Context Selector */}
          <div className="relative">
            <select
              value={selectedSiteId || ''}
              onChange={(e) => setSelectedSiteId(e.target.value || null)}
              className="pl-3 pr-8 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 max-w-[140px] sm:max-w-[190px] md:max-w-[230px] truncate shadow-inner cursor-pointer"
            >
              <option value="">🏢 All Paradigm Sites</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  📍 {s.name} {s.city ? `(${s.city})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Emergency Escalation Button */}
          <button
            onClick={() => setEmergencyModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-red-950/40"
            title="Emergency Escalation Matrix & SOP Protocols"
          >
            <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="hidden sm:inline">Emergency Hub</span>
          </button>

          {/* Staff Roster Button */}
          <button
            onClick={() => setRosterModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/40"
            title="Site Staff Duty Directory & Export"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Duty Roster</span>
          </button>

          {/* Knowledge Admin Portal Link (Admin / Management) */}
          {isAdminOrMgmt && (
            <button
              onClick={() => navigate('/admin/assist')}
              className="px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 text-xs font-bold hidden md:flex items-center gap-1.5 transition shadow-lg shadow-cyan-950/40"
              title="Admin Knowledge Suite & Unanswered Triage"
            >
              <BookOpen className="w-4 h-4" />
              <span>Admin Suite</span>
            </button>
          )}

          {/* User Profile Pill */}
          <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="text-left text-xs leading-tight">
              <div className="font-bold text-white truncate max-w-[110px]">{user?.name || 'Staff Member'}</div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">{user?.role || 'User'}</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN WORKSPACE (SIDEBAR + CHAT STREAM) ── */}
      <div className="flex-1 flex overflow-hidden relative bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.08),rgba(2,6,23,1))]">
        {/* ── Left Collapsible Sidebar (Chat History) ── */}
        <aside
          className={`bg-slate-900/95 border-r border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out z-20 ${
            sidebarCollapsed ? 'w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden' : 'w-72 md:w-72'
          } ${
            mobileSidebarOpen ? 'fixed inset-y-0 left-0 z-40 w-72 translate-x-0' : 'fixed md:static -translate-x-full md:translate-x-0'
          }`}
        >
          {/* Sidebar Top: New Chat */}
          <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                startNewConversation();
                setMobileSidebarOpen(false);
              }}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition"
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden p-2 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Chats Input */}
          <div className="p-2.5 border-b border-slate-800/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search history..."
                value={searchConv}
                onChange={(e) => setSearchConv(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
              Recent Inquiries
            </div>
            {filteredConversations.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No past conversations found.
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    selectConversation(conv.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition flex items-center gap-2.5 group ${
                    activeConversationId === conv.id
                      ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 shadow-inner'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${activeConversationId === conv.id ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="truncate flex-1">{conv.title}</span>
                </button>
              ))
            )}
          </div>

          {/* Sidebar Footer: ISO 9001:2015 Badge */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/80">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="leading-tight">ISO 9001:2015 Certified SOP Manuals</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400">
              24x7 HQ Helpdesk: <a href="tel:+918041142666" className="text-slate-300 font-bold hover:underline">+91 80 4114 2666</a>
            </div>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/70 backdrop-blur-xs md:hidden"
          />
        )}

        {/* ── Main Chat Stream Canvas ── */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
            {messages.length === 0 ? (
              /* Welcome Hero & Quick Action Prompt Cards */
              <div className="max-w-4xl mx-auto py-6 flex flex-col items-center text-center animate-in fade-in duration-500">
                {/* Large Bot Avatar with Glow */}
                <div className="relative mb-5">
                  <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
                  <AssistBotAvatar size="xl" className="relative shadow-2xl" />
                </div>

                <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-2">
                  Namaste {user?.name?.split(' ')[0] || 'Team'}! How can I assist your operations?
                </h2>
                <p className="text-sm text-slate-400 max-w-xl mb-8 leading-relaxed">
                  I am the official operational copilot for <span className="text-emerald-400 font-bold">{siteDisplayName}</span>. Query verified equipment SOPs, daily checklists, staff on duty, and incident escalation.
                </p>

                {/* Feature Highlights Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl mb-8">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-2.5 text-left">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div className="text-xs">
                      <div className="font-bold text-white">Zero Hallucination</div>
                      <div className="text-[11px] text-slate-400">Strictly ISO 9001:2015 manuals</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-2.5 text-left">
                    <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <div className="text-xs">
                      <div className="font-bold text-white">Emergency Bypass</div>
                      <div className="text-[11px] text-slate-400">Direct dialable contacts</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-2.5 text-left">
                    <Users className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <div className="text-xs">
                      <div className="font-bold text-white">Live Roster Sync</div>
                      <div className="text-[11px] text-slate-400">On-duty staff & shift timings</div>
                    </div>
                  </div>
                </div>

                {/* Quick Prompts Grid */}
                <div className="w-full max-w-3xl">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 text-left">
                    Suggested Inquiries & Procedures
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quickPrompts.map((qp, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(qp.query)}
                        className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-emerald-500/60 hover:bg-slate-850/90 transition text-left group shadow-lg flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition flex items-center justify-between">
                            <span>{qp.title}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition flex-shrink-0" />
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {qp.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Conversation Messages Stream */
              <div className="max-w-4xl mx-auto space-y-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3.5 ${
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.sender === 'assistant' && (
                      <AssistBotAvatar size="sm" className="mt-1 flex-shrink-0" />
                    )}

                    <div
                      className={`rounded-2xl text-sm leading-relaxed max-w-[88vw] md:max-w-2xl ${
                        msg.sender === 'user'
                          ? 'bg-blue-600/95 text-white px-5 py-3.5 rounded-tr-xs shadow-xl'
                          : msg.isEmergency
                          ? 'bg-slate-900 border-2 border-red-500 text-slate-100 p-5 shadow-2xl shadow-red-950/60 rounded-tl-xs'
                          : 'bg-slate-900/95 border border-slate-800 text-slate-100 p-5 shadow-2xl rounded-tl-xs'
                      }`}
                    >
                      {/* Emergency Banner */}
                      {msg.isEmergency && (
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-500/30 text-red-400 font-extrabold text-xs">
                          <AlertTriangle className="w-4 h-4 animate-bounce" />
                          CRITICAL LIFE-SAFETY EMERGENCY PROTOCOL TRIGGERED
                        </div>
                      )}

                      {/* Message Content */}
                      <div className="whitespace-pre-wrap space-y-2.5 font-normal leading-relaxed text-[13px] md:text-sm">
                        {msg.content}
                      </div>

                      {/* Verified Sources Citations Chips */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2 items-center">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                            Verified Grounding:
                          </span>
                          {msg.sources.map((src, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-emerald-400 font-medium shadow-xs"
                            >
                              📄 {src.title}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action & Feedback Toolbar */}
                      {msg.sender === 'assistant' && (
                        <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                            {msg.confidence !== undefined && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                                {Math.round(msg.confidence * 100)}% Verified Grounding
                              </span>
                            )}
                            {msg.latency_ms && (
                              <span className="text-[10px] text-slate-400">
                                {msg.latency_ms}ms
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5">
                            {/* Read Aloud Button */}
                            <button
                              onClick={() => handleSpeak(msg.content)}
                              className="p-1 hover:text-white transition"
                              title="Read response aloud"
                            >
                              {isSpeaking ? <VolumeX className="w-4 h-4 text-cyan-400" /> : <Volume2 className="w-4 h-4" />}
                            </button>

                            {/* Copy Button */}
                            <button
                              onClick={() => handleCopy(msg.content, msg.id)}
                              className="p-1 hover:text-white transition"
                              title="Copy to clipboard"
                            >
                              {copiedId === msg.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>

                            {/* Feedback Rating */}
                            <button
                              onClick={() => sendFeedback(msg.id, 1)}
                              className={`p-1 transition ${
                                msg.feedback_rating === 1 ? 'text-emerald-400' : 'hover:text-white'
                              }`}
                              title="Helpful"
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => sendFeedback(msg.id, -1)}
                              className={`p-1 transition ${
                                msg.feedback_rating === -1 ? 'text-red-400' : 'hover:text-white'
                              }`}
                              title="Not helpful"
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* AI Searching Indicator */}
                {isLoading && (
                  <div className="flex items-center gap-3 text-slate-400 text-xs py-3 animate-pulse">
                    <AssistBotAvatar size="sm" isThinking={true} />
                    <span>Searching verified Paradigm SOPs, checklists & duty rosters...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ── Floating Dock Input Bar ── */}
          <div className="p-4 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent flex-shrink-0 z-20">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end gap-2 bg-slate-900/95 border border-slate-700/80 focus-within:border-emerald-500/80 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-2xl p-2.5 transition shadow-2xl backdrop-blur-xl">
                {/* Voice Input Mic Button */}
                <button
                  onClick={toggleSpeechRecognition}
                  className={`p-2.5 rounded-xl transition ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Speech-to-text voice inquiry"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask Paradigm Assist about SOPs, checklists, or rosters for ${siteDisplayName}...`}
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none resize-none py-1.5 max-h-36 leading-relaxed"
                />

                {/* Send Button */}
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white transition flex-shrink-0 shadow-lg shadow-emerald-950"
                  title="Submit Inquiry"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Input Footer Note */}
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 px-2">
                <span>Enterprise Grounding: Strictly verified against Paradigm ISO 9001:2015 manuals</span>
                <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Emergency Modal */}
      <EmergencyModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        siteName={siteDisplayName}
      />

      {/* Roster Modal */}
      <RosterModal
        isOpen={rosterModalOpen}
        onClose={() => setRosterModalOpen(false)}
        siteId={selectedSiteId}
        siteName={siteDisplayName}
      />
    </div>
  );
};

export default ParadigmAssistPage;
