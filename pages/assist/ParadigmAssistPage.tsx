import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Plus, ShieldAlert, Users, Settings, ThumbsUp, ThumbsDown,
  Volume2, VolumeX, Copy, Check, Sparkles, MessageSquare, Menu,
  X, AlertTriangle, ArrowRight, BookOpen, Search, Mic, MicOff,
  ArrowLeft, PanelLeftClose, PanelLeftOpen, Phone, ExternalLink,
  ShieldCheck, HelpCircle, CheckCircle2, Clock, Trash2, Sun, Moon,
  Smartphone, Monitor, Sparkle, Zap, Download, Bookmark
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useDevice } from '../../hooks/useDevice';
import { useAssistStore, AssistMessage } from '../../store/assistStore';
import AssistBotAvatar from '../../components/assist/AssistBotAvatar';
import EmergencyModal from '../../components/assist/EmergencyModal';
import RosterModal from '../../components/assist/RosterModal';
import OfflineBrainModal from '../../components/assist/OfflineBrainModal';
import SkillsDrawerModal from '../../components/assist/SkillsDrawerModal';
import NotesPanelModal from '../../components/assist/NotesPanelModal';
import ActionLauncherCard from '../../components/assist/ActionLauncherCard';
import { MarkdownMessage } from '../../components/assist/MarkdownMessage';
import { ModelSelectorPill } from '../../components/assist/ModelSelectorPill';
import toast from 'react-hot-toast';

