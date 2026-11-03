import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Plus, ShieldAlert, Users, Settings, ThumbsUp, ThumbsDown,
  Volume2, VolumeX, Copy, Check, Sparkles, MessageSquare, Menu,
  X, AlertTriangle, ArrowRight, BookOpen, Search, Mic, MicOff,
  ArrowLeft, PanelLeftClose, PanelLeftOpen, Phone, ExternalLink,
  ShieldCheck, HelpCircle, CheckCircle2, Clock, Trash2, Sun, Moon,
  Smartphone, Monitor, Sparkle, Zap, Download, Bookmark,
  Database, ClipboardList, Paperclip, ChevronRight, ChevronDown, Bell,
  FileText, Building2, AlertCircle, Cpu, Sliders
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
import { ProfilePlaceholder } from '../../components/ui/ProfilePlaceholder';
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
    tabs,
    activeTabId,
    messages,
    sites,
    selectedSiteId,
    isLoading,
    init,
    fetchConversations,
    selectConversation,
    startNewConversation,
    openTab,
    closeTab,
    selectTab,
    deleteConversation,
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
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [searchConv, setSearchConv] = useState('');
  const [advisoryExpanded, setAdvisoryExpanded] = useState(false);

  // Grouped and filtered conversations for the sidebar
  const filteredConversations = conversations.filter(c =>
    (c.title || '').toLowerCase().includes(searchConv.toLowerCase())
  );

  const isToday = (dStr?: string) => {
    if (!dStr) return true;
    try {
      return new Date(dStr).toDateString() === new Date().toDateString();
    } catch {
      return true;
    }
  };

  const todayConvs = filteredConversations.filter(c => isToday(c.updated_at || c.created_at));
  const earlierConvs = filteredConversations.filter(c => !isToday(c.updated_at || c.created_at));

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

  // Global keyboard shortcuts (Cmd/Ctrl + B to toggle sidebar, Cmd/Ctrl + K for new inquiry)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        startNewConversation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [startNewConversation]);

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
    { title: '🏢 Back-Office Staff Count', desc: 'Estate Managers, Accounts, Billing & Helpdesk on duty', query: 'What is today present back office staff count?' },
    { title: '👷 Field Staff Deployment', desc: 'MEP Engineers, Security Marshals & Housekeeping on ground', query: 'What is today present field staff count?' },
    { title: '🏢 Live Site Attendance', desc: 'Nikoo Homes, Uber Verdant live biometric punches & presence', query: 'What is Nikoo Homes present today?' },
    { title: '📋 Pending Onboarding Forms', desc: 'Vendor & contractor documents awaiting HR clearance', query: 'How many pending onboarding forms do we have?' },
    { title: '🎫 Open Support Tickets', desc: 'Active client & site maintenance issues, priority & assignees', query: 'Show open support tickets' },
    { title: '⚡ DG Cold Start SOP', desc: 'Battery voltage, fuel level, and AMF sequence', query: 'What is the SOP and checklist to start a cold Diesel Generator (DG)?' },
  ];


  return (
    <div className="fixed inset-0 z-50 h-screen w-screen overflow-hidden flex flex-col font-sans select-none bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* ── MOBILE APPLICATION HEADER (md:hidden) ── */}
      <header
        className="md:hidden assist-mobile-header px-3 bg-[#041b0f]/95 dark:bg-[#041b0f]/95 border-b border-emerald-900/40 backdrop-blur-xl flex items-center justify-between gap-1 flex-shrink-0 z-30 shadow-xs transition-colors"
        style={{
          paddingTop: 'calc(max(var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px)) + 0.35rem)',
          paddingBottom: '0.45rem',
          minHeight: 'calc(3.75rem + max(var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px)))'
        }}
      >
        {/* Left: Navigation Actions (Back to Home + History Drawer) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleBack}
            className="w-8 h-8 rounded-lg bg-transparent hover:bg-emerald-950/40 active:bg-emerald-900/40 text-emerald-400 flex items-center justify-center transition active:scale-95 cursor-pointer"
            title={isNative ? "Return to Mobile Home" : "Return to Paradigm Office ERP"}
          >
            <ArrowLeft className="w-4.5 h-4.5 flex-shrink-0 text-emerald-400" />
          </button>

          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="w-8 h-8 rounded-lg bg-transparent hover:bg-emerald-950/40 active:bg-emerald-900/40 text-emerald-400 flex items-center justify-center transition active:scale-95 cursor-pointer"
            title="Open Chat History & Logs"
          >
            <Menu className="w-4.5 h-4.5 flex-shrink-0 text-emerald-400" />
          </button>
        </div>

        {/* Center: Branding & Interactive Site Context Pill */}
        <div className="flex flex-col items-center justify-center min-w-0 px-1 flex-1">
          <div className="flex items-center gap-1.5">
            <img 
              src="/favicon.png" 
              alt="Paradigm Logo" 
              className="w-4 h-4 object-contain rounded flex-shrink-0" 
            />
            <span className="text-xs font-black tracking-tight text-white truncate">
              Paradigm Assist
            </span>
            <span className="text-[8.5px] font-extrabold px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              v4.2
            </span>
          </div>

          {/* Interactive Site Context Selector Pill */}
          <div className="relative mt-0.5 max-w-[170px]">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/90 border border-emerald-900/40 text-[10px] font-semibold text-emerald-300 truncate shadow-2xs">
              <Building2 className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
              <span className="truncate max-w-[125px]">
                {selectedSite ? selectedSite.name : 'All Paradigm Sites'}
              </span>
              <ChevronDown className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
            </div>
            {/* Native transparent select over the pill */}
            <select
              value={selectedSiteId || ''}
              onChange={(e) => setSelectedSiteId(e.target.value || null)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-white">All Paradigm Sites (14 Locations)</option>
              {sites.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  {s.name} {s.city ? `(${s.city})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Emergency Hub + 1-Tap New Chat + Tools Drawer */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Emergency Escalation Pill */}
          <button
            onClick={() => setEmergencyModalOpen(true)}
            className="w-8 h-8 rounded-lg bg-transparent hover:bg-emerald-950/40 active:bg-emerald-900/40 text-emerald-400 flex items-center justify-center transition active:scale-95 cursor-pointer relative"
            title="Emergency Escalation Matrix"
          >
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-sm shadow-red-500/80 z-10" />
            <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0 text-emerald-400" />
          </button>

          {/* 1-Tap New Inquiry Button */}
          <button
            onClick={() => {
              startNewConversation();
              toast.success('Started new inquiry', { duration: 1500 });
            }}
            className="w-8 h-8 rounded-lg bg-transparent hover:bg-emerald-950/40 active:bg-emerald-900/40 text-emerald-400 flex items-center justify-center transition active:scale-95 cursor-pointer"
            title="Start New Inquiry"
          >
            <Plus className="w-4.5 h-4.5 flex-shrink-0 text-emerald-400" />
          </button>

          {/* More Tools Menu Button */}
          <button
            onClick={() => setMobileToolsOpen(true)}
            className="w-8 h-8 rounded-lg bg-transparent hover:bg-emerald-950/40 active:bg-emerald-900/40 text-emerald-400 flex items-center justify-center transition active:scale-95 cursor-pointer"
            title="Operations Hub & Tools"
          >
            <Sliders className="w-4.5 h-4.5 flex-shrink-0 text-emerald-400" />
          </button>
        </div>
      </header>

      {/* ── DESKTOP APPLICATION HEADER (hidden on mobile) ── */}
      <header 
        className="hidden md:flex px-3 sm:px-4 md:px-5 bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 backdrop-blur-xl items-center justify-between gap-2 flex-shrink-0 z-30 shadow-2xs transition-colors"
        style={{
          paddingTop: 'calc(max(var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px)) + 0.35rem)',
          paddingBottom: '0.35rem',
          minHeight: 'calc(3.5rem + max(var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px)))'
        }}
      >
        {/* Left Side: Back to ERP/Home & Brand */}
        <div className="flex items-center space-x-2 sm:space-x-2.5 flex-shrink-0">
          {/* Back to ERP / Office Button (Icon Only) */}
          <button
            onClick={handleBack}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 flex items-center justify-center transition shadow-2xs flex-shrink-0 cursor-pointer"
            title={isNative ? "Return to Mobile Home" : "Return to Paradigm Office ERP"}
          >
            <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          </button>

          {/* Mobile Drawer Toggle */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition flex-shrink-0 cursor-pointer"
            title="Open Menu & History"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Mobile Quick New Chat Button */}
          <button
            onClick={() => {
              startNewConversation();
              toast.success('Started new inquiry', { duration: 1500 });
            }}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-slate-800 transition flex-shrink-0 cursor-pointer"
            title="New Inquiry"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Brand Identity with Paradigm Logo and Single-Line Label */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 flex-shrink-0">
            <img 
              src="/favicon.png" 
              alt="Paradigm Logo" 
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-lg shadow-2xs flex-shrink-0" 
            />
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                Paradigm Assist
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 whitespace-nowrap">
                v4.2 PRO
              </span>
            </div>
          </div>
        </div>

        {/* Center / Right Side: Site Selector, Status Badges & Profile */}
        <div className="flex items-center gap-1.5 flex-shrink min-w-0 overflow-x-auto no-scrollbar py-1">
          {/* Site Context Selector */}
          <div className="relative flex-shrink-0 group">
            <div className="flex items-center h-8 px-2.5 rounded-full bg-white/70 hover:bg-white/95 dark:bg-slate-800/60 dark:hover:bg-slate-800/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all duration-300 ease-out cursor-pointer">
              <Building2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 flex-shrink-0" />
              <div className={`overflow-hidden transition-all duration-300 ease-out flex items-center ${
                selectedSiteId
                  ? 'max-w-[190px] opacity-100 ml-1.5'
                  : 'max-w-0 opacity-0 group-hover:max-w-[210px] group-hover:opacity-100 group-hover:ml-1.5 group-focus-within:max-w-[210px] group-focus-within:opacity-100 group-focus-within:ml-1.5'
              }`}>
                <select
                  value={selectedSiteId || ''}
                  onChange={(e) => setSelectedSiteId(e.target.value || null)}
                  className="bg-transparent focus:outline-none cursor-pointer pr-1 truncate text-xs text-slate-800 dark:text-white font-medium"
                >
                  <option value="" className="dark:bg-slate-900 text-slate-800 dark:text-white">All Paradigm Sites (14 Locations)</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id} className="dark:bg-slate-900 text-slate-800 dark:text-white">
                      {s.name} {s.city ? `(${s.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Emergency Escalation Button */}
          <button
            onClick={() => setEmergencyModalOpen(true)}
            className="group flex items-center h-8 px-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 backdrop-blur-md border border-red-500/30 dark:border-red-500/40 text-[11px] font-semibold transition-all duration-300 ease-out shadow-xs hover:shadow-sm whitespace-nowrap flex-shrink-0 cursor-pointer"
            title="Emergency Escalation Matrix & SOP Protocols"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 ml-1" />
            <span className="max-w-0 opacity-0 group-hover:max-w-[140px] group-hover:opacity-100 group-hover:ml-1.5 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out text-[11px] font-bold">
              Emergency Hub
            </span>
          </button>

          {/* Staff Roster Button */}
          <button
            onClick={() => setRosterModalOpen(true)}
            className="group flex items-center h-8 px-2.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 backdrop-blur-md border border-emerald-500/30 dark:border-emerald-500/40 text-[11px] font-semibold transition-all duration-300 ease-out shadow-xs hover:shadow-sm whitespace-nowrap flex-shrink-0 cursor-pointer"
            title="Site Staff Duty Directory & Export"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-1" />
            <span className="max-w-0 opacity-0 group-hover:max-w-[160px] group-hover:opacity-100 group-hover:ml-1.5 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out text-[11px] font-bold">
              Duty Roster (428 Live)
            </span>
          </button>

          {/* Offline Brain Button */}
          <button
            onClick={() => setOfflineModalOpen(true)}
            className="group flex items-center h-8 px-2.5 rounded-full bg-slate-500/10 hover:bg-slate-500/20 text-slate-700 dark:text-slate-300 backdrop-blur-md border border-slate-300/60 dark:border-slate-700/60 text-[11px] font-semibold transition-all duration-300 ease-out shadow-xs hover:shadow-sm whitespace-nowrap flex-shrink-0 cursor-pointer"
            title="Edge Neural Engine for Offline Operation"
          >
            <Cpu className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 flex-shrink-0" />
            <span className="max-w-0 opacity-0 group-hover:max-w-[140px] group-hover:opacity-100 group-hover:ml-1.5 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out text-[11px] font-bold">
              Edge Offline Brain
            </span>
          </button>

          {/* 58 SOP Skills Library Button */}
          <button
            onClick={() => setSkillsModalOpen(true)}
            className="group flex items-center h-8 px-2.5 rounded-full bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 backdrop-blur-md border border-teal-500/30 dark:border-teal-500/40 text-[11px] font-semibold transition-all duration-300 ease-out shadow-xs hover:shadow-sm whitespace-nowrap flex-shrink-0 cursor-pointer"
            title="Browse 58 SOP Skills"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <span className="max-w-0 opacity-0 group-hover:max-w-[140px] group-hover:opacity-100 group-hover:ml-1.5 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out text-[11px] font-bold">
              58 SOP Skills
            </span>
          </button>

          {/* Bookmark / Notes */}
          <button
            onClick={() => setNotesModalOpen(true)}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
            title="Operational Notes Hub"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-500" />
          </button>

          {/* Documentation / Admin Portal Link */}
          <button
            onClick={() => navigate('/admin/assist')}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
            title="Knowledge Base & SOP Manuals"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-600" />
          </button>

          {/* Notifications Bell with Badge */}
          <button
            onClick={() => toast('No urgent unread operational alerts', { icon: '🔔' })}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition relative"
            title="Operational Alerts"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
          </button>

          {/* User Profile Pill */}
          <div 
            onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 sm:gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 flex-shrink-0 cursor-pointer group"
            title="View Profile Settings"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden shadow-2xs ring-1 ring-slate-200/90 dark:ring-slate-700/80 group-hover:ring-emerald-500 transition flex items-center justify-center bg-slate-100 dark:bg-slate-800 flex-shrink-0">
              <ProfilePlaceholder 
                photoUrl={user?.photoUrl || (user as any)?.photo_url || (user as any)?.avatar_url} 
                seed={user?.id} 
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="text-left text-xs leading-tight hidden xl:block">
              <div className="font-bold text-slate-900 dark:text-white truncate max-w-[110px] text-[11px] group-hover:text-emerald-600 transition">
                {user?.name || 'Sudhan M'}
              </div>
              <div className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium">Lead Operations</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN WORKSPACE (SIDEBAR + CHAT STREAM) ── */}
      <div className="flex-1 flex overflow-hidden relative bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.05),rgba(248,250,252,1))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.08),rgba(2,6,23,1))] transition-colors">
        {/* Floating Expand Sidebar Button when collapsed */}
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="hidden md:flex absolute top-3 left-3 z-30 p-2 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-sm hover:shadow transition-all duration-200 cursor-pointer items-center gap-1.5"
            title="Expand Sidebar (⌘B)"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {/* ── Left Collapsible Sidebar (Chat History) ── */}
        <aside
          className={`bg-white dark:bg-slate-900/95 border-r border-slate-200/90 dark:border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out z-20 ${
            sidebarCollapsed ? 'w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden' : 'w-60 md:w-64'
          } ${
            mobileSidebarOpen ? 'fixed inset-y-0 left-0 z-40 w-64 translate-x-0 shadow-2xl' : 'fixed md:static -translate-x-full md:translate-x-0'
          }`}
          style={mobileSidebarOpen ? {
            paddingTop: 'max(var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px))'
          } : undefined}
        >
          {/* Sidebar Top: New Operational Inquiry Button & Desktop Shrink Toggle */}
          <div className="p-2 sm:p-2.5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-1.5">
            <button
              onClick={() => {
                startNewConversation();
                setMobileSidebarOpen(false);
              }}
              className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-between shadow-2xs transition cursor-pointer"
              title="Start New Chat / Open New Tab (⌘K)"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">New Inquiry</span>
              </span>
              <kbd className="text-[9px] font-mono bg-emerald-700 px-1.5 py-0.5 rounded text-emerald-100 flex-shrink-0">⌘K</kbd>
            </button>

            {/* Open New Chat in Separate Browser Tab */}
            <button
              onClick={() => window.open(window.location.href, '_blank')}
              className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-slate-800 transition flex-shrink-0 cursor-pointer"
              title="Open chat in separate browser tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            {/* Desktop Shrink / Collapse Sidebar Button (Red Boxed Area) */}
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="hidden md:flex p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition flex-shrink-0 cursor-pointer"
              title="Shrink / Collapse Sidebar (⌘B)"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>

            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Chats Input */}
          <div className="p-2 border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search operational logs & SOPs..."
                value={searchConv}
                onChange={(e) => setSearchConv(e.target.value)}
                className="w-full pl-7 pr-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 text-[11px] text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 transition"
              />
            </div>
          </div>

          {/* Conversation List Grouped */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {filteredConversations.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-400">No inquiries found</p>
                <button
                  onClick={() => startNewConversation()}
                  className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline inline-block cursor-pointer"
                >
                  Start a new inquiry
                </button>
              </div>
            ) : (
              <>
                {/* TODAY'S INQUIRIES */}
                {todayConvs.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
                      <span>TODAY'S INQUIRIES</span>
                      <span>{todayConvs.length}</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      {todayConvs.map((conv) => (
                        <div
                          key={conv.id}
                          onClick={() => {
                            openTab(conv.id);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between group cursor-pointer ${
                            activeConversationId === conv.id
                              ? 'bg-emerald-50/90 text-emerald-900 font-bold border border-emerald-200/80 shadow-xs dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                            <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${activeConversationId === conv.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                            <span className="truncate flex-1">{conv.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                            {activeConversationId === conv.id && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                                toast.success('Inquiry deleted', { duration: 1500 });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                              title="Delete inquiry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* EARLIER INQUIRIES */}
                {earlierConvs.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
                      <span>EARLIER INQUIRIES</span>
                      <span>{earlierConvs.length}</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      {earlierConvs.map((conv) => (
                        <div
                          key={conv.id}
                          onClick={() => {
                            openTab(conv.id);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between group cursor-pointer ${
                            activeConversationId === conv.id
                              ? 'bg-emerald-50/90 text-emerald-900 font-bold border border-emerald-200/80 shadow-xs dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                            <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${activeConversationId === conv.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                            <span className="truncate flex-1">{conv.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                            {activeConversationId === conv.id && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                                toast.success('Inquiry deleted', { duration: 1500 });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                              title="Delete inquiry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar Footer: Professional AI Disclaimer & Advisory (Click to Expand) */}
          <div className="border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/70 flex-shrink-0 transition-colors">
            <button
              onClick={() => setAdvisoryExpanded(!advisoryExpanded)}
              className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors group cursor-pointer"
              title={advisoryExpanded ? "Collapse Advisory Notice" : "Click to view full advisory notice"}
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                <span className="text-[10.5px] font-bold text-slate-800 dark:text-slate-200 truncate">
                  AI Operational Advisory
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform duration-200 flex-shrink-0 ml-1 ${advisoryExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Expandable Notice Body */}
            {advisoryExpanded && (
              <div className="px-3 pb-3 pt-0 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300 shadow-2xs">
                  Paradigm AI can make mistakes. Always cross-verify critical operational procedures, attendance logs, and safety SOPs against official company records.
                </div>
              </div>
            )}
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
          {/* ── Multi-Chat Workspace Tab Strip (Desktop Only) ── */}
          <div className={`hidden md:flex bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800/80 px-2 sm:px-3 pt-1.5 items-center justify-between gap-2 overflow-x-auto select-none flex-shrink-0 transition-all ${sidebarCollapsed ? 'md:pl-14' : ''}`}>
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none py-0.5">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    onClick={() => selectTab(tab.id)}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium transition cursor-pointer border-t border-x ${
                      isActive
                        ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800 shadow-xs font-semibold'
                        : 'bg-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-transparent hover:bg-white/50 dark:hover:bg-slate-800/50'
                    }`}
                    title={tab.title}
                  >
                    <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                    <span className="truncate max-w-[120px] sm:max-w-[170px]">{tab.title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      title="Close tab"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {/* + New Tab button */}
              <button
                type="button"
                onClick={() => startNewConversation()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-emerald-600 hover:bg-white/70 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-slate-800/70 transition cursor-pointer flex-shrink-0 font-medium"
                title="Start new chat / Open new tab (+)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">New Tab</span>
              </button>
            </div>

            {/* Right Controls: Open in separate browser window/tab */}
            <div className="flex items-center gap-1.5 flex-shrink-0 pb-1">
              <button
                type="button"
                onClick={() => window.open(window.location.href, '_blank')}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:text-emerald-600 hover:bg-white/80 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-slate-800/80 transition cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                title="Open new chat in separate browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden md:inline">New Window</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-2 sm:py-3 space-y-4">
            {messages.length === 0 ? (
              /* Welcome Hero & Quick Action Prompt Cards (Reduced ~30%) */
              <div className="max-w-xl lg:max-w-2xl mx-auto py-1 flex flex-col items-center text-center animate-in fade-in duration-300">
                {/* Center 3D Animated Floating & Waving Bot */}
                <div 
                  className="relative mb-2 flex flex-col items-center justify-center cursor-pointer group"
                  onClick={() => toast('Paradigm Assist online & ready!', { icon: '🤖' })}
                  title="Paradigm AI Copilot"
                >
                  {/* Subtle Ambient Glow */}
                  <div className="absolute w-20 h-20 rounded-full bg-emerald-500/15 dark:bg-emerald-400/20 blur-xl pointer-events-none transition-all duration-300 group-hover:bg-emerald-500/25" />

                  {/* 3D Floating & Waving Bot Graphic */}
                  <div className="relative animate-float-bot select-none">
                    <img
                      src="/assist/companion_waving_hd.webp?v=paradigm-avatar-v5"
                      alt="Paradigm AI Virtual Companion"
                      className="w-18 h-22 sm:w-20 sm:h-24 object-contain pointer-events-none select-none drop-shadow-md transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/assist/robot_transparent.png';
                      }}
                    />
                  </div>

                  {/* Dynamic 3D Ground Shadow */}
                  <div className="w-10 h-2 rounded-full bg-slate-900/25 dark:bg-black/50 blur-[1px] animate-shadow-breathe -mt-0.5 pointer-events-none" />
                </div>

                <h1 className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-0.5">
                  Namaste {user?.name?.split(' ')[0] || 'Sudhan'}! How can I assist your operations?
                </h1>
                <p className="text-[10px] sm:text-[10.5px] text-slate-600 dark:text-slate-400 max-w-lg mb-2 leading-relaxed">
                  Enterprise operational intelligence platform for{' '}
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold text-[9.5px] inline-block">
                    {siteDisplayName}
                  </span>
                  . Real-time workforce deployment, statutory onboarding compliance, facility maintenance workflows, and verified operating standards.
                </p>

                {/* 3 Metric & Status Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 w-full mb-2 text-left">
                  {/* Card 1: Database Connected */}
                  <div className="p-2 sm:p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between gap-1 mb-0.5 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="p-1 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex-shrink-0">
                          <Database className="w-3 h-3" />
                        </div>
                        <span className="font-bold text-[10px] sm:text-[10.5px] text-slate-900 dark:text-white truncate">Database Connected</span>
                      </div>
                      <span className="text-[8.5px] font-semibold text-emerald-600 flex items-center gap-1 flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        18ms
                      </span>
                    </div>
                    <p className="text-[9px] sm:text-[9.5px] text-slate-500 dark:text-slate-400 leading-snug">
                      Biometric logs, onboarding records, and incident workflows synchronized across 14 clusters.
                    </p>
                  </div>

                  {/* Card 2: Zero Hallucination */}
                  <div className="p-2 sm:p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between gap-1 mb-0.5 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="p-1 rounded bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 flex-shrink-0">
                          <ShieldCheck className="w-3 h-3" />
                        </div>
                        <span className="font-bold text-[10px] sm:text-[10.5px] text-slate-900 dark:text-white truncate">Zero Hallucination</span>
                      </div>
                      <span className="text-[8.5px] font-semibold text-cyan-700 bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-300 px-1 py-0.2 rounded flex-shrink-0">
                        100% Deterministic
                      </span>
                    </div>
                    <p className="text-[9px] sm:text-[9.5px] text-slate-500 dark:text-slate-400 leading-snug">
                      Strictly grounded in ISO 9001:2015 manuals and verified company records.
                    </p>
                  </div>

                  {/* Card 3: Live Roster Sync */}
                  <div className="p-2 sm:p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between gap-1 mb-0.5 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="p-1 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600 flex-shrink-0">
                          <Clock className="w-3 h-3" />
                        </div>
                        <span className="font-bold text-[10px] sm:text-[10.5px] text-slate-900 dark:text-white truncate">Live Roster Sync</span>
                      </div>
                      <span className="text-[8.5px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-1 py-0.2 rounded flex-shrink-0">
                        Shift 2 Active
                      </span>
                    </div>
                    <p className="text-[9px] sm:text-[9.5px] text-slate-500 dark:text-slate-400 leading-snug">
                      428 on-duty staff, shift handovers, and security marshals tracked in real-time.
                    </p>
                  </div>
                </div>

                {/* Suggested Inquiries & Procedures Grid */}
                <div className="w-full text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      SUGGESTED INQUIRIES & PROCEDURES
                    </span>
                    <span className="text-[9.5px] sm:text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer flex items-center gap-1">
                      Click to trigger instantly →
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                    {/* Card 1: Live Site Attendance Report */}
                    <button
                      onClick={() => handleSend('What is Nikoo Homes present today?')}
                      className="p-1.5 sm:p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-2xs transition flex items-center justify-between group text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex-shrink-0">
                          <ClipboardList className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[11px] text-slate-900 dark:text-white group-hover:text-emerald-600 transition truncate">
                            Live Site Attendance Report
                          </div>
                          <div className="text-[9px] sm:text-[9.5px] text-slate-500 dark:text-slate-400 truncate">
                            Audit today's biometric clock-ins across all 14 sites
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0 ml-1.5" />
                    </button>

                    {/* Card 2: Pending Onboarding Forms */}
                    <button
                      onClick={() => handleSend('How many pending onboarding forms do we have?')}
                      className="p-1.5 sm:p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-2xs transition flex items-center justify-between group text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 flex-shrink-0">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[11px] text-slate-900 dark:text-white group-hover:text-emerald-600 transition truncate">
                            Pending Onboarding Forms
                          </div>
                          <div className="text-[9px] sm:text-[9.5px] text-slate-500 dark:text-slate-400 truncate">
                            12 vendor contractor documents awaiting HR clearance
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0 ml-1.5" />
                    </button>

                    {/* Card 3: Chiller Trip & Power Outage SOP */}
                    <button
                      onClick={() => handleSend('What is the SOP and checklist to start a cold Diesel Generator (DG) and handle chiller trip during power outage?')}
                      className="p-1.5 sm:p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-2xs transition flex items-center justify-between group text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 flex-shrink-0">
                          <AlertCircle className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[11px] text-slate-900 dark:text-white group-hover:text-emerald-600 transition truncate">
                            Chiller Trip & Power Outage SOP
                          </div>
                          <div className="text-[9px] sm:text-[9.5px] text-slate-500 dark:text-slate-400 truncate">
                            Standard operating guidelines for backup DG sync
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0 ml-1.5" />
                    </button>

                    {/* Card 4: Create Incident / MEP Ticket */}
                    <button
                      onClick={() => handleSend('Show open support tickets and dispatch maintenance alert')}
                      className="p-1.5 sm:p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-2xs transition flex items-center justify-between group text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 flex-shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[11px] text-slate-900 dark:text-white group-hover:text-emerald-600 transition truncate">
                            Create Incident / MEP Ticket
                          </div>
                          <div className="text-[9px] sm:text-[9.5px] text-slate-500 dark:text-slate-400 truncate">
                            Auto-dispatch engineering team for maintenance alert
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0 ml-1.5" />
                    </button>
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
          <div 
            className="px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-slate-950 dark:via-slate-950/90 dark:to-transparent flex-shrink-0 z-20 transition-colors"
            style={{
              paddingBottom: 'calc(0.5rem + max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px)))'
            }}
          >
            <div className="max-w-3xl lg:max-w-4xl mx-auto">
              {/* Optional Quick Touch Pill Strip on Mobile */}
              {isMobile && messages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1.5 mb-1 scrollbar-none">
                  {quickPrompts.slice(0, 3).map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(qp.query)}
                      className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 whitespace-nowrap flex items-center gap-1 shadow-2xs"
                    >
                      <span>{qp.title.split(' ')[0]}</span>
                      <span>{qp.title.split(' ').slice(1).join(' ')}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-xl sm:rounded-2xl p-1.5 px-3 transition shadow-sm dark:shadow-xl backdrop-blur-xl">
                {/* Voice Input Mic Button */}
                <button
                  onClick={toggleSpeechRecognition}
                  className={`p-1.5 rounded-lg transition ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                  title="Speech-to-text voice inquiry"
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>

                {/* Attachment / Paperclip Button */}
                <button
                  onClick={() => toast('Document & SOP file attachment grounding ready', { icon: '📎' })}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  title="Attach SOP or maintenance log"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </button>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask Paradigm Assist about SOPs, checklists, or rosters for ${siteDisplayName}...`}
                  className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none py-1 max-h-32 leading-relaxed"
                />

                {/* Circular Send Button */}
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white flex items-center justify-center transition flex-shrink-0 shadow-md shadow-emerald-600/30 dark:shadow-emerald-950 cursor-pointer"
                  title="Submit Inquiry"
                >
                  <Send className="w-3.5 h-3.5 -rotate-12 translate-x-px" />
                </button>
              </div>

              {/* Input Footer Note */}
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 px-2 font-medium">
                <span className="flex items-center gap-1 truncate text-slate-500 dark:text-slate-400">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  Enterprise Grounding: Strictly verified against Paradigm ISO 9001:2015 manuals
                </span>
                <span className="hidden sm:inline flex-shrink-0 font-mono text-[9.5px] text-slate-400">
                  Press Enter to send, Shift+Enter for new line
                </span>
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

      {/* ── MOBILE OPERATIONAL TOOLS BOTTOM SHEET ── */}
      {mobileToolsOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setMobileToolsOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Bottom Sheet Drawer */}
          <div 
            className="relative z-10 bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-250"
            style={{
              paddingBottom: 'calc(1.5rem + max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px)))'
            }}
          >
            {/* Grab handle */}
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-4" />

            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Operations & Intel Hub</h3>
                  <p className="text-[10px] text-slate-400">Quick access to site tools, rosters & SOPs</p>
                </div>
              </div>
              <button
                onClick={() => setMobileToolsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid of Tools */}
            <div className="grid grid-cols-2 gap-2.5 overflow-y-auto pr-1">
              {/* Duty Roster */}
              <button
                onClick={() => {
                  setMobileToolsOpen(false);
                  setRosterModalOpen(true);
                }}
                className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-left flex flex-col gap-2 transition active:scale-98 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Duty Roster</div>
                  <div className="text-[10px] text-slate-400">428 live site staff deployed</div>
                </div>
              </button>

              {/* Edge Offline Brain */}
              <button
                onClick={() => {
                  setMobileToolsOpen(false);
                  setOfflineModalOpen(true);
                }}
                className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-left flex flex-col gap-2 transition active:scale-98 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Offline Brain</div>
                  <div className="text-[10px] text-slate-400">Edge on-device Qwen neural</div>
                </div>
              </button>

              {/* 58 SOP Skills */}
              <button
                onClick={() => {
                  setMobileToolsOpen(false);
                  setSkillsModalOpen(true);
                }}
                className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-left flex flex-col gap-2 transition active:scale-98 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">58 SOP Skills</div>
                  <div className="text-[10px] text-slate-400">MEP & facility standards</div>
                </div>
              </button>

              {/* Operational Notes Hub */}
              <button
                onClick={() => {
                  setMobileToolsOpen(false);
                  setNotesModalOpen(true);
                }}
                className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-left flex flex-col gap-2 transition active:scale-98 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Notes Hub</div>
                  <div className="text-[10px] text-slate-400">Local saved inquiries & SOPs</div>
                </div>
              </button>

              {/* Knowledge Admin Portal */}
              <button
                onClick={() => {
                  setMobileToolsOpen(false);
                  navigate('/admin/assist');
                }}
                className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-left flex flex-col gap-2 transition active:scale-98 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Knowledge Suite</div>
                  <div className="text-[10px] text-slate-400">Admin manuals & triage</div>
                </div>
              </button>

              {/* Emergency Escalation */}
              <button
                onClick={() => {
                  setMobileToolsOpen(false);
                  setEmergencyModalOpen(true);
                }}
                className="p-3 rounded-2xl bg-red-950/40 hover:bg-red-950/60 border border-red-500/30 text-left flex flex-col gap-2 transition active:scale-98 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-red-300">Emergency Hub</div>
                  <div className="text-[10px] text-red-400/80">Crisis SOPs & contacts</div>
                </div>
              </button>
            </div>

            {/* Bottom Actions: Theme Toggle & Profile */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  toggleTheme();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/90 text-slate-300 text-xs font-semibold hover:text-white transition cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
                <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
              </button>

              <div 
                onClick={() => {
                  setMobileToolsOpen(false);
                  navigate('/profile');
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/60 cursor-pointer hover:border-emerald-500/60 transition"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center">
                  <ProfilePlaceholder 
                    photoUrl={user?.photoUrl || (user as any)?.photo_url || (user as any)?.avatar_url} 
                    seed={user?.id} 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div className="text-left text-[11px] font-bold text-white truncate max-w-[90px]">
                  {user?.name || 'Profile'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParadigmAssistPage;

