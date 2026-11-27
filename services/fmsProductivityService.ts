/**
 * FMS Productivity Command Center: live data aggregation.
 *
 * Builds one snapshot for components/dashboard/FmsProductivityDashboard.tsx
 * from existing tables via the existing typed services. Every section carries
 * `live: true` when its source query succeeded; if a query fails (missing
 * table, RLS denial, offline) the section comes back `live: false` with empty
 * values so the UI can show an honest "No data" state instead of fake numbers.
 *
 * Site scope: the selected site is an `entities.id`. Ops tables (tickets,
 * schedules, contracts, assets) filter on entity_id. Snag audits store the site
 * as free text (`name_of_site`), so they are matched by entity name. Gate tables
 * key on organization_id and are NOT site-filtered yet (see plan §6).
 */
import { supabase } from './supabase';
import { opsApi } from './opsApi';
import { enterpriseApi } from './enterpriseApi';
import type { OpsTicket, OpsMaintenanceSchedule, OpsContract, OpsAsset, SnagEntry } from '../types/operations';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Section<T> { live: boolean; data: T }

export interface TicketItem {
  id: string;
  label: string;          // ticket number or short id
  title: string;
  site: string;
  priority: string;
  assignee: string;
  dueAt: string;          // ISO; UI computes countdown / overdue from this
}

export interface FmsSnapshot {
  generatedAt: string;
  tickets: Section<{
    overdueHighPriority: TicketItem[];   // #6
    overdueHighPriorityCount: number;
    slaThreats: TicketItem[];            // #7: due within 2h, not breached yet
    breachedCount: number;
    openCount: number;
    createdToday: number;                // #8
    closedToday: number;
    hotspots: { title: string; site: string; count: number }[]; // #10
  }>;
  ppm: Section<{
    queue: { id: string; equip: string; site: string; frequency: string; role: string; status: 'Completed' | 'Due Today' | 'Delayed' }[]; // #11
    dueTodayCount: number;
    delayedCount: number;                // #12
    activeCount: number;
  }>;
  assets: Section<{
    qrCompliancePct: number | null;      // #13: inspected/scanned in last 30d
    inspectedCount: number;
    activeCount: number;
    byCategory: { category: string; total: number; operational: number; pct: number; worstStatus: string }[]; // #14
  }>;
  contracts: Section<{
    expiring: { id: string; vendor: string; site: string; daysLeft: number; type: string }[]; // #15
  }>;
  snags: Section<{
    openCount: number;
    under3Days: number; between3And7: number; over7Days: number; // #21
    hazards: { id: string; title: string; site: string; severity: string }[];          // #22
    correctiveActions: { id: string; title: string; site: string; ageDays: number }[]; // #9
  }>;
  approvals: Section<{
    total: number;                        // #26
    leaveCount: number;
    opsCount: number;
    gatePassCount: number;
    items: { id: string; kind: 'Leave' | 'Approval' | 'Gate Pass'; title: string; subtitle: string }[];
  }>;
  gate: Section<{
    incidents: { id: string; type: string; location: string; time: string; resolved: boolean }[]; // #27
    entriesToday: number;
    overstays: number;
  }>;
  patrol: Section<{
    ratePct: number | null;               // #17
    checkpointsHit: number;
    checkpointsTotal: number;
  }>;
  score: {                                 // #30
    value: number | null;
    tasksPct: number | null;
    ppmPct: number | null;
    slaPct: number | null;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const OPEN_STATUSES = new Set(['Open', 'In Progress', 'On Hold']);
const HIGH_PRIORITIES = new Set(['P1', 'P2']);
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
const norm = (s?: string) => (s || '').trim().toLowerCase();

async function settle<T>(p: Promise<T>, label: string): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await p };
  } catch (e) {
    console.warn(`[FMS productivity] ${label} unavailable`, e);
    return { ok: false };
  }
}

/** Throws on Supabase error so `settle` marks the section as not live. */
async function q<T>(builder: PromiseLike<{ data: T | null; error: any; count?: number | null }>) {
  const { data, error, count } = await builder;
  if (error) throw error;
  return { data: data as T, count: count ?? 0 };
}

const toTicketItem = (t: OpsTicket): TicketItem => ({
  id: t.id,
  label: t.ticketNumber || t.id.slice(0, 8).toUpperCase(),
  title: t.title,
  site: t.entityName || '—',
  priority: t.priority,
  assignee: t.assignedToName || 'Unassigned',
  dueAt: (t.resolutionDueAt || t.dueDate) as string,
});

// ─── Section builders ───────────────────────────────────────────────────────

