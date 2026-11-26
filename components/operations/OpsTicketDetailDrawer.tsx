import React, { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  MessageCircle,
  Users,
  History,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Lock,
  Sparkles,
  Clock,
  User,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  PauseCircle,
} from 'lucide-react';
import type {
  OpsTicket,
  TicketEvent,
  TicketReporter,
  TicketMedia,
  TicketMediaKind,
} from '../../types/operations';
import { ticketTimelineApi, maskPhone } from '../../services/ticketTimelineApi';
import { TicketActionBar } from './TicketActionBar';
import Toast from '../ui/Toast';

interface OpsTicketDetailDrawerProps {
  ticket: OpsTicket;
  isOpen: boolean;
  onClose: () => void;
  /** Admins see unmasked reporter phone numbers. */
  canViewFullPhone?: boolean;
  /** Refresh the ticket list / ticket object after a staff action (accept, ETA, hold, reassign, resolve). */
  onTicketUpdated?: () => Promise<void> | void;
}

const EVENT_LABELS: Record<string, string> = {
  created: 'Ticket created',
  duplicate_report: 'Reported again (duplicate merged)',
  priority_bumped: 'Priority raised',
  media_added: 'Photo added',
  assigned: 'Assigned',
  eta_set: 'ETA set',
  eta_changed: 'ETA changed',
  on_hold: 'Put on hold',
  reassigned: 'Reassigned',
  resolved: 'Marked resolved',
  client_confirmed: 'Client confirmed fix',
  reopened: 'Reopened by client',
  auto_closed: 'Auto-closed',
  escalated: 'Escalated',
  assignment_failed: 'Auto-assignment failed',
  assignee_checked_out: 'Assignee checked out',
  message: 'Message',
};

const EVENT_DOT: Record<string, string> = {
  created: 'bg-blue-500',
  duplicate_report: 'bg-amber-500',
  priority_bumped: 'bg-red-500',
  media_added: 'bg-purple-500',
  assigned: 'bg-emerald-500',
  eta_set: 'bg-cyan-500',
  eta_changed: 'bg-cyan-500',
  on_hold: 'bg-gray-500',
  reassigned: 'bg-emerald-500',
  resolved: 'bg-green-600',
  client_confirmed: 'bg-green-700',
  reopened: 'bg-red-500',
  auto_closed: 'bg-slate-500',
  escalated: 'bg-red-600',
  assignment_failed: 'bg-red-500',
  assignee_checked_out: 'bg-amber-500',
  message: 'bg-gray-400',
};

const MEDIA_KINDS: { kind: TicketMediaKind; label: string }[] = [
  { kind: 'before', label: 'Before' },
  { kind: 'progress', label: 'Progress' },
  { kind: 'after', label: 'After' },
];

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  email: 'Email',
  app: 'App',
};

export const channelLabel = (channel?: string | null) =>
  CHANNEL_LABELS[(channel || 'app').toLowerCase()] || channel || 'App';

const friendlyEventLabel = (type: string) =>
  EVENT_LABELS[type] || type.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** Short extra detail derived from known event payloads (besides payload.text). */
const eventDetail = (ev: TicketEvent): string | null => {
  const p = ev.payload || {};
  switch (ev.eventType) {
    case 'priority_bumped':
      return [p.from && `from ${p.from}`, p.report_count && `${p.report_count} reporters`].filter(Boolean).join(' · ') || null;
    case 'eta_set':
      return p.eta_at || p.eta ? `ETA ${formatDateTime(p.eta_at || p.eta)}` : null;
    case 'eta_changed':
      return [p.eta && `ETA ${formatDateTime(p.eta)}`, p.reason].filter(Boolean).join(' · ') || null;
    case 'on_hold':
      return p.reason || null;
    case 'assigned':
    case 'reassigned':
      return (
        [
          p.to_name || p.assigned_to_name || p.name,
          p.note || (p.reason && p.reason !== 'new_ticket' ? String(p.reason).replace(/_/g, ' ') : null),
        ]
          .filter(Boolean)
          .join(' · ') || null
      );
    case 'resolved':
      return [p.photos ? `${p.photos} photo${p.photos === 1 ? '' : 's'}` : null, p.note].filter(Boolean).join(' · ') || null;
    case 'client_confirmed':
    case 'reopened':
      return [p.reopen_count ? `#${p.reopen_count}` : null, p.comment].filter(Boolean).join(' · ') || null;
    case 'auto_closed':
      return p.reason === 'no_client_response' ? 'No reply from client' : p.reason || null;
    case 'escalated':
      return [p.level && `Level ${p.level}`, p.reason].filter(Boolean).join(' · ') || null;
    case 'assignment_failed':
      return p.reason ? String(p.reason).replace(/_/g, ' ') : null;
    case 'media_added':
      return p.kind ? `${String(p.kind)} photo` : null;
    case 'created':
      return p.channel ? `via ${channelLabel(p.channel)}` : null;
    default:
      return null;
  }
};

