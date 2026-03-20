import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, Controller, useFieldArray, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Entity, RegistrationType, Policy, Insurance, UploadedFile, Company } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import DatePicker from '../ui/DatePicker';
import UploadDocument from '../UploadDocument';
import { api } from '../../services/api';
import Checkbox from '../ui/Checkbox';
import { Loader2, Plus, Trash2, Calendar, FileText, Shield, Info, Clock, Wrench, Smartphone, HardDrive, Percent, CheckCircle, AlertCircle, UploadCloud, ShieldCheck, ShieldAlert, FileWarning, ChevronLeft, ChevronRight } from 'lucide-react';

interface EntityFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Entity, pendingFiles: Record<string, File>) => void;
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
  registeredAddress: yup.string().optional(),
  registrationType: yup.string<RegistrationType>().oneOf(['CIN', 'ROC', 'ROF', 'Society', 'Trust', '']).optional(),
  registrationNumber: yup.string().optional(),
  gstNumber: yup.string().optional().nullable().matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GST Number format', excludeEmptyString: true }),
  panNumber: yup.string().transform(v => v?.toUpperCase() || '').matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format', excludeEmptyString: true }).optional(),
  email: yup.string().email('Invalid email format').optional(),
  eShramNumber: yup.string().optional(),
  shopAndEstablishmentCode: yup.string().optional(),
  
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
  
  agreementDetails: yup.object({
    fromDate: yup.string().optional().nullable(),
    toDate: yup.string().optional().nullable(),
    renewalTriggerDays: yup.number().nullable().optional(),
    minWageTriggerDays: yup.number().nullable().optional(),
    agreementDate: yup.string().optional().nullable(),
    addendum1Date: yup.string().optional().nullable(),
    addendum2Date: yup.string().optional().nullable(),
  }).optional(),
  
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
  }).optional(),
  
  holidayConfig: yup.object({
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
    dcCopy1Url: yup.string().nullable().optional(),
    dcCopy2Url: yup.string().nullable().optional(),
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
        issueDate: yup.string().required()
    })).optional(),
  }).optional(),
  
  verificationData: yup.object({
    categories: yup.array().of(
      yup.object({
        name: yup.string().required(),
        employmentPlusPolice: yup.array().of(yup.string().required()).defined(),
        policeOnly: yup.array().of(yup.string().required()).defined(),
      })
    ).optional(),
  }).optional(),
  
  insuranceIds: yup.array().of(yup.string().required()).optional(),
  policyIds: yup.array().of(yup.string().required()).optional(),
  insurances: yup.array().of(yup.object({
    id: yup.string().required(),
    provider: yup.string().required('Provider is required'),
    type: yup.string().required('Type is required'),
    policyNumber: yup.string().optional(),
    validTill: yup.string().nullable().optional(),
    documentUrl: yup.string().nullable().optional()
  })).optional(),
  policies: yup.array().of(yup.object({
    id: yup.string().required(),
    name: yup.string().required('Policy name is required'),
    level: yup.string().oneOf(['BO', 'Site', 'Both']).required('Level is required'),
    documentUrl: yup.string().nullable().optional()
  })).optional(),
  companyId: yup.string().optional(),
}).defined();

type Tab = 'General' | 'Management' | 'Agreement' | 'Compliance' | 'Holidays' | 'Assets' | 'Billing' | 'Verification' | 'Policies/Insurance';

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

