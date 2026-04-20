import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { RefreshCw, Check, X, Loader2, Crop, ZoomIn, ZoomOut, Camera as CameraIcon, ImageIcon } from 'lucide-react';
import { Camera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { api } from '../services/api';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string, mimeType: string) => void;
  captureGuidance?: 'document' | 'profile' | 'none';
  autoConfirm?: boolean;
  /** Pre-captured image (data URL) — skips camera and goes straight to preview */
  initialImage?: string;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', error => reject(error));
    image.src = url;
  });

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return canvas.toDataURL('image/jpeg', 0.9);
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

const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({ isOpen, onClose, onCapture, captureGuidance = 'none', autoConfirm = false, initialImage }) => {
  const [capturedImage, setCapturedImage] = useState<string | null>(initialImage || null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showFallbackUI, setShowFallbackUI] = useState(false);
  const captureInProgress = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setShowCropper(false); setZoom(1); setShowFallbackUI(false);
    handleCapture();
  };
  const onCropDone = (_: Area, px: Area) => setCroppedAreaPixels(px);
  const handleShowCropper = () => { setShowCropper(true); setZoom(1); };
  const handleApplyCrop = async () => {
    try { if (capturedImage && croppedAreaPixels) { setCroppedImage(await getCroppedImg(capturedImage, croppedAreaPixels)); setShowCropper(false); } }
    catch { setError('Failed to crop image'); }
  };
  const handleCancelCrop = () => { setShowCropper(false); setZoom(1); setCroppedImage(null); };

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
      {isProcessing && !isCameraActive && (
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
      }}>
        <div role="button" tabIndex={0} onClick={onClose}
          style={{ ...circleBtn, width: 42, height: 42 }}>
          <X style={{ width: 20, height: 20, color: '#fff' }} />
        </div>
        <span style={{
          fontSize: 17, fontWeight: 700, flex: 1, textAlign: 'center',
          color: '#ffffff', letterSpacing: '0.02em',
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
          <div style={{ position: 'absolute', inset: 0 }}>
            <Cropper
              image={capturedImage} crop={crop} zoom={zoom}
              aspect={captureGuidance === 'profile' ? 1 : 4 / 3}
              onCropChange={setCrop} onCropComplete={onCropDone} onZoomChange={setZoom}
              cropShape={captureGuidance === 'profile' ? 'round' : 'rect'}
              style={{ containerStyle: { backgroundColor: BG }, mediaStyle: { objectFit: 'contain' } }}
            />
          </div>
        ) : (
          displayImage && !isProcessing && (
            <img src={displayImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain', border: 'none', borderRadius: 0 }} />
          )
        )}
      </div>

      {/* ─── Bottom controls ─── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
        padding: '40px 24px 44px 24px',
        background: `linear-gradient(to top, ${BG} 50%, transparent)`,
      }}>
        {showCropper && (
          <div style={{ marginBottom: 20, padding: '0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ZoomOut style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.6)' }} />
              <input type="range" min={1} max={3} step={0.1} value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                style={{ flex: 1, height: 4, borderRadius: 4, accentColor: ACCENT, backgroundColor: 'rgba(255,255,255,0.15)' }}
              />
              <ZoomIn style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.6)' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
          {showCropper ? (
            <>
              <div role="button" tabIndex={0} onClick={handleCancelCrop}
                style={{ ...circleBtn, width: 'auto', height: 'auto', borderRadius: 9999, padding: '14px 28px', fontSize: 15, fontWeight: 600, color: '#fff' }}>
                Cancel
              </div>
              <div role="button" tabIndex={0} onClick={handleApplyCrop}
                style={{ ...circleBtn, width: 'auto', height: 'auto', borderRadius: 9999, padding: '14px 28px', fontSize: 15, fontWeight: 600, color: '#fff', background: ACCENT, border: 'none', boxShadow: '0 4px 20px rgba(34,197,94,0.4)', display: 'flex', gap: 8 }}>
                <Check style={{ width: 18, height: 18, color: '#fff' }} /> Apply
              </div>
            </>
          ) : capturedImage ? (
            <>
              <div role="button" tabIndex={0} onClick={handleRetake} title="Retake" style={circleBtn}>
                <RefreshCw style={iconStyle} />
              </div>
              <div role="button" tabIndex={0} onClick={handleShowCropper} title="Crop" style={circleBtn}>
                <Crop style={iconStyle} />
              </div>
              <div role="button" tabIndex={0} onClick={handleUsePhoto} title="Use Photo"
                style={{
                  width: 66, height: 66, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', border: 'none', background: ACCENT,
                  boxShadow: '0 4px 24px rgba(34,197,94,0.5)', padding: 0,
                }}>
                <Check style={{ width: 28, height: 28, color: '#fff' }} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  // Render via portal to body
  return ReactDOM.createPortal(modalContent, document.body);
};

export default CameraCaptureModal;
