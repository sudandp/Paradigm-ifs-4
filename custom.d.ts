declare module '*.pdf?url' {
  const src: string;
  export default src;
}

declare module '*.pdf' {
  const src: string;
  export default src;
}

declare module '../services/offlineAiService' {
  export interface ModelProgressInfo {
    progress: number;
    text: string;
    timeElapsed?: number;
  }
  export interface OfflineAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }
  export class OfflineAIService {
    static getInstance(): OfflineAIService;
    checkWebGPUSupport(): Promise<{ supported: boolean; reason?: string }>;
    requestPersistentStorage(): Promise<boolean>;
    isModelCached(): boolean;
    getActiveModelId(): string;
    setModelVariant(variant: '1.5b' | '0.5b'): void;
    initializeEngine(onProgress?: (progress: ModelProgressInfo) => void): Promise<any>;
    chat(userQuery: string, history?: { role: 'user' | 'assistant'; content: string }[], onStreamChunk?: (chunk: string) => void): Promise<{ text: string; sources: any[]; latencyMs: number }>;
    clearCache(): Promise<void>;
  }
  export const offlineAIService: OfflineAIService;
}

declare module '@/services/offlineAiService' {
  export * from '../services/offlineAiService';
}

declare module '../services/offlineKnowledgeBase' {
  export interface OfflineSOP {
    id: string;
    title: string;
    category: string;
    keywords: string[];
    summary: string;
    steps: string[];
    safetyWarnings?: string[];
    contacts?: { role: string; phone: string }[];
    updatedAt: string;
  }
  export class OfflineKnowledgeBase {
    static getInstance(): OfflineKnowledgeBase;
    loadLocalSOPs(): OfflineSOP[];
    syncWithCloud(): Promise<void>;
    searchRelevantSOPs(query: string, maxResults?: number): OfflineSOP[];
    buildGroundingPrompt(query: string): string;
  }
  export const offlineKnowledgeBase: OfflineKnowledgeBase;
}

declare module '@/services/offlineKnowledgeBase' {
  export * from '../services/offlineKnowledgeBase';
}

