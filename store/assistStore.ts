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

  // ── Role-aware data answers (server: /api/paradigm-assist). All optional: messages reloaded
  //    from server history (conversation_messages) do not carry these fields. ──
  route?: AssistRoute;
  sourceBadge?: string;
  clarification?: AssistClarification;
  /** True once the user picked one of the clarification chips. */
  clarificationResolved?: boolean;
  /** Label of the chip the user picked (highlighted after resolution). */
  clarificationChoice?: string;
  /** The question that produced this reply; re-sent with a clarification selection. */
  originalQuery?: string;
  denied?: boolean;
  table?: AssistTable;
  webSources?: AssistWebSource[];
  toolUsed?: string;
  /** In-app navigation buttons ("Open Apply Leave"); `route` is a hash-router path without '#'. */
  actions?: AssistAction[];
}

export interface AssistAction {
  label: string;
  route: string;
}

export type AssistRoute = 'database' | 'web' | 'knowledge_base';

export interface AssistSelection {
  tool: string;
  args: Record<string, any>;
}

export interface AssistClarificationOption {
  label: string;
  sublabel?: string;
  selection: AssistSelection;
}

export interface AssistClarification {
  tool: string;
  question: string;
  options: AssistClarificationOption[];
}

export interface AssistTable {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface AssistWebSource {
  title: string;
  url: string;
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
  /** Resolve a server clarification: marks it resolved, echoes the chosen label and re-asks with `selection`. */
  selectClarification: (messageId: string, option: AssistClarificationOption) => Promise<void>;
  sendFeedback: (messageId: string, rating: -1 | 1) => Promise<void>;
  loadOfflineEmergencyCache: () => Promise<void>;
  downloadOfflineModel: () => Promise<void>;
  clearOfflineCache: () => Promise<void>;
  setUseLocalEngineFirst: (enabled: boolean) => void;
}

const OFFLINE_EMERGENCY_KEY = 'paradigm_assist_offline_emergency';

type ChatHistoryItem = { role: 'user' | 'assistant'; content: string };

/**
 * Writes the full message list for the active tab/conversation to the store and localStorage
 * (tabs, conversation list and per-conversation cache). Shared by sendMessage and selectClarification.
 */
function persistActiveMessages(
  get: () => AssistState,
  set: (partial: Partial<AssistState>) => void,
  allMsgs: AssistMessage[],
  titleSeed: string,
  activeConvId: string | null,
  siteId: string | null
) {
  set({ messages: allMsgs, isLoading: false });

  const activeTabId = get().activeTabId;
  const currentTabs = get().tabs;
  const tIdx = currentTabs.findIndex(t => t.id === activeTabId);
  const title = (currentTabs[tIdx]?.title === 'New Inquiry' || !currentTabs[tIdx]?.title)
    ? (titleSeed.length > 32 ? titleSeed.slice(0, 32) + '...' : titleSeed)
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
  } else if (activeConvId) {
    const newConv: AssistConversation = {
      id: activeConvId,
      title,
      site_id: siteId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    currentConvs = [newConv, ...currentConvs];
  }

  set({ tabs: nextTabs, conversations: currentConvs });

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('paradigm_assist_tabs', JSON.stringify(nextTabs));
      localStorage.setItem('paradigm_assist_conversations', JSON.stringify(currentConvs));
      if (activeConvId) {
        localStorage.setItem(`paradigm_conv_msg_${activeConvId}`, JSON.stringify(allMsgs));
      }
    } catch (storageErr) {
      console.warn('[AssistStore] Failed to persist messages locally:', storageErr);
    }
  }
}

/** POST /api/paradigm-assist (action: chat). Throws on non-2xx. */
async function postAssistChat(params: {
  accessToken: string;
  conversationId: string | null;
  query: string;
  siteId: string | null;
  modelEngine: AIModelEngine;
  history: ChatHistoryItem[];
  selection?: AssistSelection;
}): Promise<any> {
  const res = await apiFetch('/api/paradigm-assist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.accessToken}`
    },
    body: JSON.stringify({
      action: 'chat',
      conversationId: params.conversationId,
      query: params.query,
      siteId: params.siteId,
      modelEngine: params.modelEngine,
      history: params.history,
      ...(params.selection ? { selection: params.selection } : {})
    })
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || `Server responded with ${res.status}`);
  }

  return res.json();
}

