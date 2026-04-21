import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller, SubmitHandler } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Company, RegistrationType, UploadedFile, CompanyEmail, ComplianceCodes, ComplianceDocument, CompanyHoliday, CompanyInsurance, CompanyPolicy } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import UploadDocument from '../UploadDocument';
import MultiUploadDocument from '../MultiUploadDocument';
import Toast from '../ui/Toast';
import { Plus, Trash2, Calendar, FileText, Sparkles, Search, ChevronDown, Eye, ChevronUp } from 'lucide-react';
import CompanyProfilePreview from './CompanyProfilePreview';
import { FIXED_HOLIDAYS, HOLIDAY_SELECTION_POOL } from '../../utils/constants';
import { useNavigate } from 'react-router-dom';
import { getProxyUrl, getUploadedFileFromUrl } from '../../utils/fileUrl';

interface CompanyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Company>, pendingFiles: Record<string, UploadedFile | UploadedFile[]>) => void;
  initialData: Partial<Company> | null;
  groupName: string;
  existingLocations: string[];
}

const companySchema = yup.object({
  id: yup.string(),
  name: yup.string().required('Company Name is required'),
  location: yup.string().required('Location is required'),
  address: yup.string().required('Registered Address is required'),
  
  // Basic Details
  registrationType: yup.string<RegistrationType>().required('Registration Type is required'),
  registrationNumber: yup.string().required('Registration Number is required'),
  gstNumber: yup.string()
    .required('GST Number is required')
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST format (15 characters)')
    .nullable(),
  gstDocUrl: yup.string().optional().nullable(),
  panNumber: yup.string()
    .required('PAN Number is required')
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format (e.g. ABCDE1234F)')
    .nullable(),
  panDocUrl: yup.string().optional().nullable(),
  logoUrl: yup.string().optional().nullable(),

  // New specific registration fields
  cinNumber: yup.string().optional(),
  cinDocUrl: yup.string().optional().nullable(),
  dinNumber: yup.string().optional(),
  dinDocUrl: yup.string().optional().nullable(),
  tanNumber: yup.string().optional(),
  tanDocUrl: yup.string().optional().nullable(),
  udyogNumber: yup.string().optional(),
  udyogDocUrl: yup.string().optional().nullable(),
  msmeDocUrl: yup.string().optional().nullable(),
  labourRegistrationDocUrl: yup.string().optional().nullable(),
  shopEstablishmentDocUrl: yup.string().optional().nullable(),
  rtecDocUrl: yup.string().optional().nullable(),
  ptecDocUrl: yup.string().optional().nullable(),
  ptpEnrolmentDocUrl: yup.string().optional().nullable(),
  ptpRegistrationDocUrl: yup.string().optional().nullable(),
  
  // Arrays & Nested
  emails: yup.array().of(
    yup.object({
      id: yup.string().required(),
      email: yup.string().email('Invalid email format').required('Email is required')
    })
  ).max(5).optional(),
  
  complianceCodes: yup.object({
    eShramNumber: yup.string().optional(),
    eShramDocUrl: yup.string().optional().nullable(),
    shopAndEstablishmentCode: yup.string().optional(),
    shopAndEstablishmentValidTill: yup.string().optional().nullable(),
    epfoCode: yup.string()
        .required('EPFO Code is required')
        .matches(/^[A-Z]{2}[A-Z]{2}[0-9]{7}[0-9]{3}[0-9]{7}$/, 'Invalid EPFO format (22 characters)'),
    epfoDocUrl: yup.string().optional().nullable(),
    esicCode: yup.string()
        .required('ESIC Code is required')
        .matches(/^[0-9]{17}$/, 'Invalid ESIC format (17 digits)'),
    esicDocUrl: yup.string().optional().nullable(),
    psaraLicenseNumber: yup.string().optional(),
    psaraValidTill: yup.string().optional().nullable(),
  }).optional(),
  
  complianceDocuments: yup.array().of(
    yup.object({
      id: yup.string().required(),
      type: yup.string().required(),
      documentUrls: yup.array().of(yup.string()).optional().nullable(),
      expiryDate: yup.string().optional().nullable(),
    })
  ).optional(),
  
  holidays: yup.array().of(
    yup.object({
      id: yup.string().required(),
      date: yup.string().required('Date is required'),
      year: yup.number().required('Year is required'),
      festivalName: yup.string().required('Festival Name is required'),
    })
  ).optional(),
  
  insurances: yup.array().of(
    yup.object({
      id: yup.string().required(),
      name: yup.string().required(),
      documentUrls: yup.array().of(yup.string()).optional().nullable(),
    })
  ).optional(),
  
  policies: yup.array().of(
    yup.object({
      id: yup.string().required(),
      name: yup.string().required(),
      level: yup.string().oneOf(['BO', 'Site', 'Both']).required(),
      documentUrls: yup.array().of(yup.string()).optional().nullable(),
      description: yup.string().optional(),
    })
  ).optional(),
}).defined();

type Tab = 'Details' | 'Contacts' | 'License' | 'Documents' | 'Holidays' | 'Policies' | 'Preview';

