

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { Organization, Entity, ManpowerDetail, SiteStaffDesignation } from '../../types';
import Button from '../../components/ui/Button';
import { Plus, Edit, Trash2, Eye, Loader2, Upload, Download, CheckCircle, AlertCircle, Building, Users, Settings } from 'lucide-react';
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
import { Search } from 'lucide-react';
import LoadingScreen from '../../components/ui/LoadingScreen';


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
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [allClients, setAllClients] = useState<(Entity & { companyName: string })[]>([]);
    const [siteStaffDesignations, setSiteStaffDesignations] = useState<SiteStaffDesignation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalSites, setTotalSites] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');



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
            const [orgsResult, structureResult, designationsResult] = await Promise.all([
                api.getOrganizations().catch(e => { console.error("Failed to fetch organizations:", e); return []; }),
                api.getOrganizationStructure().catch(e => { console.error("Failed to fetch organization structure:", e); return []; }),
                api.getSiteStaffDesignations().catch(e => {
                    console.error("Failed to fetch site staff designations:", e);
                    setToast({ message: 'Could not load designation list. Manpower editing may be affected.', type: 'error' });
                    return [];
                }),
            ]);
            setOrganizations(orgsResult);
            setTotalSites(orgsResult.length);
            setSiteStaffDesignations(designationsResult);
            const clients = structureResult.flatMap(group =>
                group.companies.flatMap(company =>
                    company.entities.map(entity => ({ ...entity, companyName: company.name }))
                )
            );
            setAllClients(clients);
        } catch (error) {
            // This block will now only catch truly unexpected errors, not single API call failures.
            setToast({ message: 'An unexpected error occurred while fetching data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

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

    const handleSaveEntity = async (entityData: Entity, pendingFiles: Record<string, File>) => {
        try {
            // Re-use logic for file uploads if needed, or stick to simple save if no files
            // For now, let's process files similar to EntityManagement.tsx
            const updatedData = { ...entityData };
            const fileEntries = Object.entries(pendingFiles);
            
            if (fileEntries.length > 0) {
                setToast({ message: 'Uploading documents...', type: 'success' });
                for (const [path, file] of fileEntries) {
                    const uploadResult = await api.uploadDocument(file, 'onboarding-documents', undefined, path);
                    const pathParts = path.split('.');
                    let current: any = updatedData;
                    for (let i = 0; i < pathParts.length - 1; i++) {
                        if (!current[pathParts[i]]) current[pathParts[i]] = {};
                        current = current[pathParts[i]];
                    }
                    current[`${pathParts[pathParts.length - 1]}Url`] = uploadResult.url;
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
                <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                    {isLoading ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <tbody className="divide-y divide-border">
                                    <TableSkeleton cols={5} rows={5} />
                                </tbody>
                            </table>
                        </div>
                    ) : organizations.length === 0 ? (
                        <div className="p-8 text-center text-muted">
                            <Building className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No sites found. Add a new site to get started.</p>
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
                                    {organizations
                                    .filter(org => 
                                        searchTerm === '' || 
                                        org.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        org.fullName.toLowerCase().includes(searchTerm.toLowerCase())
                                    )
                                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                                    .map((org) => {
                                        const isProvisional = !!org.provisionalCreationDate;
                                        const daysLeft = isProvisional && org.provisionalCreationDate
                                            ? 90 - differenceInDays(new Date(), new Date(org.provisionalCreationDate))
                                            : 0;

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
                                                        {org.reportingManagerName && (
                                                            <div className="flex items-center gap-1" title="Reporting Manager">
                                                                <span className="font-semibold text-primary-text">RM:</span> {org.reportingManagerName}
                                                            </div>
                                                        )}
                                                        {org.managerName && (
                                                            <div className="flex items-center gap-1" title="Site Manager">
                                                                <span className="font-semibold text-primary-text">SM:</span> {org.managerName}
                                                            </div>
                                                        )}
                                                        {org.fieldStaffNames && org.fieldStaffNames.length > 0 && (
                                                            <div className="flex items-start gap-1" title="Field Staff">
                                                                <span className="font-semibold text-primary-text whitespace-nowrap">FS:</span>
                                                                <span className="truncate max-w-[150px]">{org.fieldStaffNames.join(', ')}</span>
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
                                totalItems={organizations.filter(org => 
                                    searchTerm === '' || 
                                    org.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    org.fullName.toLowerCase().includes(searchTerm.toLowerCase())
                                ).length}
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