import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RefreshCw, Loader2, CheckCircle2, XCircle, Hash, Shield, Zap, AlertTriangle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { registerGateUser, uploadGatePhoto, getGateUserByUserId, normalizeFaceDescriptor } from '../../services/gateApi';
import type { GateUser } from '../../types/gate';
import Button from '../ui/Button';

// Euclidean distance helper
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
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

const FACE_MATCH_THRESHOLD = 0.45;
const BLINK_EAR_THRESHOLD = 0.22; // EAR below this indicates eyes are closed

interface PersonalFaceAuthProps {
  userId: string;
  onVerified: () => void;
  onCancel: () => void;
  onFallback?: () => void; // For passcode fallback
  actionLabel?: string;
}

const PersonalFaceAuth: React.FC<PersonalFaceAuthProps> = ({
  userId,
  onVerified,
  onCancel,
  onFallback,
  actionLabel = 'Punch In'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionLoopRef = useRef<number | null>(null);

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

  // For Registration
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [computedDescriptor, setComputedDescriptor] = useState<number[] | null>(null);

  // ─── Initialize ──────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const user = await getGateUserByUserId(userId);
        setGateUser(user);
        
        // Load face-api models
        const faceapi = await import('face-api.js');
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL), // Use tiny landmarks
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        
        if (!user || !user.faceDescriptor) {
          setMode('register');
        } else {
          setMode('verify');
        }
      } catch (err) {
        console.error('FaceAuth Init Error:', err);
        setError('Failed to initialize face recognition.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userId]);

  // ─── Camera Control ──────────────────────────────────────────────
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
      setError('Camera access denied. Please check your permissions.');
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
  }, []);

  useEffect(() => {
    if (mode === 'verify' || (mode === 'register' && !capturedPhoto)) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, capturedPhoto, startCamera, stopCamera]);

  // ─── Live Detection ──────────────────────────────────────────────
  const runDetection = useCallback(async () => {
    if (!cameraActive || !videoRef.current || !modelsLoaded || isProcessing) return;

    try {
      const faceapi = await import('face-api.js');
      const video = videoRef.current;
      
      if (video.readyState < 2) {
        detectionLoopRef.current = requestAnimationFrame(runDetection);
        return;
      }

      const detection = await faceapi.detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
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
        }
        
        // Detect eyes opening again after a blink to confirm liveness
        if (blinkDetected && ear > BLINK_EAR_THRESHOLD + 0.05) {
           setIsLivenessPassed(true);
        }
        
        lastEarRef.current = ear;

        // ─── Face Matching ───
        if (mode === 'verify' && gateUser?.faceDescriptor) {
          const distance = euclideanDistance(Array.from(detection.descriptor), gateUser.faceDescriptor);
          if (distance < FACE_MATCH_THRESHOLD) {
            setMatchConfidence(1 - distance);
            
            // Success only if Face Matches AND Liveness passed
            if (isLivenessPassed) {
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

    if (cameraActive && mode !== 'success') {
      detectionLoopRef.current = requestAnimationFrame(runDetection);
    }
  }, [cameraActive, modelsLoaded, isProcessing, mode, gateUser, blinkDetected, isLivenessPassed]);

  useEffect(() => {
    if (cameraActive && modelsLoaded) {
      detectionLoopRef.current = requestAnimationFrame(runDetection);
    }
    return () => {
      if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
    };
  }, [cameraActive, modelsLoaded, runDetection]);

  const handleSuccess = () => {
    setMode('success');
    setIsProcessing(false);
    stopCamera();
    setTimeout(() => {
      onVerified();
    }, 1500);
  };

  // ─── Registration Logic ──────────────────────────────────────────
  const handleCapture = async () => {
    if (!videoRef.current || !modelsLoaded) return;
    setIsProcessing(true);
    try {
      const faceapi = await import('face-api.js');
      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions()
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
      const base64 = capturedPhoto.split(',')[1];
      const photoUrl = await uploadGatePhoto(base64, 'registration');
      
      const newUser = await registerGateUser({
        userId,
        faceDescriptor: computedDescriptor,
        photoUrl,
        department: 'Self Registered'
      });
      
      setGateUser(newUser);
      setMode('verify'); // Move to verify after registration
      setCapturedPhoto(null);
      setComputedDescriptor(null);
    } catch (err) {
      console.error('Registration failed:', err);
      setError('Registration failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

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
                  Liveness Verified
                </motion.div>
              ) : isFaceDetected ? (
                <motion.div 
                  key="blink-prompt"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-amber-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest flex items-center gap-2"
                >
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Blink your eyes...
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

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-4">
          {mode === 'register' && !capturedPhoto && (
            <Button 
              onClick={handleCapture}
              disabled={!isFaceDetected || isProcessing}
              className="w-full !rounded-2xl !py-4 font-black uppercase tracking-widest italic !bg-emerald-600 !border-emerald-700"
            >
              Capture Enrollment
            </Button>
          )}

          {mode === 'register' && capturedPhoto && (
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
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <p className="text-emerald-400 font-black uppercase tracking-[0.2em] text-sm animate-pulse">
                Verified Successfully
              </p>
              {matchConfidence && (
                <p className="text-[10px] text-emerald-300/40 font-bold">
                  Confidence: {(matchConfidence * 100).toFixed(1)}%
                </p>
              )}
            </div>
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
