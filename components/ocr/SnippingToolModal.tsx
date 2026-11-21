import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Scissors, 
  Copy, 
  Check, 
  Share2, 
  Download, 
  RefreshCw, 
  Upload, 
  Camera, 
  FileText, 
  Sparkles, 
  X, 
  ShieldCheck, 
  Maximize2,
  Languages,
  ScanLine
} from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { MlKitOcr, isNativeMlKitAvailable } from '../../src/plugins/MlKitOcrPlugin';
import { extractDataOffline, ExtractedDocumentData, detectIndicLanguage } from '../../services/offline/offlineExtraction';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Toast from '../ui/Toast';

interface SnippingToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImage?: string;
  onApplyExtractedData?: (data: Partial<ExtractedDocumentData>) => void;
  documentTypeHint?: string;
}

interface CropRect {
  x: number;      // 0 to 1
  y: number;      // 0 to 1
  width: number;  // 0 to 1
  height: number; // 0 to 1
}

/**
 * Converts any image URI (blob:, http:, relative) to a Base64 data URL.
 * Required because Android native ContentResolver cannot resolve WebView blob: URLs.
 */
const ensureBase64DataUrl = async (src: string): Promise<string> => {
  if (src.startsWith('data:image/')) return src;

  // 1. Attempt fetch -> blob -> FileReader
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('FileReader empty'));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    // 2. Fallback to HTMLCanvasElement drawing
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
            return;
          }
        } catch {
          // ignore canvas error
        }
        resolve(src);
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }
};

/**
 * 100% Client-side Document Paper Edge Detector.
 * Downsamples the image, analyzes perimeter contrast and gradient energy,
 * and calculates the bounding box of the paper against dark/textured background.
 */
