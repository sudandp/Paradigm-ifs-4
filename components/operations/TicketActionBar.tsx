import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  X,
  Loader2,
  Clock,
  PauseCircle,
  UserCog,
  CheckCircle2,
  PlayCircle,
  Camera,
  Search,
  MapPin,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import type { OpsTicket, HelpdeskPresentStaff } from '../../types/operations';
import { helpdeskActionsApi, dataUrlToBlob, type HelpdeskUserOption } from '../../services/helpdeskActionsApi';
import { compressBase64Client } from '../../utils/imageCompression';
import { getPrecisePosition } from '../../utils/locationUtils';

type Sheet = 'accept' | 'eta' | 'hold' | 'reassign' | 'resolve' | null;

interface TicketActionBarProps {
  ticket: OpsTicket;
  /** Called after a successful action so the caller can refresh drawer + list data. */
  onChanged: () => Promise<void> | void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

const REASON_CHIPS = ['Material awaited', 'Vendor required', 'Client access pending', 'More work found'];
const REASSIGN_CHIPS = ['Not on site', 'Needs different skill', 'Workload balancing'];
const MAX_PHOTOS = 5;

// ---------------------------------------------------------------------------
// ETA helpers (quick picks are anchored to IST regardless of device timezone)
// ---------------------------------------------------------------------------
const IST_OFFSET_MS = 330 * 60 * 1000;
const istDateAt = (dayOffset: number, hour: number): Date => {
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate() + dayOffset, hour, 0, 0) - IST_OFFSET_MS
  );
};
const inMinutes = (m: number) => new Date(Date.now() + m * 60 * 1000);

const ETA_QUICK_PICKS: { label: string; get: () => Date }[] = [
  { label: '30 min', get: () => inMinutes(30) },
  { label: '1 h', get: () => inMinutes(60) },
  { label: '2 h', get: () => inMinutes(120) },
  { label: '4 h', get: () => inMinutes(240) },
  { label: 'Today 6 PM', get: () => istDateAt(0, 18) },
  { label: 'Tomorrow 10 AM', get: () => istDateAt(1, 10) },
];

/** Date -> value for <input type="datetime-local"> (device local time). */
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fmt = (d: Date | string) =>
  new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
