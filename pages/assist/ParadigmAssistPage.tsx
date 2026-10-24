import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Plus, ShieldAlert, Users, Settings, ThumbsUp, ThumbsDown,
  Volume2, VolumeX, Copy, Check, Sparkles, MessageSquare, Menu,
  X, AlertTriangle, ArrowRight, BookOpen, Search, Mic, MicOff,
  ArrowLeft, PanelLeftClose, PanelLeftOpen, Phone, ExternalLink,
  ShieldCheck, HelpCircle, CheckCircle2, Clock, Trash2, Sun, Moon,
  Smartphone, Monitor, Sparkle, Zap, Download, Bookmark,
  Database, ClipboardList, Paperclip, ChevronRight, ChevronDown, Bell,
  FileText, Building2, AlertCircle
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
    { title: '🏢 Live Site Attendance', desc: 'Nikoo Homes, Uber Verdant live biometric punches & presence', query: 'What is Nikoo Homes present today?' },
    { title: '📋 Pending Onboarding Forms', desc: '47 applications: 9 pending review, Aadhaar/PAN status', query: 'How many pending onboarding forms do we have?' },
    { title: '🎫 Open Support Tickets', desc: 'Active client & site maintenance issues, priority & assignees', query: 'Show open support tickets' },
    { title: '⚡ DG Cold Start SOP', desc: 'Battery voltage, fuel level, and AMF sequence', query: 'What is the SOP and checklist to start a cold Diesel Generator (DG)?' },
    { title: '💧 STP Aeration & DO', desc: 'Dissolved oxygen, MLSS, and blower checks', query: 'What are the normal dissolved oxygen and MLSS parameters for the STP aeration tank?' },
    { title: '👥 Who is on Duty Today?', desc: 'Site Facility Manager, Electrician & Plumber contacts', query: 'Who is the facility manager and electrician on duty today?' },
  ];

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchConv.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen overflow-hidden flex flex-col font-sans select-none bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* ── TOP APPLICATION HEADER ── */}
      <header className="h-13 sm:h-14 px-3 sm:px-4 md:px-5 bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 backdrop-blur-xl flex items-center justify-between gap-2 flex-shrink-0 z-30 shadow-2xs transition-colors">
        {/* Left Side: Back to ERP/Home, Sidebar Toggle & Brand */}
        <div className="flex items-center space-x-2 sm:space-x-2.5 flex-shrink-0">
          {/* Back to ERP / Office Button */}
          <button
            onClick={handleBack}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs whitespace-nowrap flex-shrink-0"
            title={isNative ? "Return to Mobile Home" : "Return to Paradigm Office ERP"}
          >
            <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="whitespace-nowrap">{isNative ? "Back" : "Back to Office"}</span>
          </button>

          {/* Sidebar Toggle for Desktop */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition flex-shrink-0"
            title={sidebarCollapsed ? "Expand History Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {/* Mobile Drawer Toggle */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition flex-shrink-0"
            title="Open Menu & History"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Brand Identity with Squircle Bot Icon */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-2xs flex-shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="3" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8.01" y2="16" strokeWidth="2.5" />
                <line x1="16" y1="16" x2="16.01" y2="16" strokeWidth="2.5" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col">
                <span className="text-[11px] sm:text-xs font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                  Paradigm
                </span>
                <span className="text-[11px] sm:text-xs font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                  Assist
                </span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 whitespace-nowrap">
                v4.2 PRO
              </span>
            </div>
          </div>
        </div>

        {/* Center / Right Side: Site Selector, Status Badges & Profile */}
        <div className="flex items-center gap-1.5 flex-shrink min-w-0 overflow-x-auto no-scrollbar py-1">
          {/* Site Context Selector */}
          <div className="relative flex-shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/70 border border-slate-200/90 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-xs font-semibold cursor-pointer transition">
              <Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
              <select
                value={selectedSiteId || ''}
                onChange={(e) => setSelectedSiteId(e.target.value || null)}
                className="bg-transparent focus:outline-none cursor-pointer pr-1 truncate max-w-[140px] sm:max-w-[180px] text-xs"
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

          {/* Emergency Escalation Button */}
          <button
            onClick={() => setEmergencyModalOpen(true)}
            className="px-2.5 py-1 rounded-full bg-red-50/80 hover:bg-red-100 text-red-600 border border-red-200/90 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60 text-[11px] font-semibold flex items-center gap-1.5 transition shadow-2xs whitespace-nowrap flex-shrink-0"
            title="Emergency Escalation Matrix & SOP Protocols"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
            <span className="hidden sm:inline">Emergency Hub</span>
          </button>

          {/* Staff Roster Button */}
          <button
            onClick={() => setRosterModalOpen(true)}
            className="px-2.5 py-1 rounded-full bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 text-[11px] font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer whitespace-nowrap flex-shrink-0"
            title="Site Staff Duty Directory & Export"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <Users className="w-3 h-3 text-emerald-600 flex-shrink-0" />
            <span className="hidden lg:inline">Duty Roster (428 Live)</span>
          </button>

          {/* Offline Brain Button */}
          <button
            onClick={() => setOfflineModalOpen(true)}
            className="px-2.5 py-1 rounded-full bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition shadow-2xs whitespace-nowrap flex-shrink-0"
            title="Edge Neural Engine for Offline Operation"
          >
            <Sparkles className="w-3 h-3 text-slate-500 flex-shrink-0" />
            <span className="hidden xl:inline">Edge Offline Brain</span>
          </button>

          {/* 58 SOP Skills Library Button */}
          <button
            onClick={() => setSkillsModalOpen(true)}
            className="px-2.5 py-1 rounded-full bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 text-[11px] font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer whitespace-nowrap flex-shrink-0"
            title="Browse 58 SOP Skills"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
            <span className="hidden xl:inline">58 SOP Skills</span>
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
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800 flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px] shadow-2xs">
              {user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'SR'}
            </div>
            <div className="text-left text-xs leading-tight hidden xl:block">
              <div className="font-bold text-slate-900 dark:text-white truncate max-w-[110px] text-[11px]">{user?.name || 'Sudhan R.'}</div>
              <div className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium">Lead Operations</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN WORKSPACE (SIDEBAR + CHAT STREAM) ── */}
      <div className="flex-1 flex overflow-hidden relative bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.05),rgba(248,250,252,1))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.08),rgba(2,6,23,1))] transition-colors">
        {/* ── Left Collapsible Sidebar (Chat History) ── */}
        <aside
          className={`bg-white dark:bg-slate-900/95 border-r border-slate-200/90 dark:border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out z-20 ${
            sidebarCollapsed ? 'w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden' : 'w-60 md:w-64'
          } ${
            mobileSidebarOpen ? 'fixed inset-y-0 left-0 z-40 w-64 translate-x-0 shadow-2xl' : 'fixed md:static -translate-x-full md:translate-x-0'
          }`}
        >
          {/* Sidebar Top: New Operational Inquiry Button */}
          <div className="p-2 sm:p-2.5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-1.5">
            <button
              onClick={() => {
                startNewConversation();
                setMobileSidebarOpen(false);
              }}
              className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-between shadow-2xs transition"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">New Inquiry</span>
              </span>
              <kbd className="text-[9px] font-mono bg-emerald-700 px-1.5 py-0.5 rounded text-emerald-100 flex-shrink-0">⌘K</kbd>
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
            {/* TODAY'S INQUIRIES */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
                <span>TODAY'S INQUIRIES</span>
                <span>{filteredConversations.length > 0 ? filteredConversations.length : 3}</span>
              </div>
              <div className="space-y-1 mt-1">
                {filteredConversations.length > 0 ? (
                  filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        selectConversation(conv.id);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between group ${
                        activeConversationId === conv.id
                          ? 'bg-emerald-50/90 text-emerald-900 font-bold border border-emerald-200/80 shadow-xs dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${activeConversationId === conv.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                        <span className="truncate flex-1">{conv.title}</span>
                      </div>
                      {activeConversationId === conv.id && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      )}
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      onClick={() => handleSend('Shift Handover - Zone B Chiller')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs bg-emerald-50/90 text-emerald-900 font-bold border border-emerald-200/80 shadow-xs dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span className="truncate">Shift Handover - Zone B Chiller</span>
                      </div>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    </button>
                    <button
                      onClick={() => handleSend('Biometric Punch Discrepancy #49')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 flex items-center gap-2"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">Biometric Punch Discrepancy #49</span>
                    </button>
                    <button
                      onClick={() => handleSend('Fire Drill Checklist Verification')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 flex items-center gap-2"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">Fire Drill Checklist Verification</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* YESTERDAY */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
                <span>YESTERDAY</span>
                <span>2</span>
              </div>
              <div className="space-y-1 mt-1">
                <button
                  onClick={() => handleSend('Contractor Gate Pass Validation')}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">Contractor Gate Pass Validation</span>
                </button>
                <button
                  onClick={() => handleSend('HVAC Maintenance Window 3')}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">HVAC Maintenance Window 3</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar Footer: ISO 9001:2015 Badge */}
          <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/80">
            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="leading-tight font-medium">ISO 9001:2015 Certified Manuals</span>
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
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-2 sm:py-3 space-y-4">
            {messages.length === 0 ? (
              /* Welcome Hero & Quick Action Prompt Cards */
              <div className="max-w-3xl lg:max-w-4xl mx-auto py-1 sm:py-2 flex flex-col items-center text-center animate-in fade-in duration-300">
                {/* Center Squircle Bot Icon */}
                <div className="relative mb-2 sm:mb-2.5 flex items-center justify-center">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white relative shadow-md shadow-emerald-600/20">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="10" rx="3.5" />
                      <circle cx="12" cy="5" r="2" />
                      <path d="M12 7v4" />
                      <line x1="8" y1="16" x2="8.01" y2="16" strokeWidth="2.5" />
                      <line x1="16" y1="16" x2="16.01" y2="16" strokeWidth="2.5" />
                    </svg>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900 absolute -bottom-0.5 -right-0.5 shadow-xs" />
                  </div>
                </div>

                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-1">
                  Namaste {user?.name?.split(' ')[0] || 'Sudhan'}! How can I assist your operations?
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 max-w-xl mb-2.5 sm:mb-3 leading-snug">
                  I am the official operational copilot for{' '}
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px] inline-block">
                    {siteDisplayName}
                  </span>
                  . Query live attendance punches, pending onboarding applications, support tickets, and verified SOPs directly from your database.
                </p>

                {/* 3 Metric & Status Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 w-full mb-2.5 sm:mb-3 text-left">
                  {/* Card 1: Database Connected */}
                  <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between gap-1 mb-1 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex-shrink-0">
                          <Database className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-[11px] sm:text-xs text-slate-900 dark:text-white truncate">Database Connected</span>
                      </div>
                      <span className="text-[9.5px] font-semibold text-emerald-600 flex items-center gap-1 flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Latency: 18ms
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                      Punches, on-boarding files & active incident tickets synched across 14 clusters.
                    </p>
                  </div>

                  {/* Card 2: Zero Hallucination */}
                  <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between gap-1 mb-1 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="p-1 rounded-md bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 flex-shrink-0">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-[11px] sm:text-xs text-slate-900 dark:text-white truncate">Zero Hallucination</span>
                      </div>
                      <span className="text-[9.5px] font-semibold text-cyan-700 bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-300 px-1 py-0.5 rounded flex-shrink-0">
                        100% Deterministic
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                      Strictly grounded in ISO 9001:2015 manuals and verified company records.
                    </p>
                  </div>

                  {/* Card 3: Live Roster Sync */}
                  <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between gap-1 mb-1 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="p-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 flex-shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-[11px] sm:text-xs text-slate-900 dark:text-white truncate">Live Roster Sync</span>
                      </div>
                      <span className="text-[9.5px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-1 py-0.5 rounded flex-shrink-0">
                        Shift 2 Handover Active
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                      428 on-duty staff, shift handovers, and security marshals tracked in real-time.
                    </p>
                  </div>
                </div>

                {/* Suggested Inquiries & Procedures Grid */}
                <div className="w-full text-left">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      SUGGESTED INQUIRIES & PROCEDURES
                    </span>
                    <span className="text-[10.5px] sm:text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer flex items-center gap-1">
                      Click to trigger instantly →
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Card 1: Live Site Attendance Report */}
                    <button
                      onClick={() => handleSend('What is Nikoo Homes present today?')}
                      className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-2xs transition flex items-center justify-between group text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex-shrink-0">
                          <ClipboardList className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-600 transition truncate">
                            Live Site Attendance Report
                          </div>
                          <div className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                            Audit today's biometric clock-ins across all 14 sites
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0 ml-1.5" />
                    </button>

                    {/* Card 2: Pending Onboarding Forms */}
                    <button
                      onClick={() => handleSend('How many pending onboarding forms do we have?')}
                      className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-2xs transition flex items-center justify-between group text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 flex-shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-600 transition truncate">
                            Pending Onboarding Forms
                          </div>
                          <div className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                            12 vendor contractor documents awaiting HR clearance
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0 ml-1.5" />
                    </button>

                    {/* Card 3: Chiller Trip & Power Outage SOP */}
                    <button
                      onClick={() => handleSend('What is the SOP and checklist to start a cold Diesel Generator (DG) and handle chiller trip during power outage?')}
                      className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-2xs transition flex items-center justify-between group text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 flex-shrink-0">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-600 transition truncate">
                            Chiller Trip & Power Outage SOP
                          </div>
                          <div className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                            Standard operating guidelines for backup DG sync
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0 ml-1.5" />
                    </button>

                    {/* Card 4: Create Incident / MEP Ticket */}
                    <button
                      onClick={() => handleSend('Show open support tickets and dispatch maintenance alert')}
                      className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-2xs transition flex items-center justify-between group text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 flex-shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-600 transition truncate">
                            Create Incident / MEP Ticket
                          </div>
                          <div className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                            Auto-dispatch engineering team for maintenance alert
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0 ml-1.5" />
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
          <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-slate-950 dark:via-slate-950/90 dark:to-transparent flex-shrink-0 z-20 transition-colors pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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

                {/* AI Model Engine Selector (Auto Hybrid Mode Pill) */}
                <ModelSelectorPill onOpenOfflineModal={() => setOfflineModalOpen(true)} />

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
    </div>
  );
};

export default ParadigmAssistPage;