function normalizeClarification(raw: any): AssistClarification | undefined {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.options)) return undefined;
  const options: AssistClarificationOption[] = raw.options
    .filter((o: any) => o && typeof o.label === 'string' && o.selection && typeof o.selection.tool === 'string')
    .map((o: any) => ({
      label: o.label,
      sublabel: typeof o.sublabel === 'string' ? o.sublabel : undefined,
      selection: { tool: o.selection.tool, args: (o.selection.args && typeof o.selection.args === 'object') ? o.selection.args : {} }
    }));
  if (options.length === 0) return undefined;
  return {
    tool: typeof raw.tool === 'string' ? raw.tool : options[0].selection.tool,
    question: typeof raw.question === 'string' ? raw.question : '',
    options
  };
}

function normalizeTable(raw: any): AssistTable | undefined {
  if (!raw || !Array.isArray(raw.columns) || !Array.isArray(raw.rows) || raw.columns.length === 0) return undefined;
  return {
    columns: raw.columns.map((c: any) => String(c ?? '')),
    rows: raw.rows.filter((r: any) => Array.isArray(r))
  };
}

/** Keeps only safe in-app routes ("/leaves/apply", "/finance?tab=site"): no protocol, no '//' host. */
function normalizeActions(raw: any): AssistAction[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .filter((a: any) => a && typeof a.label === 'string' && typeof a.route === 'string' && /^\/(?!\/)[^\s]*$/.test(a.route))
    .slice(0, 4)
    .map((a: any) => ({ label: a.label, route: a.route }));
  return out.length ? out : undefined;
}

/** Server `sources` may carry `{ type: 'actions', actions }` (stored for history); split it off the citation list. */
function splitSourceActions(sources: any): { sources: any[]; actions?: AssistAction[] } {
  if (!Array.isArray(sources)) return { sources: [] };
  let actions: AssistAction[] | undefined;
  const rest = sources.filter((s: any) => {
    if (s && s.type === 'actions') { actions = actions || normalizeActions(s.actions); return false; }
    return true;
  });
  return { sources: rest, actions };
}

/** Messages reloaded from server history: restore action buttons from `sources`, tolerate missing fields. */
export function hydrateHistoryMessage(m: any): AssistMessage {
  if (!m || typeof m !== 'object') return m;
  const split = splitSourceActions(m.sources);
  return { ...m, sources: split.sources, actions: normalizeActions(m.actions) || split.actions };
}

