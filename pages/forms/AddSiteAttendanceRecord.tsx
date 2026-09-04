import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { SiteInvoiceRecord, SiteInvoiceDefault, Organization } from '../../types';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { 
    Save, 
    ArrowLeft, 
    ClipboardList, 
    Building, 
    Calendar, 
    Users, 
    Briefcase, 
    FileText, 
    Clock, 
    ShieldCheck, 
    Lock, 
    Edit3, 
    CheckCircle2, 
    ChevronDown, 
    ChevronUp,
    Info
} from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { format, getDate, getMonth, getYear, set, parseISO } from 'date-fns';
import LoadingScreen from '../../components/ui/LoadingScreen';

import { getUserRoutingScope, getSiteMetadataFromMatrix, getUserFormPermissions } from '../../services/siteRoutingScope';
import type { SiteResponsibilityMatrix } from '../../types/siteRouting';

const AddSiteAttendanceRecord: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditing = !!id;
    const isMobile = useMediaQuery('(max-width: 767px)');
    const { user: authUser } = useAuthStore();

    const permissions = useMemo(() => getUserFormPermissions(authUser), [authUser]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [sites, setSites] = useState<Organization[]>([]);
    const [matrixList, setMatrixList] = useState<SiteResponsibilityMatrix[]>([]);
    const [showAdminOverride, setShowAdminOverride] = useState(false);

    const [record, setRecord] = useState<Partial<SiteInvoiceRecord>>({
        siteId: '',
        siteName: '',
        companyName: '',
        billingCycle: '',
        opsRemarks: '',
        hrRemarks: '',
        financeRemarks: '',
        opsIncharge: '',
        hrIncharge: '',
        invoiceIncharge: '',
        managerTentativeDate: '',
        managerReceivedDate: '',
        hrTentativeDate: '',
        hrReceivedDate: '',
        attendanceReceivedTime: '',
        invoiceSharingTentativeDate: '',
        invoicePreparedDate: '',
        invoiceSentDate: '',
        invoiceSentTime: '',
        invoiceSentMethodRemarks: ''
    });
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const BILLING_CYCLES = ['1st Billing Cycle', '2nd Billing Cycle', '3rd Billing Cycle'];
    const [opsInchargeOptions, setOpsInchargeOptions] = useState<string[]>([]);
    const [hrInchargeOptions, setHrInchargeOptions] = useState<string[]>([]);
    const [invoiceInchargeOptions, setInvoiceInchargeOptions] = useState<string[]>([]);

    const [siteDefaults, setSiteDefaults] = useState<SiteInvoiceDefault[]>([]);
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                if (authUser) {
                    setCurrentUser({ id: authUser.id, name: authUser.name || 'Unknown' });
                }

                const [fetchedSites, fetchedDefaults, trackerRecords, matrixData] = await Promise.all([
                    api.getOrganizations(),
                    api.getSiteInvoiceDefaults(),
                    api.getSiteInvoiceRecords(),
                    api.getSiteResponsibilityMatrix()
                ]);

                const matrix = matrixData || [];
                setMatrixList(matrix);

                const scope = getUserRoutingScope(authUser, matrix);

                // Extract unique site names from tracker records
                const trackerSiteNames = Array.from(new Set(trackerRecords.map(r => r.siteName).filter(Boolean)));
                
                // Merge with fetched sites & matrix sites
                const allSites: Organization[] = [...(fetchedSites || [])];
                trackerSiteNames.forEach(name => {
                    if (!allSites.find(s => s.shortName === name)) {
                        allSites.push({ id: name!, shortName: name!, name: name! } as any as Organization);
                    }
                });
                matrix.forEach(m => {
                    if (m.siteName && !allSites.find(s => s.shortName === m.siteName)) {
                        allSites.push({ id: m.siteName, shortName: m.siteName, name: m.siteName } as any as Organization);
                    }
                });
                
                // Filter sites strictly to user's authorized scope
                const permittedSites = allSites.filter(s => {
                    const sName = s.shortName || (s as any).name || s.id;
                    const matrixMeta = getSiteMetadataFromMatrix(sName, matrix);
                    const company = matrixMeta?.billingCompany || (s as any).company || (s as any).companyName || '';
                    return scope.isSitePermitted(sName, company);
                });
                setSites(permittedSites);
                setSiteDefaults(fetchedDefaults || []);

                // Extract unique incharge names from tracker records & matrix
                const opsSet = new Set<string>();
                const hrSet = new Set<string>();
                const invoiceSet = new Set<string>();

                matrix.forEach(m => {
                    if (m.opsManagerName) opsSet.add(m.opsManagerName);
                    if (m.hrInchargeName) hrSet.add(m.hrInchargeName);
                    if (m.accountsInchargeName) invoiceSet.add(m.accountsInchargeName);
                });

                trackerRecords.forEach(r => {
                    if (r.opsIncharge) opsSet.add(r.opsIncharge);
                    if (r.hrIncharge) hrSet.add(r.hrIncharge);
                    if (r.invoiceIncharge) invoiceSet.add(r.invoiceIncharge);
                });

                setOpsInchargeOptions(Array.from(opsSet).sort());
                setHrInchargeOptions(Array.from(hrSet).sort());
                setInvoiceInchargeOptions(Array.from(invoiceSet).sort());

                if (isEditing && id) {
                    const existingRecord = trackerRecords.find(r => r.id === id);
                    if (existingRecord) {
                        if (!existingRecord.siteId && existingRecord.siteName) {
                            existingRecord.siteId = existingRecord.siteName;
                        }
                        // Ensure matrix metadata is populated if missing
                        const matrixMeta = getSiteMetadataFromMatrix(existingRecord.siteName || '', matrix);
                        if (matrixMeta) {
                            existingRecord.companyName = existingRecord.companyName || matrixMeta.billingCompany || '';
                            existingRecord.billingCycle = existingRecord.billingCycle || matrixMeta.billingCycle || '';
                            existingRecord.opsIncharge = existingRecord.opsIncharge || matrixMeta.opsManagerName || '';
                            existingRecord.hrIncharge = existingRecord.hrIncharge || matrixMeta.hrInchargeName || '';
                            existingRecord.invoiceIncharge = existingRecord.invoiceIncharge || matrixMeta.accountsInchargeName || '';
                        }
                        setRecord(existingRecord);
                    } else {
                        setToast({ message: 'Record not found', type: 'error' });
                        setTimeout(() => navigate('/finance?tab=attendance'), 2000);
                    }
                }
            } catch (error) {
                console.error('Error loading form data:', error);
                setToast({ message: 'Failed to load data', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id, isEditing, navigate, authUser]);

    const handleInputChange = (field: keyof SiteInvoiceRecord, value: any) => {
        setRecord(prev => {
            const updated = { ...prev, [field]: value };

            if (field === 'siteId') {
                const site = sites.find(s => s.id === value || s.shortName === value);
                if (site) {
                    updated.siteId = site.id;
                    updated.siteName = site.shortName;
                } else {
                    updated.siteId = value;
                    updated.siteName = value;
                }
                
                // 1. Auto-fill primary canonical incharge and company info from Site Responsibility Matrix
                const matrixMeta = getSiteMetadataFromMatrix(updated.siteName || value, matrixList);
                if (matrixMeta) {
                    updated.companyName = matrixMeta.billingCompany || updated.companyName;
                    updated.billingCycle = matrixMeta.billingCycle || updated.billingCycle;
                    updated.opsIncharge = matrixMeta.opsManagerName || updated.opsIncharge;
                    updated.hrIncharge = matrixMeta.hrInchargeName || updated.hrIncharge;
                    updated.invoiceIncharge = matrixMeta.accountsInchargeName || updated.invoiceIncharge;
                }

                // 2. Auto-fill additional date defaults if available
                const targetId = site ? site.id : value;
                const defaults = siteDefaults.find(d => d.siteId === targetId || d.siteName === value);
                if (defaults) {
                    const defs = defaults as any;
                    if (!updated.companyName) updated.companyName = defs.companyName;
                    if (!updated.billingCycle) updated.billingCycle = defs.billingCycle;
                    if (!updated.opsIncharge) updated.opsIncharge = defs.opsIncharge;
                    if (!updated.hrIncharge) updated.hrIncharge = defs.hrIncharge;
                    if (!updated.invoiceIncharge) updated.invoiceIncharge = defs.invoiceIncharge;

                    const adjustDateToCurrentPeriod = (dateStr: string | undefined): string => {
                        if (!dateStr) return '';
                        try {
                            const defaultDate = parseISO(dateStr);
                            const today = new Date();
                            const adjustedDate = set(today, { 
                                date: getDate(defaultDate),
                                month: getMonth(today), 
                                year: getYear(today) 
                            });
                            return format(adjustedDate, 'yyyy-MM-dd');
                        } catch (e) {
                            console.error('Date adjustment error:', e);
                            return '';
                        }
                    };

                    updated.managerTentativeDate = adjustDateToCurrentPeriod(defs.managerTentativeDate) || updated.managerTentativeDate;
                    updated.hrTentativeDate = adjustDateToCurrentPeriod(defs.hrTentativeDate) || updated.hrTentativeDate;
                    updated.invoiceSharingTentativeDate = adjustDateToCurrentPeriod(defs.invoiceSharingTentativeDate) || updated.invoiceSharingTentativeDate;
                }
            }

            return updated;
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!record.siteId || !record.siteName) {
            setToast({ message: 'Please select a site', type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            const payload = { ...record };
            
            // Validate UUID for siteId. If custom name (not UUID), set siteId to null
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (payload.siteId && !uuidRegex.test(payload.siteId)) {
                (payload as any).siteId = null;
            }

            if (!isEditing && currentUser) {
                payload.createdBy = currentUser.id;
                payload.createdByName = currentUser.name;
                payload.createdByRole = authUser?.role;
            }
            await api.saveSiteInvoiceRecord(payload);
            setToast({ message: `Record ${isEditing ? 'updated' : 'created'} successfully!`, type: 'success' });
            setTimeout(() => navigate('/finance?tab=attendance'), 1500);
        } catch (error) {
            console.error('Save error:', error);
            setToast({ message: 'Failed to save record', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted italic">Loading form...</p>
            </div>
        );
    }

    const SectionHeader = ({ 
        icon: Icon, 
        title, 
        textColor, 
        isLocked, 
        lockedMessage 
    }: { 
        icon: any; 
        title: string; 
        textColor: string; 
        isLocked?: boolean;
        lockedMessage?: string;
    }) => (
        <div className={`flex flex-wrap items-center justify-between border-b ${isMobile ? 'border-[#1f3d2b]' : 'border-border/60'} pb-3 mb-6 gap-2`}>
            <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center ${textColor}`}>
                <Icon className="w-5 h-5 mr-2" />
                {title}
            </h4>
            {isLocked ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <Lock className="w-3.5 h-3.5" />
                    {lockedMessage || 'Read-Only Section'}
                </span>
            ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Editable by you
                </span>
            )}
        </div>
    );

    const labelClass = isMobile ? "text-xs font-bold text-gray-400 uppercase tracking-tight ml-1" : "text-xs font-bold text-muted uppercase tracking-tight ml-1";
    const inputClass = isMobile ? "rounded-xl bg-[#0c2e1f] border-[#1f3d2b] text-white placeholder:text-gray-500" : "rounded-xl";

    const selectClass = isMobile 
        ? "w-full flex h-11 rounded-xl border border-[#1f3d2b] bg-[#0c2e1f] px-3 py-2 text-sm text-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
        : "w-full flex h-11 rounded-xl border border-border bg-white px-3 py-2 text-sm text-primary-text focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm";

    const sectionContainerClass = isMobile 
        ? "bg-card/50 p-4 rounded-xl border border-border space-y-4"
        : "bg-white/40 p-6 rounded-3xl border border-border/50 shadow-sm transition-all hover:shadow-md";

    const FormContent = (
        <form onSubmit={handleSave} className="space-y-10">
            {/* Top Description & Responsibility Section */}
            <div className={sectionContainerClass}>
                <div className="flex flex-wrap items-center justify-between border-b pb-3 mb-6 gap-2">
                    <h4 className="text-sm font-bold uppercase tracking-wider flex items-center text-orange-600 dark:text-orange-400">
                        <Briefcase className="w-5 h-5 mr-2" />
                        Site & Matrix Responsibility
                    </h4>
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Auto-Mapped from Responsibility Matrix
                        </span>
                        {permissions.canEditMetadata && (
                            <button
                                type="button"
                                onClick={() => setShowAdminOverride(!showAdminOverride)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-primary transition-colors py-1 px-2.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-border"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                {showAdminOverride ? 'Hide Admin Override' : 'Admin Override'}
                                {showAdminOverride ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                            </button>
                        )}
                    </div>
                </div>

                {/* Primary Site Selector */}
                <div className="mb-6">
                    <SearchableSelect
                        label="Select Site Name"
                        placeholder="Choose or search authorized site..."
                        options={sites.map(s => {
                            const sName = s.shortName || (s as any).name || s.id;
                            const matrixMeta = getSiteMetadataFromMatrix(sName, matrixList);
                            const company = matrixMeta?.billingCompany || (s as any).company || 'PIFS';
                            return {
                                id: s.id,
                                name: sName,
                                badge: company
                            };
                        })}
                        value={record.siteId || record.siteName || ''}
                        onChange={(id) => handleInputChange('siteId', id)}
                        allowCustom={permissions.isAdmin}
                    />
                </div>

                {/* Assigned Responsibility Cards Grid (Center-based) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 rounded-2xl bg-gray-50/80 dark:bg-[#072418] border border-border/60 mb-6">
                    {/* Company */}
                    <div className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl bg-white dark:bg-[#0c2e1f] border border-border/40 shadow-xs hover:border-blue-500/30 transition-all">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted uppercase tracking-tight mb-1.5">
                            <Building className="w-3.5 h-3.5 text-blue-500" />
                            <span>Company</span>
                        </div>
                        <div className="text-sm font-black text-primary-text truncate w-full text-center" title={record.companyName || 'Not Set'}>
                            {record.companyName || <span className="text-muted/60 italic font-normal">Not Set</span>}
                        </div>
                    </div>

                    {/* Billing Cycle */}
                    <div className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl bg-white dark:bg-[#0c2e1f] border border-border/40 shadow-xs hover:border-amber-500/30 transition-all">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted uppercase tracking-tight mb-1.5">
                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                            <span>Billing Cycle</span>
                        </div>
                        <div className="text-sm font-black text-primary-text truncate w-full text-center" title={record.billingCycle || 'Not Set'}>
                            {record.billingCycle || <span className="text-muted/60 italic font-normal">Not Set</span>}
                        </div>
                    </div>

                    {/* Ops Incharge */}
                    <div className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl bg-white dark:bg-[#0c2e1f] border border-border/40 shadow-xs hover:border-emerald-500/30 transition-all">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted uppercase tracking-tight mb-1.5">
                            <Users className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Ops Incharge</span>
                        </div>
                        <div className="text-sm font-black text-primary-text truncate w-full text-center" title={record.opsIncharge || 'Not Set'}>
                            {record.opsIncharge || <span className="text-muted/60 italic font-normal">Not Set</span>}
                        </div>
                    </div>

                    {/* HR Incharge */}
                    <div className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl bg-white dark:bg-[#0c2e1f] border border-border/40 shadow-xs hover:border-purple-500/30 transition-all">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted uppercase tracking-tight mb-1.5">
                            <ClipboardList className="w-3.5 h-3.5 text-purple-500" />
                            <span>HR Incharge</span>
                        </div>
                        <div className="text-sm font-black text-primary-text truncate w-full text-center" title={record.hrIncharge || 'Not Set'}>
                            {record.hrIncharge || <span className="text-muted/60 italic font-normal">Not Set</span>}
                        </div>
                    </div>

                    {/* Invoice Incharge */}
                    <div className="flex flex-col items-center justify-center text-center p-3.5 rounded-xl bg-white dark:bg-[#0c2e1f] border border-border/40 shadow-xs hover:border-indigo-500/30 transition-all col-span-2 sm:col-span-1">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted uppercase tracking-tight mb-1.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Invoice Incharge</span>
                        </div>
                        <div className="text-sm font-black text-primary-text truncate w-full text-center" title={record.invoiceIncharge || 'Not Set'}>
                            {record.invoiceIncharge || <span className="text-muted/60 italic font-normal">Not Set</span>}
                        </div>
                    </div>
                </div>

                {/* Optional Admin Override Drawer */}
                {permissions.canEditMetadata && showAdminOverride && (
                    <div className="p-5 rounded-2xl bg-amber-500/5 border-2 border-amber-500/30 mb-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                            <Info className="w-4 h-4" />
                            Admin Override Mode: Modifying these fields overrides the default Site Responsibility Matrix mapping for this specific record.
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Input
                                id="companyName"
                                name="companyName"
                                label="Company Name"
                                placeholder="e.g. PIFS, SWLLP, PPFMS"
                                value={record.companyName || ''}
                                onChange={(e) => handleInputChange('companyName', e.target.value)}
                                className={inputClass}
                            />
                            <div className="space-y-1 group">
                                <label htmlFor="billingCycle" className={labelClass}>Billing Cycle</label>
                                <select
                                    id="billingCycle"
                                    name="billingCycle"
                                    className={selectClass}
                                    value={record.billingCycle || ''}
                                    onChange={(e) => handleInputChange('billingCycle', e.target.value)}
                                >
                                    <option value="">Select cycle...</option>
                                    {BILLING_CYCLES.map(cycle => (
                                        <option key={cycle} value={cycle}>{cycle}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1 group">
                                <SearchableSelect
                                    label="Ops Incharge"
                                    placeholder="Select or type name..."
                                    options={opsInchargeOptions.map(name => ({ id: name, name }))}
                                    value={record.opsIncharge || ''}
                                    onChange={(val) => handleInputChange('opsIncharge', val)}
                                    allowCustom
                                />
                            </div>
                            <div className="space-y-1 group">
                                <SearchableSelect
                                    label="HR Incharge"
                                    placeholder="Select or type name..."
                                    options={hrInchargeOptions.map(name => ({ id: name, name }))}
                                    value={record.hrIncharge || ''}
                                    onChange={(val) => handleInputChange('hrIncharge', val)}
                                    allowCustom
                                />
                            </div>
                            <div className="space-y-1 group">
                                <SearchableSelect
                                    label="Invoice Incharge"
                                    placeholder="Select or type name..."
                                    options={invoiceInchargeOptions.map(name => ({ id: name, name }))}
                                    value={record.invoiceIncharge || ''}
                                    onChange={(val) => handleInputChange('invoiceIncharge', val)}
                                    allowCustom
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Role-Aware Remarks Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <Input
                        id="opsRemarks"
                        name="opsRemarks"
                        label="Ops Remarks (Operations)"
                        placeholder="Operational notes..."
                        value={record.opsRemarks || ''}
                        onChange={(e) => handleInputChange('opsRemarks', e.target.value)}
                        disabled={!permissions.canEditOpsRemarks}
                        className={inputClass}
                    />
                    <Input
                        id="hrRemarks"
                        name="hrRemarks"
                        label="HR Remarks (HR Team)"
                        placeholder="HR notes..."
                        value={record.hrRemarks || ''}
                        onChange={(e) => handleInputChange('hrRemarks', e.target.value)}
                        disabled={!permissions.canEditHrRemarks}
                        className={inputClass}
                    />
                    <Input
                        id="financeRemarks"
                        name="financeRemarks"
                        label="Finance Remarks (Accounts)"
                        placeholder="Finance notes..."
                        value={record.financeRemarks || ''}
                        onChange={(e) => handleInputChange('financeRemarks', e.target.value)}
                        disabled={!permissions.canEditFinanceRemarks}
                        className={inputClass}
                    />
                </div>
            </div>

            {/* Attendance Sections (HR & Managers) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Manager Status Section */}
                <div className={`${sectionContainerClass} border-l-4 border-l-yellow-400 ${!permissions.canEditAttendance ? 'opacity-90 bg-gray-50/50 dark:bg-black/20' : ''}`}>
                    <SectionHeader 
                        icon={Users} 
                        title="Attendance Status (Managers)" 
                        textColor="text-yellow-700 dark:text-yellow-400" 
                        isLocked={!permissions.canEditAttendance}
                        lockedMessage="HR / Ops Managed"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Input
                            id="managerTentativeDate"
                            name="managerTentativeDate"
                            label="Tentative Submission Date"
                            type="date"
                            value={record.managerTentativeDate || ''}
                            onChange={(e) => handleInputChange('managerTentativeDate', e.target.value)}
                            disabled={!permissions.canEditAttendance}
                            className={inputClass}
                        />
                        <Input
                            id="managerReceivedDate"
                            name="managerReceivedDate"
                            label="Attendance Received Date"
                            type="date"
                            value={record.managerReceivedDate || ''}
                            onChange={(e) => handleInputChange('managerReceivedDate', e.target.value)}
                            disabled={!permissions.canEditAttendance}
                            className={inputClass}
                        />
                    </div>
                </div>

                {/* HR Status Section */}
                <div className={`${sectionContainerClass} border-l-4 border-l-blue-400 ${!permissions.canEditAttendance ? 'opacity-90 bg-gray-50/50 dark:bg-black/20' : ''}`}>
                    <SectionHeader 
                        icon={ClipboardList} 
                        title="Attendance Status (HR)" 
                        textColor="text-blue-700 dark:text-blue-400" 
                        isLocked={!permissions.canEditAttendance}
                        lockedMessage="HR Managed"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Input
                            id="hrTentativeDate"
                            name="hrTentativeDate"
                            label="Tentative Submission Date"
                            type="date"
                            value={record.hrTentativeDate || ''}
                            onChange={(e) => handleInputChange('hrTentativeDate', e.target.value)}
                            disabled={!permissions.canEditAttendance}
                            className={inputClass}
                        />
                        <Input
                            id="hrReceivedDate"
                            name="hrReceivedDate"
                            label="Received from HR Date"
                            type="date"
                            value={record.hrReceivedDate || ''}
                            onChange={(e) => handleInputChange('hrReceivedDate', e.target.value)}
                            disabled={!permissions.canEditAttendance}
                            className={inputClass}
                        />
                        <div className="sm:col-span-2">
                            <Input
                                id="attendanceReceivedTime"
                                name="attendanceReceivedTime"
                                label="Attendance Received Time"
                                placeholder="e.g. 5:00 AM"
                                value={record.attendanceReceivedTime || ''}
                                onChange={(e) => handleInputChange('attendanceReceivedTime', e.target.value)}
                                disabled={!permissions.canEditAttendance}
                                icon={<Clock className="h-4 w-4" />}
                                className={inputClass}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Invoice Status Section (Finance Domain) */}
            <div className={`${sectionContainerClass} border-t-4 border-t-green-500 ${!permissions.canEditInvoice ? 'opacity-90 bg-gray-50/50 dark:bg-black/20' : ''}`}>
                <SectionHeader 
                    icon={FileText} 
                    title="Invoice Status (Finance)" 
                    textColor="text-green-700 dark:text-green-400" 
                    isLocked={!permissions.canEditInvoice}
                    lockedMessage="Finance Managed"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Input
                        id="invoiceSharingTentativeDate"
                        name="invoiceSharingTentativeDate"
                        label="Tentative Sharing Date"
                        type="date"
                        value={record.invoiceSharingTentativeDate || ''}
                        onChange={(e) => handleInputChange('invoiceSharingTentativeDate', e.target.value)}
                        disabled={!permissions.canEditInvoice}
                        className={inputClass}
                    />
                    <Input
                        id="invoicePreparedDate"
                        name="invoicePreparedDate"
                        label="Invoice Prepared Date"
                        type="date"
                        value={record.invoicePreparedDate || ''}
                        onChange={(e) => handleInputChange('invoicePreparedDate', e.target.value)}
                        disabled={!permissions.canEditInvoice}
                        className={inputClass}
                    />
                    <Input
                        id="invoiceSentDate"
                        name="invoiceSentDate"
                        label="Invoice Sent Date"
                        type="date"
                        value={record.invoiceSentDate || ''}
                        onChange={(e) => handleInputChange('invoiceSentDate', e.target.value)}
                        disabled={!permissions.canEditInvoice}
                        className={inputClass}
                    />
                    <Input
                        id="invoiceSentTime"
                        name="invoiceSentTime"
                        label="Sent Timing"
                        placeholder="e.g. 12:35 PM"
                        value={record.invoiceSentTime || ''}
                        onChange={(e) => handleInputChange('invoiceSentTime', e.target.value)}
                        disabled={!permissions.canEditInvoice}
                        icon={<Clock className="h-4 w-4" />}
                        className={inputClass}
                    />
                </div>
            </div>

            {!isMobile && (
                <div className="flex justify-end space-x-4 pt-8 border-t border-border">
                    <Button type="button" variant="secondary" onClick={() => navigate('/finance?tab=attendance')} className="px-6 rounded-xl border-2">
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isSaving} className="px-10 rounded-xl shadow-lg shadow-primary/20">
                        <Save className="h-4 w-4 mr-2" />
                        {isEditing ? 'Update Entry' : 'Create Entry'}
                    </Button>
                </div>
            )}
        </form>
    );

    if (isMobile) {
        return (
            <div className="min-h-screen bg-[#041b0f] pb-20">
                <header 
                    className="fixed top-0 left-0 right-0 z-50 bg-[#041b0f] border-b border-[#1f3d2b] p-4 flex items-center gap-4"
                    style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
                >
                    <button onClick={() => navigate('/finance?tab=attendance')} className="p-2 hover:bg-white/5 rounded-full text-white">
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white tracking-tight">{isEditing ? 'Edit Entry' : 'New Entry'}</h1>
                </header>

                <main className="p-4" style={{ paddingTop: 'calc(5rem + env(safe-area-inset-top))' }}>
                    {FormContent}
                </main>

                <footer className="fixed bottom-0 left-0 right-0 p-4 bg-[#041b0f] border-t border-[#1f3d2b] flex gap-4 z-[60]">
                    <Button type="button" variant="secondary" onClick={() => navigate('/finance?tab=attendance')} className="flex-1 rounded-xl border border-[#1f3d2b] text-white hover:bg-white/5">
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} isLoading={isSaving} className="flex-1 rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20">
                        {isEditing ? 'Update' : 'Create'}
                    </Button>
                </footer>
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            </div>
        );
    }

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="p-6 lg:p-10">
            <button 
                onClick={() => navigate('/finance?tab=attendance')}
                className="flex items-center text-sm font-bold text-muted hover:text-primary transition-all mb-8 group"
            >
                <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Finance
            </button>

            <div className="flex items-start mb-8">
                <div>
                    <h2 className="text-3xl font-black text-primary-text tracking-tight leading-tight">{isEditing ? 'Edit Tracker Record' : 'Create Tracker Record'}</h2>
                    <p className="text-muted text-lg">Input attendance and invoicing status for site monitoring.</p>
                </div>
            </div>

            {FormContent}
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default AddSiteAttendanceRecord;

