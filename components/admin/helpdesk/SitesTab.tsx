import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Edit3, QrCode, Power, MapPin, Search } from 'lucide-react';
import Modal from '../../ui/Modal';
import {
  createChannelSite, updateChannelSite, setChannelSiteActive, normalizeSiteCode, SITE_CODE_REGEX,
  type ChannelSite, type ChannelSiteInput, type OptionItem,
} from '../../../services/helpdeskChannelApi';
import { Badge, EmptyState, Field, btnPrimary, btnSecondary, cardCls, inputCls } from './helpdeskUi';
import SiteQrPosterModal from './SiteQrPosterModal';

interface Props {
  sites: ChannelSite[];
  entities: OptionItem[];
  locations: OptionItem[];
  loading: boolean;
  onChanged: () => void;
  onManageLocations: (siteId: string) => void;
}

const emptyForm: ChannelSiteInput = {
  site_code: '',
  display_name: '',
  entity_id: null,
  location_id: null,
  dedupe_window_hours: 72,
  auto_priority_bump_reporters: 3,
  reassign_on_checkout: true,
  auto_close_hours: 24,
  notify_client_on_eta_change: true,
  is_active: true,
};

const SitesTab: React.FC<Props> = ({ sites, entities, locations, loading, onChanged, onManageLocations }) => {
  const [editing, setEditing] = useState<ChannelSite | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ChannelSiteInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [qrSite, setQrSite] = useState<ChannelSite | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const entityName = useMemo(() => new Map(entities.map(e => [e.id, e.name])), [entities]);
  const locationName = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites.filter(s =>
      (showInactive || s.is_active) &&
      (!q || s.display_name.toLowerCase().includes(q) || s.site_code.toLowerCase().includes(q)));
  }, [sites, search, showInactive]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (s: ChannelSite) => {
    setEditing(s);
    setForm({
      site_code: s.site_code,
      display_name: s.display_name,
      entity_id: s.entity_id,
      location_id: s.location_id,
      dedupe_window_hours: s.dedupe_window_hours,
      auto_priority_bump_reporters: s.auto_priority_bump_reporters,
      reassign_on_checkout: s.reassign_on_checkout,
      auto_close_hours: s.auto_close_hours,
      notify_client_on_eta_change: s.notify_client_on_eta_change,
      is_active: s.is_active,
    });
    setFormOpen(true);
  };

  const codeValid = SITE_CODE_REGEX.test(form.site_code);

  const handleSave = async () => {
    if (!codeValid) { toast.error('Site code must be 2-30 characters: A-Z, 0-9, _ or -'); return; }
    if (!form.display_name.trim()) { toast.error('Display name is required'); return; }
    setSaving(true);
    try {
      if (editing) await updateChannelSite(editing.id, form);
      else await createChannelSite(form);
      toast.success(editing ? 'Site updated' : 'Site created');
      setFormOpen(false);
      onChanged();
    } catch (e: any) {
      const msg = String(e?.message || '');
      toast.error(msg.includes('duplicate') ? 'That site code is already in use' : msg || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: ChannelSite) => {
    try {
      await setChannelSiteActive(s.id, !s.is_active);
      toast.success(s.is_active ? 'Site deactivated' : 'Site activated');
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    }
  };

  const set = <K extends keyof ChannelSiteInput>(k: K, v: ChannelSiteInput[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className={`${inputCls} pl-9`} placeholder="Search sites" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
        </div>
        <button type="button" className={btnPrimary} onClick={openCreate}><Plus className="h-4 w-4" /> New site</button>
      </div>

      {loading && !sites.length ? (
        <EmptyState>Loading sites...</EmptyState>
      ) : !filtered.length ? (
        <EmptyState>{sites.length ? 'No sites match your filters.' : 'No sites yet. Create one to generate its WhatsApp QR code.'}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(s => (
            <div key={s.id} className={`${cardCls} flex flex-col p-4 ${s.is_active ? '' : 'opacity-70'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-primary-text">{s.display_name}</h3>
                  <p className="font-mono text-xs text-accent">SITE:{s.site_code}</p>
                </div>
                {s.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted">Entity</dt>
                <dd className="truncate text-primary-text">{s.entity_id ? entityName.get(s.entity_id) || s.entity_id : '-'}</dd>
                <dt className="text-muted">Geo location</dt>
                <dd className="truncate text-primary-text">{s.location_id ? locationName.get(s.location_id) || 'Unknown' : '-'}</dd>
                <dt className="text-muted">Dedupe window</dt>
                <dd className="text-primary-text">{s.dedupe_window_hours} h</dd>
                <dt className="text-muted">Priority bump at</dt>
                <dd className="text-primary-text">{s.auto_priority_bump_reporters > 0 ? `${s.auto_priority_bump_reporters} reporters` : 'Off'}</dd>
                <dt className="text-muted">Auto-close</dt>
                <dd className="text-primary-text">{s.auto_close_hours} h after resolve</dd>
                <dt className="text-muted">On punch-out</dt>
                <dd className="text-primary-text">{s.reassign_on_checkout ? 'Reassign' : 'Alert managers'}</dd>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                <button type="button" className={btnSecondary} onClick={() => setQrSite(s)}><QrCode className="h-4 w-4" /> QR</button>
                <button type="button" className={btnSecondary} onClick={() => onManageLocations(s.id)}><MapPin className="h-4 w-4" /> Locations</button>
                <button type="button" className={btnSecondary} onClick={() => openEdit(s)}><Edit3 className="h-4 w-4" /> Edit</button>
                <button type="button" className={btnSecondary} onClick={() => toggleActive(s)} title={s.is_active ? 'Deactivate' : 'Activate'}>
                  <Power className={`h-4 w-4 ${s.is_active ? 'text-red-600' : 'text-emerald-600'}`} />
                  <span className="sm:hidden xl:inline">{s.is_active ? 'Deactivate' : 'Activate'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'Edit site' : 'New site'}
        onConfirm={handleSave}
        confirmButtonText={editing ? 'Save changes' : 'Create site'}
        confirmButtonVariant="primary"
        isConfirming={saving}
        maxWidth="md:max-w-lg"
        contentClassName="text-primary-text"
      >
        <div className="space-y-4">
          <Field
            label="Site code *"
            hint={editing && editing.site_code !== form.site_code
              ? 'Warning: changing the code invalidates QR posters already printed for this site.'
              : 'Printed on the QR as SITE:CODE. 2-30 chars, A-Z 0-9 _ -'}
          >
            <input
              className={`${inputCls} font-mono uppercase ${form.site_code && !codeValid ? 'border-red-400' : ''}`}
              value={form.site_code}
              maxLength={30}
              placeholder="LAKESIDE"
              onChange={e => set('site_code', normalizeSiteCode(e.target.value))}
            />
          </Field>
          <Field label="Display name *">
            <input className={inputCls} value={form.display_name} placeholder="Lakeside Residency" onChange={e => set('display_name', e.target.value)} />
          </Field>
          <Field label="Entity (client)" hint="Tickets from this site are filed under this entity.">
            <select className={inputCls} value={form.entity_id || ''} onChange={e => set('entity_id', e.target.value || null)}>
              <option value="">- None -</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label="Geo location" hint="Attendance geofence used for auto-assigning on-site staff.">
            <select className={inputCls} value={form.location_id || ''} onChange={e => set('location_id', e.target.value || null)}>
              <option value="">- None -</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Dedupe window (hours)" hint="Same issue within this window merges into one ticket.">
              <input type="number" min={1} max={720} className={inputCls} value={form.dedupe_window_hours}
                onChange={e => set('dedupe_window_hours', Number(e.target.value))} />
            </Field>
            <Field label="Priority bump after N reporters" hint="0 disables auto-escalation.">
              <input type="number" min={0} max={100} className={inputCls} value={form.auto_priority_bump_reporters}
                onChange={e => set('auto_priority_bump_reporters', Number(e.target.value))} />
            </Field>
          </div>
          <div className="space-y-3 rounded-lg border border-border bg-page p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Assignment & closure</p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={form.reassign_on_checkout} onChange={e => set('reassign_on_checkout', e.target.checked)} />
              <span>
                Reassign on punch-out
                <span className="block text-[11px] text-muted">
                  When the assignee punches out with open tickets, auto-reassign to someone on site; otherwise only alert managers.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={form.notify_client_on_eta_change} onChange={e => set('notify_client_on_eta_change', e.target.checked)} />
              <span>
                Notify client when the ETA changes
                <span className="block text-[11px] text-muted">Sends the client a WhatsApp update whenever staff change the promised time.</span>
              </span>
            </label>
            <Field label="Auto-close after (hours)" hint="Close resolved tickets if the client doesn't reply within this time.">
              <input type="number" min={1} max={720} className={`${inputCls} sm:w-40`} value={form.auto_close_hours}
                onChange={e => set('auto_close_hours', Number(e.target.value))} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Active (accept WhatsApp reports for this site)
          </label>
        </div>
      </Modal>

      <SiteQrPosterModal site={qrSite} onClose={() => setQrSite(null)} />
    </div>
  );
};

export default SitesTab;
