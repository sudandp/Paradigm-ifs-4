import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { 
  ArrowLeft, Zap, Grid3X3, SwitchCamera, Sliders, 
  Camera as CameraIcon, Check, Crop as CropIcon, 
  ImageIcon, Loader2, RotateCcw, RotateCw
} from 'lucide-react';
import { api } from '../services/api';
import ReactCrop, { type Crop, type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { rotateImage, autoRotateDocumentIfSideways } from '../utils/imageRotation';

export interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string, mimeType: string) => void;
  captureGuidance?: 'document' | 'profile' | 'none';
  docType?: string;
  documentTitle?: string;
  autoConfirm?: boolean;
  /** Pre-captured image (data URL) — skips camera and goes straight to preview */
  initialImage?: string;
  /** External loading state (e.g. while uploading) */
  isLoading?: boolean;
  /** Optional contextual hint shown in preview step to guide user where to crop */
  cropHint?: string;
}

type ScannerMode = 'PHOTO' | 'DOCUMENT' | 'ID CARD' | 'BOOK' | 'BARCODE';
type FilterMode = 'natural' | 'enhanced' | 'bw';

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

  // Clamping to ensure boundaries
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

const PRESETS = [
  { id: 'both_cards', label: '🟥 Both Cards (Red Box)', crop: { unit: '%' as const, x: 3.5, y: 56.5, width: 93, height: 39 } },
  { id: 'address', label: '📍 Address Strip', crop: { unit: '%' as const, x: 51, y: 62, width: 45.5, height: 33.5 } },
  { id: 'left_card', label: '🪪 Left Card', crop: { unit: '%' as const, x: 3.5, y: 56.5, width: 45.5, height: 39 } },
  { id: 'right_card', label: '🪪 Right Card', crop: { unit: '%' as const, x: 51, y: 56.5, width: 45.5, height: 39 } },
  { id: 'full_doc', label: '🔲 Full Doc', crop: { unit: '%' as const, x: 0, y: 0, width: 100, height: 100 } },
];

const SCANNER_MODES: ScannerMode[] = ['PHOTO', 'DOCUMENT', 'ID CARD', 'BOOK', 'BARCODE'];

