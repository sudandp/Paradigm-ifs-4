import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RefreshCw, Loader2, CheckCircle2, XCircle, Hash, Shield, Zap, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Camera as CapCamera, PermissionStatus } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import { registerGateUser, uploadGatePhoto, getGateUserByUserId, fetchGateUsers } from '../../services/gateApi';
import type { GateUser } from '../../types/gate';
import { euclideanDistance, getEAR, getHeadYaw, FACE_THRESHOLDS, FACE_TIMING, findDuplicateFace, isValidDescriptor, checkCaptureQuality, checkSingleFace } from '../../utils/faceUtils';
import { playFeedbackSound } from '../../utils/audioFeedback';
import Button from '../ui/Button';

// Thresholds from shared utility
const BLINK_EAR_THRESHOLD = FACE_THRESHOLDS.BLINK_EAR_THRESHOLD;
const FACE_MATCH_THRESHOLD = FACE_THRESHOLDS.EMPLOYEE_MATCH;
const RELAXED_MATCH_THRESHOLD = FACE_THRESHOLDS.RELAXED_MATCH;

interface PersonalFaceAuthProps {
  userId: string;
  onVerified: () => void;
  onCancel: () => void;
  onFallback?: () => void;
  actionLabel?: string;
  isReEnroll?: boolean;
  /** If true, enrollment is the primary goal — onVerified fires immediately after capture+save, no re-verify step */
  enrollAndVerify?: boolean;
}

