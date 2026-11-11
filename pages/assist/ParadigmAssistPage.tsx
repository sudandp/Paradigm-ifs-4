import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Plus, Users, Settings, ThumbsUp, ThumbsDown,
  Volume2, VolumeX, Copy, Check, Sparkles, MessageSquare, Menu,
  X, AlertTriangle, ArrowRight, BookOpen, Search, Mic, MicOff,
  ArrowLeft, PanelLeftClose, PanelLeftOpen, ExternalLink,
  ShieldCheck, HelpCircle, CheckCircle2, Clock, Trash2, Sun, Moon,
  Database, ClipboardList, Paperclip, ChevronRight, ChevronDown, Bell,
  FileText, Building2, AlertCircle, Cpu, Sliders, PenSquare,
  Folder, RotateCw, Globe, Compass, Brain, LogOut, ShieldAlert
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
import { analyzeDocumentWithLocalPython, analyzeTextWithLocalPython } from '../../services/localAttendanceAnalyzerService';
import toast from 'react-hot-toast';

export const ParadigmAssistPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
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
    isOfflineModelReady
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [thinkEnabled, setThinkEnabled] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeakNext, setAutoSpeakNext] = useState(false);
  const [searchConv, setSearchConv] = useState('');
  interface AttachedDoc {
    name: string;
    size: string;
    type: string;
    previewUrl?: string;
    extractedText?: string;
    isExtracting?: boolean;
    rawFile?: File;
  }

  const [attachedFiles, setAttachedFiles] = useState<AttachedDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client-side instant document text extraction (PDFs, text, CSVs, logs)
  const extractDocumentText = async (file: File): Promise<string> => {
    const lowerName = file.name.toLowerCase();

    // 1. Plain Text / CSV / JSON / Markdown / Log
    if (lowerName.endsWith('.txt') || lowerName.endsWith('.csv') || lowerName.endsWith('.json') || lowerName.endsWith('.tsv') || lowerName.endsWith('.md') || lowerName.endsWith('.log')) {
      try {
        return await file.text();
      } catch (e) {
        console.warn('Text file read failed:', e);
        return '';
      }
    }

    // 2. PDF Document (Using locally bundled pdfjs-dist worker)
    if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        const pdfjs = ((pdfjsLib as unknown as { default?: unknown }).default || pdfjsLib) as any;
        if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
          const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
          pdfjs.GlobalWorkerOptions.workerSrc = `${origin}/pdf.worker.min.mjs`;
        }

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
          isEvalSupported: false,
          useSystemFonts: true,
        });
        const pdfDoc = await loadingTask.promise;
        const maxPages = Math.min(pdfDoc.numPages, 15);
        const textParts: string[] = [];
        for (let p = 1; p <= maxPages; p++) {
          const page = await pdfDoc.getPage(p);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((it: any) => it.str || '').join(' ');
          if (pageText.trim()) {
            textParts.push(`[Page ${p}]:\n${pageText.trim()}`);
          }
        }
        return textParts.join('\n\n');
      } catch (err) {
        console.warn('[PDF Extraction Error]:', err);
        return '';
      }
    }

    // 3. Fallback: Try reading raw text
    try {
      return await file.text();
    } catch {
      return '';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);
    e.target.value = '';

    const newDocs: AttachedDoc[] = fileList.map(file => {
      const isImg = file.type.startsWith('image/');
      const sizeStr = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${Math.round(file.size / 1024)} KB`;
      return {
        name: file.name,
        size: sizeStr,
        type: file.type,
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
        extractedText: '',
        isExtracting: true,
        rawFile: file
      };
    });

    setAttachedFiles(prev => [...prev, ...newDocs]);
    toast.loading(`Extracting content from ${fileList.map(f => f.name).join(', ')}...`, { id: 'file-extract' });

    // Extract text in background
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const extracted = await extractDocumentText(file);
        setAttachedFiles(prev => prev.map(item => {
          if (item.name === file.name) {
            return {
              ...item,
              extractedText: extracted,
              isExtracting: false
            };
          }
          return item;
        }));
      } catch (err) {
        setAttachedFiles(prev => prev.map(item => item.name === file.name ? { ...item, isExtracting: false } : item));
      }
    }

    toast.success(`Attached & parsed ${fileList.length} document(s)`, { id: 'file-extract', icon: '📄' });
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const triggerLocalPythonAnalysis = async (file: AttachedDoc, fileIdx: number, customQ?: string) => {
    const q = (customQ || input).trim() || 'total how many duties i need to pay?';
    toast.loading(`Processing ${file.name} locally with Python Engine...`, { id: 'local-py' });
    try {
      let result: any;
      if (file.rawFile) {
        result = await analyzeDocumentWithLocalPython(file.rawFile, q);
      } else if (file.extractedText) {
        result = await analyzeTextWithLocalPython(file.extractedText, file.name, q);
      } else {
        toast.error('File content not ready yet, please wait a moment.', { id: 'local-py' });
        return;
      }

      if (result && result.success && result.answer) {
        toast.success('Processed locally with Python in ~110ms (0 Cloud Tokens)', { id: 'local-py', icon: '⚡' });

        const userMsg: AssistMessage = {
          id: `usr_${Date.now()}`,
          sender: 'user',
          content: `[Attached Document/Photo: ${file.name} (${file.size})] ${q}`,
          created_at: new Date().toISOString()
        };

        const asstMsg: AssistMessage = {
          id: `asst_py_${Date.now()}`,
          sender: 'assistant',
          content: result.answer,
          confidence: 1.0,
          latency_ms: 110,
          isOffline: true,
          sources: [
            { id: 'local-python-engine', title: 'Paradigm Local Python Attendance Engine (Offline)', sourceTable: 'local_attendance_analyzer.py' },
            { id: 'shift-rules', title: 'Paradigm Dynamic Shift & Policy Rules (ISO 9001:2015)', sourceTable: 'Standard Operating Procedures' }
          ] as any,
          created_at: new Date().toISOString()
        };

        const activeConvId = activeConversationId || `conv_${Date.now()}`;
        const newMsgs = [...messages, userMsg, asstMsg];

        useAssistStore.setState(state => {
          const updatedTabs = state.tabs.map(t =>
            t.id === state.activeTabId
              ? { ...t, messages: newMsgs, title: file.name.slice(0, 28), conversationId: activeConvId }
              : t
          );
          return {
            messages: newMsgs,
            tabs: updatedTabs,
            activeConversationId: activeConvId,
            isLoading: false
          };
        });

        // Persist to localStorage so the inquiry and duty results are never lost
        try {
          localStorage.setItem(`paradigm_conv_msg_${activeConvId}`, JSON.stringify(newMsgs));
        } catch {}

        removeAttachedFile(fileIdx);
        setInput('');
      } else {
        throw new Error(result?.error || 'Python returned empty output');
      }
    } catch (err: any) {
      console.error('[Local Python Error]:', err);
      toast.error(`Local Python Error: ${err.message || 'Execution failed'}`, { id: 'local-py' });
    }
  };

  const renderUserBubbleContent = (rawContent: string) => {
    const docMatch = rawContent.match(/\[Attached Document(?:\/Photo)?:?\s*([^\]\()]+?)(?:\s*\(([^)]+)\))?\]/i) ||
                     rawContent.match(/--- BEGIN ATTACHED DOCUMENT \[([^\]]+)\]/i);
    const docName = docMatch ? docMatch[1].trim() : null;
    const docSize = docMatch && docMatch[2] ? docMatch[2].trim() : null;

    let cleanPrompt = rawContent
      .replace(/\[Attached Document(?:\/Photo)?:?[^\]]+\]/gi, '')
      .replace(/--- BEGIN ATTACHED DOCUMENT [\s\S]*?--- END ATTACHED DOCUMENT [^-\n]* ---/gi, '')
      .replace(/Based on the attached document data above, answer this user question:\s*/gi, '')
      .replace(/\[ISO 9001:2015 Deterministic Grounding\]/gi, '')
      .trim();

    if (!cleanPrompt && docName) {
      cleanPrompt = 'Analyze this document and calculate all duties.';
    }

    return (
      <div className="space-y-1.5">
        {docName && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/10 border border-white/15 text-xs text-white max-w-fit shadow-xs">
            <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="font-semibold truncate max-w-[220px]">{docName}</span>
            {docSize && <span className="text-[10px] text-slate-400">({docSize})</span>}
            <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-bold">
              ✓ Ready
            </span>
          </div>
        )}
        <div className="text-[14px] text-white leading-relaxed font-normal">{cleanPrompt}</div>
      </div>
    );
  };

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
  const centerTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize store and manage theme cleanly on mount & unmount
  useEffect(() => {
    const isMobileDevice = isMobile || isNative || (typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    document.documentElement.classList.add('dark');
    init();

    return () => {
      // Clean up dark mode when leaving Assist on desktop web
      if (!isMobileDevice) {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('pro-dark-theme');
        setTheme('light');
      }
    };
  }, [isMobile, isNative, setTheme]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Hands-free Voice Mode: Auto-speak assistant response when voice inquiry was used
  useEffect(() => {
    if (!isLoading && messages.length > 0 && autoSpeakNext) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender === 'assistant' && lastMsg.content) {
        handleSpeak(lastMsg.content);
        setAutoSpeakNext(false);
      }
    }
  }, [messages, isLoading, autoSpeakNext]);

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
    const isMobileDevice = isMobile || isNative || (typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    if (!isMobileDevice) {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('pro-dark-theme');
      setTheme('light');
    }
    if (isNative || isMobile) {
      navigate('/mobile-home');
    } else {
      if (window.history.state?.idx > 0) {
        navigate(-1);
      } else {
        navigate('/verification/dashboard');
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const targetRef = messages.length === 0 ? centerTextareaRef.current : textareaRef.current;
    if (targetRef) {
      targetRef.style.height = 'auto';
      targetRef.style.height = `${Math.min(targetRef.scrollHeight, 160)}px`;
    }
  };

  const handleSend = async (queryToSend?: string) => {
    const rawQ = queryToSend || input;
    if (!rawQ.trim() && attachedFiles.length === 0) return;
    if (isLoading) return;

    // Check if any files are currently extracting
    const stillExtracting = attachedFiles.some(f => f.isExtracting);
    if (stillExtracting) {
      toast('Processing attached document, please wait a moment...', { icon: '⏳' });
      return;
    }

    // Direct Local Python Processing: If any file is attached, process locally with Python Engine
    if (attachedFiles.length > 0) {
      const fileToProcess = attachedFiles[0];
      await triggerLocalPythonAnalysis(fileToProcess, 0, rawQ);
      return;
    }

    let finalQuery = rawQ.trim();

    if (thinkEnabled && !finalQuery.includes('[ISO 9001:2015 Deterministic Grounding]')) {
      finalQuery = `${finalQuery} [ISO 9001:2015 Deterministic Grounding]`;
    }

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    if (centerTextareaRef.current) {
      centerTextareaRef.current.style.height = 'auto';
    }

    await sendMessage(finalQuery);
  };

  const toggleInteractiveVoiceMode = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      setAutoSpeakNext(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setAutoSpeakNext(true);
        toast('Voice mode active: Speak your inquiry...', { icon: '🎙' });
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => {
        setIsListening(false);
        setAutoSpeakNext(false);
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          handleSend(transcript);
        }
      };

      recognition.start();
    } catch (e) {
      setIsListening(false);
      setAutoSpeakNext(false);
    }
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

  // User initials
  const userInitials = (user?.name || 'Sudhan')
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const userNameHandle = user?.name ? user.name.toLowerCase().replace(/\s+/g, '_') : 'sudhan_1610';

  return (
    <div id="paradigm-assist-root" className="fixed inset-0 z-50 h-screen w-screen overflow-hidden flex font-sans select-none bg-[#212121] text-[#ececec]">

      {/* ── LEFT SIDEBAR (ChatGPT Style) ── */}
      <aside
        className={`bg-[#171717] border-r border-white/5 flex flex-col transition-all duration-300 ease-in-out z-30 select-none ${
          sidebarCollapsed ? 'w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden' : 'w-64'
        } ${
          mobileSidebarOpen ? 'fixed inset-y-0 left-0 z-50 w-64 translate-x-0 shadow-2xl' : 'fixed md:static -translate-x-full md:translate-x-0'
        }`}
        style={mobileSidebarOpen ? {
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 0.35rem), 2rem)',
          paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 0.35rem), 1rem)'
        } : undefined}
      >
        {/* Top Header: Paradigm Brand + Search + Collapse */}
        <div className="p-3.5 flex items-center justify-between text-white border-b border-white/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <img 
              src="/favicon.png" 
              alt="Paradigm Logo" 
              className="w-6 h-6 object-contain rounded-md shadow-xs flex-shrink-0" 
            />
            <span className="font-bold text-[14.5px] tracking-tight text-white whitespace-nowrap truncate">
              Paradigm Assist
            </span>
          </div>

          <div className="flex items-center gap-1 text-[#b4b4b4] flex-shrink-0">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition cursor-pointer"
              title="Search inquiries"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="hidden md:flex p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition cursor-pointer"
              title="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search input (if open) */}
        {searchOpen && (
          <div className="px-3 pt-2 pb-1 border-b border-white/5 animate-in fade-in duration-150">
            <input
              type="text"
              placeholder="Search chats..."
              value={searchConv}
              onChange={(e) => setSearchConv(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-[#212121] text-xs text-white placeholder-slate-400 focus:outline-none border border-white/10"
              autoFocus
            />
          </div>
        )}

        {/* New Chat Button Pill */}
        <div className="p-3">
          <button
            onClick={() => {
              startNewConversation();
              setMobileSidebarOpen(false);
            }}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#212121] hover:bg-[#2a2a2a] text-white text-sm font-medium flex items-center gap-2.5 transition cursor-pointer shadow-xs border border-white/5"
          >
            <PenSquare className="w-4 h-4 text-[#ececec]" />
            <span>New chat</span>
          </button>
        </div>

        {/* Scrollable Navigation & History List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-4 text-xs font-medium text-[#b4b4b4]">

          {/* Standard Navigation Menu Items */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                setSkillsModalOpen(true);
                setMobileSidebarOpen(false);
              }}
              className="w-full px-3 py-2 rounded-lg hover:bg-white/5 hover:text-white flex items-center gap-3 transition text-left cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span>Library (58 SOPs)</span>
            </button>

            <button
              onClick={() => {
                setOfflineModalOpen(true);
                setMobileSidebarOpen(false);
              }}
              className="w-full px-3 py-2 rounded-lg hover:bg-white/5 hover:text-white flex items-center gap-3 transition text-left cursor-pointer"
            >
              <Cpu className="w-4 h-4 text-slate-400" />
              <span>Plugins / Edge Brain</span>
            </button>

            <button
              onClick={() => {
                setRosterModalOpen(true);
                setMobileSidebarOpen(false);
              }}
              className="w-full px-3 py-2 rounded-lg hover:bg-white/5 hover:text-white flex items-center gap-3 transition text-left cursor-pointer"
            >
              <Users className="w-4 h-4 text-slate-400" />
              <span>Codex / Duty Roster</span>
            </button>

            <button
              onClick={() => {
                navigate('/admin/assist');
                setMobileSidebarOpen(false);
              }}
              className="w-full px-3 py-2 rounded-lg hover:bg-white/5 hover:text-white flex items-center gap-3 transition text-left cursor-pointer"
            >
              <Compass className="w-4 h-4 text-slate-400" />
              <span>Explore Admin</span>
            </button>
          </div>

          {/* Pinned Section */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 px-3 py-1">Pinned</div>
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  handleSend('How many pending onboarding forms do we have?');
                  setMobileSidebarOpen(false);
                }}
                className="w-full px-3 py-2 rounded-lg hover:bg-white/5 hover:text-white flex items-center gap-3 transition text-left cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="truncate">HR & Onboarding</span>
              </button>

              <button
                onClick={() => {
                  setEmergencyModalOpen(true);
                  setMobileSidebarOpen(false);
                }}
                className="w-full px-3 py-2 rounded-lg hover:bg-white/5 hover:text-red-400 flex items-center gap-3 transition text-left cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                <span className="truncate">Emergency Matrix</span>
              </button>
            </div>
          </div>

          {/* Projects Section */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 px-3 py-1">Projects</div>
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  handleSend('What is Nikoo Homes present today?');
                  setMobileSidebarOpen(false);
                }}
                className="w-full px-3 py-2 rounded-lg hover:bg-white/5 hover:text-white flex items-center gap-3 transition text-left cursor-pointer"
              >
                <Folder className="w-4 h-4 text-slate-400" />
                <span className="truncate">attendace</span>
              </button>

              <button
                onClick={() => {
                  handleSend('Show standard daily PPM checklist for Diesel Generators and STP');
                  setMobileSidebarOpen(false);
                }}
                className="w-full px-3 py-2 rounded-lg hover:bg-white/5 hover:text-white flex items-center gap-3 transition text-left cursor-pointer"
              >
                <Folder className="w-4 h-4 text-slate-400" />
                <span className="truncate">Certificate Paradigm</span>
              </button>
            </div>
          </div>

          {/* Chat History */}
          {(todayConvs.length > 0 || earlierConvs.length > 0) && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 px-3 py-1">Today</div>
              <div className="space-y-0.5">
                {todayConvs.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => {
                      openTab(conv.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center justify-between group cursor-pointer ${
                      activeConversationId === conv.id
                        ? 'bg-[#212121] text-white font-medium'
                        : 'text-[#b4b4b4] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="truncate flex-1">{conv.title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 transition ml-1"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {earlierConvs.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 px-3 py-1">Earlier</div>
              <div className="space-y-0.5">
                {earlierConvs.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => {
                      openTab(conv.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center justify-between group cursor-pointer ${
                      activeConversationId === conv.id
                        ? 'bg-[#212121] text-white font-medium'
                        : 'text-[#b4b4b4] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="truncate flex-1">{conv.title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 transition ml-1"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Profile Capsule (Real User Profile) */}
        <div className="p-3 border-t border-white/5 relative">
          <div
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10 group-hover:ring-emerald-500/50 transition flex items-center justify-center bg-slate-800 flex-shrink-0 shadow-xs">
              <ProfilePlaceholder 
                photoUrl={user?.photoUrl || (user as any)?.photo_url || (user as any)?.avatar_url} 
                seed={user?.id} 
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition">
                {user?.name || 'Sudhan M'}
              </div>
              <div className="text-[10.5px] text-[#b4b4b4] font-medium truncate capitalize">
                {user?.role ? user.role.replace(/_/g, ' ') : 'Lead Operations'}
              </div>
            </div>
            
            {/* Version Badge moved below */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                v4.2 PRO
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Profile Menu Popup */}
          {profileMenuOpen && (
            <div className="absolute bottom-16 left-3 right-3 bg-[#2a2a2a] border border-white/10 rounded-2xl p-2 shadow-2xl z-50 text-xs text-[#ececec] animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-3 py-2 border-b border-white/5 mb-1">
                <div className="font-bold text-white text-xs truncate">{user?.name || 'Sudhan M'}</div>
                <div className="text-[10px] text-slate-400 truncate">{user?.email || 'operations@paradigmoffice.com'}</div>
              </div>

              <button
                onClick={() => {
                  toggleTheme();
                  setProfileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition text-left cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
                <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
              </button>

              <button
                onClick={() => {
                  handleBack();
                  setProfileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition text-left cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-400" />
                <span>Return to Paradigm ERP</span>
              </button>

              <div className="my-1 border-t border-white/5" />

              <button
                onClick={() => {
                  navigate('/profile');
                  setProfileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition text-left cursor-pointer"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Profile & Settings</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
        />
      )}

      {/* ── MAIN CHAT CANVAS ── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#212121]">

        {/* Minimalist Top Bar (Sleek Compact Size with Android Safe Area Protection) */}
        <header 
          className="assist-clean-header px-2.5 sm:px-3 flex items-center justify-between flex-shrink-0 z-20 bg-[#212121] border-b border-white/5 transition-all"
          style={{
            paddingTop: isMobile || isNative ? '3.25rem' : '0.5rem',
            paddingBottom: '0.45rem',
            minHeight: isMobile || isNative ? '5.25rem' : '2.75rem'
          }}
        >
          <div className="flex items-center gap-1.5">
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="hidden md:flex p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-white/5 transition cursor-pointer"
                title="Open sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Hamburger Button (matched to + button size) */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg !text-slate-400 hover:!text-white hover:bg-white/5 active:scale-95 transition cursor-pointer"
              style={{ color: '#94a3b8' }}
              title="Open menu"
            >
              <Menu size={18} strokeWidth={2.2} style={{ color: '#94a3b8', stroke: '#94a3b8' }} />
            </button>

            {sidebarCollapsed && (
              <button
                onClick={() => startNewConversation()}
                className="hidden md:flex p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-white/5 transition cursor-pointer"
                title="New chat"
              >
                <PenSquare className="w-4 h-4" />
              </button>
            )}

            {/* Subtle Site Selector Pill (Compact -30%) */}
            <div className="relative group ml-0.5">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[11px] font-medium text-slate-300 transition cursor-pointer border border-white/5">
                <Building2 className="w-3 h-3 text-emerald-400" />
                <span className="truncate max-w-[110px] sm:max-w-[200px]">{siteDisplayName}</span>
                <ChevronDown className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
              </div>
              <select
                value={selectedSiteId || ''}
                onChange={(e) => setSelectedSiteId(e.target.value || null)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              >
                <option value="" className="bg-[#212121] text-white">All Paradigm Sites (14 Locations)</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id} className="bg-[#212121] text-white">
                    {s.name} {s.city ? `(${s.city})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Top Actions: Refresh / Reset Conversation (matched to + button size) */}
          <div className="flex items-center gap-1 !text-slate-400 flex-shrink-0" style={{ color: '#94a3b8' }}>
            <button
              onClick={() => {
                startNewConversation();
                toast.success('Fresh chat ready');
              }}
              className="flex items-center justify-center w-8 h-8 md:w-auto md:h-auto md:p-1.5 rounded-lg hover:!text-white hover:bg-white/5 active:scale-95 transition cursor-pointer"
              style={{ color: '#94a3b8' }}
              title="Reset / Start new chat"
            >
              <RotateCw size={isMobile || isNative ? 18 : 16} strokeWidth={2.2} style={{ color: '#94a3b8', stroke: '#94a3b8' }} />
            </button>

            <button
              onClick={handleBack}
              className="flex items-center justify-center w-8 h-8 md:w-auto md:h-auto md:p-1.5 rounded-lg hover:!text-white hover:bg-white/5 active:scale-95 transition cursor-pointer"
              style={{ color: '#94a3b8' }}
              title="Return to ERP"
            >
              <ArrowLeft size={isMobile || isNative ? 18 : 16} strokeWidth={2.2} style={{ color: '#94a3b8', stroke: '#94a3b8' }} />
            </button>
          </div>
        </header>

        {/* ── Chat Stream Canvas or Center Welcome ── */}
        <div 
          className="flex-1 overflow-y-auto px-4 relative flex flex-col"
          style={{
            paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 1.5rem), 2.25rem)'
          }}
        >
          {messages.length === 0 ? (

            /* ── CHATGPT EMPTY STATE: "Ready when you are." with CENTER INPUT BOX ── */
            <div className="flex-1 flex flex-col items-center justify-center -mt-8 px-2 animate-in fade-in duration-300">

              {/* Hidden file input for real attachments */}
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.csv,.tsv,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Headline */}
              <h1 className="text-2xl sm:text-3xl font-medium text-white tracking-tight mb-6 text-center">
                Ready when you are.
              </h1>

              {/* Center Input Box (ChatGPT Red Box Area) */}
              <div className="w-full max-w-2xl bg-[#2f2f2f] border border-white/5 rounded-3xl p-3 sm:p-3.5 shadow-2xl transition focus-within:border-white/20">

                {/* Attached Files Preview Bar */}
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 px-1">
                    {attachedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-xs text-white shadow-xs">
                        {file.previewUrl ? (
                          <img src={file.previewUrl} alt={file.name} className="w-4 h-4 object-cover rounded" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        <span className="truncate max-w-[140px] font-medium">{file.name}</span>
                        <span className="text-[10px] text-slate-400">({file.size})</span>
                        {file.isExtracting ? (
                          <span className="text-[10px] text-amber-300 flex items-center gap-1 font-mono animate-pulse">
                            <RotateCw className="w-2.5 h-2.5 animate-spin" /> Parsing...
                          </span>
                        ) : file.extractedText ? (
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">
                            ✓ Ready
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => triggerLocalPythonAnalysis(file, idx)}
                          className="flex items-center gap-1 px-2 py-0.5 ml-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/30 font-medium text-[10px] cursor-pointer transition shadow-xs"
                          title="Run 100% Offline Python Attendance & Duty Analyzer"
                        >
                          <Cpu className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Run Python (Offline)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAttachedFile(idx)}
                          className="ml-1 p-0.5 hover:text-red-400 rounded transition cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input row */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition flex-shrink-0 cursor-pointer"
                    title="Attach equipment photo, PDF, or inspection log"
                  >
                    <Plus className="w-5 h-5" />
                  </button>

                  <textarea
                    ref={centerTextareaRef}
                    rows={1}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Paradigm Assist..."
                    style={{ backgroundColor: 'transparent', border: 'none', outline: 'none' }}
                    className="assist-transparent-input flex-1 !bg-transparent text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none !border-none resize-none py-1.5 max-h-36 leading-relaxed"
                  />

                  {/* Right Actions inside Box */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Think Pill */}
                    <button
                      type="button"
                      onClick={() => {
                        const next = !thinkEnabled;
                        setThinkEnabled(next);
                        if (next) {
                          toast.success('Think Mode: 100% Deterministic Grounding enabled', { icon: '🧠' });
                        } else {
                          toast('Standard conversational reasoning enabled', { icon: '💡' });
                        }
                      }}
                      className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
                        thinkEnabled ? 'bg-[#383838] text-white hover:bg-[#444444] border border-cyan-500/30' : 'bg-transparent text-slate-400 hover:text-white'
                      }`}
                      title={thinkEnabled ? "Deterministic ISO 9001:2015 Grounding Active" : "Click to enable Deep Grounding"}
                    >
                      <Brain className={`w-3.5 h-3.5 ${thinkEnabled ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span>Think</span>
                    </button>

                    {/* Mic button */}
                    <button
                      type="button"
                      onClick={toggleSpeechRecognition}
                      className={`p-2 rounded-full transition cursor-pointer ${
                        isListening
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                      title="Speech-to-text dictation"
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    {/* Blue Circular Voice / Submit Button (Live Voice Mode on Tap) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (input.trim() || attachedFiles.length > 0) {
                          handleSend();
                        } else {
                          toggleInteractiveVoiceMode();
                        }
                      }}
                      disabled={isLoading}
                      className={`w-8 h-8 rounded-full text-white flex items-center justify-center shadow-lg transition active:scale-95 flex-shrink-0 cursor-pointer ${
                        isListening
                          ? 'bg-red-500 animate-pulse'
                          : 'bg-[#1d7cf2] hover:bg-[#166ad5]'
                      }`}
                      title={input.trim() ? "Submit Inquiry" : "Tap for Hands-Free Voice Mode"}
                    >
                      {input.trim() || attachedFiles.length > 0 ? (
                        <Send className="w-3.5 h-3.5 -rotate-12 translate-x-px" />
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <span className={`w-0.5 rounded-full bg-white ${isListening ? 'h-4 animate-bounce' : 'h-3'}`} />
                          <span className={`w-0.5 rounded-full bg-white ${isListening ? 'h-5 animate-pulse' : 'h-4'}`} />
                          <span className={`w-0.5 rounded-full bg-white ${isListening ? 'h-3.5 animate-bounce' : 'h-2.5'}`} />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Real Enterprise Operational Prompt Links (Replaced generic consumer ChatGPT text) */}
              <div className="mt-7 flex flex-col gap-3 w-full max-w-md text-left">
                <button
                  onClick={() => handleSend('What is Nikoo Homes present today?')}
                  className="flex items-center gap-3 text-sm text-[#ececec] hover:text-white transition group cursor-pointer"
                >
                  <ClipboardList className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition flex-shrink-0" />
                  <span className="font-normal">Live site biometric attendance & roster audit</span>
                </button>

                <button
                  onClick={() => handleSend('Draft a detailed MEP shift handover and incident escalation report')}
                  className="flex items-center gap-3 text-sm text-[#ececec] hover:text-white transition group cursor-pointer"
                >
                  <PenSquare className="w-4 h-4 text-blue-400 group-hover:scale-110 transition flex-shrink-0" />
                  <span className="font-normal">Draft shift handover or incident ticket</span>
                </button>

                <button
                  onClick={() => handleSend('What is the standard operating procedure for DG cold start and Chiller trip?')}
                  className="flex items-center gap-3 text-sm text-[#ececec] hover:text-white transition group cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition flex-shrink-0" />
                  <span className="font-normal">Search verified ISO 9001:2015 manuals & SOPs</span>
                </button>

                <button
                  onClick={() => handleSend('How many pending onboarding forms and vendor KYC documents do we have?')}
                  className="flex items-center gap-3 text-sm text-[#ececec] hover:text-white transition group cursor-pointer"
                >
                  <Users className="w-4 h-4 text-purple-400 group-hover:scale-110 transition flex-shrink-0" />
                  <span className="font-normal">Check pending onboarding & statutory compliance</span>
                </button>
              </div>

              {/* Real-time Enterprise Confidence Badges */}
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-[10.5px] text-slate-400">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Database Connected · 18ms</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>100% Deterministic ISO 9001</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>428 Live Staff Tracked</span>
                </div>
              </div>

            </div>

          ) : (

            /* ── CHATTING MESSAGES STREAM (Clean ChatGPT Aesthetic) ── */
            <div className="flex-1 max-w-3xl w-full mx-auto space-y-6 py-6 pb-28 px-4 sm:px-0">
              {messages.map((msg) => (
                <div key={msg.id} className="w-full">
                  {msg.sender === 'user' ? (
                    /* User Message: Clean right-aligned capsule */
                    <div className="flex justify-end my-2">
                      <div className="bg-[#2f2f2f] text-white px-4 py-2.5 rounded-3xl max-w-xl text-[14px] leading-relaxed shadow-xs border border-white/5">
                        {renderUserBubbleContent(msg.content)}
                      </div>
                    </div>
                  ) : (
                    /* Assistant Message: Clean left-aligned flowing stream (No bulky card box!) */
                    <div className="flex gap-4 items-start my-4 text-[#ececec]">
                      <AssistBotAvatar size="sm" className="mt-1 flex-shrink-0" />

                      <div className="flex-1 min-w-0 space-y-3">
                        {/* Emergency Banner */}
                        {msg.isEmergency && (
                          <div className="flex items-center gap-2 mb-3 px-3.5 py-2 rounded-xl bg-red-950/40 border border-red-500/40 text-red-400 font-extrabold text-xs">
                            <AlertTriangle className="w-4 h-4 animate-bounce" />
                            CRITICAL LIFE-SAFETY EMERGENCY PROTOCOL TRIGGERED
                          </div>
                        )}

                        {/* Rich Markdown Response */}
                        <div className="text-[14px] text-[#ececec] leading-relaxed">
                          <MarkdownMessage content={msg.content} isUser={false} />
                        </div>

                        {/* Interactive Action Launcher Card */}
                        {msg.actionApp && (
                          <ActionLauncherCard app={msg.actionApp} />
                        )}

                        {/* Verified Sources Citations Chips */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="pt-2 flex flex-wrap gap-1.5 items-center">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mr-1">
                              Verified Grounding:
                            </span>
                            {msg.sources.map((src, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-emerald-300 font-medium"
                              >
                                📄 {src.title}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Action & Feedback Toolbar */}
                        <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                            {msg.confidence !== undefined && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-semibold">
                                {Math.round(msg.confidence * 100)}% Verified Grounding
                              </span>
                            )}
                            {msg.latency_ms && (
                              <span className="text-[10px] text-slate-500">
                                {msg.latency_ms}ms
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-400">
                            <button
                              onClick={() => handleSpeak(msg.content)}
                              className="p-1 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
                              title="Read aloud"
                            >
                              {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-cyan-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleCopy(msg.content, msg.id)}
                              className="p-1 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
                              title="Copy to clipboard"
                            >
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => sendFeedback(msg.id, 1)}
                              className={`p-1 hover:text-white hover:bg-white/10 rounded transition cursor-pointer ${
                                msg.feedback_rating === 1 ? 'text-emerald-400' : ''
                              }`}
                              title="Helpful"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => sendFeedback(msg.id, -1)}
                              className={`p-1 hover:text-white hover:bg-white/10 rounded transition cursor-pointer ${
                                msg.feedback_rating === -1 ? 'text-red-400' : ''
                              }`}
                              title="Not helpful"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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

        {/* ── Fixed Bottom Input Dock (Only when in conversation) ── */}
        {messages.length > 0 && (
          <div 
            className="px-4 py-3 bg-[#212121]/95 backdrop-blur-xl flex-shrink-0 z-20 border-t border-white/5"
            style={{
              paddingBottom: 'calc(0.5rem + max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px)))'
            }}
          >
            <div className="max-w-3xl mx-auto">
              {/* Attached Files Preview Bar in bottom dock */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 px-1">
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-xs text-white shadow-xs">
                      {file.previewUrl ? (
                        <img src={file.previewUrl} alt={file.name} className="w-4 h-4 object-cover rounded" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span className="truncate max-w-[140px] font-medium">{file.name}</span>
                      <span className="text-[10px] text-slate-400">({file.size})</span>
                      {file.isExtracting ? (
                        <span className="text-[10px] text-amber-300 flex items-center gap-1 font-mono animate-pulse">
                          <RotateCw className="w-2.5 h-2.5 animate-spin" /> Parsing...
                        </span>
                      ) : file.extractedText ? (
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">
                          ✓ Ready
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => triggerLocalPythonAnalysis(file, idx)}
                        className="flex items-center gap-1 px-2 py-0.5 ml-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/30 font-medium text-[10px] cursor-pointer transition shadow-xs"
                        title="Run 100% Offline Python Attendance & Duty Analyzer"
                      >
                        <Cpu className="w-2.5 h-2.5 text-emerald-400" />
                        <span>Run Python (Offline)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAttachedFile(idx)}
                        className="ml-1 p-0.5 hover:text-red-400 rounded transition cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2.5 bg-[#2f2f2f] border border-white/10 rounded-3xl p-2.5 px-4 shadow-xl focus-within:border-white/20 transition">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition flex-shrink-0 cursor-pointer"
                  title="Attach equipment photo, PDF, or inspection log"
                >
                  <Plus className="w-5 h-5" />
                </button>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Paradigm Assist..."
                  style={{ backgroundColor: 'transparent', border: 'none', outline: 'none' }}
                  className="assist-transparent-input flex-1 !bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none !border-none resize-none py-1 max-h-36 leading-relaxed"
                />

                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={`p-1.5 rounded-full transition cursor-pointer ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Voice input"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (input.trim() || attachedFiles.length > 0) {
                      handleSend();
                    } else {
                      toggleInteractiveVoiceMode();
                    }
                  }}
                  disabled={isLoading}
                  className={`w-8 h-8 rounded-full text-white flex items-center justify-center transition flex-shrink-0 shadow-md cursor-pointer ${
                    isListening ? 'bg-red-500 animate-pulse' : 'bg-[#1d7cf2] hover:bg-[#166ad5]'
                  }`}
                  title={input.trim() ? "Submit" : "Voice mode"}
                >
                  {input.trim() || attachedFiles.length > 0 ? (
                    <Send className="w-3.5 h-3.5 -rotate-12 translate-x-px" />
                  ) : (
                    <div className="flex items-center gap-0.5">
                      <span className={`w-0.5 rounded-full bg-white ${isListening ? 'h-4 animate-bounce' : 'h-3'}`} />
                      <span className={`w-0.5 rounded-full bg-white ${isListening ? 'h-5 animate-pulse' : 'h-4'}`} />
                      <span className={`w-0.5 rounded-full bg-white ${isListening ? 'h-3.5 animate-bounce' : 'h-2.5'}`} />
                    </div>
                  )}
                </button>
              </div>

              <div className="mt-2 text-center text-[11px] text-slate-500">
                Paradigm Assist can make mistakes. Verify important operational info.
              </div>
            </div>
          </div>
        )}
      </main>

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
          if (centerTextareaRef.current) {
            centerTextareaRef.current.focus();
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
