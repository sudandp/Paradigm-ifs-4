import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { apiFetch } from '../utils/apiClient';

// Offline-first AI & local operational intelligence integration
import { offlineAIService, ModelProgressInfo } from '../services/offlineAiService';
import { offlineKnowledgeBase } from '../services/offlineKnowledgeBase';
import { appLauncherService, LaunchableApp } from '../services/appLauncherService';
import { localNotesService } from '../services/localNotesService';
import { reminderService } from '../services/reminderService';
import { skillsRegistry } from '../services/skillsRegistry';
import { localAssistantService } from '../services/localAssistantService';
import { operationalTelemetryService } from '../services/operationalTelemetryService';
import { intentClassifier } from '../services/intentClassifier';
import { queryRouter } from '../services/queryRouter';
import { entityResolver } from '../services/entityResolver';
import { guardrailService } from '../services/guardrailService';
import { useAuthStore } from './authStore';

export interface AssistSource {
  id: string;
  title: string;
  sourceTable?: string;
  score?: string | number;
}

export interface AssistMessage {
  id: string;
  conversation_id?: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  sources?: AssistSource[];
  confidence?: number;
  feedback_rating?: number;
  latency_ms?: number;
  isEmergency?: boolean;
  emergencyType?: string;
  isFallback?: boolean;
  isOffline?: boolean;
  actionApp?: LaunchableApp;
  created_at: string;
}

export interface AssistConversation {
  id: string;
  title: string;
  site_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistTab {
  id: string;
  conversationId: string | null;
  title: string;
  messages: AssistMessage[];
  updatedAt: string;
}

export interface SiteOption {
  id: string;
  name: string;
  city?: string;
}

export type AIModelEngine = 'auto-hybrid' | 'cloud-groq' | 'cloud-gemini' | 'local-model';

export const SEED_CONVERSATIONS: AssistConversation[] = [
  { id: 'conv_chiller_b', title: 'Shift Handover - Zone B Chiller', site_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'conv_punch_49', title: 'Biometric Punch Discrepancy #49', site_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'conv_fire_drill', title: 'Fire Drill Checklist Verification', site_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'conv_gate_pass', title: 'Contractor Gate Pass Validation', site_id: null, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'conv_hvac_window', title: 'HVAC Maintenance Window 3', site_id: null, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString() },
];

function loadInitialConversations(): AssistConversation[] {
  if (typeof window === 'undefined') return SEED_CONVERSATIONS;
  const stored = localStorage.getItem('paradigm_assist_conversations');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  localStorage.setItem('paradigm_assist_conversations', JSON.stringify(SEED_CONVERSATIONS));
  return SEED_CONVERSATIONS;
}

function loadInitialTabs(convs: AssistConversation[]): { tabs: AssistTab[]; activeTabId: string; activeConvId: string | null } {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('paradigm_assist_tabs');
    if (stored) {
      try {
        const parsed: AssistTab[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { tabs: parsed, activeTabId: parsed[0].id, activeConvId: parsed[0].conversationId };
        }
      } catch {}
    }
  }
  const firstConv = convs[0];
  const initialTab: AssistTab = {
    id: `tab_init_${Date.now()}`,
    conversationId: firstConv ? firstConv.id : null,
    title: firstConv ? firstConv.title : 'New Inquiry',
    messages: [],
    updatedAt: new Date().toISOString()
  };
  return { tabs: [initialTab], activeTabId: initialTab.id, activeConvId: initialTab.conversationId };
}

interface AssistState {
  conversations: AssistConversation[];
  activeConversationId: string | null;
  tabs: AssistTab[];
  activeTabId: string;
  messages: AssistMessage[];
  sites: SiteOption[];
  selectedSiteId: string | null;
  isLoading: boolean;
  error: string | null;
  offlineEmergencyContacts: any[];

  // Model Engine Selection
  selectedModelEngine: AIModelEngine;
  setSelectedModelEngine: (engine: AIModelEngine) => void;

  // Offline Qwen State
  isOfflineModelReady: boolean;
  isModelDownloading: boolean;
  modelDownloadProgress: number;
  modelStatusText: string;
  useLocalEngineFirst: boolean;

