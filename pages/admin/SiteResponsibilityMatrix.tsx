import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  UserCheck, 
  FileText, 
  Layers, 
  Search, 
  Filter, 
  Plus, 
  Edit2, 
  Trash2, 
  Download, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  RefreshCw, 
  Sparkles, 
  PhoneCall, 
  Mail, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle,
  SlidersHorizontal,
  Users,
  MapPin,
  Building,
  Briefcase,
  Calendar,
  IndianRupee
} from 'lucide-react';
import { api } from '../../services/api';
import type { SiteResponsibilityMatrix } from '../../types/siteRouting';
import type { Location, User as AppUser, OrganizationGroup } from '../../types';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import SearchableSelect from '../../components/ui/SearchableSelect';
import Toast from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { SiteEscalationDrawer } from '../../components/admin/SiteEscalationDrawer';

// Standard Company Entities & Billing Cycles
const STANDARD_COMPANIES = [
  'PIFS',
  'SWLLP',
  'PPFMS',
  'PIFS & PPFMS',
  'PIFS & SWLLP',
  'Paradigm Integrated Facility Services',
  'Swift Wing LLP'
];

const STANDARD_BILLING_CYCLES = [
  '1st Billing Cycle',
  '2nd Billing Cycle',
  '3rd Billing Cycle',
  '4th Salary-only',
  '15th to 14th Cycle',
  'Monthly Calendar'
];

// Helper to extract the primary canonical name root
const getCleanRoot = (name: string): string => {
  if (!name) return '';
  const words = name.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/).filter(w => w.length >= 3);
  let root = words[0] || name.trim().toLowerCase();
  if (root === 'arpitha') root = 'arpita';
  if (root === 'chennamma') root = 'chandana';
  if (root === 'poojashree') root = 'pooja';
  return root;
};

const getUserRoleString = (u: any): string => {
  if (typeof u.role_id === 'string' && u.role_id) return u.role_id.toLowerCase();
  if (typeof u.role === 'string' && u.role) return u.role.toLowerCase();
  if (u.role && typeof u.role.name === 'string') return u.role.name.toLowerCase();
  if (u.roles && typeof u.roles.name === 'string') return u.roles.name.toLowerCase();
  return '';
};

// Strict Role Filters as requested by user
const isStrictOpsManager = (u: any): boolean => {
  const role = getUserRoleString(u);
  if (role === 'operation_manager') return true;
  const email = (u.email || '').toLowerCase();
  return ['isaac.ops@', 'sandeep@paradigmfms.com', 'venkat@', 'shilpa.ops@', 'keshavmani27@', 'stany@', 'harish.hp@', 'nakulalvar@', 'ankur@', 'pradeep@', 'nithin@', 'ravi@'].some(e => email.includes(e));
};

const isStrictHr = (u: any): boolean => {
  const role = getUserRoleString(u);
  if (['hr', 'hr_ops', 'hr_onboaring', 'hr_recruitment'].includes(role)) return true;
  const email = (u.email || '').toLowerCase();
  return ['chandana.hr@', 'onboarding@paradigmfms', 'pooja@', 'hr.kavya@', 'hiring@', 'hrsupport@', 'southwall.hr@'].some(e => email.includes(e));
};

const isStrictFinance = (u: any): boolean => {
  const role = getUserRoleString(u);
  if (['finance', 'finance_manager', 'accounts'].includes(role)) return true;
  const email = (u.email || '').toLowerCase();
  return ['arpitha@', 'sinchana@', 'aryasouthwall@', 'sandeep.accounts@', 'chethan@', 'vishwa.finance@', 'accounts.ape@'].some(e => email.includes(e));
};

const findUserMatch = (
  rawName: string | undefined | null,
  options: Array<{ id: string; name: string; userId?: string }>
) => {
  if (!rawName) return null;
  const clean = rawName.trim().toLowerCase();

  // If joint/multiple managers like 'Pradeepp Gangaiah / Isaac Roy'
  if (rawName.includes('/') || rawName.includes('&')) {
    const parts = rawName.split(/[/&]/).map(s => s.trim()).filter(Boolean);
    const resolvedNames = parts.map(p => {
      const match = options.find(u => {
        const uClean = u.id.toLowerCase();
        const uRoot = getCleanRoot(u.id);
        const pRoot = getCleanRoot(p);
        return uClean === p.toLowerCase() || uRoot === pRoot || uClean.startsWith(pRoot) || pRoot.startsWith(uRoot);
      });
      return match ? match.name : p;
    });
    return {
      id: rawName,
      name: resolvedNames.join(' / ')
    };
  }

  const root = getCleanRoot(rawName);

  // 2. Canonical root match
  return options.find(u => {
    const uClean = u.id.toLowerCase();
    const uRoot = getCleanRoot(u.id);
    return uRoot === root || uClean.startsWith(root) || root.startsWith(uRoot);
  }) || null;
};

