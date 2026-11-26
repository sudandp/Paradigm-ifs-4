import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, Edit3, Check, X, Loader2, RefreshCw, Search, Power, UserPlus, AlertTriangle, Info, ShieldAlert, Radio,
} from 'lucide-react';
import {
  fetchSiteAssignees, fetchPresentStaff, fetchSiteManagers, searchStaff,
  upsertSiteAssignee, updateSiteAssignee, setSiteAssigneeActive, deleteSiteAssignee,
  ASSIGNEE_TIERS, HELPDESK_CATEGORIES,
  type AssigneeTier, type ChannelSite, type PresentStaff, type SiteTicketAssignee, type StaffOption,
} from '../../../services/helpdeskChannelApi';
import { Badge, EmptyState, Field, btnPrimary, btnSecondary, cardCls, inputCls } from './helpdeskUi';

interface Props {
  sites: ChannelSite[];
  siteId: string;
  canEdit: boolean;
  onSiteChange: (id: string) => void;
}

const tierTone: Record<AssigneeTier, 'blue' | 'green' | 'amber'> = { technician: 'blue', supervisor: 'green', manager: 'amber' };
const tierLabel: Record<AssigneeTier, string> = { technician: 'Technicians', supervisor: 'Supervisors', manager: 'Managers' };

const formatRole = (role?: string | null) => (role ? role.replace(/_/g, ' ') : '');

/** "10:42 AM (2h 5m)" in IST. */
const formatSinceIst = (iso?: string | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const time = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${time} IST (${h ? `${h}h ` : ''}${m}m)`;
};

const categoriesText = (cats?: string[] | null) => (!cats || !cats.length ? 'All categories' : cats.join(', '));

/** Chip multi-select; "All" = empty array. */
const CategoryPicker: React.FC<{ value: string[]; onChange: (v: string[]) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter(x => x !== c) : [...value, c]);
  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${active ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted hover:bg-page'}`;
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" disabled={disabled} className={chip(value.length === 0)} onClick={() => onChange([])}>All</button>
      {HELPDESK_CATEGORIES.map(c => (
        <button key={c} type="button" disabled={disabled} className={chip(value.includes(c))} onClick={() => toggle(c)}>{c}</button>
      ))}
    </div>
  );
};

