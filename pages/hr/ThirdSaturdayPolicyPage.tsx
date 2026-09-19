import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Users, 
  Building2, 
  MapPin, 
  Plus, 
  X, 
  Save, 
  RotateCcw, 
  Sparkles, 
  Search,
  ChevronDown,
  Check,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import MobileTopBar from '../../components/navigation/MobileTopBar';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { useSettingsStore } from '../../store/settingsStore';
import type { ThirdSaturdayPolicyConfig, User } from '../../types';
import { 
  DEFAULT_THIRD_SATURDAY_POLICY, 
  isThirdSaturday, 
  isThirdSaturdayPolicyApplicable,
  isHeadOfficeOrOfficeStaff,
  setRuntimeThirdSaturdayPolicy 
} from '../../utils/date';

/**
 * Unifies duplicate acronym and full entity representations into a single canonical entity.
 * For example: 'PIFS (Bangalore)' and 'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD (Bangalore)'
 * are normalized to 'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD (Bangalore)'.
 */
export function normalizeEntityList(list: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of list) {
    if (!item) continue;
    const raw = String(item).trim();
    if (!raw) continue;

    const match = raw.match(/^(.*?)\s*[([]\s*(.*?)\s*[)\]]$/);
    const baseName = (match ? match[1].trim() : raw).toUpperCase();
    const loc = match ? match[2].trim() : '';

    let canonical = raw;
    let key = '';

    if (baseName.includes('PARADIGM INTEGRATED') || baseName === 'PIFS' || baseName === 'PIFMS') {
      canonical = loc ? `PARADIGM INTEGRATED FACILITY SERVICES PVT LTD (${loc})` : 'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD';
      key = `PIFS_${loc.toLowerCase()}`;
    } else if (baseName.includes('SOUTHWALL') || baseName.includes('SOUTH WALL') || baseName === 'SWLLP') {
      canonical = loc ? `SOUTHWALL SECURITY LLP (${loc})` : 'SOUTHWALL SECURITY LLP';
      key = `SWLLP_${loc.toLowerCase()}`;
    } else if (baseName.includes('PARADIGM PROPERTY') || baseName === 'PPFMS') {
      canonical = loc ? `PARADIGM PROPERTY & FACILITY MANAGEMENT SERVICES (${loc})` : 'PARADIGM PROPERTY & FACILITY MANAGEMENT SERVICES';
      key = `PPFMS_${loc.toLowerCase()}`;
    } else if (baseName.includes('AP ENTERPRI')) {
      canonical = loc ? `AP Enterprises (${loc})` : 'AP Enterprises';
      key = `AP_ENT_${loc.toLowerCase()}`;
    } else {
      key = `${baseName}_${loc.toLowerCase()}`;
    }

    if (!seen.has(key)) {
      seen.add(key);
      result.push(canonical);
    }
  }

  return result;
}

/**
 * Helper to identify raw street/GPS addresses that should NOT appear in location dropdowns.
 */
export const isStreetAddress = (str: string): boolean => {
  if (!str) return false;
  const s = str.toLowerCase();
  return (
    str.length > 35 ||
    s.includes('road') ||
    s.includes('colony') ||
    s.includes('layout') ||
    s.includes('sector') ||
    s.includes('cross') ||
    s.includes('corporation') ||
    s.includes('main road') ||
    s.includes('nagar') ||
    /\d{6}/.test(s)
  );
};

export const sanitizeLocationsList = (list: string[]): string[] => {
  if (!Array.isArray(list)) return [];
  const valid = list.filter(item => item && !isStreetAddress(item));
  if (valid.length === 0) return ['Head Office', 'Bangalore'];
  return Array.from(new Set(valid));
};

// Core entities guaranteed from Client Management (with location specification, no duplicates)
export const INITIAL_CLIENT_ENTITIES: string[] = [
  'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD (Bangalore)',
  'PARADIGM PROPERTY & FACILITY MANAGEMENT SERVICES (Bangalore)',
  'AP Enterprises (Bangalore)',
  'SOUTHWALL SECURITY LLP (Bangalore)',
  'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD (Hyderabad)',
  'AP Group'
];

export const INITIAL_LOCATIONS: string[] = [
  'Head Office',
  'Bangalore',
  'Bengaluru',
  'BLR',
  'Karnataka',
  'Hyderabad',
  'Hydrabath',
  'Secunderabad',
  'Telangana',
  'Chennai',
  'Mumbai',
  'Pune',
  'Delhi',
  'Coimbatore',
  'Kochi'
];

/**
 * Reusable Multi-Select Dropdown Component with Checkboxes, Search & Custom Tag Entry
 */
interface PolicyMultiSelectorProps {
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  selectedItems: string[];
  availableOptions: string[];
  colorScheme: 'emerald' | 'amber';
  onToggleItem: (item: string) => void;
  onSelectAllFiltered: (filtered: string[]) => void;
  onDeselectAll: () => void;
  onRemoveIndex: (index: number) => void;
  onAddCustom: (item: string) => void;
  customPlaceholder: string;
  dropdownPlaceholder: string;
}

