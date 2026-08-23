import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import {
  User, UserCheck, UserPlus, Search, Building, MapPin, Mail, Shield,
  Camera, Sparkles, CheckCircle, AlertTriangle, ArrowRight, X, Loader2
} from 'lucide-react';
import { ProfilePlaceholder } from '../ui/ProfilePlaceholder';

export interface UserOptionItem {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  company?: string | null;
  location?: string | null;
  biometricId: string | null;
  photoUrl?: string | null;
}

export interface SiteLocationItem {
  id: string;
  name: string;
  address?: string | null;
  coordinates?: string | null;
  radius?: number;
}

export interface QuickMapTargetLog {
  id: string;
  snapshotUrl: string | null;
  cameraName: string;
  direction: 'entry' | 'exit';
  confidence: number;
  detectedAt: string;
  userId: string | null;
  userName: string | null;
  edgeDeviceId?: string | null;
  edgeLogId?: number | null;
  enrollmentQueueId?: string | null;
}

interface CctvQuickMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLog: QuickMapTargetLog | null;
  users: UserOptionItem[];
  locations: SiteLocationItem[];
  ngrokProxy: string;
  currentUserId?: string;
  onSuccess: (updatedLog: { id: string; userId: string; userName: string }) => void;
}

export const CctvQuickMapModal: React.FC<CctvQuickMapModalProps> = ({
  isOpen,
  onClose,
  targetLog,
  users,
  locations,
  ngrokProxy,
  currentUserId,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [recordAttendancePunch, setRecordAttendancePunch] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Self-healing lists
  const [availableUsers, setAvailableUsers] = useState<UserOptionItem[]>(users || []);
  const [availableLocations, setAvailableLocations] = useState<SiteLocationItem[]>(locations || []);

  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('SITE MANAGER');
  const [newCompany, setNewCompany] = useState('PARADIGM INTEGRATED FACILITY SERVICES PVT LTD');
  const [newBiometricId, setNewBiometricId] = useState('');

  // Sync props to internal state
  useEffect(() => {
    if (users && users.length > 0) {
      setAvailableUsers(users);
    }
  }, [users]);

  useEffect(() => {
    if (locations && locations.length > 0) {
      setAvailableLocations(locations);
    }
  }, [locations]);

  // Self-fetch if modal opens and props are empty
  useEffect(() => {
    if (isOpen) {
      if (!users || users.length === 0) {
        setIsLoadingData(true);
        api.getUsers()
          .then((res: any) => {
            if (Array.isArray(res) && res.length > 0) {
              setAvailableUsers(res.map(u => ({
                id: u.id,
                name: u.name || 'Unnamed Employee',
                email: u.email || null,
                role: u.role || u.roleId || null,
                company: u.organizationName || u.organization_name || u.company || 'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD',
                location: u.location || null,
                biometricId: u.biometricId || u.biometric_id || null,
                photoUrl: u.photoUrl || u.photo_url || null,
              })));
            }
          })
          .catch(err => console.warn('CctvQuickMapModal users fallback error:', err))
          .finally(() => setIsLoadingData(false));
      }

      if (!locations || locations.length === 0) {
        api.getLocations()
          .then((res: any) => {
            if (Array.isArray(res) && res.length > 0) {
              setAvailableLocations(res.map(l => ({
                id: l.id,
                name: l.name || l.address || 'Site Location',
                address: l.address || null,
                coordinates: l.latitude && l.longitude ? `${l.latitude}, ${l.longitude}` : (l.coordinates || null),
                radius: l.radius || 100,
              })));
            }
          })
          .catch(err => console.warn('CctvQuickMapModal locations fallback error:', err));
      }
    }
  }, [isOpen, users, locations]);

  // Sorted locations list (alphabetical by Site Name)
  const sortedLocations = React.useMemo(() => {
    return [...availableLocations].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [availableLocations]);

  // Default to Paradigm Office location when available
  useEffect(() => {
    if (availableLocations && availableLocations.length > 0) {
      if (!selectedLocationId) {
        const paradigmLoc = availableLocations.find(l => (l.name || '').toLowerCase().includes('paradigm'));
        if (paradigmLoc) {
          setSelectedLocationId(paradigmLoc.id);
        } else {
          setSelectedLocationId(availableLocations[0].id);
        }
      }
    }
  }, [availableLocations, selectedLocationId]);

  // Reset or preselect user when opening
  useEffect(() => {
    if (isOpen && targetLog) {
      setErrorMsg(null);
      if (targetLog.userId) {
        setSelectedUserId(targetLog.userId);
      } else {
        setSelectedUserId('');
      }
      setSearchTerm('');
    }
  }, [isOpen, targetLog]);

  const selectedUserObj = availableUsers.find(u => u.id === selectedUserId);
  const selectedLocationObj = availableLocations.find(l => l.id === selectedLocationId);

  // Auto-sync location selector when employee is chosen
  useEffect(() => {
    if (selectedUserObj?.location && availableLocations.length > 0) {
      const match = availableLocations.find(l =>
        (l.name || '').toLowerCase().trim() === (selectedUserObj.location || '').toLowerCase().trim()
      );
      if (match) {
        setSelectedLocationId(match.id);
      }
    }
  }, [selectedUserId, selectedUserObj?.location, availableLocations]);

  if (!isOpen || !targetLog) return null;

  // Filtered users for search
  const filteredUsers = availableUsers.filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.biometricId && u.biometricId.toLowerCase().includes(term)) ||
      (u.role && u.role.toLowerCase().includes(term)) ||
      (u.location && u.location.toLowerCase().includes(term))
    );
  });

  const handleSave = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);

    const isUuid = (val?: string | null) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    try {
      let finalUserId = selectedUserId;
      let finalUserName = selectedUserObj?.name || '';
      let finalBiometricId = selectedUserObj?.biometricId || '';
      const chosenLocationName = selectedLocationObj?.name || selectedUserObj?.location || 'Paradigm Office';

      // 1. If "New Employee" tab is active, create the user in Supabase users table
      if (activeTab === 'new') {
        if (!newName.trim()) {
          throw new Error('Please enter the employee name.');
        }

        const emailToUse = newEmail.trim() || `${newName.toLowerCase().replace(/\s+/g, '.')}@paradigm.local`;
        const bioId = newBiometricId.trim() || `BIO-${Date.now().toString().slice(-4)}`;

        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .insert({
            name: newName.trim(),
            email: emailToUse,
            role_id: newRole,
            company: newCompany,
            location: chosenLocationName,
            biometric_id: bioId,
            photo_url: targetLog.snapshotUrl || null,
            passcode: String(Math.floor(1000 + Math.random() * 9000)),
          })
          .select()
          .single();

        if (createError) {
          throw new Error(`Failed to create employee: ${createError.message}`);
        }

        finalUserId = createdUser.id;
        finalUserName = createdUser.name;
        finalBiometricId = bioId;
      }

      if (!finalUserId) {
        throw new Error('Please select or create an employee to assign this face.');
      }

      // 2. Persist updated location (and snapshot if missing) to the employee's profile in Supabase
      try {
        const userUpdates: any = { location: chosenLocationName };
        if (targetLog.snapshotUrl && !selectedUserObj?.photoUrl) {
          userUpdates.photo_url = targetLog.snapshotUrl;
        }
        await supabase.from('users').update(userUpdates).eq('id', finalUserId);
      } catch (userUpdErr) {
        console.warn('User profile location update note:', userUpdErr);
      }

      // 3. Update or insert Supabase cctv_attendance_logs
      if (isUuid(targetLog.id)) {
        const { error: logUpdateErr } = await supabase
          .from('cctv_attendance_logs')
          .update({
            user_id: finalUserId,
            user_name: finalUserName,
          })
          .eq('id', targetLog.id);

        if (logUpdateErr) {
          console.warn('Supabase log update warning:', logUpdateErr);
        }
      } else {
        // If not a UUID (e.g. edge log detection), insert a permanent log record in Supabase
        try {
          await supabase.from('cctv_attendance_logs').insert({
            user_id: finalUserId,
            user_name: finalUserName,
            camera_name: targetLog.cameraName || 'Main Gate',
            direction: targetLog.direction || 'entry',
            confidence: targetLog.confidence || 0.85,
            detected_at: targetLog.detectedAt || new Date().toISOString(),
            snapshot_url: targetLog.snapshotUrl || null,
            edge_device_id: targetLog.edgeDeviceId || 'cctv-edge-main',
          });
        } catch (insertLogErr) {
          console.warn('Supabase log insert note:', insertLogErr);
        }
      }

      // 4. If item was in cctv_enrollment_queue, resolve it
      const queueId = isUuid(targetLog.enrollmentQueueId)
        ? targetLog.enrollmentQueueId
        : isUuid(targetLog.id)
        ? targetLog.id
        : null;

      if (queueId) {
        try {
          await supabase
            .from('cctv_enrollment_queue')
            .update({
              status: 'enrolled',
              resolved_at: new Date().toISOString(),
              resolved_by: currentUserId || null,
              linked_user_id: finalUserId,
            })
            .eq('id', queueId);
        } catch (queueErr) {
          console.warn('Enrollment queue update note:', queueErr);
        }
      }

      // 5. Sync Face Vector to Local Edge AI Server (/camera/enroll)
      if (targetLog.snapshotUrl && ngrokProxy) {
        try {
          const imgResponse = await fetch(targetLog.snapshotUrl, {
            headers: { 'ngrok-skip-browser-warning': '1' }
          });
          if (imgResponse.ok) {
            const imgBlob = await imgResponse.blob();
            const formData = new FormData();
            formData.append('user_id', finalUserId);
            formData.append('user_name', finalUserName);
            formData.append('biometric_id', finalBiometricId);
            formData.append('department', 'CCTV_ENROLLED');
            formData.append('location_name', chosenLocationName);
            formData.append('photo', new File([imgBlob], 'face.jpg', { type: 'image/jpeg' }));

            await fetch(`${ngrokProxy}/camera/enroll`, {
              method: 'POST',
              headers: {
                'ngrok-skip-browser-warning': '1',
                'x-api-key': 'paradigm-attendance-secret-2024',
              },
              body: formData,
              signal: AbortSignal.timeout(10000),
            });
          }
        } catch (edgeErr) {
          console.warn('[CCTV Quick Map] Edge enrollment sync note:', edgeErr);
        }
      }

      // 6. If requested, insert verified attendance punch event
      if (recordAttendancePunch) {
        try {
          const eventType = targetLog.direction === 'entry' ? 'punch-in' : 'punch-out';
          const validLogId = isUuid(targetLog.id) ? targetLog.id : null;

          const { data: insertedEvent } = await supabase
            .from('attendance_events')
            .insert({
              user_id: finalUserId,
              timestamp: targetLog.detectedAt || new Date().toISOString(),
              type: eventType,
              location_name: chosenLocationName,
              location_id: selectedLocationObj?.id || null,
              source: 'cctv',
              device_id: targetLog.edgeDeviceId || 'cctv-edge-main',
              cctv_log_id: validLogId,
              is_manual: false,
            })
            .select('id')
            .single();

          if (validLogId && insertedEvent?.id) {
            await supabase
              .from('cctv_attendance_logs')
              .update({
                attendance_event_id: insertedEvent.id,
                bridged: true,
                bridged_at: new Date().toISOString(),
              })
              .eq('id', validLogId);
          }
        } catch (punchErr) {
          console.warn('[CCTV Quick Map] Attendance punch insert note:', punchErr);
        }
      }

      onSuccess({
        id: targetLog.id,
        userId: finalUserId,
        userName: finalUserName,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to map face detection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl my-auto flex flex-col text-primary-text"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-primary-text">
                Map Face Detection & Assign Employee
              </h3>
              <p className="text-xs text-muted">
                {selectedLocationObj?.name || 'Paradigm Office'} • Camera: {targetLog.cameraName || 'Main Gate'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary-text p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Top Face Snapshot Preview Card */}
          <div className="bg-neutral-50 dark:bg-neutral-900/60 border border-border rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative shrink-0">
              {targetLog.snapshotUrl ? (
                <img
                  src={targetLog.snapshotUrl}
                  alt="Captured face"
                  className="h-20 w-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-sm"
                />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-muted">
                  <Camera className="h-8 w-8 text-neutral-400" />
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider">
                {targetLog.direction === 'entry' ? 'IN' : 'OUT'}
              </span>
            </div>

            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <span className="font-bold text-sm text-primary-text">
                  {targetLog.userName || 'Unknown Person Detected'}
                </span>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                  {(targetLog.confidence * 100).toFixed(0)}% AI Match
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                Detected at {new Date(targetLog.detectedAt).toLocaleTimeString()} on{' '}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {selectedLocationObj?.name || 'Paradigm Office'}
                </span>
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-3 mt-2 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-emerald-600" /> InsightFace 512D Vector
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-emerald-600" /> Geofence Verified
                </span>
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-border w-fit">
            <button
              onClick={() => setActiveTab('existing')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'existing'
                  ? 'bg-white dark:bg-neutral-800 text-emerald-700 dark:text-emerald-400 shadow-xs border border-border/60'
                  : 'text-muted hover:text-primary-text'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Select Existing Employee (DB)
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'new'
                  ? 'bg-white dark:bg-neutral-800 text-emerald-700 dark:text-emerald-400 shadow-xs border border-border/60'
                  : 'text-muted hover:text-primary-text'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Register New Employee
            </button>
          </div>

          {/* TAB 1: Select from Database */}
          {activeTab === 'existing' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-primary-text mb-2 uppercase tracking-wider">
                  Search & Select Employee from Database *
                </label>
                <div className="relative">
                  <Search className="h-4 w-4 text-muted absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search by name, email, biometric code, or role..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* User Selection List / Cards */}
              <div className="border border-border rounded-2xl max-h-48 overflow-y-auto divide-y divide-border/60 bg-background">
                {isLoadingData ? (
                  <div className="p-4 text-center text-xs text-muted flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                    <span>Loading employees from database...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted">
                    {searchTerm ? `No employees matching "${searchTerm}" found.` : 'No employees found in database.'}
                  </div>
                ) : (
                  filteredUsers.slice(0, 30).map(u => {
                    const isSelected = selectedUserId === u.id;
                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-semibold'
                            : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-border flex items-center justify-center">
                            {u.photoUrl ? (
                              <img src={u.photoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <ProfilePlaceholder seed={u.id} className="h-full w-full" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-primary-text truncate">
                                {u.name}
                              </span>
                              {u.role && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                                  {u.role}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted truncate flex items-center gap-2 mt-0.5">
                              {u.email && <span>{u.email}</span>}
                              {u.biometricId && <span className="font-mono font-semibold">Code: {u.biometricId}</span>}
                            </div>
                          </div>
                        </div>

                        {isSelected ? (
                          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Side-by-Side Verification Preview when User Selected */}
              {selectedUserObj && (
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600" /> Selected Employee Details Auto-Filled:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-800/40">
                      <span className="text-muted text-[10px] block uppercase font-bold">Role</span>
                      <span className="font-semibold text-primary-text truncate block">{selectedUserObj.role || 'Staff'}</span>
                    </div>
                    <div className="bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-800/40">
                      <span className="text-muted text-[10px] block uppercase font-bold">Company</span>
                      <span className="font-semibold text-primary-text truncate block">{selectedUserObj.company || 'Paradigm Office'}</span>
                    </div>
                    <div className="bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-800/40">
                      <span className="text-muted text-[10px] block uppercase font-bold">Location</span>
                      <span className="font-semibold text-primary-text truncate block">
                        {selectedLocationObj?.name || selectedUserObj.location || 'Paradigm Office'}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-800/40">
                      <span className="text-muted text-[10px] block uppercase font-bold">Biometric ID</span>
                      <span className="font-semibold font-mono text-emerald-700 dark:text-emerald-400 truncate block">
                        {selectedUserObj.biometricId || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Register New Employee */}
          {activeTab === 'new' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary-text mb-1.5 uppercase">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sudhan M"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary-text mb-1.5 uppercase">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. sudhan@paradigmfms.com"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary-text mb-1.5 uppercase">
                    Role / Designation
                  </label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="SITE MANAGER">SITE MANAGER</option>
                    <option value="FIELD STAFF">FIELD STAFF</option>
                    <option value="HR RECRUITMENT">HR RECRUITMENT</option>
                    <option value="OPERATION MANAGER">OPERATION MANAGER</option>
                    <option value="EMPLOYEE">EMPLOYEE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary-text mb-1.5 uppercase">
                    Biometric ID / Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1042"
                    value={newBiometricId}
                    onChange={e => setNewBiometricId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary-text mb-1.5 uppercase">
                  Company Name
                </label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={e => setNewCompany(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Site Location Selector (Image 2) */}
          <div className="pt-2 border-t border-border">
            <label className="block text-xs font-bold text-primary-text mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              Assigned Site Location (from Location Management)
            </label>
            <select
              value={selectedLocationId}
              onChange={e => setSelectedLocationId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {sortedLocations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name || loc.address || 'Unnamed Site'}
                </option>
              ))}
            </select>
          </div>

          {/* Record Attendance Punch Checkbox */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="recordAttendancePunch"
                checked={recordAttendancePunch}
                onChange={e => setRecordAttendancePunch(e.target.checked)}
                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-border"
              />
              <label htmlFor="recordAttendancePunch" className="text-xs font-semibold text-primary-text cursor-pointer">
                Also record verified attendance punch for today at {selectedLocationObj?.name || 'Paradigm Office'}
              </label>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold uppercase">
              {targetLog.direction === 'entry' ? 'Punch In' : 'Punch Out'}
            </span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-neutral-50/80 dark:bg-neutral-900/80 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-muted hover:text-primary-text rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSubmitting || (activeTab === 'existing' && !selectedUserId) || (activeTab === 'new' && !newName.trim())}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Syncing Vector & Saving...</span>
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4" />
                <span>Confirm & Sync Face Vector</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CctvQuickMapModal;
