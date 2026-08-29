import React, { useState, useEffect, useMemo } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { useEnrollmentRulesStore, defaultDesignationRules } from '../../store/enrollmentRulesStore';
import type { EnrollmentRules, DocumentRules, VerificationRules, SiteStaffDesignation } from '../../types';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Checkbox from '../../components/ui/Checkbox';
import Toast from '../../components/ui/Toast';
import { 
    Save, 
    IndianRupee, 
    Users, 
    Edit, 
    FileText, 
    CheckCircle2, 
    ShieldAlert, 
    Copy, 
    FileCheck2, 
    ShieldCheck, 
    Building2, 
    PenTool, 
    Sparkles, 
    RotateCcw,
    Layers,
    UserSquare2,
    CreditCard,
    Briefcase,
    GraduationCap,
    HeartHandshake,
    Camera,
    Info,
    Check,
    ChevronDown,
    Search
} from 'lucide-react';
import { api } from '../../services/api';

import { useSettingsStore } from '../../store/settingsStore';

type TabType = 'documents' | 'verifications' | 'statutory' | 'family' | 'site' | 'attestation';
type StaffCategory = 'all' | 'office' | 'field' | 'site';

// Default standard lists matching Attendance Settings (Image 1)
const DEFAULT_CATEGORY_ROLES: Record<'office' | 'field' | 'site', string[]> = {
    office: [
        'Admin', 'Hr', 'Finance', 'Developer', 'Hr Ops', 'Finance Manager', 
        'Security Guard', 'Pantry Boy', 'Receptionist', 'Executive', 'Management', 'Accountant'
    ],
    field: [
        'Field Staff', 'Field Officer', 'Operation Manager', 'Bd', 
        'Technical Manager', 'Technical Reliever', 'Business Developer'
    ],
    site: [
        'Site Manager', 'Security Guard', 'Supervisor', 'Electrical Supervisor', 
        'Electrician', 'Lift Technician', 'Plumber', 'Hvac Technician', 
        'Housekeeping', 'Head Guard', 'Gunman', 'Lady Guard', 
        'Facility Executive', 'Multi-Technician', 'DG Operator'
    ]
};

const documentRuleConfig: { key: keyof DocumentRules; label: string; description: string; icon: any; category: string }[] = [
    { key: 'photo', label: 'Candidate Profile Photo', description: 'Live camera capture or uploaded passport photo of candidate', icon: Camera, category: 'Identity' },
    { key: 'aadhaar', label: 'Aadhaar Card (Front & Back)', description: 'Government Aadhaar identity document with address proof', icon: UserSquare2, category: 'Identity' },
    { key: 'bankProof', label: 'Bank Proof (Passbook / Cheque)', description: 'Passbook front page or cancelled cheque for salary disbursement', icon: CreditCard, category: 'Financial' },
    { key: 'pan', label: 'PAN Card Copy', description: 'Mandatory Income Tax PAN card copy for statutory TDS / Form 16', icon: FileCheck2, category: 'Financial' },
    { key: 'uanProof', label: 'UAN Proof Document', description: 'EPFO Universal Account Number card or member passbook', icon: Briefcase, category: 'Statutory' },
    { key: 'salarySlip', label: 'Latest Salary Slip', description: 'Previous employment salary slip for CTC and experience verification', icon: IndianRupee, category: 'Statutory' },
    { key: 'educationCertificate', label: 'Education Certificate', description: 'Highest degree, diploma, or 10th/12th passing certificate', icon: GraduationCap, category: 'Academic' },
    { key: 'familyAadhaar', label: 'Family Member Proofs', description: 'Aadhaar cards for all declared nominees and statutory dependents', icon: HeartHandshake, category: 'Nominees' },
];

const verificationRuleConfig: { key: keyof VerificationRules; label: string; description: string; tag: string }[] = [
    { key: 'requireBengaluruAddress', label: 'Require Bengaluru Address Verification', description: 'Verify candidate residential address falls within local operational bounds', tag: 'Geographic' },
    { key: 'requireDobVerification', label: 'Require Strict DOB & Age Validation (>18 Years)', description: 'Enforce statutory minimum working age verification against uploaded Aadhaar / ID proof', tag: 'Compliance' },
    { key: 'requireBankNameMatch', label: 'Require Exact Bank Account Name Matching (Penny Drop)', description: 'Ensure name on bank passbook strictly matches candidate name on Aadhaar card', tag: 'Financial' },
    { key: 'requireUanVerification', label: 'Require UAN Lookup & PF Dual-Enrollment Check', description: 'Perform automated EPFO verification before proceeding with fresh PF generation', tag: 'Statutory' },
];

