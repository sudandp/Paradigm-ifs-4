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
    RefreshCw,
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
import MobileTopBar from '../../components/navigation/MobileTopBar';

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
    { key: 'bankProof', label: 'Bank Proof (Cheque Book / Cancelled Cheque)', description: 'Cheque book leaf or cancelled cheque for salary disbursement', icon: CreditCard, category: 'Financial' },
    { key: 'pan', label: 'PAN Card Copy', description: 'Mandatory Income Tax PAN card copy for statutory TDS / Form 16', icon: FileCheck2, category: 'Financial' },
    { key: 'uanProof', label: 'UAN Proof Document', description: 'EPFO Universal Account Number card or member passbook', icon: Briefcase, category: 'Statutory' },
    { key: 'salarySlip', label: 'Latest Salary Slip', description: 'Previous employment salary slip for CTC and experience verification', icon: IndianRupee, category: 'Statutory' },
    { key: 'educationCertificate', label: 'Education Certificate', description: 'Highest degree, diploma, or 10th/12th passing certificate', icon: GraduationCap, category: 'Academic' },
    { key: 'familyAadhaar', label: 'Family Member Proofs', description: 'Aadhaar cards for all declared nominees and statutory dependents', icon: HeartHandshake, category: 'Nominees' },
];

const verificationRuleConfig: { key: keyof VerificationRules; label: string; description: string; tag: string }[] = [
    { key: 'requireBengaluruAddress', label: 'Require Bengaluru Address Verification', description: 'Verify candidate residential address falls within local operational bounds', tag: 'Geographic' },
    { key: 'requireDobVerification', label: 'Require Strict DOB & Age Validation (>18 Years)', description: 'Enforce statutory minimum working age verification against uploaded Aadhaar / ID proof', tag: 'Compliance' },
    { key: 'requireBankNameMatch', label: 'Require Exact Bank Account Name Matching (Penny Drop)', description: 'Ensure name on bank cheque strictly matches candidate name on Aadhaar card', tag: 'Financial' },
    { key: 'requireUanVerification', label: 'Require UAN Lookup & PF Dual-Enrollment Check', description: 'Perform automated EPFO verification before proceeding with fresh PF generation', tag: 'Statutory' },
];

