import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit3, Check, X, Wand2, Loader2 } from 'lucide-react';
import {
  fetchSiteLocations, upsertSiteLocations, updateSiteLocation, deleteSiteLocation,
  buildTowerPresets, buildFloorPresets, parseAliases,
  type ChannelSite, type SiteLocation, type SiteLocationKind,
} from '../../../services/helpdeskChannelApi';
import { Badge, EmptyState, Field, btnPrimary, btnSecondary, cardCls, inputCls } from './helpdeskUi';

interface Props {
  sites: ChannelSite[];
  siteId: string;
  onSiteChange: (id: string) => void;
}

const KINDS: SiteLocationKind[] = ['tower', 'floor', 'area'];
const kindTone: Record<SiteLocationKind, 'blue' | 'green' | 'amber'> = { tower: 'blue', floor: 'green', area: 'amber' };

const LocationsTab: React.FC<Props> = ({ sites, siteId, onSiteChange }) => {
  const [rows, setRows] = useState<SiteLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kindFilter, setKindFilter] = useState<SiteLocationKind | ''>('');

  // New row form
  const [newKind, setNewKind] = useState<SiteLocationKind>('tower');
  const [newValue, setNewValue] = useState('');
  const [newAliases, setNewAliases] = useState('');

  // Quick add
  const [towerCount, setTowerCount] = useState(4);
  const [towerPrefix, setTowerPrefix] = useState('T');
  const [floorCount, setFloorCount] = useState(10);
  const [includeGround, setIncludeGround] = useState(true);

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editAliases, setEditAliases] = useState('');

  const load = useCallback(async () => {
    if (!siteId) { setRows([]); return; }
    setLoading(true);
    try {
      setRows(await fetchSiteLocations(siteId));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const order: Record<string, number> = { tower: 0, floor: 1, area: 2 };
    const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
    return rows
      .filter(r => !kindFilter || r.kind === kindFilter)
      .sort((a, b) => order[a.kind] - order[b.kind] || natural(a.value, b.value));
  }, [rows, kindFilter]);

  const counts = useMemo(() => KINDS.reduce((acc, k) => ({ ...acc, [k]: rows.filter(r => r.kind === k).length }), {} as Record<SiteLocationKind, number>), [rows]);

  const runUpsert = async (items: Parameters<typeof upsertSiteLocations>[1], msg: string) => {
    setSaving(true);
    try {
      const n = await upsertSiteLocations(siteId, items);
      toast.success(`${msg} (${n})`);
      await load();
      return true;
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newValue.trim()) { toast.error('Enter a canonical value, e.g. T1, G, 1, LOBBY'); return; }
    const ok = await runUpsert([{ kind: newKind, value: newValue, aliases: parseAliases(newAliases) }], 'Location saved');
    if (ok) { setNewValue(''); setNewAliases(''); }
  };

  const handleQuickTowers = () => {
    const n = Math.min(Math.max(1, Math.round(towerCount) || 1), 50);
    const prefix = (towerPrefix || 'T').toUpperCase().replace(/[^A-Z]/g, '') || 'T';
    runUpsert(buildTowerPresets(n, prefix), `Towers ${prefix}1-${prefix}${n} saved`);
  };

  const handleQuickFloors = () => {
    const n = Math.min(Math.max(0, Math.round(floorCount) || 0), 100);
    runUpsert(buildFloorPresets(n, includeGround), 'Floors saved');
  };

  const startEdit = (r: SiteLocation) => {
    setEditId(r.id);
    setEditValue(r.value);
    setEditAliases(r.aliases.join(', '));
  };

  const saveEdit = async (r: SiteLocation) => {
    try {
      await updateSiteLocation(r.id, { kind: r.kind, value: editValue, aliases: parseAliases(editAliases) });
      setEditId(null);
      toast.success('Location updated');
      load();
    } catch (e: any) {
      toast.error(String(e?.message || '').includes('duplicate') ? 'That value already exists for this kind' : e?.message || 'Update failed');
    }
  };

  const handleDelete = async (r: SiteLocation) => {
    if (!window.confirm(`Delete ${r.kind} "${r.value}"?`)) return;
    try {
      await deleteSiteLocation(r.id);
      setRows(prev => prev.filter(x => x.id !== r.id));
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
          <div className="flex flex-wrap gap-2 text-xs text-muted sm:ml-auto">
            {KINDS.map(k => <span key={k}><Badge tone={kindTone[k]}>{counts[k] || 0} {k}s</Badge></span>)}
          </div>
        )}
      </div>

      {!siteId ? (
        <EmptyState>Select a site to manage its towers, floors and areas. The bot uses these (and their aliases) to read locations from messages.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className={`${cardCls} space-y-3 p-4 lg:col-span-1`}>
              <h3 className="text-sm font-semibold text-primary-text">Add / update one</h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Kind">
                  <select className={inputCls} value={newKind} onChange={e => setNewKind(e.target.value as SiteLocationKind)}>
                    {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label="Canonical value">
                  <input className={`${inputCls} font-mono uppercase`} value={newValue} placeholder="T1 / G / LOBBY"
                    onChange={e => setNewValue(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                </Field>
              </div>
              <Field label="Aliases (comma-separated)" hint="Lower-cased automatically. e.g. tower 1, t-1, block a">
                <input className={inputCls} value={newAliases} placeholder="tower 1, t-1, block a"
                  onChange={e => setNewAliases(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
              </Field>
              <button type="button" className={`${btnPrimary} w-full`} onClick={handleAdd} disabled={saving}>
                <Plus className="h-4 w-4" /> Save location
              </button>
            </div>

            <div className={`${cardCls} space-y-3 p-4`}>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary-text"><Wand2 className="h-4 w-4 text-accent" /> Quick add towers</h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Prefix"><input className={`${inputCls} font-mono uppercase`} maxLength={3} value={towerPrefix} onChange={e => setTowerPrefix(e.target.value.toUpperCase())} /></Field>
                <Field label="How many"><input type="number" min={1} max={50} className={inputCls} value={towerCount} onChange={e => setTowerCount(Number(e.target.value))} /></Field>
              </div>
              <p className="text-[11px] text-muted">
                Creates {towerPrefix || 'T'}1..{towerPrefix || 'T'}{towerCount || 1} with aliases like "tower 1", "t-1", "block 1", "tower a". Existing rows are updated.
              </p>
              <button type="button" className={`${btnSecondary} w-full`} onClick={handleQuickTowers} disabled={saving}>Generate towers</button>
            </div>

            <div className={`${cardCls} space-y-3 p-4`}>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary-text"><Wand2 className="h-4 w-4 text-accent" /> Quick add floors</h3>
              <Field label="Top floor number"><input type="number" min={0} max={100} className={inputCls} value={floorCount} onChange={e => setFloorCount(Number(e.target.value))} /></Field>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={includeGround} onChange={e => setIncludeGround(e.target.checked)} /> Include ground floor (G)
              </label>
              <p className="text-[11px] text-muted">Aliases: "floor 3", "3rd floor", "3rd", "f3", "level 3", "ground", "gf".</p>
              <button type="button" className={`${btnSecondary} w-full`} onClick={handleQuickFloors} disabled={saving}>Generate floors</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['', ...KINDS] as const).map(k => (
              <button key={k || 'all'} type="button" onClick={() => setKindFilter(k)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${kindFilter === k ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted hover:bg-page'}`}>
                {k ? `${k}s` : 'All'}
              </button>
            ))}
            {(loading || saving) && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
          </div>

          {!visible.length ? (
            <EmptyState>{loading ? 'Loading...' : 'No locations yet. Use the quick-add helpers above.'}</EmptyState>
          ) : (
            <div className={`${cardCls} divide-y divide-border`}>
              {visible.map(r => (
                <div key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2 sm:w-40 sm:flex-shrink-0">
                    <Badge tone={kindTone[r.kind]}>{r.kind}</Badge>
                    {editId === r.id ? (
                      <input className={`${inputCls} w-24 font-mono uppercase`} value={editValue} onChange={e => setEditValue(e.target.value.toUpperCase())} />
                    ) : (
                      <span className="font-mono text-sm font-semibold text-primary-text">{r.value}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {editId === r.id ? (
                      <input className={inputCls} value={editAliases} onChange={e => setEditAliases(e.target.value)} placeholder="aliases, comma-separated" />
                    ) : r.aliases.length ? (
                      <div className="flex flex-wrap gap-1">
                        {r.aliases.map(a => <span key={a} className="rounded bg-page px-1.5 py-0.5 text-[11px] text-muted">{a}</span>)}
                      </div>
                    ) : (
                      <span className="text-xs italic text-muted">no aliases</span>
                    )}
                  </div>
                  <div className="flex gap-1 self-end sm:self-auto">
                    {editId === r.id ? (
                      <>
                        <button type="button" className={btnPrimary} onClick={() => saveEdit(r)} title="Save"><Check className="h-4 w-4" /></button>
                        <button type="button" className={btnSecondary} onClick={() => setEditId(null)} title="Cancel"><X className="h-4 w-4" /></button>
                      </>
                    ) : (
                      <>
                        <button type="button" className={btnSecondary} onClick={() => startEdit(r)} title="Edit"><Edit3 className="h-4 w-4" /></button>
                        <button type="button" className={btnSecondary} onClick={() => handleDelete(r)} title="Delete"><Trash2 className="h-4 w-4 text-red-600" /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LocationsTab;
