import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import {
  Activity, ArrowRight, ArrowLeft, AlertTriangle, RefreshCw,
  Camera, CheckCircle, XCircle, Eye
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

const CctvDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<CctvLog[]>([]);
  const [unknownQueue, setUnknownQueue] = useState<EnrollmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'unknown'>('live');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

  const fetchLogs = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const [{ data: logsData, error: logsError }, { data: unknownData, error: unknownError }] = await Promise.all([
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
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load CCTV data. Run the database migration first.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Realtime subscription
  useEffect(() => {
    fetchLogs();

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
          Live Feed
        </button>
        <button
          onClick={() => setActiveTab('unknown')}
          className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'unknown'
              ? 'bg-accent text-white shadow-sm shadow-accent/30'
              : 'bg-gray-100 text-muted hover:bg-gray-200'
          }`}
        >
          Unknown Faces
          {stats.unknown > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === 'unknown' ? 'bg-white text-accent' : 'bg-amber-500 text-white'
            }`}>
              {stats.unknown}
            </span>
          )}
        </button>
      </div>

      {/* Live Feed */}
      {activeTab === 'live' && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="font-semibold text-primary-text text-sm">Live — Today's Detections</span>
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
                    log.userId ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-gray-400'
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

      {/* Unknown Faces */}
      {activeTab === 'unknown' && (
        <div className="space-y-3">
          {unknownQueue.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center bg-card rounded-2xl border border-dashed border-border shadow-sm">
              <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="text-primary-text font-semibold">All clear</p>
              <p className="text-sm text-muted mt-1">No unknown faces pending review</p>
            </div>
          ) : (
            unknownQueue.map(item => (
              <div key={item.id} className="bg-card rounded-2xl border border-amber-200 shadow-sm p-4 flex items-center gap-4">
                {/* Snapshot */}
                <div className="h-14 w-14 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden border border-border">
                  {item.snapshotUrl ? (
                    <img src={item.snapshotUrl} alt="Unknown face" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Eye className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-amber-700 text-sm">Unknown Person</div>
                  <div className="text-xs text-muted mt-0.5">📷 {item.cameraName}</div>
                  <div className="text-xs text-muted">{formatTime(item.detectedAt)}</div>
                </div>

                <button
                  onClick={() => handleDismiss(item.id)}
                  className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex-shrink-0"
                  title="Dismiss"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CctvDashboard;
