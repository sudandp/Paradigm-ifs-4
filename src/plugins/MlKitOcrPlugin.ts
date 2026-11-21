import { registerPlugin, Capacitor } from '@capacitor/core';

export interface OcrBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrRecognizedLine {
  text: string;
  confidence?: number;
  box?: OcrBoundingBox;
}

export interface OcrRecognizedBlock {
  text: string;
  box?: OcrBoundingBox;
  lines: OcrRecognizedLine[];
}

export interface MlKitOcrResult {
  fullText: string;
  lines: OcrRecognizedLine[];
  blocks: OcrRecognizedBlock[];
  engine: string;
  latencyMs: number;
}

export interface MlKitOcrPluginInterface {
  isAvailable(): Promise<{ available: boolean; engines: string[] }>;
  processImage(options: {
    image: string;
    script?: 'latin' | 'devanagari' | 'auto' | string;
    cropBox?: { x: number; y: number; width: number; height: number };
  }): Promise<MlKitOcrResult>;
}

export const MlKitOcr = registerPlugin<MlKitOcrPluginInterface>('MlKitOcr', {
  web: () => ({
    isAvailable: async () => ({ available: false, engines: [] }),
    processImage: async () => {
      throw new Error('MlKitOcr is only available natively on Android devices');
    },
  }),
});

export const isNativeMlKitAvailable = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return false;
  }
  try {
    const res = await MlKitOcr.isAvailable();
    return !!res?.available;
  } catch (err) {
    console.warn('[MlKitOcr] Native availability check failed:', err);
    return false;
  }
};
