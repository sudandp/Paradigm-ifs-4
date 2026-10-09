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

export interface SiteOption {
  id: string;
  name: string;
  city?: string;
}

export type AIModelEngine = 'auto-hybrid' | 'cloud-groq' | 'cloud-gemini' | 'local-model';

interface AssistState {
  conversations: AssistConversation[];
  activeConversationId: string | null;
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
  setSelectedSiteId: (siteId: string | null) => void;
  sendMessage: (query: string) => Promise<void>;
  sendFeedback: (messageId: string, rating: -1 | 1) => Promise<void>;
  loadOfflineEmergencyCache: () => Promise<void>;
  downloadOfflineModel: () => Promise<void>;
  clearOfflineCache: () => Promise<void>;
  setUseLocalEngineFirst: (enabled: boolean) => void;
}

const OFFLINE_EMERGENCY_KEY = 'paradigm_assist_offline_emergency';

export const useAssistStore = create<AssistState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
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
        set({ conversations: data.conversations || [] });
      }
    } catch (err) {
      console.warn('[AssistStore] Failed to fetch conversations:', err);
    }
  },

  selectConversation: async (conversationId: string) => {
    set({ activeConversationId: conversationId, isLoading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await apiFetch(`/api/paradigm-assist?action=conversation_messages&id=${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        set({ messages: data.messages || [], isLoading: false });
      } else {
        set({ isLoading: false, error: 'Failed to load conversation history' });
      }
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  startNewConversation: () => {
    set({ activeConversationId: null, messages: [], error: null });
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

    const activeConvId = get().activeConversationId;
    const siteId = get().selectedSiteId;

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
      set(state => ({
        messages: [...state.messages, launchAssistantMsg],
        isLoading: false
      }));
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
      set(state => ({
        messages: [...state.messages, noteAssistantMsg],
        isLoading: false
      }));
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
      set(state => ({
        messages: [...state.messages, remAssistantMsg],
        isLoading: false
      }));
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
      set(state => ({
        messages: [...state.messages, greetingMsg],
        isLoading: false
      }));
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
      set(state => ({
        messages: [...state.messages, timeMsg],
        isLoading: false
      }));
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
      set(state => ({
        messages: [...state.messages, mathMsg],
        isLoading: false
      }));
      return;
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

            set(state => ({
              messages: [...state.messages, assistantMessage],
              isLoading: false
            }));
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

      set(state => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false
      }));
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
          set(state => ({
            messages: [...state.messages, assistantMessage],
            isLoading: false
          }));
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
          set(state => ({
            messages: [...state.messages, localAiMsg],
            activeConversationId: data.conversationId || state.activeConversationId,
            isLoading: false
          }));
          return;
        } catch (localErr) {
          console.warn('[AssistStore] Local model answering failed, using cloud fallback:', localErr);
        }
      }

      set(state => ({
        messages: [...state.messages, assistantMessage],
        activeConversationId: data.conversationId || state.activeConversationId,
        isLoading: false
      }));

      // Refresh conversations list in background to show updated title
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

          set(state => ({
            messages: [...state.messages, fallbackAssistantMsg],
            isLoading: false
          }));
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

        set(state => ({
          messages: [...state.messages, sopMsg],
          isLoading: false
        }));
        return;
      }

      const errorMessage: AssistMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        content: `⚠️ **Connection Issue**: Unable to contact Paradigm Assist.\n\n*Error: ${err.message || 'Please check your connection.'}*\n\n💡 *Tip: Download the **Offline Brain** from the top bar so you can query SOPs even without internet or when the server is offline.*\n\nIf this is an emergency, call **+91 80 4114 2666** immediately.`,
        isEmergency: false,
        created_at: new Date().toISOString()
      };

      set(state => ({
        messages: [...state.messages, errorMessage],
        isLoading: false,
        error: err.message
      }));
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
