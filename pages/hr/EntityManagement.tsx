import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { api } from '../../services/api';
import type { OrganizationGroup, Entity, Company, RegistrationType, Organization, SiteConfiguration, UploadedFile } from '../../types';
import { Plus, Save, Edit, Trash2, Building, ChevronRight, Eye, CheckCircle, AlertCircle, Search, ClipboardList, Settings, Calculator, Users, Badge, HeartPulse, Archive, Wrench, Shirt, FileText, CalendarDays, BarChart, Mail, Sun, UserX, IndianRupee, ChevronLeft, HelpCircle, Loader2, Clock, Zap, SlidersHorizontal, LayoutGrid, List, MapPin, Building2, Layers, ChevronDown, ChevronUp, Sparkles, Filter } from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import EntityForm from '../../components/hr/EntityForm';
import CompanyForm from '../../components/hr/CompanyForm';
import Modal from '../../components/ui/Modal';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useUiSettingsStore } from '../../store/uiSettingsStore';
import TemplateInstructionsModal from '../../components/hr/TemplateInstructionsModal';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import PlaceholderView from '../../components/ui/PlaceholderView';

// Import all the new placeholder components
import CostingResourceConfig from '../../components/hr/CostingResourceConfig';
import BackofficeHeadsConfig from '../../components/hr/BackofficeHeadsConfig';
import StaffDesignationConfig from '../../components/hr/StaffDesignationConfig';
import { GmcPolicyConfig } from '../../components/hr/GmcPolicyConfig';
import AssetConfig from '../../components/hr/AssetConfig';
import ToolsListConfig from '../../components/hr/ToolsListConfig';
import AttendanceFormatConfig from '../../components/hr/AttendanceFormatConfig';
import AttendanceOverviewConfig from '../../components/hr/AttendanceOverviewConfig';
import DailyAttendanceConfig from '../../components/hr/DailyAttendanceConfig';
import NotificationTemplateConfig from '../../components/hr/NotificationTemplateConfig';
import OnboardRejectReasonConfig from '../../components/hr/OnboardRejectReasonConfig';
import SalaryTemplateConfig from '../../components/hr/SalaryTemplateConfig';
import SalaryLineItemConfig from '../../components/hr/SalaryLineItemConfig';
import CompanyHolidaySelectionConfig from '../../components/hr/CompanyHolidaySelectionConfig';
import TemplatesHub from '../../components/hr/TemplatesHub';
import AutoSiteConfig from '../../components/hr/AutoSiteConfig';
import { getProxyUrl } from '../../utils/fileUrl';


const NameInputModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    title: string;
    label: string;
    initialName?: string;
}> = ({ isOpen, onClose, onSave, title, label, initialName = '' }) => {
    const [name, setName] = useState(initialName);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) setName(initialName);
    }, [isOpen, initialName]);

    const handleSave = () => {
        if (!name.trim()) {
            setError('Name cannot be empty.');
            return;
        }
        onSave(name);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
            <div className="bg-card rounded-xl shadow-card p-6 w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold">{title}</h3>
                <div className="mt-4">
                    <Input label={label} id="name-input" value={name} onChange={e => { setName(e.target.value); setError(''); }} error={error} />
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <Button onClick={onClose} variant="secondary">Cancel</Button>
                    <Button onClick={handleSave}>Save</Button>
                </div>
            </div>
        </div>
    );
};

