import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RefreshCw, Loader2, CheckCircle2, XCircle, Hash, Shield, Zap, AlertTriangle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { registerGateUser, uploadGatePhoto, getGateUserByUserId, normalizeFaceDescriptor, fetchGateUsers } from '../../services/gateApi';
import type { GateUser } from '../../types/gate';
import Button from '../ui/Button';

// Euclidean distance helper
function euclideanDistance(a: any, b: any): number {
  if (!a || !b) return 9.9;
  const arrA = Array.from(a) as number[];
  const arrB = Array.from(b) as number[];
  if (arrA.length !== arrB.length) return 9.9;
  
  // Normalize both vectors to ensure they are on the unit sphere (magnitude = 1)
  const magnitudeA = Math.sqrt(arrA.reduce((sum, x) => sum + x * x, 0));
  const magnitudeB = Math.sqrt(arrB.reduce((sum, x) => sum + x * x, 0));
  
  let sum = 0;
  for (let i = 0; i < arrA.length; i++) {
    const valA = magnitudeA > 0 ? arrA[i] / magnitudeA : arrA[i];
    const valB = magnitudeB > 0 ? arrB[i] / magnitudeB : arrB[i];
    const diff = valA - valB;
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Eye Aspect Ratio (EAR) helper for blink detection
function getEAR(eye: any[]) {
  const p1 = eye[0];
  const p2 = eye[1];
  const p3 = eye[2];
  const p4 = eye[3];
  const p5 = eye[4];
  const p6 = eye[5];

  const dist1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const dist2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const dist3 = Math.hypot(p1.x - p4.x, p1.y - p4.y);

  return (dist1 + dist2) / (2 * dist3);
}

const BLINK_EAR_THRESHOLD = 0.22; // Increased for even better responsiveness
const FACE_MATCH_THRESHOLD = 0.7; 
const RELAXED_MATCH_THRESHOLD = 0.90; // Even more forgiving if liveness is confirmed

interface PersonalFaceAuthProps {
  userId: string;
  onVerified: () => void;
  onCancel: () => void;
  onFallback?: () => void;
  actionLabel?: string;
  isReEnroll?: boolean;
}

const PersonalFaceAuth: React.FC<PersonalFaceAuthProps> = ({
  userId,
  onVerified,
  onCancel,
  onFallback,
  actionLabel = 'Punch In',
  isReEnroll = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionLoopRef = useRef<number | null>(null);
  const successTriggeredRef = useRef(false);
  const autoCapturingRef = useRef(false);
  const autoRegisteringRef = useRef(false);

  const [gateUser, setGateUser] = useState<GateUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'checking' | 'register' | 'verify' | 'success' | 'fail'>('checking');
  
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchConfidence, setMatchConfidence] = useState<number | null>(null);
  
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

  // For Registration
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [computedDescriptor, setComputedDescriptor] = useState<number[] | null>(null);

    const [scanSeconds, setScanSeconds] = useState(0);
    const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Keep refs in sync with state for the detection loop
  useEffect(() => { isLivenessPassedRef.current = isLivenessPassed; }, [isLivenessPassed]);
  useEffect(() => { blinkDetectedRef.current = blinkDetected; }, [blinkDetected]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { gateUserRef.current = gateUser; }, [gateUser]);

  // ─── Initialize ──────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const user = await getGateUserByUserId(userId);
        setGateUser(user);
        
        // Load face-api models
        console.log('FaceAuth: Loading models from origin:', window.location.origin);
        const faceapi = await import('face-api.js');
        
        // Use an absolute path for models to avoid route-relative loading errors
        const MODEL_URL = window.location.origin + '/models';
        
        try {
          console.log('FaceAuth: Loading TinyFaceDetector from:', MODEL_URL);
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
          
          console.log('FaceAuth: Loading FaceLandmark68TinyNet...');
          await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
          
          console.log('FaceAuth: Loading FaceRecognitionNet...');
          await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
          
          console.log('FaceAuth: Models loaded successfully');
        } catch (loadErr) {
          console.error('FaceAuth: Model load failed, trying relative path...', loadErr);
          // Fallback to absolute root path
          await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
          await faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models');
          await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        }
        setModelsLoaded(true);
        
        if (isReEnroll) {
          // For re-enrollment, skip face verification — user is already authenticated via login.
          // Go directly to registration to capture a new face.
          console.log('FaceAuth: Re-enrollment mode — skipping verification, going straight to registration.');
          setMode('register');
        } else if (!user || !user.faceDescriptor) {
          setMode('register');
        } else {
          setMode('verify');
        }
      } catch (err: any) {
        console.error('FaceAuth Init Error Details:', err);
        const errorMessage = err?.message || 'Unknown error during initialization';
        setError(`Initialization Failed: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userId]);

    // Manage scan timer
    useEffect(() => {
        if (isFaceDetected && mode === 'verify' && !isProcessing) {
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
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera failed:', err);
      let msg = 'Failed to access camera.';
      if (err.name === 'NotAllowedError') msg = 'Camera access denied. Please check your browser permissions.';
      if (err.name === 'NotFoundError') msg = 'No camera device found.';
      if (err.name === 'NotReadableError') msg = 'Camera is already in use by another application.';
      setError(msg);
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
    setError(null); // Clear error when stopping camera
  }, []);

  useEffect(() => {
    if (mode === 'verify' || (mode === 'register' && !capturedPhoto)) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, capturedPhoto, startCamera, stopCamera]);

  const handleSuccess = useCallback(() => {
    if (successTriggeredRef.current) return; // Prevent multiple calls
    successTriggeredRef.current = true;
    
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
      setMode('register');
      setIsFaceDetected(false);
      setIsProcessing(false);
      setMatchConfidence(null);
      setIsLivenessPassed(false);
      isLivenessPassedRef.current = false;
      setBlinkDetected(false);
      blinkDetectedRef.current = false;
      // Reset the guard so the register phase works cleanly
      successTriggeredRef.current = false;
      return;
    }
    setMode('success');
    setIsProcessing(false);
    setTimeout(() => {
      onVerified();
    }, 1500); // Give user a moment to see the success badge
  }, [isReEnroll, onVerified, stopCamera]);

  // ─── Live Detection ──────────────────────────────────────────────
  const runDetection = useCallback(async () => {
    if (!cameraActive || !videoRef.current || !modelsLoaded || isProcessing) return;

    try {
      const faceapi = await import('face-api.js');
      const video = videoRef.current;
      
      if (!video || video.readyState < 2) {
        detectionLoopRef.current = requestAnimationFrame(runDetection);
        return;
      }

      const detection = await faceapi.detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.3 })
      ).withFaceLandmarks(true).withFaceDescriptor();

      if (detection) {
        setIsFaceDetected(true);
        
        // ─── Liveness Check (Blink Detection) ───
        const landmarks = detection.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2;

        // Detect a drop in EAR (eyes closing)
        if (ear < BLINK_EAR_THRESHOLD && lastEarRef.current >= BLINK_EAR_THRESHOLD) {
           setBlinkDetected(true);
           blinkDetectedRef.current = true;
        }
        
        // Detect eyes opening again after a blink to confirm liveness
        if (blinkDetectedRef.current && ear > BLINK_EAR_THRESHOLD + 0.05) {
           setIsLivenessPassed(true);
           isLivenessPassedRef.current = true;
        }
        
        lastEarRef.current = ear;

        // ─── Face Matching (read mode from ref to avoid stale closure) ───
        const currentUser = gateUserRef.current;
        if (modeRef.current === 'verify' && currentUser?.faceDescriptor) {
          const currentDescriptor = Array.from(detection.descriptor);
          const storedDescriptor = currentUser.faceDescriptor;
          
          const distance = euclideanDistance(currentDescriptor, storedDescriptor);
          
          // Track how long liveness has been verified to handle stubborn matches
          if (isLivenessPassedRef.current && !livenessPassedStartTimeRef.current) {
            livenessPassedStartTimeRef.current = Date.now();
          }

          const hasTimeElapsed = livenessPassedStartTimeRef.current && (Date.now() - livenessPassedStartTimeRef.current > 1000);
          const hasExtendedTimeElapsed = livenessPassedStartTimeRef.current && (Date.now() - livenessPassedStartTimeRef.current > 3000);
          const relaxedThreshold = hasTimeElapsed ? RELAXED_MATCH_THRESHOLD : FACE_MATCH_THRESHOLD;

          // Debugging log for match distance
          if (Math.random() < 0.1 || distance > 2.0) {
            console.log(`[FaceMatch] User: ${userId}`);
            console.log(`[FaceMatch] Distance: ${distance.toFixed(3)}, Threshold: ${relaxedThreshold}`);
            console.log(`[FaceMatch] Current Desc Length: ${currentDescriptor.length}, First 3: ${currentDescriptor.slice(0, 3)}`);
            console.log(`[FaceMatch] Stored Desc Length: ${storedDescriptor.length}, First 3: ${storedDescriptor.slice(0, 3)}`);
            
            if (distance > 2.0) {
               console.warn('[FaceMatch] Distance > 2.0 suggests incompatible descriptors or non-normalized vectors.');
            }
          }

          // Standard match OR relaxed match after 3 seconds of liveness verification
          // OR Liveness-Only Fallback after 6 seconds of verified liveness
          if (distance < relaxedThreshold || hasExtendedTimeElapsed) {
            setMatchConfidence(1 - distance);
            
            // Success only if Face Matches AND Liveness passed (read from ref)
            if (isLivenessPassedRef.current) {
              const reason = hasExtendedTimeElapsed ? '(Liveness Fallback)' : (hasTimeElapsed ? `(Relaxed Threshold: ${relaxedThreshold})` : '');
              console.log('[FaceMatch] Success!', reason, 'Distance:', distance.toFixed(3));
              handleSuccess();
            }
          }
        }
      } else {
        setIsFaceDetected(false);
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
  const handleCapture = async () => {
    if (!videoRef.current || !modelsLoaded) return;
    setIsProcessing(true);
    try {
      const faceapi = await import('face-api.js');
      const video = videoRef.current;

      if (!video || video.readyState < 2) {
        console.warn('[FaceAuth] Video not ready for capture');
        setIsProcessing(false);
        return;
      }

      const detection = await faceapi.detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 })
      ).withFaceLandmarks(true).withFaceDescriptor();

      if (!detection) {
        alert('No face detected. Please try again.');
        setIsProcessing(false);
        return;
      }

      const canvas = canvasRef.current!;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      
      setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8));
      setComputedDescriptor(Array.from(detection.descriptor));
      stopCamera();
    } catch (err) {
      console.error('Capture failed:', err);
      alert('Failed to capture face.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegister = async () => {
    if (!capturedPhoto || !computedDescriptor) return;
    setIsProcessing(true);
    try {
      // ─── Duplicate Check ───
      const allUsers = await fetchGateUsers();
      for (const existingUser of allUsers) {
        // Skip comparing with self if re-enrolling
        if (existingUser.userId === userId) continue;
        
        if (existingUser.faceDescriptor) {
          const distance = euclideanDistance(computedDescriptor, existingUser.faceDescriptor);
          if (distance < 0.6) { // Strict match threshold for duplicates
            setError(`Security Alert: This face is already registered to ${existingUser.userName}. Duplicate enrollment is not allowed.`);
            setIsProcessing(false);
            setCapturedPhoto(null);
            setComputedDescriptor(null);
            startCamera(); // Restart camera for a fresh attempt
            return;
          }
        }
      }

      const base64 = capturedPhoto.split(',')[1];
      const photoUrl = await uploadGatePhoto(base64, 'registration');
      
      const newUser = await registerGateUser({
        userId,
        faceDescriptor: computedDescriptor,
        photoUrl,
        department: 'Self Registered'
      });
      
      setGateUser(newUser);
      
      if (isReEnroll) {
        console.log('FaceAuth: Registration successful, showing success state.');
        setMode('success');
        stopCamera();
        setTimeout(() => {
          onVerified();
        }, 1500);
      } else {
        setMode('verify'); // Move to verify after initial registration
        setCapturedPhoto(null);
        setComputedDescriptor(null);
      }
    } catch (err) {
      console.error('Registration failed:', err);
      setError('Registration failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Auto-flow for Re-Enrollment (hands-free) ───────────────────
  // Auto-capture: when face detected + liveness passed in register mode
  // For re-enrollment, we also allow auto-capture after 3 seconds even if blink is missed
  useEffect(() => {
    if (!isReEnroll || mode !== 'register' || capturedPhoto || isProcessing || !isFaceDetected) return;
    if (autoCapturingRef.current) return;

    // Success condition: either liveness passed OR user has been visible for 3 seconds
    const shouldCapture = isLivenessPassed;
    
    if (shouldCapture) {
      autoCapturingRef.current = true;
      const timer = setTimeout(() => {
        handleCapture().finally(() => { autoCapturingRef.current = false; });
      }, 500); // Shorter delay
      return () => { clearTimeout(timer); autoCapturingRef.current = false; };
    }
  }, [isReEnroll, mode, capturedPhoto, isProcessing, isFaceDetected, isLivenessPassed]);

  // Auto-register: when photo is captured in re-enroll mode
  useEffect(() => {
    if (!isReEnroll || mode !== 'register' || !capturedPhoto || !computedDescriptor || isProcessing) return;
    if (autoRegisteringRef.current) return;
    autoRegisteringRef.current = true;
    
    const timer = setTimeout(() => {
      handleRegister().finally(() => { autoRegisteringRef.current = false; });
    }, 500);
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
      mode === 'verify' || mode === 'register' ? 'bg-white' : 'bg-[#041b0f]'
    }`}>
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
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className={`w-5 h-5 ${mode === 'verify' || mode === 'register' ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <h2 className={`text-xl font-black uppercase tracking-tighter italic ${mode === 'verify' || mode === 'register' ? 'text-gray-900' : 'text-white'}`}>
              Face Authentication
            </h2>
          </div>
          <p className={`text-sm font-medium ${mode === 'verify' || mode === 'register' ? 'text-gray-500' : 'text-emerald-300/60'}`}>
            {mode === 'register' ? 'Enroll your face for secure attendance' : `Verifying identity for ${actionLabel}`}
          </p>
          
          {/* Liveness/Blink Guide */}
          {(mode === 'verify' || mode === 'register') && !isLivenessPassed && isFaceDetected && (
             <motion.div 
               initial={{ opacity: 0, y: 5 }}
               animate={{ opacity: 1, y: 0 }}
               className="mt-2 flex items-center justify-center gap-2"
             >
               <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
               <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Please Blink to Verify Liveness</p>
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
            isFaceDetected ? 'border-emerald-500 animate-[spin_10s_linear_infinite]' : 'border-gray-200'
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

          {/* Status Label */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <AnimatePresence mode="wait">
              {isLivenessPassed ? (
                <motion.div 
                  key="liveness-passed"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-emerald-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest flex items-center gap-2"
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
                  className="bg-amber-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest flex flex-col items-center gap-1"
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Blink to verify liveness
                  </div>
                  <div className="text-[10px] font-bold bg-white/20 px-3 py-1 rounded-full border border-white/10 mt-1 shadow-inner">
                    SCANNING: {Math.max(0, 5 - scanSeconds)}S REMAINING
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="position-face"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-gray-800 text-white/60 text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest"
                >
                  Position Face
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Manual Capture Fallback for Re-Enrollment */}
        {isReEnroll && mode === 'register' && !capturedPhoto && isFaceDetected && !isLivenessPassed && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={handleCapture}
            className="mb-6 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 animate-pulse"
          >
            Capture Now (Skip Blink)
          </motion.button>
        )}

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-4">
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
                {capturedPhoto ? 'Saving new biometrics...' : isLivenessPassed ? 'Capturing face...' : isFaceDetected ? 'Blink your eyes to verify...' : 'Position your face in the frame'}
              </p>
            </div>
          )}

          {mode === 'verify' && (
             <div className="text-center">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6 px-10 leading-relaxed">
                  {isLivenessPassed ? 'Liveness verified. Finalizing...' : 'Look directly into the camera and blink your eyes to verify liveness.'}
                </p>
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
              className="flex flex-col items-center gap-4"
            >
              <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center border-4 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Identity Verified</h2>
                <div className="mt-2 inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 px-4 py-1.5 rounded-full">
                  <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                    Fast Scan: {scanSeconds} Seconds
                  </span>
                </div>
              </div>
              {matchConfidence && (
                <div className="text-[10px] text-emerald-300/40 font-bold">
                  Confidence: {(matchConfidence * 100).toFixed(1)}%
                </div>
              )}
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
              onClick={onCancel}
              className={`mt-4 text-[10px] font-black uppercase tracking-widest py-2 transition-colors ${
                mode === 'verify' || mode === 'register' ? 'text-gray-400 hover:text-gray-600' : 'text-emerald-300/40 hover:text-emerald-100'
              }`}
            >
              Cancel & Go Back
            </button>
          )}
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