const EnrollmentRules: React.FC = () => {
    const store = useEnrollmentRulesStore();
    const { attendance } = useSettingsStore();
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
    const [allAppRoles, setAllAppRoles] = useState<{ id: string; displayName: string }[]>([]);
    const [designations, setDesignations] = useState<SiteStaffDesignation[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<StaffCategory>('site');
    const [selectedDesignations, setSelectedDesignations] = useState<string[]>(['SECURITY GUARD']);
    const [activeTab, setActiveTab] = useState<TabType>('documents');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [dropdownSearch, setDropdownSearch] = useState('');
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Primary active designation for watching rules & fallback
    const primaryDesignation = useMemo(() => {
        return selectedDesignations[0] || 'Default (All Roles)';
    }, [selectedDesignations]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        Promise.all([
            api.getRoles().catch(() => []),
            api.getSiteStaffDesignations().catch(() => [])
        ]).then(([roles, siteDesignations]) => {
            setAllAppRoles(roles);
            const uniqueDesignations = [...new Set(siteDesignations.map(d => d.designation))].filter(Boolean);
            if (!uniqueDesignations.includes('Administrator')) {
                uniqueDesignations.unshift('Administrator');
            }
            if (!uniqueDesignations.includes('Default (All Roles)')) {
                uniqueDesignations.unshift('Default (All Roles)');
            }
            setDesignations(uniqueDesignations.map((d, i) => ({ id: `${i}`, designation: d, department: '', permanentId: '', temporaryId: '' })));
        });
    }, []);

    const { register, handleSubmit, control, formState: { isDirty }, watch, reset, setValue, getValues } = useForm<EnrollmentRules>({
        defaultValues: store,
    });

    useEffect(() => {
        reset(store);
    }, [store, reset]);

    // Ensure form is initialized when switching designations
    useEffect(() => {
        selectedDesignations.forEach(desig => {
            const rulesForDesignation = store.rulesByDesignation?.[desig];
            if (!rulesForDesignation) {
                const fallback = store.rulesByDesignation?.['Default (All Roles)'] || defaultDesignationRules;
                documentRuleConfig.forEach(item => {
                    const val = fallback.documents[item.key] ?? false;
                    setValue(`rulesByDesignation.${desig}.documents.${item.key}`, val, { shouldDirty: true });
                });
                verificationRuleConfig.forEach(item => {
                    const val = fallback.verifications[item.key] ?? false;
                    setValue(`rulesByDesignation.${desig}.verifications.${item.key}`, val, { shouldDirty: true });
                });
            }
        });
    }, [selectedDesignations, store.rulesByDesignation, setValue]);

    const isEnforceLimitEnabled = watch('enforceManpowerLimit');
    const isEsiRuleEnabled = watch('enableEsiRule');
    const isGmcRuleEnabled = watch('enableGmcRule');
    const currentEsiThreshold = watch('esiCtcThreshold');
    const currentManpowerRule = watch('manpowerLimitRule');

    // Dynamic Category Role Mapping derived from attendance settings + fallbacks
    const categoryRoleNames = useMemo(() => {
        const mapping = attendance?.missedCheckoutConfig?.roleMapping;
        const result: Record<'office' | 'field' | 'site', string[]> = {
            office: [...DEFAULT_CATEGORY_ROLES.office],
            field: [...DEFAULT_CATEGORY_ROLES.field],
            site: [...DEFAULT_CATEGORY_ROLES.site]
        };

        if (mapping) {
            (['office', 'field', 'site'] as const).forEach(cat => {
                if (mapping[cat] && mapping[cat].length > 0) {
                    const resolved = mapping[cat].map(roleId => {
                        const matched = allAppRoles.find(r => r.id === roleId);
                        if (matched?.displayName) return matched.displayName;
                        return roleId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                    });
                    if (resolved.length > 0) {
                        result[cat] = [...new Set([...resolved, ...DEFAULT_CATEGORY_ROLES[cat]])];
                    }
                }
            });
        }

        return result;
    }, [attendance?.missedCheckoutConfig?.roleMapping, allAppRoles]);

    // Filter designations by selected category
    const filteredDesignations = useMemo(() => {
        if (selectedCategory === 'all') return designations;
        const validNames = categoryRoleNames[selectedCategory].map(n => n.toLowerCase());
        const list = designations.filter(d => 
            d.designation === 'Default (All Roles)' || 
            validNames.some(v => d.designation.toLowerCase().includes(v) || v.includes(d.designation.toLowerCase()))
        );
        // Include any roles from category that aren't in designations yet
        const existingNames = new Set(list.map(d => d.designation.toLowerCase()));
        categoryRoleNames[selectedCategory].forEach((roleName, idx) => {
            if (!existingNames.has(roleName.toLowerCase())) {
                list.push({ id: `cat-${idx}`, designation: roleName, department: '', permanentId: '', temporaryId: '' });
                existingNames.add(roleName.toLowerCase());
            }
        });

        return list;
    }, [designations, selectedCategory, categoryRoleNames]);

    // Filtered by dropdown search
    const searchedDesignations = useMemo(() => {
        if (!dropdownSearch.trim()) return filteredDesignations;
        const q = dropdownSearch.toLowerCase();
        return filteredDesignations.filter(d => d.designation.toLowerCase().includes(q));
    }, [filteredDesignations, dropdownSearch]);

    // Toggle single role in/out of multi-selection
    const handleToggleRoleSelection = (roleName: string) => {
        setSelectedDesignations(prev => {
            const exists = prev.some(r => r.toLowerCase() === roleName.toLowerCase());
            if (exists) {
                if (prev.length === 1) return prev; // Keep at least one selected
                return prev.filter(r => r.toLowerCase() !== roleName.toLowerCase());
            } else {
                return [...prev, roleName];
            }
        });
    };

    // Select All in current category
    const handleSelectAllCategoryRoles = () => {
        const allNames = filteredDesignations.map(d => d.designation);
        setSelectedDesignations(allNames);
        setToast({ message: `Selected all ${allNames.length} roles in ${selectedCategory.toUpperCase()}!`, type: 'info' });
    };

    // Deselect All / Keep primary
    const handleClearAllSelections = () => {
        const first = filteredDesignations[0]?.designation || 'Default (All Roles)';
        setSelectedDesignations([first]);
    };

    // Current watched rules for KPI metrics based on primary designation
    const currentWatchedDocs = watch(`rulesByDesignation.${primaryDesignation}.documents`);
    const currentWatchedVerifs = watch(`rulesByDesignation.${primaryDesignation}.verifications`);

    const mandatoryDocsCount = useMemo(() => {
        if (!currentWatchedDocs) return 0;
        return Object.values(currentWatchedDocs).filter(Boolean).length;
    }, [currentWatchedDocs]);

    const activeVerifsCount = useMemo(() => {
        if (!currentWatchedVerifs) return 0;
        return Object.values(currentWatchedVerifs).filter(Boolean).length;
    }, [currentWatchedVerifs]);

    // Batch update helper for documents across all selected designations
    const handleBatchDocumentToggle = (docKey: keyof DocumentRules, isMandatory: boolean) => {
        selectedDesignations.forEach(desig => {
            setValue(`rulesByDesignation.${desig}.documents.${docKey}`, isMandatory, { shouldDirty: true });
        });
    };

    // Batch update helper for verifications across all selected designations
    const handleBatchVerificationToggle = (verifKey: keyof VerificationRules, isEnabled: boolean) => {
        selectedDesignations.forEach(desig => {
            setValue(`rulesByDesignation.${desig}.verifications.${verifKey}`, isEnabled, { shouldDirty: true });
        });
    };

    // Quick Actions
    const handleCopyRulesToAll = () => {
        const currentRules = getValues(`rulesByDesignation.${primaryDesignation}`) || defaultDesignationRules;
        designations.forEach(d => {
            setValue(`rulesByDesignation.${d.designation}.documents`, { ...currentRules.documents }, { shouldDirty: true });
            setValue(`rulesByDesignation.${d.designation}.verifications`, { ...currentRules.verifications }, { shouldDirty: true });
        });
        setToast({ message: `Applied "${primaryDesignation}" configuration across all ${designations.length} designations! Click 'Save Rules' to persist.`, type: 'success' });
    };

    const handleApplyPreset = (category: StaffCategory) => {
        setSelectedCategory(category);
        selectedDesignations.forEach(desig => {
            if (category === 'site') {
                setValue(`rulesByDesignation.${desig}.documents`, {
                    photo: true,
                    aadhaar: true,
                    bankProof: true,
                    pan: false,
                    uanProof: false,
                    salarySlip: false,
                    educationCertificate: false,
                    familyAadhaar: false,
                }, { shouldDirty: true });
                setValue(`rulesByDesignation.${desig}.verifications`, {
                    requireBengaluruAddress: false,
                    requireDobVerification: true,
                    requireBankNameMatch: true,
                    requireUanVerification: false,
                }, { shouldDirty: true });
            } else if (category === 'office') {
                setValue(`rulesByDesignation.${desig}.documents`, {
                    photo: true,
                    aadhaar: true,
                    bankProof: true,
                    pan: true,
                    uanProof: true,
                    salarySlip: true,
                    educationCertificate: true,
                    familyAadhaar: true,
                }, { shouldDirty: true });
                setValue(`rulesByDesignation.${desig}.verifications`, {
                    requireBengaluruAddress: false,
                    requireDobVerification: true,
                    requireBankNameMatch: true,
                    requireUanVerification: true,
                }, { shouldDirty: true });
            } else if (category === 'field') {
                setValue(`rulesByDesignation.${desig}.documents`, {
                    photo: true,
                    aadhaar: true,
                    bankProof: true,
                    pan: true,
                    uanProof: false,
                    salarySlip: false,
                    educationCertificate: false,
                    familyAadhaar: false,
                }, { shouldDirty: true });
                setValue(`rulesByDesignation.${desig}.verifications`, {
                    requireBengaluruAddress: true,
                    requireDobVerification: true,
                    requireBankNameMatch: true,
                    requireUanVerification: false,
                }, { shouldDirty: true });
            }
        });

        if (category === 'site') {
            setValue('enableEsiRule', true, { shouldDirty: true });
            setValue('esiCtcThreshold', 21000, { shouldDirty: true });
            setValue('enforceManpowerLimit', true, { shouldDirty: true });
            setValue('manpowerLimitRule', 'warn', { shouldDirty: true });
            setValue('enforceFamilyValidation', true, { shouldDirty: true });
            setToast({ message: `Applied "Site Staff" preset to ${selectedDesignations.length} selected role(s)!`, type: 'info' });
        } else if (category === 'office') {
            setValue('enableEsiRule', false, { shouldDirty: true });
            setValue('enableGmcRule', true, { shouldDirty: true });
            setValue('salaryThreshold', 21000, { shouldDirty: true });
            setToast({ message: `Applied "Office Staff" preset to ${selectedDesignations.length} selected role(s)!`, type: 'info' });
        } else if (category === 'field') {
            setValue('enableEsiRule', true, { shouldDirty: true });
            setValue('esiCtcThreshold', 21000, { shouldDirty: true });
            setValue('allowSalaryEdit', true, { shouldDirty: true });
            setToast({ message: `Applied "Field Staff" preset to ${selectedDesignations.length} selected role(s)!`, type: 'info' });
        }
    };

    const handleSelectAllDocuments = (mandatory: boolean) => {
        selectedDesignations.forEach(desig => {
            documentRuleConfig.forEach(item => {
                setValue(`rulesByDesignation.${desig}.documents.${item.key}`, mandatory, { shouldDirty: true });
            });
        });
        setToast({ message: mandatory ? `All documents marked Mandatory for ${selectedDesignations.length} role(s).` : `All documents marked Optional for ${selectedDesignations.length} role(s).`, type: 'info' });
    };

    const onSubmit: SubmitHandler<EnrollmentRules> = (data) => {
        store.updateRules(data);
        setToast({ message: 'Enrollment & Onboarding rules saved successfully! Settings are now active across all enrollment forms.', type: 'success' });
        reset(data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 md:p-6 lg:p-8 space-y-6 w-full animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Page Header */}
            <AdminPageHeader title="Onboarding Configuration & Policy Center">
                <div className="flex items-center gap-3 flex-wrap">
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCopyRulesToAll} 
                        title="Propagate selected role rules to all designations"
                        className="text-xs"
                    >
                        <Copy className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Apply to All Roles
                    </Button>
                    <Button 
                        type="button" 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => handleApplyPreset(selectedCategory)}
                        className="text-xs"
                    >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> Reset Category Preset
                    </Button>
                    <Button 
                        type="submit" 
                        disabled={!isDirty} 
                        variant="primary"
                        className="relative !px-5"
                    >
                        {isDirty && <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white animate-pulse" />}
                        <Save className="mr-2 h-4 w-4" /> Save Rules
                    </Button>
                </div>
            </AdminPageHeader>

            {/* 1. STAFF CATEGORY SELECTOR (Office / Field / Site) */}
            <div className="bg-card p-4 md:p-5 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-primary-text uppercase tracking-wider">Select Staff Category</h3>
                        <p className="text-xs text-muted">Configured across the 3 official organizational staff categories</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {[
                        { id: 'site', label: 'Site Staff', count: 15, icon: Building2, color: 'text-emerald-600 dark:text-emerald-400' },
                        { id: 'field', label: 'Field Staff', count: 7, icon: Briefcase, color: 'text-blue-600 dark:text-blue-400' },
                        { id: 'office', label: 'Office Staff', count: 12, icon: UserSquare2, color: 'text-purple-600 dark:text-purple-400' },
                        { id: 'all', label: 'All Categories', count: designations.length, icon: Sparkles, color: 'text-amber-600 dark:text-amber-400' },
                    ].map(cat => {
                        const Icon = cat.icon;
                        const isSelected = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                    setSelectedCategory(cat.id as StaffCategory);
                                    const defaultRole = cat.id !== 'all' ? (categoryRoleNames[cat.id as StaffCategory]?.[0] || 'Default (All Roles)') : 'Default (All Roles)';
                                    setSelectedDesignations([defaultRole]);
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                                    isSelected
                                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 scale-105'
                                        : 'bg-page hover:bg-page/80 text-primary-text border border-border'
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : cat.color}`} />
                                <span>{cat.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-card text-muted border border-border'
                                }`}>
                                    {cat.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. ROLE SWITCHER & LIVE INTERACTIVE KPI CARDS */}
            <div className="bg-card p-6 md:p-8 rounded-2xl border border-border shadow-sm relative">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/40">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Designation Policy Setup
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-primary-text">
                            Configuring: {selectedDesignations.length === 1 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{selectedDesignations[0]}</span>
                            ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                                    {selectedDesignations.length} Roles Selected ({selectedCategory.toUpperCase()})
                                </span>
                            )}
                        </h2>
                        <p className="text-xs md:text-sm text-muted max-w-2xl">
                            {selectedDesignations.length > 1 
                                ? `⚡ Multi-Role Batch Mode: Changes will be applied across all ${selectedDesignations.length} selected designations simultaneously.`
                                : `Rules defined here determine which fields and documents are required on Pre-Upload for ${primaryDesignation}.`
                            }
                        </p>
                    </div>

                    {/* Multi-Select Checkbox Role Dropdown */}
                    <div className="relative w-full lg:w-84" ref={dropdownRef}>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                                Select Roles ({selectedCategory.toUpperCase()})
                            </label>
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                                {selectedDesignations.length} Selected
                            </span>
                        </div>

                        {/* Trigger Button */}
                        <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="w-full bg-card text-primary-text font-semibold text-sm rounded-xl px-3.5 py-2.5 border border-border hover:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500 focus:outline-none flex items-center justify-between shadow-sm cursor-pointer"
                        >
                            <div className="flex items-center gap-1.5 truncate max-w-[230px]">
                                {selectedDesignations.length === 1 ? (
                                    <span className="truncate text-primary-text">{selectedDesignations[0]}</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold truncate">
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {selectedDesignations.length} Roles Selected
                                    </span>
                                )}
                            </div>
                            <ChevronDown className={`w-4 h-4 text-muted transition-transform shrink-0 ${isDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`} />
                        </button>

                        {/* Dropdown Menu with Search & Checkboxes */}
                        {isDropdownOpen && (
                            <div className="absolute right-0 top-full mt-2 w-full min-w-[320px] max-w-md bg-card border border-border rounded-2xl shadow-2xl z-50 p-3 space-y-2.5 animate-fade-in">
                                {/* Search Filter */}
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                                    <input
                                        type="text"
                                        placeholder="Search roles..."
                                        value={dropdownSearch}
                                        onChange={e => setDropdownSearch(e.target.value)}
                                        className="w-full bg-page text-primary-text text-xs rounded-lg pl-8 pr-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        autoFocus
                                    />
                                </div>

                                {/* Quick Selection Actions */}
                                <div className="flex items-center justify-between pt-1 pb-1 border-b border-border/60 text-[11px] font-bold">
                                    <button
                                        type="button"
                                        onClick={handleSelectAllCategoryRoles}
                                        className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 cursor-pointer"
                                    >
                                        <Check className="w-3 h-3" /> Select All ({searchedDesignations.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClearAllSelections}
                                        className="text-muted hover:text-rose-500 cursor-pointer"
                                    >
                                        Clear Selection
                                    </button>
                                </div>

                                {/* Scrollable Checkbox List */}
                                <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                    {searchedDesignations.map(d => {
                                        const isChecked = selectedDesignations.some(r => r.toLowerCase() === d.designation.toLowerCase());
                                        return (
                                            <div
                                                key={d.id}
                                                onClick={() => handleToggleRoleSelection(d.designation)}
                                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                                                    isChecked
                                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                                                        : 'hover:bg-page text-primary-text'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                                                        isChecked
                                                            ? 'bg-emerald-600 border-emerald-600 text-white'
                                                            : 'border-border bg-page'
                                                    }`}>
                                                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                                    </div>
                                                    <span className="text-xs truncate">{d.designation}</span>
                                                </div>
                                                {isChecked && (
                                                    <span className="text-[10px] uppercase font-bold text-emerald-600 shrink-0">Selected</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {searchedDesignations.length === 0 && (
                                        <p className="text-xs text-muted text-center py-4">No matching roles found.</p>
                                    )}
                                </div>

                                {/* Bottom Done Bar */}
                                <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                                    <span className="text-muted text-[11px] font-medium">{selectedDesignations.length} of {filteredDesignations.length} selected</span>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="text-xs !py-1 !px-3"
                                    >
                                        Done
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Dynamic Category Role Checkbox Chips */}
                <div className="mt-5 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-muted mr-1 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" /> Toggle Roles ({selectedCategory === 'all' ? 'ALL' : selectedCategory.toUpperCase()}):
                    </span>
                    {(selectedCategory === 'all' 
                        ? ['Default (All Roles)', ...categoryRoleNames.site.slice(0, 6), ...categoryRoleNames.field.slice(0, 4), ...categoryRoleNames.office.slice(0, 4)]
                        : categoryRoleNames[selectedCategory]
                    ).map(role => {
                        const isChecked = selectedDesignations.some(r => r.toLowerCase() === role.toLowerCase());
                        return (
                            <button
                                key={role}
                                type="button"
                                onClick={() => handleToggleRoleSelection(role)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    isChecked
                                        ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20 scale-105'
                                        : 'bg-page hover:bg-page/80 text-primary-text border border-border'
                                }`}
                            >
                                <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                                    isChecked ? 'bg-white text-emerald-700 border-white font-bold' : 'border-border bg-card'
                                }`}>
                                    {isChecked && '✓'}
                                </span>
                                {role}
                            </button>
                        );
                    })}
                </div>

                {/* KPI Metrics Strip - Interactive with Direct Edit & Navigation */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 1. Mandatory Docs Card */}
                    <div 
                        onClick={() => setActiveTab('documents')}
                        className="p-3.5 rounded-xl bg-page/60 border border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer group"
                        title="Click to configure required documents"
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-muted uppercase tracking-wider">Mandatory Docs</p>
                            <span className="text-[10px] text-emerald-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Edit &rarr;</span>
                        </div>
                        <p className="text-xl font-extrabold text-primary-text mt-0.5">{mandatoryDocsCount} <span className="text-xs text-muted font-normal">/ 8 Required</span></p>
                    </div>

                    {/* 2. Verifications Card */}
                    <div 
                        onClick={() => setActiveTab('verifications')}
                        className="p-3.5 rounded-xl bg-page/60 border border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer group"
                        title="Click to configure data & age verifications"
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-muted uppercase tracking-wider">Verifications</p>
                            <span className="text-[10px] text-emerald-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Edit &rarr;</span>
                        </div>
                        <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{activeVerifsCount} Active</p>
                    </div>

                    {/* 3. ESI Threshold Card (Direct Interactive Control) */}
                    <div 
                        className="p-3.5 rounded-xl bg-page/60 border border-border/80 hover:border-emerald-500/50 transition-all flex flex-col justify-between"
                    >
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-bold text-muted uppercase tracking-wider">ESI Threshold</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setValue('enableEsiRule', !isEsiRuleEnabled, { shouldDirty: true });
                                    setToast({ message: isEsiRuleEnabled ? 'ESI Rule Disabled' : 'ESI Rule Enabled (Ceiling: ₹21,000)', type: 'info' });
                                }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                                    isEsiRuleEnabled 
                                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' 
                                        : 'bg-slate-200 text-slate-500 dark:bg-slate-800'
                                }`}
                            >
                                {isEsiRuleEnabled ? 'Active' : 'Disabled'}
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-extrabold text-primary-text">₹</span>
                            <input
                                type="number"
                                value={currentEsiThreshold ?? 21000}
                                onChange={(e) => {
                                    setValue('esiCtcThreshold', parseFloat(e.target.value) || 0, { shouldDirty: true });
                                    if (!isEsiRuleEnabled) setValue('enableEsiRule', true, { shouldDirty: true });
                                }}
                                className="w-24 bg-card text-primary-text font-bold text-base px-2 py-0.5 rounded border border-border focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => setActiveTab('statutory')}
                                className="text-xs text-emerald-600 dark:text-emerald-400 underline ml-auto"
                            >
                                Settings
                            </button>
                        </div>
                    </div>

                    {/* 4. Manpower Rule Card (Direct Interactive 3-way Toggle) */}
                    <div 
                        className="p-3.5 rounded-xl bg-page/60 border border-border/80 hover:border-emerald-500/50 transition-all flex flex-col justify-between"
                    >
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-bold text-muted uppercase tracking-wider">Manpower Rule</p>
                            <button
                                type="button"
                                onClick={() => setActiveTab('site')}
                                className="text-xs text-emerald-600 dark:text-emerald-400 underline"
                            >
                                Rules
                            </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setValue('enforceManpowerLimit', true, { shouldDirty: true });
                                    setValue('manpowerLimitRule', 'warn', { shouldDirty: true });
                                }}
                                className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                                    isEnforceLimitEnabled && currentManpowerRule === 'warn'
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'bg-card text-muted hover:text-primary-text border border-border'
                                }`}
                                title="Warn staff when quota is full but allow submit"
                            >
                                ⚠️ Warn
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setValue('enforceManpowerLimit', true, { shouldDirty: true });
                                    setValue('manpowerLimitRule', 'block', { shouldDirty: true });
                                }}
                                className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                                    isEnforceLimitEnabled && currentManpowerRule === 'block'
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'bg-card text-muted hover:text-primary-text border border-border'
                                }`}
                                title="Block enrollment when site quota is full"
                            >
                                🚫 Block
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setValue('enforceManpowerLimit', false, { shouldDirty: true });
                                }}
                                className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                                    !isEnforceLimitEnabled
                                        ? 'bg-slate-700 text-white shadow-sm'
                                        : 'bg-card text-muted hover:text-primary-text border border-border'
                                }`}
                                title="Disable site manpower limit checks"
                            >
                                Off
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Interactive Section Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border">
                {[
                    { id: 'documents', label: '1. Document Uploads', icon: FileText, count: mandatoryDocsCount },
                    { id: 'verifications', label: '2. Identity & Geo Checks', icon: ShieldCheck, count: activeVerifsCount },
                    { id: 'statutory', label: '3. Statutory & Insurance (PF/ESI/GMC)', icon: IndianRupee },
                    { id: 'family', label: '4. Family & Education', icon: Users },
                    { id: 'site', label: '5. Site & Permissions', icon: Building2 },
                    { id: 'attestation', label: '6. Attestation & Signatures', icon: PenTool },
                ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none ${
                                isActive
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                    : 'bg-card text-muted hover:text-primary-text hover:bg-page border border-border/60'
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                                    isActive ? 'bg-white/20 text-white' : 'bg-page text-muted'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: DOCUMENT UPLOADS */}
            {activeTab === 'documents' && (
                <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-card space-y-6 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
                        <div>
                            <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-500" />
                                Mandatory Document Uploads
                            </h3>
                            <p className="text-xs text-muted mt-0.5">
                                Set which documents candidates must upload during pre-onboarding for <strong className="text-primary-text">
                                    {selectedDesignations.length === 1 ? selectedDesignations[0] : `${selectedDesignations.length} Selected Roles`}
                                </strong>.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => handleSelectAllDocuments(true)} className="text-xs">
                                Mark All Mandatory
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => handleSelectAllDocuments(false)} className="text-xs">
                                Mark All Optional
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {documentRuleConfig.map(item => {
                            const Icon = item.icon;
                            return (
                                <Controller
                                    key={item.key}
                                    name={`rulesByDesignation.${primaryDesignation}.documents.${item.key}`}
                                    control={control}
                                    defaultValue={item.key === 'photo' || item.key === 'aadhaar' || item.key === 'bankProof'}
                                    render={({ field }) => (
                                        <div className={`p-4 rounded-2xl border transition-all ${
                                            field.value
                                                ? 'bg-emerald-500/5 border-emerald-500/30 shadow-sm'
                                                : 'bg-page/40 border-border hover:border-border/80'
                                        }`}>
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3.5 flex-1">
                                                    <div className={`p-2.5 rounded-xl shrink-0 ${
                                                        field.value ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200/50 dark:bg-slate-800 text-slate-400'
                                                    }`}>
                                                        <Icon className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox
                                                                id={`${primaryDesignation}-${item.key}`}
                                                                label={item.label}
                                                                checked={!!field.value}
                                                                onChange={(e) => {
                                                                    field.onChange(e);
                                                                    handleBatchDocumentToggle(item.key, e.target.checked);
                                                                }}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-muted mt-1 leading-relaxed">{item.description}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 select-none ${
                                                    field.value
                                                        ? 'bg-rose-500/10 text-rose-600 border border-rose-500/25 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40'
                                                        : 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10'
                                                }`}>
                                                    {field.value ? '* Mandatory' : 'Optional'}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: VERIFICATION & SCREENING */}
            {activeTab === 'verifications' && (
                <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-card space-y-6 animate-fade-in">
                    <div className="pb-5 border-b border-border">
                        <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                            Data Quality & Statutory Age Verifications
                        </h3>
                        <p className="text-xs text-muted mt-0.5">
                            Automated background verification checkpoints applied during onboarding form parsing.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {verificationRuleConfig.map(item => (
                            <Controller
                                key={item.key}
                                name={`rulesByDesignation.${primaryDesignation}.verifications.${item.key}`}
                                control={control}
                                defaultValue={false}
                                render={({ field }) => (
                                    <div className={`p-4 rounded-2xl border transition-all ${
                                        field.value
                                            ? 'bg-emerald-500/5 border-emerald-500/30'
                                            : 'bg-page/40 border-border'
                                    }`}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                        {item.tag}
                                                    </span>
                                                </div>
                                                <Checkbox
                                                    id={`${primaryDesignation}-${item.key}`}
                                                    label={item.label}
                                                    checked={!!field.value}
                                                    onChange={(e) => {
                                                        field.onChange(e);
                                                        handleBatchVerificationToggle(item.key, e.target.checked);
                                                    }}
                                                />
                                                <p className="text-xs text-muted pt-1">{item.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: STATUTORY & INSURANCE */}
            {activeTab === 'statutory' && (
                <div className="space-y-6 animate-fade-in">
                    {/* ESI Eligibility Rule */}
                    <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-card space-y-4">
                        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <IndianRupee className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-primary-text">ESI Statutory Wage Ceiling</h3>
                                    <p className="text-xs text-muted">Defines gross salary threshold for Employees' State Insurance (ESIC).</p>
                                </div>
                            </div>
                            <Controller 
                                name="enableEsiRule" 
                                control={control} 
                                render={({ field }) => (
                                    <Checkbox id="enableEsiRule" label="Enforce ESI Rule" checked={field.value} onChange={field.onChange} />
                                )} 
                            />
                        </div>
                        <div className={`transition-opacity ${isEsiRuleEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="max-w-md">
                                <Input 
                                    label="ESI Gross Salary Threshold (₹)" 
                                    id="esiCtcThreshold" 
                                    type="number" 
                                    registration={register('esiCtcThreshold', { valueAsNumber: true })} 
                                    disabled={!isEsiRuleEnabled} 
                                />
                                <p className="text-xs text-muted mt-2 flex items-center gap-1.5">
                                    <Info className="w-3.5 h-3.5 text-emerald-500" />
                                    Employees earning ₹{watch('esiCtcThreshold') || 21000} or below per month are covered under ESI. Above this, GMC policy applies.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* GMC Group Medical Insurance Policy */}
                    <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-card space-y-4">
                        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                    <ShieldAlert className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-primary-text">GMC Insurance Cover Rules</h3>
                                    <p className="text-xs text-muted">Default policy sum-insured allocations for non-ESI employees.</p>
                                </div>
                            </div>
                            <Controller 
                                name="enableGmcRule" 
                                control={control} 
                                render={({ field }) => (
                                    <Checkbox id="enableGmcRule" label="Enable GMC Policy" checked={field.value} onChange={field.onChange} />
                                )} 
                            />
                        </div>
                        <div className={`transition-opacity ${isGmcRuleEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                <Input 
                                    label="GMC Minimum Salary Threshold (₹)" 
                                    id="salaryThreshold" 
                                    type="number" 
                                    registration={register('salaryThreshold', { valueAsNumber: true })} 
                                    disabled={!isGmcRuleEnabled} 
                                />
                                <Controller 
                                    name="defaultPolicySingle" 
                                    control={control} 
                                    render={({ field }) => (
                                        <Select label="Default Policy (Single Employee)" {...field} disabled={!isGmcRuleEnabled}>
                                            <option value="1L">1 Lakh Sum Insured</option>
                                            <option value="2L">2 Lakh Sum Insured</option>
                                        </Select>
                                    )} 
                                />
                                <Controller 
                                    name="defaultPolicyMarried" 
                                    control={control} 
                                    render={({ field }) => (
                                        <Select label="Default Policy (Married / Family)" {...field} disabled={!isGmcRuleEnabled}>
                                            <option value="1L">1 Lakh Sum Insured</option>
                                            <option value="2L">2 Lakh Sum Insured</option>
                                        </Select>
                                    )} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: FAMILY & EDUCATION */}
            {activeTab === 'family' && (
                <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-card space-y-6 animate-fade-in">
                    <div className="pb-4 border-b border-border">
                        <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
                            <Users className="w-5 h-5 text-emerald-500" />
                            Family & Education Validation Policy
                        </h3>
                        <p className="text-xs text-muted mt-0.5">
                            Control family nominee requirements and data integrity checks.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-page/40 border border-border">
                            <Controller 
                                name="enforceFamilyValidation" 
                                control={control} 
                                render={({ field }) => (
                                    <Checkbox 
                                        id="enforceFamilyValidation" 
                                        label="Enforce Strict Family Details Validation" 
                                        description="Checks for duplicate Aadhaar numbers, relationship age logic (e.g. parent older than child), and gender consistency." 
                                        checked={field.value ?? false} 
                                        onChange={field.onChange} 
                                    />
                                )} 
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: SITE & MANPOWER */}
            {activeTab === 'site' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-card space-y-4">
                        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <Building2 className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-primary-text">Site Manpower Allocation Limits</h3>
                                    <p className="text-xs text-muted">Prevent over-enrolling beyond the approved manpower count for a site.</p>
                                </div>
                            </div>
                            <Controller 
                                name="enforceManpowerLimit" 
                                control={control} 
                                render={({ field }) => (
                                    <Checkbox id="enforceManpowerLimit" label="Enforce Quota" checked={field.value} onChange={field.onChange} />
                                )} 
                            />
                        </div>
                        <div className={`transition-opacity ${isEnforceLimitEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="max-w-md">
                                <Select 
                                    label="Action When Manpower Limit is Reached" 
                                    id="manpowerLimitRule" 
                                    registration={register('manpowerLimitRule')} 
                                    disabled={!isEnforceLimitEnabled}
                                >
                                    <option value="warn">⚠️ Warn Field Staff but Allow Enrollment</option>
                                    <option value="block">🚫 Block Enrollment (Require Operations Approval)</option>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-card space-y-4">
                        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                    <Edit className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-primary-text">Field Staff Salary Editing Permissions</h3>
                                    <p className="text-xs text-muted">Allow field officers to customize CTC structure during enrollment.</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-page/40 border border-border">
                            <Controller 
                                name="allowSalaryEdit" 
                                control={control} 
                                render={({ field }) => (
                                    <Checkbox 
                                        id="allowSalaryEdit" 
                                        label="Permit Field Staff to Edit Default Salary" 
                                        description="When enabled, any deviation from approved client rate card will trigger a finance approval workflow." 
                                        checked={field.value ?? false} 
                                        onChange={field.onChange} 
                                    />
                                )} 
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 6: ATTESTATION & SIGNATURES */}
            {activeTab === 'attestation' && (
                <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-card space-y-6 animate-fade-in">
                    <div className="pb-4 border-b border-border">
                        <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
                            <PenTool className="w-5 h-5 text-emerald-500" />
                            Digital Signature & Officer Attestation Rules
                        </h3>
                        <p className="text-xs text-muted mt-0.5">
                            Controls the final review and legal sign-off flow before database submission.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-page/40 border border-border">
                            <Controller 
                                name="requireDigitalSignature" 
                                control={control} 
                                defaultValue={true}
                                render={({ field }) => (
                                    <Checkbox 
                                        id="requireDigitalSignature" 
                                        label="Require Candidate Digital Signature" 
                                        description="Candidate must sign on the signature canvas before submission." 
                                        checked={field.value ?? true} 
                                        onChange={field.onChange} 
                                    />
                                )} 
                            />
                        </div>
                        <div className="p-4 rounded-2xl bg-page/40 border border-border">
                            <Controller 
                                name="requireOfficerAttestation" 
                                control={control} 
                                defaultValue={true}
                                render={({ field }) => (
                                    <Checkbox 
                                        id="requireOfficerAttestation" 
                                        label="Display Enrolling Field Officer Identity on Booklet" 
                                        description="Prints the active officer's name, role, and digital seal in the bottom attestation box." 
                                        checked={field.value ?? true} 
                                        onChange={field.onChange} 
                                    />
                                )} 
                            />
                        </div>
                        <div className="p-4 rounded-2xl bg-page/40 border border-border">
                            <Controller 
                                name="requireBookletReview" 
                                control={control} 
                                defaultValue={true}
                                render={({ field }) => (
                                    <Checkbox 
                                        id="requireBookletReview" 
                                        label="Require Generating & Reviewing Official Booklet Modal" 
                                        description="Enforces clicking 'Generate & Review Forms' and confirming the dossier before enabling final submit." 
                                        checked={field.value ?? true} 
                                        onChange={field.onChange} 
                                    />
                                )} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
};

export default EnrollmentRules;