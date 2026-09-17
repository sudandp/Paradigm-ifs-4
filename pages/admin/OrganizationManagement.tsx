

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { Organization, Entity, ManpowerDetail, SiteStaffDesignation, UploadedFile } from '../../types';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import EntityForm from '../../components/hr/EntityForm';
import ManpowerDetailsModal from '../../components/admin/ManpowerDetailsModal';
import TableSkeleton from '../../components/skeletons/TableSkeleton';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useSettingsStore } from '../../store/settingsStore';
import { differenceInDays } from 'date-fns';
import Input from '../../components/ui/Input';
import Pagination from '../../components/ui/Pagination';
import { 
    Plus, Edit, Trash2, Eye, Loader2, Upload, Download, CheckCircle, 
    AlertCircle, Building, Users, Settings, Building2, ShieldCheck, 
    MapPin, UserCheck, FileText, Search, X, CheckSquare, Square 
} from 'lucide-react';
import LoadingScreen from '../../components/ui/LoadingScreen';
import MobileTopBar from '../../components/navigation/MobileTopBar';
import { useAuthStore } from '../../store/authStore';
import type { SiteResponsibilityMatrix } from '../../types/siteRouting';
import { getUserRoutingScope } from '../../services/siteRoutingScope';


const siteCsvColumns = ['id', 'shortName', 'fullName', 'address', 'manpowerApprovedCount', 'reportingManagerName', 'managerName', 'fieldStaffNames', 'backendFieldStaffName'];

const toCSV = (data: Record<string, any>[], columns: string[]): string => {
    const header = columns.join(',');
    const rows = data.map(row =>
        columns.map(col => {
            let val = row[col];
            // Handle array fields (like fieldStaffNames)
            if (Array.isArray(val)) {
                val = val.join(';');
            }
            val = val === null || val === undefined ? '' : String(val);
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }).join(',')
    );
    return [header, ...rows].join('\n');
};

const fromCSV = (csvText: string): Record<string, string>[] => {
    const lines = csvText.trim().replace(/\r/g, '').split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const row: Record<string, string> = {};
        // Regex for CSV parsing, handles quoted fields containing commas.
        const values = lines[i].match(/(?<=,|^)(?:"(?:[^"]|"")*"|[^,]*)/g) || [];

        headers.forEach((header, index) => {
            let value = (values[index] || '').trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1).replace(/""/g, '"');
            }
            row[header] = value;
        });
        rows.push(row);
    }
    return rows;
};




