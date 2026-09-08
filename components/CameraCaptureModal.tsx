import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { RefreshCw, Check, X, Loader2, Crop as CropIcon, ZoomIn, ZoomOut, Camera as CameraIcon, ImageIcon } from 'lucide-react';
import { Camera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { api } from '../services/api';
import ReactCrop, { type Crop, type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string, mimeType: string) => void;
  captureGuidance?: 'document' | 'profile' | 'none';
  autoConfirm?: boolean;
  /** Pre-captured image (data URL) — skips camera and goes straight to preview */
  initialImage?: string;
  /** External loading state (e.g. while uploading) */
  isLoading?: boolean;
  /** Optional contextual hint shown in preview step to guide user where to crop */
  cropHint?: string;
}

async function getCroppedImg(image: HTMLImageElement, crop: Crop): Promise<string> {
  const canvas = document.createElement('canvas');
  
  let pixelX = 0;
  let pixelY = 0;
  let pixelWidth = 0;
  let pixelHeight = 0;

  if (crop.unit === '%') {
    pixelX = Math.round((crop.x / 100) * image.naturalWidth);
    pixelY = Math.round((crop.y / 100) * image.naturalHeight);
    pixelWidth = Math.round((crop.width / 100) * image.naturalWidth);
    pixelHeight = Math.round((crop.height / 100) * image.naturalHeight);
  } else {
    const rect = image.getBoundingClientRect();
    const scaleX = image.naturalWidth / (rect.width || image.width || 1);
    const scaleY = image.naturalHeight / (rect.height || image.height || 1);
    pixelX = Math.round(crop.x * scaleX);
    pixelY = Math.round(crop.y * scaleY);
    pixelWidth = Math.round(crop.width * scaleX);
    pixelHeight = Math.round(crop.height * scaleY);
  }

  // Clamping to ensure we never read outside image boundaries
  pixelX = Math.max(0, Math.min(pixelX, image.naturalWidth - 1));
  pixelY = Math.max(0, Math.min(pixelY, image.naturalHeight - 1));
  pixelWidth = Math.max(1, Math.min(pixelWidth, image.naturalWidth - pixelX));
  pixelHeight = Math.max(1, Math.min(pixelHeight, image.naturalHeight - pixelY));

  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    pixelX,
    pixelY,
    pixelWidth,
    pixelHeight,
    0,
    0,
    pixelWidth,
    pixelHeight
  );
  
  return canvas.toDataURL('image/jpeg', 0.95);
}

// ─── Style constants ───
const BG = '#041b0f';
const ACCENT = '#22c55e';

const circleBtn: React.CSSProperties = {
  width: 56, height: 56, borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)', transition: 'background 0.2s', padding: 0,
};
const iconStyle: React.CSSProperties = { width: 22, height: 22, color: '#ffffff' };

