import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { apiFetch } from '../utils/apiClient';

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

interface AssistState {
  conversations: AssistConversation[];
  activeConversationId: string | null;
  messages: AssistMessage[];
  sites: SiteOption[];
  selectedSiteId: string | null;
  isLoading: boolean;
  error: string | null;
  offlineEmergencyContacts: any[];

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

  init: async () => {
    await Promise.all([
      get().fetchSites(),
      get().fetchConversations(),
      get().loadOfflineEmergencyCache()
    ]);
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be signed in to query Paradigm Assist');
      }

      const activeConvId = get().activeConversationId;
      const siteId = get().selectedSiteId;

      // History of last 4 turns for conversational context
      const history = prevMessages.slice(-4).map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

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
          history
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
        created_at: new Date().toISOString()
      };

      set(state => ({
        messages: [...state.messages, assistantMessage],
        activeConversationId: data.conversationId || state.activeConversationId,
        isLoading: false
      }));

      // Refresh conversations list in background to show updated title
      get().fetchConversations();

    } catch (err: any) {
      console.error('[AssistStore] Send message error:', err);
      const errorMessage: AssistMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        content: `⚠️ **Connection Issue**: Unable to contact Paradigm Assist.\n\n*Error: ${err.message || 'Please check your connection.'}*\n\nIf this is an emergency, call **+91 80 4114 2666** immediately.`,
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