const PersonalFaceAuth: React.FC<PersonalFaceAuthProps> = ({
  userId,
  onVerified,
  onCancel,
  onFallback,
  actionLabel = 'Punch In',
  isReEnroll = false,
  enrollAndVerify = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionLoopRef = useRef<number | null>(null);
  const successTriggeredRef = useRef(false);
  const rejectionCountRef = useRef(0);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const autoCapturingRef = useRef(false);
  const autoRegisteringRef = useRef(false);

  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const addDebug = useCallback((msg: string) => {
    console.log('%c[FaceDebug]', 'color: #f59e0b; font-weight: bold;', msg);
    setDebugLogs(prev => [...prev.slice(-3), msg]);
  }, []);

  const [debugDistance, setDebugDistance] = useState<number | null>(null);
  const [debugThreshold, setDebugThreshold] = useState<number | null>(null);
  const [debugEar, setDebugEar] = useState<number | null>(null);

  const [gateUser, setGateUser] = useState<GateUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'checking' | 'register' | 'verify' | 'success' | 'fail'>('checking');
  
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchConfidence, setMatchConfidence] = useState<number | null>(null);
  const [faceRejected, setFaceRejected] = useState(false);
  const faceRejectedTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Liveness State
  const [isLivenessPassed, setIsLivenessPassed] = useState(false);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const lastEarRef = useRef<number>(0.3);
  // Refs to avoid stale closures in the requestAnimationFrame detection loop
  const isLivenessPassedRef = useRef(false);
  const blinkDetectedRef = useRef(false);
  const modeRef = useRef<string>('checking');
  const gateUserRef = useRef<GateUser | null>(null);
  const livenessPassedStartTimeRef = useRef<number | null>(null);
  const faceDetectedStartTimeRef = useRef<number | null>(null);
  
  // Challenge State
  const [currentChallenge, setCurrentChallenge] = useState<'BLINK' | 'LOOK_LEFT' | 'LOOK_RIGHT'>('BLINK');
  const [challengeStep, setChallengeStep] = useState<1 | 2>(1); // 1: Blink, 2: Head Turn
  const challengeRef = useRef<'BLINK' | 'LOOK_LEFT' | 'LOOK_RIGHT'>('BLINK');
  const challengeStepRef = useRef<1 | 2>(1);
  const [yawScore, setYawScore] = useState<number>(0);

  // For Registration
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [computedDescriptor, setComputedDescriptor] = useState<number[] | null>(null);

    const [scanSeconds, setScanSeconds] = useState(0);
    const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
    // Tick counter to force re-evaluation of time-based auto-capture conditions
    const [autoCaptureTick, setAutoCaptureTick] = useState(0);

    // Keep refs in sync with state for the detection loop
  useEffect(() => { isLivenessPassedRef.current = isLivenessPassed; }, [isLivenessPassed]);
  useEffect(() => { blinkDetectedRef.current = blinkDetected; }, [blinkDetected]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { gateUserRef.current = gateUser; }, [gateUser]);
  useEffect(() => { challengeRef.current = currentChallenge; }, [currentChallenge]);
  useEffect(() => { challengeStepRef.current = challengeStep; }, [challengeStep]);

  // ─── Browser Console State Monitor ───
  useEffect(() => {
    if (!loading) {
      console.log(
        `%c[FaceState] %cMODE: ${mode} | CAM: ${cameraActive ? 'ON' : 'OFF'} | FACE: ${isFaceDetected ? 'YES' : 'NO'} | LIVENESS: ${isLivenessPassed ? 'YES' : 'NO'}`,
        'color: #6366f1; font-weight: bold;',
        'color: #818cf8;'
      );
    }
  }, [mode, cameraActive, isFaceDetected, isLivenessPassed, loading]);

  // ─── Clean reset helper for registration phase ───────────────────
  const resetForRegistration = useCallback(() => {
    console.log('FaceAuth: Resetting all state for fresh registration capture.');
    setIsFaceDetected(false);
    setIsProcessing(false);
    setMatchConfidence(null);
    setIsLivenessPassed(false);
    isLivenessPassedRef.current = false;
    setBlinkDetected(false);
    blinkDetectedRef.current = false;
    setCapturedPhoto(null);
    setComputedDescriptor(null);
    setError(null);
    setStatusMessage(null);
    successTriggeredRef.current = false;
    autoCapturingRef.current = false;
    autoRegisteringRef.current = false;
    faceDetectedStartTimeRef.current = null;
    livenessPassedStartTimeRef.current = null;
    lastEarRef.current = 0.3;
    setAutoCaptureTick(0);
    setCurrentChallenge('BLINK');
    setChallengeStep(1);
    challengeRef.current = 'BLINK';
    challengeStepRef.current = 1;
    setYawScore(0);
  }, []);

  // ─── Initialize ──────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        addDebug('INIT: Starting...');
        const user = await getGateUserByUserId(userId);
        setGateUser(user);
        addDebug(`INIT: GateUser found=${!!user}, hasDescriptor=${!!user?.faceDescriptor}`);
        
        // Load face-api models
        console.log('FaceAuth: Initializing models. Platform:', Capacitor.getPlatform());
        addDebug(`INIT: Loading models... Platform=${Capacitor.getPlatform()}`);
        const faceapi = await import('@vladmandic/face-api');
        
        // Robust model path resolution
        const getModelUrl = () => {
          // If native, use the localhost origin (handles both iOS capacitor:// and Android https://)
          if (Capacitor.isNativePlatform()) {
            return window.location.origin + '/models';
          }
          // For PWA/Web, try relative path first as it's most portable
          return '/models';
        };

        const MODEL_URL = getModelUrl();
        
        try {
          console.log('FaceAuth: Loading models from:', MODEL_URL);
          // Try loading all at once
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
          ]);
          console.log('FaceAuth: Models loaded successfully');
          addDebug('INIT: Models loaded ✅');
        } catch (loadErr) {
          console.error('FaceAuth: Primary model load failed, trying absolute fallback...', loadErr);
          // Fallback to absolute origin path if relative failed
          const fallbackUrl = window.location.origin + '/models';
          await faceapi.nets.tinyFaceDetector.loadFromUri(fallbackUrl);
          await faceapi.nets.faceLandmark68TinyNet.loadFromUri(fallbackUrl);
          await faceapi.nets.faceRecognitionNet.loadFromUri(fallbackUrl);
        }
        setModelsLoaded(true);
        
        if (isReEnroll) {
          addDebug('INIT: Re-enrollment mode → register');
          console.log('FaceAuth: Re-enrollment mode — skipping verification, going straight to registration.');
          // Reset ALL state for a clean registration start
          resetForRegistration();
          setMode('register');
        } else if (!user || !user.faceDescriptor) {
          addDebug('INIT: No face data → first-time enrollment');
          // First-time enrollment: no existing face, go straight to register
          resetForRegistration();
          setMode('register');
        } else {
          addDebug('INIT: Has face data → verify');
          setMode('verify');
        }
      } catch (err: any) {
        console.error('FaceAuth Init Error:', err);
        setError(`Initialization Failed: ${err?.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userId]);

    // Manage scan timer
    useEffect(() => {
        if (isFaceDetected && (mode === 'verify' || mode === 'register') && !isProcessing) {
            if (!scanTimerRef.current) {
                const start = Date.now();
                scanTimerRef.current = setInterval(() => {
                    setScanSeconds(Math.floor((Date.now() - start) / 1000));
                }, 1000);
            }
        } else {
            if (scanTimerRef.current) {
                clearInterval(scanTimerRef.current);
                scanTimerRef.current = null;
            }
            setScanSeconds(0);
        }
        return () => {
            if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        };
    }, [isFaceDetected, mode, isProcessing]);

    // ─── Camera Start / Stop ──────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      // ─── Force-stop any existing stream before starting new one ───
      if (streamRef.current) {
        console.log('FaceAuth: Stopping existing stream before restart.');
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // ─── Native Permission Pre-flight ───
      if (Capacitor.isNativePlatform()) {
        const status = await CapCamera.checkPermissions();
        if (status.camera !== 'granted') {
          const requestStatus = await CapCamera.requestPermissions({ permissions: ['camera'] });
          if (requestStatus.camera !== 'granted') {
            setError('Camera permission is required for face authentication. Please enable it in settings.');
            return;
          }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          // Add frameRate for mobile performance stability
          frameRate: { ideal: 20, max: 30 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to have enough data before marking camera as active
        await new Promise<void>((resolve) => {
          const video = videoRef.current!;
          if (video.readyState >= 4) {
            resolve();
            return;
          }
          const onReady = () => {
            video.removeEventListener('loadeddata', onReady);
            resolve();
          };
          video.addEventListener('loadeddata', onReady);
          // Fallback timeout in case event never fires
          setTimeout(resolve, 3000);
        });
        
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play failed, retrying...', playErr);
          await new Promise(r => setTimeout(r, 200));
          await videoRef.current?.play();
        }
      }
      setCameraActive(true);
      addDebug(`CAMERA: Started ✅ readyState=${videoRef.current?.readyState}`);
    } catch (err: any) {
      console.error('Camera failed:', err);
      let msg = 'Failed to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') 
        msg = 'Camera access denied. Please check your device permissions.';
      else if (err.name === 'NotFoundError') 
        msg = 'No camera device found.';
      else if (err.name === 'NotReadableError') 
        msg = 'Camera is already in use or restricted.';
      setError(msg);
      addDebug(`CAMERA: FAILED ❌ ${msg}`);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
    setCameraActive(false);
    setIsFaceDetected(false);
    // ─── Reset detection timers to prevent immediate re-firing on restart ───
    faceDetectedStartTimeRef.current = null;
    livenessPassedStartTimeRef.current = null;
  }, []);

  useEffect(() => {
    const shouldCameraBeActive = mode === 'verify' || (mode === 'register' && !capturedPhoto);
    
    if (shouldCameraBeActive) {
      // Small delay to allow previous stream cleanup (critical for re-enrollment transitions)
      const timer = setTimeout(() => {
        startCamera();
      }, cameraActive ? 0 : 200);
      return () => { clearTimeout(timer); stopCamera(); };
    }
    
    // Camera should NOT be active in this mode
    stopCamera();
    return () => stopCamera();
  }, [mode, capturedPhoto, startCamera, stopCamera]);

  const handleSuccess = useCallback(() => {
    if (successTriggeredRef.current) return; // Prevent multiple calls
    successTriggeredRef.current = true;
    playFeedbackSound('success');
    
    // Immediately update refs so the detection loop stops synchronously
    modeRef.current = isReEnroll ? 'register' : 'success';
    
    // Stop the detection loop
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
    stopCamera();
    
    if (isReEnroll) {
      console.log('FaceAuth: Match successful, transitioning to Registration mode.');
      // Full clean reset before entering register mode (the useEffect will restart the camera)
      resetForRegistration();
      setMode('register');
      return;
    }
    addDebug(`✅ SUCCESS: Face matched & Liveness passed for [${actionLabel}]`);
    setMode('success');
    setIsProcessing(false);
    
    addDebug(`FLOW: Snapping to closure in 800ms...`);
    setTimeout(() => {
      addDebug(`FLOW: 🚀 Executing onVerified() now.`);
      try {
        onVerified();
      } catch (e: any) {
        console.error('onVerified failed', e);
        addDebug(`❌ ERROR: ${e.message}`);
        setMode('success');
      }
    }, 800); 
  }, [isReEnroll, onVerified, resetForRegistration, stopCamera, actionLabel, addDebug]);

  // ─── Live Detection ──────────────────────────────────────────────
  const runDetection = useCallback(async () => {
    if (!cameraActive || !videoRef.current || !modelsLoaded || isProcessing) return;

    try {
      const faceapi = await import('@vladmandic/face-api');
      const video = videoRef.current;
      
      if (!video || video.readyState < 4) {
        detectionLoopRef.current = requestAnimationFrame(runDetection);
        return;
      }

      const detection = await faceapi.detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.3 })
      ).withFaceLandmarks(true).withFaceDescriptor();

      if (detection) {
        setIsFaceDetected(true);
        if (!faceDetectedStartTimeRef.current) faceDetectedStartTimeRef.current = Date.now();
        
        // ─── Liveness Check (Blink Detection) ───
        const landmarks = detection.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2;
        setDebugEar(ear);

        // Detect a drop in EAR (eyes closing)
        if (ear < BLINK_EAR_THRESHOLD && lastEarRef.current >= BLINK_EAR_THRESHOLD) {
           setBlinkDetected(true);
           blinkDetectedRef.current = true;
        }
        
        // Detect eyes opening again after a blink to confirm liveness
        lastEarRef.current = ear;
        
        // ─── Liveness Check Stage 2 (Head Rotation) ───
        const yaw = getHeadYaw(landmarks);
        setYawScore(yaw);

        if (challengeStepRef.current === 1 && blinkDetectedRef.current && ear > BLINK_EAR_THRESHOLD + 0.05) {
            // Blink passed! Move to next challenge
            const nextChallenge = Math.random() > 0.5 ? 'LOOK_LEFT' : 'LOOK_RIGHT';
            setCurrentChallenge(nextChallenge);
            setChallengeStep(2);
            addDebug(`LIVENESS: Blink passed! Challenge: ${nextChallenge}`);
        }

        if (challengeStepRef.current === 2) {
            const currentC = challengeRef.current;
            if (currentC === 'LOOK_LEFT' && yaw < -FACE_THRESHOLDS.HEAD_YAW_THRESHOLD) {
                setIsLivenessPassed(true);
                isLivenessPassedRef.current = true;
                addDebug('LIVENESS: Look Left passed!');
            } else if (currentC === 'LOOK_RIGHT' && yaw > FACE_THRESHOLDS.HEAD_YAW_THRESHOLD) {
                setIsLivenessPassed(true);
                isLivenessPassedRef.current = true;
                addDebug('LIVENESS: Look Right passed!');
            }
        }

        // ─── Face Matching — IDENTITY MUST ALWAYS PASS ───────────────────
        // SECURITY: The distance check is NEVER bypassed, regardless of liveness time.
        // A wrong face will always be rejected even if they stand there for hours.
        const currentUser = gateUserRef.current;
        if (modeRef.current === 'verify' && currentUser?.faceDescriptor) {
          const currentDescriptor = Array.from(detection.descriptor);
          const storedDescriptor = currentUser.faceDescriptor;
          
          const distance = euclideanDistance(currentDescriptor, storedDescriptor);
          
          // Track how long liveness has been confirmed
          if (isLivenessPassedRef.current && !livenessPassedStartTimeRef.current) {
            livenessPassedStartTimeRef.current = Date.now();
          }

          // After 500ms of liveness, use a slightly relaxed threshold to handle
          // minor lighting/angle changes — but still requires same person's face.
          const hasTimeElapsed = livenessPassedStartTimeRef.current && 
            (Date.now() - livenessPassedStartTimeRef.current > 500);
          const threshold = hasTimeElapsed ? RELAXED_MATCH_THRESHOLD : FACE_MATCH_THRESHOLD;

          setDebugDistance(distance);
          setDebugThreshold(threshold);

          // Deep debug if distance is highly suspicious (e.g. 0.000)
          if (distance < 0.01) {
            console.error('[FaceDebug] SUSPICIOUS MATCH! Distance is', distance);
            console.error('[FaceDebug] Current Descriptor (first 5):', currentDescriptor.slice(0, 5));
            console.error('[FaceDebug] Stored Descriptor (first 5):', storedDescriptor.slice(0, 5));
            console.error('[FaceDebug] Are they the exact same object reference?', currentDescriptor === storedDescriptor);
          }

          // ─── Verdict ──────────────────────────────────────────────────
          // ALWAYS require distance < threshold (identity gate — no exceptions)
          if (distance < threshold) {
            rejectionCountRef.current = 0; // Reset on match
            setMatchConfidence(1 - distance);

            // Allow punch ONLY if liveness is confirmed (No bypassing)
            if (isLivenessPassedRef.current) {
              const reason = hasTimeElapsed ? `(Relaxed threshold: ${threshold.toFixed(2)})` : '';
              addDebug(`✅ IDENTITY MATCH: ${reason} Dist=${distance.toFixed(3)} Threshold=${threshold.toFixed(2)}`);
              
              console.log(JSON.stringify({
                employeeId: userId,
                similarityScore: (1 - distance).toFixed(4),
                matchedDescriptor: !!currentUser.faceDescriptor,
                authSource: 'camera',
                success: true,
                timestamp: new Date().toISOString(),
                reason: reason || 'Match successful',
              }));
              
              handleSuccess();
            }
          } else {
            // Face detected but doesn't match enrolled user — show rejection cue
            rejectionCountRef.current += 1;
            setMatchConfidence(null);
            setFaceRejected(true);
            
            // If the face is consistently unauthorized for ~1.5 seconds (40 frames)
            if (rejectionCountRef.current > 40) {
              addDebug(`❌ CANCELLING: Unauthorized face detected continuously.`);
              setError("Unauthorized Face. This face does not match the enrolled user.");
              setIsProcessing(true); // Pause detection loop
              stopCamera();
              setTimeout(() => {
                onCancel();
              }, 3000);
              return;
            }

            // Clear rejection indicator after 1.5s
            if (faceRejectedTimerRef.current) clearTimeout(faceRejectedTimerRef.current);
            faceRejectedTimerRef.current = setTimeout(() => setFaceRejected(false), 1500);
            addDebug(`❌ FACE REJECTED: Dist=${distance.toFixed(3)} > Threshold=${threshold.toFixed(2)} — wrong person`);
            
            // Limit log spam by only logging once per rejection burst
            if (!faceRejected) {
              console.log(JSON.stringify({
                employeeId: userId,
                similarityScore: (1 - distance).toFixed(4),
                matchedDescriptor: !!currentUser.faceDescriptor,
                authSource: 'camera',
                success: false,
                timestamp: new Date().toISOString(),
                reason: 'Distance exceeded matching threshold (wrong person)',
              }));
            }
          }
        }
      } else {
        setIsFaceDetected(false);
        faceDetectedStartTimeRef.current = null;
      }
    } catch (err) {
      // Ignore frame errors
    }

    if (cameraActive && modeRef.current !== 'success' && !successTriggeredRef.current) {
      detectionLoopRef.current = requestAnimationFrame(runDetection);
    }
  }, [cameraActive, modelsLoaded, isProcessing, gateUser, handleSuccess]);

  useEffect(() => {
    if (cameraActive && modelsLoaded) {
      detectionLoopRef.current = requestAnimationFrame(runDetection);
    }
    return () => {
      if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
    };
  }, [cameraActive, modelsLoaded, runDetection]);



  // ─── Registration Logic ──────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !modelsLoaded) {
      addDebug(`CAPTURE: Skipped — video=${!!videoRef.current} models=${modelsLoaded}`);
      return;
    }
    addDebug(`CAPTURE: Starting... readyState=${videoRef.current.readyState}`);
    setIsProcessing(true);
    setError(null);
    try {
      const faceapi = await import('@vladmandic/face-api');
      const video = videoRef.current;

      // @vladmandic/face-api requires readyState >= 4 (HAVE_ENOUGH_DATA)
      if (!video || video.readyState < 4) {
        addDebug(`CAPTURE: Video not ready, readyState=${video?.readyState}, waiting 500ms...`);
        await new Promise(r => setTimeout(r, 500));
        if (!videoRef.current || videoRef.current.readyState < 4) {
          addDebug(`CAPTURE: Still not ready after wait, ABORT`);
          setIsProcessing(false);
          return;
        }
      }
      
      const readyVideo = videoRef.current!;
      addDebug(`CAPTURE: Video ready ✅ ${readyVideo.videoWidth}x${readyVideo.videoHeight}`);

      // ─── Multi-Face Guard ───
      addDebug('CAPTURE: Detecting faces...');
      const allDetections = await faceapi.detectAllFaces(
        readyVideo,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 })
      );
      
      const faceCheck = checkSingleFace(allDetections.length);
      addDebug(`CAPTURE: Faces found=${allDetections.length}, ok=${faceCheck.ok}`);
      if (!faceCheck.ok) {
        setError(faceCheck.message || 'Face detection issue.');
        setIsProcessing(false);
        return;
      }

      // ─── High-quality single detection with landmarks + descriptor ───
      const detection = await faceapi.detectSingleFace(
        readyVideo,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 })
      ).withFaceLandmarks(true).withFaceDescriptor();

      if (!detection) {
        addDebug('CAPTURE: No face in high-quality scan ❌');
        setError('No face detected. Please try again.');
        setIsProcessing(false);
        return;
      }

      // ─── Image Quality Validation ───
      const quality = checkCaptureQuality(detection, readyVideo.videoWidth, readyVideo.videoHeight);
      addDebug(`CAPTURE: Quality check ok=${quality.ok}`);
      if (!quality.ok) {
        // Show all quality issues joined together for better user guidance
        const detailedError = quality.issues.length > 0 
          ? `Quality Issue: ${quality.issues.join(' ')}` 
          : 'Image quality too low for enrollment. Please ensure good lighting and face the camera directly.';
        setError(detailedError);
        setIsProcessing(false);
        return;
      }

      const canvas = canvasRef.current!;
      canvas.width = readyVideo.videoWidth;
      canvas.height = readyVideo.videoHeight;
      canvas.getContext('2d')?.drawImage(readyVideo, 0, 0);
      
      setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8));
      setComputedDescriptor(Array.from(detection.descriptor));
      addDebug(`CAPTURE: SUCCESS ✅ descriptor length=${detection.descriptor.length}`);
    } catch (err: any) {
      console.error('Capture failed:', err);
      // If it's the media-not-loaded error, don't show a scary message — just retry silently
      if (err?.message?.includes('media has not finished loading')) {
        addDebug('CAPTURE: media-not-loaded error, will retry');
        setIsProcessing(false);
        return;
      }
      addDebug(`CAPTURE: FAILED ❌ ${err?.message}`);
      setError('Failed to capture face. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [modelsLoaded, stopCamera]);

  const handleRegister = useCallback(async () => {
    if (!capturedPhoto || !computedDescriptor) return;
    setIsProcessing(true);
    setStatusMessage('Checking for duplicates...');
    try {
      console.log('FaceAuth: Starting registration process...');
      addDebug('REGISTER: Starting duplicate check...');
      // ─── Duplicate Check ───
      const duplicateResult = await findDuplicateFace(computedDescriptor, userId);
      if (duplicateResult.found) {
        addDebug(`REGISTER: DUPLICATE FOUND ❌ ${duplicateResult.matchedUser?.userName}`);
        console.log('FaceAuth: Duplicate face detected!');
        playFeedbackSound('duplicate');
        
        const enrollDate = duplicateResult.matchedUser?.enrolledAt
          ? new Date(duplicateResult.matchedUser.enrolledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Unknown date';
        const enrollTime = duplicateResult.matchedUser?.enrolledAt
          ? new Date(duplicateResult.matchedUser.enrolledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          : '';
        
        // ─── CLEAN RESET FIRST ───
        resetForRegistration();
        
        // ─── THEN SET ERROR (so it isn't cleared by the reset) ───
        setError(
          `⚠️ DUPLICATE FOUND: This face is already linked to ${duplicateResult.matchedUser?.userName} ` +
          `${duplicateResult.matchedUser?.department ? `[${duplicateResult.matchedUser.department}]` : ''}. ` +
          `Registered on ${enrollDate}${enrollTime ? ` at ${enrollTime}` : ''}. ` +
          `A face can only be registered to one user for security.`
        );
        
        setIsProcessing(false);
        setStatusMessage(null);
        // The useEffect will handle camera restart because capturedPhoto is now null
        return;
      }

      addDebug('REGISTER: Uploading photo...');
      setStatusMessage('Uploading profile photo...');
      console.log('FaceAuth: Uploading photo...');
      const base64 = capturedPhoto.split(',')[1];
      const photoUrl = await uploadGatePhoto(base64, 'registration');
      
      addDebug('REGISTER: Saving to database...');
      setStatusMessage('Syncing with database...');
      console.log('FaceAuth: Saving gate user details...');
      const newUser = await registerGateUser({
        userId,
        faceDescriptor: computedDescriptor,
        photoUrl,
        department: 'Self Registered'
      });
      
      console.log('FaceAuth: Database record updated.');
      
      console.log(JSON.stringify({
                employeeId: userId,
                similarityScore: '1.0000',
                matchedDescriptor: true,
                authSource: 'camera',
                success: true,
                timestamp: new Date().toISOString(),
                reason: isReEnroll ? 'Re-enrollment successful' : 'First enrollment successful',
      }));

      setGateUser(newUser);
      gateUserRef.current = newUser;
      setStatusMessage(null);
      
      if (isReEnroll || enrollAndVerify) {
        // Re-enrollment OR first-time enrollment-then-verify: face saved, done!
        addDebug('REGISTER: Enrollment COMPLETE ✅✅✅');
        console.log('FaceAuth: Enrollment successful. Transitioning to success state.');
        playFeedbackSound('success');
        setMode('success');
        setTimeout(() => {
          addDebug(`FLOW: 🚀 Calling onVerified() now...`);
          try {
            onVerified();
          } catch (e: any) {
            console.error('onVerified callback failed', e);
            setMode('success');
          }
        }, 800);
      } else {
        // Standard first-time enrollment in punch flow:
        // Face saved. Update ref so verification loop can match immediately.
        // Go to verify mode — user blinks once and they're in.
        setMode('verify');
        setCapturedPhoto(null);
        setComputedDescriptor(null);
      }
    } catch (err) {
      console.error('FaceAuth Registration failed:', err);
      setError('Registration failed. Please check your connection and try again.');
      addDebug(`REGISTER: FAILED ❌ ${err}`);
      setStatusMessage(null);
    } finally {
      setIsProcessing(false);
    }
  }, [capturedPhoto, computedDescriptor, userId, isReEnroll, enrollAndVerify, onVerified, stopCamera, startCamera]);

  // ─── Auto-flow for Re-Enrollment (hands-free) ───────────────────
  // Tick interval: forces re-evaluation of time-based auto-capture every second
  useEffect(() => {
    if (!isReEnroll || mode !== 'register' || capturedPhoto || isProcessing || !isFaceDetected || !cameraActive) return;
    
    const interval = setInterval(() => {
      setAutoCaptureTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isReEnroll, mode, capturedPhoto, isProcessing, isFaceDetected, cameraActive]);

  // Auto-capture: when face detected + (liveness passed OR timeout fallback)
  useEffect(() => {
    if (!isReEnroll || mode !== 'register' || capturedPhoto || isProcessing || !isFaceDetected || !cameraActive) return;
    if (autoCapturingRef.current) return;
    
    const timeDetected = faceDetectedStartTimeRef.current ? (Date.now() - faceDetectedStartTimeRef.current) : 0;
    
    // Log every tick so we can see what's happening
    addDebug(`AUTO: tick=${autoCaptureTick} time=${Math.round(timeDetected/1000)}s liveness=${isLivenessPassed} readyState=${videoRef.current?.readyState ?? '?'}`);
    
    // Require minimum 1.0s of face detection (prevents premature fire from stale refs)
    if (timeDetected < 1000) return;

    // Auto-capture when: liveness passed OR face visible for 3+ seconds (fallback)
    const shouldCapture = isLivenessPassed || (timeDetected > FACE_TIMING.LIVENESS_FALLBACK_MS);
    
    if (!shouldCapture) {
      addDebug(`AUTO: Not yet (need ${Math.max(0, Math.round((FACE_TIMING.LIVENESS_FALLBACK_MS - timeDetected)/1000))}s more or blink)`);
      return;
    }

    // Final guard: verify video has enough data for @vladmandic/face-api
    if (!videoRef.current || videoRef.current.readyState < 4) {
      addDebug(`AUTO: Video not ready! readyState=${videoRef.current?.readyState}`);
      return;
    }

    addDebug('AUTO: \u2705 FIRING CAPTURE NOW!');
    autoCapturingRef.current = true;
    const timer = setTimeout(() => {
      handleCapture().finally(() => { autoCapturingRef.current = false; });
    }, 300);
    return () => { clearTimeout(timer); autoCapturingRef.current = false; };
  }, [isReEnroll, mode, capturedPhoto, isProcessing, isFaceDetected, isLivenessPassed, cameraActive, autoCaptureTick]);

  // Auto-register: when photo is captured in re-enroll mode
  useEffect(() => {
    if (!isReEnroll || mode !== 'register' || !capturedPhoto || !computedDescriptor || isProcessing) return;
    if (autoRegisteringRef.current) return;
    autoRegisteringRef.current = true;
    
    const timer = setTimeout(() => {
      handleRegister().finally(() => { autoRegisteringRef.current = false; });
    }, 800);
    return () => { clearTimeout(timer); autoRegisteringRef.current = false; };
  }, [isReEnroll, mode, capturedPhoto, computedDescriptor, isProcessing]);

  // ─── Renders ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#041b0f] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-emerald-100 font-bold uppercase tracking-widest text-sm">Initializing Biometrics...</p>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 transition-all duration-500 ${
      mode === 'success' ? 'bg-emerald-600' : (mode === 'verify' || mode === 'register' ? 'bg-white' : 'bg-[#041b0f]')
    }`}>
      {/* DEBUG OVERLAY */}
      <div className="absolute top-2 left-2 right-2 bg-black/80 text-green-400 p-2 text-[10px] font-mono z-[100] rounded overflow-hidden pointer-events-none" style={{ textShadow: '1px 1px 0 #000' }}>
        <div className="font-bold text-white mb-1 border-b border-gray-600 pb-1">
          DEBUG: {mode.toUpperCase()} MODE | User: {gateUser?.userName || 'Unregistered User'}
        </div>
        {mode === 'verify' && (
           <div className="mb-1">
             Dist: <span className={debugDistance !== null && debugThreshold !== null && debugDistance < debugThreshold ? 'text-green-400' : 'text-red-400'}>{debugDistance?.toFixed(3) || '--'}</span> / {debugThreshold?.toFixed(2) || '--'} 
             &nbsp;| Match: {debugDistance !== null && debugThreshold !== null ? (debugDistance < debugThreshold ? 'YES' : 'NO') : '--'}
             &nbsp;| Live: {isLivenessPassed ? 'YES' : (blinkDetectedRef.current ? 'HALF (Open eyes)' : 'NO')}
             &nbsp;| EAR: {debugEar?.toFixed(3) || '--'} (Target: &lt; 0.22)
             &nbsp;| Yaw: {yawScore.toFixed(2)}
           </div>
        )}
        <div className="opacity-80 leading-tight">
          {debugLogs.map((log, i) => <div key={i} className="truncate">{log}</div>)}
        </div>
      </div>

      {/* Brightness Boost Overlay for Mode=Verify/Register */}
      <AnimatePresence>
        {(mode === 'verify' || mode === 'register') && !capturedPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white pointer-events-none z-0"
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Detection Cues Overlay */}
        {cameraActive && !capturedPhoto && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            {/* Floating Instruction */}
            <AnimatePresence mode="wait">
              {!isLivenessPassed && isFaceDetected && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute bottom-10 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 flex items-center gap-3 shadow-2xl"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center animate-pulse">
                     {challengeStep === 1 ? <Shield className="w-5 h-5 text-white" /> : <RefreshCw className="w-5 h-5 text-white" />}
                  </div>
                  <span className="text-white font-medium">
                    {challengeStep === 1 ? "Please Blink your eyes" : 
                     currentChallenge === 'LOOK_LEFT' ? "Now Look slowly to the LEFT" : "Now Look slowly to the RIGHT"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress Dots */}
            <div className="absolute top-10 flex gap-2">
                <div className={`w-3 h-3 rounded-full border-2 border-white/30 ${blinkDetected ? 'bg-green-500 border-green-500' : 'bg-transparent'}`} />
                <div className={`w-3 h-3 rounded-full border-2 border-white/30 ${isLivenessPassed ? 'bg-green-500 border-green-500' : 'bg-transparent'}`} />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className={`w-5 h-5 ${mode === 'verify' || mode === 'register' ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <h2 className={`text-xl font-black uppercase tracking-tighter italic ${mode === 'verify' || mode === 'register' ? 'text-gray-900' : 'text-white'}`}>
              Face Authentication
            </h2>
          </div>
          <p className={`text-sm font-medium ${mode === 'verify' || mode === 'register' ? 'text-gray-500' : 'text-emerald-300/60'}`}>
            {mode === 'register' 
              ? (isReEnroll ? 'Re-enroll your face profile' : 'First-time setup: Enroll your face to continue')
              : `Verifying identity for ${actionLabel}`}
          </p>
          
          {/* Liveness/Blink Guide */}
          {(mode === 'verify' || mode === 'register') && !isLivenessPassed && isFaceDetected && (
             <motion.div 
               initial={{ opacity: 0, y: 5 }}
               animate={{ opacity: 1, y: 0 }}
               className="mt-2 flex flex-col items-center gap-1"
             >
               <div className="flex items-center justify-center gap-2">
                 <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                 <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Blink to Verify • or Hold Still</p>
               </div>
               <p className="text-[9px] text-gray-400 font-medium">Auto-verifying if face matches...</p>
             </motion.div>
          )}

          {/* Match Pending Guide */}
          {(mode === 'verify') && isLivenessPassed && isFaceDetected && !isProcessing && (
             <motion.div 
               initial={{ opacity: 0, y: 5 }}
               animate={{ opacity: 1, y: 0 }}
               className="mt-2 flex flex-col items-center gap-1"
             >
               <div className="flex items-center gap-2">
                 <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Liveness Verified • Finalizing...</p>
               </div>
               {livenessPassedStartTimeRef.current && (Date.now() - livenessPassedStartTimeRef.current > 3000) && (
                 <p className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-tight">Matching face features...</p>
               )}
             </motion.div>
          )}
        </div>

        {/* Camera Feed */}
        <div className="relative w-64 h-64 md:w-80 md:h-80 mb-10 group">
          <div className={`absolute inset-[-4px] rounded-full border-4 border-dashed transition-all duration-700 ${
            faceRejected
              ? 'border-rose-500 animate-[spin_2s_linear_infinite]'
              : isFaceDetected 
              ? 'border-emerald-500 animate-[spin_10s_linear_infinite]' 
              : 'border-gray-200'
          }`} />
          
          <div className="w-full h-full rounded-full overflow-hidden border-4 border-white shadow-2xl relative bg-black">
            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
            ) : (
              <>
                <video 
                  ref={videoRef} 
                  className="w-full h-full object-cover" 
                  playsInline muted autoPlay 
                  style={{ transform: 'scaleX(-1)' }}
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Face Scanning Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                   <div className={`w-[80%] h-[80%] rounded-full border-2 transition-colors duration-300 ${
                     isFaceDetected ? 'border-emerald-500/50' : 'border-white/20'
                   }`} />
                   {isFaceDetected && (
                     <motion.div 
                        initial={{ top: '20%' }}
                        animate={{ top: '80%' }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute left-0 right-0 h-1 bg-emerald-500/40 blur-[2px] z-20"
                     />
                   )}
                </div>
              </>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-4">
          {/* Manual Capture Fallback for Re-Enrollment — always show when face detected */}
          {isReEnroll && mode === 'register' && !capturedPhoto && isFaceDetected && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleCapture}
              disabled={isProcessing}
              className={`w-full text-[11px] font-black uppercase tracking-widest px-6 py-4 rounded-2xl transition-all active:scale-95 shadow-xl ${
                isLivenessPassed || isProcessing
                  ? 'text-white bg-emerald-600 shadow-emerald-900/20' 
                  : 'text-emerald-700 bg-emerald-100 animate-pulse'
              }`}
            >
              {isProcessing ? 'Capturing...' : isLivenessPassed ? '📸 Capture Now' : '📸 Capture (Skip Blink)'}
            </motion.button>
          )}
          {mode === 'register' && !capturedPhoto && !isReEnroll && (
            <Button 
              onClick={handleCapture}
              disabled={!isFaceDetected || isProcessing}
              className="w-full !rounded-2xl !py-4 font-black uppercase tracking-widest italic !bg-emerald-600 !border-emerald-700"
            >
              Capture Enrollment
            </Button>
          )}

          {mode === 'register' && capturedPhoto && !isReEnroll && (
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleRegister}
                isLoading={isProcessing}
                className="w-full !rounded-2xl !py-4 font-black uppercase tracking-widest italic !bg-emerald-600 !border-emerald-700"
              >
                Complete Registration
              </Button>
              <button 
                onClick={() => { setCapturedPhoto(null); setComputedDescriptor(null); }}
                className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-emerald-600 transition-colors py-2"
              >
                Retake Photo
              </button>
            </div>
          )}

          {/* Re-enroll auto-flow status text */}
          {mode === 'register' && isReEnroll && (
            <div className="text-center">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-10 leading-relaxed flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {statusMessage || (capturedPhoto ? 'Finalizing registration...' : isLivenessPassed ? '✨ Face Verified! Capturing...' : isFaceDetected ? (
                  !isLivenessPassed && blinkDetected 
                    ? 'Blink detected! Open eyes to finish...' 
                    : !isLivenessPassed 
                    ? '👉 PLEASE BLINK YOUR EYES NOW' 
                    : faceDetectedStartTimeRef.current && (Date.now() - faceDetectedStartTimeRef.current > 1000)
                    ? `Hold steady... ${Math.max(1, Math.ceil((3000 - (Date.now() - faceDetectedStartTimeRef.current)) / 1000))}s`
                    : 'Aligning face...'
                ) : 'Position your face in the frame')}
              </p>
            </div>
          )}

          {mode === 'verify' && (
             <div className="text-center">
               {faceRejected ? (
                 <p className="text-[11px] font-black text-rose-500 uppercase tracking-widest mb-6 px-10 leading-relaxed animate-pulse">
                   ❌ Face Not Recognized — Please ensure you are the registered user
                 </p>
               ) : (
                 <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6 px-10 leading-relaxed">
                   {isLivenessPassed ? 'Liveness verified. Matching identity...' : 'Look directly into the camera and blink your eyes to verify liveness.'}
                 </p>
               )}
                {onFallback && (
                  <button 
                    onClick={onFallback}
                    className="flex items-center justify-center gap-2 mx-auto text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-100 transition-all"
                  >
                    <Hash className="w-3.5 h-3.5" />
                    Use Passcode Fallback
                  </button>
                )}
             </div>
          )}

          {mode === 'success' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center shadow-xl backdrop-blur-sm">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              <div className="text-center">
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">
                  {actionLabel ? `${actionLabel} Successful` : 'Identity Verified'}
                </h2>
                <div className="mt-4 inline-flex items-center gap-2 bg-white/20 border border-white/20 px-5 py-2 rounded-full">
                  <Zap className="w-4 h-4 text-white fill-white" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">
                    Fast Scan: {scanSeconds} Seconds
                  </span>
                </div>
              </div>
              {matchConfidence && (
                <div className="text-[10px] text-white/60 font-bold uppercase tracking-widest">
                  Confidence: {(matchConfidence * 100).toFixed(1)}%
                </div>
              )}
              <button
                onClick={() => {
                  addDebug('FLOW: User manually closed success screen');
                  onVerified();
                }}
                className="mt-6 px-10 py-4 bg-white text-emerald-600 text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all"
              >
                Done
              </button>
            </motion.div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-400 font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {mode !== 'success' && (
            <button 
              onClick={() => {
                addDebug('FLOW: User clicked Cancel/Back');
                onCancel();
              }}
              className={`mt-4 text-[10px] font-black uppercase tracking-widest py-2 transition-colors ${
                mode === 'verify' || mode === 'register' ? 'text-gray-400 hover:text-gray-600' : 'text-emerald-300/40 hover:text-emerald-100'
              }`}
            >
              Cancel & Go Back
            </button>
          )}

          {/* Status Badge Moved to Bottom */}
          <div className="flex justify-center mt-2">
            <AnimatePresence mode="wait">
              {isLivenessPassed ? (
                <motion.div 
                  key="liveness-passed"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-emerald-500 text-white text-[10px] font-black px-6 py-2 rounded-2xl shadow-lg uppercase tracking-widest flex items-center gap-2"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Ready to Capture
                </motion.div>
              ) : isFaceDetected ? (
                <motion.div 
                  key="blink-prompt"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-amber-500 text-white text-[10px] font-black px-6 py-2.5 rounded-2xl shadow-lg uppercase tracking-widest flex flex-col items-center gap-1"
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Blink to verify liveness
                  </div>
                    <div className="text-[10px] font-bold bg-white/20 px-3 py-1 rounded-full border border-white/10 mt-1 shadow-inner">
                      {mode === 'register' ? 'ENROLLING: ' : 'SCANNING: '}
                      {Math.max(0, 3 - scanSeconds)}S REMAINING
                    </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="position-face"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-gray-800 text-white/60 text-[10px] font-black px-6 py-2 rounded-2xl shadow-lg uppercase tracking-widest"
                >
                  Position Face
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Decorative Background for Success/Checking */}
      {(mode === 'checking' || mode === 'success' || mode === 'fail') && (
        <>
          <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full z-0" />
          <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full z-0" />
        </>
      )}

    </div>
  );
};

export default PersonalFaceAuth;