const PolicyMultiSelector: React.FC<PolicyMultiSelectorProps> = ({
  label,
  sublabel,
  icon: Icon,
  selectedItems,
  availableOptions,
  colorScheme,
  onToggleItem,
  onSelectAllFiltered,
  onDeselectAll,
  onRemoveIndex,
  onAddCustom,
  customPlaceholder,
  dropdownPlaceholder
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customInput, setCustomInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter available options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return availableOptions;
    const term = searchTerm.toLowerCase();
    return availableOptions.filter(opt => opt.toLowerCase().includes(term));
  }, [availableOptions, searchTerm]);

  const handleAddCustomSubmit = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    onAddCustom(trimmed);
    setCustomInput('');
  };

  const isAmber = colorScheme === 'amber';

  return (
    <div className="space-y-2.5">
      {/* Label and Count */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-primary-text flex items-center gap-1.5">
            <Icon className={`h-4 w-4 ${isAmber ? 'text-amber-600' : 'text-emerald-600'}`} />
            {label}
          </label>
          {sublabel && <p className="text-[11px] text-muted">{sublabel}</p>}
        </div>
        <div className="flex items-center gap-2">
          {selectedItems.length > 0 && (
            <button
              type="button"
              onClick={onDeselectAll}
              className="text-[11px] font-medium text-muted hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          )}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            isAmber 
              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' 
              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
          }`}>
            {selectedItems.length} selected
          </span>
        </div>
      </div>

      {/* Selected Tags Display */}
      <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-border">
        {selectedItems.length === 0 ? (
          <span className="text-xs text-muted italic p-1">No items selected. Choose from dropdown or add custom.</span>
        ) : (
          selectedItems.map((tag, idx) => {
            const match = tag.match(/^(.*?)\s*[([]\s*(.*?)\s*[)\]]$/);
            const tagName = match ? match[1].trim() : tag;
            const tagLoc = match ? match[2].trim() : null;

            // Derive shortCode badge (PIFS, PPFMS, SWLLP)
            const nameUpper = tagName.toUpperCase();
            const shortCode = nameUpper.includes('SOUTHWALL') || nameUpper.includes('SWLLP') 
              ? 'SWLLP' 
              : nameUpper.includes('PROPERTY') || nameUpper.includes('PPFMS')
              ? 'PPFMS'
              : nameUpper.includes('PARADIGM INTEGRATED') || nameUpper.includes('PIFS')
              ? 'PIFS'
              : null;

            return (
              <span 
                key={idx}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border shadow-xs transition-all ${
                  isAmber 
                    ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border-amber-300/80 dark:border-amber-700/80' 
                    : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border-emerald-300/80 dark:border-emerald-700/80'
                }`}
              >
                <span>{tagName}</span>
                {shortCode && tagName !== shortCode && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                    {shortCode}
                  </span>
                )}
                {tagLoc && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40 shrink-0">
                    <span className="h-1 w-1 rounded-full bg-emerald-500 shrink-0" />
                    {tagLoc}
                  </span>
                )}
                <button 
                  type="button"
                  onClick={() => onRemoveIndex(idx)} 
                  className="hover:text-red-600 transition-colors focus:outline-none ml-0.5"
                  title={`Remove ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })
        )}
      </div>

      {/* Dropdown Multi-Select Control */}
      <div className="relative" ref={dropdownRef}>
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full min-h-[40px] px-3 py-2 rounded-xl border border-border bg-card text-primary-text cursor-pointer flex items-center justify-between hover:border-primary/50 transition-all ${
            isOpen ? 'ring-2 ring-emerald-500/20 border-emerald-500' : ''
          }`}
        >
          <span className="text-xs font-medium text-muted flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 opacity-70" />
            {dropdownPlaceholder} ({selectedItems.length} selected)
          </span>
          <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {/* Dropdown Menu Popup */}
        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Search Box */}
            <div className="p-2 border-b border-border bg-gray-50/50 dark:bg-white/5">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  placeholder={`Search ${label.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-primary-text focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              {/* Quick Action Links */}
              <div className="flex items-center justify-between mt-2 px-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => onSelectAllFiltered(filteredOptions)}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold"
                >
                  Select All Filtered ({filteredOptions.length})
                </button>
                <button
                  type="button"
                  onClick={onDeselectAll}
                  className="text-muted hover:text-red-500"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Checkbox Options List */}
            <div className="max-h-56 overflow-y-auto p-1 divide-y divide-border/30">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted">
                  No matches found. You can add it below as a custom option.
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isChecked = selectedItems.some(item => item.toLowerCase() === opt.toLowerCase());
                  const match = opt.match(/^(.*?)\s*[([]\s*(.*?)\s*[)\]]$/);
                  const displayName = match ? match[1].trim() : opt;
                  const displayLoc = match ? match[2].trim() : null;

                  // Derive shortCode badge (PIFS, PPFMS, SWLLP)
                  const nameUpper = displayName.toUpperCase();
                  const shortCode = nameUpper.includes('SOUTHWALL') || nameUpper.includes('SWLLP') 
                    ? 'SWLLP' 
                    : nameUpper.includes('PROPERTY') || nameUpper.includes('PPFMS')
                    ? 'PPFMS'
                    : nameUpper.includes('PARADIGM INTEGRATED') || nameUpper.includes('PIFS')
                    ? 'PIFS'
                    : null;

                  return (
                    <div
                      key={opt}
                      onClick={() => onToggleItem(opt)}
                      className={`px-3 py-2 text-xs rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                        isChecked 
                          ? isAmber 
                            ? 'bg-amber-500/10 text-amber-950 dark:text-amber-200 font-medium' 
                            : 'bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-medium'
                          : 'hover:bg-gray-100 dark:hover:bg-white/5 text-primary-text'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Controlled by row onClick
                          className={`rounded border-border h-4 w-4 ${isAmber ? 'text-amber-600' : 'text-emerald-600'} focus:ring-0 shrink-0`}
                        />
                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                          <span className="font-semibold text-primary-text">{displayName}</span>
                          {shortCode && displayName !== shortCode && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                              {shortCode}
                            </span>
                          )}
                          {displayLoc && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40 shrink-0 shadow-2xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              {displayLoc}
                            </span>
                          )}
                        </div>
                      </div>
                      {isChecked && (
                        <Check className={`h-4 w-4 shrink-0 ml-2 ${isAmber ? 'text-amber-600' : 'text-emerald-600'}`} />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Close Bar */}
            <div className="p-2 border-t border-border bg-gray-50/50 dark:bg-white/5 flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsOpen(false)}
                className="text-xs py-1 h-7"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Inline Custom Input */}
      <div className="flex gap-2 pt-0.5">
        <input
          type="text"
          placeholder={customPlaceholder}
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddCustomSubmit();
            }
          }}
          className="flex-1 text-xs px-3 py-2 rounded-xl border border-border bg-background text-primary-text focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-xs"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={handleAddCustomSubmit}
          className="text-xs shrink-0 rounded-xl"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
};