const detectDocumentEdges = async (imgSrc: string): Promise<CropRect | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        if (!origW || !origH) {
          resolve(null);
          return;
        }

        // Downsample to max dimension 256 for sub-10ms calculation
        const scale = Math.min(256 / origW, 256 / origH, 1);
        const w = Math.max(32, Math.floor(origW * scale));
        const h = Math.max(32, Math.floor(origH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Grayscale luminance array
        const luma = new Float32Array(w * h);
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
          luma[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        // Sample background from the 4 outer corner blocks (8% of dimension)
        const cornerSize = Math.max(3, Math.floor(Math.min(w, h) * 0.08));
        let cornerSum = 0;
        let cornerCount = 0;
        for (let y = 0; y < cornerSize; y++) {
          for (let x = 0; x < cornerSize; x++) {
            cornerSum += luma[y * w + x];
            cornerSum += luma[y * w + (w - 1 - x)];
            cornerSum += luma[(h - 1 - y) * w + x];
            cornerSum += luma[(h - 1 - y) * w + (w - 1 - x)];
            cornerCount += 4;
          }
        }
        const bgLuma = cornerCount > 0 ? cornerSum / cornerCount : 128;

        // Row difference & vertical gradient
        const rowDiff = new Float32Array(h);
        const rowGrad = new Float32Array(h);
        const xStart = Math.floor(w * 0.15);
        const xEnd = Math.floor(w * 0.85);
        const xCount = Math.max(1, xEnd - xStart);
        for (let y = 1; y < h - 1; y++) {
          let sDiff = 0;
          let sGrad = 0;
          for (let x = xStart; x < xEnd; x++) {
            const v = luma[y * w + x];
            sDiff += Math.abs(v - bgLuma);
            sGrad += Math.abs(v - luma[(y - 1) * w + x]) + Math.abs(v - luma[(y + 1) * w + x]);
          }
          rowDiff[y] = sDiff / xCount;
          rowGrad[y] = sGrad / xCount;
        }

        // Col difference & horizontal gradient
        const colDiff = new Float32Array(w);
        const colGrad = new Float32Array(w);
        const yStart = Math.floor(h * 0.15);
        const yEnd = Math.floor(h * 0.85);
        const yCount = Math.max(1, yEnd - yStart);
        for (let x = 1; x < w - 1; x++) {
          let sDiff = 0;
          let sGrad = 0;
          for (let y = yStart; y < yEnd; y++) {
            const v = luma[y * w + x];
            sDiff += Math.abs(v - bgLuma);
            sGrad += Math.abs(v - luma[y * w + (x - 1)]) + Math.abs(v - luma[y * w + (x + 1)]);
          }
          colDiff[x] = sDiff / yCount;
          colGrad[x] = sGrad / yCount;
        }

        const rowScore = new Float32Array(h);
        let maxRow = 0;
        for (let y = 1; y < h - 1; y++) {
          rowScore[y] = rowDiff[y] * 0.6 + rowGrad[y] * 0.4;
          if (rowScore[y] > maxRow) maxRow = rowScore[y];
        }

        const colScore = new Float32Array(w);
        let maxCol = 0;
        for (let x = 1; x < w - 1; x++) {
          colScore[x] = colDiff[x] * 0.6 + colGrad[x] * 0.4;
          if (colScore[x] > maxCol) maxCol = colScore[x];
        }

        const rowThresh = Math.max(15, maxRow * 0.32);
        const colThresh = Math.max(15, maxCol * 0.32);

        // Find Top
        let top = Math.floor(h * 0.04);
        for (let y = Math.floor(h * 0.04); y < Math.floor(h * 0.45); y++) {
          if (rowScore[y] >= rowThresh) {
            top = y;
            break;
          }
        }

        // Find Bottom
        let bottom = Math.floor(h * 0.96);
        for (let y = Math.floor(h * 0.96); y > Math.floor(h * 0.55); y--) {
          if (rowScore[y] >= rowThresh) {
            bottom = y;
            break;
          }
        }

        // Find Left
        let left = Math.floor(w * 0.04);
        for (let x = Math.floor(w * 0.04); x < Math.floor(w * 0.45); x++) {
          if (colScore[x] >= colThresh) {
            left = x;
            break;
          }
        }

        // Find Right
        let right = Math.floor(w * 0.96);
        for (let x = Math.floor(w * 0.96); x > Math.floor(w * 0.55); x--) {
          if (colScore[x] >= colThresh) {
            right = x;
            break;
          }
        }

        // Add 2% safety padding
        const padX = Math.floor(w * 0.02);
        const padY = Math.floor(h * 0.02);
        left = Math.max(0, left - padX);
        top = Math.max(0, top - padY);
        right = Math.min(w, right + padX);
        bottom = Math.min(h, bottom + padY);

        const cropW = (right - left) / w;
        const cropH = (bottom - top) / h;
        const cropX = left / w;
        const cropY = top / h;

        if (cropW >= 0.25 && cropH >= 0.25 && (cropW <= 0.98 || cropH <= 0.98)) {
          resolve({
            x: Math.round(cropX * 1000) / 1000,
            y: Math.round(cropY * 1000) / 1000,
            width: Math.round(cropW * 1000) / 1000,
            height: Math.round(cropH * 1000) / 1000,
          });
        } else {
          resolve({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
        }
      } catch (err) {
        console.warn('[detectDocumentEdges] Detection error:', err);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imgSrc;
  });
};

export const SnippingToolModal: React.FC<SnippingToolModalProps> = ({
  isOpen,
  onClose,
  initialImage,
  onApplyExtractedData,
  documentTypeHint = 'General',
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(initialImage || null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 1, height: 1 });
  const [isDetectingEdges, setIsDetectingEdges] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [engineUsed, setEngineUsed] = useState<string>('');
  const [detectedFields, setDetectedFields] = useState<Partial<ExtractedDocumentData> | null>(null);

  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialImage) {
      setImageSrc(initialImage);
      setExtractedText('');
      setDetectedFields(null);
      setDetectedLanguage('');

      // Auto-detect edges on initial image load
      detectDocumentEdges(initialImage).then((detected) => {
        if (detected) {
          setCrop(detected);
        } else {
          setCrop({ x: 0, y: 0, width: 1, height: 1 });
        }
      });
    }
  }, [initialImage, isOpen]);

  // Handle image upload from file or camera
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageSrc(result);
      setExtractedText('');
      setDetectedFields(null);
      setLatencyMs(null);
      setDetectedLanguage('');

      // Auto detect paper boundaries on new upload
      detectDocumentEdges(result).then((detected) => {
        if (detected) {
          setCrop(detected);
          setToastMessage('Edges auto-detected!');
        } else {
          setCrop({ x: 0, y: 0, width: 1, height: 1 });
        }
      });
    };
    reader.readAsDataURL(file);
  };

  // Drag selection handlers for visual crop
  const getRelativeCoords = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!imageSrc) return;
    const coords = getRelativeCoords(e);
    setDragStart(coords);
    setIsDragging(true);
    setCrop({ x: coords.x, y: coords.y, width: 0.01, height: 0.01 });
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStart) return;
    const current = getRelativeCoords(e);

    const x = Math.min(dragStart.x, current.x);
    const y = Math.min(dragStart.y, current.y);
    const width = Math.max(0.02, Math.abs(current.x - dragStart.x));
    const height = Math.max(0.02, Math.abs(current.y - dragStart.y));

    setCrop({ x, y, width, height });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const resetToFullImage = () => {
    setCrop({ x: 0, y: 0, width: 1, height: 1 });
    setToastMessage('Reset to full image');
  };

  const handleAutoDetectEdges = async () => {
    if (!imageSrc) return;
    setIsDetectingEdges(true);
    try {
      const detected = await detectDocumentEdges(imageSrc);
      if (detected) {
        setCrop(detected);
        setToastMessage('Document edges detected! Adjust corners if needed.');
      } else {
        setCrop({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
        setToastMessage('Edges adjusted to standard margin.');
      }
    } finally {
      setIsDetectingEdges(false);
    }
  };

  // Execute Offline OCR
  const handleExtractText = async () => {
    if (!imageSrc) return;
    setIsProcessing(true);
    const start = Date.now();

    try {
      // 1. Ensure image is in clean Base64 format before passing to native plugins
      const base64Data = await ensureBase64DataUrl(imageSrc);

      const isNative = await isNativeMlKitAvailable();

      if (isNative) {
        try {
          // Map language selection to engine script (devanagari engine also covers Devanagari + Latin numbers)
          const engineScript = (selectedLanguage === 'latin') ? 'latin' : 'devanagari';
          const res = await MlKitOcr.processImage({
            image: base64Data,
            script: engineScript,
            cropBox: (crop.width < 0.98 || crop.height < 0.98) ? crop : undefined,
          });

          const text = res.fullText || '';
          setExtractedText(text);
          setLatencyMs(res.latencyMs || (Date.now() - start));
          const lang = detectIndicLanguage(text);
          setDetectedLanguage(lang);
          setEngineUsed(`Google ML Kit (${lang})`);

          // Also run structured regex parser to auto-detect fields
          if (text) {
            const parsed = await extractDataOffline(base64Data, documentTypeHint);
            setDetectedFields(parsed);
          }
        } catch (nativeErr: any) {
          console.warn('[SnippingTool] ML Kit native error, falling back to Tesseract WASM:', nativeErr);
          // Graceful fallback to Tesseract WASM without crashing
          const parsed = await extractDataOffline(base64Data, documentTypeHint);
          const text = parsed._rawText || '';
          setExtractedText(text);
          setDetectedFields(parsed);
          const lang = detectIndicLanguage(text);
          setDetectedLanguage(lang);
          setEngineUsed(`Tesseract.js Fallback (${lang})`);
          setLatencyMs(Date.now() - start);
        }
      } else {
        // Web fallback using Tesseract.js / Canvas
        const parsed = await extractDataOffline(base64Data, documentTypeHint);
        const text = parsed._rawText || '';
        setExtractedText(text);
        setDetectedFields(parsed);
        const lang = detectIndicLanguage(text);
        setDetectedLanguage(lang);
        setEngineUsed(`Tesseract.js (${lang})`);
        setLatencyMs(Date.now() - start);
      }
    } catch (err: any) {
      console.error('[SnippingTool] Extraction failed:', err);
      // Attempt emergency offline parse
      try {
        const parsed = await extractDataOffline(imageSrc, documentTypeHint);
        if (parsed._rawText) {
          setExtractedText(parsed._rawText);
          setDetectedFields(parsed);
          const lang = detectIndicLanguage(parsed._rawText);
          setDetectedLanguage(lang);
          setEngineUsed(`Offline Engine (${lang})`);
          setLatencyMs(Date.now() - start);
          return;
        }
      } catch {
        // ignore
      }
      setToastMessage('OCR Extraction failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy raw text to system clipboard
  const handleCopyToClipboard = async () => {
    if (!extractedText) return;
    try {
      await Clipboard.write({ string: extractedText });
      setCopied(true);
      setToastMessage('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Browser fallback
      navigator.clipboard?.writeText(extractedText);
      setCopied(true);
      setToastMessage('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Native Share / Export
  const handleShare = async () => {
    if (!extractedText) return;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'Extracted Document Text',
          text: extractedText,
          dialogTitle: 'Share Extracted Text',
        });
      } else {
        // Download as TXT file on Web
        const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `extracted-text-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.warn('[SnippingTool] Share cancelled or failed:', err);
    }
  };

  // Apply to form
  const handleApplyToForm = () => {
    if (detectedFields && onApplyExtractedData) {
      onApplyExtractedData(detectedFields);
      setToastMessage('Fields auto-filled into form!');
      setTimeout(() => {
        onClose();
      }, 500);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Offline Snipping & Text Extractor"
      maxWidth="max-w-4xl"
      hideFooter
    >
      <div className="flex flex-col gap-4 p-4 max-h-[85vh] overflow-y-auto">
        {toastMessage && (
          <Toast message={toastMessage} type="info" onDismiss={() => setToastMessage(null)} />
        )}

        {/* Top Info Banner */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-600/30 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">100% Free On-Device OCR</span>
            <span className="text-emerald-500/80">• Zero Cloud Calls • Zero Data Leakage</span>
          </div>
          {latencyMs !== null && (
            <span className="font-mono text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded">
              ⚡ {latencyMs}ms ({engineUsed})
            </span>
          )}
        </div>

        {/* Image Source & Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-emerald-400 border-emerald-700/50 hover:bg-emerald-900/20"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload / Camera
            </Button>

            {imageSrc && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoDetectEdges}
                  disabled={isDetectingEdges}
                  className="flex items-center gap-1.5 text-xs text-emerald-300 border-emerald-600/50 hover:bg-emerald-900/30 font-medium"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-emerald-400 ${isDetectingEdges ? 'animate-spin' : ''}`} />
                  {isDetectingEdges ? 'Detecting...' : 'Auto Detect Edge'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetToFullImage}
                  className="flex items-center gap-1.5 text-xs text-gray-300 border-gray-700 hover:bg-gray-800"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Full Image
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Indian Languages Selector */}
            <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs">
              <Languages className="w-3.5 h-3.5 text-emerald-400 mr-1.5 shrink-0" />
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-transparent text-emerald-300 font-medium text-xs focus:outline-none cursor-pointer"
                title="Select document language / script"
              >
                <option value="auto" className="bg-gray-900 text-white">Auto (Indian & English)</option>
                <option value="latin" className="bg-gray-900 text-white">English (Latin)</option>
                <option value="devanagari" className="bg-gray-900 text-white">Hindi / Marathi (Devanagari)</option>
                <option value="kannada" className="bg-gray-900 text-white">Kannada (ಕನ್ನಡ)</option>
                <option value="tamil" className="bg-gray-900 text-white">Tamil (தமிழ்)</option>
                <option value="telugu" className="bg-gray-900 text-white">Telugu (తెలుగు)</option>
                <option value="bengali" className="bg-gray-900 text-white">Bengali / Assamese (বাংলা)</option>
                <option value="gujarati" className="bg-gray-900 text-white">Gujarati (ગુજરાતી)</option>
                <option value="odia" className="bg-gray-900 text-white">Odia (ଓଡ଼ିଆ)</option>
              </select>
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleExtractText}
              disabled={!imageSrc || isProcessing}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Recognizing...
                </>
              ) : (
                <>
                  <Scissors className="w-3.5 h-3.5" />
                  Snip & Extract
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Interactive Crop / Snipping Area */}
        {imageSrc ? (
          <div className="relative rounded-lg overflow-hidden border border-gray-800 bg-black/60 select-none">
            <div
              ref={containerRef}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
              className="relative w-full max-h-[360px] flex items-center justify-center cursor-crosshair overflow-hidden"
            >
              <img
                src={imageSrc}
                alt="Document preview"
                className="max-h-[360px] w-auto max-w-full object-contain pointer-events-none"
              />

              {/* Crop Box Overlay */}
              <div
                className="absolute border-2 border-emerald-400 bg-emerald-500/15 pointer-events-none transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.width * 100}%`,
                  height: `${crop.height * 100}%`,
                }}
              >
                <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[10px] font-bold px-1 rounded-bl">
                  SNIP REGION
                </div>
              </div>
            </div>

            <div className="text-[11px] text-gray-400 text-center py-1.5 bg-gray-900/80 border-t border-gray-800 flex items-center justify-center gap-2">
              <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
              <span>Edges auto-detected! Drag on the image to snip a specific region (e.g. Account Number, PAN, or Name).</span>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-700 hover:border-emerald-500 rounded-lg cursor-pointer bg-gray-900/30 transition-colors"
          >
            <Camera className="w-10 h-10 text-gray-400 mb-2" />
            <p className="text-sm font-semibold text-gray-200">Take Photo or Upload Image</p>
            <p className="text-xs text-gray-400 mt-1">Supports PAN, Aadhaar, Salary Slips, Passbooks, Cheques & Indian Languages</p>
          </div>
        )}

        {/* Results Panel */}
        {extractedText && (
          <div className="flex flex-col gap-2 p-3 bg-gray-900/90 rounded-lg border border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  Extracted Text ({extractedText.length} chars)
                </span>
                {detectedLanguage && (
                  <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded-full">
                    🇮🇳 {detectedLanguage}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyToClipboard}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors border border-gray-700"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors border border-gray-700"
                >
                  <Share2 className="w-3 h-3 text-gray-400" />
                  Export
                </button>
              </div>
            </div>

            {/* Editable Textarea */}
            <textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              rows={4}
              className="w-full text-xs font-mono bg-black/60 text-emerald-200 p-2.5 rounded border border-gray-700/80 focus:border-emerald-500 focus:outline-none resize-y"
              placeholder="Extracted text will appear here. You can edit directly."
            />

            {/* Detected Field Badges */}
            {detectedFields && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-800 text-[11px]">
                <span className="text-gray-400 font-semibold mr-1">Detected Fields:</span>
                {detectedFields.name && (
                  <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded">
                    Name: <b>{detectedFields.name}</b>
                  </span>
                )}
                {detectedFields.dob && (
                  <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded">
                    DOB: <b>{detectedFields.dob}</b>
                  </span>
                )}
                {detectedFields.panNumber && (
                  <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded">
                    PAN: <b>{detectedFields.panNumber}</b>
                  </span>
                )}
                {detectedFields.aadhaarNumber && (
                  <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded">
                    Aadhaar: <b>{detectedFields.aadhaarNumber}</b>
                  </span>
                )}
                {detectedFields.accountNumber && (
                  <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded">
                    A/C: <b>{detectedFields.accountNumber}</b>
                  </span>
                )}
                {detectedFields.netPay && (
                  <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded">
                    Net Pay: <b>₹{detectedFields.netPay}</b>
                  </span>
                )}
                {detectedFields.ifscCode && (
                  <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded">
                    IFSC: <b>{detectedFields.ifscCode}</b>
                  </span>
                )}
                {detectedFields.uanNumber && (
                  <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded">
                    UAN: <b>{detectedFields.uanNumber}</b>
                  </span>
                )}

                {onApplyExtractedData && (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={handleApplyToForm}
                    className="ml-auto text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1"
                  >
                    ⚡ Apply to Form
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs text-gray-400 border-gray-700 hover:bg-gray-800"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SnippingToolModal;
