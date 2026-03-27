import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { api } from '../../services/api';
import type { OrganizationGroup, Entity, Company, RegistrationType, Organization, SiteConfiguration, UploadedFile } from '../../types';
import { Plus, Save, Edit, Trash2, Building, ChevronRight, Eye, CheckCircle, AlertCircle, Search, ClipboardList, Settings, Calculator, Users, Badge, HeartPulse, Archive, Wrench, Shirt, FileText, CalendarDays, BarChart, Mail, Sun, UserX, IndianRupee, ChevronLeft, HelpCircle, Loader2, Clock } from 'lucide-react';
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
    { key: 'notification_template', label: 'Notification & Mail', icon: Mail },
    { key: 'onboard_reject_reason', label: 'Onboarding Rejection Reasons', icon: UserX },
    { key: 'salary_template', label: 'Salary Breakup', icon: IndianRupee },
    { key: 'salary_line_item', label: 'Salary Line Item', icon: IndianRupee },
];

const EntityManagement: React.FC = () => {
    const navigate = useNavigate();
    const [groups, setGroups] = useState<OrganizationGroup[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [activeSubcategory, setActiveSubcategory] = useState<string>('client_structure');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLocation, setSelectedLocation] = useState<string>('Bangalore');
    const [viewingClients, setViewingClients] = useState<{ companyName: string; clients: Entity[] } | null>(null);
    const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
    const isMobile = useMediaQuery('(max-width: 767px)');

    // Modals state
    const [entityFormState, setEntityFormState] = useState<{ isOpen: boolean; initialData: Entity | null; companyName: string }>({ isOpen: false, initialData: null, companyName: '' });
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

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [structure, orgs] = await Promise.all([
                    api.getOrganizationStructure(),
                    api.getOrganizations()
                ]);
                setGroups(structure);
                setOrganizations(orgs);
            } catch (error) {
                setToast({ message: "Failed to load data.", type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

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
    const handleAddClient = (companyName: string) => setEntityFormState({ isOpen: true, initialData: null, companyName });
    const handleEditClient = (entity: Entity, companyName: string) => setEntityFormState({ isOpen: true, initialData: entity, companyName });
    const handleSaveClient = async (clientData: Entity, pendingFiles: Record<string, File | File[]>) => {
        try {
            let company = groups.flatMap(g => g.companies).find(c => c.name === entityFormState.companyName);
            
            // If company not found by name (fallback for global add), use companyId from data
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
                        const uploadPromises = files.map(file => api.uploadDocument(file as File, 'compliance-documents', undefined, path));
                        const results = await Promise.all(uploadPromises);
                        const newUrls = results.map(r => r.url);

                        // Extract everything after the first prefix (doc_, ins_, pol_)
                        // e.g. "doc_doc_1711544123456" → "doc_1711544123456"
                        const id = path.substring(path.indexOf('_') + 1);
                        if (path.startsWith('doc_')) {
                            updatedClientData.complianceDocuments = updatedClientData.complianceDocuments?.map(d => 
                                d.id === id ? { ...d, documentUrls: [...(d.documentUrls || []), ...newUrls] } : d
                            );
                        } else if (path.startsWith('ins_')) {
                            updatedClientData.insurances = updatedClientData.insurances?.map(i => 
                                i.id === id ? { ...i, documentUrls: [...(i.documentUrls || []), ...newUrls] } : i
                            );
                        } else if (path.startsWith('pol_')) {
                            updatedClientData.policies = updatedClientData.policies?.map(p => 
                                p.id === id ? { ...p, documentUrls: [...(p.documentUrls || []), ...newUrls] } : p
                            );
                        }
                    } else if (['cinDoc', 'dinDoc', 'tinDoc', 'udyogDoc', 'epfoDoc', 'esicDoc', 'shramDoc'].includes(path)) {
                        // Single file registration/statutory docs
                        const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
                        const uploadResult = await api.uploadDocument(file as File, 'onboarding-documents', undefined, path);
                        
                        const mapping: Record<string, string> = {
                            cinDoc: 'cinDocUrl',
                            dinDoc: 'dinDocUrl',
                            tinDoc: 'tinDocUrl',
                            udyogDoc: 'udyogDocUrl',
                            epfoDoc: 'epfoDocUrl',
                            esicDoc: 'esicDocUrl',
                            shramDoc: 'eShramDocUrl'
                        };
                        (updatedClientData as any)[mapping[path]] = uploadResult.url;
                    } else if (path === 'logo') {
                        // Society Logo
                        const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
                        const uploadResult = await api.uploadLogo(file as File);
                        updatedClientData.logoUrl = uploadResult;
                    } else {
                        // Legacy/Generic nested path handling
                        const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
                        const uploadResult = await api.uploadDocument(files[0] as File, 'onboarding-documents', undefined, path);
                        
                        const pathParts = path.split('.');
                        let current: any = updatedClientData;
                        for (let i = 0; i < pathParts.length - 1; i++) {
                            if (!current[pathParts[i]]) current[pathParts[i]] = {};
                            current = current[pathParts[i]];
                        }
                        current[`${pathParts[pathParts.length - 1]}Url`] = uploadResult.url;
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
            } else {
                setToast({ message: clientData.id.startsWith('new_') ? 'Society added successfully.' : 'Society updated successfully.', type: 'success' });
                setEntityFormState({ isOpen: false, initialData: null, companyName: '' });
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

    const handleSaveCompanyData = async (data: Partial<Company>, pendingFiles: Record<string, File | File[]> = {}) => {
        try {
            const { mode, groupId } = companyFormState;
            const newGroups = [...groups];
            const groupIndex = newGroups.findIndex(g => g.id === groupId);
            if (groupIndex === -1) return;

            setToast({ message: 'Saving company & uploading files...', type: 'success' });
            let updatedData = { ...data };
            
            // 1. Upload Logo if present
            if (pendingFiles['logo'] && !Array.isArray(pendingFiles['logo'])) {
                const logoUrl = await api.uploadLogo(pendingFiles['logo'] as File);
                updatedData.logoUrl = logoUrl;
            }

            // 1b. Registration & Statutory Documents
            const fileEntries = Object.entries(pendingFiles);
            for (const [path, fileOrFiles] of fileEntries) {
                if (['cinDoc', 'dinDoc', 'tinDoc', 'udyogDoc', 'gstDoc', 'panDoc', 'epfoDoc', 'esicDoc', 'shramDoc'].includes(path)) {
                    const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
                    const { url } = await api.uploadDocument(file as File);
                    
                    const mapping: Record<string, { field: string; nested?: string }> = {
                        cinDoc: { field: 'cinDocUrl' },
                        dinDoc: { field: 'dinDocUrl' },
                        tinDoc: { field: 'tinDocUrl' },
                        udyogDoc: { field: 'udyogDocUrl' },
                        gstDoc: { field: 'gstDocUrl' },
                        panDoc: { field: 'panDocUrl' },
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
                            // Upload multiple files to compliance-documents bucket
                            const uploadPromises = pendingForDoc.map(file => api.uploadDocument(file as File, 'compliance-documents', undefined, `doc_${doc.id}`));
                            const results = await Promise.all(uploadPromises);
                            doc.documentUrls = [...(doc.documentUrls || []), ...results.map(r => r.url)];
                        } else {
                            // Single file fallback
                            const { url } = await api.uploadDocument(pendingForDoc as File, 'compliance-documents', undefined, `doc_${doc.id}`);
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
                            const uploadPromises = pendingForIns.map(file => api.uploadDocument(file as File, 'compliance-documents', undefined, `ins_${ins.id}`));
                            const results = await Promise.all(uploadPromises);
                            ins.documentUrls = [...(ins.documentUrls || []), ...results.map(r => r.url)];
                        } else {
                            const { url } = await api.uploadDocument(pendingForIns as File, 'compliance-documents', undefined, `ins_${ins.id}`);
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
                            const uploadPromises = pendingForPol.map(file => api.uploadDocument(file as File, 'compliance-documents', undefined, `pol_${pol.id}`));
                            const results = await Promise.all(uploadPromises);
                            pol.documentUrls = [...(pol.documentUrls || []), ...results.map(r => r.url)];
                        } else {
                            const { url } = await api.uploadDocument(pendingForPol as File, 'compliance-documents', undefined, `pol_${pol.id}`);
                            pol.documentUrls = [...(pol.documentUrls || []), url];
                        }
                    }
                }
            }

            if (mode === 'add') {
                const newCompany = await api.createCompany({ 
                    id: `comp_${Date.now()}`, 
                    groupId,
                    ...updatedData
                });
                newGroups[groupIndex].companies.push({ ...newCompany, entities: [] });
                setToast({ message: `Company '${data.name}' added successfully.`, type: 'success' });
            } else if (data.id) {
                const updatedCompany = await api.updateCompany(data.id, updatedData);
                const compIndex = newGroups[groupIndex].companies.findIndex(c => c.id === data.id);
                if (compIndex !== -1) {
                    newGroups[groupIndex].companies[compIndex] = {
                        ...newGroups[groupIndex].companies[compIndex],
                        ...updatedCompany
                    };
                }
                setToast({ message: 'Company updated successfully.', type: 'success' });
            }
            setGroups(newGroups);
            setCompanyFormState({ ...companyFormState, isOpen: false });
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
            case 'client_structure':
                return (
                    <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                            <Button onClick={() => navigate('/hr/entity-management/add-group')} style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }} className="border hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-300"><Plus className="mr-2 h-4" />Add Group</Button>
                        </div>
                        <div className="space-y-2">
                            {filteredGroups.map(group => (
                                <div key={group.id} className="border-b border-border">
                                    <div className="p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => toggleExpand(group.id)}><ChevronRight className={`h-5 w-5 transition-transform ${expanded[group.id] ? 'rotate-90' : ''}`} /></button>
                                            <Building className="h-5 w-5 text-muted" />
                                            <span className="font-semibold">{group.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" className="!p-1.5" onClick={() => setCompanyFormState({ isOpen: true, mode: 'add', groupId: group.id, groupName: group.name, initialData: null })} title="Add Company / LLP / Partnership / Society">
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                            <Button variant="icon" onClick={() => setNameModalState({ isOpen: true, mode: 'edit', type: 'group', id: group.id, initialName: group.name, title: 'Edit Group Name', label: 'Group Name' })} title="Edit group name" className="p-2 hover:bg-blue-500/10 rounded-full transition-colors"><Edit className="h-5 w-5" /></Button>
                                            <Button variant="icon" onClick={() => handleDeleteClick('group', group.id, group.name)} title="Delete group" className="p-2 hover:bg-red-500/10 rounded-full transition-colors"><Trash2 className="h-5 w-5 text-red-500" /></Button>
                                        </div>
                                    </div>
                                    {expanded[group.id] && (
                                        <div className="pl-6 pr-3 pb-3 space-y-2">
                                            {group.companies.map(company => (
                                                <div key={company.id} className="border border-border rounded-lg">
                                                    <div className="p-2 flex items-center justify-between bg-card">
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => toggleExpand(company.id)}><ChevronRight className={`h-5 w-5 transition-transform ${expanded[company.id] ? 'rotate-90' : ''}`} /></button>
                                                            <span>
                                                                {company.name} 
                                                                {company.location && <span className="text-sm text-muted ml-1">({company.location})</span>}{' '}
                                                                <span className="text-sm text-muted">({company.entities.length} societies)</span>
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button variant="icon" size="sm" title={`View ${company.entities.length} societies`} onClick={() => setViewingClients({ companyName: company.name, clients: company.entities })}><Eye className="h-4 w-4" /></Button>
                                                            <Button variant="icon" size="sm" onClick={() => handleAddClient(company.name)} title="Add Society"><Plus className="h-4 w-4" /></Button>
                                                            <Button variant="icon" onClick={() => setCompanyFormState({ isOpen: true, mode: 'edit', groupId: group.id, groupName: group.name, initialData: company })} title="Edit company name" className="p-2 hover:bg-blue-500/10 rounded-full transition-colors"><Edit className="h-5 w-5" /></Button>
                                                            <Button variant="icon" onClick={() => handleDeleteClick('company', company.id, company.name)} title="Delete Company / LLP / Partnership / Society" className="p-2 hover:bg-red-500/10 rounded-full transition-colors"><Trash2 className="h-5 w-5 text-red-500" /></Button>
                                                        </div>
                                                    </div>
                                                    {expanded[company.id] && (
                                                        <div className="p-2">
                                                            {company.entities.map(client => (
                                                                <div key={client.id} className="p-2 flex items-center justify-between hover:bg-page rounded">
                                                                    <span>
                                                                        {client.name}
                                                                        {client.location && <span className="text-sm text-muted ml-1">({client.location})</span>}
                                                                    </span>
                                                                    <div className="flex items-center gap-1">
                                                                        <Button variant="icon" onClick={() => handleEditClient(client, company.name)} className="p-2 hover:bg-blue-500/10 rounded-full transition-colors"><Edit className="h-5 w-5" /></Button>
                                                                        <Button variant="icon" onClick={() => handleDeleteClick('client', client.id, client.name)} className="p-2 hover:bg-red-500/10 rounded-full transition-colors"><Trash2 className="h-5 w-5 text-red-500" /></Button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'site_configuration':
                // Build the site config list from entities in the hierarchy (allClients)
                // This ensures societies added via Client Structure automatically appear here
                const siteConfigEntities = allClients.filter(client => {
                    const matchesSearch = searchTerm.trim() ? client.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
                    const matchesLocation = selectedLocation ? client.location === selectedLocation : true;
                    return matchesSearch && matchesLocation;
                });
                return (
                    <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                            <h4 className="text-lg font-semibold text-primary-text">Sites Configuration</h4>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Button onClick={() => setEntityFormState({ isOpen: true, initialData: null, companyName: '' })} style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }} className="border hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                                    <Plus className="mr-2 h-4 w-4" /> Add Society
                                </Button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border responsive-table">
                                <thead className="bg-page">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Site Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Configuration Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border md:bg-card md:divide-y-0">
                                    {siteConfigEntities.map(entity => {
                                        const isConfigured = !!entity.billingName || !!entity.siteManagement?.keyAccountManager;
                                        return (
                                            <tr key={entity.id}>
                                                <td data-label="Site Name" className="px-4 py-3 font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <Building className="h-5 w-5 text-muted" />
                                                        <span>{entity.name}</span>
                                                    </div>
                                                </td>
                                                 <td data-label="Status" className="px-4 py-3">
                                                    {entity.status === 'draft' ? (
                                                        <span className="flex items-center text-orange-600 bg-orange-50 px-2 py-1 rounded-full text-xs font-bold w-fit border border-orange-200"><Clock className="h-3 w-3 mr-1" /> Draft</span>
                                                    ) : isConfigured ? (
                                                        <span className="flex items-center text-green-600 px-2 py-1 bg-green-50 rounded-full text-xs font-bold w-fit border border-green-200"><CheckCircle className="h-3 w-3 mr-1" /> Complete</span>
                                                    ) : (
                                                        <span className="flex items-center text-yellow-600 px-2 py-1 bg-yellow-50 rounded-full text-xs font-bold w-fit border border-yellow-200"><AlertCircle className="h-3 w-3 mr-1" /> Incomplete</span>
                                                    )}
                                                </td>
                                                <td data-label="Actions" className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" variant="outline" onClick={() => {
                                                            setEntityFormState({ isOpen: true, initialData: entity, companyName: entity.companyName || '' });
                                                        }}>
                                                            <Eye className="mr-2 h-4 w-4" /> View / Edit
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => handleDeleteClick('site', entity.id, entity.name)} className="text-red-500 border-red-300 hover:bg-red-50">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'costing_resource': return <CostingResourceConfig sites={allClients} />;
            case 'backoffice_heads': return <BackofficeHeadsConfig />;
            case 'staff_designation': return <StaffDesignationConfig />;
            case 'gmc_policy': return <GmcPolicyConfig />;
            case 'asset': return <AssetConfig />;
            case 'tools_list': return <ToolsListConfig />;
            case 'attendance_format': return <AttendanceFormatConfig />;
            case 'attendance_overview': return <AttendanceOverviewConfig />;
            case 'daily_attendance': return <DailyAttendanceConfig />;
            case 'notification_template': return <NotificationTemplateConfig />;
            case 'onboard_reject_reason': return <OnboardRejectReasonConfig />;
            case 'salary_template': return <SalaryTemplateConfig />;
            case 'salary_line_item': return <SalaryLineItemConfig />;
            default:
                const activeItem = subcategories.find(sc => sc.key === activeSubcategory);
                return <PlaceholderView title={activeItem?.label || 'Configuration'} />;
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
        <div className="p-4 space-y-6">
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
                <h2 className="text-2xl font-semibold text-primary-text">Client Management</h2>
                {!isMobile && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" onClick={() => setIsInstructionsOpen(true)} className="hover:bg-gray-100"><HelpCircle className="mr-2 h-4 w-4" /> Help</Button>
                        <Button onClick={handleSaveAll} style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }} className="border hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-300"><Save className="mr-2 h-4 w-4" /> Save All Changes</Button>
                    </div>
                )}
            </div>

            {isMobile && (
                <div className="flex flex-col gap-3 mb-4">
                    <Button onClick={handleSaveAll} style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }} className="w-full justify-center border hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-300"><Save className="mr-2 h-4 w-4" /> Save All Changes</Button>
                    <Button variant="outline" onClick={() => setIsInstructionsOpen(true)} className="w-full justify-center hover:bg-gray-100"><HelpCircle className="mr-2 h-4 w-4" /> Help</Button>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                    <input
                        id="client-search"
                        name="clientSearch"
                        type="text"
                        placeholder="Search across all clients and sites..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="form-input !pl-10 w-full"
                    />
                </div>
                <div className="w-full sm:w-64">
                    <Select
                        id="location-filter"
                        value={selectedLocation}
                        onChange={e => setSelectedLocation(e.target.value)}
                        className="w-full"
                    >
                        <option value="">All Locations</option>
                        {existingLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <nav className="md:col-span-3 lg:col-span-2">
                    {isMobile ? (
                        <Select
                            label="Configuration Section"
                            id="hr-config-select"
                            value={activeSubcategory}
                            onChange={e => setActiveSubcategory(e.target.value)}
                        >
                            {subcategories.map(sc => <option key={sc.key} value={sc.key}>{sc.label}</option>)}
                        </Select>
                    ) : (
                        <div className="space-y-1">
                            {subcategories.map(sc => (
                                <button
                                    key={sc.key}
                                    onClick={() => setActiveSubcategory(sc.key)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-left transition-colors ${activeSubcategory === sc.key
                                        ? 'text-white'
                                        : 'text-muted hover:bg-accent-light hover:text-accent-dark'
                                        }`}
                                    style={activeSubcategory === sc.key ? { backgroundColor: '#006B3F' } : {}}
                                >
                                    <sc.icon className="h-5 w-5" />
                                    <span>{sc.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </nav>
                <main className="md:col-span-9 lg:col-span-10">
                    {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mt-16" /> : renderContent()}
                </main>
            </div>
        </div>
    );
};

export default EntityManagement;