const AssigneesTab: React.FC<Props> = ({ sites, siteId, canEdit, onSiteChange }) => {
  const site = useMemo(() => sites.find(s => s.id === siteId) || null, [sites, siteId]);

  const [assignees, setAssignees] = useState<SiteTicketAssignee[]>([]);
  const [present, setPresent] = useState<PresentStaff[]>([]);
  const [managers, setManagers] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [presentLoading, setPresentLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(true);

  // Add form
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StaffOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<StaffOption | null>(null);
  const [newTier, setNewTier] = useState<AssigneeTier>('technician');
  const [newCats, setNewCats] = useState<string[]>([]);
  const searchSeq = useRef(0);

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editTier, setEditTier] = useState<AssigneeTier>('technician');
  const [editCats, setEditCats] = useState<string[]>([]);

  const loadAssignees = useCallback(async () => {
    if (!siteId) { setAssignees([]); setManagers([]); return; }
    setLoading(true);
    try {
      const [a, m] = await Promise.all([
        fetchSiteAssignees(siteId),
        fetchSiteManagers(siteId).catch(e => { console.warn('[AssigneesTab] managers:', e); return [] as StaffOption[]; }),
      ]);
      setAssignees(a);
      setManagers(m);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load assignees');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  const loadPresent = useCallback(async () => {
    if (!siteId) { setPresent([]); return; }
    setPresentLoading(true);
    try {
      setPresent(await fetchPresentStaff(siteId));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load on-site staff');
    } finally {
      setPresentLoading(false);
    }
  }, [siteId]);

  const reloadAll = useCallback(() => { loadAssignees(); loadPresent(); }, [loadAssignees, loadPresent]);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  // Refresh the live panel every minute while the tab is open.
  useEffect(() => {
    if (!siteId) return undefined;
    const t = window.setInterval(loadPresent, 60000);
    return () => window.clearInterval(t);
  }, [siteId, loadPresent]);

  // Debounced staff search
  useEffect(() => {
    if (picked) return undefined;
    const term = query.trim();
    if (term.length < 2) { setResults([]); return undefined; }
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await searchStaff(term, 20);
        if (seq === searchSeq.current) setResults(r);
      } catch (e: any) {
        if (seq === searchSeq.current) toast.error(e?.message || 'Search failed');
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [query, picked]);

  const assigneeByUser = useMemo(() => new Map(assignees.map(a => [a.user_id, a])), [assignees]);

  const grouped = useMemo(() => {
    const visible = assignees.filter(a => showInactive || a.is_active);
    return ASSIGNEE_TIERS.map(tier => ({
      tier,
      rows: visible
        .filter(a => a.tier === tier)
        .sort((x, y) => Number(y.is_active) - Number(x.is_active) || (x.user?.name || '').localeCompare(y.user?.name || '')),
    }));
  }, [assignees, showInactive]);

  const resetAdd = () => { setPicked(null); setQuery(''); setResults([]); setNewCats([]); };

  const handleAdd = async () => {
    if (!siteId || !picked) { toast.error('Pick a staff member first'); return; }
    setSaving(true);
    try {
      const existing = assigneeByUser.get(picked.id);
      await upsertSiteAssignee(siteId, picked.id, { tier: newTier, categories: newCats, is_active: true });
      toast.success(existing ? `${picked.name} updated` : `${picked.name} added as ${newTier}`);
      resetAdd();
      reloadAll();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const quickAddTechnician = async (p: PresentStaff) => {
    if (!siteId) return;
    setSaving(true);
    try {
      await upsertSiteAssignee(siteId, p.user_id, { tier: 'technician', categories: [], is_active: true });
      toast.success(`${p.name || 'Staff'} added as technician (all categories)`);
      reloadAll();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (a: SiteTicketAssignee) => {
    setEditId(a.id);
    setEditTier(a.tier);
    setEditCats(a.categories || []);
  };

  const saveEdit = async (a: SiteTicketAssignee) => {
    setSaving(true);
    try {
      await updateSiteAssignee(a.id, { tier: editTier, categories: editCats });
      setEditId(null);
      toast.success('Assignee updated');
      reloadAll();
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: SiteTicketAssignee) => {
    try {
      await setSiteAssigneeActive(a.id, !a.is_active);
      toast.success(a.is_active ? 'Assignee deactivated' : 'Assignee activated');
      reloadAll();
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    }
  };

  const handleDelete = async (a: SiteTicketAssignee) => {
    if (!window.confirm(`Remove ${a.user?.name || 'this person'} from this site's assignees?`)) return;
    try {
      await deleteSiteAssignee(a.id);
      toast.success('Assignee removed');
      reloadAll();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Site" className="w-full sm:max-w-sm">
          <select className={inputCls} value={siteId} onChange={e => onSiteChange(e.target.value)}>
            <option value="">- Select a site -</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.display_name} ({s.site_code}){s.is_active ? '' : ' - inactive'}</option>)}
          </select>
        </Field>
        {siteId && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {ASSIGNEE_TIERS.map(t => (
              <Badge key={t} tone={tierTone[t]}>{assignees.filter(a => a.tier === t && a.is_active).length} {t}s</Badge>
            ))}
            <button type="button" className={btnSecondary} onClick={reloadAll} title="Refresh">
              {loading || presentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>

      {!siteId ? (
        <EmptyState>Select a site to configure who handles its WhatsApp tickets (technicians, supervisors and managers).</EmptyState>
      ) : (
        <>
          <div className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>
              Tickets are auto-assigned to present technicians for the category (least busy first), then present supervisors,
              then the site supervisor/ops manager from the Site Responsibility Matrix. "Present" means the person's latest
              attendance event today (IST) is a punch-in.
            </span>
          </div>

          {site && !site.location_id && (
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>
                This site has no <strong>geo location</strong> linked. Configured assignees below are still matched by their
                punch-in (anywhere, regardless of geofence), but unconfigured staff are only detected via the site's location,
                and Site Responsibility Matrix escalation contacts cannot be resolved. Link a location in <em>Sites &amp; QR</em> &rarr; Edit.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            {/* Add staff */}
            <div className={`${cardCls} space-y-3 p-4 lg:col-span-2`}>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary-text"><UserPlus className="h-4 w-4 text-accent" /> Add staff</h3>
              <Field label="Staff member">
                {picked ? (
                  <div className="flex items-center gap-2 rounded-lg border border-accent bg-card px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-primary-text">{picked.name}</p>
                      <p className="truncate text-[11px] text-muted">{[formatRole(picked.role_id), picked.phone].filter(Boolean).join(' - ')}</p>
                    </div>
                    <button type="button" className="text-muted hover:text-primary-text" onClick={resetAdd} title="Clear"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input className={`${inputCls} pl-9`} placeholder="Search by name or phone" value={query}
                      onChange={e => setQuery(e.target.value)} disabled={!canEdit} />
                    {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />}
                  </div>
                )}
              </Field>
              {!picked && query.trim().length >= 2 && (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                  {!results.length ? (
                    <p className="p-3 text-xs text-muted">{searching ? 'Searching...' : 'No staff found.'}</p>
                  ) : results.map(u => {
                    const existing = assigneeByUser.get(u.id);
                    return (
                      <button key={u.id} type="button"
                        className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-page"
                        onClick={() => {
                          setPicked(u);
                          if (existing) { setNewTier(existing.tier); setNewCats(existing.categories || []); }
                        }}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-primary-text">{u.name}</p>
                          <p className="truncate text-[11px] text-muted">{[formatRole(u.role_id), u.phone].filter(Boolean).join(' - ')}</p>
                        </div>
                        {existing && <Badge tone={existing.is_active ? tierTone[existing.tier] : 'gray'}>{existing.tier}</Badge>}
                      </button>
                    );
                  })}
                </div>
              )}
              <Field label="Tier">
                <select className={inputCls} value={newTier} onChange={e => setNewTier(e.target.value as AssigneeTier)} disabled={!canEdit}>
                  {ASSIGNEE_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <div>
                <span className="mb-1 block text-xs font-semibold text-muted">Categories</span>
                <CategoryPicker value={newCats} onChange={setNewCats} disabled={!canEdit} />
                <span className="mt-1 block text-[11px] text-muted">
                  "All" handles every category. Categories matter for technicians; supervisors and managers take any category.
                </span>
              </div>
              {picked && assigneeByUser.has(picked.id) && (
                <p className="text-[11px] text-amber-700">Already configured for this site - saving updates their tier/categories and re-activates them.</p>
              )}
              <button type="button" className={`${btnPrimary} w-full`} onClick={handleAdd} disabled={!canEdit || !picked || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save assignee
              </button>
            </div>

            {/* On site now */}
            <div className={`${cardCls} flex flex-col p-4 lg:col-span-3`}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary-text">
                  <Radio className="h-4 w-4 text-emerald-600" /> On site now
                </h3>
                <span className="text-xs text-muted">{present.length} present</span>
                <button type="button" className="ml-auto text-muted hover:text-primary-text" onClick={loadPresent} title="Refresh">
                  {presentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </button>
              </div>
              {!present.length ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted">
                  {presentLoading ? 'Checking attendance...' : 'Nobody is punched in at this site right now. New tickets will go to the escalation contacts.'}
                </p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {present
                    .slice()
                    .sort((a, b) => (a.tier ? ASSIGNEE_TIERS.indexOf(a.tier) : 9) - (b.tier ? ASSIGNEE_TIERS.indexOf(b.tier) : 9) || a.open_tickets - b.open_tickets)
                    .map(p => (
                      <div key={p.user_id} className="flex flex-col gap-1.5 p-2.5 sm:flex-row sm:items-center sm:gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-primary-text">{p.name || 'Unnamed'}</span>
                            {p.tier ? <Badge tone={tierTone[p.tier]}>{p.tier}</Badge> : <Badge tone="gray">not configured</Badge>}
                          </div>
                          <p className="truncate text-[11px] text-muted">
                            {[formatRole(p.role_id), p.tier === 'technician' ? categoriesText(p.categories) : null, `in since ${formatSinceIst(p.last_in_at)}`]
                              .filter(Boolean).join(' - ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <Badge tone={p.open_tickets ? 'amber' : 'green'}>{p.open_tickets} open</Badge>
                          {!p.tier && canEdit && (
                            <button type="button" className={`${btnSecondary} px-2 py-1 text-xs`} disabled={saving} onClick={() => quickAddTechnician(p)}>
                              <Plus className="h-3.5 w-3.5" /> Add as technician
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <div className="mt-4">
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <ShieldAlert className="h-4 w-4" /> Escalation contacts
                </h4>
                {!managers.length ? (
                  <p className="text-xs text-amber-700">
                    None. Add a supervisor/manager here, or set the site supervisor / ops manager in the Site Responsibility Matrix
                    {site && !site.location_id ? ' (requires a linked geo location)' : ''}.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {managers.map(m => (
                      <span key={m.id} className="rounded-full border border-border bg-page px-2.5 py-1 text-xs text-primary-text" title={m.phone || ''}>
                        {m.name}{m.role_id ? <span className="text-muted"> - {formatRole(m.role_id)}</span> : null}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted">
                  Active supervisors/managers configured here plus the Site Responsibility Matrix. They receive escalations and take tickets when nobody suitable is on site.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
          </div>

          {!assignees.length ? (
            <EmptyState>{loading ? 'Loading...' : 'No assignees configured for this site yet.'}</EmptyState>
          ) : (
            <div className="space-y-3">
              {grouped.map(g => (
                <div key={g.tier} className={cardCls}>
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <Badge tone={tierTone[g.tier]}>{tierLabel[g.tier]}</Badge>
                    <span className="text-xs text-muted">{g.rows.length}</span>
                  </div>
                  {!g.rows.length ? (
                    <p className="p-3 text-xs italic text-muted">None</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {g.rows.map(a => {
                        const isEditing = editId === a.id;
                        const isPresent = present.some(p => p.user_id === a.user_id);
                        return (
                          <div key={a.id} className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-center ${a.is_active ? '' : 'opacity-60'}`}>
                            <div className="min-w-0 sm:w-56 sm:flex-shrink-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-primary-text">{a.user?.name || 'Unknown user'}</span>
                                {isPresent && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" title="On site now" />}
                                {!a.is_active && <Badge tone="gray">inactive</Badge>}
                              </div>
                              <p className="truncate text-[11px] text-muted">{[formatRole(a.user?.role_id), a.user?.phone].filter(Boolean).join(' - ')}</p>
                            </div>
                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <select className={`${inputCls} sm:w-44`} value={editTier} onChange={e => setEditTier(e.target.value as AssigneeTier)}>
                                    {ASSIGNEE_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                  <CategoryPicker value={editCats} onChange={setEditCats} />
                                </div>
                              ) : !a.categories.length ? (
                                <span className="text-xs text-muted">All categories</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {a.categories.map(c => <span key={c} className="rounded bg-page px-1.5 py-0.5 text-[11px] text-primary-text">{c}</span>)}
                                </div>
                              )}
                            </div>
                            {canEdit && (
                              <div className="flex gap-1 self-end sm:self-auto">
                                {isEditing ? (
                                  <>
                                    <button type="button" className={btnPrimary} onClick={() => saveEdit(a)} disabled={saving} title="Save"><Check className="h-4 w-4" /></button>
                                    <button type="button" className={btnSecondary} onClick={() => setEditId(null)} title="Cancel"><X className="h-4 w-4" /></button>
                                  </>
                                ) : (
                                  <>
                                    <button type="button" className={btnSecondary} onClick={() => startEdit(a)} title="Edit"><Edit3 className="h-4 w-4" /></button>
                                    <button type="button" className={btnSecondary} onClick={() => toggleActive(a)} title={a.is_active ? 'Deactivate' : 'Activate'}>
                                      <Power className={`h-4 w-4 ${a.is_active ? 'text-red-600' : 'text-emerald-600'}`} />
                                    </button>
                                    <button type="button" className={btnSecondary} onClick={() => handleDelete(a)} title="Remove"><Trash2 className="h-4 w-4 text-red-600" /></button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AssigneesTab;