function buildTickets(tickets: OpsTicket[]): FmsSnapshot['tickets']['data'] {
  const now = Date.now();
  const today = startOfToday().getTime();
  const open = tickets.filter(t => OPEN_STATUSES.has(t.status));
  const dueOf = (t: OpsTicket) => {
    const d = t.resolutionDueAt || t.dueDate;
    return d ? new Date(d).getTime() : NaN;
  };

  const overdue = open
    .filter(t => HIGH_PRIORITIES.has(t.priority) && dueOf(t) < now)
    .sort((a, b) => dueOf(a) - dueOf(b));

  const threats = open
    .filter(t => { const d = dueOf(t); return d >= now && d - now <= 2 * 3_600_000; })
    .sort((a, b) => dueOf(a) - dueOf(b));

  const breachedCount = open.filter(t => dueOf(t) < now).length;
  const createdToday = tickets.filter(t => t.createdAt && new Date(t.createdAt).getTime() >= today).length;
  const closedToday = tickets.filter(t => t.resolvedAt && new Date(t.resolvedAt).getTime() >= today).length;

  // #10 hotspots: same site + category raised 2+ times in the last 7 days
  const weekAgo = now - 7 * DAY_MS;
  const groups = new Map<string, { title: string; site: string; count: number }>();
  tickets
    .filter(t => t.createdAt && new Date(t.createdAt).getTime() >= weekAgo)
    .forEach(t => {
      const site = t.entityName || '—';
      const key = `${site}|${t.category}`;
      const g = groups.get(key) || { title: String(t.category), site, count: 0 };
      g.count += 1;
      groups.set(key, g);
    });
  const hotspots = [...groups.values()].filter(g => g.count >= 2).sort((a, b) => b.count - a.count).slice(0, 3);

  return {
    overdueHighPriority: overdue.slice(0, 3).map(toTicketItem),
    overdueHighPriorityCount: overdue.length,
    slaThreats: threats.slice(0, 3).map(toTicketItem),
    breachedCount,
    openCount: open.length,
    createdToday,
    closedToday,
    hotspots,
  };
}

function buildPpm(schedules: OpsMaintenanceSchedule[]): FmsSnapshot['ppm']['data'] {
  const todayStr = ymd(new Date());
  const active = schedules.filter(s => s.status === 'Active');
  const rows = active
    .map(s => {
      const next = s.nextDueDate?.slice(0, 10);
      const last = s.lastCompletedDate?.slice(0, 10);
      let status: 'Completed' | 'Due Today' | 'Delayed' | null = null;
      if (last === todayStr) status = 'Completed';
      else if (next && next < todayStr) status = 'Delayed';
      else if (next === todayStr) status = 'Due Today';
      return status ? { s, status } : null;
    })
    .filter((r): r is { s: OpsMaintenanceSchedule; status: 'Completed' | 'Due Today' | 'Delayed' } => !!r);

  const order = { Delayed: 0, 'Due Today': 1, Completed: 2 } as const;
  rows.sort((a, b) => order[a.status] - order[b.status]);

  return {
    queue: rows.slice(0, 6).map(({ s, status }) => ({
      id: s.id,
      equip: s.assetReference ? `${s.taskName} (${s.assetReference})` : s.taskName,
      site: s.entityName || '—',
      frequency: s.frequency,
      role: s.assignedRole || 'Unassigned',
      status,
    })),
    dueTodayCount: rows.filter(r => r.status === 'Due Today').length,
    delayedCount: rows.filter(r => r.status === 'Delayed').length,
    activeCount: active.length,
  };
}

function buildAssets(assets: OpsAsset[]): FmsSnapshot['assets']['data'] {
  const active = assets.filter(a => a.status !== 'Decommissioned');
  const cutoff = Date.now() - 30 * DAY_MS;
  const inspected = active.filter(a => a.lastInspectedAt && new Date(a.lastInspectedAt).getTime() >= cutoff);

  const severity: Record<string, number> = { Operational: 0, 'Under Maintenance': 1, 'Critical Fault': 2 };
  const byCat = new Map<string, { total: number; operational: number; worst: string }>();
  active.forEach(a => {
    const c = byCat.get(a.category) || { total: 0, operational: 0, worst: 'Operational' };
    c.total += 1;
    if (a.status === 'Operational') c.operational += 1;
    if ((severity[a.status] ?? 0) > (severity[c.worst] ?? 0)) c.worst = a.status;
    byCat.set(a.category, c);
  });

  return {
    qrCompliancePct: pct(inspected.length, active.length),
    inspectedCount: inspected.length,
    activeCount: active.length,
    byCategory: [...byCat.entries()]
      .map(([category, c]) => ({ category, total: c.total, operational: c.operational, pct: pct(c.operational, c.total) ?? 0, worstStatus: c.worst }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 4),
  };
}

function buildContracts(contracts: OpsContract[]): FmsSnapshot['contracts']['data'] {
  const today = startOfToday().getTime();
  return {
    expiring: contracts
      .filter(c => c.endDate && c.status !== 'Terminated' && c.status !== 'Renewed')
      .map(c => ({ c, daysLeft: Math.ceil((new Date(c.endDate).getTime() - today) / DAY_MS) }))
      .filter(({ daysLeft }) => daysLeft >= 0 && daysLeft <= 60)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 4)
      .map(({ c, daysLeft }) => ({
        id: c.id,
        vendor: c.vendorName || c.contractTitle,
        site: c.entityName || '—',
        daysLeft,
        type: c.contractType,
      })),
  };
}