/** Maps the chat API JSON to an AssistMessage (tolerates missing data-answer fields). */
function mapServerReply(data: any, originalQuery: string, fallbackConvId: string | null): AssistMessage {
  const route: AssistRoute | undefined =
    data.route === 'database' || data.route === 'web' || data.route === 'knowledge_base' ? data.route : undefined;
  const webSources: AssistWebSource[] | undefined = Array.isArray(data.webSources)
    ? data.webSources.filter((s: any) => s && typeof s.url === 'string').map((s: any) => ({ title: String(s.title || s.url), url: s.url }))
    : undefined;
  const split = splitSourceActions(data.sources);

  return {
    id: data.messageId || `asst_${Date.now()}`,
    conversation_id: data.conversationId || fallbackConvId || undefined,
    sender: 'assistant',
    content: typeof data.message === 'string' ? data.message : '',
    confidence: data.confidence,
    sources: split.sources,
    latency_ms: data.latencyMs,
    isEmergency: data.isEmergency,
    emergencyType: data.emergencyType,
    isFallback: data.isFallback,
    isOffline: false,
    created_at: new Date().toISOString(),
    route,
    sourceBadge: typeof data.sourceBadge === 'string' ? data.sourceBadge : undefined,
    clarification: normalizeClarification(data.clarification),
    denied: data.denied === true ? true : undefined,
    table: normalizeTable(data.table),
    webSources: webSources && webSources.length > 0 ? webSources : undefined,
    toolUsed: typeof data.toolUsed === 'string' ? data.toolUsed : undefined,
    actions: normalizeActions(data.actions) || split.actions,
    originalQuery
  };
}

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
            const loaded: AssistMessage[] = data.messages.map(hydrateHistoryMessage);
            const updatedTabs = get().tabs.map(t => t.id === newTab.id ? { ...t, messages: loaded } : t);
            set({ tabs: updatedTabs, messages: loaded });
            if (typeof window !== 'undefined') {
              localStorage.setItem('paradigm_assist_tabs', JSON.stringify(updatedTabs));
              localStorage.setItem(`paradigm_conv_msg_${conversationId}`, JSON.stringify(loaded));
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
      persistActiveMessages(get, set, [...get().messages, msg], trimmedQuery, activeConvId, siteId);
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

    // ── STEP 0A: LOCAL OFFLINE PYTHON ATTENDANCE & DUTY ANALYZER ──
    if (
      trimmedQuery.includes('--- BEGIN ATTACHED DOCUMENT') ||
      trimmedQuery.includes('Monthly Status Report') ||
      (/\b(?:how\s+many\s+duties|total\s+duties|duties\s+to\s+pay|payable\s+duties|need\s+to\s+pay)\b/i.test(trimmedQuery) &&
       (trimmedQuery.includes('.pdf') || trimmedQuery.includes('.xlsx') || trimmedQuery.includes('Elita Promenade') || trimmedQuery.includes('[Attached Document') || trimmedQuery.includes('P A L H HP WO')))
    ) {
      try {
        const resp = await fetch('/api/paradigm-assist/analyze-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawText: trimmedQuery,
            fileName: 'Monthly Status Report.pdf',
            question: trimmedQuery
          })
        });
        if (resp.ok) {
          const pyRes = await resp.json();
          if (pyRes && pyRes.success && pyRes.answer) {
            const pyMsg: AssistMessage = {
              id: `asst_py_${Date.now()}`,
              conversation_id: activeConvId || undefined,
              sender: 'assistant',
              content: pyRes.answer,
              confidence: 1.0,
              latency_ms: 110,
              isOffline: true,
              sources: [
                { id: 'local-python-engine', title: 'Paradigm Local Python Attendance Engine (Offline)', sourceTable: 'local_attendance_analyzer.py' },
                { id: 'shift-rules', title: 'Paradigm Dynamic Shift & Policy Rules (ISO 9001:2015)', sourceTable: 'Standard Operating Procedures' }
              ] as any,
              created_at: new Date().toISOString()
            };
            recordAssistantReply(pyMsg);
            return;
          }
        }
      } catch (e) {
        console.warn('[AssistStore] Local offline analyzer fetch error:', e);
      }
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
        content: `Namaste! 🙏 Warm greetings. I am **Aadi | Your Paradigm AI Assistant**, your dedicated digital companion and operations copilot.\n\nIt is an honor and pleasure to assist you. Here are key ways I can serve you:\n\n• ⚡ **54 Operational Skills**: Equipment SOPs (DG, STP, Lifts, Fire), shift timings, and rosters.\n• ✍️ **Drafting & Messaging**: Professional emails, WhatsApp broadcasts, and incident reports.\n• 🕒 **Live Time & Shifts**: Ask *"what is the time now"* or *"which shift is active"* for instant on-device status.\n• 📝 **Local Notes & Reminders**: Capture readings (*"take note: ..."*) or set alarms (*"remind me in 10 minutes to ..."*).\n• 🖥️ **System Launchers**: Open UltraViewer, Gmail, WhatsApp, Calculator, and more.\n\nHow may I respectfully assist your operations today?`,
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

    // ── ROUTING: when online AND signed in, the server (/api/paradigm-assist) is the single source of
    //    truth for Paradigm data. It enforces role-based access (scope, capabilities, audit), so the
    //    browser-side semantic pipeline below (intentClassifier → queryRouter → operationalTelemetryService
    //    → browser Groq answerGeneralQuery) must NOT run on that path — it would bypass access control.
    //    It still runs offline / signed-out. The server also answers general questions.
    let hasServerSession = false;
    try {
      const { data: { session: preSession } } = await supabase.auth.getSession();
      hasServerSession = !!preSession;
    } catch {
      hasServerSession = false;
    }
    const serverHandlesQuery = (typeof navigator === 'undefined' || navigator.onLine) && hasServerSession;

    // ══════════════════════════════════════════════════════════════════════════
    // 7. SEMANTIC INTENT ENGINE — Universal Query Understanding
    //    Phase 1 (intentClassifier) + Phase 2 (entityResolver) + Phase 3 (queryRouter)
    //    Replaces all fragile regex blocks with LLM-powered structured intent parsing.
    //    Groq llama-3.1-8b-instant → ~180ms → structured ParsedIntent JSON → correct data source.
    // ══════════════════════════════════════════════════════════════════════════
    if (!serverHandlesQuery) {
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

      const data = await postAssistChat({
        accessToken: session.access_token,
        conversationId: activeConvId,
        query: trimmedQuery,
        siteId,
        modelEngine: get().selectedModelEngine,
        history: chatHistory
      });

      const assistantMessage = mapServerReply(data, trimmedQuery, null);

      // If server returned fallback (no SOP found), check if Local Offline Brain is ready to answer locally
      // (Never for role-scoped data/web answers, clarifications or denials — those must stay server-authored.)
      const isDataReply = assistantMessage.route === 'database' || assistantMessage.route === 'web'
        || !!assistantMessage.clarification || !!assistantMessage.denied;
      if (data.isFallback && !isDataReply && get().isOfflineModelReady) {
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

  selectClarification: async (messageId: string, option: AssistClarificationOption) => {
    if (get().isLoading || !option?.selection) return;

    const msgs = get().messages;
    const idx = msgs.findIndex(m => m.id === messageId);
    if (idx < 0) return;
    const target = msgs[idx];
    if (!target.clarification || target.clarificationResolved) return;

    // The question to re-ask: carried on the clarification reply, else the nearest preceding user message.
    const originalQuery = target.originalQuery
      || msgs.slice(0, idx).reverse().find(m => m.sender === 'user')?.content
      || option.label;

    let activeConvId = get().activeConversationId;
    if (!activeConvId) {
      activeConvId = `conv_${Date.now()}`;
      set({ activeConversationId: activeConvId });
    }
    const siteId = get().selectedSiteId;

    // History (before the pick) for conversational context, same shape as sendMessage.
    const chatHistory: ChatHistoryItem[] = msgs.slice(-4).map(m => ({
      role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content
    }));

    const setResolved = (list: AssistMessage[], resolved: boolean) => list.map(m =>
      m.id === messageId
        ? { ...m, clarificationResolved: resolved, clarificationChoice: resolved ? option.label : undefined }
        : m
    );

    const pickMessage: AssistMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      content: option.label,
      created_at: new Date().toISOString()
    };
    persistActiveMessages(get, set, [...setResolved(msgs, true), pickMessage], originalQuery, activeConvId, siteId);
    set({ isLoading: true, error: null });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be signed in to look up Paradigm data');

      const data = await postAssistChat({
        accessToken: session.access_token,
        conversationId: activeConvId,
        query: originalQuery,
        siteId,
        modelEngine: get().selectedModelEngine,
        history: chatHistory,
        selection: option.selection
      });

      const reply = mapServerReply(data, originalQuery, activeConvId);
      persistActiveMessages(get, set, [...get().messages, reply], originalQuery, activeConvId, siteId);
      get().fetchConversations();
    } catch (err: any) {
      console.warn('[AssistStore] Clarification follow-up failed:', err);
      // Re-enable the chips so the user can retry, and explain what happened.
      const errorReply: AssistMessage = {
        id: `asst_clarify_err_${Date.now()}`,
        conversation_id: activeConvId || undefined,
        sender: 'assistant',
        content: `I couldn't fetch that from the Paradigm database right now${err?.message ? ` (${err.message})` : ''}. Please pick the option again in a moment.`,
        isFallback: true,
        created_at: new Date().toISOString()
      };
      persistActiveMessages(get, set, [...setResolved(get().messages, false), errorReply], originalQuery, activeConvId, siteId);
      set({ error: err?.message || 'Clarification request failed' });
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
