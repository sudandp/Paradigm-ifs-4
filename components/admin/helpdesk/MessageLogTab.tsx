import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw, Loader2, AlertTriangle, Inbox, BellRing } from 'lucide-react';
import {
  fetchInboundMessages, INBOUND_STATUSES, fetchTicketNotifications, NOTIFICATION_STATUSES,
  type ChannelSite, type InboundMessageRow, type InboundStatus, type NotificationStatus, type TicketNotificationRow,
} from '../../../services/helpdeskChannelApi';
import { Badge, EmptyState, btnSecondary, cardCls, formatDateTime, inputCls } from './helpdeskUi';

interface Props {
  sites: ChannelSite[];
}

const statusTone: Record<InboundStatus, 'green' | 'red' | 'amber' | 'blue' | 'gray'> = {
  processed: 'green',
  failed: 'red',
  review: 'amber',
  awaiting_info: 'blue',
  pending: 'gray',
  processing: 'gray',
  ignored: 'gray',
};

const IMPORTANT: InboundStatus[] = ['review', 'failed', 'awaiting_info'];

const InboundLog: React.FC<Props> = ({ sites }) => {
  const [rows, setRows] = useState<InboundMessageRow[]>([]);
  const [status, setStatus] = useState<InboundStatus | ''>('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const siteById = useMemo(() => new Map(sites.map(s => [s.id, s])), [sites]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchInboundMessages(status, 200));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load message log');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const m: Partial<Record<InboundStatus, number>> = {};
    rows.forEach(r => { m[r.status] = (m[r.status] || 0) + 1; });
    return m;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setStatus('')}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === '' ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted hover:bg-page'}`}>
            All
          </button>
          {IMPORTANT.map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === s ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted hover:bg-page'}`}>
              {s.replace('_', ' ')}{status === '' && counts[s] ? ` (${counts[s]})` : ''}
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <select className={`${inputCls} sm:w-44`} value={status} onChange={e => setStatus(e.target.value as InboundStatus | '')}>
            <option value="">Any status</option>
            {INBOUND_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className={btnSecondary} onClick={load} title="Refresh">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted">Last 200 inbound messages, newest first. Read-only.</p>

      {!rows.length ? (
        <EmptyState>{loading ? 'Loading...' : 'No messages for this filter.'}</EmptyState>
      ) : (
        <div className={`${cardCls} divide-y divide-border`}>
          {rows.map(r => {
            const site = r.site_id ? siteById.get(r.site_id) : undefined;
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge tone={statusTone[r.status] || 'gray'}>{r.status}</Badge>
                  <span className="text-sm font-semibold text-primary-text">{r.sender_name || 'Unknown'}</span>
                  <span className="font-mono text-xs text-muted">+{r.sender_id}</span>
                  {site && <span className="rounded bg-page px-1.5 py-0.5 font-mono text-[11px] text-primary-text">{site.site_code}</span>}
                  <span className="text-[11px] uppercase text-muted">{r.channel} / {r.msg_type}</span>
                  <span className="ml-auto whitespace-nowrap text-xs text-muted">{formatDateTime(r.received_at)}</span>
                </div>
                <button type="button" onClick={() => setExpanded(isOpen ? null : r.id)} className="mt-1 block w-full text-left">
                  <p className={`whitespace-pre-wrap break-words text-sm text-primary-text ${isOpen ? '' : 'line-clamp-2'}`}>
                    {r.body || <span className="italic text-muted">({r.msg_type} message, no text)</span>}
                  </p>
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  {r.ticket_id && (
                    <Link to={`/operations/tickets?ticket=${r.ticket_id}`} className="font-semibold text-accent hover:underline">
                      {r.ticket_number || 'View ticket'}
                    </Link>
                  )}
                  {r.attempts > 1 && <span className="text-muted">{r.attempts} attempts</span>}
                  {r.processed_at && <span className="text-muted">processed {formatDateTime(r.processed_at)}</span>}
                </div>
                {r.error && (
                  <div className="mt-2 flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span className="break-words">{r.error}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


const notificationTone: Record<NotificationStatus, 'green' | 'red' | 'amber' | 'blue' | 'gray'> = {
  sent: 'green',
  failed: 'red',
  pending: 'amber',
  processing: 'blue',
  skipped: 'gray',
};

const audienceLabel: Record<TicketNotificationRow['audience'], string> = {
  client: 'Client (WhatsApp)',
  assignee: 'Assignee',
  managers: 'Managers',
};

const NOTIFICATION_CHIPS: NotificationStatus[] = ['pending', 'failed', 'skipped', 'sent'];

const NotificationLog: React.FC = () => {
  const [rows, setRows] = useState<TicketNotificationRow[]>([]);
  const [status, setStatus] = useState<NotificationStatus | ''>('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchTicketNotifications(status, 200));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const m: Partial<Record<NotificationStatus, number>> = {};
    rows.forEach(r => { m[r.status] = (m[r.status] || 0) + 1; });
    return m;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setStatus('')}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === '' ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted hover:bg-page'}`}>
            All
          </button>
          {NOTIFICATION_CHIPS.map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === s ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted hover:bg-page'}`}>
              {s}{status === '' && counts[s] ? ` (${counts[s]})` : ''}
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <select className={`${inputCls} sm:w-44`} value={status} onChange={e => setStatus(e.target.value as NotificationStatus | '')}>
            <option value="">Any status</option>
            {NOTIFICATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className={btnSecondary} onClick={load} title="Refresh">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted">
        Last 200 outgoing ticket notifications (WhatsApp to clients, push to staff), newest first. Failed rows are retried up to 3 times. Read-only.
      </p>

      {!rows.length ? (
        <EmptyState>{loading ? 'Loading...' : 'No notifications for this filter.'}</EmptyState>
      ) : (
        <div className={`${cardCls} divide-y divide-border`}>
          {rows.map(r => (
            <div key={r.id} className="p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge tone={notificationTone[r.status] || 'gray'}>{r.status}</Badge>
                <span className="text-sm font-semibold text-primary-text">{r.event.replace(/_/g, ' ')}</span>
                <span className="text-[11px] uppercase text-muted">{audienceLabel[r.audience] || r.audience}</span>
                <Link to={`/operations/tickets?ticket=${r.ticket_id}`} className="text-xs font-semibold text-accent hover:underline">
                  {r.ticket_number || 'View ticket'}
                </Link>
                <span className="ml-auto whitespace-nowrap text-xs text-muted">{formatDateTime(r.created_at)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                {r.attempts > 0 && <span>{r.attempts} attempt{r.attempts === 1 ? '' : 's'}</span>}
                {r.sent_at && <span>sent {formatDateTime(r.sent_at)}</span>}
              </div>
              {r.error && (
                <div className={`mt-2 flex gap-2 rounded-lg px-3 py-2 text-xs ${r.status === 'skipped' ? 'bg-page text-muted' : 'bg-red-50 text-red-800'}`}>
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span className="break-words">{r.error}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

type LogView = 'inbound' | 'notifications';

const MessageLogTab: React.FC<Props> = ({ sites }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: LogView = searchParams.get('view') === 'notifications' ? 'notifications' : 'inbound';

  const setView = (v: LogView) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'inbound') next.delete('view'); else next.set('view', v);
    setSearchParams(next, { replace: true });
  };

  const views: { key: LogView; label: string; icon: React.ElementType }[] = [
    { key: 'inbound', label: 'Inbound messages', icon: Inbox },
    { key: 'notifications', label: 'Notifications', icon: BellRing },
  ];

  return (
    <div className="space-y-4">
      <div className="inline-flex w-full rounded-lg border border-border bg-page p-1 sm:w-auto">
        {views.map(v => {
          const Icon = v.icon;
          const active = view === v.key;
          return (
            <button key={v.key} type="button" onClick={() => setView(v.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:flex-none ${active ? 'bg-card text-accent shadow-sm' : 'text-muted hover:text-primary-text'}`}>
              <Icon className="h-4 w-4" /> {v.label}
            </button>
          );
        })}
      </div>
      {view === 'inbound' ? <InboundLog sites={sites} /> : <NotificationLog />}
    </div>
  );
};

export default MessageLogTab;
