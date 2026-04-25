import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, Controller, useFieldArray, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Entity, RegistrationType, Policy, Insurance, UploadedFile, Company, SiteStaffDesignation } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';

import UploadDocument from '../UploadDocument';
import MultiUploadDocument from '../MultiUploadDocument';
import { api } from '../../services/api';
import Checkbox from '../ui/Checkbox';
import { Loader2, Plus, Trash2, Calendar, FileText, Shield, Info, Clock, Wrench, Smartphone, HardDrive, Percent, CheckCircle, AlertCircle, UploadCloud, ShieldCheck, ShieldAlert, FileWarning, Search, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp } from 'lucide-react';

import Toast from '../ui/Toast';
import { useSettingsStore } from '../../store/settingsStore';
import { FIXED_HOLIDAYS, HOLIDAY_SELECTION_POOL } from '../../utils/constants';
import { getProxyUrl, getUploadedFileFromUrl } from '../../utils/fileUrl';

interface EntityFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Entity, pendingFiles: Record<string, UploadedFile | UploadedFile[]>) => void;
  initialData: Entity | null;
  companyName: string;
  companies?: Company[];
}

const entitySchema = yup.object({
  id: yup.string().required(),
  status: yup.string().oneOf(['draft', 'completed']).optional(),
  name: yup.string().required('Society name is required'),
  organizationId: yup.string().optional(),
  location: yup.string().optional(),
  latitude: yup.string().optional(),
  longitude: yup.string().optional(),
  registeredAddress: yup.string().optional(),
  registrationType: yup.string().oneOf(['ROC', 'ROF', 'Society', 'Trust', '']).optional(),
  registrationNumber: yup.string().optional(),
  cinNumber: yup.string().optional(),
  cinDocUrl: yup.string().optional(),
  dinNumber: yup.string().optional(),
  dinDocUrl: yup.string().optional(),
  tanNumber: yup.string().optional(),
  tanDocUrl: yup.string().optional(),
  udyogNumber: yup.string().optional(),
  udyogDocUrl: yup.string().optional(),
  gstNumber: yup.string().optional().nullable().matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GST Number format', excludeEmptyString: true }),
  panNumber: yup.string().transform(v => v?.toUpperCase() || '').matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format', excludeEmptyString: true }).optional(),
  email: yup.string().email('Invalid email format').optional(),
  epfoCode: yup.string().optional(),
  epfoDocUrl: yup.string().optional(),
  esicCode: yup.string().optional(),
  esicDocUrl: yup.string().optional(),
  eShramNumber: yup.string().optional(),
  eShramDocUrl: yup.string().optional(),
  shopAndEstablishmentCode: yup.string().optional(),
  
  // Registration & Statutory Docs
  gstDocUrl: yup.string().optional(),
  panDocUrl: yup.string().optional(),
  msmeDocUrl: yup.string().optional(),
  labourRegistrationDocUrl: yup.string().optional(),
  shopEstablishmentDocUrl: yup.string().optional(),
  rtecDocUrl: yup.string().optional(),
  ptecDocUrl: yup.string().optional(),
  ptpEnrolmentDocUrl: yup.string().optional(),
  ptpRegistrationDocUrl: yup.string().optional(),
  
  // Advanced Fields
  siteTakeoverDate: yup.string().optional().nullable(),
  billingName: yup.string().optional().nullable(),
  emails: yup.array().of(
    yup.object({
      id: yup.string().required(),
      email: yup.string().email('Invalid email format').required('Email is required'),
      isPrimary: yup.boolean().optional()
    })
  ).max(10).optional(),
  
  siteManagement: yup.object({
    keyAccountManager: yup.string().optional(),
    kamEffectiveDate: yup.string().optional().nullable().when('keyAccountManager', {
        is: (val: string) => val && val.length > 0,
        then: schema => schema.required('Effective date is mandatory if KAM is set')
    }),
    siteAreaSqFt: yup.number().typeError('Must be a number').nullable().optional(),
    projectType: yup.string().optional(),
    unitCount: yup.number().typeError('Must be a number').nullable().optional(),
  }).optional(),
  
  agreements: yup.array().of(
    yup.object({
      id: yup.string().required(),
      fromDate: yup.string().optional().nullable(),
      toDate: yup.string().optional().nullable(),
      renewalTriggerDays: yup.number().nullable().optional(),
      minWageTriggerDays: yup.number().nullable().optional(),
      agreementDate: yup.string().optional().nullable(),
      addendum1Date: yup.string().optional().nullable(),
      addendum2Date: yup.string().optional().nullable(),
      wordCopyUrls: yup.array().of(yup.string()).optional(),
      signedCopyUrls: yup.array().of(yup.string()).optional(),
      hasSecurityDeposit: yup.boolean().default(false).optional(),
      securityDepositType: yup.string().oneOf(['Security Deposit', 'Bank Guarantee', '']).optional(),
      securityDepositAmount: yup.number().typeError('Must be a number').nullable().when('hasSecurityDeposit', {
          is: true,
          then: schema => schema.required('Amount is required')
      }),
      securityDepositValidFrom: yup.string().nullable().when('hasSecurityDeposit', {
          is: true,
          then: schema => schema.required('Valid from date is required')
      }),
      securityDepositValidTo: yup.string().nullable().when('hasSecurityDeposit', {
          is: true,
          then: schema => schema.required('Valid to date is required')
      }),
      securityDepositDocUrls: yup.array().of(yup.string()).when('hasSecurityDeposit', {
          is: true,
          then: schema => schema.min(1, 'At least one document is required')
      }),
    })
  ).optional(),
  
  complianceDetails: yup.object({
    form6Applicable: yup.boolean().default(false),
    form6ValidityFrom: yup.string().nullable().optional(),
    form6ValidityTo: yup.string().nullable().optional(),
    form6RenewalInterval: yup.number().nullable().optional(),
    form6DocumentUrl: yup.string().nullable().optional(),
    minWageRevisionApplicable: yup.boolean().default(false),
    minWageRevisionDocumentUrl: yup.string().nullable().optional(),
    minWageRevisionValidityFrom: yup.string().nullable().optional(),
    minWageRevisionValidityTo: yup.string().nullable().optional(),
    epfoSubCodes: yup.string().optional(),
    esicSubCodes: yup.string().optional(),
    shopAndEstablishmentValidity: yup.string().optional(),
  }).optional(),
  
  holidayConfig: yup.object({
    holidayType: yup.string().oneOf(['company_10', 'company_12', 'custom_10', 'custom_12', '']).optional(),
    numberOfDays: yup.number().oneOf([10, 12]).optional(),
    holidays: yup.array().of(yup.object({ date: yup.string().required(), description: yup.string().required() })).optional(),
    salaryRule: yup.string().oneOf(['Full', 'Duty', 'Nil', 'Category']).optional(),
    billingRule: yup.string().oneOf(['Full', 'Duty', 'Nil', 'Category']).optional(),
    logicVariation: yup.string().optional(),
  }).optional(),
  
  financialLinkage: yup.object({
    costingSheetUrl: yup.string().optional().nullable(),
    effectiveDate: yup.string().optional().nullable(),
    version: yup.string().optional().nullable(),
  }).optional(),
  
  billingControls: yup.object({
    billingCycleStart: yup.string().optional().nullable(),
    salaryDate: yup.string().optional().nullable(),
    uniformDeductions: yup.boolean().default(false),
    deductionCategory: yup.string().optional(),
  }).optional(),
  
  assetTracking: yup.object({
    tools: yup.array().of(yup.object({ 
      name: yup.string().required(), 
      brand: yup.string().optional(), 
      size: yup.string().optional(), 
      quantity: yup.number().nullable().optional(), 
      issueDate: yup.string().required() 
    })).optional(),
    dcCopy1Urls: yup.array().of(yup.string()).optional(),
    dcCopy2Urls: yup.array().of(yup.string()).optional(),
    sims: yup.object({
        count: yup.number().nullable().optional(),
        details: yup.array().of(yup.object({ number: yup.string().required(), phone: yup.string().required() })).optional(),
    }).optional(),
    equipment: yup.array().of(yup.object({
        name: yup.string().required(),
        brand: yup.string().optional(),
        model: yup.string().optional(),
        serial: yup.string().optional(),
        accessories: yup.string().optional(),
        condition: yup.string().oneOf(['New', 'Old']).optional(),
        issueDate: yup.string().required(),
        procurementType: yup.string().oneOf(['Rent', 'Hire Purchase', 'Complimentary']).optional(),
        purchasePeriod: yup.string().optional(),
        complimentaryType: yup.string().oneOf(['Dedicated', 'Periodic']).optional(),
        periodicFrequency: yup.string().optional(),
    })).optional(),
  }).optional(),
  
  complianceDocuments: yup.array().of(
    yup.object({
      id: yup.string().required(),
      type: yup.string().required(),
      documentUrls: yup.array().of(yup.string()).optional(),
      expiryDate: yup.string().optional().nullable(),
      effectiveDate: yup.string().optional().nullable(),
      announcedDate: yup.string().optional().nullable(),
      editorLog: yup.string().optional().nullable(),
    })
  ).optional(),
  
  verificationData: yup.object({
    categories: yup.array().of(
      yup.object({
        name: yup.string().required(),
        roles: yup.array().of(
          yup.object({
            roleName: yup.string().required(),
            verifications: yup.object({
              employee: yup.boolean().required(),
              police: yup.boolean().required(),
              crc: yup.boolean().required(),
            }).required(),
          })
        ).defined(),
      })
    ).optional(),
    crcCheck1: yup.object({
      status: yup.string().optional(),
      date: yup.string().optional(),
      docUrls: yup.array().of(yup.string()).optional()
    }).optional(),
    crcCheck2: yup.object({
      status: yup.string().optional(),
      date: yup.string().optional(),
      docUrls: yup.array().of(yup.string()).optional()
    }).optional()
  }).optional(),
  
  gentsUniformConfig: yup.object().optional(),
  ladiesUniformConfig: yup.object().optional(),
  
  insuranceIds: yup.array().of(yup.string().required()).optional(),
  policyIds: yup.array().of(yup.string().required()).optional(),
  insurances: yup.array().of(yup.object({
    id: yup.string().required(),
    provider: yup.string().required('Provider is required'),
    type: yup.string().required('Type is required'),
    policyNumber: yup.string().optional(),
    validTill: yup.string().nullable().optional(),
    documentUrls: yup.array().of(yup.string()).nullable().optional()
  })).optional(),
  policies: yup.array().of(yup.object({
    id: yup.string().required(),
    name: yup.string().required('Policy name is required'),
    level: yup.string().oneOf(['BO', 'Site', 'Both']).required('Level is required'),
    documentUrls: yup.array().of(yup.string()).nullable().optional()
  })).optional(),
  companyId: yup.string().optional(),
}).defined();