export const SiteManagement: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [matrixList, setMatrixList] = useState<SiteResponsibilityMatrix[]>([]);
    const [allClients, setAllClients] = useState<(Entity & { companyName: string })[]>([]);
    const [siteStaffDesignations, setSiteStaffDesignations] = useState<SiteStaffDesignation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalSites, setTotalSites] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    // 8 Dropdown Filter States based on Image 1 table data
    const [filterSite, setFilterSite] = useState('ALL');
    const [filterLocation, setFilterLocation] = useState('ALL');
    const [filterOps, setFilterOps] = useState('ALL');
    const [filterSiteManager, setFilterSiteManager] = useState('ALL');
    const [filterFieldStaff, setFilterFieldStaff] = useState('ALL');
    const [filterManpower, setFilterManpower] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [sortBy, setSortBy] = useState('NAME_ASC');

    const [entityFormState, setEntityFormState] = useState<{ isOpen: boolean; initialData: Entity | null; companyName: string }>({ isOpen: false, initialData: null, companyName: '' });
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [manpowerDetails, setManpowerDetails] = useState<ManpowerDetail[]>([]);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const importRef = useRef<HTMLInputElement>(null);
    const isMobile = useMediaQuery('(max-width: 767px)');
    const { siteManagement } = useSettingsStore();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [orgsResult, structureResult, designationsResult, matrixResult] = await Promise.all([
                api.getOrganizations().catch(e => { console.error("Failed to fetch organizations:", e); return []; }),
                api.getOrganizationStructure().catch(e => { console.error("Failed to fetch organization structure:", e); return []; }),
                api.getSiteStaffDesignations().catch(e => {
                    console.error("Failed to fetch site staff designations:", e);
                    setToast({ message: 'Could not load designation list. Manpower editing may be affected.', type: 'error' });
                    return [];
                }),
                api.getSiteResponsibilityMatrix().catch(() => [] as SiteResponsibilityMatrix[])
            ]);
            setOrganizations(orgsResult);
            setMatrixList(matrixResult || []);
            setSiteStaffDesignations(designationsResult);
            const clients = structureResult.flatMap(group =>
                group.companies.flatMap(company =>
                    company.entities.map(entity => ({ ...entity, companyName: company.name }))
                )
            );
            setAllClients(clients);
        } catch (error) {
            setToast({ message: 'An unexpected error occurred while fetching data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    const routingScope = useMemo(() => getUserRoutingScope(user, matrixList), [user, matrixList]);

    const scopedOrganizations = useMemo(() => {
        return organizations.filter(org => {
            const sName = org.shortName || org.fullName || '';
            return routingScope.isSitePermitted(sName, (org as any).companyName);
        });
    }, [organizations, routingScope]);

    // Build quick lookup map from site name/id to responsibility matrix record
    const siteMatrixMap = useMemo(() => {
        const map = new Map<string, SiteResponsibilityMatrix>();
        matrixList.forEach(m => {
            if (m.siteName) {
                map.set(m.siteName.toLowerCase().trim(), m);
            }
            if (m.siteId) {
                map.set(m.siteId.toLowerCase().trim(), m);
            }
        });
        return map;
    }, [matrixList]);

    // Helper to resolve linked matrix data for any organization
    const getOrgMeta = useCallback((org: Organization) => {
        const sName = (org.shortName || '').toLowerCase().trim();
        const fName = (org.fullName || '').toLowerCase().trim();
        const idName = (org.id || '').toLowerCase().trim();
        const m = siteMatrixMap.get(sName) || siteMatrixMap.get(fName) || siteMatrixMap.get(idName);

        const opsLead = (m?.opsManagerName || org.reportingManagerName || '').trim();
        const siteMgr = (m?.siteManagerName || m?.siteSupervisorName || org.managerName || '').trim();
        const fieldOff = (m?.fieldOfficerName || (org.fieldStaffNames && org.fieldStaffNames.join(', ')) || org.backendFieldStaffName || '').trim();
        const hrLead = (m?.hrInchargeName || '').trim();
        const accountsLead = (m?.accountsInchargeName || '').trim();
        const company = (m?.billingCompany || '').trim();
        const cycle = (m?.billingCycle || '').trim();

        return { m, opsLead, siteMgr, fieldOff, hrLead, accountsLead, company, cycle };
    }, [siteMatrixMap]);

    // ── Dropdown Filter Options based on Image 1 Table Data ───────────────────
    const siteFilterOptions = useMemo(() => {
        const set = new Set<string>();
        scopedOrganizations.forEach(org => {
            if (org.shortName) set.add(org.shortName.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [scopedOrganizations]);

    const locationFilterOptions = useMemo(() => {
        const set = new Set<string>();
        const KNOWN_AREAS = [
            'Bangalore', 'Bengaluru', 'Sarjapur', 'Whitefield', 'Indiranagar', 'Yeshwanthpur', 
            'Thanisandra', 'Attibele', 'Anekal', 'Electronic City', 'Bellandur', 
            'Marathahalli', 'Kanakapura', 'Bannerghatta', 'Hebbal', 'Yelahanka', 
            'Chikkagubbi', 'Koramangala', 'HSR Layout', 'Gattahalli'
        ];
        scopedOrganizations.forEach(org => {
            const addr = (org.address || '').toLowerCase();
            KNOWN_AREAS.forEach(area => {
                if (addr.includes(area.toLowerCase())) {
                    set.add(area === 'bengaluru' ? 'Bangalore' : area);
                }
            });
            if (org.address && org.address.trim().length <= 25 && !org.address.includes(',')) {
                set.add(org.address.trim());
            }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [scopedOrganizations]);

    const opsFilterOptions = useMemo(() => {
        const set = new Set<string>();
        scopedOrganizations.forEach(org => {
            const { opsLead } = getOrgMeta(org);
            const rm = org.reportingManagerName || opsLead;
            if (rm && rm.trim()) set.add(rm.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [scopedOrganizations, getOrgMeta]);

    const siteMgrFilterOptions = useMemo(() => {
        const set = new Set<string>();
        scopedOrganizations.forEach(org => {
            const { siteMgr } = getOrgMeta(org);
            const sm = org.managerName || siteMgr;
            if (sm && sm.trim()) set.add(sm.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [scopedOrganizations, getOrgMeta]);

    const fieldStaffFilterOptions = useMemo(() => {
        const set = new Set<string>();
        scopedOrganizations.forEach(org => {
            const { fieldOff } = getOrgMeta(org);
            if (org.fieldStaffNames && Array.isArray(org.fieldStaffNames)) {
                org.fieldStaffNames.forEach(f => f && f.trim() && set.add(f.trim()));
            }
            if (fieldOff && fieldOff.trim()) {
                set.add(fieldOff.trim());
            }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [scopedOrganizations, getOrgMeta]);

    // 6 KPI Metrics dynamically calculated from Image 1 Data
    const stats = useMemo(() => {
        let totalManpower = 0;
        let sitesWithManpower = 0;
        const rms = new Set<string>();
        const sms = new Set<string>();

        scopedOrganizations.forEach(org => {
            const mp = org.manpowerApprovedCount || 0;
            totalManpower += mp;
            if (mp > 0) sitesWithManpower++;

            const { opsLead, siteMgr } = getOrgMeta(org);
            const rm = org.reportingManagerName || opsLead;
            const sm = org.managerName || siteMgr;
            if (rm && rm.trim()) rms.add(rm.trim());
            if (sm && sm.trim()) sms.add(sm.trim());
        });

        return {
            totalSites: scopedOrganizations.length,
            totalManpower,
            sitesWithManpower,
            opsCount: rms.size,
            smCount: sms.size,
            locationsCount: locationFilterOptions.length
        };
    }, [scopedOrganizations, getOrgMeta, locationFilterOptions]);

    // Filtered organizations reacting to search & all filters
    const filteredOrganizations = useMemo(() => {
        const result = scopedOrganizations.filter(org => {
            const { opsLead, siteMgr, fieldOff } = getOrgMeta(org);
            const displayRM = (org.reportingManagerName || opsLead || '').trim();
            const displaySM = (org.managerName || siteMgr || '').trim();
            const displayFS = (org.fieldStaffNames && org.fieldStaffNames.length > 0)
                ? org.fieldStaffNames.join(', ')
                : (fieldOff || '').trim();
            const manpower = org.manpowerApprovedCount || 0;

            const isProvisional = !!org.provisionalCreationDate;
            const daysLeft = isProvisional && org.provisionalCreationDate
                ? 90 - differenceInDays(new Date(), new Date(org.provisionalCreationDate))
                : 0;
            const isExpired = isProvisional && daysLeft <= 0;

            // Search Term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim();
                const matchSearch =
                    (org.shortName || '').toLowerCase().includes(term) ||
                    (org.fullName || '').toLowerCase().includes(term) ||
                    (org.address || '').toLowerCase().includes(term) ||
                    displayRM.toLowerCase().includes(term) ||
                    displaySM.toLowerCase().includes(term) ||
                    displayFS.toLowerCase().includes(term) ||
                    String(manpower).includes(term);
                if (!matchSearch) return false;
            }

            // Dropdown: Site
            if (filterSite !== 'ALL' && (org.shortName || '').toLowerCase() !== filterSite.toLowerCase()) {
                return false;
            }

            // Dropdown: Location
            if (filterLocation !== 'ALL') {
                const addr = (org.address || '').toLowerCase();
                if (!addr.includes(filterLocation.toLowerCase())) {
                    return false;
                }
            }

            // Dropdown: Ops Lead (RM)
            if (filterOps !== 'ALL') {
                if (!displayRM.toLowerCase().includes(filterOps.toLowerCase())) {
                    return false;
                }
            }

            // Dropdown: Site Manager (SM)
            if (filterSiteManager !== 'ALL') {
                if (!displaySM.toLowerCase().includes(filterSiteManager.toLowerCase())) {
                    return false;
                }
            }

            // Dropdown: Field Staff (FS)
            if (filterFieldStaff !== 'ALL') {
                if (!displayFS.toLowerCase().includes(filterFieldStaff.toLowerCase())) {
                    return false;
                }
            }

            // Dropdown: Manpower
            if (filterManpower === 'MANNED' && manpower <= 0) return false;
            if (filterManpower === 'ZERO' && manpower > 0) return false;
            if (filterManpower === 'LARGE' && manpower < 50) return false;
            if (filterManpower === 'MEDIUM' && (manpower < 10 || manpower >= 50)) return false;
            if (filterManpower === 'SMALL' && (manpower < 1 || manpower >= 10)) return false;

            // Dropdown: Status
            if (filterStatus === 'ACTIVE' && isExpired) return false;
            if (filterStatus === 'EXPIRED' && !isExpired) return false;

            return true;
        });

        // Sorting
        result.sort((a, b) => {
            if (sortBy === 'NAME_ASC') return (a.shortName || '').localeCompare(b.shortName || '');
            if (sortBy === 'NAME_DESC') return (b.shortName || '').localeCompare(a.shortName || '');
            if (sortBy === 'MANPOWER_DESC') return (b.manpowerApprovedCount || 0) - (a.manpowerApprovedCount || 0);
            if (sortBy === 'MANPOWER_ASC') return (a.manpowerApprovedCount || 0) - (b.manpowerApprovedCount || 0);
            if (sortBy === 'LOCATION_ASC') return (a.address || '').localeCompare(b.address || '');
            return 0;
        });

        return result;
    }, [scopedOrganizations, searchTerm, filterSite, filterLocation, filterOps, filterSiteManager, filterFieldStaff, filterManpower, filterStatus, sortBy, getOrgMeta]);

    const isFiltered = Boolean(
        searchTerm ||
        filterSite !== 'ALL' ||
        filterLocation !== 'ALL' ||
        filterOps !== 'ALL' ||
        filterSiteManager !== 'ALL' ||
        filterFieldStaff !== 'ALL' ||
        filterManpower !== 'ALL' ||
        filterStatus !== 'ALL' ||
        sortBy !== 'NAME_ASC'
    );

    const handleResetFilters = () => {
        setSearchTerm('');
        setFilterSite('ALL');
        setFilterLocation('ALL');
        setFilterOps('ALL');
        setFilterSiteManager('ALL');
        setFilterFieldStaff('ALL');
        setFilterManpower('ALL');
        setFilterStatus('ALL');
        setSortBy('NAME_ASC');
        setCurrentPage(1);
    };

    const paginatedOrganizations = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredOrganizations.slice(start, start + pageSize);
    }, [filteredOrganizations, currentPage, pageSize]);

    useEffect(() => {
        setTotalSites(filteredOrganizations.length);
    }, [filteredOrganizations]);

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (org: Organization) => {
        const entity = allClients.find(e => e.organizationId === org.id);
        if (entity) {
            setEntityFormState({ isOpen: true, initialData: entity, companyName: entity.companyName || '' });
        } else {
            setEntityFormState({ 
                isOpen: true, 
                initialData: { 
                    id: `new_${Date.now()}`, 
                    name: org.shortName, 
                    organizationId: org.id 
                } as Entity, 
                companyName: '' 
            });
        }
    };

    const handleSaveEntity = async (entityData: Entity, pendingFiles: Record<string, UploadedFile | UploadedFile[]>) => {
        try {
            const updatedData = { ...entityData };
            const fileEntries = Object.entries(pendingFiles);
            
            if (fileEntries.length > 0) {
                setToast({ message: 'Uploading documents...', type: 'success' });
                for (const [path, files] of fileEntries) {
                    const filesArray = Array.isArray(files) ? files : [files];
                    const uploadedUrls: string[] = [];

                    for (const uploadedFile of filesArray) {
                        if (uploadedFile.file) {
                            const uploadResult = await api.uploadDocument(uploadedFile.file, 'onboarding-documents', undefined, path);
                            uploadedUrls.push(uploadResult.url);
                        }
                    }

                    if (uploadedUrls.length > 0) {
                        const pathParts = path.split('.');
                        let current: any = updatedData;
                        for (let i = 0; i < pathParts.length - 1; i++) {
                            if (!current[pathParts[i]]) current[pathParts[i]] = {};
                            current = current[pathParts[i]];
                        }
                        
                        const keyName = pathParts[pathParts.length - 1];
                        if (Array.isArray(files)) {
                             // For multi-upload fields, we usually store the full array or add to it
                             current[keyName] = uploadedUrls;
                        } else {
                             // For single upload fields, we usually append 'Url' to the key
                             current[`${keyName}Url`] = uploadedUrls[0];
                        }
                    }
                }
            }

            const saved = await api.saveEntity(updatedData);
            setAllClients(prev => {
                const exists = prev.some(e => e.id === saved.id);
                return exists ? prev.map(e => e.id === saved.id ? { ...saved, companyName: e.companyName } : e) : [...prev, { ...saved, companyName: '' }];
            });
            setToast({ message: 'Site configuration saved successfully.', type: 'success' });
            setEntityFormState({ isOpen: false, initialData: null, companyName: '' });
        } catch (error) {
            console.error("Failed to save site configuration:", error);
            setToast({ message: 'Failed to save site configuration.', type: 'error' });
        }
    };

    const handleDelete = (org: Organization) => {
        setCurrentOrg(org);
        setIsDeleteModalOpen(true);
    };




    const handleConfirmDelete = async () => {
        if (currentOrg) {
            setOrganizations(prev => prev.filter(o => o.id !== currentOrg.id));
            setToast({ message: 'Site deleted.', type: 'success' });
            setIsDeleteModalOpen(false);
        }
    };

    const handleViewDetails = async (org: Organization) => {
        setCurrentOrg(org);
        setIsDetailsLoading(true);
        setIsDetailsModalOpen(true);
        try {
            const details = await api.getManpowerDetails(org.id);
            setManpowerDetails(details);
        } catch (e) {
            setToast({ message: 'Could not load manpower details.', type: 'error' });
        } finally {
            setIsDetailsLoading(false);
        }
    };

    const handleSaveManpowerDetails = async (details: ManpowerDetail[]) => {
        if (!currentOrg) return;
        try {
            await api.updateManpowerDetails(currentOrg.id, details);

            const newTotal = details.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
            setOrganizations(prevOrgs =>
                prevOrgs.map(org =>
                    org.id === currentOrg.id ? { ...org, manpowerApprovedCount: newTotal } : org
                )
            );

            setIsDetailsModalOpen(false);
            setToast({ message: 'Manpower details updated successfully.', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to save manpower details.', type: 'error' });
        }
    };

    const handleExport = () => {
        const csvData = toCSV(organizations, siteCsvColumns);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'sites_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setToast({ message: 'Sites exported successfully.', type: 'success' });
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                if (!text) throw new Error("File is empty or could not be read.");

                const parsedData = fromCSV(text);
                if (parsedData.length === 0) throw new Error("No data rows found in the CSV file.");

                const fileHeaders = Object.keys(parsedData[0]);
                const hasAllHeaders = siteCsvColumns.every(h => fileHeaders.includes(h));
                if (!hasAllHeaders) {
                    throw new Error(`CSV is missing headers. Required: ${siteCsvColumns.join(', ')}`);
                }

                const newOrgs: Organization[] = parsedData.map(row => ({
                    id: row.id,
                    shortName: row.shortName,
                    fullName: row.fullName,
                    address: row.address,
                    manpowerApprovedCount: parseFloat(row.manpowerApprovedCount) || 0,
                    reportingManagerName: row.reportingManagerName || undefined,
                    managerName: row.managerName || undefined,
                    fieldStaffNames: row.fieldStaffNames ? row.fieldStaffNames.split(';').map((s: string) => s.trim()).filter((s: string) => s) : undefined,
                    backendFieldStaffName: row.backendFieldStaffName || undefined,
                }));

                const { count } = await api.bulkUploadOrganizations(newOrgs);
                setToast({ message: `${count} sites imported/updated successfully.`, type: 'success' });
                fetchData();

            } catch (error: any) {
                setToast({ message: error.message || 'Failed to import CSV.', type: 'error' });
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="p-4 md:p-6 flex-1 flex flex-col">
            <MobileTopBar title="SITE MANAGEMENT" parentPath="/mobile-home" />
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <input type="file" ref={importRef} className="hidden" accept=".csv" onChange={handleImport} />


            {currentOrg && (
                <ManpowerDetailsModal
                    isOpen={isDetailsModalOpen}
                    onClose={() => setIsDetailsModalOpen(false)}
                    siteName={currentOrg.shortName}
                    details={manpowerDetails}
                    isLoading={isDetailsLoading}
                    onSave={handleSaveManpowerDetails}
                    designations={siteStaffDesignations}
                />
            )}

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Confirm Deletion"
            >
                Are you sure you want to delete the site "{currentOrg?.shortName}"? This action cannot be undone.
            </Modal>

            <div className="bg-card p-4 rounded-2xl mb-4">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                    <h2 className="text-2xl font-semibold text-primary-text">Site Management</h2>
                    {!isMobile && (
                        <div className="flex-shrink-0 flex items-center flex-wrap gap-2">
                            <Button variant="outline" onClick={() => navigate('/admin/sites/quick-add')} className="mr-2 hover:bg-gray-100">
                                <Plus className="w-5 h-5 mr-2" />
                                Quick Add Site
                            </Button>
                            <Button onClick={() => navigate('/admin/sites/add')} className="mr-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
                                <Plus className="w-5 h-5 mr-2" />
                                Add Site
                            </Button>
                            <Button variant="outline" onClick={() => importRef.current?.click()} className="mr-2 hover:bg-gray-100">
                                <Upload className="w-5 h-5 mr-2" />
                                Import
                            </Button>
                            <Button variant="outline" onClick={handleExport} className="hover:bg-gray-100">
                                <Download className="w-5 h-5 mr-2" />
                                Export
                            </Button>
                        </div>
                    )}
                </div>

                {isMobile && (
                    <div className="flex flex-col gap-3 mb-4">
                        <Button onClick={() => navigate('/admin/sites/add')} className="w-full justify-center bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
                            <Plus className="w-5 h-5 mr-2" />
                            Add Site
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/admin/sites/quick-add')} className="w-full justify-center hover:bg-gray-100">
                            <Plus className="w-5 h-5 mr-2" />
                            Quick Add Site
                        </Button>
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" onClick={() => importRef.current?.click()} className="w-full justify-center hover:bg-gray-100">
                                <Upload className="w-5 h-5 mr-2" />
                                Import
                            </Button>
                            <Button variant="outline" onClick={handleExport} className="w-full justify-center hover:bg-gray-100">
                                <Download className="w-5 h-5 mr-2" />
                                Export
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Summary Cards: 6 Individual Dedicated Cards based on Image 1 data */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 w-full mb-4">
                <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 shrink-0">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xl font-black text-gray-900 dark:text-white leading-tight">{stats.totalSites}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">Active Sites</div>
                    </div>
                </div>

                <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shrink-0">
                        <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xl font-black text-gray-900 dark:text-white leading-tight">{stats.totalManpower.toLocaleString()}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">Total Manpower</div>
                    </div>
                </div>

                <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-800 shrink-0">
                        <CheckCircle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xl font-black text-gray-900 dark:text-white leading-tight">{stats.sitesWithManpower}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">Manned Sites</div>
                    </div>
                </div>

                <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xl font-black text-gray-900 dark:text-white leading-tight">{stats.opsCount}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">Ops Leads (RM)</div>
                    </div>
                </div>

                <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 flex items-center justify-center text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800 shrink-0">
                        <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xl font-black text-gray-900 dark:text-white leading-tight">{stats.smCount}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">Site Managers (SM)</div>
                    </div>
                </div>

                <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800 shrink-0">
                        <MapPin className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xl font-black text-gray-900 dark:text-white leading-tight">{stats.locationsCount}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">Locations</div>
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar based on Image 1 Data */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm space-y-4 w-full mb-4">
                <div className="flex flex-col lg:flex-row items-center gap-3">
                    {/* Search Box */}
                    <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search by Site Name, Location, Ops Lead (RM), Site Manager (SM), Field Staff, or Manpower..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2 text-sm rounded-2xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                    </div>

                    {/* Quick Clear */}
                    {isFiltered && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleResetFilters}
                            className="!text-xs whitespace-nowrap"
                        >
                            Reset Filters
                        </Button>
                    )}
                </div>

                {/* Dropdown Filters: 8 Columns based on Image 1 Data */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Site / Client</label>
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
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Location</label>
                        <select
                            value={filterLocation}
                            onChange={(e) => { setFilterLocation(e.target.value); setCurrentPage(1); }}
                            className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold truncate"
                        >
                            <option value="ALL">All Locations ({locationFilterOptions.length})</option>
                            {locationFilterOptions.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Manpower</label>
                        <select
                            value={filterManpower}
                            onChange={(e) => { setFilterManpower(e.target.value); setCurrentPage(1); }}
                            className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold truncate"
                        >
                            <option value="ALL">All Manpower ({stats.totalSites})</option>
                            <option value="MANNED">Manned Sites (&gt; 0)</option>
                            <option value="ZERO">Zero Manpower (0)</option>
                            <option value="LARGE">Large (50+ Staff)</option>
                            <option value="MEDIUM">Medium (10 - 49)</option>
                            <option value="SMALL">Small (1 - 9)</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Ops Lead (RM)</label>
                        <select
                            value={filterOps}
                            onChange={(e) => { setFilterOps(e.target.value); setCurrentPage(1); }}
                            className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold truncate"
                        >
                            <option value="ALL">All RMs ({opsFilterOptions.length})</option>
                            {opsFilterOptions.map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Site Manager (SM)</label>
                        <select
                            value={filterSiteManager}
                            onChange={(e) => { setFilterSiteManager(e.target.value); setCurrentPage(1); }}
                            className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold truncate"
                        >
                            <option value="ALL">All Site Mgrs ({siteMgrFilterOptions.length})</option>
                            {siteMgrFilterOptions.map(sm => <option key={sm} value={sm}>{sm}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Field Staff (FS)</label>
                        <select
                            value={filterFieldStaff}
                            onChange={(e) => { setFilterFieldStaff(e.target.value); setCurrentPage(1); }}
                            className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold truncate"
                        >
                            <option value="ALL">All Staff ({fieldStaffFilterOptions.length})</option>
                            {fieldStaffFilterOptions.map(fs => <option key={fs} value={fs}>{fs}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Agreement Status</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                            className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold truncate"
                        >
                            <option value="ALL">All Status</option>
                            <option value="ACTIVE">Active Sites</option>
                            <option value="EXPIRED">Expired / Provisional</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Sort By</label>
                        <select
                            value={sortBy}
                            onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                            className="w-full py-1.5 px-3 text-xs rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold truncate"
                        >
                            <option value="NAME_ASC">Name (A to Z)</option>
                            <option value="NAME_DESC">Name (Z to A)</option>
                            <option value="MANPOWER_DESC">Manpower (High to Low)</option>
                            <option value="MANPOWER_ASC">Manpower (Low to High)</option>
                            <option value="LOCATION_ASC">Location (A to Z)</option>
                        </select>
                    </div>
                </div>
            </div>

            {entityFormState.isOpen ? (
                <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
                    <EntityForm 
                        isOpen={entityFormState.isOpen}
                        onClose={() => setEntityFormState({ ...entityFormState, isOpen: false })}
                        onSave={handleSaveEntity}
                        initialData={entityFormState.initialData}
                        companyName={entityFormState.companyName}
                    />
                </div>
            ) : (
                <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
                    {/* Table Sub-header matching Image 2 */}
                    <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                Showing {filteredOrganizations.length} of {scopedOrganizations.length} Sites
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                className="text-xs font-bold rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 px-2 py-1 text-gray-700 dark:text-gray-200 outline-none cursor-pointer"
                            >
                                {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <tbody className="divide-y divide-border">
                                    <TableSkeleton cols={5} rows={5} />
                                </tbody>
                            </table>
                        </div>
                    ) : scopedOrganizations.length === 0 ? (
                        <div className="p-8 text-center text-muted">
                            <Building className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No sites found. Add a new site to get started.</p>
                        </div>
                    ) : filteredOrganizations.length === 0 ? (
                        <div className="p-12 text-center text-muted">
                            <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            <p className="font-semibold text-sm">No sites matching your filters</p>
                            <p className="text-xs text-gray-400 mt-1">Try modifying or resetting your search and dropdown filters.</p>
                            <Button variant="secondary" size="sm" onClick={handleResetFilters} className="mt-4">
                                Reset All Filters
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Site Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Location</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">Manpower</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Key Staff</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {paginatedOrganizations.map((org) => {
                                        const isProvisional = !!org.provisionalCreationDate;
                                        const daysLeft = isProvisional && org.provisionalCreationDate
                                            ? 90 - differenceInDays(new Date(), new Date(org.provisionalCreationDate))
                                            : 0;
                                        const { opsLead, siteMgr, fieldOff } = getOrgMeta(org);
                                        const displayRM = org.reportingManagerName || opsLead;
                                        const displaySM = org.managerName || siteMgr;
                                        const displayFS = (org.fieldStaffNames && org.fieldStaffNames.length > 0)
                                            ? org.fieldStaffNames.join(', ')
                                            : fieldOff;

                                        return (
                                            <tr key={org.id} className="hover:bg-muted/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <div>
                                                            <div className="font-medium text-primary-text">{org.shortName}</div>
                                                            <div className="text-xs text-muted">{org.fullName}</div>
                                                            {isProvisional && (
                                                                <div className={`mt-1 text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${daysLeft > 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-primary-text max-w-xs truncate" title={org.address}>
                                                        {org.address}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {org.manpowerApprovedCount || 0}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs space-y-1">
                                                        {displayRM && (
                                                            <div className="flex items-center gap-1" title="Reporting Manager">
                                                                <span className="font-semibold text-primary-text">RM:</span> {displayRM}
                                                            </div>
                                                        )}
                                                        {displaySM && (
                                                            <div className="flex items-center gap-1" title="Site Manager">
                                                                <span className="font-semibold text-primary-text">SM:</span> {displaySM}
                                                            </div>
                                                        )}
                                                        {displayFS && (
                                                            <div className="flex items-start gap-1" title="Field Staff">
                                                                <span className="font-semibold text-primary-text whitespace-nowrap">FS:</span>
                                                                <span className="truncate max-w-[150px]">{displayFS}</span>
                                                            </div>
                                                        )}
                                                        {org.backendFieldStaffName && (
                                                            <div className="flex items-start gap-1" title="Backend Field Staff">
                                                                <span className="font-semibold text-primary-text whitespace-nowrap">bfs:</span>
                                                                <span className="truncate max-w-[150px]">{org.backendFieldStaffName}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="icon"
                                                            size="sm"
                                                            onClick={() => handleViewDetails(org)}
                                                            title="Manpower Details"
                                                        >
                                                            <Users className="w-4 h-4 text-blue-600" />
                                                        </Button>
                                                        <Button
                                                            variant="icon"
                                                            size="sm"
                                                            onClick={() => handleEdit(org)}
                                                            title="Configure Site"
                                                        >
                                                            <Settings className="w-4 h-4 text-gray-600" />
                                                        </Button>
                                                        <Button
                                                            variant="icon"
                                                            size="sm"
                                                            onClick={() => handleDelete(org)}
                                                            title="Delete Site"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-600" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <Pagination 
                                currentPage={currentPage}
                                totalItems={filteredOrganizations.length}
                                pageSize={pageSize}
                                onPageChange={setCurrentPage}
                                onPageSizeChange={setPageSize}
                                className="mt-4 p-4"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};