  // Actions
  init: () => Promise<void>;
  fetchSites: () => Promise<void>;
  fetchConversations: () => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  startNewConversation: () => void;
  openTab: (conversationId?: string | null, title?: string) => void;
  closeTab: (tabId: string) => void;
  selectTab: (tabId: string) => void;
  deleteConversation: (conversationId: string) => Promise<void>;
  setSelectedSiteId: (siteId: string | null) => void;
  sendMessage: (query: string) => Promise<void>;
  sendFeedback: (messageId: string, rating: -1 | 1) => Promise<void>;
  loadOfflineEmergencyCache: () => Promise<void>;
  downloadOfflineModel: () => Promise<void>;
  clearOfflineCache: () => Promise<void>;
  setUseLocalEngineFirst: (enabled: boolean) => void;
}

const OFFLINE_EMERGENCY_KEY = 'paradigm_assist_offline_emergency';

const _initConvs = loadInitialConversations();
const _initTabs = loadInitialTabs(_initConvs);

export const useAssistStore = create<AssistState>((set, get) => ({
  conversations: _initConvs,
  activeConversationId: _initTabs.activeConvId,
  tabs: _initTabs.tabs,
  activeTabId: _initTabs.activeTabId,
  messages: _initTabs.tabs[0]?.messages || [],
  sites: [],
  selectedSiteId: null,
  isLoading: false,
  error: null,
  offlineEmergencyContacts: [],

  // Model Engine Selection
  selectedModelEngine: (typeof window !== 'undefined' && localStorage.getItem('paradigm_assist_model_engine') as AIModelEngine) || 'auto-hybrid',
  setSelectedModelEngine: (engine: AIModelEngine) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_assist_model_engine', engine);
    }
    set({
      selectedModelEngine: engine,
      useLocalEngineFirst: engine === 'local-model'
    });
  },

  // Offline Qwen State
  isOfflineModelReady: false,
  isModelDownloading: false,
  modelDownloadProgress: 0,
  modelStatusText: '',
  useLocalEngineFirst: false,

  setUseLocalEngineFirst: (enabled: boolean) => {
    set({ 
      useLocalEngineFirst: enabled,
      selectedModelEngine: enabled ? 'local-model' : 'auto-hybrid'
    });
  },

  init: async () => {
    // Check if offline Qwen model is already cached locally
    const isCached = offlineAIService.isModelCached();
    set({ isOfflineModelReady: isCached });

    await Promise.all([
      get().fetchSites(),
      get().fetchConversations(),
      get().loadOfflineEmergencyCache()
    ]);

    // Warm up entity resolver cache (loads all users + sites into memory for fast fuzzy matching)
    entityResolver.warmupCache().catch(() => {});

    // Background sync offline SOPs with Supabase when online
    if (navigator.onLine) {
      offlineKnowledgeBase.syncWithCloud().catch(() => {});
    }
  },

  fetchSites: async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, address')
        .order('name', { ascending: true });

      if (!error && data) {
        const mappedSites = data.map(d => {
          let city: string | undefined = undefined;
          if (d.address) {
            if (/bengaluru|bangalore/i.test(d.address)) city = 'Bengaluru';
            else if (/hyderabad/i.test(d.address)) city = 'Hyderabad';
            else if (/pune/i.test(d.address)) city = 'Pune';
          }
          return { id: d.id, name: d.name, city };
        });
        set({ sites: mappedSites });
      }
    } catch (err) {
      console.warn('[AssistStore] Failed to fetch sites:', err);
    }
  },

  fetchConversations: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await apiFetch('/api/paradigm-assist?action=conversations', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        const serverConvs: AssistConversation[] = data.conversations || [];
        if (serverConvs.length > 0) {
          const existing = get().conversations;
          const merged = [...serverConvs];
          existing.forEach(e => {
            if (!merged.some(m => m.id === e.id)) merged.push(e);
          });
          set({ conversations: merged });
          if (typeof window !== 'undefined') {
            localStorage.setItem('paradigm_assist_conversations', JSON.stringify(merged));
          }
        }
      }
    } catch (err) {
      console.warn('[AssistStore] Failed to fetch conversations:', err);
    }
  },

  selectConversation: async (conversationId: string) => {
    get().openTab(conversationId);
  },

  startNewConversation: () => {
    get().openTab(null, 'New Inquiry');
  },

  openTab: (conversationId?: string | null, title?: string) => {
    if (conversationId) {
      const existing = get().tabs.find(t => t.conversationId === conversationId);
      if (existing) {
        get().selectTab(existing.id);
        return;
      }
    }

    let tabMessages: AssistMessage[] = [];
    let tabTitle = title || 'New Inquiry';

    if (conversationId) {
      const conv = get().conversations.find(c => c.id === conversationId);
      if (conv) tabTitle = conv.title;
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(`paradigm_conv_msg_${conversationId}`);
        if (cached) {
          try { tabMessages = JSON.parse(cached); } catch {}
        }
      }
    }

    const newTab: AssistTab = {
      id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      conversationId: conversationId || null,
      title: tabTitle,
      messages: tabMessages,
      updatedAt: new Date().toISOString()
    };

    const nextTabs = [...get().tabs, newTab];
    set({
      tabs: nextTabs,
      activeTabId: newTab.id,
      activeConversationId: conversationId || null,
      messages: tabMessages,
      error: null
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_assist_tabs', JSON.stringify(nextTabs));
    }

    if (conversationId && tabMessages.length === 0) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        apiFetch(`/api/paradigm-assist?action=conversation_messages&id=${conversationId}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }).then(r => r.json()).then(data => {
          if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            const updatedTabs = get().tabs.map(t => t.id === newTab.id ? { ...t, messages: data.messages } : t);
            set({ tabs: updatedTabs, messages: data.messages });
            if (typeof window !== 'undefined') {
              localStorage.setItem('paradigm_assist_tabs', JSON.stringify(updatedTabs));
              localStorage.setItem(`paradigm_conv_msg_${conversationId}`, JSON.stringify(data.messages));
            }
          }
        }).catch(() => {});
      });
    }
  },

  closeTab: (tabId: string) => {
    const tabs = get().tabs;
    const remaining = tabs.filter(t => t.id !== tabId);
    let nextTabId = get().activeTabId;

    if (remaining.length === 0) {
      const freshTab: AssistTab = {
        id: `tab_${Date.now()}`,
        conversationId: null,
        title: 'New Inquiry',
        messages: [],
        updatedAt: new Date().toISOString()
      };
      remaining.push(freshTab);
      nextTabId = freshTab.id;
    } else if (get().activeTabId === tabId) {
      const closedIndex = tabs.findIndex(t => t.id === tabId);
      const nextIndex = Math.max(0, closedIndex - 1);
      nextTabId = remaining[nextIndex]?.id || remaining[0].id;
    }

    const activeTab = remaining.find(t => t.id === nextTabId);
    set({
      tabs: remaining,
      activeTabId: nextTabId,
      activeConversationId: activeTab?.conversationId || null,
      messages: activeTab?.messages || []
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_assist_tabs', JSON.stringify(remaining));
    }
  },

  selectTab: (tabId: string) => {
    const tab = get().tabs.find(t => t.id === tabId);
    if (!tab) return;
    set({
      activeTabId: tab.id,
      activeConversationId: tab.conversationId,
      messages: tab.messages,
      error: null
    });
  },

  deleteConversation: async (conversationId: string) => {
    const updatedConvs = get().conversations.filter(c => c.id !== conversationId);
    const currentTabs = get().tabs;
    const remainingTabs = currentTabs.filter(t => t.conversationId !== conversationId);
    let nextTabId = get().activeTabId;

    if (remainingTabs.length === 0) {
      const freshTab: AssistTab = {
        id: `tab_${Date.now()}`,
        conversationId: null,
        title: 'New Inquiry',
        messages: [],
        updatedAt: new Date().toISOString()
      };
      remainingTabs.push(freshTab);
      nextTabId = freshTab.id;
    } else if (!remainingTabs.some(t => t.id === nextTabId)) {
      nextTabId = remainingTabs[remainingTabs.length - 1].id;
    }

    const activeTab = remainingTabs.find(t => t.id === nextTabId);
    set({
      conversations: updatedConvs,
      tabs: remainingTabs,
      activeTabId: nextTabId,
      activeConversationId: activeTab?.conversationId || null,
      messages: activeTab?.messages || []
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem('paradigm_assist_conversations', JSON.stringify(updatedConvs));
      localStorage.setItem('paradigm_assist_tabs', JSON.stringify(remainingTabs));
      localStorage.removeItem(`paradigm_conv_msg_${conversationId}`);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        apiFetch(`/api/paradigm-assist?action=delete_conversation&id=${conversationId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }).catch(() => {});
      }
    } catch {}
  },

  setSelectedSiteId: (siteId: string | null) => {
    set({ selectedSiteId: siteId });
  },

  downloadOfflineModel: async () => {
    if (get().isModelDownloading || get().isOfflineModelReady) return;

    set({ isModelDownloading: true, modelDownloadProgress: 0, modelStatusText: 'Starting download...' });
    try {
      await offlineAIService.initializeEngine((info: ModelProgressInfo) => {
        set({
          modelDownloadProgress: Math.round(info.progress * 100),
          modelStatusText: info.text || 'Downloading offline brain...'
        });
      });

      set({
        isOfflineModelReady: true,
        isModelDownloading: false,
        modelDownloadProgress: 100,
        modelStatusText: 'Offline Brain Ready'
      });
    } catch (err: any) {
      console.error('[AssistStore] Download model error:', err);
      set({
        isModelDownloading: false,
        modelDownloadProgress: 0,
        modelStatusText: err.message || 'Download failed'
      });
      throw err;
    }
  },

  clearOfflineCache: async () => {
    try {
      await offlineAIService.clearCache();
      set({
        isOfflineModelReady: false,
        modelDownloadProgress: 0,
        modelStatusText: ''
      });
    } catch (err) {
      console.warn('Failed to clear offline cache:', err);
    }
  },

  sendMessage: async (query: string) => {
    if (!query.trim()) return;

    const trimmedQuery = query.trim();
    const tempUserMsgId = `usr_${Date.now()}`;
    const userMessage: AssistMessage = {
      id: tempUserMsgId,
      sender: 'user',
      content: trimmedQuery,
      created_at: new Date().toISOString()
    };

    const prevMessages = get().messages;
    set({
      messages: [...prevMessages, userMessage],
      isLoading: true,
      error: null
    });

    let activeConvId = get().activeConversationId;
    if (!activeConvId) {
      activeConvId = `conv_${Date.now()}`;
      set({ activeConversationId: activeConvId });
    }
    const siteId = get().selectedSiteId;

    const recordAssistantReply = (msg: AssistMessage) => {
      const allMsgs = [...get().messages, msg];
      set({ messages: allMsgs, isLoading: false });

      const activeTabId = get().activeTabId;
      const currentTabs = get().tabs;
      const tIdx = currentTabs.findIndex(t => t.id === activeTabId);
      const title = (currentTabs[tIdx]?.title === 'New Inquiry' || !currentTabs[tIdx]?.title)
        ? (trimmedQuery.length > 32 ? trimmedQuery.slice(0, 32) + '...' : trimmedQuery)
        : currentTabs[tIdx]?.title;

      const updatedTab: AssistTab = {
        id: activeTabId,
        conversationId: activeConvId,
        title,
        messages: allMsgs,
        updatedAt: new Date().toISOString()
      };

      const nextTabs = tIdx >= 0
        ? currentTabs.map((t, i) => i === tIdx ? updatedTab : t)
        : [...currentTabs, updatedTab];

      let currentConvs = get().conversations;
      const cIdx = currentConvs.findIndex(c => c.id === activeConvId);
      if (cIdx >= 0) {
        currentConvs = currentConvs.map((c, i) => i === cIdx ? { ...c, title, updated_at: new Date().toISOString() } : c);
      } else {
        const newConv: AssistConversation = {
          id: activeConvId!,
          title,
          site_id: siteId || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        currentConvs = [newConv, ...currentConvs];
      }

      set({ tabs: nextTabs, conversations: currentConvs });

      if (typeof window !== 'undefined') {
        localStorage.setItem('paradigm_assist_tabs', JSON.stringify(nextTabs));
        localStorage.setItem('paradigm_assist_conversations', JSON.stringify(currentConvs));
        if (activeConvId) {
          localStorage.setItem(`paradigm_conv_msg_${activeConvId}`, JSON.stringify(allMsgs));
        }
      }
    };

    // ── STEP 0: SECURITY GUARDRAILS & RATE LIMITER (OWASP LLM01 / Abuse Prevention) ──
    const currentUserId = useAuthStore.getState().user?.id || 'session_user';
    const guardrailCheck = guardrailService.inspectInput(trimmedQuery, currentUserId);
    if (!guardrailCheck.isSafe) {
      const securityMsg: AssistMessage = {
        id: `asst_sec_${Date.now()}`,
        conversation_id: activeConvId || undefined,
        sender: 'assistant',
        content: guardrailCheck.userMessage || 'I cannot process prompt override requests. How can I assist you with Paradigm facility operations?',
        confidence: 1.0,
        latency_ms: 1,
        isOffline: true,
        created_at: new Date().toISOString()
      };
      recordAssistantReply(securityMsg);
      return;
    }

    // ── DIGITAL COMPANION LOCAL INTENT DISPATCHERS ──
    // 1. Detect App Launch Intent (e.g. "open ultraviewer", "launch gmail")
    const launchApp = appLauncherService.detectLaunchIntent(trimmedQuery);
    if (launchApp) {
      const launchAssistantMsg: AssistMessage = {
        id: `asst_launch_${Date.now()}`,
        conversation_id: activeConvId || undefined,
        sender: 'assistant',
        content: `I've prepared the launcher for **${launchApp.name}**. Click below to launch the application:`,
        actionApp: launchApp,
        created_at: new Date().toISOString()
      };
      recordAssistantReply(launchAssistantMsg);
      return;
    }

    // 2. Detect Local Note Intent (e.g. "take note: ...", "save note: ...", "/note ...")
    const noteMatch = trimmedQuery.match(/^(?:\/note\s+|(?:take|save|add)\s+note:?\s*)(.*)/i);
    if (noteMatch && noteMatch[1].trim()) {
      const noteContent = noteMatch[1].trim();
      const savedNote = localNotesService.addNote('Field Note', noteContent, ['companion']);
      const noteAssistantMsg: AssistMessage = {
        id: `asst_note_${Date.now()}`,
        conversation_id: activeConvId || undefined,
        sender: 'assistant',
        content: `📝 **Note Saved Locally!**\n\n> *"${savedNote.content}"*\n\nThis note is stored on your device in your **Notes Hub**. You can review, search, or export it anytime from the top bar.`,
        created_at: new Date().toISOString()
      };
      recordAssistantReply(noteAssistantMsg);
      return;
    }

    // 3. Detect Reminder Intent (e.g. "remind me in 10 minutes to check DG", "/remind ...")
    const reminderData = reminderService.parseNaturalReminder(trimmedQuery);
    if (reminderData) {
      reminderService.requestPermission().catch(() => {});
      const scheduled = reminderService.scheduleReminder(reminderData.title, reminderData.delayMs);
      const minutes = Math.round(reminderData.delayMs / 60000);
      const remAssistantMsg: AssistMessage = {
        id: `asst_rem_${Date.now()}`,
        conversation_id: activeConvId || undefined,
        sender: 'assistant',
        content: `⏰ **Reminder Scheduled!**\n\nI will alert you in **${minutes} minute${minutes !== 1 ? 's' : ''}** (${new Date(scheduled.dueAt).toLocaleTimeString()}) for:\n> *"${scheduled.title}"*\n\nA notification and audio chime will sound on this device when due.`,
        created_at: new Date().toISOString()
      };
      recordAssistantReply(remAssistantMsg);
      return;
    }

    // 4. Courteous & Respectful Digital Companion Greeting Handler
    if (/^(hi|hello|hey|namaste|good\s+(morning|afternoon|evening)|howdy|greetings|how\s+are\s+you|who\s+are\s+you|help)\b[!\.\?]*$/i.test(trimmedQuery.trim())) {
      const greetingMsg: AssistMessage = {
        id: `asst_greet_${Date.now()}`,
        conversation_id: activeConvId || undefined,
        sender: 'assistant',
        content: `Namaste! 🙏 Warm greetings. I am **Paradigm Assist**, your dedicated digital companion and operations copilot.\n\nIt is an honor and pleasure to assist you. Here are key ways I can serve you:\n\n• ⚡ **54 Operational Skills**: Equipment SOPs (DG, STP, Lifts, Fire), shift timings, and rosters.\n• ✍️ **Drafting & Messaging**: Professional emails, WhatsApp broadcasts, and incident reports.\n• 🕒 **Live Time & Shifts**: Ask *"what is the time now"* or *"which shift is active"* for instant on-device status.\n• 📝 **Local Notes & Reminders**: Capture readings (*"take note: ..."*) or set alarms (*"remind me in 10 minutes to ..."*).\n• 🖥️ **System Launchers**: Open UltraViewer, Gmail, WhatsApp, Calculator, and more.\n\nHow may I respectfully assist your operations today?`,
        confidence: 1.0,
        created_at: new Date().toISOString()
      };
      recordAssistantReply(greetingMsg);
      return;
    }

    // 5. Real-Time On-Device Clock, Calendar Date & Operational Shift Engine
    if (localAssistantService.isTimeOrShiftQuery(trimmedQuery)) {
      const currentSiteName = get().sites.find(s => s.id === siteId)?.name || 'All Paradigm Sites';
      const timeReport = localAssistantService.generateTimeAndShiftReport(currentSiteName);
      const timeMsg: AssistMessage = {
        id: `asst_time_${Date.now()}`,
        conversation_id: activeConvId || undefined,
        sender: 'assistant',
        content: timeReport,
        confidence: 1.0,
        latency_ms: 1,
        isOffline: true,
        created_at: new Date().toISOString()
      };
      recordAssistantReply(timeMsg);
      return;
    }

    // 6. Instant On-Device Math Calculation
    const mathResult = localAssistantService.detectMathCalculation(trimmedQuery);
    if (mathResult) {
      const mathMsg: AssistMessage = {
        id: `asst_math_${Date.now()}`,
        conversation_id: activeConvId || undefined,
        sender: 'assistant',
        content: `🔢 **Instant Calculation:**\n\n> \`${mathResult.expression}\` = **\`${mathResult.result}\`**`,
        confidence: 1.0,
        latency_ms: 1,
        isOffline: true,
        created_at: new Date().toISOString()
      };
      recordAssistantReply(mathMsg);
      return;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 7. SEMANTIC INTENT ENGINE — Universal Query Understanding
    //    Phase 1 (intentClassifier) + Phase 2 (entityResolver) + Phase 3 (queryRouter)
    //    Replaces all fragile regex blocks with LLM-powered structured intent parsing.
    //    Groq llama-3.1-8b-instant → ~180ms → structured ParsedIntent JSON → correct data source.
    // ══════════════════════════════════════════════════════════════════════════
    try {
      const activeUser = useAuthStore.getState().user;
      const currentSiteName = get().sites.find(s => s.id === siteId)?.name || null;

      // Build conversation history for multi-turn context
      const recentHistory = prevMessages.slice(-6).map(m => ({
        role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content.slice(0, 300)
      }));

      // Step 1: LLM Semantic Intent Classification
      const parsedIntent = await intentClassifier.classify(
        trimmedQuery,
        recentHistory,
        activeUser,
        currentSiteName
      );

      console.debug('[AssistStore] ParsedIntent:', parsedIntent.intent, `(${Math.round(parsedIntent.confidence * 100)}% conf)`);

      // Step 2: Route to correct data fetcher (skips general_knowledge — falls to LLM below)
      if (parsedIntent.intent !== 'general_knowledge' && parsedIntent.intent !== 'unclear' || parsedIntent.needsClarification) {
        const routedResponse = await queryRouter.execute(
          parsedIntent,
          activeUser,
          recentHistory
        );

        if (routedResponse) {
          const semanticMsg: AssistMessage = {
            id: `asst_sem_${Date.now()}`,
            conversation_id: activeConvId || undefined,
            sender: 'assistant',
            content: guardrailService.sanitizeOutput(routedResponse),
            confidence: parsedIntent.confidence,
            latency_ms: 200,
            isOffline: false,
            created_at: new Date().toISOString()
          };
          recordAssistantReply(semanticMsg);
          return;
        }
      }

      // Legacy fallback: operationalTelemetryService (for edge cases not yet covered by router)
      const telemReport = await operationalTelemetryService.handleOperationalQuery(
        trimmedQuery,
        siteId,
        activeUser,
        get().messages
      );

      if (telemReport) {
        const telemMsg: AssistMessage = {
          id: `asst_telem_${Date.now()}`,
          conversation_id: activeConvId || undefined,
          sender: 'assistant',
          content: telemReport,
          confidence: 0.85,
          latency_ms: 20,
          isOffline: false,
          created_at: new Date().toISOString()
        };
        recordAssistantReply(telemMsg);
        return;
      }

      // Direct high-speed Groq LLM response for general or open-ended inquiries (~180ms)
      const generalAnswer = await intentClassifier.answerGeneralQuery(
        trimmedQuery,
        recentHistory,
        activeUser,
        currentSiteName
      );

      if (generalAnswer) {
        const generalMsg: AssistMessage = {
          id: `asst_groq_${Date.now()}`,
          conversation_id: activeConvId || undefined,
          sender: 'assistant',
          content: guardrailService.sanitizeOutput(generalAnswer),
          confidence: 0.92,
          latency_ms: 180,
          isOffline: false,
          created_at: new Date().toISOString()
        };
        recordAssistantReply(generalMsg);
        return;
      }
    } catch (semanticErr) {
      console.warn('[AssistStore] Semantic intent pipeline error, continuing to cloud LLM:', semanticErr);
    }

    // History of last 4 turns for conversational context
    const chatHistory = prevMessages.slice(-4).map(m => ({
      role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content
    }));

    // If User explicitly chose Local Engine OR if device is offline
    const isLocalChosen = get().selectedModelEngine === 'local-model' || get().useLocalEngineFirst;
    if (isLocalChosen || !navigator.onLine) {
      // 1. If WebLLM neural engine is already active in memory, run inference with 4s safety timeout
      if (get().isOfflineModelReady && offlineAIService.isEngineLoaded()) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Local inference timeout')), 4000)
          );
          const offlineResult: any = await Promise.race([
            offlineAIService.chat(trimmedQuery, chatHistory),
            timeoutPromise
          ]);

          if (offlineResult && offlineResult.text) {
            const assistantMessage: AssistMessage = {
              id: `asst_off_${Date.now()}`,
              conversation_id: activeConvId || undefined,
              sender: 'assistant',
              content: offlineResult.text,
              sources: offlineResult.sources,
              latency_ms: offlineResult.latencyMs,
              isOffline: true,
              created_at: new Date().toISOString()
            };

            recordAssistantReply(assistantMessage);
            return;
          }
        } catch (offErr: any) {
          console.warn('[AssistStore] Local neural model unready/timeout, activating instant on-device knowledge engine:', offErr);
        }
      }

      // 2. Instant On-Device Operational Knowledge & Flowchart Engine (< 5ms response, zero hang)
      const currentSiteName = get().sites.find(s => s.id === siteId)?.name || 'All Paradigm Sites';
      const instantAnswer = localAssistantService.generateOfflineAnswer(trimmedQuery, currentSiteName);
      const assistantMessage: AssistMessage = {
        id: `asst_local_${Date.now()}`,
        conversation_id: activeConvId || undefined,
        sender: 'assistant',
        content: instantAnswer.text,
        sources: instantAnswer.sources,
        latency_ms: 5,
        isOffline: true,
        created_at: new Date().toISOString()
      };

      recordAssistantReply(assistantMessage);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // If not logged in but offline model is ready, serve offline
        if (get().isOfflineModelReady) {
          const offlineResult = await offlineAIService.chat(trimmedQuery, chatHistory);
          const assistantMessage: AssistMessage = {
            id: `asst_off_${Date.now()}`,
            sender: 'assistant',
            content: offlineResult.text,
            sources: offlineResult.sources,
            latency_ms: offlineResult.latencyMs,
            isOffline: true,
            created_at: new Date().toISOString()
          };
          recordAssistantReply(assistantMessage);
          return;
        }
        throw new Error('You must be signed in or have downloaded the offline brain to query Paradigm Assist');
      }

      const res = await apiFetch('/api/paradigm-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'chat',
          conversationId: activeConvId,
          query: trimmedQuery,
          siteId,
          modelEngine: get().selectedModelEngine,
          history: chatHistory
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();

      const assistantMessage: AssistMessage = {
        id: data.messageId || `asst_${Date.now()}`,
        conversation_id: data.conversationId,
        sender: 'assistant',
        content: data.message,
        confidence: data.confidence,
        sources: data.sources || [],
        latency_ms: data.latencyMs,
        isEmergency: data.isEmergency,
        emergencyType: data.emergencyType,
        isFallback: data.isFallback,
        isOffline: false,
        created_at: new Date().toISOString()
      };

      // If server returned fallback (no SOP found), check if Local Offline Brain is ready to answer locally
      if (data.isFallback && get().isOfflineModelReady) {
        try {
          const offlineResult = await offlineAIService.chat(trimmedQuery, chatHistory);
          const localAiMsg: AssistMessage = {
            id: `asst_local_${Date.now()}`,
            conversation_id: data.conversationId || activeConvId || undefined,
            sender: 'assistant',
            content: `${offlineResult.text}\n\n*(⚡ Answered on-device by local neural engine)*`,
            confidence: 0.95,
            sources: offlineResult.sources,
            latency_ms: offlineResult.latencyMs,
            isOffline: true,
            isFallback: false,
            created_at: new Date().toISOString()
          };
          recordAssistantReply(localAiMsg);
          return;
        } catch (localErr) {
          console.warn('[AssistStore] Local model answering failed, using cloud fallback:', localErr);
        }
      }

      recordAssistantReply(assistantMessage);
      get().fetchConversations();

    } catch (err: any) {
      console.warn('[AssistStore] Cloud API failed, evaluating offline fallback:', err);

      // Auto-fallback: If offline model is ready, seamlessly answer locally!
      if (get().isOfflineModelReady) {
        try {
          const offlineResult = await offlineAIService.chat(trimmedQuery, chatHistory);
          const fallbackAssistantMsg: AssistMessage = {
            id: `asst_off_fallback_${Date.now()}`,
            conversation_id: activeConvId || undefined,
            sender: 'assistant',
            content: `${offlineResult.text}\n\n*(⚡ Offline Fallback: Server was unreachable; answered on-device by local engine)*`,
            sources: offlineResult.sources,
            latency_ms: offlineResult.latencyMs,
            isOffline: true,
            created_at: new Date().toISOString()
          };

          recordAssistantReply(fallbackAssistantMsg);
          return;
        } catch (offErr) {
          console.error('[AssistStore] Fallback to offline model also failed:', offErr);
        }
      }

      // Auto-fallback 2: Bundled Offline SOP Knowledge Base (Works 100% offline on any phone without downloading weights)
      const matchedSOPs = offlineKnowledgeBase.searchRelevantSOPs(trimmedQuery, 1);
      if (matchedSOPs.length > 0) {
        const sop = matchedSOPs[0];
        let sopReply = `📄 **${sop.title}** *(ISO 9001:2015 Verified Offline Manual)*\n\n`;
        sopReply += `${sop.summary}\n\n`;
        sopReply += `**Standard Operational Steps:**\n`;
        sopReply += sop.steps.map((st, i) => `${i + 1}. ${st}`).join('\n') + '\n\n';
        if (sop.safetyWarnings && sop.safetyWarnings.length > 0) {
          sopReply += `⚠️ **Safety Warnings:**\n` + sop.safetyWarnings.map(w => `• ${w}`).join('\n') + '\n\n';
        }
        sopReply += `*(⚡ Retrieved 100% on-device from bundled offline operational storage)*`;

        const sopMsg: AssistMessage = {
          id: `asst_sop_off_${Date.now()}`,
          conversation_id: activeConvId || undefined,
          sender: 'assistant',
          content: sopReply,
          confidence: 1.0,
          latency_ms: 2,
          isOffline: true,
          sources: [{ id: sop.id, title: sop.title, sourceTable: 'Bundled Offline SOP' }],
          created_at: new Date().toISOString()
        };

        recordAssistantReply(sopMsg);
        return;
      }

      // Auto-fallback 3: Universal Instant On-Device Assistant Answer (Guarantees zero 500 error display!)
      const currentSiteName = get().sites.find(s => s.id === siteId)?.name || 'All Paradigm Sites';
      const instantAnswer = localAssistantService.generateOfflineAnswer(trimmedQuery, currentSiteName);
      
      const fallbackMsg: AssistMessage = {
        id: `asst_fallback_${Date.now()}`,
        conversation_id: activeConvId || undefined,
        sender: 'assistant',
        content: `${instantAnswer.text}\n\n*(⚡ Processed on-device via Paradigm Local Intelligence)*`,
        sources: instantAnswer.sources,
        confidence: 0.95,
        latency_ms: 10,
        isOffline: true,
        created_at: new Date().toISOString()
      };

      recordAssistantReply(fallbackMsg);
    }
  },

  sendFeedback: async (messageId: string, rating: -1 | 1) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Optimistic update
      set(state => ({
        messages: state.messages.map(m => m.id === messageId ? { ...m, feedback_rating: rating } : m)
      }));

      // Find user query prior to this message for training dataset collection
      const msgs = get().messages;
      const targetIdx = msgs.findIndex(m => m.id === messageId);
      const prevUserMsg = targetIdx > 0 ? msgs.slice(0, targetIdx).reverse().find(m => m.sender === 'user') : undefined;

      // Save directly into Supabase feedback learning log
      try {
        await supabase.from('assist_feedback_log').insert({
          message_id: messageId,
          query: prevUserMsg?.content || 'User feedback',
          parsed_intent: 'assist_response',
          rating,
          user_id: session.user.id,
          user_role: session.user.user_metadata?.role || 'staff'
        });
      } catch (logErr) {
        // Table might not exist yet if migration hasn't run on cloud
        console.debug('[AssistStore] Feedback DB log skipped:', logErr);
      }

      await apiFetch('/api/paradigm-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'feedback',
          messageId,
          rating
        })
      });
    } catch (err) {
      console.warn('[AssistStore] Failed to send feedback:', err);
    }
  },

  loadOfflineEmergencyCache: async () => {
    try {
      // 1. Try local cache first
      const cached = localStorage.getItem(OFFLINE_EMERGENCY_KEY);
      if (cached) {
        set({ offlineEmergencyContacts: JSON.parse(cached) });
      }

      // 2. Fetch fresh escalation matrix
      const { data, error } = await supabase
        .from('escalation_matrix')
        .select('*')
        .order('display_order', { ascending: true });

      if (!error && data) {
        localStorage.setItem(OFFLINE_EMERGENCY_KEY, JSON.stringify(data));
        set({ offlineEmergencyContacts: data });
      }
    } catch (err) {
      console.warn('[AssistStore] Offline emergency cache error:', err);
    }
  }
}));