type Tab = 'General' | 'Management' | 'Agreement' | 'Compliance' | 'Holidays' | 'Assets' | 'Verification';

const VERIFICATION_CATEGORIES = [
  { 
    name: 'Administrative Staff', 
    empPlusPol: ['GM', 'Manager', 'Executive', 'Engineer', 'Accounts', 'Front Office', 'CRM'],
    polOnly: ['Office Assistant', 'Office Boy', 'Pantry Boy']
  },
  { 
    name: 'Housekeeping', 
    empPlusPol: ['Housekeeping Manager', 'Housekeeping Executive'],
    polOnly: ['Supervisor', 'Driver', 'Janitor']
  },
  { 
    name: 'Landscaping & Horticulture', 
    empPlusPol: ['Horticulturist', 'Manager', 'Executive'],
    polOnly: ['Supervisor', 'Gardener', 'Helper']
  },
  { 
    name: 'Security', 
    empPlusPol: ['Field Officer', 'Security Officer', 'Assistant Security Officer'],
    polOnly: ['Senior Guard', 'Junior Guard', 'Lady Guard', 'Supervisor']
  },
  { 
    name: 'Plumbing', 
    empPlusPol: [],
    polOnly: ['Supervisor', 'Plumber', 'Operator', 'Handy Man']
  },
  { 
    name: 'Electrical & Engineering', 
    empPlusPol: ['Engineering Services Manager', 'Shift Engineer'],
    polOnly: ['Technician', 'Supervisor', 'Operator']
  },
  { 
    name: 'Fire Safety', 
    empPlusPol: ['EHS Executive', 'Fire Officer'],
    polOnly: ['Fire Warden', 'Technician']
  },
  { 
    name: 'STP (Sewage Treatment Plant)', 
    empPlusPol: [],
    polOnly: ['Supervisor', 'Operator']
  },
  { 
    name: 'Swimming Pool Maintenance', 
    empPlusPol: [],
    polOnly: ['Pool Operator']
  },
  { 
    name: 'Pest Control Services', 
    empPlusPol: [],
    polOnly: ['Operator']
  },
  { 
    name: 'Back Office Staff', 
    empPlusPol: ['Operations - Head', 'Operations - Field Executive', 'HR', 'Accounts & Finance', 'Admin'],
    polOnly: ['Driver', 'Office Assistant', 'Office Boy', 'Security Guard']
  }
];

interface AddRoleInputProps {
    allDesignations: SiteStaffDesignation[];
    excludeRoles: string[];
    categoryName: string;
    onAdd: (role: string) => void;
}

const AddRoleInput: React.FC<AddRoleInputProps> = ({ allDesignations, excludeRoles, categoryName, onAdd }) => {
    const [isAdding, setIsAdding] = useState(false);

    const groupedOptions = useMemo(() => {
        return allDesignations.reduce((acc, d) => {
            if (excludeRoles.includes(d.designation)) return acc;
            const dept = d.department || 'Other';
            if (!acc[dept]) acc[dept] = [];
            acc[dept].push(d.designation);
            return acc;
        }, {} as Record<string, string[]>);
    }, [allDesignations, excludeRoles]);

    // Sort departments to put the most relevant one first (fuzzy match)
    const sortedDepartments = useMemo(() => {
        return Object.keys(groupedOptions).sort((a, b) => {
            const aMatch = a.toLowerCase().includes(categoryName.toLowerCase().split(' ')[0]) || categoryName.toLowerCase().includes(a.toLowerCase().split('_')[0]);
            const bMatch = b.toLowerCase().includes(categoryName.toLowerCase().split(' ')[0]) || categoryName.toLowerCase().includes(b.toLowerCase().split('_')[0]);
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
            return a.localeCompare(b);
        });
    }, [groupedOptions, categoryName]);

    if (!isAdding) {
        return (
            <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold border border-dashed border-accent/20 text-accent/60 hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5 uppercase tracking-wider"
            >
                <Plus className="w-3 h-3" />
                <span>Add Role</span>
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200">
            <select
                autoFocus
                className="bg-white border border-accent/30 rounded-lg px-2 py-1.5 text-[11px] font-medium outline-none focus:ring-2 focus:ring-accent/20 w-56"
                onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                        onAdd(val);
                        setIsAdding(false);
                    }
                }}
                onBlur={() => {
                    // Delay to allow selection
                    setTimeout(() => setIsAdding(false), 200);
                }}
                defaultValue=""
            >
                <option value="" disabled>Select Designation...</option>
                {sortedDepartments.map(dept => (
                    <optgroup key={dept} label={dept}>
                        {groupedOptions[dept].map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </optgroup>
                ))}
                {sortedDepartments.length === 0 && <option value="" disabled>No designations found</option>}
            </select>
            <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="p-1.5 bg-muted/10 text-muted rounded-lg hover:bg-muted/20 transition-all"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
};

const isDepartmentMatch = (dept: string, category: string) => {
    const d = dept.toUpperCase().replace(/\s+/g, '_');
    const c = category.toUpperCase().replace(/\s+/g, '_');
    
    if (c.includes('ADMIN')) return d.includes('ADMIN');
    if (c.includes('HOUSEKEEPING')) return d.includes('HOUSEKEEPING');
    if (c.includes('LANDSCAPING')) return d.includes('LANDSCAPING');
    if (c.includes('SECURITY')) return d.includes('SECURITY');
    if (c.includes('PLUMBING')) return d.includes('PLUMBING');
    if (c.includes('ELECTRICAL') || c.includes('ENGINEERING')) return d.includes('ELECTRICAL') || d.includes('ENGINEERING');
    if (c.includes('FIRE')) return d.includes('FIRE');
    if (c.includes('STP')) return d.includes('STP');
    if (c.includes('SWIMMING') || c.includes('POOL')) return d.includes('POOL');
    if (c.includes('PEST')) return d.includes('PEST');
    if (c.includes('BACK_OFFICE')) return d.includes('BACK_OFFICE') || d.includes('ADMIN');
    
    return d.includes(c) || c.includes(d);
};