const CompanyForm: React.FC<CompanyFormProps> = ({ isOpen, onClose, onSave, initialData, groupName, existingLocations }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('Details');
  const [pendingFiles, setPendingFiles] = useState<Record<string, UploadedFile | UploadedFile[]>>({});
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  const { register, handleSubmit, formState: { errors }, reset, control, watch } = useForm<Partial<Company>>({
    resolver: yupResolver(companySchema) as any,
    defaultValues: {
      emails: [{ id: `email_${Date.now()}_1`, email: '' }, { id: `email_${Date.now()}_2`, email: '' }],
      complianceCodes: {
      },
      complianceDocuments: [],
      holidays: [],
      insurances: [],
      policies: []
    }
  });

  const { fields: emailFields, append: appendEmail, remove: removeEmail } = useFieldArray({
    control, name: 'emails'
  });

  const { fields: docFields, append: appendDoc, remove: removeDoc } = useFieldArray({
    control, name: 'complianceDocuments'
  });

  const { fields: holFields, append: appendHol, remove: removeHol, replace: replaceHol } = useFieldArray({
    control, name: 'holidays'
  });

  const { fields: insFields, append: appendIns, remove: removeIns } = useFieldArray({
    control, name: 'insurances'
  });

  const [docFilters, setDocFilters] = useState({
    type: '',
    effectiveDate: '',
    announcedDate: '',
    search: ''
  });

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const toggleExpanded = (id: string) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));

  const { fields: polFields, append: appendPol, remove: removePol } = useFieldArray({
    control, name: 'policies'
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    registration: false,
    statutory: false
  });

  const isEditing = !!initialData;

  useEffect(() => {
    if (isOpen) {
      setPendingFiles({});
      setActiveTab('Details');
      if (initialData) {
        reset(initialData);
      } else {
        reset({ 
            name: '', location: '', address: '',
            emails: [{ id: `email_${Date.now()}_1`, email: '' }, { id: `email_${Date.now()}_2`, email: '' }],
            complianceCodes: {}, complianceDocuments: [], holidays: [], insurances: [], policies: []
        });
      }
    }
  }, [initialData, reset, isOpen]);

  const formData = watch();
  
  const logoPreview = pendingFiles['logo'] && !Array.isArray(pendingFiles['logo']) 
    ? (pendingFiles['logo'] as UploadedFile).preview
    : getProxyUrl(formData.logoUrl || '');

  const onSubmit: SubmitHandler<Partial<Company>> = (data) => {
    onSave({ ...data, status: 'completed' }, pendingFiles);
  };

  const onInvalid = () => {
    setToast({ message: "Missing mandatory fields to create a profile. Please fill them, or use 'Save Draft' to continue later.", type: 'error' });
  };

  const handleSaveDraft = () => {
    const data = watch();
    if (!data.name?.trim()) {
      setToast({ message: 'Company Name is required to save a draft.', type: 'error' });
      return;
    }
    onSave({ ...data, status: 'draft' }, pendingFiles);
  };

  const setFile = (key: string, file: UploadedFile | null) => {
    setPendingFiles(prev => {
        const next = { ...prev };
        if (file) {
            next[key] = file;
        } else {
            delete next[key];
        }
        return next;
    });
  };

  const setFiles = (key: string, uploadedFiles: UploadedFile[]) => {
    setPendingFiles(prev => {
        const next = { ...prev };
        if (uploadedFiles.length > 0) {
            next[key] = uploadedFiles;
        } else {
            delete next[key];
        }
        return next;
    });
  };

  if (!isOpen) return null;

  const hasTabError = (tab: Tab) => {
    switch (tab) {
      case 'Details':
        return !!(errors.name || errors.location || errors.address || errors.registrationType || errors.registrationNumber || errors.gstNumber || errors.panNumber);
      case 'Contacts':
        return !!errors.emails;
      case 'License':
        return !!errors.complianceCodes;
      case 'Documents':
        return !!errors.complianceDocuments;
      case 'Holidays':
        return !!errors.holidays;
      case 'Policies':
        return !!(errors.insurances || errors.policies);
      default:
        return false;
    }
  };

  const TabButton = ({ tabName }: { tabName: Tab }) => {
    const hasError = hasTabError(tabName);
    return (
      <button
        type="button"
        onClick={() => setActiveTab(tabName)}
        className={`relative whitespace-nowrap px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === tabName ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-primary-text'}`}
      >
        {tabName}
        {hasError && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white shadow-sm animate-pulse" />
        )}
      </button>
    );
  };

  return (
    <div className="p-4 border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card w-full animate-fade-in relative">
        <form 
          onSubmit={handleSubmit(onSubmit, onInvalid)} 
          className="flex flex-col w-full bg-card overflow-visible"
        >
          <div className="pb-0 flex-shrink-0">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold text-primary-text">{isEditing ? 'Edit Company Profile' : 'Add New Company'}</h3>
                <p className="text-sm text-muted">for {groupName}</p>
              </div>
              <div className="flex items-center gap-3">
                 <Button type="button" onClick={onClose} variant="secondary" className="px-6">Cancel</Button>
                 <Button type="button" onClick={handleSaveDraft} variant="outline" className="px-6 border-accent text-accent hover:bg-accent/10">Save Draft</Button>
                 <Button type="submit" variant="primary" className="px-8 shadow-lg shadow-emerald-500/20">{isEditing ? 'Save Changes' : 'Create Profile'}</Button>
              </div>
            </div>
            
            <div className="border-b border-border overflow-x-auto no-scrollbar mb-8">
              <nav className="-mb-px flex space-x-1 sm:space-x-4 min-w-max pb-1 text-base">
                  <TabButton tabName="Details" />
                  <TabButton tabName="Contacts" />
                  <TabButton tabName="License" />
                  <TabButton tabName="Documents" />
                  <TabButton tabName="Holidays" />
                  <TabButton tabName="Policies" />
                  <TabButton tabName="Preview" />
              </nav>
            </div>
          </div>
          
          <div className="flex-1 py-2 min-h-[60vh]">
             {/* General Details Tab */}
            {activeTab === 'Details' && (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="md:col-span-2">
                        <Input label="Company / LLP / Partnership / Society Name" id="name" registration={register('name')} error={errors.name?.message} />
                    </div>
                    <div>
                        <Input label="Location (Select or Type New)" id="location" list="existing-locations" registration={register('location')} error={errors.location?.message} />
                        <datalist id="existing-locations">{existingLocations.map(l => <option key={l} value={l} />)}</datalist>
                    </div>
                    <Input label="Registered Address" id="address" registration={register('address')} error={errors.address?.message} />
                    
                    <div className="md:col-span-2 mt-4 overflow-hidden border border-border/50 rounded-2xl bg-page/40 shadow-sm">
                        <button 
                            type="button"
                            onClick={() => setExpandedSections(prev => ({ ...prev, registration: !prev.registration }))}
                            className="w-full flex items-center justify-between p-6 hover:bg-page/50 transition-colors"
                        >
                            <h4 className="text-lg font-bold text-primary-text border-l-4 border-accent pl-3">Registration & Identification</h4>
                            {expandedSections.registration ? <ChevronUp className="h-5 w-5 text-accent" /> : <ChevronDown className="h-5 w-5 text-accent" />}
                        </button>
                        
                        {expandedSections.registration && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 pt-0 animate-in slide-in-from-top-2 duration-300">
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
                                    <Input label="CIN Number" id="cinNumber" registration={register('cinNumber')} error={errors.cinNumber?.message} />
                                    <Controller name="cinDocUrl" control={control} render={({ field }) => (
                                        <UploadDocument 
                                            label="CIN Document" 
                                            file={(pendingFiles['cinDoc'] as UploadedFile) || getUploadedFileFromUrl(field.value)}
                                            onFileChange={(f) => { setFile('cinDoc', f); if (!f) field.onChange(''); }}
                                        />
                                    )} />
                                </div>
                                <div className="space-y-4">
                                    <Input label="DIN Number" id="dinNumber" registration={register('dinNumber')} error={errors.dinNumber?.message} />
                                    <Controller name="dinDocUrl" control={control} render={({ field }) => (
                                        <UploadDocument 
                                            label="DIN Document" 
                                            file={(pendingFiles['dinDoc'] as UploadedFile) || getUploadedFileFromUrl(field.value)}
                                            onFileChange={(f) => { setFile('dinDoc', f); if (!f) field.onChange(''); }}
                                        />
                                    )} />
                                </div>
                                <div className="space-y-4">
                                    <Input label="TAN Number" id="tanNumber" registration={register('tanNumber')} error={errors.tanNumber?.message} />
                                    <Controller name="tanDocUrl" control={control} render={({ field }) => (
                                        <UploadDocument 
                                            label="TAN Document" 
                                            file={(pendingFiles['tanDoc'] as UploadedFile) || getUploadedFileFromUrl(field.value)}
                                            onFileChange={(f) => { setFile('tanDoc', f); if (!f) field.onChange(''); }}
                                        />
                                    )} />
                                </div>
                                <div className="space-y-4">
                                    <Input label="GST Number" id="gstNumber" registration={register('gstNumber')} error={errors.gstNumber?.message} />
                                    <Controller name="gstDocUrl" control={control} render={({ field }) => (
                                        <UploadDocument 
                                            label="GST Attachment" 
                                            file={(pendingFiles['gstDoc'] as UploadedFile) || getUploadedFileFromUrl(field.value)}
                                            onFileChange={(f) => { setFile('gstDoc', f); if (!f) field.onChange(''); }}
                                        />
                                    )} />
                                </div>
                                <div className="space-y-4">
                                    <Input label="PAN Number" id="panNumber" registration={register('panNumber')} error={errors.panNumber?.message} />
                                    <Controller name="panDocUrl" control={control} render={({ field }) => (
                                        <UploadDocument 
                                            label="PAN Attachment" 
                                            file={(pendingFiles['panDoc'] as UploadedFile) || getUploadedFileFromUrl(field.value)}
                                            onFileChange={(f) => { setFile('panDoc', f); if (!f) field.onChange(''); }}
                                        />
                                    )} />
                                </div>
                                <div className="space-y-4">
                                    <Input label="Udyog Number" id="udyogNumber" registration={register('udyogNumber')} error={errors.udyogNumber?.message} />
                                    <Controller name="udyogDocUrl" control={control} render={({ field }) => (
                                        <UploadDocument 
                                            label="Udyog Document" 
                                            file={(pendingFiles['udyogDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                            onFileChange={(f) => { setFile('udyogDoc', f); if (!f) field.onChange(''); }}
                                        />
                                    )} />
                                </div>
                                <div className="space-y-4">
                                    <Controller name="msmeDocUrl" control={control} render={({ field }) => (
                                        <UploadDocument 
                                            label="MSME Certificate" 
                                            file={(pendingFiles['msmeDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                            onFileChange={(f) => { setFile('msmeDoc', f); if (!f) field.onChange(''); }}
                                        />
                                    )} />
                                </div>
                            </div>
                        )}

                        <div className="border-t border-border">
                            <button 
                                type="button"
                                onClick={() => setExpandedSections(prev => ({ ...prev, statutory: !prev.statutory }))}
                                className="w-full flex items-center justify-between p-6 hover:bg-page/50 transition-colors"
                            >
                                <h4 className="text-lg font-bold text-primary-text border-l-4 border-emerald-500 pl-3">EPFO, ESIC & E-Shram Details</h4>
                                {expandedSections.statutory ? <ChevronUp className="h-5 w-5 text-emerald-500" /> : <ChevronDown className="h-5 w-5 text-emerald-500" />}
                            </button>

                            {expandedSections.statutory && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 pt-0 animate-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-4">
                                        <Input label="EPFO Code" id="epfo" registration={register('complianceCodes.epfoCode')} error={errors.complianceCodes?.epfoCode?.message} />
                                        <Controller name="complianceCodes.epfoDocUrl" control={control} render={({ field }) => (
                                            <UploadDocument 
                                                label="EPFO Document" 
                                                file={(pendingFiles['epfoDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                                onFileChange={(f) => { setFile('epfoDoc', f); if (!f) field.onChange(''); }}
                                            />
                                        )} />
                                    </div>
                                    <div className="space-y-4">
                                        <Input label="ESIC Code" id="esic" registration={register('complianceCodes.esicCode')} error={errors.complianceCodes?.esicCode?.message} />
                                        <Controller name="complianceCodes.esicDocUrl" control={control} render={({ field }) => (
                                            <UploadDocument 
                                                label="ESIC Document" 
                                                file={(pendingFiles['esicDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                                onFileChange={(f) => { setFile('esicDoc', f); if (!f) field.onChange(''); }}
                                            />
                                        )} />
                                    </div>
                                    <div className="space-y-4">
                                        <Input label="E-Shram Number" id="shram" registration={register('complianceCodes.eShramNumber')} error={errors.complianceCodes?.eShramNumber?.message} />
                                        <Controller name="complianceCodes.eShramDocUrl" control={control} render={({ field }) => (
                                            <UploadDocument 
                                                label="E-Shram Document" 
                                                file={(pendingFiles['shramDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                                onFileChange={(f) => { setFile('shramDoc', f); if (!f) field.onChange(''); }}
                                            />
                                        )} />
                                    </div>
                                    <div className="space-y-4">
                                        <Controller name="labourRegistrationDocUrl" control={control} render={({ field }) => (
                                            <UploadDocument 
                                                label="Labour Registration Certificate" 
                                                file={(pendingFiles['labourDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                                onFileChange={(f) => { setFile('labourDoc', f); if (!f) field.onChange(''); }}
                                            />
                                        )} />
                                    </div>
                                    <div className="space-y-4">
                                        <Controller name="shopEstablishmentDocUrl" control={control} render={({ field }) => (
                                            <UploadDocument 
                                                label="Shop & Establishment Document" 
                                                file={(pendingFiles['shopDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                                onFileChange={(f) => { setFile('shopDoc', f); if (!f) field.onChange(''); }}
                                            />
                                        )} />
                                    </div>
                                    <div className="space-y-4">
                                        <Controller name="rtecDocUrl" control={control} render={({ field }) => (
                                            <UploadDocument 
                                                label="RTEC Certificate" 
                                                file={(pendingFiles['rtecDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                                onFileChange={(f) => { setFile('rtecDoc', f); if (!f) field.onChange(''); }}
                                            />
                                        )} />
                                    </div>
                                    <div className="space-y-4">
                                        <Controller name="ptecDocUrl" control={control} render={({ field }) => (
                                            <UploadDocument 
                                                label="PTEC Certificate" 
                                                file={(pendingFiles['ptecDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                                onFileChange={(f) => { setFile('ptecDoc', f); if (!f) field.onChange(''); }}
                                            />
                                        )} />
                                    </div>
                                    <div className="space-y-4">
                                        <Controller name="ptpEnrolmentDocUrl" control={control} render={({ field }) => (
                                            <UploadDocument 
                                                label="Profession Tax Payer Enrolment Certificate" 
                                                file={(pendingFiles['ptpEnrolmentDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                                onFileChange={(f) => { setFile('ptpEnrolmentDoc', f); if (!f) field.onChange(''); }}
                                            />
                                        )} />
                                    </div>
                                    <div className="space-y-4">
                                        <Controller name="ptpRegistrationDocUrl" control={control} render={({ field }) => (
                                            <UploadDocument 
                                                label="Profession Tax Payer Registration Certificate" 
                                                file={(pendingFiles['ptpRegDoc'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                                                onFileChange={(f) => { setFile('ptpRegDoc', f); if (!f) field.onChange(''); }}
                                            />
                                        )} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                        <div className="md:col-span-1 mt-4 max-w-sm">
                           <Controller name="logoUrl" control={control} render={({ field }) => (
                           <UploadDocument 
                             label="Company Logo" 
                             variant="compact"
                             file={(pendingFiles['logo'] as UploadedFile) || (field.value ? getUploadedFileFromUrl(field.value) : null)}
                             onFileChange={(f) => { setFile('logo', f); if (!f) field.onChange(''); }}
                             allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
                           />
                           )} />
                        </div>
                </div>
                </>
            )}

            {/* Contacts Hub */}
            {activeTab === 'Contacts' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-lg font-semibold text-primary-text">Official Email Addresses</h4>
                            <p className="text-sm text-muted">A maximum of 5 emails can be associated with this organization.</p>
                        </div>
                        {emailFields.length < 5 && (
                            <Button type="button" variant="outline" size="sm" onClick={() => appendEmail({ id: `email_${Date.now()}`, email: '' })}>
                            <Plus className="w-4 h-4 mr-2"/> Add Email
                            </Button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        {emailFields.map((field, index) => (
                            <div key={field.id} className="relative p-4 border border-border rounded-xl bg-page/20 group animate-in fade-in slide-in-from-bottom-2">
                                <Input label={`Contact Email ${index + 1}`} id={`emails.${index}.email`} registration={register(`emails.${index}.email` as const)} error={errors.emails?.[index]?.email?.message} />
                                <Button type="button" variant="danger" size="sm" className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeEmail(index)} disabled={emailFields.length <= 1}>
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* License Tab (Formerly Compliance) */}
            {activeTab === 'License' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="md:col-span-2">
                         <h4 className="text-lg font-semibold text-primary-text mb-2">Government Licenses & Statutory Codes</h4>
                         <p className="text-sm text-muted">Manage Shop & Establishment and PSARA specific license details here.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                        <Input label="Shop & Establishment Code" id="shop" registration={register('complianceCodes.shopAndEstablishmentCode')} error={errors.complianceCodes?.shopAndEstablishmentCode?.message} />
                        <Input label="S & E Valid Till" id="shopdate" type="date" registration={register('complianceCodes.shopAndEstablishmentValidTill')} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                        <Input label="PSARA License Number" id="psara" registration={register('complianceCodes.psaraLicenseNumber')} />
                        <Input label="PSARA Valid Till" id="psaradate" type="date" registration={register('complianceCodes.psaraValidTill')} />
                    </div>
                </div>
            )}

            {/* Compliance Documents */}
            {activeTab === 'Documents' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-lg font-semibold text-primary-text">Government Notifications & Documents</h4>
                            <p className="text-sm text-muted">Upload only government notifications related to minimum wages, PT, PF, or ESI.</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => {
                            const newId = `doc_${Date.now()}`;
                            appendDoc({ id: newId, type: 'Minimum Wages Notifications', documentUrls: [], expiryDate: '', effectiveDate: '', announcedDate: '', editorLog: '' });
                            setExpandedItems(prev => ({ ...prev, [newId]: true }));
                        }}>
                            <Plus className="w-4 h-4 mr-2" /> Add Document
                        </Button>
                    </div>

                    {/* Filters Bar */}
                    <div className="p-4 border border-border rounded-2xl bg-page/40 flex flex-wrap items-end gap-4 shadow-sm">
                        <div className="flex-1 min-w-[200px]">
                            <Select label="Filter by Type" id="filter_type" value={docFilters.type} onChange={(e: any) => setDocFilters(prev => ({ ...prev, type: e.target.value }))}>
                                <option value="">All Types</option>
                                <option value="Minimum Wages Notifications">Minimum Wages Notifications</option>
                                <option value="PT Circulars & Notifications">PT Circulars & Notifications</option>
                                <option value="PF Circulars & Notifications">PF Circulars & Notifications</option>
                                <option value="ESI Circulars & Notifications">ESI Circulars & Notifications</option>
                                <option value="Other Government Notification">Other Government Notification</option>
                            </Select>
                        </div>
                        <div className="w-44">
                            <Input label="Eff. Date" id="filter_eff" type="date" value={docFilters.effectiveDate} onChange={(e: any) => setDocFilters(prev => ({ ...prev, effectiveDate: e.target.value }))} />
                        </div>
                        <div className="w-44">
                            <Input label="Ann. Date" id="filter_ann" type="date" value={docFilters.announcedDate} onChange={(e: any) => setDocFilters(prev => ({ ...prev, announcedDate: e.target.value }))} />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <Input label="Search Editor Log" id="filter_search" placeholder="Search history/notes..." value={docFilters.search} onChange={(e: any) => setDocFilters(prev => ({ ...prev, search: e.target.value }))} icon={<Search className="w-4 h-4" />} />
                        </div>
                        {(docFilters.type || docFilters.effectiveDate || docFilters.announcedDate || docFilters.search) && (
                            <Button type="button" variant="secondary" onClick={() => setDocFilters({ type: '', effectiveDate: '', announcedDate: '', search: '' })} className="h-10">Clear</Button>
                        )}
                    </div>

                    {/* Documents Table */}
                    {docFields.length > 0 && (() => {
                        const filteredDocs = docFields.map((field, index) => ({ field, index }))
                            .filter(({ index }) => {
                                const docValues = watch(`complianceDocuments.${index}`);
                                const matchesType = !docFilters.type || docValues?.type === docFilters.type;
                                const matchesEff = !docFilters.effectiveDate || docValues?.effectiveDate === docFilters.effectiveDate;
                                const matchesAnn = !docFilters.announcedDate || docValues?.announcedDate === docFilters.announcedDate;
                                const matchesSearch = !docFilters.search || docValues?.editorLog?.toLowerCase().includes(docFilters.search.toLowerCase());
                                return matchesType && matchesEff && matchesAnn && matchesSearch;
                            })
                            .sort((a, b) => {
                                const valA = watch(`complianceDocuments.${a.index}`);
                                const valB = watch(`complianceDocuments.${b.index}`);
                                const dateA = new Date(valA?.effectiveDate || valA?.announcedDate || 0).getTime();
                                const dateB = new Date(valB?.effectiveDate || valB?.announcedDate || 0).getTime();
                                return dateB - dateA;
                            });
                        
                        if (filteredDocs.length === 0) {
                            return (
                                <div className="p-12 text-center border-2 border-dashed border-border rounded-2xl bg-page/20">
                                    <Search className="w-12 h-12 text-muted mx-auto mb-4 opacity-20" />
                                    <p className="text-muted">No documents match your filter criteria.</p>
                                    <Button type="button" variant="secondary" className="mt-4" onClick={() => setDocFilters({ type: '', effectiveDate: '', announcedDate: '', search: '' })}>Clear All Filters</Button>
                                </div>
                            );
                        }

                        return (
                            <div className="border border-border rounded-2xl overflow-hidden bg-card">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-page/40">
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Document Type</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Eff. Date</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Ann. Date</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Valid Till</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Files</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDocs.map(({ field, index }) => {
                                            const docVal = watch(`complianceDocuments.${index}`);
                                            const businessId = docVal?.id || field.id;
                                            const isExpanded = expandedItems[businessId];
                                            const docCount = (docVal?.documentUrls?.length || 0) + ((pendingFiles[`doc_${businessId}`] as UploadedFile[])?.length || 0);
                                            return (
                                                <React.Fragment key={field.id}>
                                                    <tr className={`border-b border-border transition-colors hover:bg-page/30 ${isExpanded ? 'bg-accent/5' : ''}`}>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="w-4 h-4 text-accent flex-shrink-0" />
                                                                <span className="font-medium text-primary-text">{docVal?.type || 'Untitled'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-muted">{docVal?.effectiveDate || '—'}</td>
                                                        <td className="px-4 py-3 text-muted">{docVal?.announcedDate || '—'}</td>
                                                        <td className="px-4 py-3 text-muted">{docVal?.expiryDate || '—'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${docCount > 0 ? 'bg-accent/10 text-accent' : 'bg-page text-muted'}`}>
                                                                <FileText className="w-3 h-3" />{docCount}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                {docCount > 0 && docVal?.documentUrls?.[0] && (
                                                                    <button type="button" onClick={() => {
                                                                        const proxyUrl = getProxyUrl(docVal.documentUrls![0]);
                                                                        navigate(`/document-viewer?url=${encodeURIComponent(proxyUrl)}&title=${encodeURIComponent(docVal.type)}`);
                                                                    }} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" title="View Document">
                                                                        <Eye className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                <button type="button" onClick={() => toggleExpanded(businessId)} className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'text-accent bg-accent/10' : 'text-muted hover:text-accent hover:bg-accent/10'}`} title="Edit">
                                                                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                                </button>
                                                                <button type="button" onClick={() => removeDoc(index)} className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={6} className="p-0">
                                                                <div className="px-6 py-6 bg-page/20 border-b border-border">
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                       <div className="md:col-span-2">
                                                                           <Select label="Document Type" id={`docs.${index}.type`} registration={register(`complianceDocuments.${index}.type` as const)}>
                                                                               <option value="Minimum Wages Notifications">Minimum Wages Notifications</option>
                                                                               <option value="PT Circulars & Notifications">PT Circulars & Notifications</option>
                                                                               <option value="PF Circulars & Notifications">PF Circulars & Notifications</option>
                                                                               <option value="ESI Circulars & Notifications">ESI Circulars & Notifications</option>
                                                                               <option value="Other Government Notification">Other Government Notification</option>
                                                                           </Select>
                                                                       </div>
                                                                       
                                                                       <Input label="Effective Date" id={`docs.${index}.effective`} type="date" registration={register(`complianceDocuments.${index}.effectiveDate` as const)} />
                                                                       <Input label="Announced / Circulated Date" id={`docs.${index}.announced`} type="date" registration={register(`complianceDocuments.${index}.announcedDate` as const)} />
                                                                       <Input label="Valid Till" id={`docs.${index}.expiry`} type="date" registration={register(`complianceDocuments.${index}.expiryDate` as const)} />
                                                                       <Input label="Editor Log (Background Cron)" id={`docs.${index}.log`} registration={register(`complianceDocuments.${index}.editorLog` as const)} placeholder="Internal notes or cron reference..." />

                                                                       <div className="md:col-span-2 mt-2">
                                                                        <Controller name={`complianceDocuments.${index}.documentUrls` as const} control={control} render={({ field: f }) => {
                                                                               const pendingList = pendingFiles[`doc_${businessId}`] as UploadedFile[];
                                                                               const existingUrls = f.value || [];
                                                                               
                                                                               const displayFiles: UploadedFile[] = [
                                                                                   ...existingUrls.map(url => getUploadedFileFromUrl(url)).filter(Boolean) as UploadedFile[],
                                                                                   ...(Array.isArray(pendingList) ? pendingList : [])
                                                                               ];

                                                                               return (
                                                                                   <MultiUploadDocument 
                                                                                       label="Upload Document Capture" 
                                                                                       files={displayFiles}
                                                                                       onFilesChange={(newFileList) => {
                                                                                           const urlsOnly = newFileList.map(nf => nf.url).filter(Boolean) as string[];
                                                                                           setFiles(`doc_${businessId}`, newFileList);
                                                                                           f.onChange(urlsOnly);
                                                                                       }}
                                                                                   />
                                                                               );
                                                                          }} />
                                                                       </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Holidays Tab */}
            {activeTab === 'Holidays' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-lg font-semibold text-primary-text">Registered Company Holidays</h4>
                            <p className="text-sm text-muted">Create holiday schedules that apply to this organization globally.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-64">
                                <Select 
                                    id="holiday_preset"
                                    icon={<Sparkles className="w-4 h-4 text-accent" />}
                                    onChange={(e: any) => {
                                        const val = e.target.value;
                                        if (val === '10' || val === '12') {
                                            const limit = parseInt(val);
                                            const currentYear = new Date().getFullYear();
                                            
                                            // Combine fixed holidays with selection pool items
                                            const presetHolidays = [
                                                ...FIXED_HOLIDAYS.map(h => ({
                                                    id: `hol_${Date.now()}_${Math.random()}`,
                                                    date: `${currentYear}-${h.date}`,
                                                    year: currentYear,
                                                    festivalName: h.name
                                                })),
                                                ...HOLIDAY_SELECTION_POOL.slice(0, limit - FIXED_HOLIDAYS.length).map(h => ({
                                                    id: `hol_${Date.now()}_${Math.random()}`,
                                                    date: `${currentYear}${h.date}`, // h.date is like '-01-01'
                                                    year: currentYear,
                                                    festivalName: h.name
                                                }))
                                            ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                                            replaceHol(presetHolidays);
                                        }
                                    }}
                                >
                                    <option value="">Auto-populate Holidays...</option>
                                    <option value="10">Feed 10 Days Holiday</option>
                                    <option value="12">Feed 12 Days Holiday</option>
                                </Select>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => appendHol({ id: `hol_${Date.now()}`, date: '', year: new Date().getFullYear(), festivalName: '' })}>
                                <Calendar className="w-4 h-4 mr-2" /> Add Entry
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {holFields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start p-4 border border-border rounded-xl bg-page/20 animate-in slide-in-from-right-2">
                                <div className="md:col-span-3"><Input label="Year" id={`hol_${index}_y`} type="number" registration={register(`holidays.${index}.year` as const)} error={errors.holidays?.[index]?.year?.message} /></div>
                                <div className="md:col-span-4"><Input label="Event Date" id={`hol_${index}_d`} type="date" registration={register(`holidays.${index}.date` as const)} error={errors.holidays?.[index]?.date?.message} /></div>
                                <div className="md:col-span-4"><Input label="Festival Name" id={`hol_${index}_f`} registration={register(`holidays.${index}.festivalName` as const)} error={errors.holidays?.[index]?.festivalName?.message} /></div>
                                <div className="md:col-span-1 pt-7 text-right">
                                    <Button type="button" variant="danger" size="sm" onClick={() => removeHol(index)}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Policies Tab */}
            {activeTab === 'Policies' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Policies (formerly Insurances) */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-lg font-semibold text-primary-text">Policies</h4>
                            <Button type="button" variant="outline" size="sm" onClick={() => {
                                const newId = `ins_${Date.now()}`;
                                appendIns({ id: newId, name: '', documentUrls: [] });
                                setExpandedItems(prev => ({ ...prev, [`ins_${newId}`]: true }));
                            }}><Plus className="w-4 h-4 mr-2" /> New Entry</Button>
                        </div>
                        {insFields.length > 0 && (
                            <div className="border border-border rounded-2xl overflow-hidden bg-card">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-page/40">
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Policy Name</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Files</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {insFields.map((item, index) => {
                                            const insVal = watch(`insurances.${index}`);
                                            const businessId = insVal?.id || item.id;
                                            const isExpanded = expandedItems[`ins_${businessId}`];
                                            const docCount = (insVal?.documentUrls?.length || 0) + ((pendingFiles[`ins_${businessId}`] as UploadedFile[])?.length || 0);
                                            return (
                                                <React.Fragment key={item.id}>
                                                    <tr className={`border-b border-border transition-colors hover:bg-page/30 ${isExpanded ? 'bg-accent/5' : ''}`}>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="w-4 h-4 text-accent flex-shrink-0" />
                                                                <span className="font-medium text-primary-text">{insVal?.name || 'Untitled'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${docCount > 0 ? 'bg-accent/10 text-accent' : 'bg-page text-muted'}`}>
                                                                <FileText className="w-3 h-3" />{docCount}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button type="button" onClick={() => toggleExpanded(`ins_${businessId}`)} className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'text-accent bg-accent/10' : 'text-muted hover:text-accent hover:bg-accent/10'}`} title="Edit">
                                                                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                                </button>
                                                                {docCount > 0 && insVal?.documentUrls?.[0] && (
                                                                    <button type="button" onClick={() => {
                                                                        const proxyUrl = getProxyUrl(insVal.documentUrls![0]);
                                                                        navigate(`/document-viewer?url=${encodeURIComponent(proxyUrl)}&title=${encodeURIComponent(insVal.name)}`);
                                                                    }} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" title="View Policy">
                                                                        <Eye className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                <button type="button" onClick={() => removeIns(index)} className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={3} className="p-0">
                                                                <div className="px-6 py-6 bg-page/20 border-b border-border">
                                                                    <Input label="Policy Name" id={`ins_${index}`} registration={register(`insurances.${index}.name` as const)} error={errors.insurances?.[index]?.name?.message} />
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                                        <Input label="Effective Date" id={`ins_eff_${index}`} type="date" registration={register(`insurances.${index}.effectiveDate` as const)} />
                                                                        <Input label="Announced Date" id={`ins_ann_${index}`} type="date" registration={register(`insurances.${index}.announcedDate` as const)} />
                                                                        <div className="md:col-span-2">
                                                                            <Input label="Editor Log" id={`ins_log_${index}`} registration={register(`insurances.${index}.editorLog` as const)} placeholder="Internal policy reference..." />
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-4">
                                                                        <Controller name={`insurances.${index}.documentUrls` as const} control={control} render={({ field: f }) => {
                                                                            const pendingList = pendingFiles[`ins_${businessId}`] as UploadedFile[];
                                                                            const existingUrls = f.value || [];
                                                                            const displayFiles: UploadedFile[] = [
                                                                                ...existingUrls.map(url => getUploadedFileFromUrl(url)).filter(Boolean) as UploadedFile[],
                                                                                ...(Array.isArray(pendingList) ? pendingList : [])
                                                                            ];
                                                                            return (
                                                                                <MultiUploadDocument label="Upload Policy Documents" files={displayFiles}
                                                                                    onFilesChange={(newFileList) => { setFiles(`ins_${businessId}`, newFileList); f.onChange(newFileList.map(nf => nf.url).filter(Boolean)); }} />
                                                                            );
                                                                        }} />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Company Policies */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-lg font-semibold text-primary-text">Company Policies</h4>
                            <Button type="button" variant="outline" size="sm" onClick={() => {
                                const newId = `pol_${Date.now()}`;
                                appendPol({ id: newId, name: '', level: 'Both', documentUrls: [] });
                                setExpandedItems(prev => ({ ...prev, [`pol_${newId}`]: true }));
                            }}><Plus className="w-4 h-4 mr-2" /> New Entry</Button>
                        </div>
                        {polFields.length > 0 && (
                            <div className="border border-border rounded-2xl overflow-hidden bg-card">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-page/40">
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Policy Name</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Level</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Files</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {polFields.map((item, index) => {
                                            const polVal = watch(`policies.${index}`);
                                            const businessId = polVal?.id || item.id;
                                            const isExpanded = expandedItems[`pol_${businessId}`];
                                            const docCount = (polVal?.documentUrls?.length || 0) + ((pendingFiles[`pol_${businessId}`] as UploadedFile[])?.length || 0);
                                            return (
                                                <React.Fragment key={item.id}>
                                                    <tr className={`border-b border-border transition-colors hover:bg-page/30 ${isExpanded ? 'bg-accent/5' : ''}`}>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="w-4 h-4 text-accent flex-shrink-0" />
                                                                <span className="font-medium text-primary-text">{polVal?.name || 'Untitled'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="bg-accent/10 text-accent px-2 py-0.5 rounded text-xs font-bold uppercase">{polVal?.level || 'Both'}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${docCount > 0 ? 'bg-accent/10 text-accent' : 'bg-page text-muted'}`}>
                                                                <FileText className="w-3 h-3" />{docCount}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button type="button" onClick={() => toggleExpanded(`pol_${businessId}`)} className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'text-accent bg-accent/10' : 'text-muted hover:text-accent hover:bg-accent/10'}`} title="Edit">
                                                                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                                </button>
                                                                {docCount > 0 && polVal?.documentUrls?.[0] && (
                                                                    <button type="button" onClick={() => {
                                                                        const proxyUrl = getProxyUrl(polVal.documentUrls![0]);
                                                                        navigate(`/document-viewer?url=${encodeURIComponent(proxyUrl)}&title=${encodeURIComponent(polVal.name)}`);
                                                                    }} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" title="View Policy">
                                                                        <Eye className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                <button type="button" onClick={() => removePol(index)} className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={4} className="p-0">
                                                                <div className="px-6 py-6 bg-page/20 border-b border-border">
                                                                    <Input label="Global/Local Policy Name" id={`pol_${index}`} registration={register(`policies.${index}.name` as const)} error={errors.policies?.[index]?.name?.message} />
                                                                    <div className="mt-3"><Select label="Deployment Level" id={`lvl_${index}`} registration={register(`policies.${index}.level` as const)}><option value="Both">Both BO & Site</option><option value="BO">BO Level Only</option><option value="Site">Site Level Only</option></Select></div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                                        <Input label="Effective Date" id={`pol_eff_${index}`} type="date" registration={register(`policies.${index}.effectiveDate` as const)} />
                                                                        <Input label="Announced Date" id={`pol_ann_${index}`} type="date" registration={register(`policies.${index}.announcedDate` as const)} />
                                                                        <div className="md:col-span-2">
                                                                            <Input label="Editor Log" id={`pol_log_${index}`} registration={register(`policies.${index}.editorLog` as const)} placeholder="Internal company policy reference..." />
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-4">
                                                                        <Controller name={`policies.${index}.documentUrls` as const} control={control} render={({ field: f }) => {
                                                                            const pendingList = pendingFiles[`pol_${businessId}`] as UploadedFile[];
                                                                            const existingUrls = f.value || [];
                                                                            const displayFiles: UploadedFile[] = [
                                                                                ...existingUrls.map(url => getUploadedFileFromUrl(url)).filter(Boolean) as UploadedFile[],
                                                                                ...(Array.isArray(pendingList) ? pendingList : [])
                                                                            ];
                                                                            return (
                                                                                <MultiUploadDocument label="Upload Policy Documents" files={displayFiles}
                                                                                    onFilesChange={(newFileList) => { setFiles(`pol_${businessId}`, newFileList); f.onChange(newFileList.map(nf => nf.url).filter(Boolean)); }} />
                                                                            );
                                                                        }} />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Profile Preview Tab */}
            {activeTab === 'Preview' && (
                <div className="animate-in zoom-in-95 duration-200">
                    <CompanyProfilePreview data={formData} logoUrl={logoPreview} />
                </div>
            )}
          </div>
        </form>
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      </div>
  );
};

export default CompanyForm;