const renderLocationBadge = (location?: string, size: 'xs' | 'sm' | 'md' = 'sm') => {
    if (!location) return null;
    const lower = location.toLowerCase().trim();
    const isBlr = lower.includes('bang') || lower.includes('beng');
    const isHyd = lower.includes('hyd') || lower.includes('secunder');
    const isChennai = lower.includes('chennai') || lower.includes('mds');
    const isMumbai = lower.includes('mumbai') || lower.includes('pune') || lower.includes('bombay');
    const isDelhi = lower.includes('delhi') || lower.includes('noida') || lower.includes('gurgaon');

    let badgeTheme = {
        bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        dot: 'bg-slate-400',
        text: 'text-slate-700 dark:text-slate-300',
        label: location
    };

    if (isBlr) {
        badgeTheme = {
            bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700',
            dot: 'bg-emerald-600 dark:bg-emerald-400',
            text: 'text-emerald-800 dark:text-emerald-200 font-bold',
            label: 'Bangalore'
        };
    } else if (isHyd) {
        badgeTheme = {
            bg: 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-700',
            dot: 'bg-sky-600 dark:bg-sky-400',
            text: 'text-sky-800 dark:text-sky-200 font-bold',
            label: 'Hyderabad'
        };
    } else if (isChennai) {
        badgeTheme = {
            bg: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700',
            dot: 'bg-amber-600 dark:bg-amber-400',
            text: 'text-amber-800 dark:text-amber-200 font-bold',
            label: location
        };
    } else if (isMumbai || isDelhi) {
        badgeTheme = {
            bg: 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700',
            dot: 'bg-indigo-600 dark:bg-indigo-400',
            text: 'text-indigo-800 dark:text-indigo-200 font-bold',
            label: location
        };
    }

    if (size === 'md') {
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-xs tracking-tight ${badgeTheme.bg}`}>
                <span className={`h-2 w-2 rounded-full shadow-xs ${badgeTheme.dot}`} />
                <span className={badgeTheme.text}>{location}</span>
            </span>
        );
    }

    if (size === 'xs') {
        return (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shadow-2xs ${badgeTheme.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${badgeTheme.dot}`} />
                <span className={badgeTheme.text}>{location}</span>
            </span>
        );
    }

    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-2xs ${badgeTheme.bg}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${badgeTheme.dot}`} />
            <span className={badgeTheme.text}>{location}</span>
        </span>
    );
};

const subcategories = [
    { key: 'client_structure', label: 'Client Structure', icon: ClipboardList },
    { key: 'site_configuration', label: 'Site Configuration', icon: Settings },
    { key: 'costing_resource', label: 'Costing & Resource', icon: Calculator },
    { key: 'backoffice_heads', label: 'Back Office & ID Series', icon: Users },
    { key: 'staff_designation', label: 'Staff Designation', icon: Badge },
    { key: 'gmc_policy', label: 'GMC Policy', icon: HeartPulse },
    { key: 'asset', label: 'Asset Management', icon: Archive },
    { key: 'tools_list', label: 'Tools List', icon: Wrench },
    { key: 'attendance_format', label: 'Attendance Format', icon: CalendarDays },
    { key: 'attendance_overview', label: 'Attendance Overview', icon: BarChart },
    { key: 'company_holiday_selection', label: 'Company Holiday Selection', icon: Sun },
    { key: 'notification_template', label: 'Notification & Mail', icon: Mail },
    { key: 'onboard_reject_reason', label: 'Onboarding Rejection Reasons', icon: UserX },
    { key: 'salary_template', label: 'Salary Breakup', icon: IndianRupee },
    { key: 'salary_line_item', label: 'Salary Line Item', icon: IndianRupee },
    { key: 'attendance_bulk', label: 'Attendance Bulk Feed', icon: BarChart },
    { key: 'attendance_monthly_bulk', label: 'Monthly Attendance Feed', icon: CalendarDays },
];

const EntityManagement: React.FC = () => {
    const navigate = useNavigate();
    const [groups, setGroups] = useState<OrganizationGroup[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [searchParams] = useSearchParams();
    const activeSubcategory = searchParams.get('tab') || 'client_structure';
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLocation, setSelectedLocation] = useState<string>('Bangalore');
    const [viewingClients, setViewingClients] = useState<{ companyName: string; clients: Entity[] } | null>(null);
    const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [structureViewMode, setStructureViewMode] = useState<'grid' | 'table'>('grid');
    const [companySearchTerms, setCompanySearchTerms] = useState<Record<string, string>>({});

    const structureStats = useMemo(() => {
        const totalGroups = groups.length;
        let totalCompanies = 0;
        let totalEntities = 0;
        let blrCount = 0;
        let hydCount = 0;

        groups.forEach(g => {
            totalCompanies += g.companies.length;
            g.companies.forEach(c => {
                totalEntities += c.entities.length;
                c.entities.forEach(e => {
                    const loc = (e.location || c.location || '').toLowerCase();
                    if (loc.includes('bang') || loc.includes('beng')) blrCount++;
                    else if (loc.includes('hyd')) hydCount++;
                });
            });
        });

        return { totalGroups, totalCompanies, totalEntities, blrCount, hydCount };
    }, [groups]);

    const toggleExpandAll = () => {
        const anyExpanded = Object.values(expanded).some(Boolean);
        const newExpanded: Record<string, boolean> = {};
        groups.forEach(g => {
            newExpanded[g.id] = !anyExpanded;
            g.companies.forEach(c => {
                newExpanded[c.id] = !anyExpanded;
            });
        });
        setExpanded(newExpanded);
    };

    // ── Manual / Auto config mode state ─────────────────────────────────────
    // Tracks 'manual' | 'auto' per site ID. Seeded from entity.configMode, defaults to 'manual'.
    const [siteConfigModes, setSiteConfigModes] = useState<Record<string, 'manual' | 'auto'>>({});
    // State to open the AutoSiteConfig full-page panel
    const [autoSiteConfigState, setAutoSiteConfigState] = useState<{
        isOpen: boolean;
        siteId: string;
        siteName: string;
        siteLocation?: string;
    }>({ isOpen: false, siteId: '', siteName: '' });

    // Helper — get the current mode for a site (fallback: entity.configMode ?? 'manual')
    const getSiteMode = useCallback((entity: Entity): 'manual' | 'auto' => {
        return siteConfigModes[entity.id] ?? entity.configMode ?? 'manual';
    }, [siteConfigModes]);

    // Helper — toggle mode for a site
    const setSiteMode = useCallback((siteId: string, mode: 'manual' | 'auto') => {
        setSiteConfigModes(prev => ({ ...prev, [siteId]: mode }));
    }, []);

    // Modals state
    const [entityFormState, setEntityFormState] = useState<{ isOpen: boolean; initialData: Entity | null; companyName: string; companyId?: string }>({ isOpen: false, initialData: null, companyName: '', companyId: '' });
    const [nameModalState, setNameModalState] = useState<{
        isOpen: boolean;
        mode: 'add' | 'edit';
        type: 'group' | 'company';
        id?: string;
        groupId?: string;
        initialName?: string;
        title: string;
        label: string
    }>({ isOpen: false, mode: 'add', type: 'group', title: '', label: '' });
    const [companyFormState, setCompanyFormState] = useState<{
        isOpen: boolean;
        mode: 'add' | 'edit';
        groupId: string;
        groupName: string;
        initialData: Partial<Company> | null;
    }>({ isOpen: false, mode: 'add', groupId: '', groupName: '', initialData: null });
    const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; type: 'group' | 'company' | 'client' | 'site'; id: string; name: string }>({ isOpen: false, type: 'group', id: '', name: '' });

    const allClients = useMemo(() => {
        return groups.flatMap(g => g.companies.flatMap(c => c.entities.map(e => ({ ...e, companyName: c.name }))));
    }, [groups]);

    const allCompanies = useMemo(() => groups.flatMap(g => g.companies), [groups]);
    const existingLocations = useMemo(() => {
        const companyLocations = groups.flatMap(g => g.companies.map(c => c.location));
        const entityLocations = groups.flatMap(g => g.companies.flatMap(c => c.entities.map(e => e.location)));
        return Array.from(new Set([...companyLocations, ...entityLocations].filter(Boolean) as string[])).sort();
    }, [groups]);


    const [staffUsers, setStaffUsers] = useState<Array<{ id: string; name: string; photo_url?: string | null }>>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [structure, orgs, usersRes] = await Promise.all([
                    api.getOrganizationStructure(),
                    api.getOrganizations(),
                    api.getUsers({ fetchAll: true }).catch(() => [])
                ]);
                setGroups(structure);
                setOrganizations(orgs);
                if (Array.isArray(usersRes)) {
                    setStaffUsers(usersRes.map((u: any) => ({ id: u.id, name: u.name, photo_url: u.photo_url || u.avatar_url })));
                } else if (usersRes && Array.isArray((usersRes as any).users)) {
                    setStaffUsers((usersRes as any).users.map((u: any) => ({ id: u.id, name: u.name, photo_url: u.photo_url || u.avatar_url })));
                }
            } catch (error) {
                setToast({ message: "Failed to load data.", type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const getOpsManagerInfo = useCallback((kamName: string | undefined) => {
        if (!kamName || !kamName.trim()) return null;
        const cleanKam = kamName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
        const kamWords = cleanKam.split(/\s+/).filter(w => w.length >= 3);
        if (kamWords.length === 0) return { displayName: kamName, photoUrl: null };

        let bestMatch: { id: string; name: string; photo_url?: string | null } | null = null;
        let highestScore = 0;

        for (const u of staffUsers) {
            if (!u.name) continue;
            const cleanUser = u.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
            const userWords = cleanUser.split(/\s+/).filter(Boolean);
            
            let score = 0;
            if (cleanUser === cleanKam) {
                score += 100;
            }
            
            for (const kw of kamWords) {
                if (userWords.includes(kw)) {
                    score += 50;
                } else if (userWords.some(uw => uw.startsWith(kw) || (kw.length >= 4 && kw.startsWith(uw)))) {
                    score += 30;
                }
            }
            
            if (score > 0 && u.photo_url) {
                score += 10;
            }
            
            if (score > highestScore) {
                highestScore = score;
                bestMatch = u;
            }
        }

        if (highestScore >= 30 && bestMatch) {
            return {
                displayName: bestMatch.name || kamName,
                photoUrl: bestMatch.photo_url ? getProxyUrl(bestMatch.photo_url) : null
            };
        }

        return { displayName: kamName, photoUrl: null };
    }, [staffUsers]);

    const filteredGroups = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase().trim();
        const locFilter = selectedLocation;

        return groups.map(group => {
            // If searching by text and group name matches, we might include whole group
            // But if also filtering by location, we must check children
            const groupMatchesSearch = lowerSearch ? group.name.toLowerCase().includes(lowerSearch) : true;

            const matchingCompanies = group.companies.map(company => {
                const companyMatchesSearch = lowerSearch ? company.name.toLowerCase().includes(lowerSearch) : true;
                const companyMatchesLocation = locFilter ? company.location === locFilter : true;

                // Handle entities (societies)
                const matchingEntities = company.entities.filter(entity => {
                    const entityMatchesSearch = lowerSearch ? entity.name.toLowerCase().includes(lowerSearch) : true;
                    const entityMatchesLocation = locFilter ? entity.location === locFilter : true;
                    return entityMatchesSearch && entityMatchesLocation;
                });

                // A company is included if:
                // 1. It matches the location AND (it matches the search OR has matching entities)
                // 2. OR it doesn't match location itself but has matching entities that do
                
                if (locFilter) {
                    // Location filter is active
                    if (companyMatchesLocation) {
                        // Company matches location - show it if it also matches search or has babies
                        if (companyMatchesSearch || matchingEntities.length > 0) {
                            return { ...company, entities: lowerSearch ? matchingEntities : company.entities };
                        }
                    } else if (matchingEntities.length > 0) {
                        // Company doesn't match location, but some entities do
                        return { ...company, entities: matchingEntities };
                    }
                    return null;
                } else {
                    // Only search filter is active (or none)
                    if (companyMatchesSearch) return company;
                    if (matchingEntities.length > 0) return { ...company, entities: matchingEntities };
                    return null;
                }
            }).filter(Boolean) as Company[];

            if (matchingCompanies.length > 0) {
                return { ...group, companies: matchingCompanies };
            }
            // If group name matches search and no specifically filtered companies exist, 
            // we only show the group if no location filter is active
            if (groupMatchesSearch && !locFilter) {
                return group;
            }
            return null;
        }).filter(Boolean) as OrganizationGroup[];
    }, [groups, searchTerm, selectedLocation]);

    const filteredOrganizations = useMemo(() => {
        const lower = searchTerm.toLowerCase().trim();
        const locFilter = selectedLocation;
        
        return organizations.filter(org => {
            const matchesSearch = lower ? org.shortName.toLowerCase().includes(lower) : true;
            // Organizations don't have location at the top level in this schema usually, 
            // but let's keep search working
            return matchesSearch;
        });
    }, [organizations, searchTerm, selectedLocation]);


    const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    const handleSaveAll = async () => {
        setIsLoading(true);
        try {
            await api.bulkSaveOrganizationStructure(groups);
            setToast({ message: 'All changes saved to database successfully.', type: 'success' });
        } catch (error) {
            console.error('Failed to save changes:', error);
            setToast({ message: 'Failed to save changes to database.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // Client/Entity handlers
    const handleAddClient = (companyName: string, companyId: string) => setEntityFormState({ isOpen: true, initialData: null, companyName, companyId });
    const handleEditClient = (entity: Entity, companyName: string, companyId: string) => setEntityFormState({ isOpen: true, initialData: entity, companyName, companyId });
    const handleSaveClient = async (clientData: Entity, pendingFiles: Record<string, UploadedFile | UploadedFile[]>) => {
        try {
            let company = groups.flatMap(g => g.companies).find(c => entityFormState.companyId ? c.id === entityFormState.companyId : c.name === entityFormState.companyName);
            
            // Fallback for global add or missing ID
            if (!company && clientData.companyId) {
                company = allCompanies.find(c => c.id === clientData.companyId);
            }

            if (!company) throw new Error("Company not found. Please select a company.");

            // Process file uploads
            const updatedClientData = { ...clientData };
            const fileEntries = Object.entries(pendingFiles);
            
            if (fileEntries.length > 0) {
                setToast({ message: 'Uploading documents...', type: 'info' as any });
                for (const [path, fileOrFiles] of fileEntries) {
                    if (path.startsWith('doc_') || path.startsWith('ins_') || path.startsWith('pol_')) {
                        // Multi-file upload for Compliance Documents, Insurances, or Policies
                        const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
                        const newFiles = files.filter(f => f.file) as UploadedFile[];
                        const uploadPromises = newFiles.map(f => {
                            const file = f.file!;
                            return api.uploadDocument(file, 'compliance-documents', undefined, path);
                        });
                        const results = await Promise.all(uploadPromises);
                        const newUrls = results.map(r => r.url);

                        // Extract everything after the first prefix (doc_, ins_, pol_)
                        // e.g. "doc_doc_1711544123456" → "doc_1711544123456"
                        const id = path.substring(path.indexOf('_') + 1);
                        if (path.startsWith('doc_')) {
                            if (!updatedClientData.complianceDocuments) updatedClientData.complianceDocuments = [];
                            updatedClientData.complianceDocuments = updatedClientData.complianceDocuments.map(d => 
                                d.id === id ? { ...d, documentUrls: [...(d.documentUrls || []), ...newUrls] } : d
                            );
                        } else if (path.startsWith('ins_')) {
                            if (!updatedClientData.insurances) updatedClientData.insurances = [];
                            updatedClientData.insurances = updatedClientData.insurances.map(i => 
                                i.id === id ? { ...i, documentUrls: [...(i.documentUrls || []), ...newUrls] } : i
                            );
                        } else if (path.startsWith('pol_')) {
                            if (!updatedClientData.policies) updatedClientData.policies = [];
                            updatedClientData.policies = updatedClientData.policies.map(p => 
                                p.id === id ? { ...p, documentUrls: [...(p.documentUrls || []), ...newUrls] } : p
                            );
                        }
                    } else if (['cinDoc', 'dinDoc', 'tanDoc', 'udyogDoc', 'epfoDoc', 'esicDoc', 'shramDoc'].includes(path)) {
                        // Single file registration/statutory docs
                        const f = (Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles) as UploadedFile;
                        const file = f?.file;
                        if (!file) continue;
                        const uploadResult = await api.uploadDocument(file, 'onboarding-documents', undefined, path);
                        
                        const mapping: Record<string, string> = {
                            cinDoc: 'cinDocUrl',
                            dinDoc: 'dinDocUrl',
                            tanDoc: 'tanDocUrl',
                            udyogDoc: 'udyogDocUrl',
                            epfoDoc: 'epfoDocUrl',
                            esicDoc: 'esicDocUrl',
                            shramDoc: 'eShramDocUrl',
                            gstDoc: 'gstDocUrl',
                            panDoc: 'panDocUrl',
                            msmeDoc: 'msmeDocUrl',
                            labourDoc: 'labourRegistrationDocUrl',
                            shopDoc: 'shopEstablishmentDocUrl',
                            rtecDoc: 'rtecDocUrl',
                            ptecDoc: 'ptecDocUrl',
                            ptpEnrolmentDoc: 'ptpEnrolmentDocUrl',
                            ptpRegDoc: 'ptpRegistrationDocUrl'
                        };
                        (updatedClientData as any)[mapping[path]] = uploadResult.url;
                    } else if (path === 'logo') {
                        // Society Logo
                        const f = (Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles) as UploadedFile;
                        const file = f?.file;
                        if (!file) continue;
                        const uploadResult = await api.uploadLogo(file);
                        updatedClientData.logoUrl = uploadResult;
                    } else {
                        // Array/Nested path handling
                        const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
                        const newFiles = files.filter(f => f.file) as UploadedFile[];
                        if (newFiles.length === 0) continue;
                        
                        const uploadPromises = newFiles.map(f => {
                            const file = f.file!;
                            return api.uploadDocument(file, 'onboarding-documents', undefined, path);
                        });
                        const results = await Promise.all(uploadPromises);
                        const newUrls = results.map(r => r.url);
                        
                        const pathParts = path.split('.');
                        let current: any = updatedClientData;
                        for (let i = 0; i < pathParts.length - 1; i++) {
                            const nextIsNumber = !isNaN(Number(pathParts[i + 1]));
                            if (!current[pathParts[i]]) {
                                current[pathParts[i]] = nextIsNumber ? [] : {};
                            }
                            current = current[pathParts[i]];
                        }
                        
                        const lastPart = pathParts[pathParts.length - 1];
                        
                        // Handle specific fields that expect arrays
                        const arrayFields = ['wordCopy', 'signedCopy', 'dcCopy1', 'dcCopy2', 'docUrls', 'securityDepositDoc'];
                        if (arrayFields.includes(lastPart)) {
                            const targetField = lastPart === 'docUrls' ? 'docUrls' : `${lastPart}Urls`;
                            current[targetField] = [...(current[targetField] || []), ...newUrls];
                        } else {
                            // Single URL fields
                            current[`${lastPart}Url`] = newUrls[0];
                        }
                    }
                }
            }

            const savedClient = await api.saveEntity({ ...updatedClientData, companyId: company.id });
            
            setGroups(prev => prev.map(group => ({
                ...group,
                companies: group.companies.map(c => {
                    if (c.id === company.id) {
                        const exists = c.entities.some(e => e.id === savedClient.id);
                        return {
                            ...c,
                            entities: exists 
                                ? c.entities.map(e => e.id === savedClient.id ? savedClient : e)
                                : [...c.entities, savedClient]
                        };
                    }
                    return c;
                })
            })));

            if (clientData.status === 'draft') {
                setToast({ message: 'Draft saved successfully.', type: 'success' });
                setEntityFormState(prev => ({ ...prev, initialData: savedClient }));
            } else {
                setToast({ message: clientData.id.startsWith('new_') ? 'Society added successfully.' : 'Society updated successfully.', type: 'success' });
                setEntityFormState({ isOpen: false, initialData: null, companyName: '', companyId: '' });
            }
        } catch (error) {
            console.error('Save failed:', error);
            setToast({ message: 'Failed to save client document or data. If this is a new draft, please ensure at least the name is provided.', type: 'error' });
        }
    };

    const handleDeleteClick = (type: 'group' | 'company' | 'client' | 'site', id: string, name: string) => setDeleteModalState({ isOpen: true, type, id, name });

    const handleConfirmDelete = async () => {
        const { type, id, name } = deleteModalState;
        try {
            if (type === 'group') {
                await api.deleteOrganizationGroup(id);
                setGroups(prev => prev.filter(g => g.id !== id));
            } else if (type === 'company') {
                await api.deleteCompany(id);
                setGroups(prev => prev.map(group => ({
                    ...group,
                    companies: group.companies.filter(c => c.id !== id)
                })));
            } else if (type === 'client') {
                await api.deleteEntity(id);
                setGroups(prev => prev.map(group => ({
                    ...group,
                    companies: group.companies.map(company => ({
                        ...company,
                        entities: company.entities.filter(e => e.id !== id)
                    }))
                })));
            } else if (type === 'site') {
                const entityToDelete = allClients.find(e => e.id === id);
                const orgId = entityToDelete?.organizationId || id;
                
                await Promise.all([
                    api.deleteEntity(id),
                    api.deleteOrganization(orgId)
                ]);

                // Update groups state to remove the entity (this updates the UI list)
                setGroups(prev => prev.map(group => ({
                    ...group,
                    companies: group.companies.map(company => ({
                        ...company,
                        entities: company.entities.filter(e => e.id !== id)
                    }))
                })));
                
                setOrganizations(prev => prev.filter(o => o.id !== orgId));
            }
            const typeLabel = type === 'site' ? 'Site' : type === 'client' ? 'Society' : type === 'company' ? 'Company / LLP / Partnership / Society' : 'Group';
            setToast({ message: `${typeLabel} '${name}' deleted.`, type: 'success' });
        } catch (error) {
            setToast({ message: `Failed to delete ${type}.`, type: 'error' });
        }
        setDeleteModalState({ isOpen: false, type: 'group', id: '', name: '' });
    };

    const handleSaveCompanyData = async (data: Partial<Company>, pendingFiles: Record<string, UploadedFile | UploadedFile[]>) => {
        try {
            const { mode, groupId } = companyFormState;
            const newGroups = [...groups];
            const groupIndex = newGroups.findIndex(g => g.id === groupId);
            if (groupIndex === -1) return;

            setToast({ message: 'Saving company & uploading files...', type: 'success' });
            const updatedData = { ...data };
            
            // 1. Upload Logo if present
            if (pendingFiles['logo'] && !Array.isArray(pendingFiles['logo'])) {
                const logoFile = (pendingFiles['logo'] as UploadedFile).file;
                if (logoFile) {
                    const logoUrl = await api.uploadLogo(logoFile);
                    updatedData.logoUrl = logoUrl;
                }
            }

            // 1b. Registration & Statutory Documents
            const fileEntries = Object.entries(pendingFiles);
            for (const [path, fileOrFiles] of fileEntries) {
                if (['cinDoc', 'dinDoc', 'tanDoc', 'udyogDoc', 'gstDoc', 'panDoc', 'epfoDoc', 'esicDoc', 'shramDoc'].includes(path)) {
                    const fileObj = (Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles) as UploadedFile;
                    const file = fileObj?.file;
                    if (!file) continue;
                    
                    const { url } = await api.uploadDocument(file);
                    
                    const mapping: Record<string, { field: string; nested?: string }> = {
                        cinDoc: { field: 'cinDocUrl' },
                        dinDoc: { field: 'dinDocUrl' },
                        tanDoc: { field: 'tanDocUrl' },
                        udyogDoc: { field: 'udyogDocUrl' },
                        gstDoc: { field: 'gstDocUrl' },
                        panDoc: { field: 'panDocUrl' },
                        msmeDoc: { field: 'msmeDocUrl' },
                        labourDoc: { field: 'labourRegistrationDocUrl' },
                        shopDoc: { field: 'shopEstablishmentDocUrl' },
                        rtecDoc: { field: 'rtecDocUrl' },
                        ptecDoc: { field: 'ptecDocUrl' },
                        ptpEnrolmentDoc: { field: 'ptpEnrolmentDocUrl' },
                        ptpRegDoc: { field: 'ptpRegistrationDocUrl' },
                        epfoDoc: { field: 'epfoDocUrl', nested: 'complianceCodes' },
                        esicDoc: { field: 'esicDocUrl', nested: 'complianceCodes' },
                        shramDoc: { field: 'eShramDocUrl', nested: 'complianceCodes' },
                        logo: { field: 'logoUrl' }
                    };
                    
                    const { field, nested } = mapping[path];
                    if (nested) {
                        if (!(updatedData as any)[nested]) (updatedData as any)[nested] = {};
                        (updatedData as any)[nested][field] = url;
                    } else {
                        (updatedData as any)[field] = url;
                    }
                }
            }

            // 2. Upload Compliance Documents
            if (updatedData.complianceDocuments) {
                for (const doc of updatedData.complianceDocuments) {
                    const pendingForDoc = pendingFiles[`doc_${doc.id}`];
                    if (pendingForDoc) {
                        if (Array.isArray(pendingForDoc)) {
                            // Upload multiple files 
                            const newFiles = (pendingForDoc as UploadedFile[]).filter(f => f.file);
                            const uploadPromises = newFiles.map(f => {
                                const file = f.file!;
                                return api.uploadDocument(file, 'compliance-documents', undefined, `doc_${doc.id}`);
                            });
                            const results = await Promise.all(uploadPromises);
                            doc.documentUrls = [...(doc.documentUrls || []), ...results.map(r => r.url)];
                        } else {
                            // Single file fallback
                            const file = (pendingForDoc as UploadedFile).file;
                            if (!file) continue;
                            const { url } = await api.uploadDocument(file, 'compliance-documents', undefined, `doc_${doc.id}`);
                            doc.documentUrls = [...(doc.documentUrls || []), url];
                        }
                    }
                }
            }

            // 3. Upload Insurances
            if (updatedData.insurances) {
                for (const ins of updatedData.insurances) {
                    const pendingForIns = pendingFiles[`ins_${ins.id}`];
                    if (pendingForIns) {
                        if (Array.isArray(pendingForIns)) {
                            const newFiles = (pendingForIns as UploadedFile[]).filter(f => f.file);
                            const uploadPromises = newFiles.map(f => {
                                const file = f.file!;
                                return api.uploadDocument(file, 'compliance-documents', undefined, `ins_${ins.id}`);
                            });
                            const results = await Promise.all(uploadPromises);
                            ins.documentUrls = [...(ins.documentUrls || []), ...results.map(r => r.url)];
                        } else {
                            const file = (pendingForIns as UploadedFile).file;
                            if (!file) continue;
                            const { url } = await api.uploadDocument(file, 'compliance-documents', undefined, `ins_${ins.id}`);
                            ins.documentUrls = [...(ins.documentUrls || []), url];
                        }
                    }
                }
            }

            // 4. Upload Policies
            if (updatedData.policies) {
                for (const pol of updatedData.policies) {
                    const pendingForPol = pendingFiles[`pol_${pol.id}`];
                    if (pendingForPol) {
                        if (Array.isArray(pendingForPol)) {
                            const newFiles = (pendingForPol as UploadedFile[]).filter(f => f.file);
                            const uploadPromises = newFiles.map(f => {
                                const file = f.file!;
                                return api.uploadDocument(file, 'compliance-documents', undefined, `pol_${pol.id}`);
                            });
                            const results = await Promise.all(uploadPromises);
                            pol.documentUrls = [...(pol.documentUrls || []), ...results.map(r => r.url)];
                        } else {
                            const file = (pendingForPol as UploadedFile).file;
                            if (!file) continue;
                            const { url } = await api.uploadDocument(file, 'compliance-documents', undefined, `pol_${pol.id}`);
                            pol.documentUrls = [...(pol.documentUrls || []), url];
                        }
                    }
                }
            }

            let savedComp: any;
            if (mode === 'add') {
                savedComp = await api.createCompany({ 
                    id: `comp_${Date.now()}`, 
                    groupId,
                    ...updatedData
                });
                newGroups[groupIndex].companies.push({ ...savedComp, entities: [] });
                setToast({ message: `Company '${data.name}' added successfully.`, type: 'success' });
            } else if (data.id) {
                savedComp = await api.updateCompany(data.id, updatedData);
                const compIndex = newGroups[groupIndex].companies.findIndex(c => c.id === data.id);
                if (compIndex !== -1) {
                    newGroups[groupIndex].companies[compIndex] = {
                        ...newGroups[groupIndex].companies[compIndex],
                        ...savedComp
                    };
                }
                setToast({ message: 'Company updated successfully.', type: 'success' });
            }
            setGroups(newGroups);

            if (data.status === 'draft') {
                setCompanyFormState(prev => ({ 
                    ...prev, 
                    mode: 'edit',
                    initialData: savedComp 
                }));
            } else {
                setCompanyFormState({ ...companyFormState, isOpen: false });
            }
        } catch (error) {
            console.error(error);
            setToast({ message: 'Failed to save company details.', type: 'error' });
        }
    };

    const handleSaveName = async (name: string) => {
        const { mode, type, id, groupId } = nameModalState;
        try {
            if (mode === 'add') {
                if (type === 'group') {
                    const saved = await api.createOrganizationGroup({ id: `group_${Date.now()}`, name });
                    setGroups(prev => [...prev, { ...saved, companies: [], locations: [] }]);
                    setToast({ message: `Group '${name}' added.`, type: 'success' });
                } else if (type === 'company' && groupId) {
                    const saved = await api.createCompany({ id: `comp_${Date.now()}`, name, groupId });
                    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, companies: [...g.companies, { ...saved, entities: [] }] } : g));
                    setToast({ message: `Company '${name}' added.`, type: 'success' });
                }
            } else { // mode === 'edit'
                if (type === 'group' && id) {
                    await api.updateOrganizationGroup(id, { name });
                    setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));
                    setToast({ message: 'Group updated.', type: 'success' });
                } else if (type === 'company' && id && groupId) {
                    await api.updateCompany(id, { name });
                    setGroups(prev => prev.map(g =>
                        g.id === groupId
                            ? { ...g, companies: g.companies.map(c => c.id === id ? { ...c, name } : c) }
                            : g
                    ));
                    setToast({ message: 'Company updated.', type: 'success' });
                }
            }
        } catch (error) {
            setToast({ message: `Failed to ${mode} ${type}.`, type: 'error' });
        }
        setNameModalState({ isOpen: false, mode: 'add', type: 'group', title: '', label: '' }); // Reset and close
    };





    const renderContent = () => {
        switch (activeSubcategory) {
            case 'client_structure': {
                const isAnyExpanded = Object.values(expanded).some(Boolean);
                return (
                    <div className="space-y-6">
                        {/* Executive KPI Summary Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                            <div className="bg-card border border-border/80 rounded-xl p-3.5 shadow-xs flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                                    <Layers className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[11px] font-medium text-muted uppercase tracking-wider">Total Groups</div>
                                    <div className="text-lg font-extrabold text-primary-text">{structureStats.totalGroups}</div>
                                </div>
                            </div>

                            <div className="bg-card border border-border/80 rounded-xl p-3.5 shadow-xs flex items-center gap-3">
                                <div className="p-2.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-lg shrink-0">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[11px] font-medium text-muted uppercase tracking-wider">Companies</div>
                                    <div className="text-lg font-extrabold text-primary-text">{structureStats.totalCompanies}</div>
                                </div>
                            </div>

                            <div className="bg-card border border-border/80 rounded-xl p-3.5 shadow-xs flex items-center gap-3">
                                <div className="p-2.5 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-lg shrink-0">
                                    <Building className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[11px] font-medium text-muted uppercase tracking-wider">Total Societies</div>
                                    <div className="text-lg font-extrabold text-primary-text">{structureStats.totalEntities}</div>
                                </div>
                            </div>

                            <div className="bg-card border border-border/80 rounded-xl p-3.5 shadow-xs flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg shrink-0">
                                    <MapPin className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[11px] font-medium text-muted uppercase tracking-wider">Regional Hubs</div>
                                    <div className="text-xs font-bold text-primary-text flex items-center gap-1.5 mt-0.5">
                                        <span className="text-emerald-700 dark:text-emerald-300 font-bold">{structureStats.blrCount} BLR</span>
                                        <span className="text-muted">•</span>
                                        <span className="text-sky-700 dark:text-sky-300 font-bold">{structureStats.hydCount} HYD</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Hierarchy Header & Global Actions */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-card border border-border/70 p-4 rounded-xl shadow-xs">
                            <div>
                                <h4 className="text-lg font-bold text-primary-text">Organizational Hierarchy</h4>
                                <p className="text-xs text-muted">Groups, operating entities, and managed residential/commercial societies</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* View mode toggle */}
                                <div className="inline-flex rounded-lg border border-border bg-page/40 p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setStructureViewMode('grid')}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                                            structureViewMode === 'grid'
                                                ? 'bg-card text-primary-text shadow-xs font-bold'
                                                : 'text-muted hover:text-primary-text'
                                        }`}
                                        title="Card Grid View"
                                    >
                                        <LayoutGrid className="h-3.5 w-3.5" />
                                        Cards
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStructureViewMode('table')}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                                            structureViewMode === 'table'
                                                ? 'bg-card text-primary-text shadow-xs font-bold'
                                                : 'text-muted hover:text-primary-text'
                                        }`}
                                        title="Compact Table View"
                                    >
                                        <List className="h-3.5 w-3.5" />
                                        Table
                                    </button>
                                </div>

                                {/* Expand/Collapse All */}
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={toggleExpandAll}
                                    className="text-xs font-semibold h-8"
                                >
                                    {isAnyExpanded ? <ChevronUp className="mr-1.5 h-3.5 w-3.5" /> : <ChevronDown className="mr-1.5 h-3.5 w-3.5" />}
                                    {isAnyExpanded ? 'Collapse All' : 'Expand All'}
                                </Button>

                                {/* Add Group */}
                                <Button 
                                    onClick={() => navigate('/hr/entity-management/add-group')} 
                                    size="sm"
                                    style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }} 
                                    className="border hover:opacity-90 text-white text-xs font-semibold h-8 shadow-xs"
                                >
                                    <Plus className="mr-1.5 h-4 w-4" /> Add Group
                                </Button>
                            </div>
                        </div>

                        {/* Groups & Companies Tree */}
                        <div className="space-y-5">
                            {filteredGroups.length === 0 ? (
                                <div className="text-center py-12 bg-page/30 rounded-xl border border-dashed border-border">
                                    <p className="text-muted">No groups found matching your search.</p>
                                </div>
                            ) : (
                                filteredGroups.map(group => (
                                    <div key={group.id} className="bg-card border border-border shadow-sm rounded-xl overflow-hidden border-t-4 border-t-[#006B3F]">
                                        <div className="p-4 flex items-center justify-between bg-page/20 border-b border-border/60">
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => toggleExpand(group.id)} className="p-1 hover:bg-page rounded-md transition-colors">
                                                    <ChevronRight className={`h-5 w-5 text-accent transition-transform duration-200 ${expanded[group.id] ? 'rotate-90' : ''}`} />
                                                </button>
                                                <Building className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                                                <span className="font-bold text-lg text-primary-text">{group.name}</span>
                                                <span className="text-xs font-medium text-muted bg-page px-2 py-0.5 rounded-full border border-border/60">
                                                    {group.companies.length} {group.companies.length === 1 ? 'Company' : 'Companies'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" variant="outline" className="h-8 px-2.5 border-accent/20 text-accent hover:bg-accent/5 font-semibold text-xs" onClick={() => setCompanyFormState({ isOpen: true, mode: 'add', groupId: group.id, groupName: group.name, initialData: null })}>
                                                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Company
                                                </Button>
                                                <Button variant="icon" className="h-8 w-8 hover:bg-blue-500/10 text-blue-600" onClick={() => setNameModalState({ isOpen: true, mode: 'edit', type: 'group', id: group.id, initialName: group.name, title: 'Edit Group Name', label: 'Group Name' })}>
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="icon" className="h-8 w-8 hover:bg-red-500/10 text-red-500" onClick={() => handleDeleteClick('group', group.id, group.name)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        {expanded[group.id] && (
                                            <div className="p-4 space-y-4 bg-page/10">
                                                {group.companies.map(company => {
                                                    const compSearch = (companySearchTerms[company.id] || '').toLowerCase().trim();
                                                    const visibleEntities = compSearch 
                                                        ? company.entities.filter(e => e.name.toLowerCase().includes(compSearch) || (e.siteManagement?.keyAccountManager || '').toLowerCase().includes(compSearch))
                                                        : company.entities;

                                                    return (
                                                        <div key={company.id} className="border border-border/80 rounded-xl overflow-hidden shadow-2xs bg-card transition-all">
                                                            {/* Company Header Bar */}
                                                            <div className="p-3.5 flex flex-wrap items-center justify-between gap-3 bg-page/30 hover:bg-page/50 transition-colors border-b border-border/60">
                                                                <div className="flex items-center gap-3 flex-wrap">
                                                                    <button 
                                                                        onClick={() => toggleExpand(company.id)} 
                                                                        className="p-1 hover:bg-card rounded-md transition-colors text-muted hover:text-primary-text"
                                                                    >
                                                                        <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expanded[company.id] ? 'rotate-90 text-emerald-600' : ''}`} />
                                                                    </button>
                                                                    
                                                                    <span className="font-bold text-sm sm:text-base text-primary-text tracking-tight">
                                                                        {company.name}
                                                                    </span>
                                                                    {company.location && renderLocationBadge(company.location, 'md')}
                                                                    
                                                                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                                                                        {company.entities.length} {company.entities.length === 1 ? 'society' : 'societies'}
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    {/* In-company search filter */}
                                                                    {expanded[company.id] && company.entities.length > 5 && (
                                                                        <div className="relative">
                                                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Filter societies..."
                                                                                value={companySearchTerms[company.id] || ''}
                                                                                onChange={e => setCompanySearchTerms({ ...companySearchTerms, [company.id]: e.target.value })}
                                                                                className="text-xs pl-8 pr-3 py-1 bg-page/80 border border-border/80 rounded-lg focus:outline-none focus:border-emerald-500 w-36 sm:w-44 transition-all"
                                                                            />
                                                                        </div>
                                                                    )}

                                                                    <Button variant="icon" size="sm" className="h-8 w-8 hover:bg-emerald-500/10 text-emerald-600" title="View Summary" onClick={() => setViewingClients({ companyName: company.name, clients: company.entities })}>
                                                                        <Eye className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button variant="icon" size="sm" className="h-8 w-8 hover:bg-emerald-500/10 text-emerald-600" title="Add Society" onClick={() => handleAddClient(company.name, company.id)}>
                                                                        <Plus className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button variant="icon" size="sm" className="h-8 w-8 hover:bg-blue-500/10 text-blue-500" title="Edit Company" onClick={() => setCompanyFormState({ isOpen: true, mode: 'edit', groupId: group.id, groupName: group.name, initialData: company })}>
                                                                        <Edit className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button variant="icon" size="sm" className="h-8 w-8 hover:bg-red-500/10 text-red-500" title="Delete Company" onClick={() => handleDeleteClick('company', company.id, company.name)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            {/* Societies Body */}
                                                            {expanded[company.id] && (
                                                                <div className="p-3.5 bg-page/5">
                                                                    {visibleEntities.length === 0 ? (
                                                                        <div className="text-center py-6 text-xs text-muted">
                                                                            {compSearch ? `No societies matching "${compSearch}" in ${company.name}` : 'No societies added yet.'}
                                                                        </div>
                                                                    ) : structureViewMode === 'grid' ? (
                                                                        /* Modern Responsive Card Grid */
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                            {visibleEntities.map(client => {
                                                                                const kam = client.siteManagement?.keyAccountManager;
                                                                                const units = client.siteManagement?.unitCount;
                                                                                const cycle = (client.billingControls as any)?.billingCycle || (client.billingControls as any)?.billingCycleStart;

                                                                                return (
                                                                                    <div 
                                                                                        key={client.id} 
                                                                                        className="group relative bg-card hover:bg-card/90 border border-border/80 hover:border-emerald-500/40 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between"
                                                                                    >
                                                                                        <div>
                                                                                            {/* Top row */}
                                                                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                                                                <div className="flex items-center gap-2 min-w-0">
                                                                                                    <div className="p-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-lg shrink-0">
                                                                                                        <Building className="h-4 w-4" />
                                                                                                    </div>
                                                                                                    <span className="font-bold text-xs sm:text-sm text-primary-text truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors" title={client.name}>
                                                                                                        {client.name}
                                                                                                    </span>
                                                                                                </div>
                                                                                                <div className="shrink-0">
                                                                                                    {renderLocationBadge(client.location || company.location, 'xs')}
                                                                                                </div>
                                                                                            </div>

                                                                                            {/* Metadata chips */}
                                                                                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted mb-2">
                                                                                                {units ? (
                                                                                                    <span className="bg-page px-1.5 py-0.5 rounded border border-border/60 font-medium text-primary-text">
                                                                                                        🏢 {units} Units
                                                                                                    </span>
                                                                                                ) : null}
                                                                                                {kam ? (() => {
                                                                    const ops = getOpsManagerInfo(kam);
                                                                    return (
                                                                        <div 
                                                                            className="inline-flex items-center gap-1.5 bg-page px-2 py-0.5 rounded-full border border-border/80 text-[10px] font-semibold text-primary-text shadow-2xs hover:border-emerald-500/50 transition-all max-w-[170px]" 
                                                                            title={`Operations Manager / KAM: ${ops?.displayName || kam}`}
                                                                        >
                                                                            {ops?.photoUrl ? (
                                                                                <img 
                                                                                    src={ops.photoUrl} 
                                                                                    alt={ops.displayName} 
                                                                                    className="h-4 w-4 rounded-full object-cover ring-1 ring-emerald-500/40 shrink-0" 
                                                                                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                                                                />
                                                                            ) : (
                                                                                <div className="h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[9px] flex items-center justify-center shrink-0">
                                                                                    {(ops?.displayName || kam).charAt(0).toUpperCase()}
                                                                                </div>
                                                                            )}
                                                                            <span className="truncate">{ops?.displayName || kam}</span>
                                                                        </div>
                                                                    );
                                                                })() : null}
                                                                {cycle ? (
                                                                    <span className="bg-page px-1.5 py-0.5 rounded border border-border/60 font-medium text-slate-600 dark:text-slate-400">
                                                                        📄 {cycle.replace(' Billing Cycle', '')}
                                                                    </span>
                                                                ) : null}
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Bottom Row */}
                                                                                        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted">
                                                                                            <span className="text-[10px] font-mono text-muted/80 truncate max-w-[130px]">
                                                                                                {client.gstNumber ? `GST: ${client.gstNumber.slice(0, 10)}...` : 'ID: ' + client.id.slice(0, 12)}
                                                                                            </span>
                                                                                            <div className="flex items-center gap-1">
                                                                                                <button 
                                                                                                    onClick={() => handleEditClient(client, company.name, company.id)}
                                                                                                    className="p-1 text-muted hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors"
                                                                                                    title="Edit Society"
                                                                                                >
                                                                                                    <Edit className="h-3.5 w-3.5" />
                                                                                                </button>
                                                                                                <button 
                                                                                                    onClick={() => handleDeleteClick('client', client.id, client.name)}
                                                                                                    className="p-1 text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                                                                                                    title="Delete Society"
                                                                                                >
                                                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        /* Compact Table View */
                                                                        <div className="overflow-x-auto border border-border/70 rounded-xl bg-card">
                                                                            <table className="w-full text-left text-xs">
                                                                                <thead className="bg-page/40 text-muted uppercase tracking-wider text-[10px] border-b border-border/60">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2.5">Society Name</th>
                                                                                        <th className="px-3 py-2.5">Location</th>
                                                                                        <th className="px-3 py-2.5">Key Account Manager</th>
                                                                                        <th className="px-3 py-2.5">Units / Flats</th>
                                                                                        <th className="px-3 py-2.5">Billing Cycle</th>
                                                                                        <th className="px-3 py-2.5 text-right">Actions</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-border/40">
                                                                                    {visibleEntities.map(client => (
                                                                                        <tr key={client.id} className="hover:bg-page/50 transition-colors">
                                                                                            <td className="px-3 py-2.5 font-bold text-primary-text flex items-center gap-2">
                                                                                                <Building className="h-3.5 w-3.5 text-emerald-600/70 shrink-0" />
                                                                                                {client.name}
                                                                                            </td>
                                                                                            <td className="px-3 py-2.5">
                                                                                                {renderLocationBadge(client.location || company.location, 'xs')}
                                                                                            </td>
                                                                                            <td className="px-3 py-2.5 text-muted">
                                                                {client.siteManagement?.keyAccountManager ? (() => {
                                                                    const ops = getOpsManagerInfo(client.siteManagement.keyAccountManager);
                                                                    return (
                                                                        <div className="inline-flex items-center gap-2">
                                                                            {ops?.photoUrl ? (
                                                                                <img 
                                                                                    src={ops.photoUrl} 
                                                                                    alt={ops.displayName} 
                                                                                    className="h-5 w-5 rounded-full object-cover ring-1 ring-emerald-500/40 shrink-0" 
                                                                                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                                                                />
                                                                            ) : (
                                                                                <div className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                                                                                    {(ops?.displayName || client.siteManagement.keyAccountManager).charAt(0).toUpperCase()}
                                                                                </div>
                                                                            )}
                                                                            <span className="font-semibold text-primary-text">{ops?.displayName || client.siteManagement.keyAccountManager}</span>
                                                                        </div>
                                                                    );
                                                                })() : '—'}
                                                            </td>
                                                                                            <td className="px-3 py-2.5 text-muted">
                                                                                                {client.siteManagement?.unitCount ? `${client.siteManagement.unitCount} Units` : '—'}
                                                                                            </td>
                                                                                            <td className="px-3 py-2.5 text-muted">
                                                                                                {(client.billingControls as any)?.billingCycle || (client.billingControls as any)?.billingCycleStart || '-'}
                                                                                            </td>
                                                                                            <td className="px-3 py-2.5 text-right">
                                                                                                <div className="flex items-center justify-end gap-1">
                                                                                                    <Button variant="icon" size="sm" className="h-7 w-7 hover:bg-blue-500/10 text-blue-500" onClick={() => handleEditClient(client, company.name, company.id)} title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
                                                                                                    <Button variant="icon" size="sm" className="h-7 w-7 hover:bg-red-500/10 text-red-500" onClick={() => handleDeleteClick('client', client.id, client.name)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                                                                </div>
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            }
            case 'site_configuration': {
                const siteConfigEntities = allClients.filter(client => {
                    const matchesSearch = searchTerm.trim() ? client.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
                    const matchesLocation = selectedLocation ? client.location === selectedLocation : true;
                    return matchesSearch && matchesLocation;
                });
                return (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-border pb-4">
                            <div>
                                <h4 className="text-xl font-bold text-primary-text mb-1">Sites Configuration</h4>
                                <p className="text-sm text-muted">
                                    {siteConfigEntities.length === 0 
                                        ? 'No sites found' 
                                        : `Showing ${siteConfigEntities.length} site${siteConfigEntities.length > 1 ? 's' : ''} across all regions`}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button onClick={() => setEntityFormState({ isOpen: true, initialData: null, companyName: '', companyId: '' })} style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }} className="border hover:opacity-90 text-white shadow-md hover:shadow-lg transition-all duration-300">
                                    <Plus className="mr-2 h-5 w-5" /> Add New Site
                                </Button>
                            </div>
                        </div>

                        {siteConfigEntities.length === 0 ? (
                            <div className="text-center py-20 bg-page/50 rounded-2xl border-2 border-dashed border-border/60">
                                <Building className="h-16 w-16 mx-auto mb-4 text-muted/30" />
                                <h5 className="text-lg font-semibold text-primary-text">No sites to configure</h5>
                                <p className="text-muted text-sm mt-1 max-w-xs mx-auto">Try adjusting your search filters or add a new site to get started.</p>
                            </div>
                        ) : (
                            <div className="bg-card border border-border shadow-md rounded-2xl overflow-hidden transition-all duration-300">
                                <table className="min-w-full divide-y divide-border responsive-table">
                                    <thead className="bg-page/80">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-widest w-1/2">Site / Location</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-widest w-1/4">Status</th>
                                            <th className="px-6 py-4 text-right text-xs font-bold text-muted uppercase tracking-widest">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {siteConfigEntities.map(entity => {
                                            const isConfigured = !!entity.billingName || !!entity.siteManagement?.keyAccountManager;
                                            return (
                                                <tr key={entity.id} className="hover:bg-page/50 transition-colors group">
                                                    <td className="px-6 py-5 font-semibold text-primary-text">
                                                        <div className="flex items-center gap-4">
                                                            <div className="p-2.5 bg-accent/5 rounded-xl text-accent group-hover:bg-accent group-hover:text-white transition-colors duration-300">
                                                                <Building className="h-5 w-5" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-primary-text">{entity.name}</span>
                                                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                                                    {renderLocationBadge(entity.location || 'Bangalore', 'xs')}
                                                                    {entity.billingName && (
                                                                        <span className="text-[11px] text-muted truncate max-w-xs font-normal" title={entity.billingName}>
                                                                            • {entity.billingName}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {/* Mode badge */}
                                                                {getSiteMode(entity) === 'auto' ? (
                                                                    <span
                                                                        className="mt-1.5 self-start inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                                                                        style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}
                                                                    >
                                                                        <Zap className="h-2.5 w-2.5" /> Auto Config
                                                                    </span>
                                                                ) : (
                                                                    <span className="mt-1.5 self-start inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#006B3F]/10 text-[#006B3F] border border-[#006B3F]/20">
                                                                        <SlidersHorizontal className="h-2.5 w-2.5" /> Manual Config
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                     <td className="px-6 py-5">
                                                        {entity.status === 'draft' ? (
                                                            <span className="inline-flex items-center text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full text-xs font-bold border border-orange-200 shadow-sm"><Clock className="h-3.5 w-3.5 mr-1.5" /> Draft</span>
                                                        ) : isConfigured ? (
                                                            <span className="inline-flex items-center text-green-700 px-3 py-1.5 bg-green-50 rounded-full text-xs font-bold border border-green-200 shadow-sm"><CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Fully Configured</span>
                                                        ) : (
                                                            <span className="inline-flex items-center text-amber-600 px-3 py-1.5 bg-amber-50 rounded-full text-xs font-bold border border-amber-200 shadow-sm"><AlertCircle className="h-3.5 w-3.5 mr-1.5" /> Pending Data</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">

                                                            {/* ── Manual / Auto toggle pill ────────────────────────────── */}
                                                            <div className="flex items-center rounded-xl border border-border bg-page shadow-sm overflow-hidden">
                                                                {/* Manual segment */}
                                                                <button
                                                                    onClick={() => {
                                                                        setSiteMode(entity.id, 'manual');
                                                                        setEntityFormState({ isOpen: true, initialData: entity, companyName: entity.companyName || '', companyId: entity.companyId });
                                                                    }}
                                                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
                                                                        getSiteMode(entity) === 'manual'
                                                                            ? 'bg-[#006B3F] text-white shadow-inner'
                                                                            : 'text-muted hover:text-primary-text hover:bg-page/80'
                                                                    }`}
                                                                    title="Manual configuration — uses fed data from Costing, GMC, Holiday etc."
                                                                >
                                                                    <SlidersHorizontal className="h-3 w-3" />
                                                                    Manual
                                                                </button>

                                                                {/* Divider */}
                                                                <span className="w-px h-5 bg-border" />

                                                                {/* Auto segment */}
                                                                <button
                                                                    onClick={() => {
                                                                        setSiteMode(entity.id, 'auto');
                                                                        setAutoSiteConfigState({
                                                                            isOpen: true,
                                                                            siteId: entity.id,
                                                                            siteName: entity.name,
                                                                            siteLocation: entity.location,
                                                                        });
                                                                    }}
                                                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
                                                                        getSiteMode(entity) === 'auto'
                                                                            ? 'text-white shadow-inner'
                                                                            : 'text-muted hover:text-primary-text hover:bg-page/80'
                                                                    }`}
                                                                    style={getSiteMode(entity) === 'auto' ? { background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' } : {}}
                                                                    title="Auto configuration — role-based EL, CL, week-off & salary calculation"
                                                                >
                                                                    <Zap className="h-3 w-3" />
                                                                    Auto
                                                                </button>
                                                            </div>

                                                            {/* Delete */}
                                                            <Button size="sm" variant="outline" onClick={() => handleDeleteClick('site', entity.id, entity.name)} className="h-9 w-9 p-0 text-red-500 border-red-200 hover:bg-red-50 hover:border-red-400">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            }
            case 'costing_resource': return <CostingResourceConfig sites={allClients} />;
            case 'backoffice_heads': return <BackofficeHeadsConfig />;
            case 'staff_designation': return <StaffDesignationConfig />;
            case 'gmc_policy': return <GmcPolicyConfig />;
            case 'asset': return <AssetConfig />;
            case 'tools_list': return <ToolsListConfig />;
            case 'attendance_format': return <AttendanceFormatConfig />;
            case 'attendance_overview':
                return <AttendanceOverviewConfig />;
            case 'company_holiday_selection':
                return (
                    <CompanyHolidaySelectionConfig 
                        searchTerm={searchTerm}
                        selectedLocation={selectedLocation}
                    />
                );
            case 'daily_attendance':
                return <DailyAttendanceConfig />;
            case 'notification_template': return <NotificationTemplateConfig />;
            case 'onboard_reject_reason': return <OnboardRejectReasonConfig />;
            case 'salary_template': return <SalaryTemplateConfig />;
            case 'salary_line_item': return <SalaryLineItemConfig />;
            case 'attendance_bulk': return <TemplatesHub restrictToTemplateId="attendance_bulk" initialTemplateId="attendance_bulk" />;
            case 'attendance_monthly_bulk': return <TemplatesHub restrictToTemplateId="attendance_monthly_bulk" initialTemplateId="attendance_monthly_bulk" />;
            case 'templates_hub': return <TemplatesHub />;
            default: {
                const activeItem = subcategories.find(sc => sc.key === activeSubcategory);
                return <PlaceholderView title={activeItem?.label || 'Configuration'} />;
            }
        }
    };


    if (companyFormState.isOpen) {
        return (
            <div className="p-0">
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
                <CompanyForm 
                    {...companyFormState} 
                    onClose={() => setCompanyFormState(p => ({ ...p, isOpen: false }))} 
                    onSave={handleSaveCompanyData} 
                    existingLocations={existingLocations} 
                />
            </div>
        );
    }

    if (autoSiteConfigState.isOpen) {
        return (
            <div className="p-0">
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
                <AutoSiteConfig
                    siteId={autoSiteConfigState.siteId}
                    siteName={autoSiteConfigState.siteName}
                    siteLocation={autoSiteConfigState.siteLocation}
                    onClose={() => setAutoSiteConfigState(p => ({ ...p, isOpen: false }))}
                    onSaved={() => setToast({ message: `Auto config saved for ${autoSiteConfigState.siteName}.`, type: 'success' })}
                />
            </div>
        );
    }

    if (entityFormState.isOpen) {
        return (
            <div className="p-0">
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
                <EntityForm 
                    {...entityFormState} 
                    onClose={() => setEntityFormState(p => ({ ...p, isOpen: false }))} 
                    onSave={handleSaveClient} 
                    companies={allCompanies}
                />
            </div>
        );
    }


    return (
        <div className={`p-4 space-y-6 ${isMobile ? 'bg-[#041b0f] min-h-screen text-white' : ''}`}>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <TemplateInstructionsModal isOpen={isInstructionsOpen} onClose={() => setIsInstructionsOpen(false)} />
            <NameInputModal
                isOpen={nameModalState.isOpen}
                onClose={() => setNameModalState({ isOpen: false, mode: 'add', type: 'group', title: '', label: '' })}
                onSave={handleSaveName}
                title={nameModalState.title}
                label={nameModalState.label}
                initialName={nameModalState.initialName}
            />
            <Modal isOpen={deleteModalState.isOpen} onClose={() => setDeleteModalState(p => ({ ...p, isOpen: false }))} onConfirm={handleConfirmDelete} title="Confirm Deletion">
                Are you sure you want to delete the {deleteModalState.type} "{deleteModalState.name}"? This action cannot be undone.
            </Modal>
            {viewingClients && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setViewingClients(null)}>
                    <div className="bg-card rounded-xl shadow-card p-6 w-full max-w-md m-4 animate-fade-in-scale" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-primary-text mb-4">Societies in {viewingClients.companyName}</h3>
                        {viewingClients.clients.length > 0 ? (
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {viewingClients.clients.map(client => (
                                    <li key={client.id} className="text-sm p-2 bg-page rounded-md">{client.name}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted text-center py-4">No societies found for this company.</p>
                        )}
                        <div className="mt-6 text-right">
                            <Button onClick={() => setViewingClients(null)} variant="secondary">Close</Button>
                        </div>
                    </div>
                </div>
            )}


            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <h2 className={`text-2xl font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>Client Management</h2>
                {!isMobile && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" onClick={() => setIsInstructionsOpen(true)} className="hover:bg-gray-100"><HelpCircle className="mr-2 h-4 w-4" /> Help</Button>
                        <Button onClick={handleSaveAll} style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }} className="border hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-300"><Save className="mr-2 h-4 w-4" /> Save All Changes</Button>
                    </div>
                )}
            </div>

            {isMobile && (
                <div className="flex flex-col gap-4 mb-8 items-center">
                    <button onClick={handleSaveAll} className="flex items-center gap-2 text-sm font-bold text-white tracking-wide">
                        <Save className="h-4 w-4" /> Save All Changes
                    </button>
                    <button onClick={() => setIsInstructionsOpen(true)} className="flex items-center gap-2 text-xs font-semibold text-[#22c55e]">
                        <HelpCircle className="h-3.5 w-3.5" /> Help
                    </button>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-grow">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 ${isMobile ? 'text-gray-500' : 'text-muted'}`} />
                    <input
                        id="client-search"
                        name="clientSearch"
                        type="text"
                        placeholder="Search across all clients and sites..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className={isMobile ? "w-full bg-[#041b0f] border border-[#1d422f] rounded-[16px] py-2.5 pl-10 pr-4 text-[13px] text-white focus:outline-none focus:border-[#22c55e] transition-colors" : "form-input !pl-10 w-full"}
                    />
                </div>
                <div className="w-full sm:w-64">
                    <select
                        id="location-filter"
                        value={selectedLocation}
                        onChange={e => setSelectedLocation(e.target.value)}
                        className={isMobile ? "w-full bg-[#041b0f] border border-[#1d422f] rounded-[16px] py-2.5 px-4 text-[13px] text-white focus:outline-none focus:border-[#22c55e] appearance-none" : "w-full form-select"}
                    >
                        <option value="">All Locations</option>
                        {existingLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="space-y-4">
                {/* Tab navigation removed - handled by sidebar */}
                <main className="animate-fade-in-scale">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-20 bg-card border border-border shadow-md rounded-2xl">
                            <Loader2 className="h-10 w-10 animate-spin text-accent" />
                        </div>
                    ) : (
                        <div className="p-2 md:p-4">
                            {renderContent()}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default EntityManagement;