import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '../../services/api';
import type { User, Role, OrganizationGroup } from '../../types';
import {
  Home, Search, Filter, Download, RotateCw, MapPin, Phone, Mail,
  UserCheck, Building, Building2, Copy, Check, ExternalLink, Edit3, X,
  ChevronRight, ArrowUpDown, LayoutGrid, Table as TableIcon,
  Shield, CheckCircle2, AlertCircle, MessageSquare, Compass, Eye, Briefcase
} from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Toast from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface UserAddressInfo {
  user: User;
  name: string;
  email: string;
  phone: string;
  role: string;
  roleDisplayName: string;
  department: string;
  company: string;
  companyId?: string;
  area: string;
  pincode: string;
  fullAddress: string;
  reportingManagerName: string;
  reportingManagerPhone: string;
  reportingManagerRole: string;
  reportingManagerPhoto?: string;
  hasAddress: boolean;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
}

// Role badge color helper
const getRoleBadgeClass = (role: string) => {
  const r = (role || '').toLowerCase();
  if (r.includes('admin')) return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
  if (r.includes('manager') || r.includes('management')) return 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
  if (r.includes('field') || r.includes('staff')) return 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800/60';
  if (r.includes('site')) return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
  if (r.includes('hr')) return 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60';
  if (r.includes('finance')) return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
  return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
};

// Smart address parser to extract neighborhood / locality and PIN code
export const extractLocalityAndPin = (fullAddress: string): { locality: string; pincode: string } => {
  if (!fullAddress || fullAddress === 'Address Not Provided') {
    return { locality: '', pincode: '' };
  }

  // 1. Extract 6-digit pin code
  let pincode = '';
  const pinMatch = fullAddress.match(/\b[1-9]\d{5}\b/);
  if (pinMatch) {
    pincode = pinMatch[0];
  }

  // 2. Clean address string and split by comma
  const rawParts = fullAddress
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  if (rawParts.length === 0) {
    return { locality: '', pincode };
  }

  const ignoredWords = new Set([
    'india', 'in', 'karnataka', 'tamil nadu', 'telangana', 'andhra pradesh',
    'maharashtra', 'kerala', 'delhi', 'gujarat', 'haryana', 'uttar pradesh',
    'west bengal', 'bihar', 'rajasthan', 'madhya pradesh', 'punjab', 'odisha',
    'bangalore south', 'bengaluru south', 'bangalore north', 'bengaluru north',
    'bangalore east', 'bengaluru east', 'bangalore west', 'bengaluru west',
    'bangalore urban', 'bengaluru urban', 'bangalore rural', 'bengaluru rural',
    'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'mumbai', 'pune'
  ]);

  // Filter out country, pin code, state, city corporation labels, and generic district tags
  const meaningful = rawParts.filter(part => {
    const clean = part.toLowerCase().replace(/[-–—]/g, ' ').replace(/\b\d{6}\b/g, '').trim();
    if (!clean) return false;
    if (ignoredWords.has(clean)) return false;
    if (/^\d+([a-z])?(\/\d+)?$/i.test(clean)) return false;
    if (clean.includes('corporation') || clean.includes('municipality') || clean.includes('panchayat')) return false;
    return true;
  });

  if (meaningful.length === 0) {
    return { locality: rawParts[0].replace(/\b\d{6}\b/g, '').trim(), pincode };
  }

  let chosenLocality = '';

  if (meaningful.length >= 2) {
    if (meaningful[1].length < 32) {
      chosenLocality = meaningful[1];
    } else if (meaningful[0].length < 32) {
      chosenLocality = meaningful[0];
    } else {
      chosenLocality = meaningful[meaningful.length - 2] || meaningful[0];
    }
  } else {
    chosenLocality = meaningful[0];
  }

  chosenLocality = chosenLocality.replace(/\b\d{6}\b/g, '').replace(/[-–—,]/g, ' ').trim();

  return { locality: chosenLocality, pincode };
};

// Compact, powerful multi-select filter dropdown component
interface FilterMultiSelectProps {
  label: string;
  placeholder?: string;
  options: { id: string; name: string; count?: number }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  badgeColor?: 'blue' | 'emerald' | 'teal' | 'cyan' | 'amber' | 'slate';
}