const Section: React.FC<{ icon: React.ElementType; title: string; right?: React.ReactNode; children: React.ReactNode }> = ({
  icon: Icon,
  title,
  right,
  children,
}) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
        <Icon className="w-4 h-4 text-gray-400" /> {title}
      </h3>
      {right}
    </div>
    {children}
  </section>
);

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
    <dd className="text-sm font-medium text-gray-800 break-words">{value || <span className="text-gray-300">—</span>}</dd>
  </div>
);

export const OpsTicketDetailDrawer: React.FC<OpsTicketDetailDrawerProps> = ({
  ticket,
  isOpen,
  onClose,
  canViewFullPhone = false,
  onTicketUpdated,
}) => {
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [reporters, setReporters] = useState<TicketReporter[]>([]);
  const [media, setMedia] = useState<TicketMedia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [ev, rep, med] = await Promise.all([
        ticketTimelineApi.getTicketEvents(ticket.id),
        ticketTimelineApi.getTicketReporters(ticket.id),
        ticketTimelineApi.getTicketMedia(ticket.id),
      ]);
      setEvents(ev);
      setReporters(rep);
      setMedia(med);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ticket.id]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // An action sheet (accept / ETA / hold / reassign / resolve) handles its own Escape
      if (document.querySelector('[data-ticket-action-sheet]')) return;
      if (previewUrl) setPreviewUrl(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, previewUrl, onClose]);

  if (!isOpen) return null;

  const refreshAll = async () => {
    await Promise.all([load(), Promise.resolve(onTicketUpdated?.())]);
  };

  const isFinal = ticket.status === 'Resolved' || ticket.status === 'Closed';
  const etaTarget = ticket.etaAt || ticket.resolutionDueAt || null;
  const isOverdue = !isFinal && !!etaTarget && new Date(etaTarget).getTime() < Date.now();
  const isChannelTicket = !!ticket.channelSiteId;

  const showPhone = (phone?: string | null) => (phone ? (canViewFullPhone ? phone : maskPhone(phone)) : null);
  const confidence =
    ticket.extractionConfidence != null && !Number.isNaN(Number(ticket.extractionConfidence))
      ? `${Math.round(Number(ticket.extractionConfidence) * 100)}%`
      : null;

  // Fall back to the ticket's primary reporter if no ticket_reporters rows exist (e.g. app tickets)
  const reporterList: TicketReporter[] =
    reporters.length > 0
      ? reporters
      : ticket.reporterContactId || ticket.reporterContactName
      ? [
          {
            ticketId: ticket.id,
            contactId: ticket.reporterContactId || 'primary',
            displayName: ticket.reporterContactName || ticket.reportedByName,
            phone: ticket.reporterContactPhone || ticket.reportedByPhone,
            reportedAt: ticket.createdAt,
          },
        ]
      : [];

  const mediaByKind = MEDIA_KINDS.map(k => ({ ...k, items: media.filter(m => m.kind === k.kind) })).filter(
    g => g.items.length > 0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Ticket ${ticket.ticketNumber || ''} details`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-accent">{ticket.ticketNumber}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-700">{ticket.priority}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">{ticket.status}</span>
              {ticket.sourceChannel === 'whatsapp' && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">
                  <MessageCircle className="w-3 h-3" /> WhatsApp
                </span>
              )}
            </div>
            <h2 className="mt-1 text-base sm:text-lg font-bold text-gray-900 break-words">{ticket.title}</h2>
            <div className="mt-2 flex items-center gap-x-3 gap-y-1.5 flex-wrap text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-gray-400" />
                {ticket.assignedToName ||
                  (ticket.assignedTo ? 'Assigned' : <span className="text-red-600 font-semibold">Unassigned</span>)}
              </span>
              {etaTarget && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  {ticket.etaAt ? 'ETA' : 'Due'} {formatDateTime(etaTarget)}
                  {isOverdue && (
                    <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white uppercase">
                      Overdue
                    </span>
                  )}
                </span>
              )}
              {(ticket.reopenCount ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                  <RotateCcw className="w-3 h-3" /> Reopened {ticket.reopenCount}x
                </span>
              )}
            </div>
            {ticket.assignmentNote && (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {ticket.assignmentNote}
              </p>
            )}
            {ticket.status === 'On Hold' && ticket.pendingReason && (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5">
                <PauseCircle className="w-3.5 h-3.5 shrink-0 mt-px" /> On hold: {ticket.pendingReason}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={refreshAll}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 transition"
              title="Refresh"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 transition" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-7">
          {ticket.description && <p className="text-sm text-gray-600 whitespace-pre-wrap">{ticket.description}</p>}

          {/* Location & source */}
          <Section icon={MapPin} title="Location & source">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-gray-50 border border-gray-100 rounded-xl p-4">
              <Field label="Site" value={ticket.channelSiteName || ticket.entityName} />
              <Field label="Tower" value={ticket.tower} />
              <Field label="Floor" value={ticket.floor} />
              <Field label="Area" value={ticket.area} />
              <Field label="Channel" value={channelLabel(ticket.sourceChannel)} />
              <Field
                label="AI confidence"
                value={
                  confidence && (
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" /> {confidence}
                    </span>
                  )
                }
              />
              {ticket.issueType && <Field label="Issue type" value={ticket.issueType.replace(/_/g, ' ')} />}
              {ticket.etaAt && <Field label="ETA" value={formatDateTime(ticket.etaAt)} />}
              {ticket.pendingReason && <Field label="Pending reason" value={ticket.pendingReason} />}
              {ticket.resolutionNote && <Field label="Resolution note" value={ticket.resolutionNote} />}
              {ticket.clientConfirmedAt && <Field label="Client confirmed" value={formatDateTime(ticket.clientConfirmedAt)} />}
            </dl>
          </Section>

          {/* Reporters */}
          <Section
            icon={Users}
            title="Reporters"
            right={
              (ticket.reportCount ?? 1) > 1 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Reported by {ticket.reportCount}
                </span>
              ) : undefined
            }
          >
            {isLoading && reporters.length === 0 ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
              </div>
            ) : reporterList.length === 0 ? (
              <p className="text-xs text-gray-400">No channel reporters recorded for this ticket.</p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {reporterList.map(r => (
                  <li key={r.contactId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{r.displayName || 'Unknown contact'}</p>
                        {r.phone && <p className="text-xs font-mono text-gray-500">{showPhone(r.phone)}</p>}
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 text-right">{formatDateTime(r.reportedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Timeline */}
          <Section icon={History} title="Timeline">
            {isLoading && events.length === 0 ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
              </div>
            ) : events.length === 0 ? (
              <p className="text-xs text-gray-400">No timeline events yet.</p>
            ) : (
              <ol className="relative border-l border-gray-200 ml-2 space-y-4">
                {events.map(ev => {
                  const detail = eventDetail(ev);
                  const text = typeof ev.payload?.text === 'string' ? ev.payload.text : null;
                  const actor = ev.actorUserName || ev.actorContactName;
                  return (
                    <li key={ev.id} className="ml-4">
                      <span
                        className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                          EVENT_DOT[ev.eventType] || 'bg-gray-400'
                        }`}
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{friendlyEventLabel(ev.eventType)}</span>
                        {ev.isInternal && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-white">
                            <Lock className="w-2.5 h-2.5" /> Internal
                          </span>
                        )}
                        {detail && <span className="text-xs text-gray-500">{detail}</span>}
                      </div>
                      <p className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                        <Clock className="w-3 h-3" /> {formatDateTime(ev.createdAt)}
                        {actor && <span>· {actor}</span>}
                      </p>
                      {text && (
                        <p
                          className={`mt-1.5 text-sm whitespace-pre-wrap rounded-lg px-3 py-2 ${
                            ev.isInternal ? 'bg-slate-50 border border-slate-200 text-slate-700' : 'bg-green-50 border border-green-100 text-gray-700'
                          }`}
                        >
                          {text}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>

          {/* Photos */}
          <Section icon={ImageIcon} title="Photos">
            {isLoading && media.length === 0 ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
              </div>
            ) : mediaByKind.length === 0 ? (
              <p className="text-xs text-gray-400">No photos attached.</p>
            ) : (
              <div className="space-y-4">
                {mediaByKind.map(group => (
                  <div key={group.kind}>
                    <p className="text-[11px] font-bold text-gray-500 mb-2">
                      {group.label} <span className="font-normal text-gray-400">({group.items.length})</span>
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {group.items.map(m =>
                        m.signedUrl ? (
                          <button
                            key={m.id}
                            onClick={() => setPreviewUrl(m.signedUrl!)}
                            className="aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100 hover:ring-2 hover:ring-accent/50 transition"
                            title={formatDateTime(m.createdAt)}
                          >
                            <img src={m.signedUrl} alt={`${group.label} photo`} className="w-full h-full object-cover" loading="lazy" />
                          </button>
                        ) : (
                          <div
                            key={m.id}
                            className="aspect-square rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 text-center p-1"
                          >
                            Unavailable
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Staff actions (channel / WhatsApp tickets only) */}
        {isChannelTicket && (
          <TicketActionBar
            ticket={ticket}
            onChanged={refreshAll}
            onToast={(message, type) => setToast({ message, type })}
          />
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Photo preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={e => {
            e.stopPropagation();
            setPreviewUrl(null);
          }}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={e => {
              e.stopPropagation();
              setPreviewUrl(null);
            }}
            title="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          <img src={previewUrl} alt="Ticket photo" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
};

export default OpsTicketDetailDrawer;
