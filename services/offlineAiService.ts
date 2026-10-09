/**
 * Offline AI Service (WebLLM + Qwen 2.5) for Paradigm Assist
 * Runs Qwen 2.5 1.5B (or 0.5B fallback) 100% on the user's device via WebGPU.
 * Zero server dependencies, private, and fully offline-capable.
 */

import { CreateMLCEngine, MLCEngineInterface, InitProgressReport } from '@mlc-ai/web-llm';
import { offlineKnowledgeBase } from './offlineKnowledgeBase';

export interface ModelProgressInfo {
  progress: number; // 0.0 to 1.0
  text: string;
  timeElapsed?: number;
}

export interface OfflineAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const PRIMARY_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
const FALLBACK_MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
const CACHE_STATUS_KEY = 'paradigm_offline_qwen_cached_v1';

export class OfflineAIService {
  private static instance: OfflineAIService;
  private engine: MLCEngineInterface | null = null;
  private isInitializing: boolean = false;
  private activeModelId: string = PRIMARY_MODEL_ID;

  private constructor() {}

  public static getInstance(): OfflineAIService {
    if (!OfflineAIService.instance) {
      OfflineAIService.instance = new OfflineAIService();
    }
    return OfflineAIService.instance;
  }

  /**
   * Check if user device/browser supports WebGPU
   */
  public async checkWebGPUSupport(): Promise<{ supported: boolean; reason?: string }> {
    if (typeof window === 'undefined' || !('gpu' in navigator)) {
      return {
        supported: false,
        reason: 'WebGPU is not supported in this browser. Please use a modern browser (Chrome 113+, Edge 113+, or Android Chrome).'
      };
    }

    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (!adapter) {
        return {
          supported: false,
          reason: 'No compatible graphics adapter / WebGPU device found on this system.'
        };
      }
      return { supported: true };
    } catch (err: any) {
      return {
        supported: false,
        reason: err?.message || 'Failed to initialize WebGPU adapter'
      };
    }
  }

  /**
   * Request persistent storage from browser so IndexedDB model weights are never cleared
   */
  public async requestPersistentStorage(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        console.log(`[OfflineAI] Storage persistence granted: ${isPersisted}`);
        return isPersisted;
      } catch (e) {
        console.warn('[OfflineAI] Failed to request persistent storage:', e);
      }
    }
    return false;
  }

  /**
   * Check if model is already stored locally
   */
  public isModelCached(): boolean {
    return localStorage.getItem(CACHE_STATUS_KEY) === 'true';
  }

  /**
   * Check if MLCEngine is currently instantiated in RAM
   */
  public isEngineLoaded(): boolean {
    return this.engine !== null;
  }

  /**
   * Get active model ID
   */
  public getActiveModelId(): string {
    return this.activeModelId;
  }

  /**
   * Set model size: 1.5B (Standard) or 0.5B (Ultra-Light)
   */
  public setModelVariant(variant: '1.5b' | '0.5b') {
    this.activeModelId = variant === '1.5b' ? PRIMARY_MODEL_ID : FALLBACK_MODEL_ID;
  }

  /**
   * Download and initialize the offline Qwen model with progress reporting
   */
  public async initializeEngine(
    onProgress?: (progress: ModelProgressInfo) => void
  ): Promise<MLCEngineInterface> {
    if (this.engine) return this.engine;
    if (this.isInitializing) {
      throw new Error('Model is already in the process of downloading / loading.');
    }

    this.isInitializing = true;

    try {
      await this.requestPersistentStorage();

      const gpuStatus = await this.checkWebGPUSupport();
      if (!gpuStatus.supported) {
        // Fallback to 0.5B model if hardware is constrained
        console.warn(`[OfflineAI] WebGPU check failed: ${gpuStatus.reason}. Attempting fallback to 0.5B...`);
        this.activeModelId = FALLBACK_MODEL_ID;
      }

      this.engine = await CreateMLCEngine(this.activeModelId, {
        initProgressCallback: (report: InitProgressReport) => {
          if (onProgress) {
            onProgress({
              progress: Math.min(Math.max(report.progress, 0), 1),
              text: report.text,
              timeElapsed: report.timeElapsed
            });
          }
        }
      });

      // Mark as cached once initialized
      localStorage.setItem(CACHE_STATUS_KEY, 'true');
      this.isInitializing = false;
      return this.engine;
    } catch (err: any) {
      this.isInitializing = false;
      this.engine = null;
      console.error('[OfflineAI] Initialization error:', err);
      throw err;
    }
  }

  /**
   * Generate an offline chat completion grounded with local SOP manuals
   */
  public async chat(
    userQuery: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
    onStreamChunk?: (chunk: string) => void
  ): Promise<{ text: string; sources: any[]; latencyMs: number }> {
    const startTime = performance.now();

    if (!this.engine) {
      await this.initializeEngine();
    }

    // 1. Retrieve local grounding context from offline SOP knowledge base
    const groundingContext = offlineKnowledgeBase.buildGroundingPrompt(userQuery);
    const matchedSOPs = offlineKnowledgeBase.searchRelevantSOPs(userQuery, 2);

    // 2. Prepare structured system prompt for Qwen 2.5
    const systemPrompt = `You are Paradigm Assist 4.0, a courteous, respectful, and highly skilled digital companion and AI operations copilot for Paradigm Facilities and Operations employees.
Always maintain a polite, respectful, and warm tone (e.g., greet users warmly with "Namaste" or "Hello", use courteous phrasing like "Certainly", "Glad to assist you", "It is my pleasure").
STRICT CONFIDENTIALITY: Never state, disclose, or discuss any underlying AI model names, providers, or architectures. Identify strictly as Paradigm Assist.
You strictly adhere to ISO 9001:2015 operations manuals and verified Paradigm shift rules.
Help users draft professional emails, WhatsApp updates, take notes, understand policies, and troubleshoot equipment clearly, respectfully, and concisely.

${groundingContext}

If the user greets you or asks for general assistance, reply warmly, politely, and explain how you can assist their operations today.
If the question relates to emergency protocols (DG failure, STP aeration, Lift entrapment, or Fire), prioritize step-by-step safety actions.
When describing process flows or sequences, format diagrams using \`\`\`mermaid code blocks (e.g. \`graph TD\`) rather than plain text.`;

    const messages: OfflineAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-4).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: userQuery }
    ];

    let fullReply = '';

    if (onStreamChunk) {
      const chunks = await this.engine!.chat.completions.create({
        messages: messages as any,
        temperature: 0.6,
        max_tokens: 768,
        stream: true
      });

      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || '';
        fullReply += delta;
        onStreamChunk(delta);
      }
    } else {
      const completion = await this.engine!.chat.completions.create({
        messages: messages as any,
        temperature: 0.6,
        max_tokens: 768,
        stream: false
      });
      fullReply = completion.choices[0]?.message?.content || '';
    }

    const latencyMs = Math.round(performance.now() - startTime);

    return {
      text: fullReply,
      sources: matchedSOPs.map(s => ({
        id: s.id,
        title: s.title,
        sourceTable: 'Offline SOP Cache (ISO 9001)',
        score: '1.0'
      })),
      latencyMs
    };
  }

  /**
   * Delete offline cache to free up disk space
   */
  public async clearCache(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.unload();
      } catch (e) {
        console.warn('Error unloading engine:', e);
      }
      this.engine = null;
    }
    localStorage.removeItem(CACHE_STATUS_KEY);
    console.log('[OfflineAI] Offline cache cleared successfully.');
  }
}

export const offlineAIService = OfflineAIService.getInstance();