const FilterMultiSelect: React.FC<FilterMultiSelectProps> = ({
  label,
  options,
  selected,
  onChange,
  badgeColor = 'blue'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.name.toLowerCase().includes(q));
  }, [options, search]);

  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(item => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const handleSelectAll = () => {
    const allIds = Array.from(new Set([...selected, ...filteredOptions.map(o => o.id)]));
    onChange(allIds);
  };

  const handleClear = () => {
    onChange([]);
  };

  // Label text display
  let triggerText = `All (${options.length})`;
  if (selected.length === 1) {
    const found = options.find(o => o.id === selected[0]);
    triggerText = found ? found.name : selected[0];
  } else if (selected.length > 1) {
    triggerText = `${selected.length} Selected`;
  }

  const isFiltered = selected.length > 0;

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[11px] font-semibold text-muted mb-1 truncate">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center justify-between gap-1.5 transition-all text-left ${
          isFiltered
            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 shadow-xs'
            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <span className="truncate flex-1 font-semibold">{triggerText}</span>
        <div className="flex items-center gap-1 shrink-0">
          {isFiltered && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-300 transition-colors"
              title="Clear Filter"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <span className={`transform transition-transform text-slate-400 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 mt-1 min-w-[240px] max-w-[320px] w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 text-xs space-y-2 animate-scale-in">
          {/* Search inside dropdown */}
          {options.length > 5 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${label}...`}
                className="w-full pl-8 pr-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                autoFocus
              />
            </div>
          )}

          {/* Action Bar (Select All / Clear) */}
          <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-muted border-b border-border/60 pb-1.5">
            <span>{selected.length} of {options.length} Selected</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Select All
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-red-500 hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Options Checklist */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 divide-y divide-slate-100 dark:divide-slate-800/60 pr-1">
            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-slate-400 italic">No matching options</div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = selected.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <span className="truncate" title={opt.name}>{opt.name}</span>
                    </div>
                    {typeof opt.count === 'number' && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                        {opt.count}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function UserHomeDetails() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncingLocations, setIsSyncingLocations] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // View mode: 'table' or 'grid'
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Multi-Select Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedPincodes, setSelectedPincodes] = useState<string[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'company_asc' | 'area_asc' | 'pincode_asc' | 'manager_asc'>('name_asc');

  // Edit Address Modal
  const [editingUser, setEditingUser] = useState<UserAddressInfo | null>(null);
  const [editAddressText, setEditAddressText] = useState('');
  const [editAreaText, setEditAreaText] = useState('');
  const [editPincodeText, setEditPincodeText] = useState('');
  const [editPhoneText, setEditPhoneText] = useState('');
  const [editManagerId, setEditManagerId] = useState('');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Quick Detail Drawer / Modal
  const [previewUser, setPreviewUser] = useState<UserAddressInfo | null>(null);

  // Load user dataset and metadata
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes, orgsRes] = await Promise.all([
        api.getUsers({ fetchAll: true }),
        api.getRoles(),
        api.getOrganizations ? api.getOrganizations().catch(() => []) : Promise.resolve([])
      ]);
      const userList: User[] = Array.isArray(usersRes) ? usersRes : (usersRes?.data || []);
      setUsers(userList);
      if (Array.isArray(rolesRes)) setRoles(rolesRes);
      if (Array.isArray(orgsRes)) setOrganizations(orgsRes);
    } catch (err) {
      console.error('Failed to load user data', err);
      setToast({ message: 'Failed to load user directory.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create fast map of user ID -> User
  const usersMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  // Roles map
  const rolesMap = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach(r => map.set(r.id, r.displayName));
    return map;
  }, [roles]);

  // Organizations map (id -> name)
  const orgsMap = useMemo(() => {
    const map = new Map<string, string>();
    organizations.forEach(o => {
      map.set(o.id, o.name || o.shortName || o.displayName || '');
    });
    return map;
  }, [organizations]);

  // Parse & Normalize user address records
  const addressRecords: UserAddressInfo[] = useMemo(() => {
    return users.map(user => {
      // 1. Phone number
      const phone = user.phone || (user as any).personalDetails?.mobile || (user as any).personal_details?.mobile || '';

      // 2. Full address extraction
      let fullAddress = (user.homeAddress || '').trim();
      const addrDetails = (user as any).addressDetails || (user as any).address_details;
      if (!fullAddress && addrDetails?.present) {
        const p = addrDetails.present;
        fullAddress = [p.line1, p.line2, p.city, p.state, p.country, p.pincode].filter(Boolean).join(', ');
      }

      // 3. Smart extraction from address (Locality and PIN code)
      const extracted = extractLocalityAndPin(fullAddress);

      // Pin code extraction
      let pincode = '';
      if (addrDetails?.present?.pincode) {
        pincode = String(addrDetails.present.pincode).trim();
      } else if (addrDetails?.permanent?.pincode) {
        pincode = String(addrDetails.permanent.pincode).trim();
      }
      if (!pincode && extracted.pincode) {
        pincode = extracted.pincode;
      }
      if (!pincode && fullAddress) {
        const pinMatch = fullAddress.match(/\b[1-9]\d{5}\b/);
        if (pinMatch) pincode = pinMatch[0];
      }

      // 4. Area / Locality extraction
      let area = (user.locationName || user.location || '').trim();
      const isGenericOrEmpty = !area || ['not specified', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'mumbai', 'delhi', 'pune', 'india'].includes(area.toLowerCase());

      // If user area is missing or generic and we found a specific neighborhood in the address, use the extracted locality!
      if (isGenericOrEmpty && extracted.locality) {
        area = extracted.locality;
      } else if (!area && addrDetails?.present?.city) {
        area = addrDetails.present.city.trim();
      } else if (!area && addrDetails?.present?.line2) {
        area = addrDetails.present.line2.trim();
      }

      // 5. Company / Assigned Organization resolution
      let company = (user.organizationName || user.societyName || '').trim();
      const targetOrgId = user.organizationId || user.societyId;
      if (!company && targetOrgId && orgsMap.has(targetOrgId)) {
        company = orgsMap.get(targetOrgId) || '';
      }
      if (!company && user.department) {
        company = user.department;
      }
      if (!company) {
        company = 'Not Assigned';
      }

      // 6. Reporting Manager resolution
      let reportingManagerName = 'Not Assigned';
      let reportingManagerPhone = '';
      let reportingManagerRole = '';
      let reportingManagerPhoto = '';

      if (user.reportingManagerId && usersMap.has(user.reportingManagerId)) {
        const mgr = usersMap.get(user.reportingManagerId)!;
        reportingManagerName = mgr.name || 'Manager';
        reportingManagerPhone = mgr.phone || (mgr as any).personalDetails?.mobile || '';
        reportingManagerRole = mgr.role || '';
        reportingManagerPhoto = mgr.photoUrl || '';
      }

      // 7. Role display name
      const roleDisplayName = rolesMap.get(user.roleId) || user.role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Staff';

      return {
        user,
        name: user.name || 'Unnamed Employee',
        email: user.email || '',
        phone,
        role: user.role || 'staff',
        roleDisplayName,
        department: user.department || user.organizationName || 'Operations',
        company,
        companyId: targetOrgId || undefined,
        area: area || 'Not Specified',
        pincode: pincode || 'N/A',
        fullAddress: fullAddress || 'Address Not Provided',
        reportingManagerName,
        reportingManagerPhone,
        reportingManagerRole,
        reportingManagerPhoto,
        hasAddress: Boolean(fullAddress && fullAddress !== 'Address Not Provided'),
        latitude: user.homeLatitude,
        longitude: user.homeLongitude,
        radius: user.homeRadius
      };
    });
  }, [users, usersMap, rolesMap, orgsMap]);

  // Distinct filter options with occurrence counts
  const uniqueCompanies = useMemo(() => {
    const counts = new Map<string, number>();
    addressRecords.forEach(r => {
      const c = r.company || 'Not Assigned';
      counts.set(c, (counts.get(c) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, name: id, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [addressRecords]);

  const uniqueAreas = useMemo(() => {
    const counts = new Map<string, number>();
    addressRecords.forEach(r => {
      const a = r.area || 'Not Specified';
      counts.set(a, (counts.get(a) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, name: id, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [addressRecords]);

  const uniquePincodes = useMemo(() => {
    const counts = new Map<string, number>();
    addressRecords.forEach(r => {
      const p = r.pincode || 'N/A';
      counts.set(p, (counts.get(p) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, name: id, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [addressRecords]);

  const uniqueManagers = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    addressRecords.forEach(r => {
      const id = r.user.reportingManagerId || 'unassigned';
      const name = r.reportingManagerName || 'Not Assigned';
      const existing = counts.get(id);
      counts.set(id, { name, count: (existing?.count || 0) + 1 });
    });
    return Array.from(counts.entries())
      .map(([id, data]) => ({ id, name: data.name, count: data.count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [addressRecords]);

  const uniqueRoles = useMemo(() => {
    const counts = new Map<string, number>();
    addressRecords.forEach(r => {
      const role = r.roleDisplayName || 'Staff';
      counts.set(role, (counts.get(role) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, name: id, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [addressRecords]);

  const statusOptions = useMemo(() => [
    { id: 'configured', name: 'Address Added', count: addressRecords.filter(r => r.hasAddress).length },
    { id: 'missing', name: 'Not Entered Details', count: addressRecords.filter(r => !r.hasAddress).length }
  ], [addressRecords]);

  // Filtered and sorted records
  const filteredRecords = useMemo(() => {
    return addressRecords
      .filter(item => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = item.name.toLowerCase().includes(q);
          const matchEmail = item.email.toLowerCase().includes(q);
          const matchPhone = item.phone.toLowerCase().includes(q);
          const matchCompany = item.company.toLowerCase().includes(q);
          const matchArea = item.area.toLowerCase().includes(q);
          const matchPin = item.pincode.toLowerCase().includes(q);
          const matchAddr = item.fullAddress.toLowerCase().includes(q);
          const matchMgr = item.reportingManagerName.toLowerCase().includes(q);
          const matchRole = item.roleDisplayName.toLowerCase().includes(q);
          if (!matchName && !matchEmail && !matchPhone && !matchCompany && !matchArea && !matchPin && !matchAddr && !matchMgr && !matchRole) {
            return false;
          }
        }

        // Multi-select: Company filter
        if (selectedCompanies.length > 0 && !selectedCompanies.includes(item.company)) {
          return false;
        }

        // Multi-select: Area filter
        if (selectedAreas.length > 0 && !selectedAreas.includes(item.area)) {
          return false;
        }

        // Multi-select: Pin code filter
        if (selectedPincodes.length > 0 && !selectedPincodes.includes(item.pincode)) {
          return false;
        }

        // Multi-select: Manager filter
        if (selectedManagers.length > 0) {
          const mgrId = item.user.reportingManagerId || 'unassigned';
          if (!selectedManagers.includes(mgrId)) {
            return false;
          }
        }

        // Multi-select: Role filter
        if (selectedRoles.length > 0 && !selectedRoles.includes(item.roleDisplayName)) {
          return false;
        }

        // Multi-select: Address status filter
        if (selectedStatuses.length > 0) {
          const status = item.hasAddress ? 'configured' : 'missing';
          if (!selectedStatuses.includes(status)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        if (sortBy === 'company_asc') return a.company.localeCompare(b.company);
        if (sortBy === 'area_asc') return a.area.localeCompare(b.area);
        if (sortBy === 'pincode_asc') return a.pincode.localeCompare(b.pincode);
        if (sortBy === 'manager_asc') return a.reportingManagerName.localeCompare(b.reportingManagerName);
        return 0;
      });
  }, [addressRecords, searchQuery, selectedCompanies, selectedAreas, selectedPincodes, selectedManagers, selectedRoles, selectedStatuses, sortBy]);

  // Statistics metrics
  const stats = useMemo(() => {
    const total = addressRecords.length;
    const withAddress = addressRecords.filter(r => r.hasAddress).length;
    const missingAddress = total - withAddress;
    const distinctPins = uniquePincodes.length;
    const distinctAreas = uniqueAreas.length;
    const distinctCompanies = uniqueCompanies.length;
    const coveragePercent = total > 0 ? Math.round((withAddress / total) * 100) : 0;
    return { total, withAddress, missingAddress, distinctPins, distinctAreas, distinctCompanies, coveragePercent };
  }, [addressRecords, uniquePincodes, uniqueAreas, uniqueCompanies]);

  // Copy address to clipboard
  const handleCopyAddress = (id: string, address: string) => {
    if (!address || address === 'Address Not Provided') return;
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setToast({ message: 'Full address copied to clipboard!', type: 'success' });
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Open Google Maps search
  const handleOpenMaps = (item: UserAddressInfo) => {
    let url = '';
    if (item.latitude && item.longitude) {
      url = `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;
    } else if (item.fullAddress && item.fullAddress !== 'Address Not Provided') {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.fullAddress)}`;
    } else if (item.area && item.area !== 'Not Specified') {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.area + ' ' + (item.pincode !== 'N/A' ? item.pincode : ''))}`;
    }
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      setToast({ message: 'No location coordinates or address available for maps.', type: 'warning' });
    }
  };

  // Open Edit Address Modal
  const handleOpenEdit = (item: UserAddressInfo) => {
    setEditingUser(item);
    setEditAddressText(item.fullAddress === 'Address Not Provided' ? '' : item.fullAddress);
    setEditAreaText(item.area === 'Not Specified' ? '' : item.area);
    setEditPincodeText(item.pincode === 'N/A' ? '' : item.pincode);
    setEditPhoneText(item.phone || '');
    setEditManagerId(item.user.reportingManagerId || '');
    setEditCompanyId(item.user.organizationId || item.user.societyId || '');
  };

  // Auto-detect area & PIN from address inside modal
  const handleAutoDetectModal = () => {
    if (!editAddressText.trim()) return;
    const res = extractLocalityAndPin(editAddressText);
    if (res.locality) setEditAreaText(res.locality);
    if (res.pincode) setEditPincodeText(res.pincode);
    setToast({ message: 'Area and PIN auto-detected from address!', type: 'info' });
  };

  // Save Address Changes
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const selectedOrg = organizations.find(o => o.id === editCompanyId);
      const updates: Partial<User> = {
        homeAddress: editAddressText.trim() || null,
        locationName: editAreaText.trim() || null,
        location: editAreaText.trim() || null,
        phone: editPhoneText.trim() || null,
        reportingManagerId: editManagerId || null,
        organizationId: editCompanyId || null,
        organizationName: selectedOrg ? (selectedOrg.name || selectedOrg.shortName) : null
      };

      await api.updateUser(editingUser.user.id, updates);

      // Update in memory state
      setUsers(prev => prev.map(u => (u.id === editingUser.user.id ? { ...u, ...updates } : u)));

      setToast({ message: `Updated residential & location details for ${editingUser.name}!`, type: 'success' });
      setEditingUser(null);
    } catch (err) {
      console.error('Failed to update address', err);
      setToast({ message: 'Failed to update user address.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Batch sync all locations from addresses to database
  const handleSyncAllLocations = async () => {
    setIsSyncingLocations(true);
    try {
      let syncedCount = 0;
      for (const item of addressRecords) {
        if (item.hasAddress && item.area && item.area !== 'Not Specified') {
          if (!item.user.locationName || item.user.locationName.toLowerCase() === 'not specified' || item.user.locationName.toLowerCase() === 'bangalore') {
            await api.updateUser(item.user.id, {
              locationName: item.area,
              location: item.area
            });
            syncedCount++;
          }
        }
      }
      setToast({ message: `Successfully synchronized ${syncedCount} employee locations to database!`, type: 'success' });
      loadData();
    } catch (err) {
      console.error('Failed to sync locations', err);
      setToast({ message: 'Failed to synchronize locations.', type: 'error' });
    } finally {
      setIsSyncingLocations(false);
    }
  };

  // Export to Excel / CSV
  const handleExportCSV = (onlyMissing = false) => {
    const dataset = onlyMissing
      ? addressRecords.filter(r => !r.hasAddress)
      : filteredRecords;

    if (dataset.length === 0) {
      setToast({ message: onlyMissing ? 'No employees with pending address details!' : 'No user records to export.', type: 'warning' });
      return;
    }

    const headers = [
      'Employee ID',
      'Name',
      'Company / Site',
      'Role',
      'Department',
      'Contact Number',
      'Email',
      'Address Status',
      'User Area / Locality',
      'Area PIN Code',
      'Reporting Manager',
      'Manager Contact',
      'Full Home Address',
      'GPS Latitude',
      'GPS Longitude'
    ];

    const rows = dataset.map(r => [
      `"${r.user.biometricId || r.user.id.slice(0, 8)}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.company.replace(/"/g, '""')}"`,
      `"${r.roleDisplayName.replace(/"/g, '""')}"`,
      `"${r.department.replace(/"/g, '""')}"`,
      `"${r.phone}"`,
      `"${r.email}"`,
      `"${r.hasAddress ? 'Address Added' : 'Not Entered Details'}"`,
      `"${r.area.replace(/"/g, '""')}"`,
      `"${r.pincode}"`,
      `"${r.reportingManagerName.replace(/"/g, '""')}"`,
      `"${r.reportingManagerPhone}"`,
      `"${r.fullAddress.replace(/"/g, '""')}"`,
      r.latitude || '',
      r.longitude || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = onlyMissing
      ? `Pending_Address_Not_Entered_List_${dateStr}.csv`
      : `User_Home_Details_Directory_${dateStr}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToast({
      message: onlyMissing
        ? `Exported ${dataset.length} pending records (Not Entered Details) to Excel CSV!`
        : `Exported ${dataset.length} user address records to Excel CSV!`,
      type: 'success'
    });
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCompanies([]);
    setSelectedAreas([]);
    setSelectedPincodes([]);
    setSelectedManagers([]);
    setSelectedRoles([]);
    setSelectedStatuses([]);
    setSortBy('name_asc');
  };

  const hasActiveFilters = searchQuery || selectedCompanies.length > 0 || selectedAreas.length > 0 || selectedPincodes.length > 0 || selectedManagers.length > 0 || selectedRoles.length > 0 || selectedStatuses.length > 0;

  if (isLoading && users.length === 0) {
    return <LoadingScreen message="Loading User Home Directory & Addresses..." />;
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Page Header */}
      <AdminPageHeader title="User Home Details & Location Directory">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            className="flex items-center gap-1.5"
            title="Refresh Directory"
          >
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Sync Locations to DB */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncAllLocations}
            isLoading={isSyncingLocations}
            className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100"
            title="Sync all resolved address localities into user records in database"
          >
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>Sync Locations to DB</span>
          </Button>

          {/* Download Pending Only */}
          {stats.missingAddress > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExportCSV(true)}
              className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100"
              title="Download Excel List of users who have Not Entered Details"
            >
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Export Pending ({stats.missingAddress})</span>
            </Button>
          )}

          {/* Download Full Excel */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExportCSV(false)}
            className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>Download Excel Sheet</span>
          </Button>
        </div>
      </AdminPageHeader>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Total Users</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-primary-text">{stats.total}</div>
            <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
              <span>All registered employees</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Companies</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.distinctCompanies}</div>
            <div className="text-[11px] text-muted mt-0.5">Companies / Sites</div>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl bg-card border shadow-xs flex flex-col justify-between cursor-pointer transition-all ${
            selectedStatuses.length === 1 && selectedStatuses[0] === 'configured'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-border hover:border-emerald-300'
          }`}
          onClick={() => {
            if (selectedStatuses.length === 1 && selectedStatuses[0] === 'configured') {
              setSelectedStatuses([]);
            } else {
              setSelectedStatuses(['configured']);
            }
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Address Added</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.withAddress}</div>
            <div className="text-[11px] text-emerald-600/80 flex items-center gap-1 mt-0.5 font-medium">
              <span className="font-semibold">{stats.coveragePercent}%</span> completed • Multi-Filter
            </div>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl bg-card border shadow-xs flex flex-col justify-between cursor-pointer transition-all ${
            selectedStatuses.length === 1 && selectedStatuses[0] === 'missing'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-border hover:border-amber-300'
          }`}
          onClick={() => {
            if (selectedStatuses.length === 1 && selectedStatuses[0] === 'missing') {
              setSelectedStatuses([]);
            } else {
              setSelectedStatuses(['missing']);
            }
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Not Entered Details</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.missingAddress}</div>
            <div className="text-[11px] text-amber-600 hover:underline flex items-center gap-0.5 mt-0.5 font-medium">
              <span>Click to view pending</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider">PIN Codes</span>
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-primary-text">{stats.distinctPins}</div>
            <div className="text-[11px] text-muted mt-0.5">Distinct postal zones</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">Locality Areas</span>
            <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-primary-text">{stats.distinctAreas}</div>
            <div className="text-[11px] text-muted mt-0.5">Distinct user localities</div>
          </div>
        </div>
      </div>

      {/* Multi-Select Filter & Search Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Global Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Employee name, company, area, PIN code, address, manager, phone..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View Mode Switcher (Desktop/Tablet) */}
          <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>

        {/* Multi-Dimensional Multi-Select Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 pt-2 border-t border-border/60 text-xs">
          {/* Multi-Select: Address Status */}
          <FilterMultiSelect
            label="Address Status"
            options={statusOptions}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
            badgeColor="amber"
          />

          {/* Multi-Select: Company / Site */}
          <FilterMultiSelect
            label="Company / Site"
            options={uniqueCompanies}
            selected={selectedCompanies}
            onChange={setSelectedCompanies}
            badgeColor="blue"
          />

          {/* Multi-Select: User Area */}
          <FilterMultiSelect
            label="User Area"
            options={uniqueAreas}
            selected={selectedAreas}
            onChange={setSelectedAreas}
            badgeColor="emerald"
          />

          {/* Multi-Select: PIN Code */}
          <FilterMultiSelect
            label="Area PIN Code"
            options={uniquePincodes}
            selected={selectedPincodes}
            onChange={setSelectedPincodes}
            badgeColor="teal"
          />

          {/* Multi-Select: Reporting Manager */}
          <FilterMultiSelect
            label="Reporting Manager"
            options={uniqueManagers}
            selected={selectedManagers}
            onChange={setSelectedManagers}
            badgeColor="cyan"
          />

          {/* Multi-Select: Role / Designation */}
          <FilterMultiSelect
            label="Role / Designation"
            options={uniqueRoles}
            selected={selectedRoles}
            onChange={setSelectedRoles}
            badgeColor="slate"
          />

          {/* Sort Order */}
          <div>
            <label className="block text-[11px] font-semibold text-muted mb-1">Sort Order</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="company_asc">Company (A-Z)</option>
              <option value="area_asc">Area (A-Z)</option>
              <option value="pincode_asc">PIN Code (Low to High)</option>
              <option value="manager_asc">Reporting Manager</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 pt-2 flex-wrap text-xs">
            <span className="text-muted font-medium text-[11px]">Active Filters:</span>
            {searchQuery && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1 text-[11px]">
                Search: {searchQuery}
                <button onClick={() => setSearchQuery('')} className="hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedStatuses.map(statusId => (
              <span
                key={statusId}
                className={`px-2 py-0.5 rounded-full flex items-center gap-1 text-[11px] ${
                  statusId === 'configured'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                }`}
              >
                Status: {statusId === 'configured' ? 'Address Added' : 'Not Entered Details'}
                <button
                  onClick={() => setSelectedStatuses(selectedStatuses.filter(s => s !== statusId))}
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedCompanies.map(comp => (
              <span
                key={comp}
                className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center gap-1 text-[11px]"
              >
                Company: {comp}
                <button
                  onClick={() => setSelectedCompanies(selectedCompanies.filter(c => c !== comp))}
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedAreas.map(area => (
              <span
                key={area}
                className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center gap-1 text-[11px]"
              >
                Area: {area}
                <button
                  onClick={() => setSelectedAreas(selectedAreas.filter(a => a !== area))}
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedPincodes.map(pin => (
              <span
                key={pin}
                className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center gap-1 text-[11px]"
              >
                PIN: {pin}
                <button
                  onClick={() => setSelectedPincodes(selectedPincodes.filter(p => p !== pin))}
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedManagers.map(mgrId => {
              const name = uniqueManagers.find(m => m.id === mgrId)?.name || mgrId;
              return (
                <span
                  key={mgrId}
                  className="px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 flex items-center gap-1 text-[11px]"
                >
                  Manager: {name}
                  <button
                    onClick={() => setSelectedManagers(selectedManagers.filter(m => m !== mgrId))}
                    className="hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            {selectedRoles.map(role => (
              <span
                key={role}
                className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-1 text-[11px]"
              >
                Role: {role}
                <button
                  onClick={() => setSelectedRoles(selectedRoles.filter(r => r !== role))}
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={clearAllFilters}
              className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 hover:underline ml-1"
            >
              Clear All ({[...selectedCompanies, ...selectedAreas, ...selectedPincodes, ...selectedManagers, ...selectedRoles, ...selectedStatuses].length + (searchQuery ? 1 : 0)})
            </button>
          </div>
        )}
      </div>

      {/* Results Header Count */}
      <div className="flex items-center justify-between px-1 text-xs text-muted">
        <div>
          Showing <span className="font-bold text-primary-text">{filteredRecords.length}</span> of {addressRecords.length} employees
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Address Added ({filteredRecords.filter(r => r.hasAddress).length})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Not Entered Details ({filteredRecords.filter(r => !r.hasAddress).length})
          </span>
        </div>
      </div>

      {/* No Results Found */}
      {filteredRecords.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-3">
          <div className="p-3.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 inline-block">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-primary-text">No Employee Address Records Found</h3>
          <p className="text-xs text-muted max-w-md mx-auto">
            No users matched your current search filters or criteria. Try modifying your search term or clearing filters.
          </p>
          <Button variant="secondary" size="sm" onClick={clearAllFilters}>
            Clear All Filters
          </Button>
        </div>
      )}

      {/* Desktop Table View */}
      {filteredRecords.length > 0 && viewMode === 'table' && !isMobile && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-border text-muted font-bold tracking-wider uppercase text-[11px]">
                  <th className="py-3.5 px-4">Employee Details</th>
                  <th className="py-3.5 px-3">Company / Site</th>
                  <th className="py-3.5 px-3">Contact</th>
                  <th className="py-3.5 px-3">User Area</th>
                  <th className="py-3.5 px-3">PIN Code</th>
                  <th className="py-3.5 px-3">Reporting Manager</th>
                  <th className="py-3.5 px-4 min-w-[240px]">User Home Address (Full)</th>
                  <th className="py-3.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRecords.map(item => {
                  const isCopied = copiedId === item.user.id;
                  return (
                    <tr
                      key={item.user.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Name & Role & Address Status Badge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-emerald-800 dark:text-emerald-300 text-xs shrink-0 overflow-hidden">
                            {item.user.photoUrl ? (
                              <img src={item.user.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              item.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                              <span>{item.name}</span>
                              {item.hasAddress ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60" title="Home Address Configured">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  <span>Address Added</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60" title="Address details not entered">
                                  <AlertCircle className="w-3 h-3 text-amber-500" />
                                  <span>Not Entered Details</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getRoleBadgeClass(item.role)}`}>
                                {item.roleDisplayName}
                              </span>
                              {item.user.biometricId && (
                                <span className="text-[10px] font-mono text-slate-400">ID: {item.user.biometricId}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Company / Site Column */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 max-w-[150px]">
                          <span className="p-1 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 shrink-0">
                            <Building2 className="w-3.5 h-3.5" />
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate" title={item.company}>
                            {item.company}
                          </span>
                        </div>
                      </td>

                      {/* Contact Number & Email */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          {item.phone ? (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${item.phone}`}
                                className="font-mono text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 font-semibold"
                                title="Click to Call"
                              >
                                {item.phone}
                              </a>
                              <a
                                href={`https://wa.me/91${item.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                title="Chat on WhatsApp"
                              >
                                <MessageSquare className="w-3 h-3" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No phone</span>
                          )}
                          {item.email && (
                            <div className="text-[11px] text-slate-400 truncate max-w-[140px]" title={item.email}>
                              {item.email}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* User Area */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {item.area}
                          </span>
                        </div>
                      </td>

                      {/* Area PIN Code */}
                      <td className="py-3 px-3">
                        {item.pincode !== 'N/A' ? (
                          <span className="px-2 py-1 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-mono font-bold text-xs border border-teal-200/80 dark:border-teal-800/60">
                            {item.pincode}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">N/A</span>
                        )}
                      </td>

                      {/* Reporting Manager */}
                      <td className="py-3 px-3">
                        {item.reportingManagerName !== 'Not Assigned' ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              <span>{item.reportingManagerName}</span>
                            </div>
                            {item.reportingManagerPhone && (
                              <a
                                href={`tel:${item.reportingManagerPhone}`}
                                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline block font-mono"
                              >
                                {item.reportingManagerPhone}
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not Assigned</span>
                        )}
                      </td>

                      {/* User Home Address Full */}
                      <td className="py-3 px-4">
                        {item.hasAddress ? (
                          <div className="flex items-start justify-between gap-2 max-w-[340px]">
                            <span className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
                              {item.fullAddress}
                            </span>
                            <div className="flex items-center gap-1 shrink-0 mt-0.5">
                              <button
                                type="button"
                                onClick={() => handleCopyAddress(item.user.id, item.fullAddress)}
                                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                title="Copy Address"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenMaps(item)}
                                className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-emerald-600 hover:text-emerald-700 transition-colors"
                                title="Open in Google Maps"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">Not Entered Details</span>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="text-[11px] text-emerald-600 hover:underline font-semibold"
                            >
                              + Add
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewUser(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 transition-colors"
                            title="View Full Profile & Address"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 transition-colors"
                            title="Edit Address / Area / Company"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid Card View (Desktop / Tablet) or Mobile Default View */}
      {(viewMode === 'grid' || isMobile) && filteredRecords.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecords.map(item => {
            const isCopied = copiedId === item.user.id;
            return (
              <div
                key={item.user.id}
                className="bg-card border border-border rounded-2xl p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3.5 group"
              >
                {/* Card Header: Avatar, Name, Role, Edit Button */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-emerald-800 dark:text-emerald-300 text-sm shrink-0 overflow-hidden">
                      {item.user.photoUrl ? (
                        <img src={item.user.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        item.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate flex items-center gap-1.5">
                        <span className="truncate">{item.name}</span>
                        {item.hasAddress ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Added</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                            <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                            <span>Not Entered Details</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getRoleBadgeClass(item.role)}`}>
                          {item.roleDisplayName}
                        </span>
                        {item.company && item.company !== 'Not Assigned' && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 text-[10px] font-semibold truncate max-w-[120px]">
                            {item.company}
                          </span>
                        )}
                        {item.user.biometricId && (
                          <span className="text-[10px] font-mono text-slate-400">ID: {item.user.biometricId}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit Address & Company"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                {/* Company & Contact Links */}
                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border/60">
                  <div className="flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-slate-800 dark:text-slate-200 font-semibold truncate" title={item.company}>
                      {item.company}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    {item.phone && (
                      <a
                        href={`https://wa.me/91${item.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Contact Phone & Area */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  <div>
                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Contact Phone</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                      {item.phone ? (
                        <a href={`tel:${item.phone}`} className="font-mono hover:underline truncate">
                          {item.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400 font-normal italic">N/A</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider">User Area (PIN)</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                      <span className="truncate">{item.area}</span>
                      {item.pincode !== 'N/A' && (
                        <span className="text-[10px] font-mono text-teal-600 dark:text-teal-400">({item.pincode})</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reporting Manager Row */}
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-muted font-medium">Reporting Manager:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    {item.reportingManagerName !== 'Not Assigned' ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>{item.reportingManagerName}</span>
                      </>
                    ) : (
                      <span className="text-slate-400 italic">None</span>
                    )}
                  </span>
                </div>

                {/* Full Residential Address Box */}
                <div className="bg-slate-50/70 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-muted uppercase tracking-wider">
                    <span>Full Residential Address</span>
                    <div className="flex items-center gap-1">
                      {item.hasAddress ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopyAddress(item.user.id, item.fullAddress)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition-colors"
                            title="Copy Address"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenMaps(item)}
                            className="p-1 rounded hover:bg-emerald-100 text-emerald-600 transition-colors"
                            title="Google Maps"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-amber-600 text-[10px] font-bold">Not Entered Details</span>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs line-clamp-3">
                    {item.fullAddress}
                  </p>
                </div>

                {/* Bottom Card Action */}
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenMaps(item)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-600" />
                    <span>View Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="py-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-semibold text-xs transition-colors"
                  >
                    Edit Address
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Address Modal */}
      {editingUser && (
        <Modal
          isOpen={true}
          onClose={() => setEditingUser(null)}
          title={`Edit Residential Address: ${editingUser.name}`}
          maxWidth="md:max-w-xl"
          hideFooter={true}
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center shrink-0">
                {editingUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{editingUser.name}</div>
                <div className="text-xs text-muted">{editingUser.roleDisplayName} • {editingUser.company}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Company / Assigned Site */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Company / Assigned Site
                </label>
                <select
                  value={editCompanyId}
                  onChange={e => setEditCompanyId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- No Company Assigned --</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name || org.shortName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reporting Manager */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reporting Manager
                </label>
                <select
                  value={editManagerId}
                  onChange={e => setEditManagerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- No Manager Assigned --</option>
                  {users
                    .filter(u => u.id !== editingUser.user.id)
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role?.replace(/_/g, ' ')})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* User Area / Locality */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  User Area <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editAreaText}
                  onChange={e => setEditAreaText(e.target.value)}
                  placeholder="e.g. Whitefield"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Area PIN Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  PIN Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={editPincodeText}
                  onChange={e => setEditPincodeText(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 560066"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Contact Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={editPhoneText}
                  onChange={e => setEditPhoneText(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Full Home Address Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Full Residential Home Address (Door No, Street, Landmark, City, State)
                </label>
                {editAddressText && (
                  <button
                    type="button"
                    onClick={handleAutoDetectModal}
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Compass className="w-3 h-3" />
                    <span>Auto-Fill Area & PIN</span>
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                value={editAddressText}
                onChange={e => {
                  const val = e.target.value;
                  setEditAddressText(val);
                  // If area or pincode is empty or Not Specified, auto-fill from address
                  if (!editAreaText || editAreaText === 'Not Specified') {
                    const parsed = extractLocalityAndPin(val);
                    if (parsed.locality) setEditAreaText(parsed.locality);
                    if (parsed.pincode && (!editPincodeText || editPincodeText === 'N/A')) setEditPincodeText(parsed.pincode);
                  }
                }}
                placeholder="Enter complete door no, building name, cross street, landmark, city, state and pincode..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingUser(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Save Residential & Company Details
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Preview Full Profile Drawer */}
      {previewUser && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewUser(null)}
          title={`Employee Residential Profile: ${previewUser.name}`}
          maxWidth="md:max-w-lg"
          hideFooter={true}
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-base shrink-0">
                {previewUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{previewUser.name}</div>
                <div className="text-muted">{previewUser.roleDisplayName} • {previewUser.company}</div>
                <div className="font-mono text-slate-400 text-[11px] mt-0.5">ID: {previewUser.user.id}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Company / Site</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{previewUser.company}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Area / Locality</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{previewUser.area}</span>
              </div>
              <div className="mt-2">
                <span className="text-muted block text-[10px] uppercase font-bold">PIN Code</span>
                <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{previewUser.pincode}</span>
              </div>
              <div className="mt-2">
                <span className="text-muted block text-[10px] uppercase font-bold">Contact Number</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{previewUser.phone || 'N/A'}</span>
              </div>
              <div className="mt-2 col-span-2">
                <span className="text-muted block text-[10px] uppercase font-bold">Reporting Manager</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{previewUser.reportingManagerName}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
              <span className="text-muted block text-[10px] uppercase font-bold">Full Address</span>
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                {previewUser.fullAddress}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => handleOpenMaps(previewUser)}>
                <Compass className="w-3.5 h-3.5 mr-1" /> Open Map
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const target = previewUser;
                  setPreviewUser(null);
                  handleOpenEdit(target);
                }}
              >
                <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Address & Company
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}