const EntityForm: React.FC<EntityFormProps> = ({ isOpen, onClose, onSave, initialData, companyName, companies }) => {
  const [activeTab, setActiveTab] = useState<Tab>('General');
  const [completedTabs, setCompletedTabs] = useState<Set<Tab>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});

  const { register, handleSubmit, formState: { errors }, reset, control, watch, setValue } = useForm<Entity>({
    resolver: yupResolver(entitySchema) as Resolver<Entity>,
    defaultValues: {
        emails: [{ id: `email_${Date.now()}`, email: '', isPrimary: true }],
        siteManagement: { projectType: 'Commercial' },
        agreementDetails: { renewalTriggerDays: 30, minWageTriggerDays: 15 },
        complianceDetails: { form6Applicable: false, minWageRevisionApplicable: true },
        holidayConfig: { numberOfDays: 10, salaryRule: 'Full', billingRule: 'Full' },
        billingControls: { uniformDeductions: false },
        verificationData: {
            categories: VERIFICATION_CATEGORIES.map(cat => ({
                name: cat.name,
                employmentPlusPolice: [...cat.empPlusPol],
                policeOnly: [...cat.polOnly]
            }))
        }
    }
  });

  const { fields: emailFields, append: appendEmail, remove: removeEmail } = useFieldArray({
    control,
    name: "emails"
  });

  const { fields: insuranceFields, append: appendInsurance, remove: removeInsurance } = useFieldArray({
    control,
    name: "insurances"
  });

  const { fields: policyFields, append: appendPolicy, remove: removePolicy } = useFieldArray({
    control,
    name: "policies"
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
        // We no longer fetch global policies/insurances here as we use site-specific ones
        setIsLoading(false);

        if (initialData) {
            reset(initialData);
            setCompletedTabs(new Set<Tab>(['General', 'Management', 'Agreement', 'Compliance', 'Holidays', 'Assets', 'Billing', 'Verification', 'Policies/Insurance']));
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
                agreementDetails: { renewalTriggerDays: 30, minWageTriggerDays: 15 },
                complianceDetails: { form6Applicable: false, minWageRevisionApplicable: true },
                holidayConfig: { numberOfDays: 10, salaryRule: 'Full', billingRule: 'Full' },
                verificationData: {
                    categories: VERIFICATION_CATEGORIES.map(cat => ({
                        name: cat.name,
                        employmentPlusPolice: [...cat.empPlusPol],
                        policeOnly: [...cat.polOnly]
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

  const AddRoleInput: React.FC<{ onAdd: (role: string) => void }> = ({ onAdd }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [value, setLocalValue] = useState('');

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
        <input
          autoFocus
          className="bg-white/80 border border-accent/30 rounded-lg px-3 py-1.5 text-[11px] font-medium outline-none focus:ring-2 focus:ring-accent/20 w-36 placeholder:text-muted/50"
          placeholder="New role name..."
          value={value}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (value.trim()) {
                onAdd(value.trim());
                setLocalValue('');
                setIsAdding(false);
              }
            } else if (e.key === 'Escape') {
              setIsAdding(false);
            }
          }}
          onBlur={() => {
            if (!value.trim()) setIsAdding(false);
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (value.trim()) {
                onAdd(value.trim());
                setLocalValue('');
            }
            setIsAdding(false);
          }}
          className="p-1.5 bg-accent text-white rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    );
  };



  const getTabErrors = (tab: Tab, currentErrors: any = errors) => {
    switch (tab) {
      case 'General':
        return currentErrors.name || currentErrors.emails || currentErrors.gstNumber || currentErrors.panNumber || currentErrors.email || currentErrors.siteTakeoverDate;
      case 'Management':
        return currentErrors.siteManagement;
      case 'Agreement':
        return currentErrors.agreementDetails;
      case 'Compliance':
        return currentErrors.complianceDetails;
      case 'Holidays':
        return currentErrors.holidayConfig;
      case 'Assets':
        return currentErrors.assetTracking;
      case 'Billing':
        return currentErrors.billingControls;
      case 'Verification':
        return currentErrors.verificationData;
      case 'Policies/Insurance':
        return currentErrors.policyIds || currentErrors.insuranceIds;
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
    const draftData = { ...data, status: 'draft' as const };
    // Skip full validation for draft
    onSave(draftData, pendingFiles);
  };

  const onError = (errors: any) => {
    const tabOrder: Tab[] = ['General', 'Management', 'Agreement', 'Compliance', 'Holidays', 'Assets', 'Billing', 'Verification', 'Policies/Insurance'];
    for (const tab of tabOrder) {
      if (getTabErrors(tab, errors)) {
        setActiveTab(tab);
        break;
      }
    }
  };

  const handleNext = async () => {
    const tabOrder: Tab[] = ['General', 'Management', 'Agreement', 'Compliance', 'Holidays', 'Assets', 'Billing', 'Verification', 'Policies/Insurance'];
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
    const tabOrder: Tab[] = ['General', 'Management', 'Agreement', 'Compliance', 'Holidays', 'Assets', 'Billing', 'Verification', 'Policies/Insurance'];
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
    }
  };

  const handleFileUpload = (field: string, file: File) => {
    setPendingFiles(prev => ({ ...prev, [field]: file }));
  };

  if (!isOpen) return null;

  const TabButton: React.FC<{ tabName: Tab }> = ({ tabName }) => {
    const hasError = !!getTabErrors(tabName);
    const isCompleted = completedTabs.has(tabName);
    
    return (
      <button
        type="button"
        onClick={() => setActiveTab(tabName)}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 flex items-center gap-2 transition-all ${activeTab === tabName ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-muted hover:text-primary-text'}`}
      >
        <span>{tabName}</span>
        {hasError ? (
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
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
               {!isEditing && (
                   <Button type="button" onClick={onSaveDraft} variant="outline" className="px-6 border-accent text-accent hover:bg-accent/5">Save Draft</Button>
               )}
               <Button 
                    type="submit" 
                    variant="primary" 
                    className={`px-8 shadow-lg shadow-emerald-500/20 ${(completedTabs.size < 9 && !isEditing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={completedTabs.size < 9 && !isEditing}
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
                <TabButton tabName="Billing" />
                <TabButton tabName="Verification" />
                <TabButton tabName="Policies/Insurance" />
            </nav>
          </div>
          
          <div className="space-y-6 min-h-[450px]">
            {activeTab === 'General' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Society Name (as per document)" id="name" registration={register('name')} error={errors.name?.message} />
                        {!companyName && companies && (
                            <Select label="Select Company" id="companyId" registration={register('companyId')} error={errors.companyId?.message}>
                                <option value="">Select Company</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </Select>
                        )}
                        <Input label="Billing Name" id="billingName" registration={register('billingName')} error={errors.billingName?.message} />
                        <Input label="Location / City" id="location" registration={register('location')} error={errors.location?.message} />
                        <Controller name="siteTakeoverDate" control={control} render={({ field }) => (
                            <DatePicker label="Site Takeover Date" id="siteTakeoverDate" value={field.value} onChange={field.onChange} error={errors.siteTakeoverDate?.message} />
                        )} />
                    </div>
                    <Input label="Registered Address" id="registeredAddress" registration={register('registeredAddress')} error={errors.registeredAddress?.message} />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="GST Number" id="gstNumber" registration={register('gstNumber')} error={errors.gstNumber?.message} placeholder="22AAAAA0000A1Z5" />
                        <Input label="PAN Number" id="panNumber" registration={register('panNumber')} error={errors.panNumber?.message} placeholder="ABCDE1234F" />
                        <Select label="Registration Type" id="registrationType" registration={register('registrationType')} error={errors.registrationType?.message}>
                            <option value="">Select Type</option><option value="CIN">CIN</option><option value="ROC">ROC</option><option value="ROF">ROF</option><option value="Society">Society</option><option value="Trust">Trust</option>
                        </Select>
                        <Input label="Registration Number" id="registrationNumber" registration={register('registrationNumber')} error={errors.registrationNumber?.message} />
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
                            <DatePicker label="KAM Effective Date" id="kamEffectiveDate" value={field.value} onChange={field.onChange} error={errors.siteManagement?.kamEffectiveDate?.message} />
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
                        <Input label="Number of Units (Apartments/Villas)" id="unitCount" type="number" registration={register('siteManagement.unitCount')} error={errors.siteManagement?.unitCount?.message} />
                    </div>
                </div>
            )}
            {activeTab === 'Agreement' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-accent/5 border border-accent/20 rounded-xl">
                        <Controller name="agreementDetails.fromDate" control={control} render={({ field }) => (
                            <DatePicker label="Agreement From Date" id="agreementFrom" value={field.value} onChange={field.onChange} error={errors.agreementDetails?.fromDate?.message} />
                        )} />
                        <Controller name="agreementDetails.toDate" control={control} render={({ field }) => (
                            <DatePicker label="Agreement To Date" id="agreementTo" value={field.value} onChange={field.onChange} error={errors.agreementDetails?.toDate?.message} />
                        )} />
                        
                        <Input label="Auto Renewal Trigger (Days before)" id="renewalTrigger" type="number" registration={register('agreementDetails.renewalTriggerDays')} error={errors.agreementDetails?.renewalTriggerDays?.message} />
                        <Input label="Min Wage Trigger (Days before)" id="minWageTrigger" type="number" registration={register('agreementDetails.minWageTriggerDays')} error={errors.agreementDetails?.minWageTriggerDays?.message} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t">
                        <UploadDocument 
                            label="Agreement Word Copy (Soft Copy)" 
                            file={watch('agreementDetails.wordCopyUrl') ? { name: 'Current Document', preview: watch('agreementDetails.wordCopyUrl')!, type: 'application/msword', size: 0 } as UploadedFile : null} 
                            onFileChange={(f) => handleFileUpload('agreementDetails.wordCopy', f?.file!)} 
                        />
                        <UploadDocument 
                            label="Signed Agreement Copy (Scan)" 
                            file={watch('agreementDetails.signedCopyUrl') ? { name: 'Signed Document', preview: watch('agreementDetails.signedCopyUrl')!, type: 'application/pdf', size: 0 } as UploadedFile : null} 
                            onFileChange={(f) => handleFileUpload('agreementDetails.signedCopy', f?.file!)} 
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                        <Controller name="agreementDetails.agreementDate" control={control} render={({ field }) => (
                            <DatePicker label="Agreement Date" id="agreementDate" value={field.value} onChange={field.onChange} error={errors.agreementDetails?.agreementDate?.message} />
                        )} />
                        <Controller name="agreementDetails.addendum1Date" control={control} render={({ field }) => (
                            <DatePicker label="Addendum 1 Date" id="addendum1Date" value={field.value} onChange={field.onChange} error={errors.agreementDetails?.addendum1Date?.message} />
                        )} />
                        <Controller name="agreementDetails.addendum2Date" control={control} render={({ field }) => (
                            <DatePicker label="Addendum 2 Date" id="addendum2Date" value={field.value} onChange={field.onChange} error={errors.agreementDetails?.addendum2Date?.message} />
                        )} />
                    </div>
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
                                        <DatePicker label="Validity From" id="form6From" value={field.value} onChange={field.onChange} />
                                    )} />
                                    <Controller name="complianceDetails.form6ValidityTo" control={control} render={({ field }) => (
                                        <DatePicker label="Validity To" id="form6To" value={field.value} onChange={field.onChange} />
                                    )} />
                                    <Input label="Renewal Interval (Days)" id="form6Renewal" type="number" registration={register('complianceDetails.form6RenewalInterval')} />
                                </div>
                                <div className="max-w-md">
                                    <UploadDocument 
                                        label="Form 6 Document" 
                                        file={watch('complianceDetails.form6DocumentUrl') ? { name: 'Current Document', type: 'application/pdf', size: 0, preview: watch('complianceDetails.form6DocumentUrl') || '', url: watch('complianceDetails.form6DocumentUrl') || '' } : null} 
                                        onFileChange={(file) => {
                                            if (file?.file) {
                                                handleFileUpload('complianceDetails.form6Document', file.file);
                                            }
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
                                        <DatePicker label="Validity From" id="minWageFrom" value={field.value} onChange={field.onChange} />
                                    )} />
                                    <Controller name="complianceDetails.minWageRevisionValidityTo" control={control} render={({ field }) => (
                                        <DatePicker label="Validity To" id="minWageTo" value={field.value} onChange={field.onChange} />
                                    )} />
                                </div>
                                <div className="max-w-md">
                                    <UploadDocument 
                                        label="Min Wage Revision Document" 
                                        file={watch('complianceDetails.minWageRevisionDocumentUrl') ? { name: 'Current Document', type: 'application/pdf', size: 0, preview: watch('complianceDetails.minWageRevisionDocumentUrl') || '', url: watch('complianceDetails.minWageRevisionDocumentUrl') || '' } : null} 
                                        onFileChange={(file) => {
                                            if (file?.file) {
                                                handleFileUpload('complianceDetails.minWageRevisionDocument', file.file);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                        <Input label="E-Shram Number" id="eShramNumber" registration={register('eShramNumber')} error={errors.eShramNumber?.message} />
                        <Input label="Shop & Establishment Code" id="shopAndEstablishmentCode" registration={register('shopAndEstablishmentCode')} error={errors.shopAndEstablishmentCode?.message} />
                    </div>
                </div>
            )}

            {activeTab === 'Holidays' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-accent/5 border border-accent/20 rounded-xl">
                        <Select label="Total Festival Holidays" id="holidayCount" registration={register('holidayConfig.numberOfDays')}>
                            <option value={10}>10 Days</option>
                            <option value={12}>12 Days</option>
                        </Select>
                        <Input label="Logic Variation (e.g. 1+1, 1.5)" id="logicVariation" registration={register('holidayConfig.logicVariation')} placeholder="Overrides default rules" />
                        
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
                    
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> National & Festival Holiday List</h4>
                            <Button type="button" variant="secondary" size="sm" onClick={() => {
                                const holidays = watch('holidayConfig.holidays') || [];
                                setValue('holidayConfig.holidays', [...holidays, { date: '', description: '' }]);
                            }}>
                                <Plus className="h-4 w-4 mr-1" /> Add Holiday
                            </Button>
                        </div>
                        
                        {(watch('holidayConfig.holidays') || []).map((_, index) => (
                            <div key={index} className="grid grid-cols-12 gap-3 items-end bg-accent/5 p-3 rounded-lg border border-accent/20">
                                <div className="col-span-11 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Controller name={`holidayConfig.holidays.${index}.date`} control={control} render={({ field }) => (
                                        <DatePicker label="Date" id={`holidayDate-${index}`} value={field.value} onChange={field.onChange} />
                                    )} />
                                    <Input label="Description" id={`holidayDesc-${index}`} registration={register(`holidayConfig.holidays.${index}.description` as const)} />
                                </div>
                                <div className="col-span-1 flex justify-center">
                                    <Button type="button" variant="icon" onClick={() => {
                                        const holidays = watch('holidayConfig.holidays') || [];
                                        setValue('holidayConfig.holidays', holidays.filter((__, i) => i !== index));
                                    }} className="text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
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
                            <UploadDocument 
                                label="DC Copy 1" 
                                file={watch('assetTracking.dcCopy1Url') ? { name: 'DC Copy 1', type: 'image/jpeg', size: 0, preview: watch('assetTracking.dcCopy1Url') || '', url: watch('assetTracking.dcCopy1Url') || '' } : null} 
                                onFileChange={(file) => file?.file && handleFileUpload('assetTracking.dcCopy1', file.file)}
                            />
                            <UploadDocument 
                                label="DC Copy 2" 
                                file={watch('assetTracking.dcCopy2Url') ? { name: 'DC Copy 2', type: 'image/jpeg', size: 0, preview: watch('assetTracking.dcCopy2Url') || '', url: watch('assetTracking.dcCopy2Url') || '' } : null} 
                                onFileChange={(file) => file?.file && handleFileUpload('assetTracking.dcCopy2', file.file)}
                            />
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
                                            <DatePicker label="Issue Date" id={`toolDate-${index}`} value={dateField.value} onChange={dateField.onChange} />
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
                                            <DatePicker label="Issue Date" id={`equipDate-${index}`} value={dateField.value} onChange={dateField.onChange} />
                                        )} />
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

            {activeTab === 'Billing' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-accent/5 border border-accent/20 rounded-xl">
                        <Controller name="billingControls.billingCycleStart" control={control} render={({ field }) => (
                            <DatePicker label="Billing Cycle Start Date" id="billingCycle" value={field.value} onChange={field.onChange} />
                        )} />
                        <Controller name="billingControls.salaryDate" control={control} render={({ field }) => (
                            <DatePicker label="Salary Date" id="salaryDate" value={field.value} onChange={field.onChange} />
                        )} />
                    </div>
                    
                    <div className="bg-accent/5 border border-accent/20 p-4 rounded-xl space-y-4">
                        <Controller name="billingControls.uniformDeductions" control={control} render={({ field: { value, onChange } }) => (
                            <Checkbox 
                                id="uniformDeductions" 
                                label="Enable Uniform Deductions" 
                                checked={value} 
                                onChange={onChange}
                                labelClassName="font-bold text-primary-text"
                            />
                        )} />
                        
                        {watch('billingControls.uniformDeductions') && (
                            <div className="animate-fade-in pl-7 border-l-2 border-accent/20 ml-2">
                                <Input label="Deduction Category/Logic" id="deductionCat" registration={register('billingControls.deductionCategory')} placeholder="e.g. Fixed 500, % of Basic" />
                            </div>
                        )}
                    </div>

                    <div className="bg-accent/5 border border-accent/20 p-4 rounded-xl flex gap-3">
                        <CheckCircle className="h-5 w-5 text-accent mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-primary-text">Financial Linkage</h4>
                            <p className="text-xs text-muted mt-1 font-medium">
                                Costing sheet versioning and mapping is handled via Finance module linkage.
                            </p>
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
                                    <div className="h-2 w-2 rounded-full bg-accent" />
                                    <h3 className="text-sm font-bold text-primary-text uppercase tracking-wider">{cat.name}</h3>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Employment + Police */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-accent uppercase flex items-center gap-1.5">
                                            <Shield className="h-3.5 w-3.5" /> Employment + Police
                                        </label>
                                        <div className="bg-accent/5 border border-accent/10 rounded-xl p-3 min-h-[100px] flex flex-wrap gap-2 content-start">
                                            {(() => {
                                                const currentRoles = watch(`verificationData.categories.${catIdx}.employmentPlusPolice`) || [];
                                                const allRoles = Array.from(new Set([...(cat.empPlusPol || []), ...currentRoles]));
                                                
                                                return (
                                                    <>
                                                        {allRoles.map(role => {
                                                            const isSelected = currentRoles.includes(role);
                                                            return (
                                                                <button
                                                                    key={role}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newRoles = isSelected 
                                                                            ? currentRoles.filter(r => r !== role)
                                                                            : [...currentRoles, role];
                                                                        setValue(`verificationData.categories.${catIdx}.employmentPlusPolice`, newRoles);
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${isSelected 
                                                                        ? 'bg-accent text-white border-accent shadow-sm scale-105' 
                                                                        : 'bg-white/50 text-muted border-border hover:border-accent/30 hover:text-primary-text'}`}
                                                                >
                                                                    {role}
                                                                </button>
                                                            );
                                                        })}
                                                        <AddRoleInput onAdd={(role) => {
                                                            const current = watch(`verificationData.categories.${catIdx}.employmentPlusPolice`) || [];
                                                            if (!current.includes(role)) {
                                                                setValue(`verificationData.categories.${catIdx}.employmentPlusPolice`, [...current, role]);
                                                            }
                                                        }} />
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Police Only */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-primary-text uppercase flex items-center gap-1.5">
                                            <AlertCircle className="h-3.5 w-3.5" /> Police Verification Only
                                        </label>
                                        <div className="bg-card/30 border border-border rounded-xl p-3 min-h-[100px] flex flex-wrap gap-2 content-start">
                                            {(() => {
                                                const currentRoles = watch(`verificationData.categories.${catIdx}.policeOnly`) || [];
                                                const allRoles = Array.from(new Set([...(cat.polOnly || []), ...currentRoles]));

                                                return (
                                                    <>
                                                        {allRoles.map(role => {
                                                            const isSelected = currentRoles.includes(role);
                                                            return (
                                                                <button
                                                                    key={role}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newRoles = isSelected 
                                                                            ? currentRoles.filter(r => r !== role)
                                                                            : [...currentRoles, role];
                                                                        setValue(`verificationData.categories.${catIdx}.policeOnly`, newRoles);
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${isSelected 
                                                                        ? 'bg-primary-text text-white border-primary-text shadow-sm scale-105' 
                                                                        : 'bg-white/50 text-muted border-border hover:border-primary-text/30 hover:text-primary-text'}`}
                                                                >
                                                                    {role}
                                                                </button>
                                                            );
                                                        })}
                                                        <AddRoleInput onAdd={(role) => {
                                                            const current = watch(`verificationData.categories.${catIdx}.policeOnly`) || [];
                                                            if (!current.includes(role)) {
                                                                setValue(`verificationData.categories.${catIdx}.policeOnly`, [...current, role]);
                                                            }
                                                        }} />
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'Policies/Insurance' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-slide-up">
                    {/* Insurances Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h4 className="text-lg font-bold text-primary-text flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-accent" />
                                Insurances
                            </h4>
                            <Button 
                                type="button" 
                                size="sm" 
                                onClick={() => appendInsurance({ id: `ins_${Date.now()}`, provider: '', type: 'GMC', policyNumber: '', validTill: null, documentUrl: null })} 
                                className="!rounded-full text-xs font-bold shadow-sm"
                                variant="secondary"
                            >
                                <Plus className="h-4 w-4 mr-1" /> New Entry
                            </Button>
                        </div>
                        
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar p-1">
                            {insuranceFields.map((field, index) => (
                                <div key={field.id} className="p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all relative group">
                                    <button 
                                        type="button" 
                                        onClick={() => removeInsurance(index)} 
                                        className="absolute top-4 right-4 p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-full dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-5">
                                        <div className="col-span-2 sm:col-span-1">
                                            <Input label="Insurance Provider" id={`ins_provider_${field.id}`} registration={register(`insurances.${index}.provider`)} error={errors.insurances?.[index]?.provider?.message} placeholder="e.g. Star Health" />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <Select label="Insurance Type" id={`ins_type_${field.id}`} registration={register(`insurances.${index}.type`)} error={errors.insurances?.[index]?.type?.message}>
                                                <option value="GMC">GMC (Group Medical)</option>
                                                <option value="GPA">GPA (Personal Accident)</option>
                                                <option value="WC">WC (Workmen Comp)</option>
                                                <option value="Other">Other</option>
                                            </Select>
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <Input label="Policy Number" id={`ins_no_${field.id}`} registration={register(`insurances.${index}.policyNumber`)} placeholder="POL-123456" />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <Controller
                                                name={`insurances.${index}.validTill`}
                                                control={control}
                                                render={({ field: dateField }) => (
                                                    <DatePicker label="Valid Till" id={`ins_valid_${field.id}`} value={dateField.value} onChange={dateField.onChange} />
                                                )}
                                            />
                                        </div>
                                    </div>
                                    
                                    <UploadDocument
                                        label="Insurance Policy Document"
                                        file={watch(`insurances.${index}.documentUrl`) ? { name: 'Current Policy Document', preview: watch(`insurances.${index}.documentUrl`) as string, type: 'application/pdf', size: 0 } : null}
                                        onFileChange={(f) => f && handleFileUpload(`insurances.${index}.document`, f.file!)}
                                    />
                                </div>
                            ))}
                            
                            {insuranceFields.length === 0 && (
                                <div className="p-16 text-center border-2 border-dashed border-border/40 rounded-3xl bg-page/30 flex flex-col items-center justify-center">
                                    <div className="p-4 bg-muted/5 rounded-full mb-4">
                                        <ShieldAlert className="h-12 w-12 text-muted/30" />
                                    </div>
                                    <p className="text-sm font-medium text-muted mb-1 uppercase tracking-wider">No insurance records</p>
                                    <p className="text-xs text-muted/60 italic">Add a new record for this site to get started.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Internal Policies Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h4 className="text-lg font-bold text-primary-text flex items-center gap-2">
                                <FileText className="h-5 w-5 text-accent" />
                                Internal Policies
                            </h4>
                            <Button 
                                type="button" 
                                size="sm" 
                                onClick={() => appendPolicy({ id: `pol_${Date.now()}`, name: '', level: 'Site', documentUrl: null })} 
                                className="!rounded-full text-xs font-bold shadow-sm"
                                variant="secondary"
                            >
                                <Plus className="h-4 w-4 mr-1" /> New Entry
                            </Button>
                        </div>

                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar p-1">
                            {policyFields.map((field, index) => (
                                <div key={field.id} className="p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all relative group">
                                    <button 
                                        type="button" 
                                        onClick={() => removePolicy(index)} 
                                        className="absolute top-4 right-4 p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-full dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-5">
                                        <div className="col-span-2 sm:col-span-1">
                                            <Input label="Policy Name" id={`pol_name_${field.id}`} registration={register(`policies.${index}.name`)} error={errors.policies?.[index]?.name?.message} placeholder="e.g. Leave Policy" />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <Select label="Deployment Level" id={`pol_level_${field.id}`} registration={register(`policies.${index}.level`)} error={errors.policies?.[index]?.level?.message}>
                                                <option value="BO">Back Office Only</option>
                                                <option value="Site">Site Only</option>
                                                <option value="Both">Both Back Office & Site</option>
                                            </Select>
                                        </div>
                                    </div>
                                    
                                    <UploadDocument
                                        label="Policy Document"
                                        file={watch(`policies.${index}.documentUrl`) ? { name: 'Current Policy Document', preview: watch(`policies.${index}.documentUrl`) as string, type: 'application/pdf', size: 0 } : null}
                                        onFileChange={(f) => f && handleFileUpload(`policies.${index}.document`, f.file!)}
                                    />
                                </div>
                            ))}
                            
                            {policyFields.length === 0 && (
                                <div className="p-16 text-center border-2 border-dashed border-border/40 rounded-3xl bg-page/30 flex flex-col items-center justify-center">
                                    <div className="p-4 bg-muted/5 rounded-full mb-4">
                                        <FileWarning className="h-12 w-12 text-muted/30" />
                                    </div>
                                    <p className="text-sm font-medium text-muted mb-1 uppercase tracking-wider">No internal policies</p>
                                    <p className="text-xs text-muted/60 italic">Upload organizational policies for this site.</p>
                                </div>
                            )}
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
            
            {activeTab !== 'Policies/Insurance' ? (
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
        </form>
    </div>
  );
};

export default EntityForm;