function buildSnags(snags: SnagEntry[], siteName?: string): FmsSnapshot['snags']['data'] {
  const now = Date.now();
  const scoped = siteName ? snags.filter(s => norm(s.nameOfSite) === norm(siteName)) : snags;
  const open = scoped.filter(s => s.status !== 'Resolved');
  const ageDays = (s: SnagEntry) => Math.floor((now - new Date(s.createdAt || s.timestamp).getTime()) / DAY_MS);

  const byAge = [...open].sort((a, b) => ageDays(b) - ageDays(a));
  return {
    openCount: open.length,
    under3Days: open.filter(s => ageDays(s) < 3).length,
    between3And7: open.filter(s => { const d = ageDays(s); return d >= 3 && d <= 7; }).length,
    over7Days: open.filter(s => ageDays(s) > 7).length,
    hazards: byAge
      .filter(s => s.criticality === 'High')
      .slice(0, 3)
      .map(s => ({ id: s.id, title: s.snagDescription, site: s.nameOfSite, severity: s.criticality })),
    correctiveActions: byAge
      .filter(s => s.actionToBeTaken)
      .slice(0, 3)
      .map(s => ({ id: s.id, title: s.actionToBeTaken, site: s.nameOfSite, ageDays: ageDays(s) })),
  };
}

// ─── Direct queries (no existing service function) ─────────────────────────

async function fetchApprovals(entityId?: string): Promise<FmsSnapshot['approvals']['data']> {
  const [ops, leaves, passes] = await Promise.all([
    enterpriseApi.getApprovalRequests(undefined, 'Pending'),
    q<any[]>(
      supabase
        .from('leave_requests')
        .select('id, user_id, leave_type, start_date, end_date, status', { count: 'exact' })
        .like('status', 'pending%')
        .order('created_at', { ascending: false })
        .limit(3),
    ),
    q<any[]>(
      supabase
        .from('gate_material_passes')
        .select('id, pass_number, movement_type, transporter_name', { count: 'exact' })
        .in('status', ['draft', 'issued'])
        .eq('office_noc_approved', false)
        .order('created_at', { ascending: false })
        .limit(2),
    ),
  ]);

  const opsScoped = entityId ? ops.filter(o => o.entityId === entityId) : ops;

  // Resolve leave applicant names in one query
  const userIds = [...new Set((leaves.data || []).map(l => l.user_id).filter(Boolean))];
  const names: Record<string, string> = {};
  if (userIds.length) {
    const { data } = await supabase.from('users').select('id, name').in('id', userIds);
    (data || []).forEach((u: any) => { names[u.id] = u.name; });
  }

  const items: FmsSnapshot['approvals']['data']['items'] = [
    ...(leaves.data || []).map(l => ({
      id: `leave-${l.id}`,
      kind: 'Leave' as const,
      title: `Leave: ${names[l.user_id] || 'Employee'}`,
      subtitle: `${l.leave_type || 'Leave'} • ${l.start_date}${l.end_date && l.end_date !== l.start_date ? ` → ${l.end_date}` : ''}`,
    })),
    ...opsScoped.slice(0, 2).map(o => ({
      id: `ops-${o.id}`,
      kind: 'Approval' as const,
      title: o.title,
      subtitle: `${o.moduleName}${o.entityName ? ` • ${o.entityName}` : ''}`,
    })),
    ...(passes.data || []).map(p => ({
      id: `pass-${p.id}`,
      kind: 'Gate Pass' as const,
      title: `Material ${p.movement_type} pass ${p.pass_number}`,
      subtitle: p.transporter_name || 'Awaiting office NOC',
    })),
  ].slice(0, 4);

  return {
    total: leaves.count + opsScoped.length + passes.count,
    leaveCount: leaves.count,
    opsCount: opsScoped.length,
    gatePassCount: passes.count,
    items,
  };
}

const ALERT_LABELS: Record<string, string> = {
  fire: 'Fire Alarm',
  medical: 'Medical Emergency',
  security_threat: 'Security Threat',
  lift_entrapment: 'Lift Entrapment',
  gas_leak: 'Gas Leak',
  general_panic: 'Panic / SOS',
};