const formatRoleName = (str: string): string => {
    if (!str || !str.trim()) return '';
    const clean = str.trim();
    const acronyms = new Set(['HVAC', 'DG', 'AFM', 'HR', 'BD', 'CRM', 'IT', 'PF', 'ESI', 'GMC']);
    return clean
        .split(/[\s_-]+/)
        .map(w => {
            const up = w.toUpperCase();
            if (acronyms.has(up)) return up;
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(' ');
};

// Portal/system roles that are not job designations — never shown as configurable roles.
const NON_DESIGNATION_ROLES = new Set(['clientpanel', 'client', 'unverified', 'resident']);

const deduplicateRoles = (roles: string[]): string[] => {
    const map = new Map<string, string>();
    roles.forEach(r => {
        if (!r || !r.trim()) return;
        const formatted = formatRoleName(r);
        // Compare on letters/digits only so "HVAC Technician" and "Hv/ac Technician" collapse.
        const key = formatted.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (NON_DESIGNATION_ROLES.has(key)) return;
        if (!map.has(key)) {
            map.set(key, formatted);
        }
    });
    return Array.from(map.values());
};

// ── Layout primitives (module scope so inputs inside keep focus across re-renders) ──
/** Accessible on/off switch. */
const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }> = ({ checked, onChange, label, disabled }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
            checked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
    >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
);

/** One settings row: title, description, control on the right. */
const SettingRow: React.FC<{ title: React.ReactNode; description?: string; tag?: string; icon?: any; control: React.ReactNode; active?: boolean; children?: React.ReactNode }> = ({ title, description, tag, icon: Icon, control, active, children }) => (
    <div className="px-5 py-4 border-b border-border last:border-b-0">
        <div className="flex items-start gap-4">
            {Icon && (
                <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-page text-muted'}`}>
                    <Icon className="w-4 h-4" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-primary-text">{title}</span>
                    {tag && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-page text-muted border border-border uppercase tracking-wide">{tag}</span>}
                </div>
                {description && <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>}
                {children}
            </div>
            <div className="shrink-0 pt-0.5">{control}</div>
        </div>
    </div>
);

const GlobalNote = () => (
    <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 shrink-0" /> These settings apply to <b>all roles</b>, not only the selected one.
    </div>
);


const EnrollmentRules: React.FC = () => {
    const store = useEnrollmentRulesStore();
    const { attendance } = useSettingsStore();
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
    const [allAppRoles, setAllAppRoles] = useState<{ id: string; displayName: string }[]>([]);
    const [designations, setDesignations] = useState<SiteStaffDesignation[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<StaffCategory>('site');
    const [selectedDesignations, setSelectedDesignations] = useState<string[]>(['Security Guard']);
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
            const canonicalList = deduplicateRoles(siteDesignations.map(d => d.designation));
            if (!canonicalList.some(d => d.toLowerCase() === 'administrator')) {
                canonicalList.unshift('Administrator');
            }
            if (!canonicalList.some(d => d.toLowerCase() === 'default (all roles)')) {
                canonicalList.unshift('Default (All Roles)');
            }
            setDesignations(canonicalList.map((d, i) => ({ id: `${i}`, designation: d, department: '', permanentId: '', temporaryId: '' })));
        });
        // Fetch fresh rules from Supabase
        store.fetchRules(true).catch(err => {
            console.warn('[EnrollmentRules] Error fetching latest rules from Supabase:', err);
        });
    }, []);

    const { register, handleSubmit, control, formState: { isDirty, dirtyFields }, watch, reset, setValue, getValues } = useForm<EnrollmentRules>({
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
            office: deduplicateRoles(DEFAULT_CATEGORY_ROLES.office),
            field: deduplicateRoles(DEFAULT_CATEGORY_ROLES.field),
            site: deduplicateRoles(DEFAULT_CATEGORY_ROLES.site)
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
                        result[cat] = deduplicateRoles([...resolved, ...DEFAULT_CATEGORY_ROLES[cat]]);
                    }
                }
            });
        }

        return result;
    }, [attendance?.missedCheckoutConfig?.roleMapping, allAppRoles]);

    // Designations for a given category
    const designationsForCategory = (category: StaffCategory) => {
        const canonicalList = deduplicateRoles(designations.map(d => d.designation));
        if (category === 'all') {
            return canonicalList.map((name, i) => ({ id: `all-${i}`, designation: name, department: '', permanentId: '', temporaryId: '' }));
        }
        const validRoles = categoryRoleNames[category];
        const validLower = new Set(validRoles.map(r => r.toLowerCase()));
        
        const matched = canonicalList.filter(d => 
            d === 'Default (All Roles)' || 
            validLower.has(d.toLowerCase()) ||
            validRoles.some(v => d.toLowerCase().includes(v.toLowerCase()) || v.toLowerCase().includes(d.toLowerCase()))
        );

        const existingNames = new Set(matched.map(d => d.toLowerCase()));
        validRoles.forEach(r => {
            if (!existingNames.has(r.toLowerCase())) {
                matched.push(r);
                existingNames.add(r.toLowerCase());
            }
        });

        const deduplicated = deduplicateRoles(matched);
        return deduplicated.map((d, idx) => ({ id: `cat-${idx}`, designation: d, department: '', permanentId: '', temporaryId: '' }));
    };

    const designationsByCategory = useMemo(() => ({
        site: designationsForCategory('site'),
        field: designationsForCategory('field'),
        office: designationsForCategory('office'),
        all: designationsForCategory('all'),
    }), [designations, categoryRoleNames]); // eslint-disable-line react-hooks/exhaustive-deps

    // Filter designations by selected category
    const filteredDesignations = designationsByCategory[selectedCategory];

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
                    pan: true,
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

    const onSubmit: SubmitHandler<EnrollmentRules> = async (data) => {
        const normalizedRules = { ...data.rulesByDesignation };
        Object.entries(data.rulesByDesignation || {}).forEach(([desig, rule]) => {
            normalizedRules[desig] = rule;
            normalizedRules[desig.toLowerCase()] = rule;
            normalizedRules[desig.toUpperCase()] = rule;
            normalizedRules[formatRoleName(desig)] = rule;
        });
        const finalData = { ...data, rulesByDesignation: normalizedRules };

        try {
            await store.saveRules(finalData);
            setToast({ message: 'Enrollment & Onboarding rules saved to Supabase! Settings are now active across all enrollment forms.', type: 'success' });
            reset(data);
        } catch (err: any) {
            console.error('[EnrollmentRules] Error saving to Supabase:', err);
            setToast({ message: `Error saving to Supabase: ${err?.message || 'Please check your connection and retry.'}`, type: 'error' });
        }
    };

    // ── Presentation helpers ──
    const countLeaves = (obj: any): number => {
        if (!obj) return 0;
        if (obj === true) return 1;
        if (typeof obj !== 'object') return 0;
        return Object.values(obj).reduce<number>((n, v) => n + countLeaves(v), 0);
    };
    const unsavedCount = countLeaves(dirtyFields);

    const hasCustomRules = (role: string) =>
        !!(store.rulesByDesignation?.[role] || store.rulesByDesignation?.[role.toLowerCase()] || store.rulesByDesignation?.[formatRoleName(role)]);

    const categoryTabs: { id: StaffCategory; label: string }[] = [
        { id: 'site', label: 'Site' },
        { id: 'field', label: 'Field' },
        { id: 'office', label: 'Office' },
        { id: 'all', label: 'All' },
    ];

    const selectCategory = (cat: StaffCategory) => {
        setSelectedCategory(cat);
        setDropdownSearch('');
        const first = designationsByCategory[cat].find(d => d.designation !== 'Default (All Roles)')?.designation || 'Default (All Roles)';
        setSelectedDesignations([first]);
    };

    const isRoleSelected = (role: string) => selectedDesignations.some(r => r.toLowerCase() === role.toLowerCase());

    const isGmcOn = !!isGmcRuleEnabled;
    const familyOn = !!watch('enforceFamilyValidation');
    const attestationOn = [watch('requireDigitalSignature'), watch('requireOfficerAttestation'), watch('requireBookletReview')]
        .filter(v => v !== false).length;

    const sectionTabs: { id: TabType; label: string; meta: string; scope: 'role' | 'global' }[] = [
        { id: 'documents', label: 'Documents', meta: `${mandatoryDocsCount}/${documentRuleConfig.length}`, scope: 'role' },
        { id: 'verifications', label: 'Checks', meta: `${activeVerifsCount}/${verificationRuleConfig.length}`, scope: 'role' },
        { id: 'statutory', label: 'Statutory', meta: [isEsiRuleEnabled ? 'ESI' : null, isGmcOn ? 'GMC' : null].filter(Boolean).join(' · ') || 'Off', scope: 'global' },
        { id: 'family', label: 'Family', meta: familyOn ? 'On' : 'Off', scope: 'global' },
        { id: 'site', label: 'Site', meta: isEnforceLimitEnabled ? (currentManpowerRule === 'block' ? 'Block' : 'Warn') : 'Off', scope: 'global' },
        { id: 'attestation', label: 'Attestation', meta: `${attestationOn}/3`, scope: 'global' },
    ];

    const selectedLabel = selectedDesignations.length === 1 ? selectedDesignations[0] : `${selectedDesignations.length} roles`;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="w-full animate-fade-in">
            <MobileTopBar title="ENROLLMENT RULES" parentPath="/mobile-home?category=Employee+Onboarding" />
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <div className="p-4 md:p-6 lg:p-8 space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-primary-text">Onboarding Rules</h1>
                        <p className="text-sm text-muted mt-0.5">Choose which documents, checks and policies apply when enrolling each role.</p>
                    </div>
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsDropdownOpen(o => !o)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-border bg-card text-primary-text hover:bg-page cursor-pointer"
                        >
                            Bulk actions <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-72 bg-card border border-border rounded-xl shadow-xl z-40 py-1.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsDropdownOpen(false);
                                        if (window.confirm(`Copy the document and check rules of "${primaryDesignation}" to ALL ${designations.length} roles? Their current rules will be replaced (you can still Discard before saving).`)) {
                                            handleCopyRulesToAll();
                                        }
                                    }}
                                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-page cursor-pointer"
                                >
                                    <Copy className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                                    <span>
                                        <span className="block text-xs font-semibold text-primary-text">Apply to all roles</span>
                                        <span className="block text-[11px] text-muted">Copy {primaryDesignation}'s rules to every role</span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsDropdownOpen(false);
                                        if (selectedCategory === 'all') {
                                            setToast({ message: 'Pick Site, Field or Office first — presets are per category.', type: 'info' });
                                            return;
                                        }
                                        if (window.confirm(`Reset ${selectedLabel} to the ${selectedCategory} staff preset? This also updates global ESI / manpower settings.`)) {
                                            handleApplyPreset(selectedCategory);
                                        }
                                    }}
                                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-page cursor-pointer"
                                >
                                    <RotateCcw className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
                                    <span>
                                        <span className="block text-xs font-semibold text-primary-text">Reset to category preset</span>
                                        <span className="block text-[11px] text-muted">Recommended defaults for {selectedCategory === 'all' ? 'a category' : `${selectedCategory} staff`}</span>
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
                    {/* ── Role picker ── */}
                    <aside className="bg-card rounded-2xl border border-border shadow-sm lg:sticky lg:top-4 overflow-hidden">
                        <div className="p-3 border-b border-border space-y-3">
                            <div className="grid grid-cols-4 gap-1 p-1 bg-page rounded-xl" role="tablist" aria-label="Staff category">
                                {categoryTabs.map(cat => {
                                    const active = selectedCategory === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={active}
                                            onClick={() => selectCategory(cat.id)}
                                            className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                                active ? 'bg-card text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-muted hover:text-primary-text'
                                            }`}
                                        >
                                            {cat.label}
                                            <span className="block text-[10px] font-medium opacity-70">{designationsByCategory[cat.id].length}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                                <input
                                    type="text"
                                    placeholder="Search roles…"
                                    value={dropdownSearch}
                                    onChange={e => setDropdownSearch(e.target.value)}
                                    className="w-full bg-page text-primary-text text-xs rounded-lg pl-8 pr-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                        </div>
                        <ul className="max-h-[52vh] overflow-y-auto py-1 custom-scrollbar" aria-label="Roles">
                            {searchedDesignations.map(d => {
                                const checked = isRoleSelected(d.designation);
                                const custom = hasCustomRules(d.designation);
                                return (
                                    <li key={d.id}>
                                        <div className={`group flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${checked ? 'bg-emerald-500/10' : 'hover:bg-page'}`}>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleRoleSelection(d.designation)}
                                                aria-label={`${checked ? 'Remove' : 'Add'} ${d.designation} ${checked ? 'from' : 'to'} selection`}
                                                className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 cursor-pointer ${checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-border bg-card'}`}
                                            >
                                                {checked && <Check className="w-3 h-3 stroke-[3]" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDesignations([d.designation])}
                                                className={`flex-1 min-w-0 text-left truncate cursor-pointer ${checked ? 'font-semibold text-emerald-800 dark:text-emerald-300' : 'text-primary-text'}`}
                                                title={`Configure ${d.designation} only`}
                                            >
                                                {d.designation}
                                            </button>
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${custom ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                                title={custom ? 'Has its own rules' : 'Uses default rules'}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                            {searchedDesignations.length === 0 && (
                                <li className="px-3 py-6 text-xs text-muted text-center">No roles match "{dropdownSearch}".</li>
                            )}
                        </ul>
                        <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[11px]">
                            <span className="text-muted">{selectedDesignations.length} selected</span>
                            <div className="flex items-center gap-3 font-semibold">
                                <button type="button" onClick={handleSelectAllCategoryRoles} className="text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">Select all</button>
                                <button type="button" onClick={handleClearAllSelections} className="text-muted hover:text-primary-text cursor-pointer">Clear</button>
                            </div>
                        </div>
                        <div className="px-3 py-2 border-t border-border bg-page/50 text-[10px] text-muted flex items-center gap-3">
                            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Own rules</span>
                            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Default</span>
                            <span className="ml-auto">Click name = edit only that role</span>
                        </div>
                    </aside>

                    {/* ── Rules editor ── */}
                    <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden min-w-0">
                        {/* Context */}
                        <div className="px-5 pt-5 pb-3">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                                        {selectedDesignations.length > 1 ? 'Editing together' : 'Editing role'}
                                    </p>
                                    <h2 className="text-xl font-bold text-primary-text truncate">{selectedLabel}</h2>
                                    {selectedDesignations.length > 1 && (
                                        <p className="text-xs text-muted mt-0.5 truncate" title={selectedDesignations.join(', ')}>
                                            {selectedDesignations.join(' · ')}
                                        </p>
                                    )}
                                </div>
                                <p className="text-xs text-muted md:text-right shrink-0">
                                    <b className="text-primary-text">{mandatoryDocsCount}</b> of {documentRuleConfig.length} documents required
                                    <span className="mx-1.5">·</span>
                                    <b className="text-primary-text">{activeVerifsCount}</b> of {verificationRuleConfig.length} checks on
                                </p>
                            </div>
                            {selectedDesignations.length > 1 && (
                                <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 rounded-lg px-3 py-2">
                                    Changes you make apply to all {selectedDesignations.length} selected roles. Values shown are from <b>{primaryDesignation}</b>.
                                </p>
                            )}
                        </div>

                        {/* Section tabs */}
                        <div className="px-3 border-b border-border overflow-x-auto" role="tablist" aria-label="Rule sections">
                            <div className="flex gap-1 min-w-max">
                                {sectionTabs.map(tab => {
                                    const active = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={active}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`relative px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                                                active ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted hover:text-primary-text'
                                            }`}
                                        >
                                            {tab.label}
                                            <span className={`ml-1.5 text-[11px] font-medium ${active ? 'text-emerald-600/80' : 'text-muted/80'}`}>{tab.meta}</span>
                                            {tab.scope === 'global' && <span className="ml-1 text-[9px] font-bold uppercase text-amber-600/80" title="Applies to all roles">all</span>}
                                            {active && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-emerald-600" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Documents */}
                        {activeTab === 'documents' && (
                            <div>
                                <div className="px-5 py-2.5 flex items-center justify-between border-b border-border bg-page/40">
                                    <span className="text-xs text-muted">Required documents must be uploaded before the form can be submitted.</span>
                                    <div className="flex items-center gap-3 text-xs font-semibold shrink-0">
                                        <button type="button" onClick={() => handleSelectAllDocuments(true)} className="text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">All required</button>
                                        <button type="button" onClick={() => handleSelectAllDocuments(false)} className="text-muted hover:text-primary-text cursor-pointer">All optional</button>
                                    </div>
                                </div>
                                {documentRuleConfig.map(item => (
                                    <Controller
                                        key={`${primaryDesignation}-${item.key}`}
                                        name={`rulesByDesignation.${primaryDesignation}.documents.${item.key}`}
                                        control={control}
                                        defaultValue={item.key === 'photo' || item.key === 'aadhaar' || item.key === 'bankProof'}
                                        render={({ field }) => {
                                            const set = (v: boolean) => { field.onChange(v); handleBatchDocumentToggle(item.key, v); };
                                            return (
                                                <SettingRow
                                                    icon={item.icon}
                                                    active={!!field.value}
                                                    title={item.label}
                                                    description={item.description}
                                                    tag={item.category}
                                                    control={
                                                        <div className="inline-flex p-0.5 rounded-lg bg-page border border-border" role="radiogroup" aria-label={`${item.label} requirement`}>
                                                            {([true, false] as const).map(v => {
                                                                const on = !!field.value === v;
                                                                return (
                                                                    <button
                                                                        key={String(v)}
                                                                        type="button"
                                                                        role="radio"
                                                                        aria-checked={on}
                                                                        onClick={() => set(v)}
                                                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                                                            on
                                                                                ? v ? 'bg-emerald-600 text-white shadow-sm' : 'bg-card text-primary-text shadow-sm'
                                                                                : 'text-muted hover:text-primary-text'
                                                                        }`}
                                                                    >
                                                                        {v ? 'Required' : 'Optional'}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    }
                                                />
                                            );
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Verifications */}
                        {activeTab === 'verifications' && (
                            <div>
                                {verificationRuleConfig.map(item => (
                                    <Controller
                                        key={`${primaryDesignation}-${item.key}`}
                                        name={`rulesByDesignation.${primaryDesignation}.verifications.${item.key}`}
                                        control={control}
                                        defaultValue={false}
                                        render={({ field }) => (
                                            <SettingRow
                                                icon={ShieldCheck}
                                                active={!!field.value}
                                                title={item.label}
                                                description={item.description}
                                                tag={item.tag}
                                                control={
                                                    <Switch
                                                        label={item.label}
                                                        checked={!!field.value}
                                                        onChange={(v) => { field.onChange(v); handleBatchVerificationToggle(item.key, v); }}
                                                    />
                                                }
                                            />
                                        )}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Statutory */}
                        {activeTab === 'statutory' && (
                            <div>
                                <GlobalNote />
                                <Controller
                                    name="enableEsiRule"
                                    control={control}
                                    render={({ field }) => (
                                        <SettingRow
                                            icon={IndianRupee}
                                            active={!!field.value}
                                            title="ESI wage ceiling"
                                            description="Employees earning at or below this gross monthly salary are covered under ESI. Above it, the GMC policy applies."
                                            control={<Switch label="Enforce ESI rule" checked={!!field.value} onChange={field.onChange} />}
                                        >
                                            <div className={`mt-3 flex items-center gap-2 ${field.value ? '' : 'opacity-40 pointer-events-none'}`}>
                                                <span className="text-sm text-muted">₹</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    {...register('esiCtcThreshold', { valueAsNumber: true })}
                                                    disabled={!field.value}
                                                    className="w-32 bg-page text-primary-text font-semibold text-sm px-2.5 py-1.5 rounded-lg border border-border focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                                    aria-label="ESI gross salary threshold"
                                                />
                                                <span className="text-xs text-muted">per month</span>
                                            </div>
                                        </SettingRow>
                                    )}
                                />
                                <Controller
                                    name="enableGmcRule"
                                    control={control}
                                    render={({ field }) => (
                                        <SettingRow
                                            icon={ShieldAlert}
                                            active={!!field.value}
                                            title="GMC group medical insurance"
                                            description="Default sum insured for employees not covered by ESI."
                                            control={<Switch label="Enable GMC policy" checked={!!field.value} onChange={field.onChange} />}
                                        >
                                            <div className={`mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 ${field.value ? '' : 'opacity-40 pointer-events-none'}`}>
                                                <Input
                                                    label="Minimum salary (₹)"
                                                    id="salaryThreshold"
                                                    type="number"
                                                    registration={register('salaryThreshold', { valueAsNumber: true })}
                                                    disabled={!field.value}
                                                />
                                                <Controller
                                                    name="defaultPolicySingle"
                                                    control={control}
                                                    render={({ field: f }) => (
                                                        <Select label="Single employee" {...f} disabled={!field.value}>
                                                            <option value="1L">₹1 lakh cover</option>
                                                            <option value="2L">₹2 lakh cover</option>
                                                        </Select>
                                                    )}
                                                />
                                                <Controller
                                                    name="defaultPolicyMarried"
                                                    control={control}
                                                    render={({ field: f }) => (
                                                        <Select label="Married / family" {...f} disabled={!field.value}>
                                                            <option value="1L">₹1 lakh cover</option>
                                                            <option value="2L">₹2 lakh cover</option>
                                                        </Select>
                                                    )}
                                                />
                                            </div>
                                        </SettingRow>
                                    )}
                                />
                            </div>
                        )}

                        {/* Family */}
                        {activeTab === 'family' && (
                            <div>
                                <GlobalNote />
                                <Controller
                                    name="enforceFamilyValidation"
                                    control={control}
                                    render={({ field }) => (
                                        <SettingRow
                                            icon={Users}
                                            active={!!field.value}
                                            title="Strict family details validation"
                                            description="Flags duplicate Aadhaar numbers, impossible ages (e.g. a parent younger than the child) and gender mismatches."
                                            control={<Switch label="Strict family validation" checked={!!field.value} onChange={field.onChange} />}
                                        />
                                    )}
                                />
                            </div>
                        )}

                        {/* Site */}
                        {activeTab === 'site' && (
                            <div>
                                <GlobalNote />
                                <Controller
                                    name="enforceManpowerLimit"
                                    control={control}
                                    render={({ field }) => (
                                        <SettingRow
                                            icon={Building2}
                                            active={!!field.value}
                                            title="Site manpower limit"
                                            description="Stop enrollments going beyond a site's approved headcount."
                                            control={<Switch label="Enforce manpower limit" checked={!!field.value} onChange={field.onChange} />}
                                        >
                                            <div className={`mt-3 inline-flex p-0.5 rounded-lg bg-page border border-border ${field.value ? '' : 'opacity-40 pointer-events-none'}`} role="radiogroup" aria-label="When the limit is reached">
                                                {([
                                                    { v: 'warn', label: 'Warn, allow enrollment' },
                                                    { v: 'block', label: 'Block, needs ops approval' },
                                                ] as const).map(opt => {
                                                    const on = currentManpowerRule === opt.v;
                                                    return (
                                                        <button
                                                            key={opt.v}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={on}
                                                            onClick={() => setValue('manpowerLimitRule', opt.v, { shouldDirty: true })}
                                                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                                                on ? (opt.v === 'block' ? 'bg-rose-600 text-white shadow-sm' : 'bg-amber-500 text-white shadow-sm') : 'text-muted hover:text-primary-text'
                                                            }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </SettingRow>
                                    )}
                                />
                                <Controller
                                    name="allowSalaryEdit"
                                    control={control}
                                    render={({ field }) => (
                                        <SettingRow
                                            icon={Edit}
                                            active={!!field.value}
                                            title="Field staff can edit default salary"
                                            description="Any change from the client rate card sends the enrollment to finance for approval."
                                            control={<Switch label="Allow salary edit" checked={!!field.value} onChange={field.onChange} />}
                                        />
                                    )}
                                />
                            </div>
                        )}

                        {/* Attestation */}
                        {activeTab === 'attestation' && (
                            <div>
                                <GlobalNote />
                                {([
                                    { name: 'requireDigitalSignature', title: 'Candidate signature (always required)', description: 'Every enrollment must include a drawn, typed or photographed candidate signature before forms can be generated or submitted.' },
                                    { name: 'requireOfficerAttestation', title: 'Show enrolling officer on booklet', description: "Prints the officer's name, role and digital seal in the attestation box." },
                                    { name: 'requireBookletReview', title: 'Review booklet before submit', description: "The officer must open 'Generate & Review Forms' and confirm before final submit." },
                                ] as const).map(row => (
                                    <Controller
                                        key={row.name}
                                        name={row.name}
                                        control={control}
                                        defaultValue={true}
                                        render={({ field }) => (
                                            <SettingRow
                                                icon={PenTool}
                                                active={field.value !== false}
                                                title={row.title}
                                                description={row.description}
                                                control={row.name === 'requireDigitalSignature'
                                                    ? <Switch label={row.title} checked disabled onChange={() => {}} />
                                                    : <Switch label={row.title} checked={field.value !== false} onChange={field.onChange} />}
                                            />
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {/* Sticky save bar */}
            <div className="sticky bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
                <span className="text-sm flex items-center gap-2">
                    {store.isSaving ? (
                        <><RefreshCw className="w-4 h-4 animate-spin text-emerald-600" /> <span className="text-muted">Saving…</span></>
                    ) : isDirty ? (
                        <><span className="w-2 h-2 rounded-full bg-amber-500" /> <span className="font-semibold text-primary-text">{unsavedCount || 'Some'} unsaved change{unsavedCount === 1 ? '' : 's'}</span></>
                    ) : (
                        <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> <span className="text-muted">All changes saved</span></>
                    )}
                </span>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" disabled={!isDirty || store.isSaving} onClick={() => reset(store)}>
                        Discard
                    </Button>
                    <Button type="submit" variant="primary" size="sm" disabled={!isDirty || store.isSaving}>
                        <Save className="mr-1.5 h-4 w-4" /> Save Rules
                    </Button>
                </div>
            </div>
        </form>
    );
};

export default EnrollmentRules;