export const ThirdSaturdayPolicyPage: React.FC = () => {
  const { attendance, updateAttendanceSettings } = useSettingsStore();
  const [policy, setPolicy] = useState<ThirdSaturdayPolicyConfig>(
    attendance?.thirdSaturdayPolicy || DEFAULT_THIRD_SATURDAY_POLICY
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Available options discovered from the system - initialized with guaranteed Client Structure entities
  const [availableEntities, setAvailableEntities] = useState<string[]>(INITIAL_CLIENT_ENTITIES);
  const [availableLocations, setAvailableLocations] = useState<string[]>(INITIAL_LOCATIONS);
  const [isSyncing, setIsSyncing] = useState(false);

  // Simulator states
  const [simStaffCategory, setSimStaffCategory] = useState<'office' | 'site' | 'field'>('office');
  const [simGender, setSimGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [simEntity, setSimEntity] = useState('PARADIGM INTEGRATED FACILITY SERVICES PVT LTD (Bangalore)');
  const [simLocation, setSimLocation] = useState('Head Office');

  // Live Employee Tester states
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [, setSelectedUserForTest] = useState<User | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // Load existing settings and all available entities/locations
  const loadSettings = React.useCallback(async (showSyncToast = false) => {
    if (showSyncToast) setIsSyncing(true);
    else setIsLoading(true);

    try {
      // Safe Supabase wrappers that never throw if table/network fails
      const fetchCompaniesSafe = async () => {
        try {
          const res = await supabase.from('companies').select('*');
          return (res as any)?.data || [];
        } catch {
          return [];
        }
      };

      const [settings, users, orgStructure, locs, companiesList] = await Promise.all([
        api.getAttendanceSettings().catch(() => null),
        api.getUsers().catch(() => []),
        api.getOrganizationStructure().catch(() => []),
        api.getLocations().catch(() => []),
        fetchCompaniesSafe()
      ]);

      const loadedPolicy = settings?.thirdSaturdayPolicy || attendance?.thirdSaturdayPolicy || DEFAULT_THIRD_SATURDAY_POLICY;
      const cleanPolicy: ThirdSaturdayPolicyConfig = {
        ...loadedPolicy,
        officeStaffOnly: loadedPolicy.officeStaffOnly !== undefined ? loadedPolicy.officeStaffOnly : true,
        applicableEntities: normalizeEntityList(loadedPolicy.applicableEntities),
        exemptEntities: normalizeEntityList(loadedPolicy.exemptEntities),
        applicableLocations: sanitizeLocationsList(loadedPolicy.applicableLocations),
        exemptLocations: sanitizeLocationsList(loadedPolicy.exemptLocations)
      };

      setPolicy(cleanPolicy);
      setRuntimeThirdSaturdayPolicy(cleanPolicy);

      if (users && users.length > 0) {
        setAllUsers(users);
      }

      const entitySet = new Set<string>(INITIAL_CLIENT_ENTITIES);
      const locationSet = new Set<string>(INITIAL_LOCATIONS);

      // Helper to process any company item from DB or orgStructure (Companies only, NOT site names)
      const processCompanyItem = (c: any) => {
        if (!c) return;
        const name = String(c.name || '').trim();
        const loc = String(c.location || '').trim();

        if (name) {
          if (loc) {
            entitySet.add(`${name} (${loc})`);
          } else {
            entitySet.add(name);
          }
        }

        if (loc && !isStreetAddress(loc)) locationSet.add(loc);
      };

      // 1. Process orgStructure groups and operating companies (EXCLUDE site/society names)
      if (Array.isArray(orgStructure)) {
        orgStructure.forEach((group: any) => {
          if (group.name) entitySet.add(String(group.name).trim());
          if (Array.isArray(group.locations)) {
            group.locations.forEach((l: any) => { if (l && !isStreetAddress(l)) locationSet.add(String(l).trim()); });
          }
          if (Array.isArray(group.companies)) {
            group.companies.forEach((company: any) => {
              processCompanyItem(company);
            });
          }
        });
      }

      // 2. Direct companies table query (ensures newly added companies in Client Management are instantly loaded)
      if (Array.isArray(companiesList)) {
        companiesList.forEach((c: any) => processCompanyItem(c));
      }

      // 3. Process locations - ONLY Regional Hubs, Cities, and Head Office (EXCLUDE 563 street addresses)
      locationSet.add('Head Office');
      if (Array.isArray(locs)) {
        locs.forEach((l: any) => {
          const lName = String(l.name || '').trim();
          if (lName.toLowerCase().includes('head office') || lName.toLowerCase().includes('corporate')) {
            locationSet.add('Head Office');
          }
          if (l.city && !isStreetAddress(l.city)) {
            locationSet.add(String(l.city).trim());
          }
          if (l.address) {
            ['Bangalore', 'Bengaluru', 'Hyderabad', 'Secunderabad', 'Chennai', 'Mumbai', 'Delhi', 'Pune', 'Kolkata', 'Ahmedabad', 'Coimbatore', 'Kochi'].forEach(city => {
              if (l.address.toLowerCase().includes(city.toLowerCase())) locationSet.add(city);
            });
          }
        });
      }

      // 4. Process user profile location attributes (Short regional names only, NEVER street addresses)
      if (Array.isArray(users)) {
        users.forEach((u: any) => {
          const city = String(u.city || '').trim();
          if (city && !isStreetAddress(city)) {
            locationSet.add(city);
          }
          if (u.state && !isStreetAddress(u.state) && String(u.state).trim().length < 25) {
            locationSet.add(String(u.state).trim());
          }
        });
      }

      // 5. Include sanitized locations from currentPolicy
      cleanPolicy.applicableEntities.forEach(e => { if (e) entitySet.add(String(e).trim()); });
      cleanPolicy.exemptEntities.forEach(e => { if (e) entitySet.add(String(e).trim()); });
      cleanPolicy.applicableLocations.forEach(l => { if (l && !isStreetAddress(l)) locationSet.add(String(l).trim()); });
      cleanPolicy.exemptLocations.forEach(l => { if (l && !isStreetAddress(l)) locationSet.add(String(l).trim()); });

      const sortedEntities = Array.from(entitySet).filter(Boolean).sort();
      const sortedLocations = Array.from(locationSet).filter(item => Boolean(item) && !isStreetAddress(item)).sort();

      setAvailableEntities(sortedEntities);
      setAvailableLocations(sortedLocations);

      if (showSyncToast) {
        setToast({ message: `Synced ${sortedEntities.length} entities and ${sortedLocations.length} locations from Client Management!`, type: 'success' });
      }
    } catch (err: any) {
      console.error('Failed to load attendance settings:', err);
      if (showSyncToast) {
        setToast({ message: 'Failed to sync with Client Management.', type: 'error' });
      }
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [attendance]);

  useEffect(() => {
    loadSettings(false);
  }, [loadSettings]);

  const handleToggle = (key: keyof ThirdSaturdayPolicyConfig) => {
    setPolicy(prev => {
      const next = { ...prev, [key]: !prev[key] };
      setIsDirty(true);
      return next;
    });
  };

  // Generalized item toggling for multi-selection
  const handleToggleItem = (
    listKey: 'applicableEntities' | 'exemptEntities' | 'applicableLocations' | 'exemptLocations',
    item: string
  ) => {
    setPolicy(prev => {
      const exists = prev[listKey].some(i => i.toLowerCase() === item.toLowerCase());
      let nextList = exists
        ? prev[listKey].filter(i => i.toLowerCase() !== item.toLowerCase())
        : [...prev[listKey], item];

      if (listKey === 'applicableEntities' || listKey === 'exemptEntities') {
        nextList = normalizeEntityList(nextList);
      }
      setIsDirty(true);
      return { ...prev, [listKey]: nextList };
    });
  };

  // Select all filtered items
  const handleSelectAllFiltered = (
    listKey: 'applicableEntities' | 'exemptEntities' | 'applicableLocations' | 'exemptLocations',
    filtered: string[]
  ) => {
    setPolicy(prev => {
      const current = new Set(prev[listKey].map(i => i.toLowerCase()));
      const toAdd = filtered.filter(f => !current.has(f.toLowerCase()));
      let nextList = [...prev[listKey], ...toAdd];
      if (listKey === 'applicableEntities' || listKey === 'exemptEntities') {
        nextList = normalizeEntityList(nextList);
      }
      setIsDirty(true);
      return { ...prev, [listKey]: nextList };
    });
  };

  // Deselect all items in a list
  const handleDeselectAll = (
    listKey: 'applicableEntities' | 'exemptEntities' | 'applicableLocations' | 'exemptLocations'
  ) => {
    setPolicy(prev => {
      setIsDirty(true);
      return { ...prev, [listKey]: [] };
    });
  };

  // Remove tag by index
  const handleRemoveTag = (
    listKey: 'applicableEntities' | 'exemptEntities' | 'applicableLocations' | 'exemptLocations',
    index: number
  ) => {
    setPolicy(prev => ({
      ...prev,
      [listKey]: prev[listKey].filter((_, i) => i !== index)
    }));
    setIsDirty(true);
  };

  // Add custom tag
  const handleAddCustomTag = (
    listKey: 'applicableEntities' | 'exemptEntities' | 'applicableLocations' | 'exemptLocations',
    val: string
  ) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    setPolicy(prev => {
      if (prev[listKey].some(item => item.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      let nextList = [...prev[listKey], trimmed];
      if (listKey === 'applicableEntities' || listKey === 'exemptEntities') {
        nextList = normalizeEntityList(nextList);
      }
      setIsDirty(true);
      return {
        ...prev,
        [listKey]: nextList
      };
    });

    // Also add to available options list so it appears in dropdown
    if (listKey.includes('Entit')) {
      setAvailableEntities(prev => Array.from(new Set([...prev, trimmed])).sort());
    } else {
      setAvailableLocations(prev => Array.from(new Set([...prev, trimmed])).sort());
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all 3rd Saturday policy conditions to recommended defaults?')) {
      setPolicy({ ...DEFAULT_THIRD_SATURDAY_POLICY });
      setIsDirty(true);
      setToast({ message: 'Reset to default policy values. Click Save to apply.', type: 'success' });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const currentFullSettings = await api.getAttendanceSettings().catch(() => attendance);
      const updatedSettings = {
        ...currentFullSettings,
        thirdSaturdayPolicy: {
          ...policy,
          lastUpdated: new Date().toISOString()
        }
      };

      await api.saveAttendanceSettings(updatedSettings);
      updateAttendanceSettings(updatedSettings);
      setRuntimeThirdSaturdayPolicy(updatedSettings.thirdSaturdayPolicy);
      setIsDirty(false);
      setToast({ message: '3rd Saturday Policy updated successfully!', type: 'success' });
    } catch (err: any) {
      console.error('Failed to save policy:', err);
      setToast({ message: err.message || 'Failed to save policy settings', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Simulator Result calculation
  const simResult = useMemo(() => {
    const mockUser = {
      staffCategory: simStaffCategory,
      gender: simGender,
      company: simEntity,
      location: simLocation,
      assignedSites: simStaffCategory === 'office' ? 'Head Office' : '42 Estate Queens Square',
      isHeadOffice: simStaffCategory === 'office'
    };
    const isRestricted = isThirdSaturdayPolicyApplicable(mockUser, simEntity, policy);
    
    let reason = '';
    if (!policy.enabled) {
      reason = 'Policy is globally disabled. All employees can punch in unrestricted.';
    } else if (policy.officeStaffOnly !== false && simStaffCategory !== 'office') {
      reason = `Exempted: As shown in Image 2, ${simStaffCategory.toUpperCase()} staff assigned to client societies (e.g. 42 Estate Queens Square, ABHEE Pride) follow regular site shifts and are never blocked by 3rd Saturday policy.`;
    } else if (policy.femaleExempt && simGender.toLowerCase() === 'female') {
      reason = 'Exempted: Female staff have no restrictions.';
    } else if (policy.exemptEntities.some(e => simEntity.toLowerCase().includes(e.toLowerCase()))) {
      reason = `Exempted: "${simEntity}" matches exempt entity criteria.`;
    } else if (policy.exemptLocations.some(l => simLocation.toLowerCase().includes(l.toLowerCase()))) {
      reason = `Exempted: "${simLocation}" matches exempt location criteria.`;
    } else if (
      policy.applicableLocations.length > 0 &&
      !policy.applicableLocations.some(l => simLocation.toLowerCase().includes(l.toLowerCase()))
    ) {
      reason = `Exempted: Location "${simLocation}" is outside target restriction regions.`;
    } else if (
      policy.applicableEntities.length > 0 &&
      !policy.applicableEntities.some(e => simEntity.toLowerCase().includes(e.toLowerCase()))
    ) {
      reason = `Exempted: Entity "${simEntity}" is outside target restriction list.`;
    } else {
      reason = `Restricted: Head Office / Office Staff in "${simEntity}" at "${simLocation}" must request manager approval to work on 3rd Saturday.`;
    }

    return { isRestricted, reason };
  }, [policy, simStaffCategory, simGender, simEntity, simLocation]);

  const filteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) return allUsers.slice(0, 8);
    const term = userSearchTerm.toLowerCase();
    return allUsers.filter(u => {
      const company = (u as any).company || u.organizationName || '';
      const loc = u.location || (u as any).locationName || '';
      return (
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term)) ||
        company.toLowerCase().includes(term) ||
        loc.toLowerCase().includes(term)
      );
    }).slice(0, 8);
  }, [allUsers, userSearchTerm]);

  if (isLoading) {
    return <LoadingScreen message="Loading 3rd Saturday Policy..." />;
  }

  const isTodayThirdSaturday = isThirdSaturday();

  return (
    <div className="w-full p-4 md:p-6 space-y-6 pb-24">
      <MobileTopBar title="3rd Saturday Policy" />

      {/* Desktop Header */}
      <div className="hidden md:block">
        <AdminPageHeader title="3rd Saturday Work Policy & Approval Rules">
          <div className="flex items-center gap-3">
            {isDirty && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                Unsaved Changes
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Defaults
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Policy'}
            </Button>
          </div>
        </AdminPageHeader>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Live Calendar Alert Banner */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isTodayThirdSaturday 
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200' 
          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${isTodayThirdSaturday ? 'bg-amber-500/20 text-amber-600' : 'bg-emerald-500/20 text-emerald-600'}`}>
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">
              {isTodayThirdSaturday ? 'Today is 3rd Saturday (Active)' : 'Policy Scheduler Status'}
            </h4>
            <p className="text-xs opacity-85">
              {isTodayThirdSaturday 
                ? 'Restrictions are actively enforced for applicable entities today. Manager approvals immediately unlock punch-in.' 
                : 'Policy conditions automatically take effect on the 3rd Saturday (day 15–21) of each calendar month.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            policy.enabled 
              ? 'bg-emerald-600 text-white shadow-sm' 
              : 'bg-gray-400 text-white'
          }`}>
            {policy.enabled ? 'Policy Enabled' : 'Policy Suspended'}
          </span>
        </div>
      </div>

      {/* Master Toggle Banner */}
      <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-base text-primary-text">Master Policy Switch</h3>
          </div>
          <p className="text-xs text-muted max-w-2xl">
            When enabled, staff from configured entities & locations must obtain reporting manager approval to work on 3rd Saturday. When disabled, all punch restrictions are lifted.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={policy.enabled} 
              onChange={() => handleToggle('enabled')} 
              className="sr-only peer" 
            />
            <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
          <span className="text-sm font-semibold text-primary-text">
            {policy.enabled ? 'Enforced' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Dynamic Client Structure Integration Bar */}
      <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-primary-text">Client Management Structure Live Link</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {availableEntities.length} Operating Companies & {availableLocations.length} Regional Hubs Discovered
              </span>
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              All operating companies (PIFS Bangalore, PPFMS Bangalore, AP Enterprises, Southwall Bangalore, PIFS Hyderabad) from Client Management are automatically linked. Any new company added in the future will automatically appear in these dropdowns.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadSettings(true)}
          disabled={isSyncing}
          className="text-xs font-bold text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10 self-start sm:self-auto shrink-0 flex items-center gap-1.5 h-8 px-3"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync from Client Management'}
        </Button>
      </div>

      {/* Condition Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Card 1: Exemptions (No Restrictions) */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-primary-text">Exemption Criteria (Zero Restrictions)</h3>
              <p className="text-xs text-muted">Employees matching these conditions can punch in freely without approval</p>
            </div>
          </div>

          {/* Female Staff Exemption Toggle */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-border flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-primary-text">Female Staff Exemption</span>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Default Rule
                </span>
              </div>
              <p className="text-xs text-muted">
                Female employees are totally exempt from 3rd Saturday restrictions and will never be blocked.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input 
                type="checkbox" 
                checked={policy.femaleExempt} 
                onChange={() => handleToggle('femaleExempt')} 
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Exempt Entities Dropdown Multi-Selector */}
          <PolicyMultiSelector
            label="Exempt Entities (e.g. PPFMS)"
            sublabel="Select entities from dropdown or add custom name"
            icon={Building2}
            selectedItems={policy.exemptEntities}
            availableOptions={availableEntities}
            colorScheme="emerald"
            onToggleItem={(item) => handleToggleItem('exemptEntities', item)}
            onSelectAllFiltered={(filtered) => handleSelectAllFiltered('exemptEntities', filtered)}
            onDeselectAll={() => handleDeselectAll('exemptEntities')}
            onRemoveIndex={(idx) => handleRemoveTag('exemptEntities', idx)}
            onAddCustom={(val) => handleAddCustomTag('exemptEntities', val)}
            dropdownPlaceholder="Select Exempt Entities from Dropdown"
            customPlaceholder="Type custom exempt entity (e.g. PPFMS)..."
          />

          {/* Exempt Locations Dropdown Multi-Selector */}
          <PolicyMultiSelector
            label="Exempt Locations (e.g. Hyderabad / Hydrabath)"
            sublabel="Select branches/cities from dropdown or add custom name"
            icon={MapPin}
            selectedItems={policy.exemptLocations}
            availableOptions={availableLocations}
            colorScheme="emerald"
            onToggleItem={(item) => handleToggleItem('exemptLocations', item)}
            onSelectAllFiltered={(filtered) => handleSelectAllFiltered('exemptLocations', filtered)}
            onDeselectAll={() => handleDeselectAll('exemptLocations')}
            onRemoveIndex={(idx) => handleRemoveTag('exemptLocations', idx)}
            onAddCustom={(val) => handleAddCustomTag('exemptLocations', val)}
            dropdownPlaceholder="Select Exempt Locations from Dropdown"
            customPlaceholder="Type custom exempt location (e.g. Hyderabad, Chennai)..."
          />
        </div>

        {/* Card 2: Target Enforced Conditions (Restriction Applies) */}
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-primary-text">Target Enforced Conditions (Approval Required)</h3>
              <p className="text-xs text-muted">Employees matching both these entities AND locations require approval</p>
            </div>
          </div>

          {/* Head Office & Office Staff Exclusivity Toggle (Image 2) */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-border flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-primary-text">Head Office & Office Staff Only</span>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                  Mandatory (HQ)
                </span>
              </div>
              <p className="text-xs text-muted">
                Applicable exclusively to Head Office & Back Office staff (Image 2). Site staff assigned to client societies (e.g. 42 Estate Queens Square, ABHEE Pride) follow regular site shifts and are never blocked.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input 
                type="checkbox" 
                checked={policy.officeStaffOnly !== false} 
                onChange={() => handleToggle('officeStaffOnly' as any)} 
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* Target Entities Dropdown Multi-Selector */}
          <PolicyMultiSelector
            label="Target Entities (PIFS, AP Enterprises, Southwall)"
            sublabel="Select entities from dropdown or add custom name"
            icon={Building2}
            selectedItems={policy.applicableEntities}
            availableOptions={availableEntities}
            colorScheme="amber"
            onToggleItem={(item) => handleToggleItem('applicableEntities', item)}
            onSelectAllFiltered={(filtered) => handleSelectAllFiltered('applicableEntities', filtered)}
            onDeselectAll={() => handleDeselectAll('applicableEntities')}
            onRemoveIndex={(idx) => handleRemoveTag('applicableEntities', idx)}
            onAddCustom={(val) => handleAddCustomTag('applicableEntities', val)}
            dropdownPlaceholder="Select Target Entities from Dropdown"
            customPlaceholder="Type custom target entity..."
          />

          {/* Target Locations Dropdown Multi-Selector */}
          <PolicyMultiSelector
            label="Target Locations (Head Office, Bangalore, Karnataka)"
            sublabel="Select regions/branches from dropdown or add custom name"
            icon={MapPin}
            selectedItems={policy.applicableLocations}
            availableOptions={availableLocations}
            colorScheme="amber"
            onToggleItem={(item) => handleToggleItem('applicableLocations', item)}
            onSelectAllFiltered={(filtered) => handleSelectAllFiltered('applicableLocations', filtered)}
            onDeselectAll={() => handleDeselectAll('applicableLocations')}
            onRemoveIndex={(idx) => handleRemoveTag('applicableLocations', idx)}
            onAddCustom={(val) => handleAddCustomTag('applicableLocations', val)}
            dropdownPlaceholder="Select Target Locations from Dropdown"
            customPlaceholder="Type custom target location..."
          />

          {/* Workflow & Approval Settings */}
          <div className="pt-3 border-t border-border space-y-3">
            <h4 className="text-xs font-bold text-primary-text uppercase tracking-wider">Workflow Behaviors</h4>
            
            <div className="flex items-center justify-between text-xs py-1">
              <div>
                <span className="font-semibold text-primary-text">Reporting Manager Direct Approval</span>
                <p className="text-muted text-[11px]">When manager approves, instantly allows user to punch in for regular day</p>
              </div>
              <input 
                type="checkbox" 
                checked={policy.allowDirectUnlockOnApproval} 
                onChange={() => handleToggle('allowDirectUnlockOnApproval')}
                className="rounded border-border text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
            </div>

            <div className="flex items-center justify-between text-xs py-1">
              <div>
                <span className="font-semibold text-primary-text">Auto-Notify Reporting Manager</span>
                <p className="text-muted text-[11px]">Dispatch push & in-app notification to manager upon unlock request</p>
              </div>
              <input 
                type="checkbox" 
                checked={policy.notifyReportingManager} 
                onChange={() => handleToggle('notifyReportingManager')}
                className="rounded border-border text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
            </div>
          </div>
        </div>

      </div>

      {/* Simulator Section */}
      <div className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-primary-text">Live Policy Simulator & Checker</h3>
              <p className="text-xs text-muted">Test how current rules evaluate any demographic or specific employee profile</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          {/* Sim Staff Category (Image 2) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-primary-text">Staff Category (Image 2)</label>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">HQ vs Site</span>
            </div>
            <select
              value={simStaffCategory}
              onChange={e => setSimStaffCategory(e.target.value as any)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-primary-text focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="office">🏢 Office Staff (Head Office / HQ)</option>
              <option value="site">🏗️ Site Staff (Client Societies / Sites)</option>
              <option value="field">🏃 Field Staff</option>
            </select>
          </div>

          {/* Sim Gender */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-primary-text">Gender</label>
            <select
              value={simGender}
              onChange={e => setSimGender(e.target.value as any)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-primary-text focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="Male">Male</option>
              <option value="Female">Female (Exempt)</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Sim Entity */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-primary-text">Entity / Company</label>
            <div className="flex gap-1.5">
              <select
                value={availableEntities.includes(simEntity) ? simEntity : 'custom'}
                onChange={e => {
                  if (e.target.value !== 'custom') setSimEntity(e.target.value);
                }}
                className="text-xs px-2.5 py-2 rounded-lg border border-border bg-background text-primary-text max-w-[150px]"
              >
                {availableEntities.slice(0, 15).map(ent => (
                  <option key={ent} value={ent}>{ent}</option>
                ))}
                <option value="custom">Custom...</option>
              </select>
              <input
                type="text"
                value={simEntity}
                onChange={e => setSimEntity(e.target.value)}
                placeholder="Entity name..."
                className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-background text-primary-text"
              />
            </div>
          </div>

          {/* Sim Location */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-primary-text">Location / City</label>
            <div className="flex gap-1.5">
              <select
                value={availableLocations.includes(simLocation) ? simLocation : 'custom'}
                onChange={e => {
                  if (e.target.value !== 'custom') setSimLocation(e.target.value);
                }}
                className="text-xs px-2.5 py-2 rounded-lg border border-border bg-background text-primary-text max-w-[150px]"
              >
                {availableLocations.slice(0, 15).map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
                <option value="custom">Custom...</option>
              </select>
              <input
                type="text"
                value={simLocation}
                onChange={e => setSimLocation(e.target.value)}
                placeholder="Location name..."
                className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-background text-primary-text"
              />
            </div>
          </div>
        </div>

        {/* Simulator Verdict Display */}
        <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
          simResult.isRestricted 
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200' 
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
        }`}>
          {simResult.isRestricted ? (
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                simResult.isRestricted 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-emerald-600 text-white'
              }`}>
                {simResult.isRestricted ? 'RESTRICTED (Approval Required)' : 'ALLOWED (Direct Punch-In)'}
              </span>
            </div>
            <p className="text-xs font-medium mt-1.5 leading-relaxed">
              {simResult.reason}
            </p>
          </div>
        </div>

        {/* Live Employee Quick Search */}
        <div className="pt-3 border-t border-border space-y-2">
          <label className="text-xs font-semibold text-primary-text flex items-center gap-1.5">
            <Users className="h-4 w-4 text-blue-600" />
            Check Specific Employee from Database
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search employee by name, email, company, or location..."
              value={userSearchTerm}
              onChange={e => setUserSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-border bg-background text-primary-text focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
            {filteredUsers.map(emp => {
              const isEmpOffice = isHeadOfficeOrOfficeStaff(emp);
              const testIsRestricted = isThirdSaturdayPolicyApplicable(emp, null, policy);
              return (
                <div 
                  key={emp.id}
                  onClick={() => {
                    setSelectedUserForTest(emp);
                    setSimStaffCategory(isEmpOffice ? 'office' : 'site');
                    setSimGender((emp.gender as any) || 'Male');
                    setSimEntity((emp as any).company || emp.organizationName || 'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD (Bangalore)');
                    setSimLocation(emp.location || (emp as any).locationName || 'Head Office');
                  }}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all hover:border-emerald-500 ${
                    testIsRestricted 
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40' 
                      : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs truncate text-primary-text">{emp.name || 'Unnamed'}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      testIsRestricted ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                    }`}>
                      {testIsRestricted ? 'Restricted' : 'Allowed'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                      isEmpOffice ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' : 'bg-gray-200 dark:bg-gray-800 text-muted'
                    }`}>
                      {isEmpOffice ? '🏢 Office (HQ)' : '🏗️ Site Staff'}
                    </span>
                    <span className="text-[10px] text-muted truncate">
                      {(emp as any).company || emp.organizationName || 'No Company'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Floating Save Toolbar for Mobile */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 p-3 bg-card border-t border-border shadow-lg flex items-center justify-between z-40">
        <span className="text-xs text-muted">
          {isDirty ? 'Unsaved changes pending' : 'Policy synced'}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleResetDefaults}
          >
            Reset
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSaving ? 'Saving...' : 'Save Policy'}
          </Button>
        </div>
      </div>

    </div>
  );
};

export default ThirdSaturdayPolicyPage;
