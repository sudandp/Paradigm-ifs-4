/**
 * RegisterGateUser.tsx — Admin page to register users for gate attendance
 * Generates QR code and optional passcode.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import {
  registerGateUser, fetchAllGateUsers, deleteGateUser, uploadGatePhoto,
  createGateOnlyUser, resolvePhotoUrl
} from '../../services/gateApi';
import type { GateUser } from '../../types/gate';
import { useLogoStore } from '../../store/logoStore';
import {
  ArrowLeft, QrCode, User, UserPlus, Trash2, CheckCircle2,
  Loader2, Search, Printer, X, Clock, Hash, Shield,
  Building2, Droplets, MapPin, ShieldCheck, CreditCard, Sparkles, Camera,
  Phone, Users
} from 'lucide-react';
import CameraCaptureModal from '../../components/CameraCaptureModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { isAdmin as checkIsAdmin } from '../../utils/auth';
import { api } from '../../services/api';
import type { Role } from '../../types';

const RegisterGateUser: React.FC = () => {
  const navigate = useNavigate();
  const { currentLogo } = useLogoStore();
  const { user: currentUser } = useAuthStore();
  
  // ─── RBAC: Ensure only Admin and Security roles can access ───
  useEffect(() => {
    if (!currentUser) return;
    
    const role = (currentUser.role || '').toLowerCase();
    const isSecurity = role.includes('security');
    const isAdmin = checkIsAdmin(currentUser.role);
    
    if (!isAdmin && !isSecurity) {
      console.warn('[RegisterGateUser] Unauthorized access attempt by:', currentUser.email);
      navigate('/forbidden', { replace: true });
    }
  }, [currentUser, navigate]);

  const [users, setUsers] = useState<GateUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showForm, setShowForm] = useState(false);
  const [registering, setRegistering] = useState(false);
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [registeredUser, setRegisteredUser] = useState<GateUser | null>(null);

  // Print ID Card state
  const [printUser, setPrintUser] = useState<GateUser | null>(null);
  const [selectedUserQr, setSelectedUserQr] = useState<GateUser | null>(null);
  const [printCompanyName, setPrintCompanyName] = useState('PARADIGM OFFICE');
  const [printTerms, setPrintTerms] = useState('1. This card is property of the company.\n2. Loss must be reported immediately.\n3. Return upon termination of employment.');
  const [printAddress, setPrintAddress] = useState('Plot No. 42, Knowledge Park III,\nGreater Noida, UP - 201310');
  const [printEmployeeId, setPrintEmployeeId] = useState('');
  const [printBloodGroup, setPrintBloodGroup] = useState('O+ POSITIVE');
  
  // Registration Photo State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // ─── New Person (Gate-Only) Registration State ───
  const [regMode, setRegMode] = useState<'existing' | 'new'>('existing');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDepartment, setNewDepartment] = useState('General');
  const [availableDepartments, setAvailableDepartments] = useState<{id: string, label: string}[]>([]);
  
  // New Hierarchical Fields
  const [selectedRole, setSelectedRole] = useState('gate_only');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  
  const [orgData, setOrgData] = useState<any[]>([]);

  useEffect(() => {
    if (printUser) {
      setPrintEmployeeId(printUser.userId.substring(0, 8).toUpperCase());
    }
  }, [printUser]);

  useEffect(() => {
    loadUsers();
    loadEmployees();
    loadDepartmentRoles();
    
    // Load saved ID card settings
    const savedCompany = localStorage.getItem('print_id_company');
    const savedAddress = localStorage.getItem('print_id_address');
    const savedTerms = localStorage.getItem('print_id_terms');
    const savedBlood = localStorage.getItem('print_id_blood');
    if (savedCompany) setPrintCompanyName(savedCompany);
    if (savedAddress) setPrintAddress(savedAddress);
    if (savedTerms) setPrintTerms(savedTerms);
    if (savedBlood) setPrintBloodGroup(savedBlood);
  }, []);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('print_id_company', printCompanyName);
    localStorage.setItem('print_id_address', printAddress);
    localStorage.setItem('print_id_terms', printTerms);
    localStorage.setItem('print_id_blood', printBloodGroup);
  }, [printCompanyName, printAddress, printTerms, printBloodGroup]);

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
    try {
      // 1. Load Organization Structure for the dropdowns
      const orgStructure = await api.getOrganizationStructure();
      setOrgData(orgStructure);

      // 2. Load all users for the search list
      const { data: users, error } = await supabase
        .from('users')
        .select(`
          id, name, email, photo_url,
          companies:society_id (logo_url)
        `)
        .order('name');
        
      if (error) throw error;
      setEmployees((users || []).map((u: any) => ({
        ...u,
        photo_url: resolvePhotoUrl(u.photo_url),
        companyLogoUrl: resolvePhotoUrl(u.companies?.logo_url)
      })));
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const loadDepartmentRoles = async () => {
    try {
      const [roles, designations, attendanceSettings] = await Promise.all([
        api.getRoles(),
        api.getSiteStaffDesignations(),
        api.getAttendanceSettings()
      ]);

      // Resolve roles and designations into a flat list of display names
      const mergedRoles: Role[] = [...roles];
      designations.forEach(desig => {
        if (!desig.designation) return;
        const slug = desig.designation.toLowerCase().replace(/\s+/g, '_');
        if (!mergedRoles.some(r => r.id === slug)) {
          mergedRoles.push({ id: slug, displayName: desig.designation });
        }
      });

      const mapping = attendanceSettings.missedCheckoutConfig?.roleMapping || { 
        office: ['admin', 'hr', 'finance', 'developer'], 
        field: ['field_staff', 'field_officer', 'technical_reliever'], 
        site: ['site_manager', 'security_guard', 'supervisor', 'technician', 'plumber', 'multitech', 'hvac_technician', 'plumber_carpenter'] 
      };

      const allMappedRoleIds = [
        ...(mapping.office || []),
        ...(mapping.field || []),
        ...(mapping.site || [])
      ];

      const departments = allMappedRoleIds.map(id => {
        const role = mergedRoles.find(r => r.id === id);
        return {
          id: id,
          label: role?.displayName || id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        };
      });

      // Add 'General' if not present
      if (!departments.some(d => d.label === 'General')) {
        departments.unshift({ id: 'general', label: 'General' });
      }

      // De-duplicate by label
      const uniqueDepartments = departments.filter((v, i, a) => a.findIndex(t => t.label === v.label) === i);

      setAvailableDepartments(uniqueDepartments);
      if (uniqueDepartments.length > 0) {
        setNewDepartment(uniqueDepartments[0].label);
      }
    } catch (error) {
      console.error('Failed to load department roles:', error);
      setAvailableDepartments([
        { id: 'general', label: 'General' },
        { id: 'security', label: 'Security' },
        { id: 'housekeeping', label: 'Housekeeping' }
      ]);
    }
  };


  const handleRegister = async () => {
    if (!capturedPhoto) {
      alert('Please capture a photo first');
      return;
    }

    // ─── New Person (Gate-Only) Mode ───
    if (regMode === 'new') {
      if (!newName.trim()) {
        alert('Please enter the person\'s name');
        return;
      }
      setRegistering(true);
      try {
        const fileName = `gate_new_${Date.now()}.jpg`;
        const photoUrl = await uploadGatePhoto(capturedPhoto, 'registration', fileName);

        const newUser = await createGateOnlyUser({
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          department: newDepartment,
          photoUrl,
          roleId: selectedRole,
          locationId: selectedRegion,
          societyId: selectedCompany,
          organizationId: selectedSite,
        });

        setRegisteredUser(newUser);
        setNewName('');
        setNewPhone('');
        setNewDepartment('General');
        setCapturedPhoto(null);
        setShowForm(false);
        loadUsers();
      } catch (err: any) {
        console.error('Gate-only registration failed:', err);
        alert(`Registration failed: ${err.message || 'Unknown error'}`);
      } finally {
        setRegistering(false);
      }
      return;
    }

    // ─── Existing Employee Mode ───
    if (!selectedEmployee) return;
    setRegistering(true);
    try {
      const fileName = `gate_${selectedEmployee.id}_${Date.now()}.jpg`;
      const photoUrl = await uploadGatePhoto(capturedPhoto, 'registration', fileName);

      const newUser = await registerGateUser({
        userId: selectedEmployee.id,
        photoUrl: photoUrl,
        department: 'General',
      });
      
      setRegisteredUser(newUser);
      setSelectedEmployee(null);
      setCapturedPhoto(null);
      setShowForm(false);
      loadUsers();
    } catch (err) {
      console.error('Registration failed:', err);
      alert('Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (gateUserId: string, userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This will permanently remove them from the active list.')) return;
    try {
      await deleteGateUser(gateUserId, userId);
      await loadUsers();
      alert('User deleted successfully');
    } catch (err: any) {
      console.error('Deletion failed:', err);
      alert(`FAILED TO DELETE: ${err.message || 'Unknown error'}`);
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
  ).slice(0, 20);

  const getQrImageUrl = (token: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${token}`;
  };

  const ImageWithFallback: React.FC<{ src?: string; fallbackSrc?: string | null; alt?: string; className?: string }> = ({ src, fallbackSrc, alt, className }) => {
    const [error, setError] = useState(false);
    const [fallbackError, setFallbackError] = useState(false);

    // If main image fails or is missing
    if (!src || error) {
      // If we have a company logo fallback and it hasn't failed yet
      if (fallbackSrc && !fallbackError) {
        return <img src={fallbackSrc} alt={alt} className={`${className} object-contain p-2`} onError={() => setFallbackError(true)} />;
      }
      
      // Ultimate fallback: Generic User Icon
      return (
        <div className={`${className} bg-white/5 md:bg-slate-100 flex items-center justify-center border border-white/10 md:border-slate-200`}>
          <User className="w-1/2 h-1/2 text-white/20 md:text-slate-300" />
        </div>
      );
    }

    return <img src={src} alt={alt} className={className} onError={() => setError(true)} />;
  };

  return (
    <div className="min-h-screen bg-[#011612] md:bg-slate-50 p-4 md:p-8 w-full pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10 mb-10 pb-6 border-b border-white/5 md:border-slate-200">
        <div className="flex-shrink-0">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 md:text-slate-500 hover:text-[#10b981] uppercase tracking-wider mb-2 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> BACK
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-white md:text-slate-900 tracking-tight">Gate Registration</h1>
            <span className="mt-1 px-3 py-1 rounded-full bg-[#10b981]/10 text-[10px] font-black text-[#10b981] border border-[#10b981]/20 md:bg-emerald-50 md:text-emerald-600 md:border-emerald-100 uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.1)] md:shadow-none">
              {users.length} ACTIVE
            </span>
          </div>
          <p className="text-slate-400 md:text-slate-500 text-sm font-medium mt-1">Manage employee QR & Passcode access</p>
        </div>

        <div className="lg:ml-auto flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full lg:w-auto">
          <div className="relative group flex-1 md:w-72">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#10b981] transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              placeholder="Search users..." 
              className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white/5 md:bg-white border border-white/10 md:border-slate-200 text-white md:text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-[#10b981]/50 focus:bg-white/10 md:focus:bg-white transition-all text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button onClick={() => setShowForm(true)} className="flex items-center justify-center gap-2.5 h-12 px-6 rounded-2xl bg-[#10b981] text-white shadow-lg shadow-[#10b981]/20 hover:bg-[#059669] transform active:scale-95 transition-all shrink-0">
            <UserPlus className="w-5 h-5" /> 
            <span className="font-black uppercase tracking-wider text-sm">Register New</span>
          </button>
        </div>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-[#10b981]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(u => (
            <div key={u.id} className="bg-[#022c22]/40 md:bg-white backdrop-blur-md md:backdrop-blur-none rounded-[32px] border border-white/5 md:border-slate-200 shadow-2xl md:shadow-sm hover:shadow-[#10b981]/5 md:hover:shadow-md hover:border-[#10b981]/20 md:hover:border-emerald-200 transition-all overflow-hidden group">
              <div className="p-6">
                <div className="flex gap-4 mb-6">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-tr from-[#10b981] to-emerald-400 rounded-[22px] blur opacity-20 group-hover:opacity-40 transition-opacity" />
                    <ImageWithFallback 
                      src={u.userPhotoUrl} 
                      fallbackSrc={u.companyLogoUrl}
                      className="relative w-20 h-20 rounded-[20px] object-cover border border-white/10 md:border-slate-200 bg-white" 
                    />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <h3 className="font-black text-white md:text-slate-900 text-lg tracking-tight truncate">{u.userName || 'Unknown'}</h3>
                    <p className="text-xs text-slate-400 md:text-slate-500 font-medium truncate mb-3">{u.userEmail}</p>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      {u.userEmail?.endsWith('@paradigm.local') ? (
                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 md:bg-blue-50 md:text-blue-600 md:border-blue-100 text-[10px] font-black uppercase tracking-widest">
                          GATE ONLY
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-white/5 md:bg-slate-100 text-[10px] font-black text-slate-400 md:text-slate-600 uppercase tracking-widest border border-white/5 md:border-slate-200">
                          {u.department || 'EMPLOYEE'}
                        </span>
                      )}
                      
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${
                        u.isActive 
                          ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20 md:bg-emerald-50 md:text-emerald-600 md:border-emerald-100' 
                          : 'bg-red-500/10 text-red-500 border-red-500/20 md:bg-red-50 md:text-red-600 md:border-red-100'
                      }`}>
                        {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>

                      {u.passcode && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 md:bg-amber-50 md:text-amber-600 md:border-amber-100 text-[10px] font-black flex items-center gap-1.5 tracking-widest">
                          <Hash className="w-3 h-3" /> {u.passcode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">REGISTERED</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-900">
                      {u.createdAt ? new Date(u.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : "RECENTLY"}
                    </span>
                  </div>

                  {u.photoUrl ? (
                    <div className="flex items-center justify-center gap-2 py-1">
                      <User className="w-3 h-3 text-[#10b981] md:text-emerald-500" />
                      <span className="text-[9px] font-black text-[#10b981] md:text-emerald-600 uppercase tracking-[0.2em]">Self Enrolled</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-1">
                      <Shield className="w-3 h-3 text-slate-500 md:text-slate-400" />
                      <span className="text-[9px] font-black text-slate-500 md:text-slate-500 uppercase tracking-[0.2em]">Admin Enrolled</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex px-6 py-4 bg-white/5 md:bg-slate-50 border-t border-white/5 md:border-slate-100 items-center justify-between gap-3">
                <div className="flex gap-3">
                  <button onClick={() => setPrintUser(u)} className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-900 shadow-sm border border-slate-200 hover:bg-[#10b981] hover:text-white transition-all active:scale-90 group" title="Print ID Card">
                    <Printer className="w-4.5 h-4.5" />
                  </button>
                  <button onClick={() => setSelectedUserQr(u)} className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-900 shadow-sm border border-slate-200 hover:bg-[#10b981] hover:text-white transition-all active:scale-90 group" title="View QR Code">
                    <QrCode className="w-4.5 h-4.5" />
                  </button>
                </div>
                <button onClick={() => handleDelete(u.id, u.userId)} className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-900 shadow-sm border border-slate-200 hover:bg-red-500 hover:text-white transition-all active:scale-90" title="Delete User">
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 md:bg-black/40 backdrop-blur-md md:backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#022c22] md:bg-white rounded-[40px] md:rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] md:shadow-xl border border-white/10 md:border-slate-200 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-8 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black text-white md:text-slate-900 uppercase tracking-tight">Register New User</h2>
                  <button 
                    onClick={() => { setShowForm(false); setSelectedEmployee(null); setRegMode('existing'); setCapturedPhoto(null); setNewName(''); setNewPhone(''); }}
                    className="p-3 rounded-2xl bg-white/5 md:bg-slate-100 hover:bg-white/10 md:hover:bg-slate-200 transition-colors border border-white/5 md:border-slate-200"
                  >
                    <X className="w-6 h-6 text-slate-400 md:text-slate-500" />
                  </button>
                </div>

                {/* ─── Mode Tabs ─── */}
                <div className="flex gap-2 mb-6">
                  <button 
                    onClick={() => { setRegMode('existing'); setCapturedPhoto(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${
                      regMode === 'existing' 
                        ? 'bg-[#10b981] text-white border-[#10b981] shadow-lg shadow-[#10b981]/20' 
                        : 'bg-white/5 md:bg-slate-50 text-slate-400 md:text-slate-500 border-white/10 md:border-slate-200 hover:border-[#10b981]/30'
                    }`}
                  >
                    <User className="w-4 h-4" /> Existing
                  </button>
                  <button 
                    onClick={() => { setRegMode('new'); setSelectedEmployee(null); setCapturedPhoto(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${
                      regMode === 'new' 
                        ? 'bg-[#10b981] text-white border-[#10b981] shadow-lg shadow-[#10b981]/20' 
                        : 'bg-white/5 md:bg-slate-50 text-slate-400 md:text-slate-500 border-white/10 md:border-slate-200 hover:border-[#10b981]/30'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" /> New Staff
                  </button>
                </div>

                {/* ─── New Staff Form ─── */}
                {regMode === 'new' ? (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 md:text-slate-400 ml-1">Full Name *</label>
                        <input 
                          type="text"
                          placeholder="Enter full name..."
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          className="w-full h-14 px-6 rounded-2xl bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 text-white md:text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-[#10b981]/50 focus:bg-white/10 md:focus:bg-white transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 md:text-slate-400 ml-1 flex items-center gap-1.5">
                          <Phone className="w-3 h-3" /> Phone (Optional)
                        </label>
                        <input 
                          type="tel"
                          placeholder="Mobile number..."
                          value={newPhone}
                          onChange={e => setNewPhone(e.target.value)}
                          className="w-full h-14 px-6 rounded-2xl bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 text-white md:text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-[#10b981]/50 focus:bg-white/10 md:focus:bg-white transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 md:text-slate-400 ml-1 flex items-center gap-1.5">
                          <Users className="w-3 h-3" /> Department
                        </label>
                        <select 
                          value={newDepartment}
                          onChange={e => setNewDepartment(e.target.value)}
                          className="w-full h-14 px-6 rounded-2xl bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 text-white md:text-slate-900 focus:outline-none focus:border-[#10b981]/50 transition-all font-bold appearance-none"
                        >
                          {availableDepartments.map(d => (
                            <option key={d.id} value={d.label} className="text-slate-900">{d.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* ─── Role & Org Selectors ─── */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 md:text-slate-400 ml-1">Role</label>
                          <select 
                            value={selectedRole}
                            onChange={e => setSelectedRole(e.target.value)}
                            className="w-full h-14 px-6 rounded-2xl bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 text-white md:text-slate-900 focus:outline-none focus:border-[#10b981]/50 transition-all font-bold appearance-none"
                          >
                            {availableDepartments.map(d => (
                              <option key={d.id} value={d.id} className="text-slate-900">{d.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 md:text-slate-400 ml-1">Region (Location)</label>
                          <select 
                            value={selectedRegion}
                            onChange={e => {
                              setSelectedRegion(e.target.value);
                              setSelectedCompany('');
                              setSelectedSite('');
                            }}
                            className="w-full h-14 px-6 rounded-2xl bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 text-white md:text-slate-900 focus:outline-none focus:border-[#10b981]/50 transition-all font-bold appearance-none"
                          >
                            <option value="">Select Region...</option>
                            {orgData.map(region => (
                              <option key={region.id} value={region.id} className="text-slate-900">{region.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 md:text-slate-400 ml-1">Company (Society)</label>
                          <select 
                            value={selectedCompany}
                            onChange={e => {
                              setSelectedCompany(e.target.value);
                              setSelectedSite('');
                            }}
                            disabled={!selectedRegion}
                            className="w-full h-14 px-6 rounded-2xl bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 text-white md:text-slate-900 focus:outline-none focus:border-[#10b981]/50 transition-all font-bold appearance-none disabled:opacity-50"
                          >
                            <option value="">Select Company...</option>
                            {orgData.find(r => r.id === selectedRegion)?.companies.map((company: any) => (
                              <option key={company.id} value={company.id} className="text-slate-900">{company.shortName || company.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 md:text-slate-400 ml-1">Assigned Site (Entity)</label>
                          <select 
                            value={selectedSite}
                            onChange={e => setSelectedSite(e.target.value)}
                            disabled={!selectedCompany}
                            className="w-full h-14 px-6 rounded-2xl bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 text-white md:text-slate-900 focus:outline-none focus:border-[#10b981]/50 transition-all font-bold appearance-none disabled:opacity-50"
                          >
                            <option value="">Select Site...</option>
                            {orgData.find(r => r.id === selectedRegion)?.companies.find((c: any) => c.id === selectedCompany)?.entities.map((entity: any) => (
                              <option key={entity.id} value={entity.id} className="text-slate-900">{entity.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Photo Capture Section */}
                    <div className="p-8 rounded-[40px] bg-white/5 md:bg-slate-50 border border-white/5 md:border-slate-200 space-y-5">
                       <div className="flex items-center justify-between px-2">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 md:text-slate-400">Security Photo</h4>
                          {capturedPhoto && (
                            <button 
                              onClick={() => setIsCameraOpen(true)} 
                              className="flex items-center gap-2 text-[10px] font-black text-[#10b981] uppercase tracking-widest hover:underline"
                            >
                              Retake Photo
                            </button>
                          )}
                       </div>
                       
                       {!capturedPhoto ? (
                          <button 
                            onClick={() => setIsCameraOpen(true)}
                            className="w-full aspect-video rounded-[32px] border-2 border-dashed border-white/10 md:border-slate-200 bg-white/5 md:bg-white flex flex-col items-center justify-center gap-4 hover:border-[#10b981]/50 md:hover:border-emerald-300 hover:bg-[#10b981]/5 md:hover:bg-emerald-50/50 transition-all group overflow-hidden relative"
                          >
                             <div className="absolute inset-0 bg-gradient-to-tr from-[#10b981]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                             <div className="p-5 rounded-full bg-white/5 md:bg-slate-50 group-hover:bg-[#10b981]/20 md:group-hover:bg-emerald-100 transition-all transform group-hover:scale-110">
                                <Camera className="w-10 h-10 text-white/20 md:text-slate-300 group-hover:text-[#10b981] transition-colors" />
                             </div>
                             <p className="text-xs font-black text-slate-500 md:text-slate-400 group-hover:text-white md:group-hover:text-emerald-600 uppercase tracking-[0.2em]">Click to Capture</p>
                          </button>
                       ) : (
                          <div className="relative aspect-video rounded-[32px] overflow-hidden border border-white/10 md:border-slate-200 shadow-2xl md:shadow-md">
                             <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover scale-[1.02]" />
                             <div className="absolute inset-0 bg-gradient-to-t from-[#022c22]/80 md:from-black/40 via-transparent to-transparent" />
                             <div className="absolute bottom-5 left-6 flex items-center gap-3">
                                <div className="p-1.5 rounded-lg bg-[#10b981] shadow-lg">
                                  <Sparkles className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Image Secured</span>
                             </div>
                          </div>
                       )}
                    </div>

                    <div className="space-y-4">
                      <button 
                        onClick={handleRegister}
                        disabled={registering || !capturedPhoto || !newName.trim()}
                        className={`w-full h-16 rounded-[24px] shadow-2xl md:shadow-xl flex items-center justify-center gap-4 transition-all transform active:scale-[0.98] ${
                          capturedPhoto && newName.trim()
                            ? 'bg-[#10b981] text-white shadow-[#10b981]/20 md:shadow-emerald-500/20 hover:bg-[#059669]' 
                            : 'bg-white/5 md:bg-slate-100 text-slate-600 md:text-slate-400 border border-white/5 md:border-slate-200 cursor-not-allowed'
                        }`}
                      >
                        {registering ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                        <span className="font-black text-lg uppercase tracking-tight">{registering ? 'Processing...' : 'Issue Access QR'}</span>
                      </button>
                      {(!capturedPhoto || !newName.trim()) && (
                        <p className="text-[10px] text-center text-slate-500 md:text-slate-400 font-black uppercase tracking-[0.3em]">
                          {!newName.trim() ? 'Name and photo required' : 'Photo capture required for enrollment'}
                        </p>
                      )}
                    </div>
                  </div>
                ) : !selectedEmployee ? (
                  <div className="space-y-6">
                    <div className="relative group">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-[#10b981] transition-colors" />
                      <input 
                        type="text"
                        placeholder="Search employees..."
                        className="w-full h-14 pl-14 pr-6 rounded-2xl bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200 text-white md:text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-[#10b981]/50 focus:bg-white/10 md:focus:bg-white transition-all font-bold"
                        value={empSearch}
                        onChange={e => setEmpSearch(e.target.value)}
                      />
                    </div>
                    <div className="space-y-3">
                      {filteredEmployees.map(emp => (
                        <button 
                          key={emp.id}
                          onClick={() => setSelectedEmployee(emp)}
                          className="w-full flex items-center gap-4 p-4 rounded-3xl bg-white/5 md:bg-white border border-white/5 md:border-slate-100 hover:border-[#10b981]/30 md:hover:border-emerald-200 hover:bg-[#10b981]/5 md:hover:bg-emerald-50/30 transition-all group"
                        >
                          <div className="relative">
                            <div className="absolute -inset-1 bg-[#10b981] rounded-2xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
                            <ImageWithFallback 
                              src={emp.photo_url || ''} 
                              fallbackSrc={(emp as any).companyLogoUrl}
                              className="relative w-14 h-14 rounded-2xl object-cover border border-white/10 md:border-slate-200" 
                            />
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-black text-white md:text-slate-900 group-hover:text-[#10b981] transition-colors truncate">{emp.name}</p>
                            <p className="text-xs text-slate-500 md:text-slate-500 truncate">{emp.email}</p>
                          </div>
                          <CheckCircle2 className="w-6 h-6 text-[#10b981] opacity-0 group-hover:opacity-100 transition-all" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="flex items-center gap-5 p-6 rounded-[32px] bg-white/5 md:bg-slate-50 border border-white/10 md:border-slate-200">
                      <div className="relative">
                        <ImageWithFallback 
                          src={capturedPhoto || selectedEmployee.photo_url || ''} 
                          fallbackSrc={(selectedEmployee as any).companyLogoUrl}
                          className={`w-20 h-20 rounded-2xl object-cover border-2 ${capturedPhoto ? 'border-[#10b981] shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-white/10 md:border-slate-200'}`} 
                        />
                        {capturedPhoto && (
                          <div className="absolute -top-3 -right-3 bg-[#10b981] text-white p-1.5 rounded-full shadow-lg border-2 border-[#022c22] md:border-white">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white md:text-slate-900 text-lg tracking-tight truncate">{selectedEmployee.name}</p>
                        <p className="text-xs text-slate-500 md:text-slate-500 truncate mb-2">{selectedEmployee.email}</p>
                        <button onClick={() => { setSelectedEmployee(null); setCapturedPhoto(null); }} className="px-3 py-1.5 rounded-lg bg-white/5 md:bg-slate-100 text-[10px] font-black text-[#10b981] uppercase tracking-[0.2em] hover:bg-[#10b981]/10 md:hover:bg-emerald-50 transition-all">Change Employee</button>
                      </div>
                    </div>

                    {/* Photo Capture Section */}
                    <div className="p-8 rounded-[40px] bg-white/5 md:bg-slate-50 border border-white/5 md:border-slate-200 space-y-5">
                       <div className="flex items-center justify-between px-2">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 md:text-slate-400">Security Photo</h4>
                          {capturedPhoto && (
                            <button 
                              onClick={() => setIsCameraOpen(true)} 
                              className="flex items-center gap-2 text-[10px] font-black text-[#10b981] uppercase tracking-widest hover:underline"
                            >
                              Retake Photo
                            </button>
                          )}
                       </div>
                       
                       {!capturedPhoto ? (
                          <button 
                            onClick={() => setIsCameraOpen(true)}
                            className="w-full aspect-video rounded-[32px] border-2 border-dashed border-white/10 md:border-slate-200 bg-white/5 md:bg-white flex flex-col items-center justify-center gap-4 hover:border-[#10b981]/50 md:hover:border-emerald-300 hover:bg-[#10b981]/5 md:hover:bg-emerald-50/50 transition-all group overflow-hidden relative"
                          >
                             <div className="absolute inset-0 bg-gradient-to-tr from-[#10b981]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                             <div className="p-5 rounded-full bg-white/5 md:bg-slate-50 group-hover:bg-[#10b981]/20 md:group-hover:bg-emerald-100 transition-all transform group-hover:scale-110">
                                <Camera className="w-10 h-10 text-white/20 md:text-slate-300 group-hover:text-[#10b981] transition-colors" />
                             </div>
                             <p className="text-xs font-black text-slate-500 md:text-slate-400 group-hover:text-white md:group-hover:text-emerald-600 uppercase tracking-[0.2em]">Click to Capture</p>
                          </button>
                       ) : (
                          <div className="relative aspect-video rounded-[32px] overflow-hidden border border-white/10 md:border-slate-200 shadow-2xl md:shadow-md">
                             <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover scale-[1.02]" />
                             <div className="absolute inset-0 bg-gradient-to-t from-[#022c22]/80 md:from-black/40 via-transparent to-transparent" />
                             <div className="absolute bottom-5 left-6 flex items-center gap-3">
                                <div className="p-1.5 rounded-lg bg-[#10b981] shadow-lg">
                                  <Sparkles className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Image Secured</span>
                             </div>
                          </div>
                       )}
                    </div>

                    <div className="space-y-4">
                      <button 
                        onClick={handleRegister}
                        disabled={registering || !capturedPhoto}
                        className={`w-full h-16 rounded-[24px] shadow-2xl md:shadow-xl flex items-center justify-center gap-4 transition-all transform active:scale-[0.98] ${
                          capturedPhoto 
                            ? 'bg-[#10b981] text-white shadow-[#10b981]/20 md:shadow-emerald-500/20 hover:bg-[#059669]' 
                            : 'bg-white/5 md:bg-slate-100 text-slate-600 md:text-slate-400 border border-white/5 md:border-slate-200 cursor-not-allowed'
                        }`}
                      >
                        {registering ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                        <span className="font-black text-lg uppercase tracking-tight">{registering ? 'Processing...' : 'Issue Access QR'}</span>
                      </button>
                      {!capturedPhoto && (
                        <p className="text-[10px] text-center text-slate-500 md:text-slate-400 font-black uppercase tracking-[0.3em]">
                          Photo capture required for enrollment
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {registeredUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 md:bg-black/40 backdrop-blur-md md:backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#022c22] md:bg-white rounded-[40px] md:rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] md:shadow-2xl border border-white/10 md:border-slate-200 w-full max-w-sm overflow-hidden"
            >
              <div className="p-10 text-center">
                <div className="w-24 h-24 rounded-full bg-[#10b981]/10 md:bg-emerald-50 flex items-center justify-center mx-auto mb-8 border border-[#10b981]/20 md:border-emerald-100">
                  <CheckCircle2 className="w-12 h-12 text-[#10b981] md:text-emerald-600" />
                </div>
                <h3 className="text-2xl font-black text-white md:text-slate-900 uppercase tracking-tight mb-3">Registration Successful</h3>
                <p className="text-slate-400 md:text-slate-500 text-sm font-medium mb-10 tracking-tight leading-relaxed">
                  Identity verified. Access QR and Passcode are now active for gate enrollment.
                </p>
                
                <div className="p-8 bg-white/5 md:bg-slate-50 rounded-[32px] md:rounded-2xl border border-white/5 md:border-slate-200 mb-10 flex flex-col items-center">
                  <div className="p-3 bg-white rounded-2xl shadow-2xl md:shadow-md mb-6 border border-slate-100">
                    <img src={getQrImageUrl(registeredUser.qrToken)} alt="QR" className="w-40 h-40" />
                  </div>
                  <div className="flex items-center gap-3 px-6 py-3 bg-white/5 md:bg-white rounded-2xl border border-white/10 md:border-slate-200 shadow-sm">
                    <Hash className="w-5 h-5 text-[#10b981] md:text-emerald-600" />
                    <span className="font-black text-2xl text-white md:text-slate-900 tracking-[0.3em]">{registeredUser.passcode}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setPrintUser(registeredUser)} 
                    className="h-14 rounded-2xl bg-white md:bg-slate-100 text-slate-900 md:text-slate-700 border border-slate-200 font-black uppercase text-xs tracking-widest hover:bg-[#10b981] md:hover:bg-emerald-50 hover:text-white md:hover:text-emerald-600 transition-all shadow-lg md:shadow-sm flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4.5 h-4.5" /> Print Card
                  </button>
                  <button 
                    onClick={() => setRegisteredUser(null)} 
                    className="h-14 rounded-2xl bg-[#10b981] text-white font-black uppercase text-xs tracking-widest hover:bg-[#059669] transition-all shadow-lg shadow-[#10b981]/20 md:shadow-emerald-500/10"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedUserQr && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
             {/* Backdrop click to close */}
             <div className="absolute inset-0" onClick={() => setSelectedUserQr(null)} />
             
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative w-full max-w-sm bg-[#f8fafc] rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden"
             >
                <div className="p-10 pt-12 text-center">
                   {/* Employee Profile Header */}
                   <div className="flex flex-col items-center mb-10">
                     <div className="relative mb-5">
                       <div className="absolute -inset-1.5 bg-gradient-to-tr from-[#10b981] to-emerald-400 rounded-full blur opacity-20" />
                       {selectedUserQr.userPhotoUrl ? (
                         <img 
                           src={selectedUserQr.userPhotoUrl} 
                           alt="" 
                           className="relative w-24 h-24 rounded-full object-cover border-4 border-white shadow-2xl"
                         />
                       ) : (
                         <div className="relative w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center border-4 border-white shadow-2xl">
                           <User className="w-10 h-10 text-slate-300" />
                         </div>
                       )}
                     </div>
                     <h2 className="text-2xl font-black text-[#0f172a] uppercase tracking-tight leading-tight px-4 break-words">
                       {selectedUserQr.userName}
                     </h2>
                     <p className="text-[10px] font-black text-[#10b981] uppercase tracking-[0.4em] mt-2">
                       {selectedUserQr.department || 'Employee Identity'}
                     </p>
                   </div>

                   <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm mb-10 flex flex-col items-center">
                      <div className="relative mb-8">
                        <div className="absolute -inset-4 bg-emerald-500/5 rounded-[40px] blur-xl" />
                        <div className="relative bg-white p-4 rounded-2xl shadow-xl border border-slate-50">
                           <img 
                             src={getQrImageUrl(selectedUserQr.qrToken)} 
                             alt="Access QR" 
                             className="w-40 h-40"
                           />
                        </div>
                      </div>

                      <div className="bg-white rounded-full px-8 py-4 shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-4">
                         <span className="text-[#10b981] text-2xl font-black">#</span>
                         <span className="text-3xl font-black text-[#0f172a] tracking-[0.2em]">{selectedUserQr.passcode}</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                     <button 
                       onClick={() => { setPrintUser(selectedUserQr); setSelectedUserQr(null); }}
                       className="h-14 bg-white text-slate-700 border border-slate-200 rounded-2xl font-black uppercase tracking-widest text-xs shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                     >
                       <Printer className="w-4.5 h-4.5" /> Print
                     </button>
                     <button 
                       onClick={() => setSelectedUserQr(null)}
                       className="h-14 bg-[#10b981] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/20 hover:bg-[#059669] transition-all"
                     >
                       Done
                     </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {printUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          >
            {/* Glass Backdrop */}
            <div 
              className="absolute inset-0 bg-[#011612]/90 md:bg-slate-900/60 backdrop-blur-md" 
              onClick={() => setPrintUser(null)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="relative max-w-5xl w-full h-[90vh] bg-[#022c22] md:bg-gray-50/80 backdrop-blur-2xl rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] md:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-white/10 md:border-white/50 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-8 border-b border-white/5 md:border-gray-200/50 bg-black/20 md:bg-white/50 no-print">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-accent/10 text-accent">
                    <Printer className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white md:text-slate-900 leading-none">Print Identity Terminal</h2>
                    <p className="text-[10px] font-bold text-slate-400 md:text-muted uppercase tracking-[0.2em] mt-1">Personalize & Issue Credentials</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPrintUser(null)}
                  className="p-3 rounded-2xl bg-white/5 md:bg-white shadow-sm border border-white/5 md:border-gray-100 hover:bg-white/10 md:hover:bg-gray-50 transition-all active:scale-95 group"
                >
                  <X className="w-6 h-6 text-slate-400 group-hover:text-white md:group-hover:text-slate-900 transition-colors" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-10 no-print">
                <div className="flex flex-col gap-10">
                  
                  {/* Top: Interactive Editor */}
                  <div className="space-y-6 no-print bg-white/5 md:bg-white rounded-3xl p-6 md:p-8 border border-white/5 md:border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#10b981]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#10b981]">Card Parameters</span>
                      </div>
                      <button 
                        onClick={() => window.print()} 
                        className="flex items-center gap-2 px-6 py-3 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                      >
                        <Printer className="w-4 h-4" /> Print ID
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2 ml-1">
                          <Building2 className="w-3 h-3" /> Company
                        </label>
                        <input 
                          value={printCompanyName} 
                          onChange={e => setPrintCompanyName(e.target.value)} 
                          className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:ring-4 focus:ring-[#10b981]/5 transition-all outline-none font-bold text-slate-900 shadow-sm text-xs" 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2 ml-1">
                          <Droplets className="w-3 h-3" /> Blood Group
                        </label>
                        <input 
                          value={printBloodGroup} 
                          onChange={e => setPrintBloodGroup(e.target.value)} 
                          className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:ring-4 focus:ring-[#10b981]/5 transition-all outline-none font-bold text-slate-900 shadow-sm text-xs" 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2 ml-1">
                          <MapPin className="w-3 h-3" /> Location
                        </label>
                        <input 
                          value={printAddress} 
                          onChange={e => setPrintAddress(e.target.value)} 
                          className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:ring-4 focus:ring-[#10b981]/5 transition-all outline-none font-bold text-slate-900 shadow-sm text-xs" 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2 ml-1">
                          <ShieldCheck className="w-3 h-3" /> Terms
                        </label>
                        <input 
                          value={printTerms} 
                          onChange={e => setPrintTerms(e.target.value)} 
                          className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:ring-4 focus:ring-[#10b981]/5 transition-all outline-none font-medium text-slate-600 shadow-sm text-[10px]" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Side-by-Side Live Card Preview */}
                  <div className="flex flex-col lg:flex-row items-center justify-center gap-12 py-10 scale-[0.8] lg:scale-95 xl:scale-100 origin-top">
                           {/* Front Perspective */}
                    <div className="group relative">
                      <div className="absolute -inset-4 bg-emerald-500/5 rounded-[50px] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="id-card-front w-[320px] h-[500px] bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden relative flex flex-col transition-transform duration-500 hover:rotate-y-12">
                        {/* Mint Header Gradient */}
                        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#dcfce7] to-white" />
                        
                        {/* Decorative Stripes - Top Left */}
                        <div className="absolute top-10 -left-6 w-32 h-20 rotate-45 flex flex-col gap-2 opacity-40">
                          <div className="h-2 w-full bg-[#10b981]" />
                          <div className="h-2 w-full bg-[#10b981]" />
                          <div className="h-2 w-full bg-[#10b981]" />
                        </div>

                        {/* Decorative Stripes - Bottom Right */}
                        <div className="absolute bottom-10 -right-6 w-32 h-20 rotate-45 flex flex-col gap-2 opacity-40">
                          <div className="h-3 w-full bg-[#10b981] rounded-full" />
                          <div className="h-3 w-full bg-[#10b981] rounded-full" />
                          <div className="h-3 w-full bg-[#10b981] rounded-full" />
                        </div>
                        
                        <div className="relative z-10 p-8 flex flex-col h-full">
                          {/* Photo Section */}
                          <div className="relative mb-6">
                            <div className="w-32 h-32 bg-white rounded-lg overflow-hidden border-4 border-white shadow-2xl">
                              <img src={printUser.userPhotoUrl || ''} alt="" className="w-full h-full object-cover" />
                            </div>
                          </div>

                          {/* User Details */}
                          <div className="space-y-0.5 mb-8">
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">
                              {printUser.userName?.split(' ')[0]}
                            </h1>
                            {printUser.userName?.split(' ').slice(1).map((part, i) => (
                              <h1 key={i} className="text-3xl font-black text-[#10b981] uppercase tracking-tight leading-none">
                                {part}
                              </h1>
                            ))}
                            <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase pt-2">Employee</p>
                          </div>

                          {/* Footer Badges */}
                          <div className="mt-auto flex flex-col items-end gap-3">
                            <div className="px-4 py-1.5 bg-white rounded-full shadow-lg border border-slate-50 flex items-center gap-2">
                              <span className="text-[8px] font-black text-slate-300 uppercase">ID</span>
                              <span className="text-[9px] font-black text-slate-700 tracking-wider">{printEmployeeId}</span>
                            </div>
                            <div className="px-4 py-1.5 bg-white rounded-full shadow-lg border border-slate-50 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                              <span className="text-[9px] font-black text-slate-700 tracking-wider lowercase">{printUser.userEmail}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20">Card Front</div>
                    </div>
                     {/* Back Perspective */}
                    <div className="group relative">
                      <div className="id-card-back w-[320px] h-[500px] bg-[#dcfce7] rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden relative flex flex-col transition-transform duration-500 hover:rotate-y-12">
                        {/* Mint Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#dcfce7] via-[#f0fdf4] to-[#dcfce7]" />
                        
                        <div className="relative z-10 p-8 flex flex-col h-full">
                          {/* QR Section */}
                          <div className="bg-white p-3 rounded-2xl shadow-xl self-center mb-6">
                            <img src={getQrImageUrl(printUser.qrToken)} alt="QR" className="w-28 h-28" />
                          </div>

                          {/* Terms Section */}
                          <div className="text-center space-y-4 mb-6">
                            <div className="inline-flex px-8 py-2.5 bg-white rounded-full shadow-md">
                              <span className="text-[10px] font-black text-[#065f46] uppercase tracking-[0.2em]">Terms & Conditions</span>
                            </div>
                            <p className="text-[8px] text-slate-500 leading-tight font-medium px-4">
                              {printTerms}
                            </p>
                          </div>

                          {/* Logo Area */}
                          <div className="flex items-center justify-center mb-6">
                            <img src={currentLogo || ''} alt="Logo" className="h-8 object-contain" />
                          </div>

                          {/* Dark Office Bar */}
                          <div className="bg-[#0f172a] py-3 text-center mb-6 shadow-xl">
                            <span className="text-[10px] font-black text-[#10b981] uppercase tracking-[0.4em]">{printCompanyName}</span>
                          </div>

                          {/* Metadata Grid */}
                          <div className="mt-auto space-y-3 px-2">
                            <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full border-2 border-[#10b981]" />
                              <div>
                                <span className="text-[7px] font-bold text-slate-400 uppercase block leading-none">JOINED</span>
                                <span className="text-[9px] font-black text-slate-700">
                                  {printUser.createdAt ? new Date(printUser.createdAt).toLocaleDateString('en-IN') : '12/05/2026'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full border-2 border-[#10b981]" />
                              <div>
                                <span className="text-[7px] font-bold text-slate-400 uppercase block leading-none">BLOOD GRP</span>
                                <span className="text-[9px] font-black text-slate-700 uppercase">{printBloodGroup}</span>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-2.5 h-2.5 rounded-full border-2 border-[#10b981] mt-1" />
                              <div className="flex-1">
                                <span className="text-[7px] font-bold text-slate-400 uppercase block leading-none mb-1">ADDRESS</span>
                                <span className="text-[8px] font-semibold text-slate-600 leading-tight block">{printAddress}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-[#10b981] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20">Card Back</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                .no-print { display: none !important; }
                body { margin: 0; padding: 0; background: white !important; }
                .id-card-front, .id-card-back { 
                  page-break-after: always;
                  box-shadow: none !important;
                  border: 1px solid #000 !important;
                  margin: 0 auto !important;
                  transform: none !important;
                }
                .id-card-back { background: #dcfce7 !important; }
                .id-card-back * { color: #334155 !important; }
                .id-card-back .bg-[#0f172a] { background: #0f172a !important; }
                .id-card-back .bg-[#0f172a] * { color: #10b981 !important; }
                .id-card-back .bg-white { background: #ffffff !important; }
                .id-card-front .bg-[#10b981] { background: #10b981 !important; }
              }
              .rotate-y-12 {
                transform: perspective(1000px) rotateY(5deg);
              }
            ` }} />
          </motion.div>
        )}
      </AnimatePresence>

      <CameraCaptureModal 
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(base64) => {
          setCapturedPhoto(base64);
          setIsCameraOpen(false);
        }}
      />
    </div>
  );
};

export default RegisterGateUser;
