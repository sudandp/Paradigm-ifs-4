import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import {
  Activity, ArrowRight, ArrowLeft, AlertTriangle, RefreshCw,
  Camera, CheckCircle, XCircle, Eye, UserPlus, UserCheck
} from 'lucide-react';

interface CctvLog {
  id: string;
  userId: string | null;
  userName: string | null;
  cameraName: string;
  direction: 'entry' | 'exit';
  confidence: number;
  detectedAt: string;
  snapshotUrl: string | null;
  edgeDeviceId: string;
}

interface EnrollmentItem {
  id: string;
  cameraName: string;
  detectedAt: string;
  snapshotUrl: string | null;
  status: string;
  edgeDeviceId: string;
}

interface UserOption {
  id: string;
  name: string;
  biometricId: string | null;
}

const CctvDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<CctvLog[]>([]);
  const [unknownQueue, setUnknownQueue] = useState<EnrollmentItem[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'unknown'>('live');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Enroll modal state
  const [selectedUnknown, setSelectedUnknown] = useState<EnrollmentItem | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [enrollStep, setEnrollStep] = useState<'select' | 'sending' | 'done'>('select');
  const [edgeServerUrl, setEdgeServerUrl] = useState<string>('http://192.168.51.123:4100');

  const stats = {
    entries: logs.filter(l => l.direction === 'entry' && l.userId).length,
    exits: logs.filter(l => l.direction === 'exit' && l.userId).length,
    unknown: unknownQueue.length,
    topCamera: (() => {
      const counts: Record<string, number> = {};
      logs.forEach(l => { counts[l.cameraName] = (counts[l.cameraName] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    })(),
  };

  // Fetch edge server URL from Supabase device record
  const fetchEdgeServerUrl = useCallback(async () => {
    const { data } = await supabase
      .from('cctv_devices')
      .select('server_host, admin_port')
      .eq('status', 'online')
      .limit(1)
      .single();
    if (data?.server_host && data.server_host !== '192.168.51.111') {
      setEdgeServerUrl(`http://${data.server_host}:${data.admin_port || 4100}`);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const [
        { data: logsData, error: logsError },
        { data: unknownData, error: unknownError },
        { data: usersData }
      ] = await Promise.all([
        supabase
          .from('cctv_attendance_logs')
          .select('*')
          .gte('detected_at', today.toISOString())
          .order('detected_at', { ascending: false })
          .limit(100),
        supabase
          .from('cctv_enrollment_queue')
          .select('*')
          .eq('status', 'pending')
          .order('detected_at', { ascending: false })
          .limit(20),
        supabase
          .from('users')
          .select('id, name, biometric_id')
          .order('name', { ascending: true })
          .limit(200),
      ]);

      if (logsError) throw logsError;
      if (unknownError) throw unknownError;

      setLogs((logsData || []).map((l: any) => ({
        id: l.id,
        userId: l.user_id,
        userName: l.user_name,
        cameraName: l.camera_name,
        direction: l.direction,
        confidence: l.confidence,
        detectedAt: l.detected_at,
        snapshotUrl: l.snapshot_url,
        edgeDeviceId: l.edge_device_id,
      })));

      setUnknownQueue((unknownData || []).map((u: any) => ({
        id: u.id,
        cameraName: u.camera_name,
        detectedAt: u.detected_at,
        snapshotUrl: u.snapshot_url,
        status: u.status,
        edgeDeviceId: u.edge_device_id,
      })));

      setUserOptions((usersData || []).map((u: any) => ({
        id: u.id,
        name: u.name || 'Unnamed Employee',
        biometricId: u.biometric_id || null,
      })));
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load CCTV data.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Realtime subscription
  useEffect(() => {
    fetchLogs();
    fetchEdgeServerUrl();

    const channel = supabase
      .channel('cctv-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cctv_attendance_logs' }, payload => {
        const l = payload.new as any;
        setLogs(prev => [{
          id: l.id,
          userId: l.user_id,
          userName: l.user_name,
          cameraName: l.camera_name,
          direction: l.direction,
          confidence: l.confidence,
          detectedAt: l.detected_at,
          snapshotUrl: l.snapshot_url,
          edgeDeviceId: l.edge_device_id,
        }, ...prev].slice(0, 100));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cctv_enrollment_queue' }, payload => {
        const u = payload.new as any;
        setUnknownQueue(prev => [{
          id: u.id,
          cameraName: u.camera_name,
          detectedAt: u.detected_at,
          snapshotUrl: u.snapshot_url,
          status: 'pending',
          edgeDeviceId: u.edge_device_id,
        }, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLogs]);

  const handleDismiss = async (id: string) => {
    await supabase
      .from('cctv_enrollment_queue')
      .update({ status: 'dismissed', resolved_at: new Date().toISOString(), resolved_by: user?.id })
      .eq('id', id);
    setUnknownQueue(prev => prev.filter(u => u.id !== id));
    setToast({ message: 'Unknown face dismissed', type: 'success' });
  };

  const handleAssignFace = async () => {
    if (!selectedUnknown || !selectedUserId) {
      setToast({ message: 'Please select an employee to assign.', type: 'error' });
      return;
    }

    setIsAssigning(true);
    setEnrollStep('sending');
    const selectedUserObj = userOptions.find(u => u.id === selectedUserId);

    try {
      // Step 1: Mark enrolled in Supabase
      const { error } = await supabase
        .from('cctv_enrollment_queue')
        .update({
          status: 'enrolled',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq('id', selectedUnknown.id);
      if (error) throw error;

      // Step 2: Send face photo to edge server for embedding generation
      if (selectedUnknown.snapshotUrl) {
        try {
          // Fetch the snapshot image as a blob
          const imgResponse = await fetch(selectedUnknown.snapshotUrl);
          if (!imgResponse.ok) throw new Error('Could not fetch snapshot image');
          const imgBlob = await imgResponse.blob();

          // POST multipart/form-data to edge server /enroll
          const formData = new FormData();
          formData.append('user_id', selectedUserId);
          formData.append('user_name', selectedUserObj?.name || 'Employee');
          formData.append('biometric_id', selectedUserObj?.biometricId || '');
          formData.append('department', 'CCTV_ENROLLED');
          formData.append('organization_id', user?.organizationId || '');
          formData.append('photo', new File([imgBlob], 'face.jpg', { type: 'image/jpeg' }));

          const enrollRes = await fetch(`${edgeServerUrl}/enroll`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(15000),
          });

          if (!enrollRes.ok) {
            const errData = await enrollRes.json().catch(() => ({}));
            throw new Error(errData.detail || `Edge server returned ${enrollRes.status}`);
          }

          const enrollData = await enrollRes.json();
          console.log('[CCTV Enroll] Embedding stored:', enrollData);

          setEnrollStep('done');
          setUnknownQueue(prev => prev.filter(u => u.id !== selectedUnknown.id));
          setToast({
            message: `✅ ${selectedUserObj?.name || 'Employee'} enrolled! Face embedding saved — they will be recognized from next detection.`,
            type: 'success',
          });
        } catch (edgeErr: any) {
          // Edge server failed but Supabase succeeded — warn but don't fail hard
          console.warn('[CCTV Enroll] Edge server enrollment failed:', edgeErr);
          setUnknownQueue(prev => prev.filter(u => u.id !== selectedUnknown.id));
          setToast({
            message: `⚠️ Assigned in Supabase, but edge server enrollment failed: ${edgeErr.message}. Copy updated dispatcher.py to server and retry.`,
            type: 'error',
          });
        }
      } else {
        // No snapshot available — just mark in Supabase
        setUnknownQueue(prev => prev.filter(u => u.id !== selectedUnknown.id));
        setToast({
          message: `Assigned to ${selectedUserObj?.name || 'employee'} in Supabase. No snapshot available for face embedding.`,
          type: 'success',
        });
      }

      setSelectedUnknown(null);
      setSelectedUserId('');
      setEnrollStep('select');
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to assign face to employee.', type: 'error' });
      setEnrollStep('select');
    } finally {
      setIsAssigning(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  if (isLoading) return <LoadingScreen message="Loading CCTV dashboard..." />;

  return (
    <div className="p-4 md:p-8">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-extrabold text-primary-text tracking-tight">CCTV Dashboard</h1>
          <p className="text-muted mt-1">Real-time attendance via CCTV face recognition.</p>
        </div>
        <Button variant="outline" onClick={fetchLogs} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
            <ArrowRight className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-primary-text">{stats.entries}</div>
          <div className="text-sm text-muted mt-0.5">Today's Entries</div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
            <ArrowLeft className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-primary-text">{stats.exits}</div>
          <div className="text-sm text-muted mt-0.5">Today's Exits</div>
        </div>
        <div className={`bg-card rounded-2xl border p-5 shadow-sm ${stats.unknown > 0 ? 'border-amber-200' : 'border-border'}`}>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${stats.unknown > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <AlertTriangle className={`h-5 w-5 ${stats.unknown > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
          </div>
          <div className="text-2xl font-bold text-primary-text">{stats.unknown}</div>
          <div className="text-sm text-muted mt-0.5">Unknown Faces</div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="h-10 w-10 bg-accent/5 rounded-xl flex items-center justify-center mb-3">
            <Camera className="h-5 w-5 text-accent" />
          </div>
          <div className="text-base font-bold text-primary-text truncate">{stats.topCamera}</div>
          <div className="text-sm text-muted mt-0.5">Top Camera</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab('live')}
          className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'live'
              ? 'bg-accent text-white shadow-sm shadow-accent/30'
              : 'bg-gray-100 text-muted hover:bg-gray-200'
          }`}
        >
          Live Feed (Enrolled Attendance)
        </button>
        <button
          onClick={() => setActiveTab('unknown')}
          className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'unknown'
              ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
              : 'bg-gray-100 text-muted hover:bg-gray-200'
          }`}
        >
          Unknown Faces
          {stats.unknown > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === 'unknown' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'
            }`}>
              {stats.unknown}
            </span>
          )}
        </button>
      </div>

      {/* Live Feed (Enrolled Attendance) */}
      {activeTab === 'live' && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="font-semibold text-primary-text text-sm">Live Enrolled Attendance Detections</span>
            <span className="ml-auto text-xs text-muted">{logs.length} events</span>
          </div>

          {logs.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <div className="h-16 w-16 bg-accent/5 rounded-full flex items-center justify-center mb-4">
                <Camera className="h-8 w-8 text-accent/30" />
              </div>
              <p className="text-muted font-medium">No detections today yet</p>
              <p className="text-sm text-muted/70 mt-1">Waiting for CCTV events...</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors">
                  {/* Avatar */}
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    log.userId ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {log.userName ? log.userName.charAt(0).toUpperCase() : '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-sm ${log.userId ? 'text-primary-text' : 'text-muted italic'}`}>
                        {log.userName || 'Unknown Person'}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        log.direction === 'entry'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {log.direction === 'entry' ? '→ Entry' : '← Exit'}
                      </span>
                    </div>
                    <div className="text-xs text-muted mt-0.5">📷 {log.cameraName}</div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className={`text-sm font-mono font-bold ${
                      log.confidence >= 0.75 ? 'text-emerald-600' : log.confidence >= 0.55 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {(log.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-[11px] text-muted">{formatTime(log.detectedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unknown Faces Tab */}
      {activeTab === 'unknown' && (
        <div className="space-y-3">
          {unknownQueue.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center bg-card rounded-2xl border border-dashed border-border shadow-sm">
              <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="text-primary-text font-semibold">All Clear</p>
              <p className="text-sm text-muted mt-1">No unknown faces pending review</p>
            </div>
          ) : (
            unknownQueue.map(item => (
              <div key={item.id} className="bg-card rounded-2xl border border-amber-200 shadow-sm p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  {/* Snapshot */}
                  <div className="h-16 w-16 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden border border-border">
                    {item.snapshotUrl ? (
                      <img src={item.snapshotUrl} alt="Unknown face" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-amber-50">
                        <Eye className="h-6 w-6 text-amber-400" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-800 text-sm">Unknown Person Detected</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        Pending Review
                      </span>
                    </div>
                    <div className="text-xs text-muted mt-1">📷 Camera: <strong>{item.cameraName}</strong></div>
                    <div className="text-xs text-muted">🕒 Time: {formatTime(item.detectedAt)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => { setSelectedUnknown(item); setSelectedUserId(''); }}
                    className="flex items-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Assign Employee
                  </Button>
                  <button
                    onClick={() => handleDismiss(item.id)}
                    className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Dismiss"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Enroll / Assign Modal */}
      {selectedUnknown && (
        <Modal
          isOpen={!!selectedUnknown}
          onClose={() => { setSelectedUnknown(null); setEnrollStep('select'); }}
          onConfirm={handleAssignFace}
          title="Enroll & Assign Face to Employee"
          confirmButtonText={enrollStep === 'sending' ? 'Enrolling...' : 'Confirm & Enroll Face'}
          confirmButtonVariant="primary"
          isLoading={isAssigning}
        >
          <div className="space-y-4">

            {/* Face snapshot preview */}
            <div className="flex items-center gap-4 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
              <div className="h-20 w-20 rounded-xl bg-gray-100 overflow-hidden border border-border flex-shrink-0">
                {selectedUnknown.snapshotUrl ? (
                  <img src={selectedUnknown.snapshotUrl} alt="Unknown face" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Eye className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Unknown Face Detected</p>
                <p className="text-xs text-muted mt-1">📷 Camera: <strong>{selectedUnknown.cameraName}</strong></p>
                <p className="text-xs text-muted">🕒 Time: {formatTime(selectedUnknown.detectedAt)}</p>
                {!selectedUnknown.snapshotUrl && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">⚠️ No snapshot — only Supabase record will be updated.</p>
                )}
              </div>
            </div>

            {/* Employee selector */}
            <div>
              <label className="block text-xs font-bold text-primary-text mb-1.5 uppercase tracking-wider">
                Select Employee to Assign This Face
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={isAssigning}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              >
                <option value="">-- Choose Employee --</option>
                {userOptions.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.biometricId ? `(ID: ${u.biometricId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* What happens explanation */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-bold text-emerald-800">What happens when you confirm:</p>
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 text-xs font-bold mt-0.5">1.</span>
                <p className="text-xs text-emerald-700">Marked as enrolled in Supabase (attendance records linked)</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 text-xs font-bold mt-0.5">2.</span>
                <p className="text-xs text-emerald-700">Face photo sent to edge server (<code className="bg-emerald-100 px-1 rounded">{edgeServerUrl}</code>) to generate face embedding</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 text-xs font-bold mt-0.5">3.</span>
                <p className="text-xs text-emerald-700">Employee will be auto-recognized in all future CCTV detections</p>
              </div>
            </div>

            {/* Progress during enrollment */}
            {isAssigning && (
              <div className="flex items-center gap-2 text-xs text-accent font-semibold animate-pulse">
                <span className="h-2 w-2 bg-accent rounded-full animate-ping" />
                {enrollStep === 'sending' ? 'Sending face to edge server...' : 'Saving to Supabase...'}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CctvDashboard;

