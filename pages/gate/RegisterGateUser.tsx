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
  Loader2, Search, Download, RefreshCw, Shield, AlertTriangle, Printer, X
} from 'lucide-react';

const RegisterGateUser: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [gateUsers, setGateUsers] = useState<GateUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Registration form
  const [showForm, setShowForm] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [department, setDepartment] = useState('');
  const [registering, setRegistering] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [printUser, setPrintUser] = useState<GateUser | null>(null);
  const [printBloodGroup, setPrintBloodGroup] = useState<string>('B+ Positive');
  const [printCompanyName, setPrintCompanyName] = useState<string>(
    () => localStorage.getItem('printCompanyName') || 'PARADIGM SERVICES'
  );
  const [printTerms, setPrintTerms] = useState<string>(
    () => localStorage.getItem('printTerms') || 'This card is property of Paradigm Services. If found, please return to the office address.'
  );
  const [printAddress, setPrintAddress] = useState<string>(
    () => localStorage.getItem('printAddress') || 'Paradigm Services\n123 Business Road'
  );
  
  const currentLogo = useLogoStore(state => state.currentLogo);

  useEffect(() => {
    localStorage.setItem('printCompanyName', printCompanyName);
  }, [printCompanyName]);
  
  useEffect(() => {
    localStorage.setItem('printTerms', printTerms);
  }, [printTerms]);
  
  useEffect(() => {
    localStorage.setItem('printAddress', printAddress);
  }, [printAddress]);

  // Load face-api.js
  useEffect(() => {
    (async () => {
      try {
        const faceapi = await import('face-api.js');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        setFaceApiLoaded(true);
      } catch (err) {
        console.error('Failed to load face-api models:', err);
      }
    })();
  }, []);

  // Fetch registered gate users
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const users = await fetchAllGateUsers();
      setGateUsers(users);
    } catch (err) {
      console.error('Failed to load gate users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // Fetch available employees for registration
  useEffect(() => {
    if (!showForm) return;
    (async () => {
      try {
        const { data, error } = await supabase.from('users').select('id, name, email, photo_url, role_id').neq('role_id', 'unverified').order('name');
        if (error) throw error;
        setEmployees(data || []);
      } catch (err) {
        console.error('Error fetching employees for gate registration:', err);
      }
    })();
  }, [showForm]);

  // Camera controls
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error('Camera error:', err);
      setMessage({ text: 'Camera access denied', type: 'error' });
    }
  };

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => console.error('Error playing video:', err));
    }
  }, [cameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => () => stopCamera(), []);

  // Capture photo and compute descriptor
  const captureAndCompute = async () => {
    if (!videoRef.current || !canvasRef.current || !faceApiLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);
    stopCamera();

    // Compute face descriptor
    try {
      const faceapi = await import('face-api.js');
      const img = await faceapi.fetchImage(dataUrl);
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (detection) {
        setFaceDescriptor(Array.from(detection.descriptor));
        setMessage({ text: 'Face detected successfully!', type: 'success' });
      } else {
        setFaceDescriptor(null);
        setMessage({ text: 'No face detected. Please retake photo with face clearly visible.', type: 'error' });
      }
    } catch (err) {
      console.error('Face descriptor error:', err);
      setFaceDescriptor(null);
      setMessage({ text: 'Failed to compute face descriptor', type: 'error' });
    }
  };

  // Register user
  const handleRegister = async () => {
    if (!selectedEmployee) return;
    setRegistering(true);
    setMessage(null);

    try {
      let photoUrl: string | undefined;
      if (capturedPhoto) {
        const b64 = capturedPhoto.split(',')[1];
        photoUrl = await uploadGatePhoto(b64, 'registration', `${selectedEmployee.id}.jpg`);
      }

      await registerGateUser({
        userId: selectedEmployee.id,
        faceDescriptor,
        photoUrl,
        department,
      });

      setMessage({ text: `${selectedEmployee.name} registered successfully!`, type: 'success' });
      setCapturedPhoto(null);
      setFaceDescriptor(null);
      setSelectedEmployee(null);
      setEmpSearch('');
      setDepartment('');
      setShowForm(false);
      loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message || 'Registration failed', type: 'error' });
    } finally {
      setRegistering(false);
    }
  };

  // Deactivate user
  const handleDeactivate = async (user: GateUser) => {
    if (!confirm(`Remove ${user.userName} from gate attendance?`)) return;
    try {
      await deactivateGateUser(user.id);
      loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  // Generate QR code image URL (using a public API for simplicity)
  const getQrImageUrl = (token: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(token)}&bgcolor=ffffff&color=052e16`;

  // Filter
  const filtered = gateUsers.filter((u) =>
    (u.userName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.department || '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredEmps = empSearch.length >= 2
    ? employees.filter((e) =>
        e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.email.toLowerCase().includes(empSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 md:px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-primary-text">Gate User Registration</h1>
          <p className="text-xs text-muted">{gateUsers.length} users registered</p>
        </div>
        <button onClick={() => { setShowForm(true); setMessage(null); }}
          className="btn btn-md btn-primary flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Register
        </button>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`mx-4 md:mx-6 mt-4 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="p-4 md:p-6">
        {/* Search */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center bg-white p-3 md:p-5 rounded-3xl border border-border shadow-sm max-md:bg-[#0d2c18]/40 max-md:border-white/5 max-md:shadow-2xl mb-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted group-focus-within:text-accent transition-colors max-md:text-white/20" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search registered users..."
              className="w-full h-11 md:h-12 bg-page border border-border rounded-2xl pl-11 md:pl-12 pr-4 text-sm md:text-base text-primary-text placeholder:text-muted focus:ring-2 focus:ring-accent/20 outline-none transition-all max-md:bg-white/[0.05] max-md:border-transparent max-md:text-white max-md:placeholder:text-white/20 max-md:focus:bg-white/[0.08]"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted text-sm">No registered users found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((u) => (
              <div key={u.id} className="bg-card rounded-2xl border border-border p-4 shadow-card hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  {u.userPhotoUrl
                    ? <img src={u.userPhotoUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-accent/20" />
                    : <div className="w-12 h-12 rounded-full bg-accent-light flex items-center justify-center"><User className="w-6 h-6 text-accent" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary-text text-sm truncate">{u.userName}</p>
                    <p className="text-xs text-muted truncate">{u.department || u.userEmail}</p>
                  </div>
                  <button onClick={() => setPrintUser(u)} className="p-2 rounded-lg hover:bg-emerald-50 transition-colors" title="Print ID Card">
                    <Printer className="w-4 h-4 text-emerald-600" />
                  </button>
                  <button onClick={() => handleDeactivate(u)} className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Remove">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className={`w-2 h-2 rounded-full ${u.faceDescriptor ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    <span className="text-muted">Face {u.faceDescriptor ? '✓' : '✗'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <QrCode className="w-3 h-3 text-muted" />
                    <span className="text-muted font-mono">{u.qrToken}</span>
                  </div>
                </div>
                {/* QR Code preview */}
                <div className="mt-4 flex justify-center">
                  <div className="p-3.5 bg-[#f0fdf4] border border-emerald-500/10 rounded-2xl shadow-inner hover:scale-105 hover:shadow-sm transition-all duration-300">
                    <img src={getQrImageUrl(u.qrToken)} alt="QR" className="w-24 h-24 rounded-lg mix-blend-multiply" loading="lazy" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Registration Modal ──────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-3xl shadow-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-primary-text">Register New User</h2>
                <button onClick={() => { setShowForm(false); stopCamera(); setCapturedPhoto(null); setFaceDescriptor(null); setSelectedEmployee(null); }}
                  className="p-2 rounded-xl hover:bg-gray-100">✕</button>
              </div>

              {/* Employee Search */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-muted uppercase mb-1 block">Select Employee</label>
                <input type="text" value={empSearch}
                  onChange={(e) => { setEmpSearch(e.target.value); setSelectedEmployee(null); }}
                  placeholder="Search by name or email..."
                  className="form-input" />
                {filteredEmps.length > 0 && !selectedEmployee && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                    {filteredEmps.map((e) => (
                      <button key={e.id} onClick={() => { setSelectedEmployee(e); setEmpSearch(e.name); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left text-sm">
                        {e.photo_url ? <img src={e.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" /> : <User className="w-8 h-8 p-1.5 text-muted" />}
                        <div><p className="font-medium text-primary-text">{e.name}</p><p className="text-xs text-muted">{e.email}</p></div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedEmployee && (
                  <div className="mt-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-emerald-700">{selectedEmployee.name} selected</span>
                  </div>
                )}
              </div>

              {/* Department */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-muted uppercase mb-1 block">Department (Optional)</label>
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Security, IT, Admin"
                  className="form-input" />
              </div>

              {/* Face Capture */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-muted uppercase mb-2 block">Face Photo</label>
                {capturedPhoto ? (
                  <div className="relative">
                    <img src={capturedPhoto} alt="Captured" className="w-full rounded-2xl border border-border" />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <button onClick={() => { setCapturedPhoto(null); setFaceDescriptor(null); startCamera(); }}
                        className="p-2 rounded-full bg-white/90 shadow hover:bg-white"><RefreshCw className="w-4 h-4 text-muted" /></button>
                    </div>
                    {faceDescriptor && (
                      <div className="absolute bottom-2 left-2 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Face Detected
                      </div>
                    )}
                  </div>
                ) : cameraActive ? (
                  <div className="relative">
                    <video ref={videoRef} className="w-full rounded-2xl border border-border" playsInline muted autoPlay style={{ transform: 'scaleX(-1)' }} />
                    <canvas ref={canvasRef} className="hidden" />
                    <button onClick={captureAndCompute}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40 flex items-center justify-center hover:bg-emerald-400 transition-colors">
                      <Camera className="w-7 h-7 text-white" />
                    </button>
                  </div>
                ) : (
                  <button onClick={startCamera}
                    className="w-full py-12 rounded-2xl border-2 border-dashed border-border hover:border-accent/40 transition-colors flex flex-col items-center gap-2 text-muted">
                    <Camera className="w-8 h-8" />
                    <span className="text-sm font-medium">Open Camera to Capture Face</span>
                    <span className="text-xs">This step is optional but recommended</span>
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
          </div>
        </div>
      )}

      {/* ─── Print ID Card Modal ──────────────────────────────────── */}
      {printUser && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 print-hide">
          <div className="bg-card rounded-3xl shadow-xl border border-border w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-primary-text flex items-center gap-2"><Printer className="w-5 h-5"/> Print ID Card</h2>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="btn btn-primary flex items-center gap-2">
                  <Printer className="w-4 h-4" /> Print Card
                </button>
                <button onClick={() => setPrintUser(null)} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5"/></button>
              </div>
            </div>

            <div className="p-4 border-b border-border flex flex-col gap-4 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary-text">Customize ID Card Text (Auto-saves for future prints)</p>
                <p className="text-xs text-muted hidden md:block">Set page size to <strong className="text-primary-text">Custom (2.125" x 3.375")</strong> in print dialog.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Company Name</label>
                  <input type="text" value={printCompanyName} onChange={e => setPrintCompanyName(e.target.value)} className="form-input h-9 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Blood Group</label>
                  <input type="text" value={printBloodGroup} onChange={e => setPrintBloodGroup(e.target.value)} className="form-input h-9 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Terms and Conditions</label>
                  <textarea value={printTerms} onChange={e => setPrintTerms(e.target.value)} className="form-input text-xs h-16 resize-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Office Address</label>
                  <textarea value={printAddress} onChange={e => setPrintAddress(e.target.value)} className="form-input text-xs h-16 resize-none" />
                </div>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-8 items-center justify-center bg-gray-100" id="printable-id-card-container">
               {/* FRONT CARD */}
               <div className="w-[2.125in] h-[3.375in] bg-white rounded-xl shadow-md flex flex-col relative overflow-hidden shrink-0 print-card" style={{ width: '2.125in', height: '3.375in', boxSizing: 'border-box' }}>
                  {/* Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-b from-emerald-200/60 via-white to-white z-0"></div>
                  
                  {/* Geometric Shapes - Top Left */}
                  <div className="absolute -top-4 -left-8 w-32 h-32 transform -rotate-45 opacity-50 flex gap-1.5 z-0">
                     <div className="w-1.5 h-[100%] bg-emerald-400 rounded-full"></div>
                     <div className="w-3.5 h-[80%] mt-4 bg-emerald-500 rounded-full"></div>
                     <div className="w-1.5 h-[60%] mt-8 bg-emerald-400 rounded-full"></div>
                     <div className="w-6 h-[40%] mt-12 bg-emerald-500 rounded-full"></div>
                  </div>

                  {/* Geometric Shapes - Bottom Right */}
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 transform -rotate-45 opacity-50 flex gap-1.5 justify-end z-0">
                     <div className="w-6 h-[40%] mb-12 bg-emerald-500 rounded-full self-end"></div>
                     <div className="w-1.5 h-[60%] mb-8 bg-emerald-400 rounded-full self-end"></div>
                     <div className="w-3.5 h-[80%] mb-4 bg-emerald-500 rounded-full self-end"></div>
                     <div className="w-1.5 h-full bg-emerald-400 rounded-full self-end"></div>
                  </div>

                  {/* Photo Block */}
                  <div className="mt-10 ml-4 relative z-10 w-28 h-28 bg-white shadow-lg p-1">
                    {printUser.userPhotoUrl ? (
                      <img src={printUser.userPhotoUrl} className="w-full h-full object-cover filter contrast-125 grayscale-[20%]" />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <User className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Name and Details */}
                  <div className="mt-4 ml-4 relative z-10 pr-2">
                    <h3 className="font-black text-[22px] leading-[0.9] uppercase tracking-tighter font-sans">
                       <span className="text-gray-900 block truncate">{printUser.userName.split(' ')[0]}</span>
                       <span className="text-emerald-500 block truncate">{printUser.userName.split(' ').slice(1).join(' ') || 'STAFF'}</span>
                    </h3>
                    <p className="text-[7px] font-bold text-gray-500 mt-1.5 tracking-widest uppercase truncate">{printUser.department || 'Employee'}</p>
                  </div>

                  {/* Bottom Info */}
                  <div className="absolute bottom-4 right-4 flex gap-1 z-10 text-[6px] text-gray-800 text-right font-medium flex-col items-end">
                     <div className="flex items-center gap-1.5 bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-emerald-100">
                       <span className="text-[5px] text-gray-400">ID</span> <span className="font-bold">{printUser.userId.substring(0,8).toUpperCase()}</span>
                     </div>
                     <div className="flex items-center gap-1.5 bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-emerald-100">
                       <span className="text-[5px] text-gray-400">@</span> <span className="font-bold truncate max-w-[80px]">{printUser.userEmail || 'N/A'}</span>
                     </div>
                  </div>
               </div>

               {/* BACK CARD */}
               <div className="w-[2.125in] h-[3.375in] bg-gradient-to-br from-emerald-300 via-emerald-200 to-emerald-100 rounded-xl shadow-md flex flex-col relative overflow-hidden shrink-0 print-card" style={{ width: '2.125in', height: '3.375in', boxSizing: 'border-box' }}>
                  
                  <div className="flex-1 flex flex-col items-center justify-start p-4 relative z-10 w-full text-center">
                    
                    {/* QR Code in box */}
                    <div className="mt-2 p-1.5 bg-white shadow-sm border-2 border-emerald-400/50 w-20 h-20 flex items-center justify-center">
                      <img src={getQrImageUrl(printUser.qrToken)} className="w-full h-full mix-blend-multiply opacity-90" style={{ filter: 'saturate(0.5)' }} />
                    </div>
                    
                    {/* Terms Header Pill */}
                    <div className="mt-4 bg-white/90 rounded-full px-4 py-1.5 shadow-sm border border-white">
                      <h4 className="font-bold text-[7px] text-emerald-800 uppercase tracking-widest">Terms & Conditions</h4>
                    </div>
                    
                    {/* Terms Text */}
                    <p className="text-[5px] text-gray-700 mt-2.5 leading-snug font-medium px-2">{printTerms}</p>
                    
                    {/* Logo Block */}
                    <div className="mt-auto mb-2 flex flex-col items-center justify-center w-full">
                       <div className="flex items-center justify-center gap-1.5 bg-white/40 px-2 py-1.5 rounded-lg overflow-hidden" style={{ maxWidth: '90%' }}>
                         {currentLogo ? (
                            <img src={currentLogo} alt="Logo" className="h-4 w-auto object-contain shrink-0" style={{ maxWidth: '40px' }} />
                         ) : (
                            <Shield className="w-4 h-4 text-emerald-700 shrink-0" />
                         )}
                         <span className="font-black text-[7px] leading-none text-gray-900 tracking-tighter uppercase truncate" style={{ maxWidth: '80px' }}>{printCompanyName}</span>
                       </div>
                    </div>
                    
                    {/* Black bar website/company */}
                    <div className="bg-gray-900 w-full py-1.5 shadow-lg">
                      <p className="text-[5px] text-emerald-400 font-medium tracking-widest uppercase truncate px-3 text-center">{printCompanyName} PORTAL</p>
                    </div>
                    
                    {/* Bottom Footer Info (Icons + text) */}
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
          </div>
          
          <style>{`
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
              }
              .print-card {
                border: 1px dashed #ccc !important;
                box-shadow: none !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                page-break-inside: avoid !important;
                margin: 0 !important;
              }
              .print-hide { background: white !important; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default RegisterGateUser;