const Chip: React.FC<{ active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  disabled,
  onClick,
  children,
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
      active ? 'bg-accent text-white border-accent' : 'bg-white text-gray-700 border-gray-200 hover:border-accent/50'
    }`}
  >
    {children}
  </button>
);

const SheetShell: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, footer, children }) =>
  // Portal: the drawer panel is animated (transform), which would otherwise trap position:fixed
  createPortal(
  <div
    data-ticket-action-sheet
    onKeyDown={e => {
      if (e.key === 'Escape') onClose();
    }}
    className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in duration-150"
    onClick={e => {
      e.stopPropagation();
      onClose();
    }}
  >
    <div
      className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] pb-[env(safe-area-inset-bottom)]"
      onClick={e => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 text-base">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title="Close">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">{children}</div>
      <div className="px-4 py-3 border-t border-gray-100 flex gap-2 justify-end">{footer}</div>
    </div>
  </div>,
    document.body
  );

const EtaPicker: React.FC<{ value: Date | null; onChange: (d: Date | null) => void }> = ({ value, onChange }) => {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">ETA</label>
      <div className="flex flex-wrap gap-2">
        {ETA_QUICK_PICKS.map(q => {
          const d = q.get();
          const past = d.getTime() <= Date.now() + 60 * 1000;
          return (
            <Chip
              key={q.label}
              active={picked === q.label}
              disabled={past}
              onClick={() => {
                setPicked(q.label);
                onChange(q.get());
              }}
            >
              {q.label}
            </Chip>
          );
        })}
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Or pick a date & time</label>
        <input
          type="datetime-local"
          className="form-input w-full text-sm"
          min={toLocalInput(new Date())}
          value={value && picked === 'custom' ? toLocalInput(value) : ''}
          onChange={e => {
            setPicked('custom');
            onChange(e.target.value ? new Date(e.target.value) : null);
          }}
        />
      </div>
      {value && (
        <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-accent" /> ETA: {fmt(value)} IST
        </p>
      )}
    </div>
  );
};

const ReasonPicker: React.FC<{
  label: string;
  chips: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, chips, value, onChange, placeholder }) => (
  <div className="space-y-2">
    <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</label>
    <div className="flex flex-wrap gap-2">
      {chips.map(c => (
        <Chip key={c} active={value === c} onClick={() => onChange(c)}>
          {c}
        </Chip>
      ))}
    </div>
    <textarea
      className="form-input w-full text-sm min-h-[70px]"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || 'Or type a reason…'}
      maxLength={500}
    />
  </div>
);

// ---------------------------------------------------------------------------
// Action bar
// ---------------------------------------------------------------------------
export const TicketActionBar: React.FC<TicketActionBarProps> = ({ ticket, onChanged, onToast }) => {
  const [canWork, setCanWork] = useState(false);
  const [canReassign, setCanReassign] = useState(false);
  const [permLoaded, setPermLoaded] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);

  // form state (reset whenever a sheet opens)
  const [eta, setEta] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  // reassign
  const [present, setPresent] = useState<HelpdeskPresentStaff[]>([]);
  const [allUsers, setAllUsers] = useState<HelpdeskUserOption[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  // resolve
  const [photos, setPhotos] = useState<string[]>([]); // compressed JPEG data URLs
  const [capturing, setCapturing] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locState, setLocState] = useState<'idle' | 'locating' | 'ok' | 'unavailable'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFinal = ticket.status === 'Resolved' || ticket.status === 'Closed';

  useEffect(() => {
    let cancelled = false;
    setPermLoaded(false);
    if (isFinal) {
      setCanWork(false);
      setCanReassign(false);
      setPermLoaded(true);
      return;
    }
    Promise.all([helpdeskActionsApi.canAct(ticket.id, 'work'), helpdeskActionsApi.canAct(ticket.id, 'reassign')]).then(
      ([w, r]) => {
        if (cancelled) return;
        setCanWork(w);
        setCanReassign(r);
        setPermLoaded(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [ticket.id, ticket.status, ticket.assignedTo, isFinal]);

  const openSheet = (s: Exclude<Sheet, null>) => {
    setEta(null);
    setReason('');
    setNote('');
    setTargetUserId(null);
    setUserSearch('');
    setPhotos([]);
    setSheet(s);

    if (s === 'reassign') loadStaff();
    if (s === 'resolve') locate();
  };
  const closeSheet = () => {
    if (!busy) setSheet(null);
  };

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      onToast(successMsg, 'success');
      setSheet(null);
      await onChanged();
    } catch (err: any) {
      onToast(err?.message || 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  // ---- reassign data
  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      const [p, u] = await Promise.all([
        ticket.channelSiteId ? helpdeskActionsApi.getPresentStaff(ticket.channelSiteId).catch(() => []) : Promise.resolve([]),
        allUsers.length ? Promise.resolve(allUsers) : helpdeskActionsApi.getUsers().catch(() => []),
      ]);
      setPresent(p);
      setAllUsers(u);
    } finally {
      setStaffLoading(false);
    }
  };

  const otherUsers = useMemo(() => {
    const presentIds = new Set(present.map(p => p.userId));
    const term = userSearch.trim().toLowerCase();
    return allUsers
      .filter(u => !presentIds.has(u.id))
      .filter(u => !term || u.name.toLowerCase().includes(term) || (u.roleId || '').toLowerCase().includes(term))
      .slice(0, 50);
  }, [allUsers, present, userSearch]);

  const filteredPresent = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    return present.filter(p => !term || p.name.toLowerCase().includes(term));
  }, [present, userSearch]);

  // ---- resolve: geolocation (best effort, never blocks)
  const locate = () => {
    setCoords(null);
    setLocState('locating');
    getPrecisePosition(150, 8000)
      .then(pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocState('ok');
      })
      .catch(() => setLocState('unavailable'));
  };

  // ---- resolve: photo capture
  const addDataUrl = async (dataUrl: string) => {
    const { dataUri } = await compressBase64Client(dataUrl, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.8,
      format: 'image/jpeg',
    });
    setPhotos(prev => (prev.length >= MAX_PHOTOS ? prev : [...prev, dataUri]));
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      onToast(`Maximum ${MAX_PHOTOS} photos`, 'error');
      return;
    }
    if (!Capacitor.isNativePlatform()) {
      fileInputRef.current?.click();
      return;
    }
    setCapturing(true);
    try {
      const image = await CapacitorCamera.getPhoto({
        quality: 80,
        allowEditing: false,
        correctOrientation: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });
      if (image.dataUrl) await addDataUrl(image.dataUrl);
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (!/cancel/i.test(msg)) {
        console.warn('Camera unavailable:', err);
        onToast('Camera unavailable. Check camera permission.', 'error');
      }
    } finally {
      setCapturing(false);
    }
  };

  const onFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!files.length) return;
    setCapturing(true);
    try {
      for (const file of files.slice(0, MAX_PHOTOS - photos.length)) {
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(file);
        });
        await addDataUrl(dataUrl);
      }
    } catch (err) {
      console.warn('Photo read failed', err);
      onToast('Could not read the photo', 'error');
    } finally {
      setCapturing(false);
    }
  };

  const submitResolve = () =>
    run(async () => {
      const paths: string[] = [];
      try {
        for (let i = 0; i < photos.length; i++) {
          paths.push(await helpdeskActionsApi.uploadAfterPhoto(ticket.id, dataUrlToBlob(photos[i]), i + 1));
        }
        await helpdeskActionsApi.resolveTicket(ticket.id, note.trim() || null, paths, coords?.lat, coords?.lng);
      } catch (err) {
        // Don't leave orphan photos in storage when the upload batch or the resolve fails
        await helpdeskActionsApi.removeUploadedPhotos(paths);
        throw err;
      }
    }, 'Ticket marked resolved');

  // -------------------------------------------------------------------------
  if (isFinal) return null;
  if (!permLoaded) {
    return (
      <div className="px-4 sm:px-6 py-3 border-t border-gray-100 bg-white flex items-center gap-2 text-xs text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking permissions…
      </div>
    );
  }
  if (!canWork && !canReassign) return null;

  const isOpen = ticket.status === 'Open';
  const isOnHold = ticket.status === 'On Hold';
  const btn =
    'flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0 sm:flex-none px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50';
  const subtitle = `${ticket.ticketNumber || ''} · ${ticket.title}`;

  return (
    <>
      <div className="px-4 sm:px-6 py-3 border-t border-gray-100 bg-white flex flex-wrap gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {canWork && (isOpen || isOnHold) && (
          <button type="button" className={`${btn} bg-accent text-white hover:opacity-90`} onClick={() => openSheet('accept')}>
            <PlayCircle className="w-4 h-4" /> {isOnHold ? 'Resume & set ETA' : 'Accept & set ETA'}
          </button>
        )}
        {canWork && !isOpen && (
          <button
            type="button"
            className={`${btn} bg-white text-gray-800 border border-gray-200 hover:bg-gray-50`}
            onClick={() => openSheet('eta')}
          >
            <Clock className="w-4 h-4" /> Change ETA
          </button>
        )}
        {canWork && !isOnHold && (
          <button
            type="button"
            className={`${btn} bg-white text-gray-800 border border-gray-200 hover:bg-gray-50`}
            onClick={() => openSheet('hold')}
          >
            <PauseCircle className="w-4 h-4" /> Put on hold
          </button>
        )}
        {canReassign && (
          <button
            type="button"
            className={`${btn} bg-white text-gray-800 border border-gray-200 hover:bg-gray-50`}
            onClick={() => openSheet('reassign')}
          >
            <UserCog className="w-4 h-4" /> Reassign
          </button>
        )}
        {canWork && (
          <button
            type="button"
            className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
            onClick={() => openSheet('resolve')}
          >
            <CheckCircle2 className="w-4 h-4" /> Mark resolved
          </button>
        )}
      </div>

      {/* Accept / resume */}
      {sheet === 'accept' && (
        <SheetShell
          title={isOnHold ? 'Resume & set ETA' : 'Accept & set ETA'}
          subtitle={subtitle}
          onClose={closeSheet}
          footer={
            <>
              <button type="button" className="btn btn-outline btn-md" onClick={closeSheet} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-md"
                disabled={busy || !eta}
                onClick={() => eta && run(() => helpdeskActionsApi.acceptTicket(ticket.id, eta.toISOString()), 'Ticket accepted')}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />} Accept
              </button>
            </>
          }
        >
          <p className="text-xs text-gray-500">The client is told when to expect the fix.</p>
          <EtaPicker value={eta} onChange={setEta} />
        </SheetShell>
      )}

      {/* Change ETA */}
      {sheet === 'eta' && (
        <SheetShell
          title="Change ETA"
          subtitle={subtitle}
          onClose={closeSheet}
          footer={
            <>
              <button type="button" className="btn btn-outline btn-md" onClick={closeSheet} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-md"
                disabled={busy || !eta || !reason.trim()}
                onClick={() =>
                  eta && run(() => helpdeskActionsApi.setEta(ticket.id, eta.toISOString(), reason.trim()), 'ETA updated')
                }
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />} Update ETA
              </button>
            </>
          }
        >
          {ticket.etaAt && <p className="text-xs text-gray-500">Current ETA: {fmt(ticket.etaAt)} IST</p>}
          <EtaPicker value={eta} onChange={setEta} />
          <ReasonPicker label="Reason (required)" chips={REASON_CHIPS} value={reason} onChange={setReason} />
        </SheetShell>
      )}

      {/* Hold */}
      {sheet === 'hold' && (
        <SheetShell
          title="Put on hold"
          subtitle={subtitle}
          onClose={closeSheet}
          footer={
            <>
              <button type="button" className="btn btn-outline btn-md" onClick={closeSheet} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-md"
                disabled={busy || !reason.trim()}
                onClick={() => run(() => helpdeskActionsApi.holdTicket(ticket.id, reason.trim()), 'Ticket put on hold')}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />} Put on hold
              </button>
            </>
          }
        >
          <ReasonPicker label="Pending reason (required)" chips={REASON_CHIPS} value={reason} onChange={setReason} />
        </SheetShell>
      )}

      {/* Reassign */}
      {sheet === 'reassign' && (
        <SheetShell
          title="Reassign ticket"
          subtitle={ticket.assignedToName ? `Currently: ${ticket.assignedToName}` : subtitle}
          onClose={closeSheet}
          footer={
            <>
              <button type="button" className="btn btn-outline btn-md" onClick={closeSheet} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-md"
                disabled={busy || !targetUserId || !reason.trim()}
                onClick={() =>
                  targetUserId &&
                  run(() => helpdeskActionsApi.reassignTicket(ticket.id, targetUserId, reason.trim()), 'Ticket reassigned')
                }
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />} Reassign
              </button>
            </>
          }
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="form-input w-full pl-9 text-sm"
              placeholder="Search staff…"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
            />
          </div>

          {staffLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 mb-1.5">On site now</p>
                {filteredPresent.length === 0 ? (
                  <p className="text-xs text-gray-400">Nobody is punched in at this site.</p>
                ) : (
                  <ul className="border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden">
                    {filteredPresent.map(p => (
                      <li key={p.userId}>
                        <button
                          type="button"
                          onClick={() => setTargetUserId(p.userId)}
                          className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 ${
                            targetUserId === p.userId ? 'bg-accent/10' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-gray-800 truncate">
                              {p.name}
                              {p.userId === ticket.assignedTo && <span className="ml-1 text-[10px] text-gray-400">(current)</span>}
                            </span>
                            <span className="block text-[11px] text-gray-500">
                              {[p.tier ? p.tier.charAt(0).toUpperCase() + p.tier.slice(1) : p.roleId, p.lastInAt && `on site since ${fmtTime(p.lastInAt)}`]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.openTickets > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {p.openTickets} open
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Not on site</p>
                {otherUsers.length === 0 ? (
                  <p className="text-xs text-gray-400">No matching users.</p>
                ) : (
                  <ul className="border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden max-h-60 overflow-y-auto">
                    {otherUsers.map(u => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => setTargetUserId(u.id)}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 ${
                            targetUserId === u.id ? 'bg-accent/10' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-sm text-gray-800 truncate">
                            {u.name}
                            {u.id === ticket.assignedTo && <span className="ml-1 text-[10px] text-gray-400">(current)</span>}
                          </span>
                          {u.roleId && <span className="shrink-0 text-[10px] text-gray-400">{u.roleId.replace(/_/g, ' ')}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!userSearch && allUsers.length > 50 && (
                  <p className="text-[11px] text-gray-400 mt-1">Showing 50 — search to find others.</p>
                )}
              </div>
            </>
          )}

          <ReasonPicker label="Reason (required)" chips={REASSIGN_CHIPS} value={reason} onChange={setReason} />
        </SheetShell>
      )}

      {/* Resolve */}
      {sheet === 'resolve' && (
        <SheetShell
          title="Mark resolved"
          subtitle={subtitle}
          onClose={closeSheet}
          footer={
            <>
              <button type="button" className="btn btn-outline btn-md" onClick={closeSheet} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-md !bg-emerald-600 hover:!bg-emerald-700"
                disabled={busy || capturing || photos.length === 0}
                onClick={submitResolve}
                title={photos.length === 0 ? 'Photo proof is required' : undefined}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />} {busy ? 'Uploading…' : 'Resolve'}
              </button>
            </>
          }
        >
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">After photo (required)</label>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                  <img src={p} alt={`After photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
                    title="Remove photo"
                    disabled={busy}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={takePhoto}
                  disabled={capturing || busy}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-accent hover:text-accent flex flex-col items-center justify-center gap-1 text-[11px] font-semibold disabled:opacity-50"
                >
                  {capturing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                  {photos.length ? 'Add photo' : 'Take photo'}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={onFilesPicked}
            />
            {photos.length === 0 && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Photo proof is required — take a photo of the completed work.
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
              Resolution note (optional)
            </label>
            <textarea
              className="form-input w-full text-sm min-h-[70px]"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What was done?"
              maxLength={1000}
            />
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <MapPin className="w-3.5 h-3.5" />
            {locState === 'locating'
              ? 'Getting location…'
              : locState === 'ok'
              ? 'Location attached to the photo'
              : 'Location unavailable — the ticket can still be resolved'}
          </p>
        </SheetShell>
      )}
    </>
  );
};

export default TicketActionBar;