// Reusable Multi-Incharge Chip & Dropdown Selector Component
const MultiInchargeSelector: React.FC<{
  label: string;
  badgeIcon: React.ReactNode;
  selectedNames: string | undefined | null;
  options: Array<{ id: string; name: string; userId?: string }>;
  onChange: (names: string, primaryId: string | null) => void;
  required?: boolean;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}> = ({
  label,
  badgeIcon,
  selectedNames,
  options,
  onChange,
  required,
  badgeBg,
  badgeText,
  badgeBorder
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Parse currently selected manager names (normalized against options)
  const currentList = useMemo(() => {
    if (!selectedNames) return [];
    const rawParts = selectedNames.split(/[/&]/).map(s => s.trim()).filter(Boolean);
    const resolved: string[] = [];
    rawParts.forEach(p => {
      const match = findUserMatch(p, options);
      const nameToAdd = match ? match.name : p;
      if (nameToAdd && !resolved.includes(nameToAdd)) {
        resolved.push(nameToAdd);
      }
    });
    return resolved;
  }, [selectedNames, options]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (opt: { id: string; name: string; userId?: string }) => {
    let nextList: string[];
    if (currentList.includes(opt.name)) {
      nextList = currentList.filter(n => n !== opt.name);
    } else {
      nextList = [...currentList, opt.name];
    }
    const joined = nextList.join(' / ');
    const firstMatch = nextList.length > 0 ? options.find(o => o.name === nextList[0]) : null;
    onChange(joined, firstMatch?.userId || null);
  };

  const handleRemove = (nameToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextList = currentList.filter(n => n !== nameToRemove);
    const joined = nextList.join(' / ');
    const firstMatch = nextList.length > 0 ? options.find(o => o.name === nextList[0]) : null;
    onChange(joined, firstMatch?.userId || null);
  };

  return (
    <div className="flex flex-col relative" ref={containerRef}>
      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 h-4 flex items-center justify-between">
        <span>
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {currentList.length > 1 && (
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md">
            {currentList.length} Selected (Joint)
          </span>
        )}
      </label>

      {/* Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] py-1.5 px-2.5 text-xs sm:text-sm rounded-xl bg-gray-50 dark:bg-zinc-950 border ${
          isOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200 dark:border-zinc-800'
        } cursor-pointer flex flex-wrap items-center gap-1.5 transition-all`}
      >
        {currentList.length === 0 ? (
          <span className="text-gray-400 text-xs py-1">-- Select Lead --</span>
        ) : (
          currentList.map(name => (
            <span
              key={name}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${badgeBg} ${badgeText} ${badgeBorder} border text-xs font-bold shadow-xs`}
            >
              {badgeIcon}
              <span>{name}</span>
              <button
                type="button"
                onClick={(e) => handleRemove(name, e)}
                className="hover:opacity-75 p-0.5 ml-0.5"
                title="Remove"
              >
                ×
              </button>
            </span>
          ))
        )}
        <span className="ml-auto text-gray-400 text-[10px] font-semibold pl-1">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {/* Dropdown Menu with Checkboxes */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-56 overflow-y-auto p-1.5 space-y-0.5 animate-scale-in">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1">
            Click to select 1 or multiple leads
          </div>
          {options.map(opt => {
            const isChecked = currentList.includes(opt.name);
            return (
              <div
                key={opt.id}
                onClick={() => handleToggle(opt)}
                className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  isChecked
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                    : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>{opt.name}</span>
                </div>
                {isChecked && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">✓ Added</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SiteResponsibilityMatrixPage: React.FC = () => {
  // Core Matrix Data
  const [matrixData, setMatrixData] = useState<SiteResponsibilityMatrix[]>([]);
  const [dbLocations, setDbLocations] = useState<Location[]>([]);
  const [dbUsers, setDbUsers] = useState<AppUser[]>([]);
  const [orgGroups, setOrgGroups] = useState<OrganizationGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Search and Filtering States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSite, setFilterSite] = useState('ALL');
  const [filterOps, setFilterOps] = useState('ALL');
  const [filterHr, setFilterHr] = useState('ALL');
  const [filterAccounts, setFilterAccounts] = useState('ALL');
  const [filterCompany, setFilterCompany] = useState('ALL');
  const [filterCycle, setFilterCycle] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Selection & Bulk Actions
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkOps, setBulkOps] = useState('');
  const [bulkHr, setBulkHr] = useState('');
  const [bulkAccounts, setBulkAccounts] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Active Site for Drawer
  const [drawerSite, setDrawerSite] = useState<SiteResponsibilityMatrix | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Add / Edit Single Site Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Partial<SiteResponsibilityMatrix> | null>(null);

  // Delete Confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Load All Associated Data on Mount
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [matrix, locs, usersRes, orgs] = await Promise.all([
        api.getSiteResponsibilityMatrix(),
        api.getLocations().catch(() => [] as Location[]),
        api.getUsers({ fetchAll: true }).catch(() => [] as AppUser[]),
        api.getOrganizationStructure().catch(() => [] as OrganizationGroup[])
      ]);

      setMatrixData(matrix);
      setDbLocations(locs || []);

      const userList = Array.isArray(usersRes) 
        ? usersRes 
        : (usersRes && Array.isArray((usersRes as any).users)) 
          ? (usersRes as any).users 
          : [];
      setDbUsers(userList);
      setOrgGroups(orgs || []);
    } catch (err: any) {
      console.error(err);
      setToast({ message: 'Failed to load site responsibility data.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // STRICT Operations Managers Only Dropdown List
  const opsUserOptions = useMemo(() => {
    const list: { id: string; name: string; userId?: string }[] = [];
    const seenRoots = new Set<string>();

    dbUsers.forEach(u => {
      if (u.name && isStrictOpsManager(u) && !u.email?.includes('left.')) {
        const cleanName = u.name.trim();
        const root = getCleanRoot(cleanName);
        if (!seenRoots.has(root)) {
          seenRoots.add(root);
          list.push({
            id: cleanName,
            name: cleanName,
            userId: u.id
          });
        }
      }
    });

    // Also include any multi-manager combinations found in matrixData (e.g. 'Pradeepp Gangaiah / Isaac Roy')
    matrixData.forEach(m => {
      const raw = (m.opsManagerName || '').trim();
      if (raw && (raw.includes('/') || raw.includes('&'))) {
        const parts = raw.split(/[/&]/).map(s => s.trim()).filter(Boolean);
        const resolved = parts.map(p => {
          const match = findUserMatch(p, list);
          return match ? match.name : p;
        }).join(' / ');
        
        if (!list.some(item => item.id.toLowerCase() === resolved.toLowerCase())) {
          list.push({
            id: resolved,
            name: `${resolved} (Joint Ops)`,
          });
        }
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [dbUsers, matrixData]);

  // STRICT HR Leads Only Dropdown List
  const hrUserOptions = useMemo(() => {
    const list: { id: string; name: string; userId?: string }[] = [];
    const seenRoots = new Set<string>();

    dbUsers.forEach(u => {
      if (u.name && isStrictHr(u) && !u.email?.includes('left.')) {
        const cleanName = u.email === 'chandana.hr@paradigmfms.com' ? 'Chandana R' : u.name.trim();
        const root = getCleanRoot(cleanName);
        if (!seenRoots.has(root)) {
          seenRoots.add(root);
          list.push({
            id: cleanName,
            name: cleanName,
            userId: u.id
          });
        }
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [dbUsers]);

  // STRICT Accounts & Finance Only Dropdown List
  const accountsUserOptions = useMemo(() => {
    const list: { id: string; name: string; userId?: string }[] = [];
    const seenRoots = new Set<string>();

    dbUsers.forEach(u => {
      if (u.name && isStrictFinance(u) && !u.email?.includes('left.')) {
        const cleanName = u.name.trim();
        const root = getCleanRoot(cleanName);
        if (!seenRoots.has(root)) {
          seenRoots.add(root);
          list.push({
            id: cleanName,
            name: cleanName,
            userId: u.id
          });
        }
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [dbUsers]);

  // Combined site options from DB locations and matrix
  const siteSelectOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; locationId?: string; address?: string }>();

    // From DB Locations
    dbLocations.forEach(loc => {
      if (loc.name) {
        const clean = loc.name.trim();
        map.set(clean.toLowerCase(), {
          id: clean,
          name: loc.address ? `${clean} — ${loc.address}` : clean,
          locationId: loc.id,
          address: loc.address
        });
      }
    });

    // From Org structure entities
    orgGroups.forEach(g => {
      g.companies.forEach(c => {
        c.entities.forEach(e => {
          if (e.name) {
            const clean = e.name.trim();
            if (!map.has(clean.toLowerCase())) {
              map.set(clean.toLowerCase(), {
                id: clean,
                name: e.location ? `${clean} (${e.location})` : clean,
                locationId: e.id,
                address: (e as any).address || e.location
              });
            }
          }
        });
      });
    });

    // From matrix records
    matrixData.forEach(m => {
      if (m.siteName) {
        const clean = m.siteName.trim();
        if (!map.has(clean.toLowerCase())) {
          map.set(clean.toLowerCase(), {
            id: clean,
            name: m.billingLegalName ? `${clean} (${m.billingLegalName})` : clean,
            locationId: m.siteId || undefined
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [dbLocations, orgGroups, matrixData]);

  // Unique Site Options for Filter Dropdown
  const siteFilterOptions = useMemo(() => {
    const list: string[] = [];
    const set = new Set<string>();
    matrixData.forEach(m => {
      if (m.siteName && !set.has(m.siteName.trim().toLowerCase())) {
        set.add(m.siteName.trim().toLowerCase());
        list.push(m.siteName.trim());
      }
    });
    return list.sort((a, b) => a.localeCompare(b));
  }, [matrixData]);

  // Company options
  const companyOptions = useMemo(() => {
    const set = new Set<string>(STANDARD_COMPANIES);
    matrixData.forEach(m => {
      if (m.billingCompany) set.add(m.billingCompany.trim());
    });
    orgGroups.forEach(g => {
      g.companies.forEach(c => {
        if (c.name) set.add(c.name.trim());
      });
    });
    return Array.from(set).sort();
  }, [matrixData, orgGroups]);

  // Billing cycle options
  const cycleOptions = useMemo(() => {
    const set = new Set<string>(STANDARD_BILLING_CYCLES);
    matrixData.forEach(m => {
      if (m.billingCycle) set.add(m.billingCycle.trim());
    });
    return Array.from(set).sort();
  }, [matrixData]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return matrixData.filter(item => {
      const matchSearch = 
        searchTerm === '' ||
        item.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.billingLegalName && item.billingLegalName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        item.opsManagerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.hrInchargeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.accountsInchargeName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchSite = filterSite === 'ALL' || item.siteName.toLowerCase() === filterSite.toLowerCase();

      const matchOps = filterOps === 'ALL' || 
        item.opsManagerName.toUpperCase().includes(filterOps.toUpperCase()) ||
        item.opsManagerName.split(/[/&]/).some(part => {
          const rootPart = getCleanRoot(part);
          const rootFilter = getCleanRoot(filterOps);
          return rootPart === rootFilter || part.trim().toLowerCase() === filterOps.trim().toLowerCase();
        });

      const matchHr = filterHr === 'ALL' || 
        item.hrInchargeName.toUpperCase().includes(filterHr.toUpperCase()) ||
        item.hrInchargeName.split(/[/&]/).some(part => {
          const rootPart = getCleanRoot(part);
          const rootFilter = getCleanRoot(filterHr);
          return rootPart === rootFilter || part.trim().toLowerCase() === filterHr.trim().toLowerCase();
        });

      const matchAccounts = filterAccounts === 'ALL' || 
        item.accountsInchargeName.toUpperCase().includes(filterAccounts.toUpperCase()) ||
        item.accountsInchargeName.split(/[/&]/).some(part => {
          const rootPart = getCleanRoot(part);
          const rootFilter = getCleanRoot(filterAccounts);
          return rootPart === rootFilter || part.trim().toLowerCase() === filterAccounts.trim().toLowerCase();
        });

      const matchCompany = filterCompany === 'ALL' || item.billingCompany === filterCompany;
      const matchCycle = filterCycle === 'ALL' || item.billingCycle === filterCycle;

      return matchSearch && matchSite && matchOps && matchHr && matchAccounts && matchCompany && matchCycle;
    });
  }, [matrixData, searchTerm, filterSite, filterOps, filterHr, filterAccounts, filterCompany, filterCycle]);

  // Paginated dataset
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Select All handlers
  const handleSelectAll = () => {
    if (selectedSites.length === paginatedData.length) {
      setSelectedSites([]);
    } else {
      setSelectedSites(paginatedData.map(d => d.siteName));
    }
  };

  const handleToggleSelect = (siteName: string) => {
    if (selectedSites.includes(siteName)) {
      setSelectedSites(selectedSites.filter(s => s !== siteName));
    } else {
      setSelectedSites([...selectedSites, siteName]);
    }
  };

  // Bulk Reassign Execute
  const handleExecuteBulk = async () => {
    if (selectedSites.length === 0) return;
    try {
      setIsBulkUpdating(true);
      const updates: any = {};
      if (bulkOps) {
        const matched = findUserMatch(bulkOps, opsUserOptions);
        updates.opsManagerName = matched ? matched.id : bulkOps;
        if (matched?.userId) updates.opsManagerId = matched.userId;
      }
      if (bulkHr) {
        const matched = findUserMatch(bulkHr, hrUserOptions);
        updates.hrInchargeName = matched ? matched.id : bulkHr;
        if (matched?.userId) updates.hrInchargeId = matched.userId;
      }
      if (bulkAccounts) {
        const matched = findUserMatch(bulkAccounts, accountsUserOptions);
        updates.accountsInchargeName = matched ? matched.id : bulkAccounts;
        if (matched?.userId) updates.accountsInchargeId = matched.userId;
      }

      await api.bulkUpdateSiteIncharges(selectedSites, updates);
      setToast({ message: `Successfully updated ${selectedSites.length} sites.`, type: 'success' });
      setIsBulkModalOpen(false);
      setSelectedSites([]);
      setBulkOps('');
      setBulkHr('');
      setBulkAccounts('');
      await loadData();
    } catch (err: any) {
      console.error(err);
      setToast({ message: 'Failed to update sites in bulk.', type: 'error' });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // When user picks a site from dropdown in Add/Edit modal, auto-link its data
  const handleSelectSiteInForm = (siteNameSelected: string) => {
    if (!editingSite) return;
    const match = siteSelectOptions.find(s => s.id.toLowerCase() === siteNameSelected.toLowerCase());
    setEditingSite(prev => ({
      ...prev,
      siteName: siteNameSelected,
      siteId: match?.locationId || prev?.siteId || null,
      billingLegalName: prev?.billingLegalName || (match?.address ? `${siteNameSelected} Association` : '')
    }));
  };

  // Save Single Site
  const handleSaveSite = async (siteToSave: Partial<SiteResponsibilityMatrix>) => {
    try {
      const opsMatch = findUserMatch(siteToSave.opsManagerName, opsUserOptions);
      const hrMatch = findUserMatch(siteToSave.hrInchargeName, hrUserOptions);
      const acMatch = findUserMatch(siteToSave.accountsInchargeName, accountsUserOptions);

      const payload: Partial<SiteResponsibilityMatrix> = {
        ...siteToSave,
        opsManagerName: opsMatch ? opsMatch.name : (siteToSave.opsManagerName || ''),
        opsManagerId: opsMatch?.userId || siteToSave.opsManagerId || null,
        hrInchargeName: hrMatch ? hrMatch.name : (siteToSave.hrInchargeName || ''),
        hrInchargeId: hrMatch?.userId || siteToSave.hrInchargeId || null,
        accountsInchargeName: acMatch ? acMatch.name : (siteToSave.accountsInchargeName || ''),
        accountsInchargeId: acMatch?.userId || siteToSave.accountsInchargeId || null
      };

      await api.upsertSiteResponsibility(payload);
      setToast({ message: `Site '${siteToSave.siteName}' saved successfully.`, type: 'success' });
      setIsFormModalOpen(false);
      setEditingSite(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setToast({ message: 'Failed to save site matrix record.', type: 'error' });
    }
  };

  // Delete Site
  const handleDeleteSite = async () => {
    if (!deleteId) return;
    try {
      await api.deleteSiteResponsibility(deleteId);
      setToast({ message: 'Site matrix mapping removed.', type: 'success' });
      setDeleteId(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setToast({ message: 'Failed to delete site matrix mapping.', type: 'error' });
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Site Name', 'Ops Manager', 'HR Incharge', 'Accounts Incharge', 
      'Company', 'Billing Cycle', 'Units / Flats', 'Takeover Date', 'Name as per GST', 'GSTIN', 'PAN'
    ];
    const rows = filteredData.map(d => [
      `"${d.siteName}"`,
      `"${d.opsManagerName}"`,
      `"${d.hrInchargeName}"`,
      `"${d.accountsInchargeName}"`,
      `"${d.billingCompany}"`,
      `"${d.billingCycle || ''}"`,
      d.unitsCount || '',
      `"${d.takeoverDate || ''}"`,
      `"${d.billingLegalName || ''}"`,
      `"${d.gstin || ''}"`,
      `"${d.pan || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Site_Responsibility_Matrix_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return <LoadingScreen message="Loading site responsibility & routing matrix..." />;
  }

  return (
    <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Employee Routing & Site Responsibility Matrix
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Centralized operational routing connecting client societies directly to active Operations, HR, and Finance officers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedSites.length > 0 && (
            <Button
              variant="primary"
              onClick={() => setIsBulkModalOpen(true)}
              className="!bg-emerald-600 hover:!bg-emerald-700 !text-white flex items-center gap-1.5 shadow-md animate-scale-in"
            >
              <Users className="w-4 h-4" />
              Reassign {selectedSites.length} Sites
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Export Matrix
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              setEditingSite({
                siteName: '',
                opsManagerName: 'Sandeep B',
                hrInchargeName: 'Chandana R',
                accountsInchargeName: 'Arpitha Nairy',
                billingCompany: 'PIFS',
                billingCycle: '3rd Billing Cycle',
                isActive: true
              });
              setIsFormModalOpen(true);
            }}
            className="!bg-emerald-600 hover:!bg-emerald-700 !text-white flex items-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add Site Mapping
          </Button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{matrixData.length}</div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Managed Sites</div>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{opsUserOptions.length}</div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Operations Managers</div>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {hrUserOptions.length} HR / {accountsUserOptions.length} Finance
            </div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Support Leads</div>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">100%</div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Automated Dispatch</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm space-y-4 w-full">
        <div className="flex flex-col lg:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Site Name, Registered GST Name, Ops Manager, HR, or Accounts..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-2xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Quick Clear */}
          {(searchTerm || filterSite !== 'ALL' || filterOps !== 'ALL' || filterHr !== 'ALL' || filterAccounts !== 'ALL' || filterCompany !== 'ALL' || filterCycle !== 'ALL') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setFilterSite('ALL');
                setFilterOps('ALL');
                setFilterHr('ALL');
                setFilterAccounts('ALL');
                setFilterCompany('ALL');
                setFilterCycle('ALL');
                setCurrentPage(1);
              }}
              className="!text-xs whitespace-nowrap"
            >
              Reset Filters
            </Button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Site / Client Name</label>
            <select
              value={filterSite}
              onChange={(e) => { setFilterSite(e.target.value); setCurrentPage(1); }}
              className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold truncate"
            >
              <option value="ALL">All Sites ({siteFilterOptions.length})</option>
              {siteFilterOptions.map(site => <option key={site} value={site}>{site}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Ops Lead (Managers Only)</label>
            <select
              value={filterOps}
              onChange={(e) => { setFilterOps(e.target.value); setCurrentPage(1); }}
              className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
            >
              <option value="ALL">All Ops Managers ({opsUserOptions.length})</option>
              {opsUserOptions.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">HR Lead (HR Only)</label>
            <select
              value={filterHr}
              onChange={(e) => { setFilterHr(e.target.value); setCurrentPage(1); }}
              className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
            >
              <option value="ALL">All HR Leads ({hrUserOptions.length})</option>
              {hrUserOptions.map(hr => <option key={hr.id} value={hr.id}>{hr.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Accounts Lead (Finance Only)</label>
            <select
              value={filterAccounts}
              onChange={(e) => { setFilterAccounts(e.target.value); setCurrentPage(1); }}
              className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
            >
              <option value="ALL">All Finance Leads ({accountsUserOptions.length})</option>
              {accountsUserOptions.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Company</label>
            <select
              value={filterCompany}
              onChange={(e) => { setFilterCompany(e.target.value); setCurrentPage(1); }}
              className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
            >
              <option value="ALL">All Companies</option>
              {companyOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Billing Cycle</label>
            <select
              value={filterCycle}
              onChange={(e) => { setFilterCycle(e.target.value); setCurrentPage(1); }}
              className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
            >
              <option value="ALL">All Billing Cycles</option>
              {cycleOptions.map(cy => <option key={cy} value={cy}>{cy}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden w-full">
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
              Showing {filteredData.length} of {matrixData.length} Sites
            </span>
            {selectedSites.length > 0 && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {selectedSites.length} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="py-1 px-2 text-xs rounded-lg bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/70 dark:bg-zinc-950/50 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-zinc-800">
              <tr>
                <th className="py-3.5 px-4 w-10 text-center">
                  <button onClick={handleSelectAll} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                    {selectedSites.length === paginatedData.length && paginatedData.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">Client / Site Name</th>
                <th className="py-3.5 px-4">Operations Manager</th>
                <th className="py-3.5 px-4">HR Lead</th>
                <th className="py-3.5 px-4">Accounts Lead</th>
                <th className="py-3.5 px-4">Company & Cycle</th>
                <th className="py-3.5 px-4 text-center">Escalation & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    No sites found matching the current search / filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => {
                  const isSelected = selectedSites.includes(row.siteName);
                  const opsMatch = findUserMatch(row.opsManagerName, opsUserOptions);
                  const hrMatch = findUserMatch(row.hrInchargeName, hrUserOptions);
                  const acMatch = findUserMatch(row.accountsInchargeName, accountsUserOptions);

                  return (
                    <tr 
                      key={row.id || row.siteName}
                      className={`hover:bg-gray-50/80 dark:hover:bg-zinc-800/40 transition-colors ${isSelected ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''}`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-4 px-4 text-center">
                        <button 
                          onClick={() => handleToggleSelect(row.siteName)}
                          className="p-1 text-gray-400 hover:text-emerald-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Site Name */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <Building className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{row.siteName}</span>
                          {row.unitsCount && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                              {row.unitsCount} flats
                            </span>
                          )}
                        </div>
                        {row.billingLegalName && row.billingLegalName !== row.siteName && (
                          <div className="text-xs text-gray-400 truncate max-w-xs mt-0.5" title={row.billingLegalName}>
                            {row.billingLegalName}
                          </div>
                        )}
                      </td>

                      {/* Operations Lead */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {row.opsManagerName.split(/[/&]/).map((part, i) => {
                            const clean = part.trim();
                            if (!clean) return null;
                            const match = findUserMatch(clean, opsUserOptions);
                            return (
                              <div 
                                key={i} 
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold text-xs border border-emerald-100 dark:border-emerald-900/50 shadow-xs"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{match?.name || clean}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* HR Incharge */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {row.hrInchargeName.split(/[/&]/).map((part, i) => {
                            const clean = part.trim();
                            if (!clean) return null;
                            const match = findUserMatch(clean, hrUserOptions);
                            return (
                              <div 
                                key={i} 
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-semibold text-xs border border-blue-100 dark:border-blue-900/50 shadow-xs"
                              >
                                <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>{match?.name || clean}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Accounts Incharge */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {row.accountsInchargeName.split(/[/&]/).map((part, i) => {
                            const clean = part.trim();
                            if (!clean) return null;
                            const match = findUserMatch(clean, accountsUserOptions);
                            return (
                              <div 
                                key={i} 
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 font-semibold text-xs border border-purple-100 dark:border-purple-900/50 shadow-xs"
                              >
                                <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                <span>{match?.name || clean}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Company & Billing Cycle */}
                      <td className="py-4 px-4">
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-200">{row.billingCompany}</div>
                        <div className="text-[11px] text-gray-400">{row.billingCycle || '3rd Billing Cycle'}</div>
                      </td>

                      {/* Actions & Escalation Trigger */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setDrawerSite(row);
                              setIsDrawerOpen(true);
                            }}
                            className="!text-xs flex items-center gap-1 !py-1 !px-2.5 rounded-xl text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border-emerald-200 dark:border-emerald-800"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            Escalation Matrix
                          </Button>

                          <button
                            onClick={() => {
                              setEditingSite(row);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Edit Mapping"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeleteId(row.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800">
          <Pagination
            currentPage={currentPage}
            totalItems={filteredData.length}
            pageSize={pageSize}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Slide-over Escalation Drawer */}
      <SiteEscalationDrawer
        site={drawerSite}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSave={async (updated) => {
          await api.upsertSiteResponsibility(updated);
          setToast({ message: `Escalation matrix for '${updated.siteName}' updated!`, type: 'success' });
          await loadData();
        }}
      />

      {/* Bulk Reassignment Modal with Strictly Filtered Dropdowns */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title={`Bulk Reassign Incharges for ${selectedSites.length} Sites`}
        maxWidth="md:max-w-xl"
        hideFooter={true}
      >
        <div className="space-y-4 text-sm">
          <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">
            Select the new leads you wish to assign across all <strong className="text-gray-900 dark:text-white">{selectedSites.length}</strong> selected sites. Leave any dropdown unchanged if you do not want to modify that specific role.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                New Operations Lead <span className="text-[11px] font-normal text-gray-400">(Operations Managers Only)</span>
              </label>
              <select
                value={bulkOps}
                onChange={(e) => setBulkOps(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 font-semibold text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">-- Leave Unchanged --</option>
                {opsUserOptions.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                New HR Incharge <span className="text-[11px] font-normal text-gray-400">(HR Leads Only)</span>
              </label>
              <select
                value={bulkHr}
                onChange={(e) => setBulkHr(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 font-semibold text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">-- Leave Unchanged --</option>
                {hrUserOptions.map(hr => <option key={hr.id} value={hr.id}>{hr.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                New Accounts Lead <span className="text-[11px] font-normal text-gray-400">(Finance & Accounts Only)</span>
              </label>
              <select
                value={bulkAccounts}
                onChange={(e) => setBulkAccounts(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 font-semibold text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">-- Leave Unchanged --</option>
                {accountsUserOptions.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end items-center gap-3 pt-5 mt-4 border-t border-gray-100 dark:border-zinc-800">
            <Button variant="secondary" onClick={() => setIsBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleExecuteBulk}
              disabled={isBulkUpdating || (!bulkOps && !bulkHr && !bulkAccounts)}
              className="!bg-emerald-600 hover:!bg-emerald-700 !text-white"
            >
              {isBulkUpdating ? 'Updating...' : `Confirm & Update ${selectedSites.length} Sites`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add / Edit Modal with Perfectly Aligned Grid Layout */}
      {isFormModalOpen && editingSite && (
        <Modal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingSite(null);
          }}
          title={editingSite.id ? `Edit Mapping: ${editingSite.siteName}` : 'Add New Site Responsibility Mapping'}
          maxWidth="md:max-w-2xl lg:max-w-3xl"
          hideFooter={true}
        >
          <div className="space-y-4 text-sm max-h-[78vh] overflow-y-auto pr-1">
            
            {/* Site / Client Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Site / Client Name <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] font-medium text-gray-400">
                  {siteSelectOptions.length} registered sites available
                </span>
              </div>
              <SearchableSelect
                placeholder="Type to search and select site..."
                options={siteSelectOptions}
                value={editingSite.siteName || ''}
                onChange={handleSelectSiteInForm}
                allowCustom={true}
              />
            </div>

            {/* In-Charge Multi-Select Controls: 3 Column Perfectly Aligned Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <MultiInchargeSelector
                label="Operations Lead"
                badgeIcon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                selectedNames={editingSite.opsManagerName}
                options={opsUserOptions}
                onChange={(names, primaryId) => {
                  setEditingSite(prev => ({
                    ...prev,
                    opsManagerName: names,
                    opsManagerId: primaryId || prev?.opsManagerId || null
                  }));
                }}
                required={true}
                badgeBg="bg-emerald-50 dark:bg-emerald-950/40"
                badgeText="text-emerald-800 dark:text-emerald-300"
                badgeBorder="border-emerald-200 dark:border-emerald-900/50"
              />

              <MultiInchargeSelector
                label="HR Incharge"
                badgeIcon={<UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                selectedNames={editingSite.hrInchargeName}
                options={hrUserOptions}
                onChange={(names, primaryId) => {
                  setEditingSite(prev => ({
                    ...prev,
                    hrInchargeName: names,
                    hrInchargeId: primaryId || prev?.hrInchargeId || null
                  }));
                }}
                required={true}
                badgeBg="bg-blue-50 dark:bg-blue-950/40"
                badgeText="text-blue-800 dark:text-blue-300"
                badgeBorder="border-blue-200 dark:border-blue-900/50"
              />

              <MultiInchargeSelector
                label="Accounts Lead"
                badgeIcon={<FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                selectedNames={editingSite.accountsInchargeName}
                options={accountsUserOptions}
                onChange={(names, primaryId) => {
                  setEditingSite(prev => ({
                    ...prev,
                    accountsInchargeName: names,
                    accountsInchargeId: primaryId || prev?.accountsInchargeId || null
                  }));
                }}
                required={true}
                badgeBg="bg-purple-50 dark:bg-purple-950/40"
                badgeText="text-purple-800 dark:text-purple-300"
                badgeBorder="border-purple-200 dark:border-purple-900/50"
              />
            </div>

            {/* Company & Billing Cycle: 2 Column Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  Company / Billing Entity <span className="text-red-500">*</span>
                </label>
                <select
                  value={editingSite.billingCompany || 'PIFS'}
                  onChange={(e) => setEditingSite({ ...editingSite, billingCompany: e.target.value })}
                  className="w-full h-10 py-2 px-3 text-xs sm:text-sm rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {companyOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  Billing Cycle
                </label>
                <select
                  value={editingSite.billingCycle || '3rd Billing Cycle'}
                  onChange={(e) => setEditingSite({ ...editingSite, billingCycle: e.target.value })}
                  className="w-full h-10 py-2 px-3 text-xs sm:text-sm rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {cycleOptions.map(cy => <option key={cy} value={cy}>{cy}</option>)}
                </select>
              </div>
            </div>

            {/* Units and Takeover Date: 2 Column Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  Total Flats / Units Count
                </label>
                <Input
                  type="number"
                  value={editingSite.unitsCount ? String(editingSite.unitsCount) : ''}
                  onChange={(e) => setEditingSite({ ...editingSite, unitsCount: e.target.value ? Number(e.target.value) : null })}
                  placeholder="e.g. 2415"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  Takeover Date
                </label>
                <Input
                  type="date"
                  value={editingSite.takeoverDate || ''}
                  onChange={(e) => setEditingSite({ ...editingSite, takeoverDate: e.target.value })}
                />
              </div>
            </div>

            {/* Legal Billing Name */}
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                Legal / Billing Name <span className="text-[11px] font-normal text-gray-400">(As per GST / RWA Registration)</span>
              </label>
              <Input
                value={editingSite.billingLegalName || ''}
                onChange={(e) => setEditingSite({ ...editingSite, billingLegalName: e.target.value })}
                placeholder="e.g. 42 Queens Square Residents Welfare Association"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end items-center gap-3 pt-5 mt-4 border-t border-gray-100 dark:border-zinc-800">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsFormModalOpen(false);
                  setEditingSite(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSaveSite(editingSite)}
                disabled={!editingSite.siteName || !editingSite.opsManagerName}
                className="!bg-emerald-600 hover:!bg-emerald-700 !text-white px-5 shadow-sm"
              >
                Save Mapping
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <Modal
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          title="Delete Site Mapping"
          maxWidth="md:max-w-md"
          hideFooter={true}
        >
          <div className="space-y-4 text-sm">
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              Are you sure you want to delete this site responsibility mapping? Automated report delivery and task dispatching will fall back to default admin in-charges.
            </p>
            <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
              <Button variant="secondary" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteSite}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SiteResponsibilityMatrixPage;