const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  captureGuidance = 'none',
  docType,
  documentTitle,
  autoConfirm = false,
  initialImage,
  isLoading = false,
  cropHint,
}) => {
  // Determine initial default mode based on document type
  const getInitialMode = useCallback((): ScannerMode => {
    if (captureGuidance === 'profile') return 'PHOTO';
    const tag = `${docType || ''} ${documentTitle || ''}`.toLowerCase();
    if (tag.includes('photo') || tag.includes('avatar') || tag.includes('selfie')) return 'PHOTO';
    if (tag.includes('aadhaar') || tag.includes('pan') || tag.includes('voter') || tag.includes('driving') || tag.includes('license') || tag.includes('dl') || tag.includes('id proof')) {
      return 'ID CARD';
    }
    if (tag.includes('bank') || tag.includes('cheque') || tag.includes('passbook') || tag.includes('salary') || tag.includes('payslip') || tag.includes('uan') || tag.includes('certificate') || tag.includes('education')) {
      return 'DOCUMENT';
    }
    return 'ID CARD';
  }, [captureGuidance, docType, documentTitle]);

  const getInitialFacingMode = useCallback((): 'environment' | 'user' => {
    if (captureGuidance === 'profile') return 'user';
    const tag = `${docType || ''} ${documentTitle || ''}`.toLowerCase();
    if (tag.includes('photo') || tag.includes('avatar') || tag.includes('selfie')) return 'user';
    if (getInitialMode() === 'PHOTO') return 'user';
    return 'environment';
  }, [captureGuidance, docType, documentTitle, getInitialMode]);

  const [activeMode, setActiveMode] = useState<ScannerMode>(getInitialMode);
  const [capturedImage, setCapturedImage] = useState<string | null>(initialImage || null);
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(getInitialFacingMode);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [hasFlashSupport, setHasFlashSupport] = useState(false);
  const [isGridOn, setIsGridOn] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('natural');
  const [filterToast, setFilterToast] = useState<string | null>(null);
  const filterToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [showCropper, setShowCropper] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [aspect, setAspect] = useState<number | undefined>(() => (captureGuidance === 'profile' || getInitialMode() === 'PHOTO') ? 1 : undefined);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>('both_cards');
  const [showFallbackUI, setShowFallbackUI] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Callback ref to attach stream immediately whenever the video DOM node mounts or changes
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current;
      }
      node.play().catch(e => console.warn('Video play on mount warning:', e));
    }
  }, []);

  // Sync mode and camera facing direction when props change
  useEffect(() => {
    const nextMode = getInitialMode();
    setActiveMode(nextMode);
    const nextFacing = getInitialFacingMode();
    setFacingMode(nextFacing);
    setAspect(nextMode === 'PHOTO' ? 1 : undefined);
  }, [getInitialMode, getInitialFacingMode]);

  // Sync initialImage if provided (auto-orienting sideways cards)
  useEffect(() => {
    if (initialImage) {
      autoRotateDocumentIfSideways(initialImage, docType, documentTitle).then((rotRes) => {
        setCapturedImage(rotRes.dataUrl);
      }).catch(() => {
        setCapturedImage(initialImage);
      });
      setIsLiveCameraActive(false);
    }
  }, [initialImage, docType, documentTitle]);

  // ─── Camera Stream Management ───
  const stopLiveCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          if (isFlashOn) {
            (track as any).applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
          }
          track.stop();
        } catch (e) {
          console.warn('Track stop error:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLiveCameraActive(false);
    setIsFlashOn(false);
  }, [isFlashOn]);

  const startLiveCamera = useCallback(async (facing: 'environment' | 'user' = facingMode) => {
    // If starting with an image or cropper active, skip live camera
    if (capturedImage) return;

    // Check mediaDevices support
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      console.warn('getUserMedia not supported in this environment');
      setShowFallbackUI(true);
      return;
    }

    setError(null);
    setIsProcessing(true);
    setProcessingMessage(facing === 'user' ? 'Opening front camera...' : 'Opening back camera...');
    
    // Stop and release previous stream so Android Camera HAL doesn't lock device
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          if (isFlashOn) {
            (track as any).applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
          }
          track.stop();
        } catch (e) {
          console.warn('Track stop error:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsFlashOn(false);

    // Short pause allows Android Camera HAL to cleanly release previous hardware session
    await new Promise(r => setTimeout(r, 180));

    // Determine device orientation so camera doesn't zoom in 3x on mobile portrait
    const isPortrait = typeof window !== 'undefined' ? window.innerHeight >= window.innerWidth : true;
    const targetWidth = isPortrait ? { ideal: 1080 } : { ideal: 1920 };
    const targetHeight = isPortrait ? { ideal: 1920 } : { ideal: 1080 };
    const targetAspectRatio = isPortrait ? { ideal: 9 / 16 } : { ideal: 16 / 9 };

    try {
      let stream: MediaStream | null = null;

      // Check available devices via enumerateDevices() to find exact camera
      let preferredDeviceId: string | undefined;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        if (videoInputs.length > 1) {
          if (facing === 'user') {
            const front = videoInputs.find(d => 
              /front|user|selfie/i.test(d.label) || /facing front/i.test(d.label)
            );
            if (front) preferredDeviceId = front.deviceId;
          } else {
            const back = videoInputs.find(d => 
              /back|rear|environment/i.test(d.label) || /facing back/i.test(d.label)
            );
            if (back) preferredDeviceId = back.deviceId;
          }
        }
      } catch (enumErr) {
        console.warn('enumerateDevices error:', enumErr);
      }

      // Strategy 1: Specific Device ID (Most reliable on multi-camera Android devices)
      if (preferredDeviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: preferredDeviceId },
              width: targetWidth,
              height: targetHeight,
              aspectRatio: targetAspectRatio,
            },
            audio: false,
          });
        } catch (devErr) {
          console.warn('deviceId exact constraint failed, falling back:', devErr);
        }
      }

      // Strategy 2: Exact facingMode
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { exact: facing },
              width: targetWidth,
              height: targetHeight,
              aspectRatio: targetAspectRatio,
            },
            audio: false,
          });
        } catch (exactErr) {
          console.warn('exact facingMode failed, falling back:', exactErr);
        }
      }

      // Strategy 3: Direct facingMode constraint
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facing,
              width: targetWidth,
              height: targetHeight,
              aspectRatio: targetAspectRatio,
            },
            audio: false,
          });
        } catch (facingErr) {
          console.warn('standard facingMode failed, falling back to ideal:', facingErr);
        }
      }

      // Strategy 4: Ideal facingMode
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facing },
              width: isPortrait ? { ideal: 720 } : { ideal: 1280 },
              height: isPortrait ? { ideal: 1280 } : { ideal: 720 },
            },
            audio: false,
          });
        } catch (idealErr) {
          console.warn('ideal facingMode failed, falling back to any camera:', idealErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (!stream) {
        throw new Error('Unable to obtain camera stream');
      }

      streamRef.current = stream;

      // Activate camera in React state so <video> element is rendered
      setIsLiveCameraActive(true);
      setShowFallbackUI(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(e => console.warn('Video play interrupted:', e));
      }

      // Check flash / torch capability
      const track = stream.getVideoTracks()[0];
      const capabilities = (track?.getCapabilities?.() || {}) as any;
      setHasFlashSupport(!!capabilities.torch);
    } catch (err: any) {
      console.warn('Live camera stream error, switching to fallback:', err);
      setIsLiveCameraActive(false);
      setShowFallbackUI(true);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera access denied. Please enable camera permissions in your browser or select an image from gallery.');
      } else {
        setError('Unable to access camera: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setIsProcessing(false);
    }
  }, [capturedImage, facingMode, isFlashOn]);

  // Ensure stream is played whenever isLiveCameraActive state changes
  useEffect(() => {
    if (isLiveCameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(e => console.warn('Stream play effect warning:', e));
    }
  }, [isLiveCameraActive]);

  // Start camera when modal opens without a pre-existing image
  useEffect(() => {
    if (isOpen && !capturedImage) {
      startLiveCamera(facingMode);
    } else if (!isOpen) {
      stopLiveCamera();
      setCapturedImage(null);
      setCroppedImage(null);
      setShowCropper(false);
      setShowFallbackUI(false);
      setError(null);
    }

    return () => {
      stopLiveCamera();
    };
  }, [isOpen, capturedImage, facingMode, startLiveCamera, stopLiveCamera]);

  // ─── Camera Controls ───
  const handleToggleFlash = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !isFlashOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: next }]
      });
      setIsFlashOn(next);
    } catch (err) {
      console.warn('Torch constraint toggle error:', err);
    }
  };

  const handleFlipCamera = async () => {
    if (isSwitchingCamera || isProcessing) return;
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setIsSwitchingCamera(true);
    setFacingMode(nextFacing);
    try {
      await startLiveCamera(nextFacing);
      const label = nextFacing === 'user' ? 'Front Camera Active' : 'Back Camera Active';
      setFilterToast(label);
      if (filterToastTimerRef.current) clearTimeout(filterToastTimerRef.current);
      filterToastTimerRef.current = setTimeout(() => {
        setFilterToast(null);
      }, 1800);
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  const handleToggleGrid = () => {
    setIsGridOn(prev => !prev);
  };

  const handleCycleFilter = () => {
    const next = filterMode === 'natural' ? 'enhanced' : filterMode === 'enhanced' ? 'bw' : 'natural';
    setFilterMode(next);
    const label = next === 'enhanced' ? 'Enhanced Doc Mode' : next === 'bw' ? 'B&W High Contrast' : 'Natural Color';
    setFilterToast(label);
    if (filterToastTimerRef.current) clearTimeout(filterToastTimerRef.current);
    filterToastTimerRef.current = setTimeout(() => {
      setFilterToast(null);
    }, 1800);
  };

  const handleModeChange = (mode: ScannerMode) => {
    setActiveMode(mode);
    setAspect(mode === 'PHOTO' ? 1 : undefined);
    // Automatically switch to front camera for selfie PHOTO mode, and rear camera for documents
    const targetFacing: 'user' | 'environment' = mode === 'PHOTO' ? 'user' : 'environment';
    if (targetFacing !== facingMode) {
      setFacingMode(targetFacing);
      startLiveCamera(targetFacing);
    }
  };

  // ─── Live Shutter Snap ───
  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Apply document contrast/filters if selected
    if (filterMode === 'enhanced') {
      ctx.filter = 'contrast(1.25) brightness(1.05) saturate(1.05)';
    } else if (filterMode === 'bw') {
      ctx.filter = 'grayscale(1) contrast(1.4) brightness(1.05)';
    }

    // If selfie camera, mirror horizontally so captured photo matches preview
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Shutter flash effect
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 180);

    // Delay stopping the camera to ensure the GPU has fully flushed the frame to the canvas
    // before the video stream is destroyed. This prevents black/blank photo issues on mobile devices.
    setTimeout(() => {
      stopLiveCamera();
    }, 250);

    // Auto-rotate if sideways landscape document photographed in portrait
    autoRotateDocumentIfSideways(dataUrl, docType, documentTitle).then((rotRes) => {
      const finalDataUrl = rotRes.dataUrl;
      setCapturedImage(finalDataUrl);
      if (autoConfirm) {
        const b64 = finalDataUrl.split(',')[1];
        onCapture(b64, 'image/jpeg');
        onClose();
      }
    }).catch(() => {
      setCapturedImage(dataUrl);
      if (autoConfirm) {
        const b64 = dataUrl.split(',')[1];
        onCapture(b64, 'image/jpeg');
        onClose();
      }
    });
  };

  // ─── File Input (Gallery Fallback) ───
  const triggerFileInput = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
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
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        stopLiveCamera();
        setShowFallbackUI(false);
        setError(null);
        let finalDataUrl = dataUrl;
        try {
          const rotRes = await autoRotateDocumentIfSideways(dataUrl, docType, documentTitle, file.name);
          finalDataUrl = rotRes.dataUrl;
        } catch (rotErr) {
          console.warn('[CameraCaptureModal] Auto-rotation skipped on file upload:', rotErr);
        }
        setCapturedImage(finalDataUrl);
        if (autoConfirm) {
          const b64 = finalDataUrl.split(',')[1];
          onCapture(b64, file.type || 'image/jpeg');
          onClose();
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File reading failed:', err);
      setError('Could not load image file from device.');
    }
  };

  // ─── Rotate 90° Clockwise ───
  const handleRotate = async () => {
    const target = croppedImage || capturedImage;
    if (!target) return;
    try {
      const res = await rotateImage(target, 90, 'rotated.jpg');
      if (croppedImage) {
        setCroppedImage(res.dataUrl);
      } else {
        setCapturedImage(res.dataUrl);
      }
    } catch (err) {
      console.warn('[CameraCaptureModal] Rotate error:', err);
    }
  };

  // ─── Retake / Reset ───
  const handleRetake = () => {
    setError(null);
    setCapturedImage(null);
    setCroppedImage(null);
    setShowCropper(false);
    setShowFallbackUI(false);
    startLiveCamera(facingMode);
  };

  // ─── Crop Controls ───
  const handleShowCropper = () => {
    setShowCropper(true);
    setAspect(activeMode === 'PHOTO' ? 1 : undefined);
    const initial = activeMode === 'PHOTO'
      ? { unit: '%' as const, x: 15, y: 10, width: 70, height: 70 }
      : { unit: '%' as const, x: 3.5, y: 56.5, width: 93, height: 39 };
    setCrop(initial);
    setActivePreset(activeMode === 'PHOTO' ? null : 'both_cards');
  };

  const applyPreset = (presetCrop: PercentCrop, presetId: string) => {
    setActivePreset(presetId);
    setCrop(presetCrop);
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
      console.error('Crop failed:', err);
      setError('Failed to crop image.');
    }
  };

  const handleCancelCrop = () => {
    setShowCropper(false);
  };

  // ─── Final Confirm & Use ───
  const handleUsePhoto = async () => {
    const img = croppedImage || capturedImage;
    if (!img) return;
    setIsProcessing(true);
    setError(null);
    try {
      const b64 = img.includes(',') ? img.split(',')[1] : img;
      setProcessingMessage(activeMode === 'PHOTO' ? 'Processing photo...' : 'Preparing document...');
      let enhanced: string | null = null;
      if (captureGuidance === 'document') {
        try {
          enhanced = await api.enhanceDocumentPhoto(b64, 'image/jpeg');
        } catch (enhanceErr) {
          console.warn('[CameraCapture] Document enhancement bypassed (quota limit / offline):', enhanceErr);
          enhanced = null;
        }
      }
      onCapture(enhanced || b64, 'image/jpeg');
      onClose();
    } catch (err: any) {
      console.error('[CameraCapture] Failed in handleUsePhoto:', err);
      // Fail-safe: even if unexpected error happens, pass raw photo and close modal
      try {
        const fallbackB64 = img.includes(',') ? img.split(',')[1] : img;
        onCapture(fallbackB64, 'image/jpeg');
        onClose();
      } catch (finalErr: any) {
        setError(finalErr?.message || 'Processing failed.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Smart Auto-Capture (Stability Detection) ───
  const [autoCaptureProgress, setAutoCaptureProgress] = useState(0);
  const autoCaptureRef = useRef({
    prevData: null as Uint8ClampedArray | null,
    stableFrames: 0,
    isActive: false,
    reqId: 0,
  });

  const runAutoCaptureLoop = useCallback(async () => {
    if (!videoRef.current || !autoCaptureRef.current.isActive) return;
    const video = videoRef.current;
    
    // Video not ready yet
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      autoCaptureRef.current.reqId = requestAnimationFrame(runAutoCaptureLoop);
      return;
    }

    // ─── Real Face Detection for PHOTO Mode ───
    if (activeMode === 'PHOTO') {
      try {
        const faceapi = await import('@vladmandic/face-api');
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
          const modelUrl = isNative ? 'capacitor://localhost/models' : '/models';
          await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
        }
        
        const detection = await faceapi.detectSingleFace(
          video, 
          new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 })
        );
        
        if (detection) {
          autoCaptureRef.current.stableFrames++;
        } else {
          // Allow minor blips, but generally reset
          autoCaptureRef.current.stableFrames = Math.max(0, autoCaptureRef.current.stableFrames - 1);
        }
      } catch (err) {
        console.warn('Face detection error:', err);
      }
      
      // Face-api is slower, so 6 consecutive frames of face is enough
      const targetFrames = 6; 
      const progress = Math.min(100, (autoCaptureRef.current.stableFrames / targetFrames) * 100);
      setAutoCaptureProgress(progress);
      
      if (autoCaptureRef.current.stableFrames >= targetFrames) {
        autoCaptureRef.current.isActive = false;
        handleSnapPhoto();
        return;
      }
      
      if (autoCaptureRef.current.isActive) {
        autoCaptureRef.current.reqId = requestAnimationFrame(runAutoCaptureLoop);
      }
      return;
    }

    // ─── Stability Detection for Document Modes ───
    const canvas = document.createElement('canvas');
    canvas.width = 64; 
    canvas.height = 64;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 64, 64);
    const imageData = ctx.getImageData(0, 0, 64, 64);
    const data = imageData.data;

    let motion = 0;
    if (autoCaptureRef.current.prevData) {
      const prev = autoCaptureRef.current.prevData;
      // Calculate absolute difference between frames to detect movement
      for (let i = 0; i < data.length; i += 4) {
        motion += Math.abs(data[i] - prev[i]) + Math.abs(data[i+1] - prev[i+1]) + Math.abs(data[i+2] - prev[i+2]);
      }
    }
    autoCaptureRef.current.prevData = new Uint8ClampedArray(data);

    const avgMotion = motion / (64 * 64);
    
    // Threshold for stability (relaxed up to 80 for normal camera noise)
    if (avgMotion >= 0 && avgMotion < 80) { 
      autoCaptureRef.current.stableFrames++;
    } else {
      autoCaptureRef.current.stableFrames = 0;
    }

    // Require ~0.75 seconds of stability (approx 45 frames)
    const targetFrames = 45; 
    const progress = Math.min(100, (autoCaptureRef.current.stableFrames / targetFrames) * 100);
    
    setAutoCaptureProgress(progress);

    if (autoCaptureRef.current.stableFrames >= targetFrames) {
      autoCaptureRef.current.isActive = false;
      handleSnapPhoto();
      return;
    }

    if (autoCaptureRef.current.isActive) {
      autoCaptureRef.current.reqId = requestAnimationFrame(runAutoCaptureLoop);
    }
  }, [handleSnapPhoto, activeMode]);

  useEffect(() => {
    // Run auto-capture for all document types and photos
    if (isLiveCameraActive && !capturedImage) {
      autoCaptureRef.current.isActive = true;
      autoCaptureRef.current.stableFrames = 0;
      setAutoCaptureProgress(0);
      autoCaptureRef.current.reqId = requestAnimationFrame(runAutoCaptureLoop);
    } else {
      autoCaptureRef.current.isActive = false;
      cancelAnimationFrame(autoCaptureRef.current.reqId);
      setAutoCaptureProgress(0);
    }
    return () => {
      autoCaptureRef.current.isActive = false;
      cancelAnimationFrame(autoCaptureRef.current.reqId);
    };
  }, [isLiveCameraActive, capturedImage, runAutoCaptureLoop]);

  if (!isOpen) return null;

  const displayImage = croppedImage || capturedImage;

  // Viewfinder Card Aspect Ratio based on Mode
  const getViewfinderStyle = () => {
    switch (activeMode) {
      case 'PHOTO':
        return 'w-[260px] h-[260px] sm:w-[290px] sm:h-[290px] rounded-full overflow-hidden';
      case 'DOCUMENT':
        return 'w-[84%] max-w-[340px] aspect-[1/1.38] rounded-2xl';
      case 'BOOK':
        return 'w-[92%] max-w-[380px] aspect-[1.3/1] rounded-2xl';
      case 'BARCODE':
        return 'w-[84%] max-w-[340px] h-[160px] rounded-2xl';
      case 'ID CARD':
      default:
        return 'w-[88%] max-w-[360px] aspect-[1.586/1] rounded-2xl';
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex flex-col bg-[#0b0f17] text-white select-none overflow-hidden font-sans"
      style={{ touchAction: 'none' }}
    >
      {/* Hidden file input for gallery picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* ─── Live Video Stream Background (Full Screen) ─── */}
      {isLiveCameraActive && !capturedImage && (
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted
          // @ts-ignore
          webkit-playsinline="true"
          onLoadedMetadata={(e) => {
            (e.target as HTMLVideoElement).play().catch(() => {});
          }}
          onClick={(e) => {
            (e.target as HTMLVideoElement).play().catch(() => {});
          }}
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            filter: filterMode === 'enhanced'
              ? 'contrast(1.25) brightness(1.05) saturate(1.05)'
              : filterMode === 'bw'
                ? 'grayscale(1) contrast(1.35) brightness(1.05)'
                : 'none',
          }}
        />
      )}

      {/* ─── Captured Image Preview Background (Full Screen) ─── */}
      {displayImage && !showCropper && (
        <img
          src={displayImage}
          alt={activeMode === 'PHOTO' ? 'Captured profile photo' : 'Captured document'}
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{
            transform: (facingMode === 'user' && !croppedImage) ? 'scaleX(-1)' : 'none',
            filter: filterMode === 'enhanced'
              ? 'contrast(1.25) brightness(1.05) saturate(1.05)'
              : filterMode === 'bw'
                ? 'grayscale(1) contrast(1.35) brightness(1.05)'
                : 'none',
          }}
        />
      )}

      {/* Shutter Flash Animation */}
      {shutterFlash && (
        <div className="absolute inset-0 bg-white z-[60] animate-out fade-out duration-200 pointer-events-none" />
      )}

      {/* Processing Loader Overlay */}
      {(isProcessing || isLoading) && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0b0f17]/90 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <p className="mt-4 text-sm font-semibold tracking-wide text-white">{processingMessage}</p>
        </div>
      )}

      {/* ─── Top Navigation & Action Bar (Safe Area Protected below Status Bar) ─── */}
      <div
        className="relative z-30 flex items-center justify-between px-5 pb-3 bg-gradient-to-b from-[#0b0f17]/95 via-[#0b0f17]/75 to-transparent"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 0.75rem), 3.5rem)',
        }}
      >
        {/* Back / Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:text-white bg-white/10 hover:bg-white/20 active:scale-95 transition-all shadow-md backdrop-blur-md border border-white/10"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Action Controls Group: Flash, Grid, Flip Camera, Settings / Filter */}
        <div className="flex items-center gap-3.5 sm:gap-5">
          {/* Flash / Torch Toggle */}
          <button
            type="button"
            onClick={handleToggleFlash}
            disabled={!hasFlashSupport}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md backdrop-blur-md ${
              isFlashOn
                ? 'text-amber-400 bg-amber-400/25 ring-1 ring-amber-400 border border-amber-400/40'
                : hasFlashSupport
                  ? 'text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10'
                  : 'text-white/30 bg-white/5 border border-white/5 cursor-not-allowed'
            }`}
            title={hasFlashSupport ? (isFlashOn ? 'Turn Flash Off' : 'Turn Flash On') : 'Flash not available'}
          >
            <Zap className={`w-4 h-4 ${isFlashOn ? 'fill-amber-400' : ''}`} />
          </button>

          {/* Grid Toggle */}
          <button
            type="button"
            onClick={handleToggleGrid}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md backdrop-blur-md ${
              isGridOn
                ? 'text-blue-400 bg-blue-500/25 ring-1 ring-blue-400 border border-blue-400/40'
                : 'text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10'
            }`}
            title="Toggle Alignment Grid"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>

          {/* Flip / Switch Camera */}
          <button
            type="button"
            onClick={handleFlipCamera}
            disabled={isSwitchingCamera || isProcessing}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:text-white bg-white/10 hover:bg-white/20 active:scale-95 transition-all shadow-md backdrop-blur-md border border-white/10 disabled:opacity-50"
            title={`Switch to ${facingMode === 'environment' ? 'Front (Selfie)' : 'Back (Rear)'} Camera`}
          >
            <SwitchCamera className={`w-4 h-4 ${isSwitchingCamera ? 'animate-spin' : ''}`} />
          </button>

          {/* Filter / Scanner Tuning */}
          <button
            type="button"
            onClick={handleCycleFilter}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md backdrop-blur-md ${
              filterMode !== 'natural'
                ? 'text-emerald-400 bg-emerald-500/25 ring-1 ring-emerald-400 border border-emerald-400/40'
                : 'text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10'
            }`}
            title={`Filter Mode: ${filterMode.toUpperCase()}`}
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Status Pill for Filter Mode / Camera Flip */}
      {filterToast && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-xs font-semibold tracking-wide text-white shadow-xl animate-in fade-in zoom-in-95 duration-150 pointer-events-none whitespace-nowrap">
          {filterToast}
        </div>
      )}

      {/* ─── Guidance Text Banner (Matching Attached Mockup) ─── */}
      <div className="relative z-20 px-6 py-2 text-center pointer-events-none">
        <p className="text-xs sm:text-sm font-medium text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] max-w-sm mx-auto leading-relaxed">
          {activeMode === 'PHOTO' || captureGuidance === 'profile'
            ? 'Position your face inside the circle. Make sure your face is clearly visible with good lighting.'
            : activeMode === 'BARCODE'
              ? 'Align the barcode or QR code inside the frame to scan.'
              : activeMode === 'BOOK'
                ? 'Position both pages within the frame. Ensure the book lies flat.'
                : 'Position your document inside the frame. Make sure the document is correct and clear enough.'}
        </p>
      </div>

      {/* ─── Center Viewfinder Area (No overflow-hidden to allow dimming shadow to cover screen) ─── */}
      <div className="relative flex-1 flex items-center justify-center">
        {/* Fallback Screen (if video stream not available or user uploaded from gallery) */}
        {showFallbackUI && !capturedImage && (
          <div className="relative z-10 flex flex-col items-center px-6 text-center max-w-xs animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4 ring-1 ring-blue-500/30">
              <CameraIcon className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Camera Scanner</h3>
            <p className="text-xs text-white/60 mb-6 leading-relaxed">
              Capture or upload your document to auto-extract text and verify details.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={() => startLiveCamera(facingMode)}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm text-white shadow-lg shadow-blue-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CameraIcon className="w-4 h-4" /> Start Camera
              </button>
              <button
                type="button"
                onClick={triggerFileInput}
                className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 font-semibold text-sm text-white active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <ImageIcon className="w-4 h-4" /> Choose from Gallery
              </button>
            </div>
          </div>
        )}

        {/* Live Framing Box with 4 Thick Corner Brackets (Exact Visual from Image) */}
        {!showCropper && (
          <div
            className={`relative z-10 pointer-events-none transition-all duration-500 flex items-center justify-center ${getViewfinderStyle()} ${autoCaptureProgress > 0 && activeMode === 'PHOTO' ? 'scale-[1.02]' : 'scale-100'}`}
            style={{
              boxShadow: activeMode === 'PHOTO' ? '0 0 0 9999px rgba(0, 0, 0, 0.85)' : '0 0 0 9999px rgba(11, 15, 23, 0.68)',
            }}
          >
            {/* Continuous Blue Border and Scanning Line (Matches Image 1) */}
            {activeMode !== 'PHOTO' && (
              <>
                {/* Solid Blue Box Outline with Auto-Capture Progress Fill */}
                <div className="absolute inset-0 border-[3px] border-blue-500 rounded-[14px] shadow-[0_0_12px_rgba(59,130,246,0.3)] pointer-events-none overflow-hidden">
                  {isLiveCameraActive && !capturedImage && autoCaptureProgress > 0 && (
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-blue-500/20 transition-all duration-75"
                      style={{ height: `${autoCaptureProgress}%` }}
                    />
                  )}
                </div>
                
                {/* Animated Scanning Line */}
                <div className="absolute left-[-4%] right-[-4%] h-[2.5px] bg-blue-400 shadow-[0_0_16px_5px_rgba(96,165,250,0.5)] z-20 animate-scan-line rounded-full" />
              </>
            )}

            {/* Profile Circle Frame (Apple Face ID Style) */}
            {activeMode === 'PHOTO' && (
              <>
                <div className={`absolute inset-0 rounded-full transition-all duration-300 ${autoCaptureProgress > 0 ? 'border-transparent' : 'border-[3px] border-white/80'}`}>
                  {/* Segmented SVG Circular Progress Ring */}
                  {isLiveCameraActive && !capturedImage && autoCaptureProgress > 0 && (
                    <svg className="absolute inset-0 w-full h-full -rotate-90 scale-[1.05] pointer-events-none" viewBox="0 0 100 100">
                      <defs>
                        <mask id="segmented-mask">
                           {/* 60 segments (301.59 circumference / 5 = 60.3), so dasharray 3 2 is perfect */}
                           <circle cx="50" cy="50" r="48" fill="none" stroke="white" strokeWidth="10" strokeDasharray="3.15 1.87" />
                        </mask>
                      </defs>
                      {/* Inactive Background Ticks */}
                      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3.5" mask="url(#segmented-mask)" />
                      {/* Active Glowing Green Ticks */}
                      <circle 
                        cx="50" cy="50" r="48" fill="none" stroke="#4ade80" strokeWidth="4.5" 
                        strokeDasharray={2 * Math.PI * 48}
                        strokeDashoffset={(2 * Math.PI * 48) * (1 - autoCaptureProgress / 100)}
                        strokeLinecap="round"
                        mask="url(#segmented-mask)"
                        className="transition-all duration-75 ease-linear drop-shadow-[0_0_6px_rgba(74,222,128,0.8)]"
                      />
                    </svg>
                  )}
                </div>
              </>
            )}

            {/* 3x3 Alignment Grid (when toggled ON) */}
            {isGridOn && (
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none rounded-xl overflow-hidden opacity-60">
                <div className="border-r border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-b border-white/30" />
                <div className="border-r border-white/30" />
                <div className="border-r border-white/30" />
                <div />
              </div>
            )}

          </div>
        )}

        {/* Cropper View */}
        {showCropper && capturedImage && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#0b0f17]">
            <style>{`
              .ReactCrop {
                --rc-drag-handle-size: 22px;
                --rc-drag-handle-mobile-size: 26px;
                --rc-drag-bar-size: 14px;
                touch-action: none !important;
                user-select: none !important;
              }
              .ReactCrop__crop-selection {
                border: 2.5px solid #3b82f6 !important;
                box-shadow: 0 0 0 9999px rgba(11, 15, 23, 0.75) !important;
                background-color: rgba(59, 130, 246, 0.08) !important;
                cursor: move !important;
              }
              .ReactCrop__drag-handle {
                width: 22px !important;
                height: 22px !important;
                background-color: #3b82f6 !important;
                border: 2.5px solid #ffffff !important;
                border-radius: 50% !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.8) !important;
              }
            `}</style>
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => {
                setActivePreset(null);
                setCrop(percentCrop);
              }}
              onComplete={(_, percentCrop) => setCrop(percentCrop)}
              aspect={aspect}
              circularCrop={activeMode === 'PHOTO'}
              className="max-h-full max-w-full"
            >
              <img
                ref={imgRef}
                src={capturedImage}
                alt="Target to crop"
                style={{
                  maxHeight: 'calc(100vh - 220px)',
                  maxWidth: 'calc(100vw - 24px)',
                  objectFit: 'contain',
                }}
                onLoad={() => {
                  const initial = activeMode === 'PHOTO'
                    ? { unit: '%' as const, x: 20, y: 15, width: 60, height: 60 }
                    : { unit: '%' as const, x: 3.5, y: 56.5, width: 93, height: 39 };
                  setCrop(initial);
                }}
              />
            </ReactCrop>
          </div>
        )}
      </div>

      {/* Error Notice */}
      {error && (
        <div className="relative z-30 px-4 py-2 bg-red-900/60 border-t border-red-500/30 text-center">
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}

      {/* ─── Mode Selector Tabs (Matching Attached Mockup with Safe Scrolling) ─── */}
      {!showCropper && !capturedImage && (
        <div className="relative z-30 w-full flex items-center justify-start sm:justify-center gap-2 overflow-x-auto no-scrollbar py-2.5 px-5 bg-gradient-to-t from-[#0b0f17] to-transparent">
          {SCANNER_MODES.map((mode) => {
            const isSelected = activeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase transition-all select-none whitespace-nowrap ${
                  isSelected
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105 ring-1 ring-emerald-400'
                    : 'bg-black/50 text-white/75 hover:text-white border border-white/10 hover:border-white/25 active:scale-95'
                }`}
              >
                {mode}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Bottom Controls Bar (Matching Attached Mockup with Safe Area) ─── */}
      <div
        className="relative z-30 flex items-center justify-between px-8 py-5 bg-[#0b0f17] border-t border-white/5"
        style={{
          paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 1.25rem), 1.75rem)',
        }}
      >
        {/* State A: Cropper Active */}
        {showCropper ? (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={handleCancelCrop}
              className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!capturedImage) return;
                try {
                  const res = await rotateImage(capturedImage, 90, 'rotated.jpg');
                  setCapturedImage(res.dataUrl);
                } catch (e) {
                  console.warn('Cropper rotate error:', e);
                }
              }}
              className="px-4 py-2.5 rounded-full bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-white font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              title="Rotate 90° Clockwise"
            >
              <RotateCw className="w-4 h-4 text-indigo-300" /> Rotate
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/30 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" /> Apply Crop
            </button>
          </div>
        ) : capturedImage ? (
          /* State B: Photo Captured (Review & Confirm) */
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={handleRetake}
              className="flex flex-col items-center gap-1 text-white/80 hover:text-white"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-all">
                <RotateCcw className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-white/60">Retake</span>
            </button>

            <button
              type="button"
              onClick={handleRotate}
              className="flex flex-col items-center gap-1 text-indigo-400 hover:text-indigo-300 active:scale-95 transition-all cursor-pointer"
              title="Rotate 90° Clockwise"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center hover:bg-indigo-500/25 transition-all">
                <RotateCw className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-indigo-400">Rotate</span>
            </button>

            <button
              type="button"
              onClick={handleShowCropper}
              className="flex flex-col items-center gap-1 text-blue-400 hover:text-blue-300"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/15 border border-blue-500/40 flex items-center justify-center hover:bg-blue-500/25 transition-all">
                <CropIcon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-blue-400">Crop</span>
            </button>

            <button
              type="button"
              onClick={handleUsePhoto}
              className="flex flex-col items-center gap-1 text-white"
            >
              <div className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-600/40 flex items-center justify-center active:scale-95 transition-all">
                <Check className="w-7 h-7 text-white" />
              </div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-white">Use Photo</span>
            </button>
          </div>
        ) : (
          /* State C: Live Camera Scanner (Matching Attached Mockup) */
          <>
            {/* Left: Thumbnail Gallery / Choose File */}
            <button
              type="button"
              onClick={triggerFileInput}
              className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 flex items-center justify-center text-white active:scale-95 transition-all"
              title="Upload from Gallery"
            >
              <ImageIcon className="w-6 h-6 text-white/90" />
            </button>

            {/* Center: Large Circular Shutter Button (White Ring, Blue Center, Camera Icon) */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={handleSnapPhoto}
                disabled={!isLiveCameraActive}
                className="w-18 h-18 rounded-full border-4 border-white p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] disabled:opacity-50"
                title="Capture Photo"
              >
                <div className="w-full h-full rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center shadow-inner">
                  <CameraIcon className="w-7 h-7 text-white" />
                </div>
              </button>
            </div>

            {/* Right: Quick Confirm / Upload Direct Checkmark */}
            <button
              type="button"
              onClick={triggerFileInput}
              className="w-11 h-11 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-md hover:bg-white/90 active:scale-95 transition-all"
              title="Confirm or Pick"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default CameraCaptureModal;
