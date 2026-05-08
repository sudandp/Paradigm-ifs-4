/**
 * RegisterGateUser.tsx — Admin page to register users for gate attendance
 * Captures face photo, computes face descriptor, generates QR code.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import {
  registerGateUser, fetchAllGateUsers, uploadGatePhoto, deactivateGateUser,
} from '../../services/gateApi';
import type { GateUser } from '../../types/gate';
import { useLogoStore } from '../../store/logoStore';
import {
  ArrowLeft, Camera, QrCode, User, UserPlus, Trash2, CheckCircle2,
  Loader2, Search, Download, RefreshCw, Shield, AlertTriangle, Printer, X, Clock, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

const RegisterGateUser: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { currentLogo } = useLogoStore();

  const [users, setUsers] = useState<GateUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showForm, setShowForm] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  // Print ID Card state
  const [printUser, setPrintUser] = useState<GateUser | null>(null);
  const [printCompanyName, setPrintCompanyName] = useState('PARADIGM OFFICE');
  const [printBloodGroup, setPrintBloodGroup] = useState('B+');
  const [printTerms, setPrintTerms] = useState('1. This card is property of the company.\n2. Loss must be reported immediately.\n3. Return upon termination of employment.');
  const [printAddress, setPrintAddress] = useState('Plot No. 42, Knowledge Park III,\nGreater Noida, UP - 201310');
  const [printEmployeeId, setPrintEmployeeId] = useState('');

  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    if (showForm && !modelsLoaded) {
      loadModels();
    }
  }, [showForm, modelsLoaded]);

  const loadModels = async () => {
    try {
      setModelsLoading(true);
      const faceapi = await import('face-api.js');
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
    } catch (err) {
      console.error('Failed to load face-api models:', err);
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    if (printUser) {
      setPrintEmployeeId(printUser.userId.substring(0, 8).toUpperCase());
    }
  }, [printUser]);

  useEffect(() => {
    loadUsers();
    loadEmployees();
    
    // Load saved ID card settings
    const savedCompany = localStorage.getItem('print_id_company');
    const savedAddress = localStorage.getItem('print_id_address');
    const savedTerms = localStorage.getItem('print_id_terms');
    if (savedCompany) setPrintCompanyName(savedCompany);
    if (savedAddress) setPrintAddress(savedAddress);
    if (savedTerms) setPrintTerms(savedTerms);
  }, []);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('print_id_company', printCompanyName);
    localStorage.setItem('print_id_address', printAddress);
    localStorage.setItem('print_id_terms', printTerms);
  }, [printCompanyName, printAddress, printTerms]);

  const loadUsers = async () => {
    try {
      const data = await fetchAllGateUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load gate users:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    const { data } = await supabase.from('users').select('id, name, email, photo_url').order('name');
    setEmployees(data || []);
  };

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
    return () => {
      // Cleanup on unmount or when cameraActive becomes false
      if (!cameraActive && videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [cameraActive]);

  // Global cleanup
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error('Camera failed:', err);
      alert('Could not access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureAndCompute = async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded) return;
    
    try {
      const faceapi = await import('face-api.js');
      const detection = await faceapi.detectSingleFace(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks(true).withFaceDescriptor();

      if (!detection) {
        alert('No face detected. Please ensure your face is clearly visible and try again.');
        return;
      }

      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8));
      }
      
      setFaceDescriptor(Array.from(detection.descriptor));
      stopCamera();
    } catch (err) {
      console.error('Capture failed:', err);
      alert('Capture failed. Please try again.');
    }
  };

  const handleRegister = async () => {
    if (!selectedEmployee) return;
    setRegistering(true);
    try {
      let finalPhotoUrl = selectedEmployee.photo_url;
      
      if (capturedPhoto) {
        const base64 = capturedPhoto.split(',')[1];
        finalPhotoUrl = await uploadGatePhoto(base64, 'registration');
      }

      await registerGateUser({
        userId: selectedEmployee.id,
        faceDescriptor,
        photoUrl: finalPhotoUrl,
        department: 'General',
      });

      setShowForm(false);
      setCapturedPhoto(null);
      setFaceDescriptor(null);
      setSelectedEmployee(null);
      loadUsers();
    } catch (err) {
      console.error('Registration failed:', err);
      alert('Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deactivate this user?')) return;
    try {
      await deactivateGateUser(id);
      loadUsers();
    } catch (err) {
      console.error('Deactivation failed:', err);
    }
  };

  const filtered = users.filter(u => 
    u.isActive && (
      (u.userName || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.userEmail || '').toLowerCase().includes(search.toLowerCase())
    )
  );

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.email.toLowerCase().includes(empSearch.toLowerCase())
  ).slice(0, 5);

  const getQrImageUrl = (token: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${token}`;
  };

  return (
    <div className="p-4 md:p-8 w-full pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10 mb-10 pb-6 border-b border-gray-100">
        <div className="flex-shrink-0">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-accent uppercase tracking-wider mb-2 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <h1 className="text-3xl font-black text-primary-text tracking-tight">Gate Registration</h1>
          <p className="text-muted text-sm font-medium">Manage employee biometric & QR access</p>
        </div>

        <div className="flex-1 max-w-md relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors">
            <Search className="w-5 h-5" />
          </div>
          <input 
            type="text" 
            placeholder="Search users..." 
            className="form-input !pl-12 h-12 text-base shadow-sm border-gray-200 focus:border-accent transition-all rounded-2xl bg-gray-50/50 focus:bg-white w-full"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="lg:ml-auto">
          <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2.5 p-3.5 md:px-6 md:py-3 rounded-2xl shadow-lg shadow-accent/20 hover:shadow-accent/40 transform active:scale-95 transition-all">
            <UserPlus className="w-6 h-6 md:w-5 md:h-5" /> 
            <span className="font-bold hidden md:inline">Register New</span>
          </button>
        </div>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-accent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(u => (
            <div key={u.id} className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden group">
              <div className="p-5 flex gap-4">
                <div className="relative">
                  {u.userPhotoUrl ? (
                    <img src={u.userPhotoUrl} alt="" className="w-20 h-20 rounded-2xl object-cover border border-border" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center"><User className="w-8 h-8 text-gray-300" /></div>
                  )}
                  {u.faceDescriptor && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center" title="Face Registered">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-primary-text truncate">{u.userName || 'Unknown'}</h3>
                  <p className="text-xs text-muted truncate mb-2">{u.userEmail}</p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-bold text-muted uppercase tracking-wider">{u.department || 'General'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 bg-gray-50/50 border-t border-border flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={() => setPrintUser(u)} className="p-2 rounded-xl bg-white border border-border hover:border-accent hover:text-accent transition-all" title="Print ID Card">
                    <Printer className="w-4 h-4" />
                  </button>
                  <button onClick={() => window.open(getQrImageUrl(u.qrToken))} className="p-2 rounded-xl bg-white border border-border hover:border-accent hover:text-accent transition-all" title="View QR">
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={() => handleDelete(u.id)} className="p-2 rounded-xl bg-white border border-border hover:border-red-500 hover:text-red-500 transition-all" title="Deactivate">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {/* QR Preview Hidden */}
              <div className="hidden">
                <div id={`qr-${u.id}`} className="p-4 bg-white flex flex-col items-center">
                  <p className="font-bold text-sm mb-2">{u.userName}</p>
                  <img src={getQrImageUrl(u.qrToken)} alt="QR" className="w-24 h-24 rounded-lg mix-blend-multiply" loading="lazy" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Registration Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card rounded-3xl shadow-xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-primary-text">Register New User</h2>
                  <button onClick={() => { setShowForm(false); stopCamera(); setCapturedPhoto(null); setFaceDescriptor(null); setSelectedEmployee(null); }}
                    className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Employee Search */}
                <div className="mb-6 relative">
                  <label htmlFor="employee-search" className="text-sm font-medium text-muted mb-1.5 block">Search Employee</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input 
                      id="employee-search"
                      name="employee-search"
                      type="text" 
                      placeholder="Type name or email..." 
                      className="form-input pl-10"
                      value={empSearch}
                      onChange={e => { setEmpSearch(e.target.value); setSelectedEmployee(null); }}
                    />
                  </div>

                  {empSearch.length >= 2 && !selectedEmployee && (
                    <div className="absolute z-[60] left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-xl overflow-hidden divide-y divide-border">
                      {filteredEmployees.map(e => (
                        <button 
                          key={e.id}
                          onClick={() => { setSelectedEmployee(e); setEmpSearch(e.name); }}
                          className="w-full px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-left transition-colors"
                        >
                          {e.photo_url ? (
                            <img src={e.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><User className="w-4 h-4 text-gray-400" /></div>
                          )}
                          <div>
                            <p className="text-sm font-bold text-primary-text">{e.name}</p>
                            <p className="text-xs text-muted">{e.email}</p>
                          </div>
                        </button>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <div className="px-4 py-8 text-center text-muted">
                          <p className="text-sm italic">No employees found matching "{empSearch}"</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Capture Section */}
                <div className="mb-8">
                  <label className="text-sm font-medium text-muted mb-2 block text-center">Face Recognition Enrollment</label>
                  
                  {capturedPhoto ? (
                    <div className="relative">
                      <img src={capturedPhoto} alt="Captured" className="w-full rounded-2xl border border-emerald-500/30" />
                      <button onClick={() => { setCapturedPhoto(null); setFaceDescriptor(null); startCamera(); }}
                        className="absolute bottom-3 right-3 btn btn-sm bg-black/50 hover:bg-black/70 text-white backdrop-blur-md border-white/20">
                        <RefreshCw className="w-4 h-4" /> Retake
                      </button>
                      <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg">Face Computed</div>
                    </div>
                  ) : cameraActive ? (
                    <div className="relative">
                      <video ref={videoRef} className="w-full rounded-2xl border border-border" playsInline muted autoPlay style={{ transform: 'scaleX(-1)' }} />
                      <canvas ref={canvasRef} className="hidden" />
                      
                      {!modelsLoaded ? (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center text-white gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                          <span className="text-sm font-bold tracking-wide uppercase">Initializing AI Models...</span>
                        </div>
                      ) : (
                        <button onClick={captureAndCompute}
                          className="absolute bottom-3 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40 flex items-center justify-center hover:bg-emerald-400 transition-colors group">
                          <Camera className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button onClick={startCamera}
                      className="w-full py-12 rounded-2xl border-2 border-dashed border-border hover:border-accent/40 transition-colors flex flex-col items-center gap-2 text-muted">
                      <Camera className="w-8 h-8" />
                      <span className="text-sm font-medium">Open Camera to Capture Face</span>
                      <span className="text-xs">This step is required for face recognition</span>
                    </button>
                  )}
                </div>

                {/* Submit */}
                <button onClick={handleRegister}
                  disabled={!selectedEmployee || registering}
                  className="w-full btn btn-lg btn-primary disabled:opacity-50 flex items-center justify-center gap-2">
                  {registering ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                  {registering ? 'Registering...' : 'Register User'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Print ID Card Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {printUser && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[5vh] print-hide">
            <motion.div 
              initial={{ opacity: 0, y: -40, scale: 0.95 }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                scale: 1,
                transition: {
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1]
                }
              }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="bg-card rounded-3xl shadow-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-bold text-primary-text flex items-center gap-2"><Printer className="w-5 h-5"/> Print ID Card</h2>
                <div className="flex items-center gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.print()} 
                    className="relative group overflow-hidden px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-[0_8px_20px_-6px_rgba(5,150,105,0.5)] hover:shadow-[0_12px_25px_-4px_rgba(5,150,105,0.6)] transition-all flex items-center gap-2.5 border border-emerald-400/20"
                  >
                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] transition-transform" />
                    
                    <Printer className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
                    <span>Print Card</span>
                  </motion.button>

                  <button 
                    onClick={() => setPrintUser(null)} 
                    className="p-2.5 rounded-xl bg-gray-100/80 hover:bg-red-50 text-gray-500 hover:text-red-600 transition-all border border-transparent hover:border-red-100"
                  >
                    <X className="w-5 h-5"/>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/30">
                {/* Configuration Section */}
                <div className="p-8 border-b border-border bg-white">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Card Configuration</h3>
                      <p className="text-[10px] text-muted font-medium uppercase tracking-wider">Customize fields for this session</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="print-company-name" className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Company Name</label>
                      <input type="text" id="print-company-name" name="print-company-name" value={printCompanyName} onChange={e => setPrintCompanyName(e.target.value)} className="form-input h-10 text-sm font-medium border-gray-200 focus:border-emerald-500 transition-all rounded-xl" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="print-blood-group" className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Blood Group</label>
                      <input type="text" id="print-blood-group" name="print-blood-group" value={printBloodGroup} onChange={e => setPrintBloodGroup(e.target.value)} className="form-input h-10 text-sm font-medium border-gray-200 focus:border-emerald-500 transition-all rounded-xl" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="print-employee-id" className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Employee ID</label>
                      <input type="text" id="print-employee-id" name="print-employee-id" value={printEmployeeId} onChange={e => setPrintEmployeeId(e.target.value)} className="form-input h-10 text-sm font-medium border-gray-200 focus:border-emerald-500 transition-all rounded-xl" />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-3">
                      <label htmlFor="print-terms" className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Terms & Conditions</label>
                      <textarea id="print-terms" name="print-terms" value={printTerms} onChange={e => setPrintTerms(e.target.value)} className="form-input text-xs h-20 resize-none border-gray-200 focus:border-emerald-500 transition-all rounded-xl leading-relaxed" />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-3">
                      <label htmlFor="print-address" className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Office Address</label>
                      <textarea id="print-address" name="print-address" value={printAddress} onChange={e => setPrintAddress(e.target.value)} className="form-input text-xs h-20 resize-none border-gray-200 focus:border-emerald-500 transition-all rounded-xl leading-relaxed" />
                    </div>
                  </div>
                </div>

                {/* Preview Section */}
                <div className="p-8 flex flex-col items-center">
                  <div className="flex items-center justify-center mb-8">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Live Preview</span>
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-12 items-center justify-center p-8 bg-white/40 rounded-[2.5rem] border border-white/60 shadow-inner" id="printable-id-card-container">
                    {/* FRONT CARD */}
                    <div className="w-[2.125in] h-[3.375in] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col relative overflow-hidden shrink-0 print-card" style={{ width: '2.125in', height: '3.375in', boxSizing: 'border-box' }}>
                        <div className="absolute inset-0 bg-gradient-to-b from-emerald-200/60 via-white to-white z-0"></div>
                        <div className="absolute -top-4 -left-8 w-32 h-32 transform -rotate-45 opacity-50 flex gap-1.5 z-0">
                           <div className="w-1.5 h-[100%] bg-emerald-400 rounded-full"></div>
                           <div className="w-3.5 h-[80%] mt-4 bg-emerald-500 rounded-full"></div>
                           <div className="w-1.5 h-[60%] mt-8 bg-emerald-400 rounded-full"></div>
                           <div className="w-6 h-[40%] mt-12 bg-emerald-500 rounded-full"></div>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 transform -rotate-45 opacity-50 flex gap-1.5 justify-end z-0">
                           <div className="w-6 h-[40%] mb-12 bg-emerald-500 rounded-full self-end"></div>
                           <div className="w-1.5 h-[60%] mb-8 bg-emerald-400 rounded-full self-end"></div>
                           <div className="w-3.5 h-[80%] mb-4 bg-emerald-500 rounded-full self-end"></div>
                           <div className="w-1.5 h-full bg-emerald-400 rounded-full self-end"></div>
                        </div>
                        <div className="mt-10 ml-4 relative z-10 w-28 h-28 bg-white shadow-xl p-1 rounded-sm">
                          {printUser.userPhotoUrl ? (
                            <img src={printUser.userPhotoUrl} className="w-full h-full object-cover filter contrast-125 grayscale-[20%]" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <User className="w-12 h-12 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="mt-4 ml-4 relative z-10 pr-2">
                          <h3 className="font-black text-[22px] leading-[0.9] uppercase tracking-tighter font-sans">
                             <span className="text-gray-900 block truncate">{printUser.userName.split(' ')[0]}</span>
                             <span className="text-emerald-500 block truncate">{printUser.userName.split(' ').slice(1).join(' ') || 'STAFF'}</span>
                          </h3>
                          <p className="text-[7px] font-bold text-gray-500 mt-1.5 tracking-widest uppercase truncate">{printUser.department || 'Employee'}</p>
                        </div>
                        <div className="absolute bottom-4 right-4 flex gap-1 z-10 text-[6px] text-gray-800 text-right font-medium flex-col items-end">
                           <div className="flex items-center gap-1.5 bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-emerald-100">
                             <span className="text-[5px] text-gray-400">ID</span> <span className="font-bold">{printEmployeeId}</span>
                           </div>
                           <div className="flex items-center gap-1.5 bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-emerald-100">
                             <span className="text-[5px] text-gray-400">@</span> <span className="font-bold truncate max-w-[80px]">{printUser.userEmail || 'N/A'}</span>
                           </div>
                        </div>
                    </div>

                    {/* BACK CARD */}
                    <div className="w-[2.125in] h-[3.375in] bg-gradient-to-br from-emerald-300 via-emerald-200 to-emerald-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col relative overflow-hidden shrink-0 print-card" style={{ width: '2.125in', height: '3.375in', boxSizing: 'border-box' }}>
                       <div className="flex-1 flex flex-col items-center justify-start p-4 relative z-10 w-full text-center">
                         <div className="mt-2 p-1.5 bg-white shadow-sm border-2 border-emerald-400/50 w-20 h-20 flex items-center justify-center">
                           <img src={getQrImageUrl(printUser.qrToken)} className="w-full h-full mix-blend-multiply opacity-90" style={{ filter: 'saturate(0.5)' }} />
                         </div>
                         <div className="mt-4 bg-white/90 rounded-full px-4 py-1.5 shadow-sm border border-white">
                           <h4 className="font-bold text-[7px] text-emerald-800 uppercase tracking-widest">Terms & Conditions</h4>
                         </div>
                         <p className="text-[5px] text-gray-700 mt-2.5 leading-snug font-medium px-2">{printTerms}</p>

                         {/* Logo Without Background */}
                         <div className="mt-6 flex items-center justify-center w-full px-4">
                           {currentLogo ? (
                             <img src={currentLogo} alt="Logo" className="h-10 w-auto object-contain opacity-90 mix-blend-multiply" style={{ maxWidth: '1.5in' }} />
                           ) : (
                             <Shield className="w-8 h-8 text-emerald-700/30" />
                           )}
                         </div>

                         <div className="bg-gray-900 w-full py-2 shadow-lg mt-auto">
                           <p className="text-[6px] text-emerald-400 font-black tracking-[0.2em] uppercase truncate px-3 text-center">{printCompanyName}</p>
                         </div>
                         <div className="mt-2 w-full grid grid-cols-2 gap-2 text-left pt-2 border-t border-emerald-500/20">
                           <div className="flex items-start gap-1">
                             <div className="mt-0.5 rounded-full bg-emerald-600 p-0.5 shadow-sm"><div className="w-1 h-1 bg-white rounded-full"></div></div>
                             <div>
                               <p className="text-[4px] font-bold text-emerald-800 uppercase leading-none">Joined</p>
                               <p className="text-[5px] font-bold text-gray-800 mt-0.5">{new Date(printUser.createdAt).toLocaleDateString()}</p>
                             </div>
                           </div>
                           <div className="flex items-start gap-1">
                             <div className="mt-0.5 rounded-full bg-emerald-600 p-0.5 shadow-sm"><div className="w-1 h-1 bg-white rounded-full"></div></div>
                             <div>
                               <p className="text-[4px] font-bold text-emerald-800 uppercase leading-none">Blood Grp</p>
                               <p className="text-[5px] font-bold text-gray-800 mt-0.5 truncate max-w-[30px]">{printBloodGroup}</p>
                             </div>
                           </div>
                           <div className="flex items-start gap-1 col-span-2 mt-0.5">
                             <div className="mt-0.5 rounded-full bg-emerald-600 p-0.5 shadow-sm"><div className="w-1 h-1 bg-white rounded-full"></div></div>
                             <div>
                               <p className="text-[4px] font-bold text-emerald-800 uppercase leading-none">Address</p>
                               <p className="text-[4.5px] font-bold text-gray-800 leading-[1.2] whitespace-pre-line mt-0.5 max-h-[16px] overflow-hidden">{printAddress}</p>
                             </div>
                           </div>
                         </div>
                       </div>
                    </div>
                  </div>
                  
                  <div className="mt-12 text-center text-[10px] text-muted font-medium uppercase tracking-[0.2em] opacity-40">
                    Paradigm Security Systems • Professional Series
                  </div>
                </div>
              </div>
              
              <style>{`
                @keyframes shimmer {
                  100% { transform: translateX(100%); }
                }

                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.1); }

                @media print {
                  body * { visibility: hidden !important; }
                  #printable-id-card-container, #printable-id-card-container * { visibility: visible !important; }
                  #printable-id-card-container { 
                    position: absolute !important; 
                    left: 0 !important; 
                    top: 0 !important; 
                    width: auto !important; 
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                    display: flex !important;
                    flex-direction: row !important;
                    justify-content: flex-start !important;
                    align-items: flex-start !important;
                    gap: 10px !important;
                    border: none !important;
                    box-shadow: none !important;
                  }
                  .print-card {
                    border: 1px dashed #ccc !important;
                    box-shadow: none !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    page-break-inside: avoid !important;
                    margin: 0 !important;
                  }
                  .print-hide { display: none !important; }
                }
              `}</style>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RegisterGateUser;
