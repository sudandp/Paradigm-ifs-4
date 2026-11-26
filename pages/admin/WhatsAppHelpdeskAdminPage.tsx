import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Building2, MapPin, Users, UserCog, MessageSquareText, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import MobileTopBar from '../../components/navigation/MobileTopBar';
import SitesTab from '../../components/admin/helpdesk/SitesTab';
import LocationsTab from '../../components/admin/helpdesk/LocationsTab';
import ContactsTab from '../../components/admin/helpdesk/ContactsTab';
import AssigneesTab from '../../components/admin/helpdesk/AssigneesTab';
import MessageLogTab from '../../components/admin/helpdesk/MessageLogTab';
import { btnSecondary } from '../../components/admin/helpdesk/helpdeskUi';
import { useAuthStore } from '../../store/authStore';
import { isAdmin } from '../../utils/auth';
import {
  fetchChannelSites, fetchEntityOptions, fetchLocationOptions, getHelpdeskNumber,
  type ChannelSite, type OptionItem,
} from '../../services/helpdeskChannelApi';

type TabKey = 'sites' | 'locations' | 'assignees' | 'contacts' | 'messages';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'sites', label: 'Sites & QR', icon: Building2 },
  { key: 'locations', label: 'Locations', icon: MapPin },
  { key: 'assignees', label: 'Assignees', icon: UserCog },
  { key: 'contacts', label: 'Contacts', icon: Users },
  { key: 'messages', label: 'Message log', icon: MessageSquareText },
];

const WhatsAppHelpdeskAdminPage: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = TABS.some(t => t.key === tabParam) ? (tabParam as TabKey) : 'sites';
  const locationSiteId = searchParams.get('site') || '';

  const [sites, setSites] = useState<ChannelSite[]>([]);
  const [entities, setEntities] = useState<OptionItem[]>([]);
  const [locations, setLocations] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const setTab = (tab: TabKey, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    Object.entries(extra).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setSearchParams(next, { replace: true });
  };

  const loadSites = useCallback(async () => {
    setLoading(true);
    try {
      setSites(await fetchChannelSites());
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load sites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSites();
    fetchEntityOptions().then(setEntities).catch(e => console.warn('[WhatsAppHelpdeskAdmin] entities:', e));
    fetchLocationOptions().then(setLocations).catch(e => console.warn('[WhatsAppHelpdeskAdmin] locations:', e));
  }, [loadSites]);

  const helpdeskNumber = getHelpdeskNumber();
  const canEdit = isAdmin(user?.role);

  return (
    <div className="flex flex-1 flex-col p-4 lg:rounded-xl lg:bg-card lg:p-6 lg:shadow-card">
      <MobileTopBar title="WHATSAPP HELPDESK" parentPath="/mobile-home" />
      <AdminPageHeader title="WhatsApp Helpdesk Setup">
        <span className="text-sm text-muted">
          Helpdesk number: {helpdeskNumber ? <span className="font-mono text-primary-text">+{helpdeskNumber}</span> : <span className="text-amber-700">not set</span>}
        </span>
        <button type="button" className={btnSecondary} onClick={loadSites} title="Reload sites">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </AdminPageHeader>

      {!helpdeskNumber && (
        <div className="mb-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span>
            <strong>VITE_WA_HELPDESK_NUMBER</strong> is not set, so QR codes cannot be generated. Add the WhatsApp
            business number (digits with country code, e.g. 919876543210) to the environment and rebuild.
          </span>
        </div>
      )}
      {!canEdit && (
        <div className="mb-4 rounded-lg border border-border bg-page p-3 text-xs text-muted">
          You can view this configuration, but only administrators can save changes.
        </div>
      )}

      <div className="-mx-4 mb-4 overflow-x-auto border-b border-border px-4 lg:mx-0 lg:px-0">
        <nav className="flex min-w-max gap-1" aria-label="Helpdesk setup sections">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${active ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-primary-text'}`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1">
        {activeTab === 'sites' && (
          <SitesTab
            sites={sites}
            entities={entities}
            locations={locations}
            loading={loading}
            onChanged={loadSites}
            onManageLocations={siteId => setTab('locations', { site: siteId })}
          />
        )}
        {activeTab === 'locations' && (
          <LocationsTab sites={sites} siteId={locationSiteId} onSiteChange={id => setTab('locations', { site: id })} />
        )}
        {activeTab === 'assignees' && (
          <AssigneesTab sites={sites} siteId={locationSiteId} canEdit={canEdit} onSiteChange={id => setTab('assignees', { site: id })} />
        )}
        {activeTab === 'contacts' && <ContactsTab sites={sites} />}
        {activeTab === 'messages' && <MessageLogTab sites={sites} />}
      </div>
    </div>
  );
};

export default WhatsAppHelpdeskAdminPage;