const EntityForm: React.FC<EntityFormProps> = ({ isOpen, onClose, onSave, initialData, companyName, companies }) => {
  const [activeTab, setActiveTab] = useState<Tab>('General');
  const [completedTabs, setCompletedTabs] = useState<Set<Tab>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<Record<string, UploadedFile | UploadedFile[]>>({});
  const [allDesignations, setAllDesignations] = useState<SiteStaffDesignation[]>([]);
  const [docFilters, setDocFilters] = useState({
    type: '',
    effectiveDate: '',
    announcedDate: '',
    search: ''
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    registration: false,
    statutory: false
  });

  const { officeHolidays } = useSettingsStore();

  const { register, control, handleSubmit, watch, setValue, reset, trigger, formState: { errors } } = useForm<Entity>({
    resolver: yupResolver(entitySchema) as any,
    defaultValues: initialData || {
      id: crypto.randomUUID(),
      status: 'draft',
      name: '',
      emails: [{ id: crypto.randomUUID(), email: '', isPrimary: true }],
      complianceDetails: {
        form6Applicable: false,
        minWageRevisionApplicable: false
      },
      holidayConfig: {
        numberOfDays: 10,
        holidayType: '',
        holidays: [],
        salaryRule: 'Full',
        billingRule: 'Full'
      },
      assetTracking: {
        tools: [],
        equipment: []
      },
      siteManagement: {
        projectType: 'Residential',
        siteAreaSqFt: 0,
        unitCount: 0
      },
      billingControls: { uniformDeductions: false },
      verificationData: {
        categories: VERIFICATION_CATEGORIES.map(cat => ({
          name: cat.name,
          roles: [
            ...cat.empPlusPol.map(r => ({
              roleName: r,
              verifications: { employee: true, police: true, crc: false }
            })),
            ...cat.polOnly.map(r => ({
              roleName: r,
              verifications: { employee: false, police: true, crc: false }
            }))
          ]
        }))
      },
      gentsUniformConfig: { organizationId: initialData?.id || '', departments: [] },
      ladiesUniformConfig: { organizationId: initialData?.id || '', departments: [] }
    }
});

const { fields: agreementFields, append: appendAgreement, remove: removeAgreement } = useFieldArray({
    control,
    name: "agreements"
});

  const { fields: emailFields, append: appendEmail, remove: removeEmail } = useFieldArray({
    control,
    name: "emails"
  });

  const handleRemoveAgreement = async (index: number) => {
    // Get values directly from the form state to ensure we have the most recent URLs
    const agreements = watch('agreements');
    const agreement = agreements?.[index];
    
    if (!agreement) {
        removeAgreement(index);
        return;
    }

    const wordCopyUrls = agreement.wordCopyUrls || [];
    const signedCopyUrls = agreement.signedCopyUrls || [];
    const hasFiles = wordCopyUrls.length > 0 || signedCopyUrls.length > 0;

    if (hasFiles) {
      const confirmed = window.confirm("This agreement has documents uploaded. Are you sure you want to delete this agreement permanently, including the files from the cloud server?");
      if (!confirmed) return;

      try {
        await Promise.all([
            ...wordCopyUrls.map(url => api.deleteFileFromStorage(url)),
            ...signedCopyUrls.map(url => api.deleteFileFromStorage(url))
        ]);
        setToast({ message: "Agreement and associated documents removed successfully", type: 'success' });
      } catch (err) {
        console.error("Cleanup of agreement storage failed:", err);
        setToast({ message: "Agreement removed, but some files might still be on server", type: 'warning' });
      }
    } else {
      const confirmed = window.confirm("Are you sure you want to remove this agreement card?");
      if (!confirmed) return;
    }

    removeAgreement(index);
  };

  const { fields: insuranceFields, append: appendInsurance, remove: removeInsurance } = useFieldArray({
    control,
    name: "insurances"
  });

  const { fields: policyFields, append: appendPolicy, remove: removePolicy } = useFieldArray({
    control,
    name: "policies"
  });

  const { fields: docFields, append: appendDoc, remove: removeDoc } = useFieldArray({
    control,
    name: "complianceDocuments"
  });

  const { fields: toolFields, append: appendTool, remove: removeTool } = useFieldArray({
    control,
    name: "assetTracking.tools"
  });

  const { fields: equipmentFields, append: appendEquipment, remove: removeEquipment } = useFieldArray({
    control,
    name: "assetTracking.equipment"
  });

  const isEditing = !!initialData;
  const watchForm6 = watch('complianceDetails.form6Applicable');
  const companyId = watch('companyId');

  const selectedCompanyName = useMemo(() => {
    if (companyName) return companyName;
    if (companyId && companies) {
      return companies.find(c => c.id === companyId)?.name || '';
    }
    return '';
  }, [companyName, companyId, companies]);

  useEffect(() => {
    if (isOpen) {
        setIsLoading(true);
        // Fetch only required designations
        api.getSiteStaffDesignations().then((designations) => {
            setAllDesignations(designations);
        }).catch(err => {
            console.error('Failed to fetch required data:', err);
            setToast({ message: 'Failed to load designations.', type: 'error' });
        }).finally(() => setIsLoading(false));

        if (initialData) {
            const data = { ...initialData };
            // Migration: agreementDetails -> agreements array
            if ((data as any).agreementDetails && (!data.agreements || data.agreements.length === 0)) {
                if (Array.isArray((data as any).agreementDetails)) {
                    data.agreements = (data as any).agreementDetails;
                } else {
                    data.agreements = [{
                        id: `agr_${Date.now()}`,
                        ...(data as any).agreementDetails
                    }];
                }
                delete (data as any).agreementDetails;
            }

            // Migration: Old verification buckets to new roles structure
            if (data.verificationData?.categories) {
                data.verificationData.categories = data.verificationData.categories.map((cat: any) => {
                    if (cat.roles) return cat; // Already migrated
                    
                    const roles: any[] = [];
                    if (cat.employmentPlusPolice) {
                        cat.employmentPlusPolice.forEach((r: string) => {
                            roles.push({
                                roleName: r,
                                verifications: { employee: true, police: true, crc: false }
                            });
                        });
                    }
                    if (cat.policeOnly) {
                        cat.policeOnly.forEach((r: string) => {
                            roles.push({
                                roleName: r,
                                verifications: { employee: false, police: true, crc: false }
                            });
                        });
                    }
                    return { name: cat.name, roles };
                });
            }

            reset(data);
            setCompletedTabs(new Set<Tab>(['General', 'Management', 'Agreement', 'Compliance', 'Holidays', 'Assets', 'Verification']));
        } else {
            reset({ 
                id: `new_${Date.now()}`, 
                name: '', 
                location: '', 
                registeredAddress: '', 
                registrationType: '', 
                registrationNumber: '', 
                gstNumber: '', 
                panNumber: '', 
                email: '', 
                emails: [{ id: `email_${Date.now()}`, email: '', isPrimary: true }],
                siteManagement: { projectType: 'Commercial' },
                agreements: [{ id: `agr_${Date.now()}`, renewalTriggerDays: 30, minWageTriggerDays: 15 }],
                complianceDetails: { form6Applicable: false, minWageRevisionApplicable: true },
                holidayConfig: { numberOfDays: 10, holidayType: '', holidays: [], salaryRule: 'Full', billingRule: 'Full' },
                verificationData: {
                    categories: VERIFICATION_CATEGORIES.map(cat => ({
                        name: cat.name,
                        roles: [
                            ...cat.empPlusPol.map(r => ({
                                roleName: r,
                                verifications: { employee: true, police: true, crc: false }
                            })),
                            ...cat.polOnly.map(r => ({
                                roleName: r,
                                verifications: { employee: false, police: true, crc: false }
                            }))
                        ]
                    }))
                },
                insuranceIds: [], 
                policyIds: [] 
            });
            setCompletedTabs(new Set());
        }
        setPendingFiles({});
        setActiveTab('General');
    }
}, [initialData, reset, isOpen]);


  const handleFileUpload = (field: string, file: UploadedFile | UploadedFile[] | null) => {
    setPendingFiles(prev => {
        const next = { ...prev };
        if (file) next[field] = file;
        else delete next[field];
        return next;
    });
  };



  const getTabErrors = (tab: Tab, currentErrors: any = errors) => {
    switch (tab) {
      case 'General':
        return !!(currentErrors.name || currentErrors.billingName || currentErrors.location || 
               currentErrors.siteTakeoverDate || currentErrors.registeredAddress || 
               currentErrors.gstNumber || currentErrors.panNumber || 
               currentErrors.registrationType || currentErrors.registrationNumber || 
               currentErrors.emails || currentErrors.companyId);
      case 'Management':
        return !!currentErrors.siteManagement;
      case 'Agreement':
        return !!currentErrors.agreements;
      case 'Compliance':
        return !!currentErrors.complianceDetails;
      case 'Holidays':
        return !!currentErrors.holidayConfig;
      case 'Assets':
        return !!currentErrors.assetTracking;

      case 'Verification':
        return !!currentErrors.verificationData;

      default:
        return false;
    }
  };

  const onSubmit: SubmitHandler<Entity> = (data) => {
    const finalData = { ...data, status: 'completed' as const };
    onSave(finalData, pendingFiles);
  };

  const onSaveDraft = () => {
    const data = watch();
    if (!data.name?.trim()) {
      setToast({ message: 'Society Name is required to save a draft.', type: 'error' });
      return;
    }
    const draftData = { ...data, status: 'draft' as const };
    // Skip full validation for draft
    onSave(draftData, pendingFiles);
  };

  const onError = (errors: any) => {
    setToast({ 
        message: "Missing mandatory fields to create a profile. Please fill them, or use 'Save Draft' to continue later.", 
        type: 'error' 
    });
    const tabOrder: Tab[] = ['General', 'Management', 'Agreement', 'Compliance', 'Holidays', 'Assets', 'Verification'];
    for (const tab of tabOrder) {
      if (getTabErrors(tab, errors)) {
        setActiveTab(tab);
        break;
      }
    }
  };

  const handleNext = async () => {
    const tabOrder: Tab[] = ['General', 'Management', 'Agreement', 'Compliance', 'Holidays', 'Assets', 'Verification'];
    const currentIndex = tabOrder.indexOf(activeTab);
    
    // Mark current tab as completed
    setCompletedTabs(prev => {
        const next = new Set(prev);
        next.add(activeTab);
        return next;
    });

    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const tabOrder: Tab[] = ['General', 'Management', 'Agreement', 'Compliance', 'Holidays', 'Assets', 'Verification'];
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
    }
  };

  if (!isOpen) return null;

  const TabButton: React.FC<{ tabName: Tab }> = ({ tabName }) => {
    const hasError = !!getTabErrors(tabName);
    const isCompleted = completedTabs.has(tabName);
    
    return (
      <button
        type="button"
        onClick={() => setActiveTab(tabName)}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 flex items-center gap-2 transition-all relative ${activeTab === tabName ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-muted hover:text-primary-text'}`}
      >
        <span>{tabName}</span>
        {hasError ? (
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
        ) : isCompleted ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : null}
      </button>
    );
  };

  return (
    <div className="p-4 border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card w-full animate-fade-in relative">
      <form onSubmit={handleSubmit(onSubmit, onError)}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-2xl font-bold text-primary-text">{isEditing ? 'Edit Society' : 'Add New Society'}</h3>
              {selectedCompanyName && <p className="text-sm text-muted">for {selectedCompanyName}</p>}
            </div>
            <div className="flex items-center gap-3">
               <Button type="button" onClick={onClose} variant="secondary" className="px-6">Cancel</Button>
               <Button type="button" onClick={onSaveDraft} variant="outline" className="px-6 border-accent text-accent hover:bg-accent/5">Save Draft</Button>
               <Button 
                    type="submit" 
                    variant="primary" 
                    className="px-8 shadow-lg shadow-emerald-500/20"
                >
                    {isEditing ? 'Save Changes' : 'Create Profile'}
                </Button>
            </div>
          </div>
          
          <div className="border-b border-border mb-6 overflow-x-auto no-scrollbar">
            <nav className="-mb-px flex space-x-1 sm:space-x-4 min-w-max pb-1 text-base">
                <TabButton tabName="General" />
                <TabButton tabName="Management" />
                <TabButton tabName="Agreement" />
                <TabButton tabName="Compliance" />
                <TabButton tabName="Holidays" />
                <TabButton tabName="Assets" />
                <TabButton tabName="Verification" />
            </nav>
          </div>
          
          <div className={`space-y-6 min-h-[450px] p-4 rounded-2xl transition-all duration-300 ${getTabErrors(activeTab) ? 'border-2 border-red-500/30 bg-red-500/[0.02] shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-2 border-transparent'}`}>
            {activeTab === 'General' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Society Name" id="name" registration={register('name')} error={errors.name?.message} />
                        {!companyName && companies && (
                            <Select label="Select Company" id="companyId" registration={register('companyId')} error={errors.companyId?.message}>
                                <option value="">Select Company</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </Select>
                        )}
                        <Input label="Billing Name (As Per Documents)" id="billingName" registration={register('billingName')} error={errors.billingName?.message} />
                        <Input label="Location / City" id="location" registration={register('location')} error={errors.location?.message} />
                        <Input label="Latitude" id="latitude" registration={register('latitude')} error={errors.latitude?.message} placeholder="e.g. 12.9716" />
                        <Input label="Longitude" id="longitude" registration={register('longitude')} error={errors.longitude?.message} placeholder="e.g. 77.5946" />
                        <Controller name="siteTakeoverDate" control={control} render={({ field }) => (
                            <Input type="date" label="Site Takeover Date" id="siteTakeoverDate" value={field.value} onChange={field.onChange} error={errors.siteTakeoverDate?.message} />
                        )} />
                    </div>
                    <Input label="Registered Address" id="registeredAddress" registration={register('registeredAddress')} error={errors.registeredAddress?.message} />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Controller
                            name="gstNumber"
                            control={control}
                            render={({ field }) => (
                                <Input 
                                    {...field}
                                    label="GST Number" 
                                    id="gstNumber" 
                                    pattern="99AAAAA9999A*Z*"
                                    forceUppercase
                                    description="Format: 22 AAAAA 0000 A 1Z5"
                                    error={errors.gstNumber?.message} 
                                    placeholder="22AAAAA0000A1Z5" 
                                />
                            )}
                        />
                        <Controller
                            name="panNumber"
                            control={control}
                            render={({ field }) => (
                                <Input 
                                    {...field}
                                    label="PAN Number" 
                                    id="panNumber" 
                                    pattern="AAAAA9999A"
                                    forceUppercase
                                    description="Format: ABCDE 1234 F"
                                    error={errors.panNumber?.message} 
                                    placeholder="ABCDE1234F" 
                                />
                            )}
                        />
                    </div>

                    <div className="border border-border/50 rounded-2xl bg-page/40 shadow-sm overflow-hidden">
                        <button 
                            type="button"
                            onClick={() => setExpandedSections(prev => ({ ...prev, registration: !prev.registration }))}
                            className="w-full flex items-center justify-between p-6 hover:bg-page/50 transition-colors"
                        >
                            <h4 className="text-lg font-bold text-primary-text border-l-4 border-accent pl-3">Registration & Identification</h4>
                            {expandedSections.registration ? <ChevronUp className="h-5 w-5 text-accent" /> : <ChevronDown className="h-5 w-5 text-accent" />}
                        </button>
                        
                        {expandedSections.registration && (
                            <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                                <div>
                                    <Select label="Registration Type" id="registrationType" registration={register('registrationType')} error={errors.registrationType?.message}>
                                        <option value="">Select Type</option>
                                        <option value="ROC">ROC</option>
                                        <option value="ROF">ROF</option>
                                        <option value="Society">Society</option>
                                        <option value="Trust">Trust</option>
                                    </Select>
                                </div>
                                <Input label="Registration Number" id="registrationNumber" registration={register('registrationNumber')} error={errors.registrationNumber?.message} />

                                <div className="space-y-4">
                                    <Controller
                                        name="cinNumber"
                                        control={control}
                                        render={({ field }) => (
                                            <Input 
                                                {...field}
                                                label="CIN Number" 
                                                id="cinNumber" 
                                                forceUppercase
                                                description="Format: U12345 AA 1234 AAA 123456"
                                                error={errors.cinNumber?.message} 
                                            />
                                        )}
                                    />
                                    <Controller name="cinDocUrl" control={control} render={({ field }) => (
                                        <UploadDocument 
                                            label="CIN Document" 
                                            file={(pendingFiles['cinDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                            onFileChange={(f) => { handleFileUpload('cinDoc', f); if (!f) field.onChange(''); }}
                                        />
                                    )} />
                                </div>
                                <div className="space-y-4">
                                    <Controller
                                        name="dinNumber"
                                        control={control}
                                        render={({ field }) => (
                                            <Input 
                                                {...field}
                                                label="DIN Number" 
                                                id="dinNumber" 
                                                pattern="99999999"
                                                description="Format: 8 Digits"
                                                error={errors.dinNumber?.message} 
                                            />
                                        )}
                                    />
                                    <Controller name="dinDocUrl" control={control} render={({ field }) => (
                                        <UploadDocument 
                                            label="DIN Document" 
                                            file={(pendingFiles['dinDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                            onFileChange={(f) => { handleFileUpload('dinDoc', f); if (!f) field.onChange(''); }}
                                        />
                                    )} />
                                </div>
                                <div className="space-y-4">
                                    <Controller
                                        name="tanNumber"
                                        control={control}
                                        render={({ field }) => (
                                            <Input 
                                                {...field}
                                                label="TAN Number" 
                                                id="tanNumber" 
                                                pattern="AAAA99999A"
                                                forceUppercase
                                                description="Format: AAAA 99999 A"
                                                error={errors.tanNumber?.message} 
                                            />
                                        )}
                                    />
                                    <Controller name="tanDocUrl" control={control} render={({ field }) => (
                                        <UploadDocument 
                                            label="TAN Document" 
                                            file={(pendingFiles['tanDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                            onFileChange={(f) => { handleFileUpload('tanDoc', f); if (!f) field.onChange(''); }}
                                        />
                                    )} />
                                </div>
                                <div className="space-y-4">
                                     <Controller
                                         name="udyogNumber"
                                         control={control}
                                         render={({ field }) => (
                                             <Input 
                                                 {...field}
                                                 label="Udyog Number" 
                                                 id="udyogNumber" 
                                                 forceUppercase
                                                 description="Format: UDYAM-AA-99-9999999"
                                                 error={errors.udyogNumber?.message} 
                                             />
                                         )}
                                     />
                                     <Controller name="udyogDocUrl" control={control} render={({ field }) => (
                                         <UploadDocument 
                                             label="Udyog Document" 
                                             file={(pendingFiles['udyogDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                             onFileChange={(f) => { handleFileUpload('udyogDoc', f); if (!f) field.onChange(''); }}
                                         />
                                     )} />
                                 </div>
                                 <div className="space-y-4">
                                     <Controller name="gstDocUrl" control={control} render={({ field }) => (
                                         <UploadDocument 
                                             label="GST Certificate" 
                                             file={(pendingFiles['gstDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                             onFileChange={(f) => { handleFileUpload('gstDoc', f); if (!f) field.onChange(''); }}
                                         />
                                     )} />
                                 </div>
                                 <div className="space-y-4">
                                     <Controller name="panDocUrl" control={control} render={({ field }) => (
                                         <UploadDocument 
                                             label="PAN Card / Certificate" 
                                             file={(pendingFiles['panDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                             onFileChange={(f) => { handleFileUpload('panDoc', f); if (!f) field.onChange(''); }}
                                         />
                                     )} />
                                 </div>
                                 <div className="space-y-4">
                                     <Controller name="msmeDocUrl" control={control} render={({ field }) => (
                                         <UploadDocument 
                                             label="MSME Certificate" 
                                             file={(pendingFiles['msmeDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                             onFileChange={(f) => { handleFileUpload('msmeDoc', f); if (!f) field.onChange(''); }}
                                         />
                                     )} />
                                 </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 border border-border/50 rounded-2xl bg-page/40 shadow-sm overflow-hidden">
                        <button 
                            type="button"
                            onClick={() => setExpandedSections(prev => ({ ...prev, statutory: !prev.statutory }))}
                            className="w-full flex items-center justify-between p-6 hover:bg-page/50 transition-colors"
                        >
                            <h4 className="text-lg font-bold text-primary-text border-l-4 border-emerald-500 pl-3">Statutory Codes & Documents</h4>
                            {expandedSections.statutory ? <ChevronUp className="h-5 w-5 text-emerald-500" /> : <ChevronDown className="h-5 w-5 text-emerald-500" />}
                        </button>

                        {expandedSections.statutory && (
                            <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-4">
                                    <Input label="EPFO Code" id="epfo" registration={register('epfoCode')} error={errors.epfoCode?.message} />
                                    <Controller name={"epfoDocUrl" as any} control={control} render={({ field }) => (
                                        <UploadDocument 
                                            label="EPFO Document" 
                                            file={(pendingFiles['epfoDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                            onFileChange={(f) => { handleFileUpload('epfoDoc', f); if (!f) field.onChange(''); }}
                                        />
                                    )} />
                                </div>
                                <div className="space-y-4">
                                    <Input label="ESIC Code" id="esic" registration={register('esicCode')} error={errors.esicCode?.message} />
                                    <Controller name={"esicDocUrl" as any} control={control} render={({ field }) => (
                                        <UploadDocument 
                                            label="ESIC Document" 
                                            file={(pendingFiles['esicDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                            onFileChange={(f) => { handleFileUpload('esicDoc', f); if (!f) field.onChange(''); }}
                                        />
                                    )} />
                                </div>
                                <div className="space-y-4">
                                     <Input label="E-Shram Number" id="shram" registration={register('eShramNumber')} error={errors.eShramNumber?.message} />
                                     <Controller name={"eShramDocUrl" as any} control={control} render={({ field }) => (
                                         <UploadDocument 
                                             label="E-Shram Document" 
                                             file={(pendingFiles['shramDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                             onFileChange={(f) => { handleFileUpload('shramDoc', f); if (!f) field.onChange(''); }}
                                         />
                                     )} />
                                 </div>
                                 <div className="space-y-4">
                                     <Controller name="labourRegistrationDocUrl" control={control} render={({ field }) => (
                                         <UploadDocument 
                                             label="Labour Registration Certificate" 
                                             file={(pendingFiles['labourDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                             onFileChange={(f) => { handleFileUpload('labourDoc', f); if (!f) field.onChange(''); }}
                                         />
                                     )} />
                                 </div>
                                 <div className="space-y-4">
                                     <Controller name="shopEstablishmentDocUrl" control={control} render={({ field }) => (
                                         <UploadDocument 
                                             label="Shop & Establishment Document" 
                                             file={(pendingFiles['shopDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                             onFileChange={(f) => { handleFileUpload('shopDoc', f); if (!f) field.onChange(''); }}
                                         />
                                     )} />
                                 </div>
                                 <div className="space-y-4">
                                     <Controller name="rtecDocUrl" control={control} render={({ field }) => (
                                         <UploadDocument 
                                             label="RTEC Certificate" 
                                             file={(pendingFiles['rtecDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                             onFileChange={(f) => { handleFileUpload('rtecDoc', f); if (!f) field.onChange(''); }}
                                         />
                                     )} />
                                 </div>
                                 <div className="space-y-4">
                                     <Controller name="ptecDocUrl" control={control} render={({ field }) => (
                                         <UploadDocument 
                                             label="PTEC Certificate" 
                                             file={(pendingFiles['ptecDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                             onFileChange={(f) => { handleFileUpload('ptecDoc', f); if (!f) field.onChange(''); }}
                                         />
                                     )} />
                                 </div>
                                 <div className="space-y-4">
                                     <Controller name="ptpEnrolmentDocUrl" control={control} render={({ field }) => (
                                         <UploadDocument 
                                             label="Profession Tax Payer Enrolment Certificate" 
                                             file={(pendingFiles['ptpEnrolmentDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                             onFileChange={(f) => { handleFileUpload('ptpEnrolmentDoc', f); if (!f) field.onChange(''); }}
                                         />
                                     )} />
                                 </div>
                                 <div className="space-y-4">
                                     <Controller name="ptpRegistrationDocUrl" control={control} render={({ field }) => (
                                         <UploadDocument 
                                             label="Profession Tax Payer Registration Certificate" 
                                             file={(pendingFiles['ptpRegDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                             onFileChange={(f) => { handleFileUpload('ptpRegDoc', f); if (!f) field.onChange(''); }}
                                         />
                                     )} />
                                 </div>
                            </div>
                        )}
                    </div>

                    <div className="md:col-span-1 mt-4 p-4 border border-border/50 rounded-2xl bg-page/40 shadow-sm max-w-sm">
                        <Controller name={"logoUrl" as any} control={control} render={({ field }) => (
                        <UploadDocument 
                            label="Society Logo" 
                            variant="compact"
                            file={(pendingFiles['logo'] as UploadedFile) || getUploadedFileFromUrl(field.value)}
                            onFileChange={(f) => { handleFileUpload('logo', f); if (!f) field.onChange(''); }}
                            allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
                        />
                        )} />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-primary-text">Email Addresses (Up to 10)</label>
                            {emailFields.length < 10 && (
                                <Button type="button" variant="secondary" size="sm" onClick={() => appendEmail({ id: `email_${Date.now()}`, email: '', isPrimary: false })} className="h-8 py-0">
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {emailFields.map((field, index) => (
                                <div key={field.id} className="flex gap-2">
                                    <div className="flex-1">
                                        <Input 
                                            id={`emails.${index}.email`} 
                                            registration={register(`emails.${index}.email` as const)} 
                                            error={errors.emails?.[index]?.email?.message} 
                                            placeholder={index === 0 ? "Primary Email" : `Secondary Email ${index}`}
                                        />
                                    </div>
                                    {index > 0 && (
                                        <Button type="button" variant="icon" onClick={() => removeEmail(index)} className="text-destructive hover:bg-destructive/10">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'Management' && (
                <div className="space-y-6">
                    <div className="bg-accent/5 border border-accent/20 p-4 rounded-xl flex gap-3">
                        <Shield className="h-5 w-5 text-accent mt-0.5" />
                        <p className="text-sm text-primary-text font-medium">
                            Key Account Manager (KAM) details are restricted. Effective date is mandatory if the manager is changed.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-accent/5 border border-accent/20 rounded-xl">
                        <Input label="Key Account Manager (Ops Manager)" id="keyAccountManager" registration={register('siteManagement.keyAccountManager')} error={errors.siteManagement?.keyAccountManager?.message} />
                        <Controller name="siteManagement.kamEffectiveDate" control={control} render={({ field }) => (
                            <Input type="date" label="KAM Effective Date" id="kamEffectiveDate" value={field.value} onChange={field.onChange} error={errors.siteManagement?.kamEffectiveDate?.message} />
                        )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-accent/5 border border-accent/10 rounded-xl">
                        <Input label="Site Area (Sq.ft)" id="siteAreaSqFt" type="number" registration={register('siteManagement.siteAreaSqFt')} error={errors.siteManagement?.siteAreaSqFt?.message} />
                        <Select label="Project Type" id="projectType" registration={register('siteManagement.projectType')} error={errors.siteManagement?.projectType?.message}>
                            <option value="Apartment">Apartment</option>
                            <option value="Villa">Villa</option>
                            <option value="Rowhouse">Rowhouse</option>
                            <option value="Commercial">Commercial</option>
                            <option value="Industrial">Industrial</option>
                            <option value="Retail">Retail</option>
                        </Select>
                        {['Apartment', 'Villa'].includes(watch('siteManagement.projectType') || '') && (
                            <Input label="Units / Flats" id="unitCount" type="number" registration={register('siteManagement.unitCount')} error={errors.siteManagement?.unitCount?.message} />
                        )}
                    </div>
                </div>
            )}
            {activeTab === 'Agreement' && (
                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                             <FileText className="h-5 w-5 text-accent" />
                             <h3 className="text-lg font-bold text-primary-text">Agreement History</h3>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => appendAgreement({ id: `agr_${Date.now()}`, renewalTriggerDays: 30, minWageTriggerDays: 15 })}>
                            <Plus className="h-4 w-4 mr-1" /> Add Agreement
                        </Button>
                    </div>

                    {agreementFields.map((field, index) => (
                        <div key={field.id} className="relative bg-accent/5 border border-accent/20 p-6 rounded-2xl group animate-fade-in space-y-6">
                            <button 
                                type="button" 
                                onClick={() => handleRemoveAgreement(index)}
                                className="absolute top-4 right-4 p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-xl transition-all hover:scale-110 z-40 group/del"
                                title="Remove Agreement"
                            >
                                <Trash2 className="h-5 w-5 group-hover/del:animate-pulse" />
                            </button>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Controller name={`agreements.${index}.fromDate`} control={control} render={({ field: f }) => (
                                    <Input type="date" label="Agreement From Date" id={`agreementFrom-${field.id}`} value={f.value} onChange={f.onChange} error={errors.agreements?.[index]?.fromDate?.message} />
                                )} />
                                <Controller name={`agreements.${index}.toDate`} control={control} render={({ field: f }) => (
                                    <Input type="date" label="Agreement To Date" id={`agreementTo-${field.id}`} value={f.value} onChange={f.onChange} error={errors.agreements?.[index]?.toDate?.message} />
                                )} />
                                
                                <Input label="Auto Renewal Trigger (Days before)" id={`renewalTrigger-${field.id}`} type="number" registration={register(`agreements.${index}.renewalTriggerDays` as const)} error={errors.agreements?.[index]?.renewalTriggerDays?.message} />
                                <Input label="Min Wage Trigger (Days before)" id={`minWageTrigger-${field.id}`} type="number" registration={register(`agreements.${index}.minWageTriggerDays` as const)} error={errors.agreements?.[index]?.minWageTriggerDays?.message} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-accent/10">
                                <Controller name={`agreements.${index}.wordCopyUrls`} control={control} render={({ field: f }) => {
                                    const pending = pendingFiles[`agreements.${index}.wordCopy`] as UploadedFile[];
                                    const existing = (f.value || []).map(url => getUploadedFileFromUrl(url)).filter(Boolean) as UploadedFile[];
                                    return (
                                        <MultiUploadDocument 
                                            label="Agreement Word Copies (Soft Copies)" 
                                            files={Array.isArray(pending) ? pending : existing}
                                            onFilesChange={(files) => {
                                                handleFileUpload(`agreements.${index}.wordCopy`, files);
                                                f.onChange(files.map(file => file.url).filter(Boolean));
                                            }}
                                        />
                                    );
                                }} />
                                <Controller name={`agreements.${index}.signedCopyUrls`} control={control} render={({ field: f }) => {
                                    const pending = pendingFiles[`agreements.${index}.signedCopy`] as UploadedFile[];
                                    const existing = (f.value || []).map(url => getUploadedFileFromUrl(url)).filter(Boolean) as UploadedFile[];
                                    return (
                                        <MultiUploadDocument 
                                            label="Signed Agreement Copies (Scans)" 
                                            files={Array.isArray(pending) ? pending : existing}
                                            onFilesChange={(files) => {
                                                handleFileUpload(`agreements.${index}.signedCopy`, files);
                                                f.onChange(files.map(file => file.url).filter(Boolean));
                                            }}
                                        />
                                    );
                                }} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-accent/10">
                                <Controller name={`agreements.${index}.agreementDate`} control={control} render={({ field: f }) => (
                                    <Input type="date" label="Agreement Date" id={`agreementDate-${field.id}`} value={f.value} onChange={f.onChange} error={errors.agreements?.[index]?.agreementDate?.message} />
                                )} />
                                <Controller name={`agreements.${index}.addendum1Date`} control={control} render={({ field: f }) => (
                                    <Input type="date" label="Addendum 1 Date" id={`addendum1Date-${field.id}`} value={f.value} onChange={f.onChange} error={errors.agreements?.[index]?.addendum1Date?.message} />
                                )} />
                                <Controller name={`agreements.${index}.addendum2Date`} control={control} render={({ field: f }) => (
                                    <Input type="date" label="Addendum 2 Date" id={`addendum2Date-${field.id}`} value={f.value} onChange={f.onChange} error={errors.agreements?.[index]?.addendum2Date?.message} />
                                )} />
                            </div>

                            {/* Security Deposit Section */}
                            <div className="pt-6 border-t border-accent/10 space-y-6">
                                <Controller name={`agreements.${index}.hasSecurityDeposit`} control={control} render={({ field: { value, onChange } }) => (
                                    <Checkbox 
                                        id={`hasSecurityDeposit-${field.id}`} 
                                        label="Requires Security Deposit / Bank Guarantee" 
                                        checked={value} 
                                        onChange={onChange}
                                        labelClassName="font-bold text-primary-text"
                                    />
                                )} />

                                {watch(`agreements.${index}.hasSecurityDeposit`) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in pl-6 border-l-2 border-accent/20">
                                        <Select 
                                            label="Type" 
                                            id={`securityDepositType-${field.id}`} 
                                            registration={register(`agreements.${index}.securityDepositType` as const)}
                                            error={errors.agreements?.[index]?.securityDepositType?.message}
                                        >
                                            <option value="">Select Type</option>
                                            <option value="Security Deposit">Security Deposit</option>
                                            <option value="Bank Guarantee">Bank Guarantee</option>
                                        </Select>
                                        <Input 
                                            label="Amount" 
                                            type="number" 
                                            id={`securityDepositAmount-${field.id}`} 
                                            registration={register(`agreements.${index}.securityDepositAmount` as const)} 
                                            error={errors.agreements?.[index]?.securityDepositAmount?.message} 
                                        />
                                        <Controller name={`agreements.${index}.securityDepositValidFrom`} control={control} render={({ field: f }) => (
                                            <Input type="date" label="Valid From" id={`securityDepositValidFrom-${field.id}`} value={f.value} onChange={f.onChange} error={errors.agreements?.[index]?.securityDepositValidFrom?.message} />
                                        )} />
                                        <Controller name={`agreements.${index}.securityDepositValidTo`} control={control} render={({ field: f }) => (
                                            <Input type="date" label="Valid To" id={`securityDepositValidTo-${field.id}`} value={f.value} onChange={f.onChange} error={errors.agreements?.[index]?.securityDepositValidTo?.message} />
                                        )} />
                                        <div className="lg:col-span-4 mt-2">
                                            <Controller name={`agreements.${index}.securityDepositDocUrls`} control={control} render={({ field: f }) => {
                                                const pending = pendingFiles[`agreements.${index}.securityDepositDoc`] as UploadedFile[];
                                                const existing = (f.value || []).map(url => getUploadedFileFromUrl(url)).filter(Boolean) as UploadedFile[];
                                                return (
                                                    <MultiUploadDocument 
                                                        label="Security Deposit / Bank Guarantee Documents" 
                                                        files={Array.isArray(pending) ? pending : existing}
                                                        onFilesChange={(files) => {
                                                            handleFileUpload(`agreements.${index}.securityDepositDoc`, files);
                                                            f.onChange(files.map(file => file.url).filter(Boolean));
                                                        }}
                                                    />
                                                );
                                            }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {agreementFields.length === 0 && (
                        <div className="text-center py-12 bg-accent/5 border border-dashed border-accent/20 rounded-2xl">
                             <FileWarning className="h-12 w-12 text-accent/40 mx-auto mb-4" />
                             <p className="text-muted">No agreements added yet. Click the button above to add one.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'Compliance' && (
                <div className="space-y-6">
                    <div className="bg-accent/5 border border-accent/20 p-4 rounded-xl space-y-4">
                        <Controller name="complianceDetails.form6Applicable" control={control} render={({ field: { value, onChange } }) => (
                            <Checkbox 
                                id="form6Applicable" 
                                label="Form 6 (Principal Employer Registration) Applicable" 
                                checked={value} 
                                onChange={onChange}
                                labelClassName="font-bold text-primary-text"
                            />
                        )} />

                        {watchForm6 && (
                            <div className="space-y-4 pl-6 animate-fade-in border-l-2 border-accent/20 ml-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Controller name="complianceDetails.form6ValidityFrom" control={control} render={({ field }) => (
                                        <Input type="date" label="Validity From" id="form6From" value={field.value} onChange={field.onChange} />
                                    )} />
                                    <Controller name="complianceDetails.form6ValidityTo" control={control} render={({ field }) => (
                                        <Input type="date" label="Validity To" id="form6To" value={field.value} onChange={field.onChange} />
                                    )} />
                                    <Input label="Renewal Interval (Days)" id="form6Renewal" type="number" registration={register('complianceDetails.form6RenewalInterval')} />
                                </div>
                                <div className="max-w-md">
                                    <UploadDocument 
                                        label="Form 6 Document" 
                                        file={(pendingFiles['complianceDetails.form6Document'] as UploadedFile) || getUploadedFileFromUrl(watch('complianceDetails.form6DocumentUrl'))} 
                                        onFileChange={(file) => {
                                            handleFileUpload('complianceDetails.form6Document', file);
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-accent/5 border border-accent/20 p-4 rounded-xl space-y-4">
                        <Controller name="complianceDetails.minWageRevisionApplicable" control={control} render={({ field: { value, onChange } }) => (
                            <Checkbox 
                                id="minWageRevision" 
                                label="Automatic Minimum Wage Revision Trigger" 
                                description="Automatically trigger tasks and alerts when minimum wage revisions are due based on agreement expiry."
                                checked={value} 
                                onChange={onChange}
                                labelClassName="font-bold text-primary-text"
                            />
                        )} />

                        {watch('complianceDetails.minWageRevisionApplicable') && (
                            <div className="space-y-4 pl-6 animate-fade-in border-l-2 border-accent/20 ml-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Controller name="complianceDetails.minWageRevisionValidityFrom" control={control} render={({ field }) => (
                                        <Input type="date" label="Validity From" id="minWageFrom" value={field.value} onChange={field.onChange} />
                                    )} />
                                    <Controller name="complianceDetails.minWageRevisionValidityTo" control={control} render={({ field }) => (
                                        <Input type="date" label="Validity To" id="minWageTo" value={field.value} onChange={field.onChange} />
                                    )} />
                                </div>
                                <div className="max-w-md">
                                    <UploadDocument 
                                        label="Min Wage Revision Document" 
                                        file={(pendingFiles['complianceDetails.minWageRevisionDocument'] as UploadedFile) || getUploadedFileFromUrl(watch('complianceDetails.minWageRevisionDocumentUrl'))} 
                                        onFileChange={(file) => {
                                            handleFileUpload('complianceDetails.minWageRevisionDocument', file);
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                        <Input label="E-Shram Number" id="eShramNumber" registration={register('eShramNumber')} error={errors.eShramNumber?.message} />
                        <Input label="Shop & Establishment Code" id="shopAndEstablishmentCode" registration={register('shopAndEstablishmentCode')} error={errors.shopAndEstablishmentCode?.message} />
                        <Input label="EPFO Sub Codes" id="epfoSubCodes" registration={register('complianceDetails.epfoSubCodes')} error={errors.complianceDetails?.epfoSubCodes?.message} />
                        <Input label="ESIC Sub Codes" id="esicSubCodes" registration={register('complianceDetails.esicSubCodes')} error={errors.complianceDetails?.esicSubCodes?.message} />
                        <Controller name="complianceDetails.shopAndEstablishmentValidity" control={control} render={({ field }) => (
                            <Input type="date" label="Shop & Establishment Validity" id="shopValidity" value={field.value} onChange={field.onChange} error={errors.complianceDetails?.shopAndEstablishmentValidity?.message} />
                        )} />
                    </div>


                </div>
            )}

            {activeTab === 'Holidays' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-accent/5 border border-accent/20 rounded-xl">
                        <div className="space-y-4">
                            <Select 
                                label="Holiday Policy Type" 
                                id="holidayType" 
                                registration={register('holidayConfig.holidayType')}
                                onChange={(e) => {
                                    const val = e.target.value as 'company_10' | 'company_12' | 'custom_10' | 'custom_12' | '';
                                    setValue('holidayConfig.holidayType', val);
                                    
                                    // Handle auto-population for policy types
                                    if (val !== '') {
                                        const limit = (val === 'company_10' || val === 'custom_10') ? 10 : 12;
                                        setValue('holidayConfig.numberOfDays', limit);

                                        if (val.startsWith('company_')) {
                                            // Fetch from parent company's registered holidays
                                            const parentCompany = companies?.find(c => c.id === watch('companyId')) || companies?.find(c => c.name === companyName);
                                            const companyHols = (parentCompany?.holidays || []).map(h => ({
                                                date: h.date,
                                                description: h.festivalName
                                            })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                            setValue('holidayConfig.holidays', companyHols.slice(0, limit));
                                        } else {
                                            // Custom: start empty, HR/Admin selects from pool
                                            setValue('holidayConfig.holidays', []);
                                        }
                                    }
                                }}
                            >
                                <option value="">Select Policy</option>
                                <option value="company_10">Company 10 Days Holiday</option>
                                <option value="company_12">Company 12 Days Holiday</option>
                                <option value="custom_10">Custom Client 10 Holiday</option>
                                <option value="custom_12">Custom Client 12 Holiday</option>
                            </Select>
                            <Input label="Logic Variation (e.g. 1+1, 1.5)" id="logicVariation" registration={register('holidayConfig.logicVariation')} placeholder="Overrides default rules" />
                        </div>
                        
                        <div className="space-y-4">
                            <Select label="Salary Rule for Holiday" id="salaryRule" registration={register('holidayConfig.salaryRule')}>
                                <option value="Full">Full Payment</option>
                                <option value="Duty">Duty Payment</option>
                                <option value="Nil">Nil Payment</option>
                                <option value="Category">Category Wise</option>
                            </Select>
                            <Select label="Billing Rule for Holiday" id="billingRule" registration={register('holidayConfig.billingRule')}>
                                <option value="Full">Full Payment</option>
                                <option value="Duty">Duty Payment</option>
                                <option value="Nil">Nil Payment</option>
                                <option value="Category">Category Wise</option>
                            </Select>
                        </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> 
                                {watch('holidayConfig.holidayType')?.startsWith('company_') ? 'Company Provided List' : 'Client Selected List'} 
                                ({watch('holidayConfig.holidays')?.length || 0} / {watch('holidayConfig.numberOfDays') || 0})
                            </h4>
                            {!watch('holidayConfig.holidayType')?.startsWith('company_') && (
                                <Button type="button" variant="secondary" size="sm" onClick={() => {
                                    const holidays = watch('holidayConfig.holidays') || [];
                                    if (holidays.length < (watch('holidayConfig.numberOfDays') || 10)) {
                                        setValue('holidayConfig.holidays', [...holidays, { date: '', description: '' }]);
                                    }
                                }}>
                                    <Plus className="h-4 w-4 mr-1" /> Add Custom Holiday
                                </Button>
                            )}
                        </div>

                        {watch('holidayConfig.holidayType') !== '' && !watch('holidayConfig.holidayType')?.startsWith('company_') && (
                            <div className="bg-accent/5 p-4 rounded-xl border border-accent/20 mb-4 animate-fade-in">
                                <h5 className="text-xs font-bold text-muted uppercase mb-3 px-1">
                                    Select from Holiday Selection Pool
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                    {HOLIDAY_SELECTION_POOL.map(ph => {
                                        const currentYear = new Date().getFullYear();
                                        const poolDate = `${currentYear}${ph.date}`;
                                        const isSelected = (watch('holidayConfig.holidays') || []).some(h => h.date === poolDate);
                                        const limit = watch('holidayConfig.numberOfDays') || 10;
                                        const currentCount = (watch('holidayConfig.holidays') || []).length;

                                        return (
                                            <button
                                                key={ph.name + ph.date}
                                                type="button"
                                                disabled={!isSelected && currentCount >= limit}
                                                onClick={() => {
                                                    const holidays = watch('holidayConfig.holidays') || [];
                                                    if (isSelected) {
                                                        setValue('holidayConfig.holidays', holidays.filter(h => h.date !== poolDate));
                                                    } else if (currentCount < limit) {
                                                        setValue('holidayConfig.holidays', [...holidays, { date: poolDate, description: ph.name }]);
                                                    }
                                                }}
                                                className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-all text-left group ${
                                                    isSelected 
                                                    ? 'bg-accent text-white border-accent' 
                                                    : 'bg-white hover:border-accent/50 text-primary-text border-border/50 disabled:opacity-50'
                                                }`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'border-white bg-white/20' : 'border-border group-hover:border-accent/30'}`}>
                                                    {isSelected && <CheckCircle className="h-3 w-3" />}
                                                </div>
                                                <div className="flex-grow truncate">
                                                    <div className="font-semibold">{ph.name}</div>
                                                    <div className={isSelected ? 'text-white/70' : 'text-muted'}>{ph.date.substring(1)}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {(watch('holidayConfig.holidays') || []).map((holiday, index) => {
                            const isCompanyType = watch('holidayConfig.holidayType')?.startsWith('company_');
                            const isFixed = FIXED_HOLIDAYS.some(fh => holiday.description === fh.name);
                            return (
                                <div key={index} className={`grid grid-cols-12 gap-3 items-end p-3 rounded-lg border transition-all ${isCompanyType ? 'bg-primary/5 border-primary/20' : isFixed ? 'bg-primary/5 border-primary/20' : 'bg-accent/5 border-accent/20'}`}>
                                    <div className="col-span-11 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <Controller name={`holidayConfig.holidays.${index}.date`} control={control} render={({ field }) => (
                                            <Input type="date" 
                                                label="Date" 
                                                id={`holidayDate-${index}`} 
                                                value={field.value} 
                                                onChange={field.onChange} 
                                                disabled={isCompanyType} 
                                            />
                                        )} />
                                        <Input 
                                            label="Description" 
                                            id={`holidayDesc-${index}`} 
                                            registration={register(`holidayConfig.holidays.${index}.description` as const)} 
                                            disabled={isCompanyType} 
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center">
                                        {!isCompanyType && (
                                            <Button type="button" variant="icon" onClick={() => {
                                                const holidays = watch('holidayConfig.holidays') || [];
                                                setValue('holidayConfig.holidays', holidays.filter((__, i) => i !== index));
                                            }} className="text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {isCompanyType && <ShieldCheck className="h-5 w-5 text-primary opacity-50 mb-2" />}
                                    </div>
                                </div>
                            );
                        })}
                        {(!watch('holidayConfig.holidays') || watch('holidayConfig.holidays')?.length === 0) && (
                            <div className="text-center py-12 bg-accent/5 rounded-xl border-2 border-dashed border-accent/20">
                                <Calendar className="h-12 w-12 text-accent/30 mx-auto mb-3" />
                                <p className="text-muted text-sm">Select a Holiday Policy Type above to get started.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {activeTab === 'Assets' && (
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2"><Wrench className="h-4 w-4" /> Tools Tracking</h4>
                            <Button type="button" variant="secondary" size="sm" onClick={() => {
                                appendTool({ name: '', brand: '', size: '', quantity: 1, issueDate: '' });
                            }}>
                                <Plus className="h-4 w-4 mr-1" /> Add Tool
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-accent/5 p-4 rounded-xl border border-accent/20">
                             <Controller name="assetTracking.dcCopy1Urls" control={control} render={({ field: f }) => {
                                const pending = pendingFiles['assetTracking.dcCopy1'] as UploadedFile[];
                                const existing = (f.value || []).map(url => getUploadedFileFromUrl(url)).filter(Boolean) as UploadedFile[];
                                return (
                                    <MultiUploadDocument 
                                        label="DC Copy 1 (Capture)" 
                                        files={Array.isArray(pending) ? pending : existing}
                                        onFilesChange={(files) => {
                                            handleFileUpload('assetTracking.dcCopy1', files);
                                            f.onChange(files.map(file => file.url).filter(Boolean));
                                        }}
                                    />
                                );
                            }} />
                            <Controller name="assetTracking.dcCopy2Urls" control={control} render={({ field: f }) => {
                                const pending = pendingFiles['assetTracking.dcCopy2'] as UploadedFile[];
                                const existing = (f.value || []).map(url => getUploadedFileFromUrl(url)).filter(Boolean) as UploadedFile[];
                                return (
                                    <MultiUploadDocument 
                                        label="DC Copy 2 (Capture)" 
                                        files={Array.isArray(pending) ? pending : existing}
                                        onFilesChange={(files) => {
                                            handleFileUpload('assetTracking.dcCopy2', files);
                                            f.onChange(files.map(file => file.url).filter(Boolean));
                                        }}
                                    />
                                );
                            }} />
                        </div>

                        <div className="grid grid-cols-1 gap-4 max-h-[300px] overflow-y-auto pr-2">
                            {toolFields.map((field, index) => (
                                <div key={field.id} className="bg-page p-4 rounded-lg border border-border/50 relative group">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <Input label="Tool Name" id={`toolName-${index}`} registration={register(`assetTracking.tools.${index}.name` as const)} />
                                        <Input label="Brand" id={`toolBrand-${index}`} registration={register(`assetTracking.tools.${index}.brand` as const)} />
                                        <Input label="Size" id={`toolSize-${index}`} registration={register(`assetTracking.tools.${index}.size` as const)} />
                                        <Input label="Quantity" id={`toolQty-${index}`} type="number" registration={register(`assetTracking.tools.${index}.quantity` as const)} />
                                        <Controller name={`assetTracking.tools.${index}.issueDate`} control={control} render={({ field: dateField }) => (
                                            <Input type="date" label="Issue Date" id={`toolDate-${index}`} value={dateField.value} onChange={dateField.onChange} />
                                        )} />
                                    </div>
                                    <Button type="button" variant="icon" onClick={() => removeTool(index)} className="absolute -top-2 -right-2 bg-white dark:bg-card border shadow-sm text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 pt-6 border-t">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2"><HardDrive className="h-4 w-4" /> Equipment Issuance</h4>
                            <Button type="button" variant="secondary" size="sm" onClick={() => {
                                appendEquipment({ name: '', brand: '', model: '', serial: '', accessories: '', condition: 'New', issueDate: '' });
                            }}>
                                <Plus className="h-4 w-4 mr-1" /> Add Equipment
                            </Button>
                        </div>
                         <div className="grid grid-cols-1 gap-4 max-h-[300px] overflow-y-auto pr-2">
                            {equipmentFields.map((field, index) => (
                                <div key={field.id} className="bg-page p-4 rounded-lg border border-border/50 relative group">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <Input label="Equip. Name" id={`equipName-${index}`} registration={register(`assetTracking.equipment.${index}.name` as const)} />
                                        <Input label="Brand" id={`equipBrand-${index}`} registration={register(`assetTracking.equipment.${index}.brand` as const)} />
                                        <Input label="Serial #" id={`equipSerial-${index}`} registration={register(`assetTracking.equipment.${index}.serial` as const)} />
                                        <Select label="Condition" id={`equipCond-${index}`} registration={register(`assetTracking.equipment.${index}.condition` as const)}>
                                            <option value="New">New</option>
                                            <option value="Old">Old</option>
                                        </Select>
                                        <Controller name={`assetTracking.equipment.${index}.issueDate`} control={control} render={({ field: dateField }) => (
                                            <Input type="date" label="Issue Date" id={`equipDate-${index}`} value={dateField.value} onChange={dateField.onChange} />
                                        )} />
                                        <Select label="Procurement Type" id={`equipProc-${index}`} registration={register(`assetTracking.equipment.${index}.procurementType` as const)}>
                                            <option value="">Select Type</option>
                                            <option value="Rent">Rent</option>
                                            <option value="Hire Purchase">Hire Purchase</option>
                                            <option value="Complimentary">Complimentary</option>
                                        </Select>

                                        {watch(`assetTracking.equipment.${index}.procurementType`) === 'Hire Purchase' && (
                                            <Input label="Purchase Period" id={`equipPeriod-${index}`} registration={register(`assetTracking.equipment.${index}.purchasePeriod` as const)} placeholder="e.g. 24 Months" />
                                        )}

                                        {watch(`assetTracking.equipment.${index}.procurementType`) === 'Complimentary' && (
                                            <>
                                                <Select label="Complimentary Type" id={`equipComp-${index}`} registration={register(`assetTracking.equipment.${index}.complimentaryType` as const)}>
                                                    <option value="Dedicated">Dedicated</option>
                                                    <option value="Periodic">Periodic</option>
                                                </Select>
                                                {watch(`assetTracking.equipment.${index}.complimentaryType`) === 'Periodic' && (
                                                    <Input label="Frequency" id={`equipFreq-${index}`} registration={register(`assetTracking.equipment.${index}.periodicFrequency` as const)} placeholder="e.g. Quarterly" />
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <Button type="button" variant="icon" onClick={() => removeEquipment(index)} className="absolute -top-2 -right-2 bg-white dark:bg-card border shadow-sm text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}


            {activeTab === 'Verification' && (
                <div className="space-y-8 animate-fade-in max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="bg-accent/5 border border-accent/20 p-4 rounded-xl flex gap-3 mb-6">
                        <Info className="h-5 w-5 text-accent mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-primary-text">Verification Requirements</h4>
                            <p className="text-xs text-muted mt-1 font-medium">
                                Define which roles require specific verification types. Selected roles will be enforced during employee onboarding for this society.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-10">
                        {VERIFICATION_CATEGORIES.map((cat, catIdx) => (
                            <div key={cat.name} className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-border pb-2">
                                    <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                                    <h3 className="text-sm font-bold text-primary-text uppercase tracking-wider">{cat.name}</h3>
                                </div>
                                
                                <div className="bg-card/30 border border-border rounded-xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="bg-muted/5 border-b border-border">
                                                    <th className="px-4 py-3 font-bold text-muted uppercase tracking-widest">Role / Designation</th>
                                                    <th className="px-4 py-3 font-bold text-muted uppercase tracking-widest text-center">Employee Verification</th>
                                                    <th className="px-4 py-3 font-bold text-muted uppercase tracking-widest text-center">Police Verification</th>
                                                    <th className="px-4 py-3 font-bold text-muted uppercase tracking-widest text-center">CRC</th>
                                                    <th className="px-4 py-3 font-bold text-muted uppercase tracking-widest text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/50">
                                                {(() => {
                                                    const currentRoles = watch(`verificationData.categories.${catIdx}.roles`) || [];
                                                    return (
                                                        <>
                                                            {currentRoles.map((role, roleIdx) => (
                                                                <tr key={role.roleName} className="hover:bg-accent/[0.02] transition-colors group">
                                                                    <td className="px-4 py-3 font-semibold text-primary-text">{role.roleName}</td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <div className="flex justify-center">
                                                                            <input
                                                                                type="checkbox"
                                                                                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
                                                                                checked={role.verifications.employee}
                                                                                onChange={(e) => {
                                                                                    const updated = [...currentRoles];
                                                                                    updated[roleIdx].verifications.employee = e.target.checked;
                                                                                    setValue(`verificationData.categories.${catIdx}.roles`, updated);
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <div className="flex justify-center">
                                                                            <input
                                                                                type="checkbox"
                                                                                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
                                                                                checked={role.verifications.police}
                                                                                onChange={(e) => {
                                                                                    const updated = [...currentRoles];
                                                                                    updated[roleIdx].verifications.police = e.target.checked;
                                                                                    setValue(`verificationData.categories.${catIdx}.roles`, updated);
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <div className="flex justify-center">
                                                                            <input
                                                                                type="checkbox"
                                                                                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
                                                                                checked={role.verifications.crc}
                                                                                onChange={(e) => {
                                                                                    const updated = [...currentRoles];
                                                                                    updated[roleIdx].verifications.crc = e.target.checked;
                                                                                    setValue(`verificationData.categories.${catIdx}.roles`, updated);
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const updated = currentRoles.filter((_, i) => i !== roleIdx);
                                                                                setValue(`verificationData.categories.${catIdx}.roles`, updated);
                                                                            }}
                                                                            className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                            title="Remove role"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            <tr>
                                                                <td colSpan={5} className="px-4 py-3 bg-muted/[0.02]">
                                                                    <AddRoleInput 
                                                                        allDesignations={allDesignations.filter(d => isDepartmentMatch(d.department, cat.name))}
                                                                        excludeRoles={currentRoles.map(r => r.roleName)}
                                                                        categoryName={cat.name}
                                                                        onAdd={(roleName) => {
                                                                            const current = watch(`verificationData.categories.${catIdx}.roles`) || [];
                                                                            // Determine defaults based on category and role if possible,
                                                                            // but for now use Confirmation: select based on category.
                                                                            const isPolOnly = cat.polOnly?.includes(roleName);
                                                                            const isEmpPol = cat.empPlusPol?.includes(roleName);
                                                                            
                                                                            setValue(`verificationData.categories.${catIdx}.roles`, [
                                                                                ...current, 
                                                                                { 
                                                                                    roleName, 
                                                                                    verifications: { 
                                                                                        employee: isEmpPol || false, 
                                                                                        police: isEmpPol || isPolOnly || false, 
                                                                                        crc: false 
                                                                                    } 
                                                                                }
                                                                            ]);
                                                                        }} 
                                                                    />
                                                                </td>
                                                            </tr>
                                                        </>
                                                    );
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CRC Checks Section */}
                    <div className="pt-10 border-t border-border/50">
                        <div className="flex items-center gap-2 mb-6">
                            <ShieldAlert className="h-5 w-5 text-accent" />
                            <h3 className="text-sm font-bold text-primary-text uppercase tracking-widest">Site-Level CRC Checks</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* CRC Check 1 */}
                            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-primary-text">CRC Check 1</h4>
                                    <Controller
                                        name="verificationData.crcCheck1.status"
                                        control={control}
                                        render={({ field }) => (
                                            <Select {...field} className="!w-32 !py-1 text-[10px]">
                                                <option value="">Status...</option>
                                                <option value="Pending">Pending</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Ongoing">Ongoing</option>
                                            </Select>
                                        )}
                                    />
                                </div>
                                <Controller
                                    name="verificationData.crcCheck1.date"
                                    control={control}
                                    render={({ field }) => (
                                        <Input type="date" label="Check Date" id="crc1Date" value={field.value} onChange={field.onChange} />
                                    )}
                                />
                                <MultiUploadDocument 
                                    label="CRC 1 Documents"
                                    files={(pendingFiles['verificationData.crcCheck1.docUrls'] as UploadedFile[]) || (watch('verificationData.crcCheck1.docUrls') || []).map(url => getUploadedFileFromUrl(url))}
                                    onFilesChange={(files) => handleFileUpload('verificationData.crcCheck1.docUrls', files)}
                                />
                            </div>

                            {/* CRC Check 2 */}
                            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-primary-text">CRC Check 2</h4>
                                    <Controller
                                        name="verificationData.crcCheck2.status"
                                        control={control}
                                        render={({ field }) => (
                                            <Select {...field} className="!w-32 !py-1 text-[10px]">
                                                <option value="">Status...</option>
                                                <option value="Pending">Pending</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Ongoing">Ongoing</option>
                                            </Select>
                                        )}
                                    />
                                </div>
                                <Controller
                                    name="verificationData.crcCheck2.date"
                                    control={control}
                                    render={({ field }) => (
                                        <Input type="date" label="Check Date" id="crc2Date" value={field.value} onChange={field.onChange} />
                                    )}
                                />
                                <MultiUploadDocument 
                                    label="CRC 2 Documents"
                                    files={(pendingFiles['verificationData.crcCheck2.docUrls'] as UploadedFile[]) || (watch('verificationData.crcCheck2.docUrls') || []).map(url => getUploadedFileFromUrl(url))}
                                    onFilesChange={(files) => handleFileUpload('verificationData.crcCheck2.docUrls', files)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-8 border-t border-border mt-8">
            <Button
              type="button"
              variant="secondary"
              onClick={handleBack}
              disabled={activeTab === 'General'}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            
            {activeTab !== 'Verification' ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleNext}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-dark"
                >
                  Save & Next <ChevronRight className="h-4 w-4" />
                </Button>
            ) : (
                <div className="text-sm text-muted italic flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" /> All sections ready. Click Create Profile above to complete.
                </div>
            )}
          </div>
          {/* Remove bottom buttons as they are now in the top header */}
          {toast && (
            <Toast 
              message={toast.message} 
              type={toast.type} 
              onDismiss={() => setToast(null)} 
            />
          )}
        </form>
    </div>
  );
};

export default EntityForm;