async function fetchGate(): Promise<FmsSnapshot['gate']['data']> {
  const todayIso = startOfToday().toISOString();
  const overstayIso = new Date(Date.now() - 4 * 3_600_000).toISOString();
  const [alerts, entries, overstays] = await Promise.all([
    q<any[]>(
      supabase
        .from('gate_emergency_alerts')
        .select('id, alert_type, location_description, is_active, created_at')
        .gte('created_at', todayIso)
        .order('created_at', { ascending: false })
        .limit(4),
    ),
    q<any[]>(supabase.from('gate_entries').select('id', { count: 'exact', head: true }).gte('entry_time', todayIso)),
    q<any[]>(
      supabase
        .from('gate_entries')
        .select('id', { count: 'exact', head: true })
        .is('exit_time', null)
        .gte('entry_time', todayIso)
        .lt('entry_time', overstayIso),
    ),
  ]);

  return {
    incidents: (alerts.data || []).map(a => ({
      id: a.id,
      type: ALERT_LABELS[a.alert_type] || a.alert_type,
      location: a.location_description || '—',
      time: a.created_at,
      resolved: !a.is_active,
    })),
    entriesToday: entries.count,
    overstays: overstays.count,
  };
}

async function fetchPatrol(): Promise<FmsSnapshot['patrol']['data']> {
  const sinceIso = new Date(Date.now() - DAY_MS).toISOString();
  const [checkpoints, scans] = await Promise.all([
    q<any[]>(supabase.from('gate_patrol_checkpoints').select('id', { count: 'exact', head: true }).eq('active', true)),
    q<any[]>(supabase.from('gate_patrol_scans').select('checkpoint_id').gte('scan_time', sinceIso).limit(5000)),
  ]);
  const hit = new Set((scans.data || []).map(s => s.checkpoint_id)).size;
  return { ratePct: pct(hit, checkpoints.count), checkpointsHit: hit, checkpointsTotal: checkpoints.count };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function getFmsSnapshot(entityId?: string, siteName?: string): Promise<FmsSnapshot> {
  const [tickets, schedules, assets, contracts, snags, approvals, gate, patrol] = await Promise.all([
    settle(opsApi.getTickets(entityId), 'tickets'),
    settle(opsApi.getMaintenanceSchedules(entityId), 'maintenance schedules'),
    settle(opsApi.getAssets(entityId), 'assets'),
    settle(opsApi.getContracts(entityId), 'contracts'),
    settle(opsApi.getSnagEntries(), 'snags'),
    settle(fetchApprovals(entityId), 'approvals'),
    settle(fetchGate(), 'gate'),
    settle(fetchPatrol(), 'patrol'),
  ]);

  const section = <S, T>(r: { ok: true; value: S } | { ok: false }, build: (v: S) => T, empty: T): Section<T> =>
    r.ok ? { live: true, data: build(r.value) } : { live: false, data: empty };
  const id = <T,>(v: T) => v;

  const ticketsS = section(tickets, buildTickets, buildTickets([]));
  const ppmS = section(schedules, buildPpm, buildPpm([]));

  // #30 composite: equal weights over the components that have data
  const t = ticketsS.data;
  const tasksPct = ticketsS.live ? pct(t.closedToday, Math.max(t.createdToday, t.closedToday)) : null;
  const ppmPct = ppmS.live ? pct(ppmS.data.activeCount - ppmS.data.delayedCount, ppmS.data.activeCount) : null;
  const slaPct = ticketsS.live ? pct(t.openCount - t.breachedCount, t.openCount) : null;
  const parts = [tasksPct, ppmPct, slaPct].filter((v): v is number => v !== null);

  return {
    generatedAt: new Date().toISOString(),
    tickets: ticketsS,
    ppm: ppmS,
    assets: section(assets, buildAssets, buildAssets([])),
    contracts: section(contracts, buildContracts, buildContracts([])),
    snags: section(snags, (v: SnagEntry[]) => buildSnags(v, entityId ? siteName : undefined), buildSnags([])),
    approvals: section(approvals, id, { total: 0, leaveCount: 0, opsCount: 0, gatePassCount: 0, items: [] }),
    gate: section(gate, id, { incidents: [], entriesToday: 0, overstays: 0 }),
    patrol: section(patrol, id, { ratePct: null, checkpointsHit: 0, checkpointsTotal: 0 }),
    score: {
      value: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null,
      tasksPct,
      ppmPct,
      slaPct,
    },
  };
}

/** Tables whose changes should trigger a snapshot refetch. */
export const FMS_REALTIME_TABLES = [
  'ops_tickets',
  'ops_maintenance_schedules',
  'ops_maintenance_logs',
  'ops_assets',
  'ops_contracts',
  'snag_audits',
  'ops_approval_requests',
  'leave_requests',
  'gate_material_passes',
  'gate_emergency_alerts',
  'gate_entries',
  'gate_patrol_scans',
] as const;