export const ParadigmAssistPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { isMobile } = useDevice();
  const isNative = Capacitor.isNativePlatform() || isMobile;

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
    sendFeedback,
    isOfflineModelReady,
    isModelDownloading,
    modelDownloadProgress
  } = useAssistStore();

  const [input, setInput] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
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

  // Handle Theme Toggle
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    const html = document.documentElement;
    const body = document.body;
    if (nextTheme === 'dark') {
      html.classList.add('dark');
      body.classList.add('pro-dark-theme');
    } else {
      html.classList.remove('dark');
      body.classList.remove('pro-dark-theme');
    }
    toast.success(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`, { duration: 1500 });
  };

  // Back navigation: Returns to Mobile Home on Android/Mobile, or ERP Dashboard on Web
  const handleBack = () => {
    if (isNative) {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/mobile-home');
      }
    } else {
      navigate('/verification/dashboard');
    }
  };

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
    <div className="fixed inset-0 z-50 h-screen w-screen overflow-hidden flex flex-col font-sans select-none bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* ── TOP APPLICATION HEADER ── */}
      <header className="h-16 px-3 sm:px-4 md:px-6 bg-white/95 dark:bg-slate-900/90 border-b border-slate-200/90 dark:border-slate-800/80 backdrop-blur-xl flex items-center justify-between gap-2 md:gap-3 flex-shrink-0 z-30 shadow-xs dark:shadow-lg transition-colors">
        {/* Left Side: Back to ERP/Home, Sidebar Toggle & Brand */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          {/* Back to ERP / Office Button */}
          <button
            onClick={handleBack}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 dark:bg-slate-800/90 dark:hover:bg-slate-750 dark:text-slate-200 dark:border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            title={isNative ? "Return to Mobile Home" : "Return to Paradigm Office ERP"}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isNative ? "Back" : "Back to Office"}</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          {/* Sidebar Toggle for Desktop */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
            title={sidebarCollapsed ? "Expand History Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>

          {/* Mobile Drawer Toggle */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
            title="Open Menu & History"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand Identity with Animated Bot Avatar */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
            <AssistBotAvatar size="sm" isThinking={isLoading} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm md:text-base font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                  Paradigm Assist
                </span>
                <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
                  4.0 AI Copilot
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden lg:block leading-none truncate">
                Zero-Hallucination Operations Manual & Roster Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Center / Right Side: Site Selector, Emergency, Roster, Theme Toggle, Admin, Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 flex-shrink-0">
          {/* Site Context Selector */}
          <div className="relative">
            <select
              value={selectedSiteId || ''}
              onChange={(e) => setSelectedSiteId(e.target.value || null)}
              className="pl-2.5 pr-7 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200/90 text-slate-800 dark:bg-slate-800/90 dark:border-slate-700/80 dark:text-white text-xs font-semibold focus:outline-none focus:border-emerald-500 max-w-[125px] sm:max-w-[170px] md:max-w-[210px] truncate shadow-xs cursor-pointer transition"
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
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/90 dark:bg-red-600/20 dark:hover:bg-red-600 dark:text-red-300 dark:hover:text-white dark:border-red-500/40 text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            title="Emergency Escalation Matrix & SOP Protocols"
          >
            <ShieldAlert className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-red-600 dark:text-red-400 animate-pulse" />
            <span className="hidden sm:inline">Emergency Hub</span>
          </button>

          {/* Staff Roster Button */}
          <button
            onClick={() => setRosterModalOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 dark:bg-emerald-600/20 dark:hover:bg-emerald-600 dark:text-emerald-300 dark:hover:text-white dark:border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            title="Site Staff Duty Directory & Export"
          >
            <Users className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Duty Roster</span>
          </button>

          {/* Offline Brain (Qwen 2.5 Local AI) Button */}
          <button
            onClick={() => setOfflineModalOpen(true)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer ${
              isOfflineModelReady
                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700/60'
                : isModelDownloading
                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60 animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/90 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:border-slate-700'
            }`}
            title="On-Device Neural Engine for 100% Offline Field Operation"
          >
            <Zap className={`w-3.5 h-3.5 ${isOfflineModelReady ? 'text-indigo-600 dark:text-indigo-400' : isModelDownloading ? 'text-amber-600 animate-spin' : 'text-slate-500'}`} />
            <span className="hidden md:inline">
              {isOfflineModelReady
                ? 'Offline Brain Ready'
                : isModelDownloading
                ? `Downloading (${modelDownloadProgress}%)`
                : 'Offline Brain'}
            </span>
          </button>

          {/* 54 Digital Companion Skills Library Button */}
          <button
            onClick={() => setSkillsModalOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 dark:bg-emerald-600/20 dark:hover:bg-emerald-600 dark:text-emerald-300 dark:hover:text-white dark:border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            title="Browse 54 Digital Companion Office & Operations Skills"
          >
            <Sparkles className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">54 Skills</span>
          </button>

          {/* On-Device Notes Hub Button */}
          <button
            onClick={() => setNotesModalOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/90 dark:bg-amber-600/20 dark:hover:bg-amber-600 dark:text-amber-300 dark:hover:text-white dark:border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            title="Local On-Device Notes Hub"
          >
            <Bookmark className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Notes</span>
          </button>

          {/* Knowledge Admin Portal Link (Admin / Management) */}
          {isAdminOrMgmt && (
            <button
              onClick={() => navigate('/admin/assist')}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200/90 dark:bg-cyan-600/20 dark:hover:bg-cyan-600 dark:text-cyan-300 dark:hover:text-white dark:border-cyan-500/40 text-xs font-bold hidden md:flex items-center gap-1.5 transition shadow-xs"
              title="Admin Knowledge Suite & Unanswered Triage"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Admin Suite</span>
            </button>
          )}

          {/* Theme Mode Toggle (Sun/Moon for Web & Android sync) */}
          <button
            onClick={toggleTheme}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 dark:bg-slate-800/90 dark:hover:bg-slate-750 dark:text-slate-200 dark:border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            title={theme === 'dark' ? "Switch to Light Mode (Web App theme)" : "Switch to Dark Mode (Android App theme)"}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden lg:inline text-xs">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-slate-600" />
                <span className="hidden lg:inline text-xs">Dark</span>
              </>
            )}
          </button>

          {/* User Profile Pill */}
          <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-emerald-700 dark:text-emerald-400">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="text-left text-xs leading-tight">
              <div className="font-bold text-slate-900 dark:text-white truncate max-w-[110px]">{user?.name || 'Staff Member'}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">{user?.role || 'User'}</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN WORKSPACE (SIDEBAR + CHAT STREAM) ── */}
      <div className="flex-1 flex overflow-hidden relative bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.05),rgba(248,250,252,1))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.08),rgba(2,6,23,1))] transition-colors">
        {/* ── Left Collapsible Sidebar (Chat History) ── */}
        <aside
          className={`bg-white dark:bg-slate-900/95 border-r border-slate-200/90 dark:border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out z-20 ${
            sidebarCollapsed ? 'w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden' : 'w-72 md:w-72'
          } ${
            mobileSidebarOpen ? 'fixed inset-y-0 left-0 z-40 w-72 translate-x-0 shadow-2xl' : 'fixed md:static -translate-x-full md:translate-x-0'
          }`}
        >
          {/* Sidebar Top: New Chat */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                startNewConversation();
                setMobileSidebarOpen(false);
              }}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 dark:shadow-emerald-950/60 transition"
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Chats Input */}
          <div className="p-2.5 border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search history..."
                value={searchConv}
                onChange={(e) => setSearchConv(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 transition"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 px-2 py-1">
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
                      ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 shadow-xs dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 dark:shadow-inner'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${activeConversationId === conv.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                  <span className="truncate flex-1">{conv.title}</span>
                </button>
              ))
            )}
          </div>

          {/* Sidebar Footer: ISO 9001:2015 Badge */}
          <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/80">
            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="leading-tight font-medium">ISO 9001:2015 Certified SOP Manuals</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
              24x7 HQ Helpdesk: <a href="tel:+918041142666" className="text-emerald-700 dark:text-slate-300 font-bold hover:underline">+91 80 4114 2666</a>
            </div>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/60 dark:bg-black/70 backdrop-blur-xs md:hidden"
          />
        )}

        {/* ── Main Chat Stream Canvas ── */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
            {messages.length === 0 ? (
              /* Welcome Hero & Quick Action Prompt Cards */
              <div className="max-w-4xl mx-auto py-4 md:py-6 flex flex-col items-center text-center animate-in fade-in duration-500">
                {/* Large Bot Avatar with Glow */}
                <div className="relative mb-5">
                  <div className="absolute -inset-4 bg-emerald-500/15 dark:bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
                  <AssistBotAvatar size="xl" className="relative shadow-2xl" />
                </div>

                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                  Namaste {user?.name?.split(' ')[0] || 'Team'}! How can I assist your operations?
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl mb-6 sm:mb-8 leading-relaxed">
                  I am the official operational copilot for <span className="text-emerald-600 dark:text-emerald-400 font-bold">{siteDisplayName}</span>. Query verified equipment SOPs, daily checklists, staff on duty, and incident escalation.
                </p>

                {/* Feature Highlights Banner (Matching Web App Card Style) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl mb-6 sm:mb-8">
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 shadow-xs flex items-center gap-2.5 text-left transition hover:shadow-sm">
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="text-xs">
                      <div className="font-bold text-slate-900 dark:text-white">Zero Hallucination</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Strictly ISO 9001:2015 manuals</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 shadow-xs flex items-center gap-2.5 text-left transition hover:shadow-sm">
                    <div className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex-shrink-0">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div className="text-xs">
                      <div className="font-bold text-slate-900 dark:text-white">Emergency Bypass</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Direct dialable contacts</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 shadow-xs flex items-center gap-2.5 text-left transition hover:shadow-sm">
                    <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex-shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-xs">
                      <div className="font-bold text-slate-900 dark:text-white">Live Roster Sync</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">On-duty staff & shift timings</div>
                    </div>
                  </div>
                </div>

                {/* Quick Prompts Grid (Matching ERP Web App Card Layout) */}
                <div className="w-full max-w-3xl">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 text-left flex items-center justify-between">
                    <span>Suggested Inquiries & Procedures</span>
                    <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400">Click to ask instantly</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quickPrompts.map((qp, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(qp.query)}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 hover:border-emerald-500/60 hover:bg-emerald-50/20 dark:hover:border-emerald-500/60 dark:hover:bg-slate-850/90 transition text-left group shadow-xs hover:shadow-md flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex items-center justify-between">
                            <span>{qp.title}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-1 transition flex-shrink-0" />
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
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
                          ? 'bg-emerald-600 text-white px-5 py-3.5 rounded-tr-xs shadow-md'
                          : msg.isEmergency
                          ? 'bg-red-50 dark:bg-slate-900 border-2 border-red-500 text-slate-900 dark:text-slate-100 p-5 shadow-xl shadow-red-950/20 rounded-tl-xs'
                          : 'bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 p-5 shadow-xs dark:shadow-xl rounded-tl-xs'
                      }`}
                    >
                      {/* Emergency Banner */}
                      {msg.isEmergency && (
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-500/30 text-red-600 dark:text-red-400 font-extrabold text-xs">
                          <AlertTriangle className="w-4 h-4 animate-bounce" />
                          CRITICAL LIFE-SAFETY EMERGENCY PROTOCOL TRIGGERED
                        </div>
                      )}

                      {/* Message Content with Rich Markdown Rendering */}
                      <MarkdownMessage
                        content={msg.content}
                        isUser={msg.sender === 'user'}
                      />

                      {/* Interactive Action Launcher Card (UltraViewer, Gmail, WhatsApp, etc.) */}
                      {msg.actionApp && (
                        <ActionLauncherCard app={msg.actionApp} />
                      )}

                      {/* Verified Sources Citations Chips */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap gap-2 items-center">
                          <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                            Verified Grounding:
                          </span>
                          {msg.sources.map((src, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-emerald-700 dark:text-emerald-400 font-medium shadow-xs"
                            >
                              📄 {src.title}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action & Feedback Toolbar */}
                      {msg.sender === 'assistant' && (
                        <div className="mt-3.5 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            {msg.isOffline && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 font-bold flex items-center gap-1">
                                <Zap className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                                On-Device AI (Offline)
                              </span>
                            )}
                            {msg.confidence !== undefined && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 font-bold">
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
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                              title="Read response aloud"
                            >
                              {isSpeaking ? <VolumeX className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> : <Volume2 className="w-4 h-4" />}
                            </button>

                            {/* Copy Button */}
                            <button
                              onClick={() => handleCopy(msg.content, msg.id)}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                              title="Copy to clipboard"
                            >
                              {copiedId === msg.id ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>

                            {/* Feedback Rating */}
                            <button
                              onClick={() => sendFeedback(msg.id, 1)}
                              className={`p-1 transition ${
                                msg.feedback_rating === 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                              }`}
                              title="Helpful"
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => sendFeedback(msg.id, -1)}
                              className={`p-1 transition ${
                                msg.feedback_rating === -1 ? 'text-red-500 dark:text-red-400' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
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
                  <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-xs py-3 animate-pulse">
                    <AssistBotAvatar size="sm" isThinking={true} />
                    <span>Searching verified Paradigm SOPs, checklists & duty rosters...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ── Floating Dock Input Bar ── */}
          <div className="p-3 sm:p-4 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-slate-950 dark:via-slate-950/90 dark:to-transparent flex-shrink-0 z-20 transition-colors pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="max-w-4xl mx-auto">
              {/* Optional Quick Touch Pill Strip on Mobile */}
              {isMobile && messages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-1 scrollbar-none">
                  {quickPrompts.slice(0, 3).map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(qp.query)}
                      className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap flex items-center gap-1 shadow-2xs"
                    >
                      <span>{qp.title.split(' ')[0]}</span>
                      <span>{qp.title.split(' ').slice(1).join(' ')}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-700/80 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-2xl p-2 sm:p-2.5 transition shadow-lg dark:shadow-2xl backdrop-blur-xl">
                {/* Voice Input Mic Button */}
                <button
                  onClick={toggleSpeechRecognition}
                  className={`p-2 sm:p-2.5 rounded-xl transition ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
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
                  className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none py-1.5 max-h-36 leading-relaxed"
                />

                {/* AI Model Engine Selector (Cloud Groq / Gemini / Local On-Device / Hybrid) */}
                <ModelSelectorPill onOpenOfflineModal={() => setOfflineModalOpen(true)} />

                {/* Send Button */}
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 sm:p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white transition flex-shrink-0 shadow-md shadow-emerald-600/30 dark:shadow-emerald-950"
                  title="Submit Inquiry"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Input Footer Note */}
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-2">
                <span className="truncate">Enterprise Grounding: Strictly verified against Paradigm ISO 9001:2015 manuals</span>
                <span className="hidden sm:inline flex-shrink-0">Press Enter to send, Shift+Enter for new line</span>
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

      {/* Offline Brain Setup & Status Modal */}
      <OfflineBrainModal
        isOpen={offlineModalOpen}
        onClose={() => setOfflineModalOpen(false)}
      />

      {/* 54 Skills Drawer Modal */}
      <SkillsDrawerModal
        isOpen={skillsModalOpen}
        onClose={() => setSkillsModalOpen(false)}
        onSelectSkill={(prompt) => {
          setInput(prompt);
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }}
      />

      {/* On-Device Notes Hub Modal */}
      <NotesPanelModal
        isOpen={notesModalOpen}
        onClose={() => setNotesModalOpen(false)}
      />
    </div>
  );
};

export default ParadigmAssistPage;