const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({ isOpen, onClose, onCapture, captureGuidance = 'none', autoConfirm = false, initialImage, isLoading = false, cropHint }) => {
  const [capturedImage, setCapturedImage] = useState<string | null>(initialImage || null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [showCropper, setShowCropper] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>('both_cards');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showFallbackUI, setShowFallbackUI] = useState(false);
  const captureInProgress = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PRESETS = [
    { id: 'both_cards', label: '🟥 Both Cards (Red Box)', crop: { unit: '%' as const, x: 3.5, y: 56.5, width: 93, height: 39 } },
    { id: 'address', label: '📍 Address Strip', crop: { unit: '%' as const, x: 51, y: 62, width: 45.5, height: 33.5 } },
    { id: 'left_card', label: '🪪 Left Card', crop: { unit: '%' as const, x: 3.5, y: 56.5, width: 45.5, height: 39 } },
    { id: 'right_card', label: '🪪 Right Card', crop: { unit: '%' as const, x: 51, y: 56.5, width: 45.5, height: 39 } },
    { id: 'full_doc', label: '🔲 Full Doc', crop: { unit: '%' as const, x: 0, y: 0, width: 100, height: 100 } },
  ];

  // Check if we're running in the custom Android WebView wrapper
  const isAndroidWrapper = navigator.userAgent.includes('ParadigmApp');
  const isCapacitor = Capacitor.isNativePlatform();
  const startWithImage = !!initialImage;

  // ─── Capacitor Camera capture ───
  const handleCapacitorCapture = async () => {
    // If in the Android wrapper, Capacitor might not be bridged correctly to the remote URL.
    // In that case, we should skip Capacitor and go straight to HTML5 capture.
    if (isAndroidWrapper) {
      console.log('Android wrapper detected, skipping Capacitor camera');
      return false;
    }

    try {
      if (!isCapacitor) {
        const permissions = await Camera.checkPermissions();
        if (permissions.camera === 'denied') {
          const req = await Camera.requestPermissions({ permissions: ['camera'] });
          if (req.camera === 'denied') {
            setError('Camera permission denied. Please grant camera access in Settings.');
            return false;
          }
        }
      }

      const image = await Camera.getPhoto({
        quality: 85,
        width: 1024,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        saveToGallery: false,
        promptLabelHeader: captureGuidance === 'profile' ? 'Capture Profile Photo' : 'Capture Document',
        promptLabelPhoto: 'From Gallery',
        promptLabelPicture: 'Take Photo',
      });

      if (image.base64String) {
        const dataUrl = `data:image/${image.format || 'jpeg'};base64,${image.base64String}`;
        if (autoConfirm) {
          onCapture(image.base64String, `image/${image.format || 'jpeg'}`);
          onClose();
          return true;
        }
        setCapturedImage(dataUrl);
        return true;
      }
      return false;
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('cancel')) { onClose(); return true; }
      console.error('Capacitor Camera failed:', err);
      return false;
    }
  };

  // ─── HTML5 fallback ───
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        if (autoConfirm) {
          const b64 = dataUrl.split(',')[1];
          onCapture(b64, file.type || 'image/jpeg');
          onClose();
          return;
        }
        setCapturedImage(dataUrl);
        setShowFallbackUI(false);
        setError(null);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File read failed:', err);
      setError('Failed to read captured photo.');
    }
  };

  // ─── Main capture handler ───
  const handleCapture = useCallback(async () => {
    if (captureInProgress.current) return;
    captureInProgress.current = true;

    setError(null);
    setIsProcessing(true);
    setIsCameraActive(true);
    setProcessingMessage('Opening camera...');

    try {
      // If we're starting with an image (from native camera), we don't need to capture again.
      if (startWithImage) {
        setIsCameraActive(false);
        setIsProcessing(false);
        captureInProgress.current = false;
        return;
      }

      const success = await handleCapacitorCapture();
      if (!success) {
        // Capacitor camera failed — show fallback UI with file picker
        console.log('Capacitor camera unavailable or skipped, showing fallback');
        setIsCameraActive(false);
        setIsProcessing(false);
        setShowFallbackUI(true);
        // Auto-trigger file input on mobile platforms
        if (isAndroidWrapper || isCapacitor) {
          setTimeout(() => triggerFileInput(), 100);
        }
        captureInProgress.current = false;
        return;
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setShowFallbackUI(true);
    } finally {
      setIsCameraActive(false);
      setTimeout(() => { setIsProcessing(false); captureInProgress.current = false; }, 300);
    }
  }, [captureGuidance, autoConfirm, isCapacitor, isAndroidWrapper, startWithImage]);

  // When initialImage is provided (native capture), set it
  useEffect(() => {
    if (initialImage) setCapturedImage(initialImage);
  }, [initialImage]);

  // Auto-trigger capture when modal opens (only if no pre-captured image)
  useEffect(() => {
    if (isOpen && !capturedImage && !startWithImage) {
      handleCapture();
    }
  }, [isOpen]);

  const handleRetake = () => {
    setError(null); setCapturedImage(null); setCroppedImage(null);
    setShowCropper(false); setShowFallbackUI(false);
    handleCapture();
  };

  const applyPreset = (presetCrop: PercentCrop, presetId: string) => {
    setActivePreset(presetId);
    setCrop(presetCrop);
  };

  const handleShowCropper = () => {
    setShowCropper(true);
    setAspect(undefined);
    const initial = captureGuidance === 'profile'
      ? { unit: '%' as const, x: 20, y: 15, width: 60, height: 60 }
      : { unit: '%' as const, x: 3.5, y: 56.5, width: 93, height: 39 };
    setCrop(initial);
    setActivePreset(captureGuidance === 'profile' ? null : 'both_cards');
  };

  const handleApplyCrop = async () => {
    try {
      if (imgRef.current && crop && crop.width > 1 && crop.height > 1) {
        const cropped = await getCroppedImg(imgRef.current, crop);
        setCroppedImage(cropped);
        setShowCropper(false);
        return;
      }
      setShowCropper(false);
    } catch (err) {
      console.error('Failed to crop image:', err);
      setError('Failed to crop image');
    }
  };

  const handleCancelCrop = () => {
    setShowCropper(false);
  };

  const handleUsePhoto = async () => {
    const img = croppedImage || capturedImage;
    if (!img) return;
    setIsProcessing(true);
    try {
      const b64 = img.split(',')[1];
      setProcessingMessage('Processing photo...');
      const enhanced = captureGuidance === 'document' ? await api.enhanceDocumentPhoto(b64, 'image/jpeg') : null;
      onCapture(enhanced || b64, 'image/jpeg');
      onClose();
    } catch (err: any) { setError(err.message || 'Processing failed.'); }
    finally { setIsProcessing(false); }
  };

  if (!isOpen) return null;
  const displayImage = croppedImage || capturedImage;

  const modalContent = (
    <div
      className="camera-capture-modal"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 99999,
        display: isCameraActive ? 'none' : 'flex',
        flexDirection: 'column',
        backgroundColor: BG, color: '#ffffff',
        animation: 'none', opacity: 1,
        border: 'none', borderRadius: 0, boxShadow: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Hidden HTML5 file input — works everywhere as fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />

      {/* Processing overlay */}
      {(isProcessing || isLoading) && !isCameraActive && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 40,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(4,27,15,0.92)',
        }}>
          <Loader2 style={{ width: 48, height: 48, color: ACCENT }} className="animate-spin" />
          <p style={{ marginTop: 16, fontSize: 17, fontWeight: 600, color: '#fff' }}>{processingMessage}</p>
        </div>
      )}

      {/* ─── Top bar ─── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        padding: '16px 16px 40px 16px',
        background: `linear-gradient(to bottom, ${BG} 40%, transparent)`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        pointerEvents: 'none',
      }}>
        <div role="button" tabIndex={0} onClick={onClose}
          style={{ ...circleBtn, width: 42, height: 42, pointerEvents: 'auto' }}>
          <X style={{ width: 20, height: 20, color: '#fff' }} />
        </div>
        <span style={{
          fontSize: 17, fontWeight: 700, flex: 1, textAlign: 'center',
          color: '#ffffff', letterSpacing: '0.02em', pointerEvents: 'auto',
        }}>
          {showCropper ? 'Crop Photo' : capturedImage && !isProcessing ? 'Preview' : 'Capture Photo'}
        </span>
        <div style={{ width: 42 }} />
      </div>

      {/* ─── Main content ─── */}
      <div style={{
        flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', backgroundColor: BG,
      }}>
        {/* Fallback UI — camera failed, show file picker options */}
        {showFallbackUI && !capturedImage && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: 'rgba(34,197,94,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            }}>
              <CameraIcon style={{ width: 36, height: 36, color: ACCENT }} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 8, textAlign: 'center' }}>
              {captureGuidance === 'profile' ? 'Take Profile Photo' : 'Capture Image'}
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 28, textAlign: 'center', lineHeight: 1.5, maxWidth: 280 }}>
              Tap a button below to take a photo or choose from your gallery
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 260 }}>
              <div role="button" tabIndex={0}
                onClick={triggerFileInput}
                style={{
                  background: ACCENT, color: '#fff', borderRadius: 16,
                  padding: '16px 24px', fontWeight: 600, fontSize: 16, cursor: 'pointer',
                  border: 'none', boxShadow: '0 4px 20px rgba(34,197,94,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}>
                  <CameraIcon style={{ width: 20, height: 20, color: '#fff' }} />
                Open Camera
              </div>
              <div role="button" tabIndex={0}
                onClick={() => {
                  // Temporarily remove capture=user to allow gallery access
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute('capture');
                    fileInputRef.current.value = '';
                    fileInputRef.current.click();
                    // Restore capture for next time
                    setTimeout(() => {
                      if (fileInputRef.current) fileInputRef.current.setAttribute('capture', 'user');
                    }, 500);
                  }
                }}
                style={{
                  background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 16,
                  padding: '16px 24px', fontWeight: 600, fontSize: 16, cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}>
                <ImageIcon style={{ width: 20, height: 20, color: '#fff' }} />
                From Gallery
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !capturedImage && !showFallbackUI && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
            backgroundColor: 'rgba(4,27,15,0.85)', zIndex: 10,
          }}>
            <p style={{ marginBottom: 20, color: '#fff', fontSize: 16, lineHeight: 1.5 }}>{error}</p>
            <div role="button" tabIndex={0} onClick={handleCapture}
              style={{ background: ACCENT, color: '#fff', borderRadius: 9999, padding: '14px 28px', fontWeight: 600, fontSize: 15, cursor: 'pointer', border: 'none' }}>
              Try Again
            </div>
          </div>
        )}

        {/* Cropper */}
        {showCropper && capturedImage ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '56px 12px 130px 12px',
            backgroundColor: BG,
            overflow: 'hidden',
          }}>
            <style>{`
              .ReactCrop {
                --rc-drag-handle-size: 22px;
                --rc-drag-handle-mobile-size: 26px;
                --rc-drag-bar-size: 14px;
                touch-action: none !important;
                user-select: none !important;
                -webkit-user-select: none !important;
              }
              .ReactCrop__crop-selection {
                border: 2.5px solid ${ACCENT} !important;
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.72) !important;
                background-color: rgba(34, 197, 94, 0.08) !important;
                touch-action: none !important;
                cursor: move !important;
              }
              .ReactCrop__drag-handle {
                width: 22px !important;
                height: 22px !important;
                background-color: ${ACCENT} !important;
                border: 2.5px solid #ffffff !important;
                border-radius: 50% !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.7) !important;
                opacity: 1 !important;
                touch-action: none !important;
                pointer-events: auto !important;
                z-index: 10 !important;
              }
              .ReactCrop .ord-nw { top: 0; left: 0; transform: translate(-50%, -50%) !important; }
              .ReactCrop .ord-n  { top: 0; left: 50%; transform: translate(-50%, -50%) !important; }
              .ReactCrop .ord-ne { top: 0; right: 0; transform: translate(50%, -50%) !important; }
              .ReactCrop .ord-e  { top: 50%; right: 0; transform: translate(50%, -50%) !important; }
              .ReactCrop .ord-se { bottom: 0; right: 0; transform: translate(50%, 50%) !important; }
              .ReactCrop .ord-s  { bottom: 0; left: 50%; transform: translate(-50%, 50%) !important; }
              .ReactCrop .ord-sw { bottom: 0; left: 0; transform: translate(-50%, 50%) !important; }
              .ReactCrop .ord-w  { top: 50%; left: 0; transform: translate(-50%, -50%) !important; }

              /* Force all 8 handles visible even on touch devices (pointer: coarse) */
              .ReactCrop .ord-n,
              .ReactCrop .ord-e,
              .ReactCrop .ord-s,
              .ReactCrop .ord-w {
                display: block !important;
              }

              /* Edge drag bars */
              .ReactCrop__drag-bar {
                touch-action: none !important;
              }
              .ReactCrop__drag-bar.ord-n { height: 16px !important; transform: translateY(-50%) !important; }
              .ReactCrop__drag-bar.ord-s { height: 16px !important; transform: translateY(-50%) !important; }
              .ReactCrop__drag-bar.ord-w { width: 16px !important; transform: translateX(-50%) !important; }
              .ReactCrop__drag-bar.ord-e { width: 16px !important; transform: translateX(-50%) !important; }
            `}</style>
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => {
                setActivePreset(null);
                setCrop(percentCrop);
              }}
              onComplete={(_, percentCrop) => {
                setCrop(percentCrop);
              }}
              aspect={aspect}
              circularCrop={captureGuidance === 'profile'}
              style={{
                maxHeight: '100%',
                maxWidth: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                ref={imgRef}
                src={capturedImage}
                alt="Crop Target"
                style={{
                  maxHeight: 'calc(100vh - 190px)',
                  maxWidth: 'calc(100vw - 24px)',
                  width: 'auto',
                  height: 'auto',
                  display: 'block',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
                onLoad={() => {
                  const initial = captureGuidance === 'profile'
                    ? { unit: '%' as const, x: 20, y: 15, width: 60, height: 60 }
                    : { unit: '%' as const, x: 3.5, y: 56.5, width: 93, height: 39 };
                  setCrop(initial);
                  setActivePreset(captureGuidance === 'profile' ? null : 'both_cards');
                }}
              />
            </ReactCrop>
          </div>
        ) : (
          displayImage && !isProcessing && (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <img src={displayImage} alt="Preview" style={{ maxWidth: '100%', maxHeight: cropHint ? 'calc(100% - 72px)' : '100%', objectFit: 'contain', border: 'none', borderRadius: 0 }} />
              {cropHint && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(to top, rgba(4,27,15,0.95) 60%, transparent)',
                  padding: '32px 20px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, margin: 0 }}>
                    {cropHint}
                  </p>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* ─── Bottom controls ─── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
        padding: '16px 16px 28px 16px',
        background: `linear-gradient(to top, ${BG} 75%, transparent)`,
        pointerEvents: 'none',
      }}>
        {showCropper && (
          <div style={{ marginBottom: 12, pointerEvents: 'auto' }}>
            {/* Quick Presets matching user's red box and other selections */}
            {captureGuidance !== 'profile' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                flexWrap: 'wrap',
                marginBottom: 8,
                padding: '0 4px',
              }}>
                {PRESETS.map((p) => {
                  const isActive = activePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setAspect(undefined);
                        applyPreset(p.crop, p.id);
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 9999,
                        fontSize: 12,
                        fontWeight: isActive ? 700 : 600,
                        border: isActive ? `2px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.2)',
                        background: isActive ? 'rgba(34,197,94,0.32)' : 'rgba(255,255,255,0.08)',
                        color: isActive ? '#ffffff' : 'rgba(255,255,255,0.85)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                        boxShadow: isActive ? '0 2px 10px rgba(34,197,94,0.3)' : 'none',
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '4px 0 0 0' }}>
              💡 Drag any corner circle, edge or box center to adjust manually
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28, pointerEvents: 'auto' }}>
          {showCropper ? (
            <>
              <div role="button" tabIndex={0} onClick={handleCancelCrop}
                style={{ ...circleBtn, width: 'auto', height: 'auto', borderRadius: 9999, padding: '12px 24px', fontSize: 14, fontWeight: 600, color: '#fff' }}>
                Cancel
              </div>
              <div role="button" tabIndex={0} onClick={handleApplyCrop}
                style={{ ...circleBtn, width: 'auto', height: 'auto', borderRadius: 9999, padding: '12px 24px', fontSize: 14, fontWeight: 600, color: '#fff', background: ACCENT, border: 'none', boxShadow: '0 4px 20px rgba(34,197,94,0.4)', display: 'flex', gap: 8 }}>
                <Check style={{ width: 18, height: 18, color: '#fff' }} /> Apply Crop
              </div>
            </>
          ) : capturedImage ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div role="button" tabIndex={0} onClick={handleRetake} title="Retake" style={circleBtn}>
                  <RefreshCw style={iconStyle} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Retake</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div role="button" tabIndex={0} onClick={handleShowCropper} title="Crop" style={{ ...circleBtn, background: 'rgba(34,197,94,0.15)', borderColor: ACCENT }}>
                  <CropIcon style={{ ...iconStyle, color: ACCENT }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>Crop</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div role="button" tabIndex={0} onClick={handleUsePhoto} title="Confirm & Use"
                  style={{
                    width: 66, height: 66, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: 'none', background: ACCENT,
                    boxShadow: '0 4px 24px rgba(34,197,94,0.5)', padding: 0,
                  }}>
                  <Check style={{ width: 28, height: 28, color: '#fff' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff' }}>Confirm</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  return modalContent;
};

export default CameraCaptureModal;
