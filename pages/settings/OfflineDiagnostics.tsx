/**
 * OfflineDiagnostics.tsx — Runtime Offline & Outbox Diagnostics Screen
 *
 * Provides complete field diagnostics and runtime truth from the installed build:
 * - Offline capture & drain flags (isCaptureEnabled, isDrainEnabled, VITE_OFFLINE_ENABLED)
 * - Network status & real Supabase reachability probe
 * - Service worker registration & controller state
 * - Storage persistence & IndexedDB quota usage
 * - Outbox status breakdown & oldest queued item age
 * - Master data prefetch statistics & cache status
 * - Session & auth token expiry metadata
 * - Diagnostic export for remote technician support
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Wifi,
  WifiOff,
  Database,
  Server,
  HardDrive,
  ShieldCheck,
  Clock,
  Layers,
  FileText,
  ExternalLink,
  Smartphone,
  Check,
  Zap,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { APP_VERSION, APP_BUILD_NUMBER } from '../../src/config/appVersion';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { isCaptureEnabled, isDrainEnabled } from '../../services/offline/featureFlag';
import { isOnline, isReachable } from '../../services/offline/networkStatus';
import { useOutboxSummary } from '../../hooks/useOutboxStatus';
import * as outbox from '../../services/offline/outbox';
import { syncEngine } from '../../services/offline/syncEngine';
import { prefetchMasterData, PrefetchStats } from '../../services/offline/prefetch';

export const OfflineDiagnostics: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { summary, isOnline: outboxOnline, isReachableState, syncNow, refresh: refreshOutbox } = useOutboxSummary();

  // Local state
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Runtime Diagnostic metrics
  const [probeResult, setProbeResult] = useState<boolean | null>(null);
  const [probeLatencyMs, setProbeLatencyMs] = useState<number | null>(null);
  const [networkPluginStatus, setNetworkPluginStatus] = useState<string>('checking...');
  const [swStatus, setSwStatus] = useState<string>('checking...');
  const [swScriptUrl, setSwScriptUrl] = useState<string | null>(null);
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<{ usageMB: number; quotaMB: number; percent: number } | null>(null);
  const [oldestItemAge, setOldestItemAge] = useState<string>('None');
  const [oldestItemTimestamp, setOldestItemTimestamp] = useState<number | null>(null);
  const [prefetchMeta, setPrefetchMeta] = useState<PrefetchStats | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{
    userId: string;
    email: string;
    expiresAt: string;
    minutesRemaining: number | null;
  } | null>(null);
  const [captureEnabledState, setCaptureEnabledState] = useState<boolean>(isCaptureEnabled());

  // Load diagnostics
  const refreshDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Feature Flag
      setCaptureEnabledState(isCaptureEnabled());

      // 2. Capacitor Network Plugin
      try {
        const net = await Network.getStatus();
        setNetworkPluginStatus(`${net.connected ? 'Connected' : 'Disconnected'} (${net.connectionType})`);
      } catch {
        setNetworkPluginStatus('Web fallback (no plugin)');
      }

      // 3. Supabase Health Probe
      const probeStart = performance.now();
      const reached = await isReachable(4000);
      const probeDuration = Math.round(performance.now() - probeStart);
      setProbeResult(reached);
      setProbeLatencyMs(probeDuration);

      // 4. Service Worker
      if ('serviceWorker' in navigator) {
        const controller = navigator.serviceWorker.controller;
        if (controller) {
          setSwStatus('Active (Controlled)');
          setSwScriptUrl(controller.scriptURL);
        } else {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            setSwStatus(reg.active ? 'Registered (not controlling this client)' : 'Registered (waiting/installing)');
          } else {
            setSwStatus('None (No registration)');
          }
        }
      } else {
        setSwStatus('Unsupported in this environment');
      }

      // 5. Storage Persistence & Quota
      if ('storage' in navigator && navigator.storage) {
        if (navigator.storage.persisted) {
          const isPersisted = await navigator.storage.persisted();
          setStoragePersisted(isPersisted);
        }
        if (navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          const usageMB = Math.round((estimate.usage || 0) / (1024 * 1024) * 10) / 10;
          const quotaMB = Math.round((estimate.quota || 0) / (1024 * 1024) * 10) / 10;
          const percent = quotaMB > 0 ? Math.round((usageMB / quotaMB) * 1000) / 10 : 0;
          setStorageEstimate({ usageMB, quotaMB, percent });
        }
      }

      // 6. Oldest Item in Outbox
      const allItems = await outbox.getAll();
      const pendingItems = allItems.filter(i => i.status === 'pending' || i.status === 'syncing');
      if (pendingItems.length > 0) {
        const minTime = Math.min(...pendingItems.map(i => i.createdAt));
        setOldestItemTimestamp(minTime);
        const ageSec = Math.floor((Date.now() - minTime) / 1000);
        if (ageSec < 60) {
          setOldestItemAge(`${ageSec}s ago`);
        } else if (ageSec < 3600) {
          setOldestItemAge(`${Math.floor(ageSec / 60)}m ago`);
        } else {
          setOldestItemAge(`${Math.floor(ageSec / 3600)}h ${Math.floor((ageSec % 3600) / 60)}m ago`);
        }
      } else {
        setOldestItemAge('None (Queue empty)');
        setOldestItemTimestamp(null);
      }

      // 7. Prefetch Meta
      try {
        const raw = localStorage.getItem('paradigm_offline_prefetch_meta');
        if (raw) {
          setPrefetchMeta(JSON.parse(raw));
        }
      } catch {
        setPrefetchMeta(null);
      }

      // 8. Session Details
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const expSec = session.expires_at || 0;
        const nowSec = Math.floor(Date.now() / 1000);
        const remainingMin = expSec > nowSec ? Math.floor((expSec - nowSec) / 60) : 0;
        setSessionInfo({
          userId: session.user.id,
          email: session.user.email || 'No email',
          expiresAt: expSec ? new Date(expSec * 1000).toLocaleTimeString() : 'Unknown',
          minutesRemaining: remainingMin,
        });
      } else {
        setSessionInfo(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDiagnostics();
    const timer = setInterval(() => {
      refreshDiagnostics();
    }, 15000);
    return () => clearInterval(timer);
  }, [refreshDiagnostics]);

  // Actions
  const handleProbe = async () => {
    setProbing(true);
    try {
      const probeStart = performance.now();
      const reached = await isReachable(4000);
      const probeDuration = Math.round(performance.now() - probeStart);
      setProbeResult(reached);
      setProbeLatencyMs(probeDuration);
      toast.success(reached ? `Supabase reachable (${probeDuration}ms)` : 'Supabase unreachable');
    } finally {
      setProbing(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncNow();
      await refreshOutbox();
      await refreshDiagnostics();
      toast.success('Sync triggered successfully');
    } catch (err) {
      toast.error('Sync failed: ' + String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleRunPrefetch = async () => {
    setPrefetching(true);
    try {
      const stats = await prefetchMasterData();
      if (stats) {
        setPrefetchMeta(stats);
        toast.success(`Prefetched ${stats.sitesCount} sites in ${stats.durationMs}ms`);
      } else {
        toast.error('Prefetch failed or skipped (device offline)');
      }
    } catch (err) {
      toast.error('Prefetch error: ' + String(err));
    } finally {
      setPrefetching(false);
    }
  };

  const handleRequestStoragePersistence = async () => {
    if ('storage' in navigator && navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      setStoragePersisted(isPersisted);
      if (isPersisted) {
        toast.success('Persistent storage granted by device');
      } else {
        toast('Device did not grant persistent storage', { icon: 'ℹ️' });
      }
    }
  };

  const handleToggleCaptureDisabled = () => {
    const isCurrentlyDisabled = localStorage.getItem('paradigm_offline_capture_disabled') === 'true';
    if (isCurrentlyDisabled) {
      localStorage.removeItem('paradigm_offline_capture_disabled');
      setCaptureEnabledState(true);
      toast.success('Offline capture re-enabled');
    } else {
      localStorage.setItem('paradigm_offline_capture_disabled', 'true');
      setCaptureEnabledState(false);
      toast.success('Offline capture disabled for simulation');
    }
  };

  const handleCopyReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      app: {
        version: APP_VERSION,
        buildNumber: APP_BUILD_NUMBER,
        platform: Capacitor.getPlatform(),
        isNative: Capacitor.isNativePlatform(),
        environment: import.meta.env.MODE,
      },
      flags: {
        isCaptureEnabled: captureEnabledState,
        isDrainEnabled: isDrainEnabled(),
        VITE_OFFLINE_ENABLED: import.meta.env.VITE_OFFLINE_ENABLED,
        simulatedCaptureDisabled: localStorage.getItem('paradigm_offline_capture_disabled') === 'true',
      },
      network: {
        navigatorOnLine: typeof navigator !== 'undefined' ? navigator.onLine : null,
        capacitorStatus: networkPluginStatus,
        isReachableProbe: probeResult,
        probeLatencyMs: probeLatencyMs,
      },
      serviceWorker: {
        status: swStatus,
        scriptUrl: swScriptUrl,
      },
      storage: {
        persisted: storagePersisted,
        estimate: storageEstimate,
      },
      outbox: {
        summary,
        oldestItemAge,
        oldestItemTimestamp,
      },
      prefetch: prefetchMeta,
      auth: {
        userId: sessionInfo?.userId || null,
        email: sessionInfo?.email || null,
        minutesRemaining: sessionInfo?.minutesRemaining || null,
      },
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    toast.success('Full diagnostic report copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold">Offline Diagnostics</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Runtime Truth
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Live field inspection of engine flags, storage persistence, and outbox state.
              </p>
            </div>
          </div>

          {/* Quick Action Header Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshDiagnostics}
              disabled={loading}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold border border-slate-800 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleCopyReport}
              className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-xs font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Report'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/sync-review')}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Sync Review
            </button>
          </div>
        </div>

        {/* Section 1: Top Status Banner / Pilot Health */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Capture Flag */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Offline Capture</span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="my-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                  captureEnabledState
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {captureEnabledState ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> ENABLED
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> DISABLED
                  </>
                )}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Env: {import.meta.env.VITE_OFFLINE_ENABLED ?? 'undefined'}</span>
              <button
                type="button"
                onClick={handleToggleCaptureDisabled}
                className="text-emerald-400 hover:underline"
              >
                {captureEnabledState ? 'Simulate Off' : 'Enable'}
              </button>
            </div>
          </div>

          {/* Card 2: Cloud Reachability */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Cloud Probe</span>
              {probeResult ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="my-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                  probeResult
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {probeResult ? 'REACHABLE' : 'UNREACHABLE'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>{probeLatencyMs ? `${probeLatencyMs} ms` : 'Testing…'}</span>
              <button
                type="button"
                onClick={handleProbe}
                disabled={probing}
                className="text-blue-400 hover:underline disabled:opacity-50"
              >
                {probing ? 'Probing…' : 'Re-probe'}
              </button>
            </div>
          </div>

          {/* Card 3: Service Worker */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Service Worker</span>
              <Server className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="my-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                  swStatus.includes('Active')
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {swStatus.includes('Active') ? 'ACTIVE (CONTROLLING)' : 'NOT CONTROLLING'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate" title={swStatus}>
              {swStatus}
            </div>
          </div>

          {/* Card 4: Outbox Health */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Outbox Queue</span>
              <Database className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="my-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-100">{summary.total}</span>
              <span className="text-xs text-slate-400">items</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Oldest: {oldestItemAge}</span>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing || !probeResult}
                className="text-emerald-400 hover:underline disabled:opacity-40"
              >
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Detailed Diagnostics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Box A: Storage & IndexedDB Persistence */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-200">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                Storage & IDB Quota
              </h2>
              {storagePersisted === false && (
                <button
                  type="button"
                  onClick={handleRequestStoragePersistence}
                  className="text-xs px-2 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-600/30 transition-colors"
                >
                  Request Persist
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Persistence Granted:</span>
                <span className={`font-mono font-medium ${storagePersisted ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {storagePersisted === null ? 'Unknown' : storagePersisted ? 'Yes (Protected from OS eviction)' : 'No (Transient)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">IndexedDB Database:</span>
                <span className="font-mono text-slate-200">paradigm_offline_db (v2)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Storage Used:</span>
                <span className="font-mono text-slate-200">
                  {storageEstimate ? `${storageEstimate.usageMB} MB` : 'Estimating…'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Storage Quota:</span>
                <span className="font-mono text-slate-200">
                  {storageEstimate ? `${storageEstimate.quotaMB} MB` : 'Estimating…'}
                </span>
              </div>

              {storageEstimate && (
                <div className="pt-2">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Quota Consumption</span>
                    <span className="font-mono text-emerald-400">{storageEstimate.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        storageEstimate.percent > 80
                          ? 'bg-rose-500'
                          : storageEstimate.percent > 50
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(1, storageEstimate.percent))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Box B: Master Data Prefetch Status */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-200">
                <Database className="w-4 h-4 text-blue-400" />
                Master Data Prefetch (W5)
              </h2>
              <button
                type="button"
                onClick={handleRunPrefetch}
                disabled={prefetching || !probeResult}
                className="text-xs px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/30 transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${prefetching ? 'animate-spin' : ''}`} />
                {prefetching ? 'Prefetching…' : 'Run Prefetch Now'}
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Last Prefetch Completed:</span>
                <span className="font-mono text-slate-200">
                  {prefetchMeta?.timestamp
                    ? new Date(prefetchMeta.timestamp).toLocaleString()
                    : 'Never (Run prefetch required)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Cached Sites / Orgs:</span>
                <span className="font-mono text-emerald-400">
                  {prefetchMeta?.sitesCount ?? 0} sites ready in cache
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Fetch Execution Time:</span>
                <span className="font-mono text-slate-200">
                  {prefetchMeta?.durationMs ? `${prefetchMeta.durationMs} ms` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Offline Module Readiness:</span>
                <span className="text-emerald-400 font-medium">
                  {prefetchMeta && prefetchMeta.sitesCount > 0 ? 'Ready for offline creation' : 'Pending download'}
                </span>
              </div>
            </div>
          </div>

          {/* Box C: Outbox Counts by Status */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-200">
                <Layers className="w-4 h-4 text-indigo-400" />
                Outbox Breakdown
              </h2>
              <button
                type="button"
                onClick={() => navigate('/sync-review')}
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                Open Review <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <div className="text-slate-400">Pending Sync</div>
                <div className="text-lg font-bold text-amber-300 mt-1">{summary.pending}</div>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <div className="text-slate-400">In Flight (Syncing)</div>
                <div className="text-lg font-bold text-blue-300 mt-1">{summary.syncing}</div>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <div className="text-slate-400">Permanent Failure</div>
                <div className="text-lg font-bold text-rose-400 mt-1">{summary.failed}</div>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <div className="text-slate-400">Version Conflicts</div>
                <div className="text-lg font-bold text-orange-400 mt-1">{summary.conflict}</div>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 col-span-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Auth Paused (Needs Re-login):</span>
                  <span className="font-bold text-yellow-400">{summary.authPaused}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Box D: Identity & Build Information */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-200">
                <Smartphone className="w-4 h-4 text-purple-400" />
                Build & Identity Environment
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">App Version / Build:</span>
                <span className="font-mono text-slate-200">
                  v{APP_VERSION} (Build {APP_BUILD_NUMBER})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Runtime Platform:</span>
                <span className="font-mono text-slate-200">
                  {Capacitor.getPlatform().toUpperCase()} {Capacitor.isNativePlatform() ? '(Native Shell)' : '(PWA/Web)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Active User ID:</span>
                <span className="font-mono text-slate-200 truncate max-w-[200px]" title={sessionInfo?.userId}>
                  {sessionInfo?.userId || 'Not signed in'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">User Email:</span>
                <span className="font-mono text-slate-200 truncate max-w-[200px]">
                  {sessionInfo?.email || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Auth Token Expiry:</span>
                <span className="font-mono text-slate-200">
                  {sessionInfo?.minutesRemaining != null ? `${sessionInfo.minutesRemaining} min remaining` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Support Instructions footer */}
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              Field Support: Read this screen to IT or tap <strong>Copy Report</strong> to paste diagnostic specs in ticket.
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Paradigm FMS Offline v2</span>
        </div>
      </div>
    </div>
  );
};

export default OfflineDiagnostics;
