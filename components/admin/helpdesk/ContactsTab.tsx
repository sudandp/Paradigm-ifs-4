import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, Upload, Edit3, Ban, Link2, X, Loader2, RefreshCw } from 'lucide-react';
import Modal from '../../ui/Modal';
import {
  fetchChannelContacts, updateChannelContact, linkContactToSite, unlinkContactFromSite,
  parseBulkContactLines, bulkRegisterContacts, CONTACT_ROLES,
  type ChannelContact, type ChannelSite, type ContactRole,
} from '../../../services/helpdeskChannelApi';
import { Badge, EmptyState, Field, btnPrimary, btnSecondary, cardCls, formatDateTime, inputCls } from './helpdeskUi';

interface Props {
  sites: ChannelSite[];
}

const roleTone: Record<ContactRole, 'blue' | 'green' | 'amber' | 'gray'> = {
  client: 'blue', resident: 'green', staff: 'amber', unknown: 'gray',
};

const ContactsTab: React.FC<Props> = ({ sites }) => {
  const [contacts, setContacts] = useState<ChannelContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [roleFilter, setRoleFilter] = useState<ContactRole | ''>('');
  const [siteFilter, setSiteFilter] = useState('');

  const [editing, setEditing] = useState<ChannelContact | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<ContactRole>('client');
  const [editBlocked, setEditBlocked] = useState(false);
  const [linkSiteId, setLinkSiteId] = useState('');
  const [linkUnit, setLinkUnit] = useState('');
  const [saving, setSaving] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSiteId, setBulkSiteId] = useState('');
  const [bulkRole, setBulkRole] = useState<ContactRole>('client');
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const siteById = useMemo(() => new Map(sites.map(s => [s.id, s])), [sites]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContacts(await fetchChannelContacts({ search: debounced, role: roleFilter, siteId: siteFilter }));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [debounced, roleFilter, siteFilter]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (c: ChannelContact) => {
    setEditing(c);
    setEditName(c.display_name || '');
    setEditRole(c.contact_role);
    setEditBlocked(c.is_blocked);
    setLinkSiteId('');
    setLinkUnit('');
  };

  // Refresh the list (and the open contact's site links) after link changes; unsaved form fields are separate state.
  const refreshEditing = async (id: string) => {
    try {
      const list = await fetchChannelContacts({ search: debounced, role: roleFilter, siteId: siteFilter });
      setContacts(list);
      const fresh = list.find(c => c.id === id);
      if (fresh) setEditing(prev => (prev && prev.id === id ? fresh : prev));
    } catch {
      /* list refresh is best-effort */
    }
  };

  const handleSaveContact = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateChannelContact(editing.id, { display_name: editName, contact_role: editRole, is_blocked: editBlocked });
      toast.success('Contact updated');
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleLink = async () => {
    if (!editing || !linkSiteId) return;
    try {
      await linkContactToSite(editing.id, linkSiteId, linkUnit);
      toast.success('Site linked');
      setLinkSiteId('');
      setLinkUnit('');
      if (!editing.sites.some(s => s.site_id === linkSiteId)) {
        setEditing({ ...editing, sites: [...editing.sites, { contact_id: editing.id, site_id: linkSiteId, unit_number: linkUnit || null, added_via: 'admin', created_at: new Date().toISOString() }] });
      }
      refreshEditing(editing.id);
    } catch (e: any) {
      toast.error(e?.message || 'Link failed');
    }
  };

  const handleUnlink = async (siteId: string) => {
    if (!editing) return;
    try {
      await unlinkContactFromSite(editing.id, siteId);
      setEditing({ ...editing, sites: editing.sites.filter(s => s.site_id !== siteId) });
      refreshEditing(editing.id);
    } catch (e: any) {
      toast.error(e?.message || 'Unlink failed');
    }
  };

  const parsed = useMemo(() => parseBulkContactLines(bulkText), [bulkText]);
  const validCount = parsed.filter(p => !p.error).length;

  const handleBulk = async () => {
    if (!bulkSiteId) { toast.error('Choose a site'); return; }
    if (!validCount) { toast.error('No valid lines to import'); return; }
    setBulkBusy(true);
    try {
      const r = await bulkRegisterContacts(bulkSiteId, parsed, bulkRole);
      toast.success(`Imported: ${r.created} new, ${r.updated} existing, ${r.linked} linked${r.skipped ? `, ${r.skipped} skipped` : ''}`);
      setBulkOpen(false);
      setBulkText('');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Import failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const linkedSiteIds = new Set(editing?.sites.map(s => s.site_id) || []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className={`${inputCls} pl-9`} placeholder="Search phone or name" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <select className={`${inputCls} lg:w-36`} value={roleFilter} onChange={e => setRoleFilter(e.target.value as ContactRole | '')}>
            <option value="">All roles</option>
            {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={`${inputCls} lg:w-48`} value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
            <option value="">All sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <button type="button" className={btnSecondary} onClick={load} title="Refresh">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <button type="button" className={`${btnPrimary} flex-1 lg:flex-none`} onClick={() => { setBulkSiteId(siteFilter || bulkSiteId); setBulkOpen(true); }}>
            <Upload className="h-4 w-4" /> Pre-register numbers
          </button>
        </div>
      </div>

      {!contacts.length ? (
        <EmptyState>{loading ? 'Loading contacts...' : 'No contacts found.'}</EmptyState>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {contacts.map(c => (
              <button key={c.id} type="button" onClick={() => openEdit(c)} className={`${cardCls} block w-full p-3 text-left`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-primary-text">{c.display_name || 'Unnamed'}</p>
                    <p className="font-mono text-xs text-muted">+{c.sender_id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={roleTone[c.contact_role]}>{c.contact_role}</Badge>
                    {c.is_blocked && <Badge tone="red">blocked</Badge>}
                  </div>
                </div>
                {!!c.sites.length && (
                  <p className="mt-2 truncate text-xs text-muted">
                    {c.sites.map(s => `${siteById.get(s.site_id)?.site_code || '?'}${s.unit_number ? ` #${s.unit_number}` : ''}`).join(', ')}
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Desktop: table */}
          <div className={`${cardCls} hidden overflow-x-auto md:block`}>
            <table className="min-w-full text-sm">
              <thead className="bg-page text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2">Contact</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Sites</th>
                  <th className="px-4 py-2">Last message</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map(c => (
                  <tr key={c.id} className="hover:bg-page/60">
                    <td className="px-4 py-2">
                      <div className="font-semibold text-primary-text">{c.display_name || <span className="italic text-muted">Unnamed</span>}</div>
                      <div className="font-mono text-xs text-muted">+{c.sender_id} <span className="text-[10px]">({c.channel})</span></div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={roleTone[c.contact_role]}>{c.contact_role}</Badge>
                        {c.is_blocked && <Badge tone="red">blocked</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {c.sites.length ? c.sites.map(s => (
                          <span key={s.site_id} className="rounded bg-page px-1.5 py-0.5 font-mono text-[11px] text-primary-text" title={siteById.get(s.site_id)?.display_name}>
                            {siteById.get(s.site_id)?.site_code || '?'}{s.unit_number ? ` #${s.unit_number}` : ''}
                          </span>
                        )) : <span className="text-xs text-muted">-</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{formatDateTime(c.last_inbound_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <button type="button" className={btnSecondary} onClick={() => openEdit(c)}><Edit3 className="h-4 w-4" /> Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {contacts.length >= 300 && <p className="text-xs text-muted">Showing the 300 most recently updated contacts. Refine your search to find others.</p>}
        </>
      )}

      {/* Edit contact */}
      <Modal
        isOpen={!!editing}
        onClose={() => !saving && setEditing(null)}
        title="Edit contact"
        onConfirm={handleSaveContact}
        confirmButtonText="Save"
        confirmButtonVariant="primary"
        isConfirming={saving}
        maxWidth="md:max-w-lg"
        contentClassName="text-primary-text"
      >
        {editing && (
          <div className="space-y-4">
            <p className="font-mono text-sm text-muted">+{editing.sender_id} ({editing.channel})</p>
            <Field label="Display name">
              <input className={inputCls} value={editName} onChange={e => setEditName(e.target.value)} />
            </Field>
            <Field label="Role">
              <select className={inputCls} value={editRole} onChange={e => setEditRole(e.target.value as ContactRole)}>
                {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editBlocked} onChange={e => setEditBlocked(e.target.checked)} />
              <Ban className="h-4 w-4 text-red-600" /> Blocked (bot ignores this number)
            </label>

            <div className="border-t border-border pt-4">
              <h4 className="mb-2 text-sm font-semibold">Linked sites</h4>
              {editing.sites.length ? (
                <ul className="space-y-1">
                  {editing.sites.map(s => (
                    <li key={s.site_id} className="flex items-center justify-between gap-2 rounded-lg bg-page px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {siteById.get(s.site_id)?.display_name || 'Unknown site'}
                        {s.unit_number && <span className="text-muted"> - unit {s.unit_number}</span>}
                        <span className="ml-2 text-[10px] uppercase text-muted">via {s.added_via}</span>
                      </span>
                      <button type="button" className="rounded p-1 text-red-600 hover:bg-red-50" onClick={() => handleUnlink(s.site_id)} title="Unlink">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-muted">Not linked to any site. The bot will ask which site they are reporting from.</p>}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem_auto]">
                <select className={inputCls} value={linkSiteId} onChange={e => setLinkSiteId(e.target.value)}>
                  <option value="">Add site...</option>
                  {sites.filter(s => !linkedSiteIds.has(s.id)).map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </select>
                <input className={inputCls} placeholder="Unit (opt.)" value={linkUnit} onChange={e => setLinkUnit(e.target.value)} />
                <button type="button" className={btnSecondary} onClick={handleLink} disabled={!linkSiteId}><Link2 className="h-4 w-4" /> Link</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk pre-register */}
      <Modal
        isOpen={bulkOpen}
        onClose={() => !bulkBusy && setBulkOpen(false)}
        title="Pre-register client numbers"
        onConfirm={handleBulk}
        confirmButtonText={`Import ${validCount || ''}`.trim()}
        confirmButtonVariant="primary"
        isConfirming={bulkBusy}
        maxWidth="md:max-w-2xl"
        contentClassName="text-primary-text"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Site *">
              <select className={inputCls} value={bulkSiteId} onChange={e => setBulkSiteId(e.target.value)}>
                <option value="">- Select a site -</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.display_name} ({s.site_code})</option>)}
              </select>
            </Field>
            <Field label="Role for new contacts">
              <select className={inputCls} value={bulkRole} onChange={e => setBulkRole(e.target.value as ContactRole)}>
                {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>
          <Field label="One per line: phone,name,unit" hint="10-digit numbers are assumed to be Indian (+91). Existing contacts keep their role; blank names keep the current name.">
            <textarea
              className={`${inputCls} h-40 font-mono text-xs`}
              placeholder={'9876543210,Ravi Kumar,A-1203\n+91 98450 12345,Priya,B-404'}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
            />
          </Field>
          {!!parsed.length && (
            <div>
              <p className="mb-1 text-xs text-muted">{validCount} valid, {parsed.length - validCount} with errors</p>
              <div className="max-h-48 overflow-auto rounded-lg border border-border">
                <table className="min-w-full text-xs">
                  <tbody className="divide-y divide-border">
                    {parsed.slice(0, 200).map(p => (
                      <tr key={p.line} className={p.error ? 'bg-red-50' : ''}>
                        <td className="px-2 py-1 text-muted">{p.line}</td>
                        <td className="px-2 py-1 font-mono">{p.phone ? `+${p.phone}` : p.raw.split(/[,;\t]/)[0]}</td>
                        <td className="px-2 py-1">{p.name || '-'}</td>
                        <td className="px-2 py-1">{p.unit || '-'}</td>
                        <td className="px-2 py-1 text-red-700">{p.error || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ContactsTab;
