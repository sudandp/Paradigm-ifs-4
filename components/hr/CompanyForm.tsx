import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller, SubmitHandler } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Company, RegistrationType, UploadedFile, CompanyEmail, ComplianceCodes, ComplianceDocument, CompanyHoliday, CompanyInsurance, CompanyPolicy } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import UploadDocument from '../UploadDocument';
import { Plus, Trash2, Calendar, FileText } from 'lucide-react';
import CompanyProfilePreview from './CompanyProfilePreview';

interface CompanyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Company>, pendingFiles: Record<string, File>) => void;
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
  registrationType: yup.string<RegistrationType>().optional(),
  registrationNumber: yup.string().optional(),
  gstNumber: yup.string().optional().nullable(),
  panNumber: yup.string().optional().nullable(),
  logoUrl: yup.string().optional().nullable(),
  
  // Arrays & Nested
  emails: yup.array().of(
    yup.object({
      id: yup.string().required(),
      email: yup.string().email('Invalid email format').required('Email is required')
    })
  ).max(5).optional(),
  
  complianceCodes: yup.object({
    eShramNumber: yup.string().optional(),
    shopAndEstablishmentCode: yup.string().optional(),
    epfoCode: yup.string().optional(),
    esicCode: yup.string().optional(),
    psaraLicenseNumber: yup.string().optional(),
    psaraValidTill: yup.string().optional().nullable(),
  }).optional(),
  
  complianceDocuments: yup.array().of(
    yup.object({
      id: yup.string().required(),
      type: yup.string().required(),
      documentUrl: yup.string().optional().nullable(),
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
      name: yup.string().required('Insurance Name is required'),
      documentUrl: yup.string().optional().nullable(),
    })
  ).optional(),
  
  policies: yup.array().of(
    yup.object({
      id: yup.string().required(),
      name: yup.string().required('Policy Name is required'),
      documentUrl: yup.string().optional().nullable(),
      level: yup.string().oneOf(['BO', 'Site', 'Both']).required('Level is required')
    })
  ).optional(),
}).defined();

type Tab = 'Details' | 'Contacts' | 'Compliance' | 'Documents' | 'Holidays' | 'Ins./Policies' | 'Preview';

const CompanyForm: React.FC<CompanyFormProps> = ({ isOpen, onClose, onSave, initialData, groupName, existingLocations }) => {
  const [activeTab, setActiveTab] = useState<Tab>('Details');
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  
  const { register, handleSubmit, formState: { errors }, reset, control, watch } = useForm<Partial<Company>>({
    resolver: yupResolver(companySchema) as any,
    defaultValues: {
      emails: [{ id: `email_${Date.now()}_1`, email: '' }, { id: `email_${Date.now()}_2`, email: '' }],
      complianceCodes: {},
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

  const { fields: holFields, append: appendHol, remove: removeHol } = useFieldArray({
    control, name: 'holidays'
  });

  const { fields: insFields, append: appendIns, remove: removeIns } = useFieldArray({
    control, name: 'insurances'
  });

  const { fields: polFields, append: appendPol, remove: removePol } = useFieldArray({
    control, name: 'policies'
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
  
  const logoPreview = pendingFiles['logo'] 
    ? URL.createObjectURL(pendingFiles['logo']) 
    : formData.logoUrl;

  const onSubmit: SubmitHandler<Partial<Company>> = (data) => {
    onSave(data, pendingFiles);
  };

  const setFile = (key: string, file: UploadedFile | null) => {
    setPendingFiles(prev => {
        const next = { ...prev };
        if (file?.file) {
            next[key] = file.file;
        } else {
            delete next[key];
        }
        return next;
    });
  };

  if (!isOpen) return null;

  const TabButton = ({ tabName }: { tabName: Tab }) => (
    <button
      type="button"
      onClick={() => setActiveTab(tabName)}
      className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === tabName ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-primary-text'}`}
    >
      {tabName}
    </button>
  );

  return (
    <div className="p-4 border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card w-full animate-fade-in relative">
        <form 
          onSubmit={handleSubmit(onSubmit)} 
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
                 <Button type="submit" variant="primary" className="px-8 shadow-lg shadow-emerald-500/20">{isEditing ? 'Save Changes' : 'Create Profile'}</Button>
              </div>
            </div>
            
            <div className="border-b border-border overflow-x-auto no-scrollbar mb-8">
              <nav className="-mb-px flex space-x-1 sm:space-x-4 min-w-max pb-1 text-base">
                  <TabButton tabName="Details" />
                  <TabButton tabName="Contacts" />
                  <TabButton tabName="Compliance" />
                  <TabButton tabName="Documents" />
                  <TabButton tabName="Holidays" />
                  <TabButton tabName="Ins./Policies" />
                  <TabButton tabName="Preview" />
              </nav>
            </div>
          </div>
          
          <div className="flex-1 py-2 min-h-[60vh]">
             {/* General Details Tab */}
            {activeTab === 'Details' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="md:col-span-2">
                        <Input label="Company / LLP / Partnership / Society Name" id="name" registration={register('name')} error={errors.name?.message} />
                    </div>
                    <div>
                        <Input label="Location (Select or Type New)" id="location" list="existing-locations" registration={register('location')} error={errors.location?.message} />
                        <datalist id="existing-locations">{existingLocations.map(l => <option key={l} value={l} />)}</datalist>
                    </div>
                    <Input label="Registered Address" id="address" registration={register('address')} error={errors.address?.message} />
                    <Select label="Registration Type" id="registrationType" registration={register('registrationType')} error={errors.registrationType?.message}>
                        <option value="">Select Type</option><option value="CIN">CIN</option><option value="ROC">ROC</option><option value="ROF">ROF</option><option value="Society">Society</option><option value="Trust">Trust</option>
                    </Select>
                    <Input label="Registration Number" id="registrationNumber" registration={register('registrationNumber')} error={errors.registrationNumber?.message} />
                    <Input label="GST Number" id="gstNumber" registration={register('gstNumber')} error={errors.gstNumber?.message} />
                    <Input label="PAN Number" id="panNumber" registration={register('panNumber')} error={errors.panNumber?.message} />
                    
                    <div className="md:col-span-2 mt-4 p-6 border rounded-2xl bg-page/30">
                       <Controller name="logoUrl" control={control} render={({ field }) => (
                           <UploadDocument 
                             label="Company Logo" 
                             file={pendingFiles['logo'] ? { file: pendingFiles['logo'], preview: URL.createObjectURL(pendingFiles['logo']), name: 'New Image', type: 'image/jpeg', size: 0 } : (field.value ? { preview: field.value, name: 'Current', type: 'image/jpeg', size: 0 } as UploadedFile : null)}
                             onFileChange={(f) => {
                                 setFile('logo', f);
                                 if (!f) field.onChange(''); // clear string
                             }}
                           />
                       )} />
                    </div>
                </div>
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

            {/* Compliance Codes */}
            {activeTab === 'Compliance' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <Input label="E-Shram Number" id="shram" registration={register('complianceCodes.eShramNumber')} error={errors.complianceCodes?.eShramNumber?.message} />
                    <Input label="Shop & Establishment Code" id="shop" registration={register('complianceCodes.shopAndEstablishmentCode')} />
                    <Input label="EPFO Code" id="epfo" registration={register('complianceCodes.epfoCode')} />
                    <Input label="ESIC Code" id="esic" registration={register('complianceCodes.esicCode')} />
                    <Input label="PSARA License Number" id="psara" registration={register('complianceCodes.psaraLicenseNumber')} />
                    <Input label="PSARA Valid Till" id="psaradate" type="date" registration={register('complianceCodes.psaraValidTill')} />
                </div>
            )}

            {/* Compliance Documents */}
            {activeTab === 'Documents' && (
                <div className="space-y-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-lg font-semibold text-primary-text">Compliance Notifications & Circulars</h4>
                            <p className="text-sm text-muted">Upload minimum wages, PT, or PF & ESI related documents.</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => appendDoc({ id: `doc_${Date.now()}`, type: 'Minimum Wages Notifications', documentUrl: '', expiryDate: '' })}>
                            <Plus className="w-4 h-4 mr-2" /> Add Document
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        {docFields.map((field, index) => (
                            <div key={field.id} className="p-6 border border-border rounded-2xl bg-page shadow-sm relative animate-in fade-in scale-in-95">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                   <Select label="Circular Type" id={`docs.${index}.type`} registration={register(`complianceDocuments.${index}.type` as const)}>
                                       <option value="Minimum Wages Notifications">Minimum Wages Notifications</option>
                                       <option value="PT Circulars & Notifications">PT Circulars & Notifications</option>
                                       <option value="PF & ESI Circulars & Notifications">PF & ESI Circulars</option>
                                       <option value="Other">Other</option>
                                   </Select>
                                   <Input label="Valid Till" id={`docs.${index}.expiry`} type="date" registration={register(`complianceDocuments.${index}.expiryDate` as const)} />
                                   <div className="md:col-span-2 mt-2">
                                      <Controller name={`complianceDocuments.${index}.documentUrl` as const} control={control} render={({ field: f }) => (
                                           <UploadDocument 
                                               label="Upload Document Capture" 
                                               file={pendingFiles[`doc_${field.id}`] ? { file: pendingFiles[`doc_${field.id}`], preview: '', name: 'Selected File', type: 'application/pdf', size: 0 } : (f.value ? { preview: f.value, name: 'Current Attachment', type: 'application/pdf', size: 0 } as UploadedFile : null)}
                                               onFileChange={(uf) => {
                                                   setFile(`doc_${field.id}`, uf);
                                                   if (!uf) f.onChange('');
                                               }}
                                           />
                                      )} />
                                   </div>
                                </div>
                                <Button type="button" variant="danger" size="sm" className="absolute top-4 right-4" onClick={() => removeDoc(index)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
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
                        <Button type="button" variant="outline" size="sm" onClick={() => appendHol({ id: `hol_${Date.now()}`, date: '', year: new Date().getFullYear(), festivalName: '' })}>
                            <Calendar className="w-4 h-4 mr-2" /> Add Entry
                        </Button>
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

            {/* Insurances & Policies Tab */}
            {activeTab === 'Ins./Policies' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Insurances Sequence */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h4 className="text-lg font-semibold text-primary-text">Insurances</h4>
                            <Button type="button" variant="outline" size="sm" onClick={() => appendIns({ id: `ins_${Date.now()}`, name: '', documentUrl: '' })}><Plus className="w-4 h-4 mr-2" /> New Entry</Button>
                        </div>
                        <div className="space-y-6">
                           {insFields.map((item, index) => (
                               <div key={item.id} className="p-6 border border-border rounded-2xl bg-page/40 relative shadow-sm">
                                   <Input label="Insurance Policy Name" id={`ins_${index}`} registration={register(`insurances.${index}.name` as const)} error={errors.insurances?.[index]?.name?.message} />
                                   <div className="mt-4">
                                       <Controller name={`insurances.${index}.documentUrl` as const} control={control} render={({ field: f }) => (
                                           <UploadDocument label="Upload Policy Master Copy" file={pendingFiles[`ins_${item.id}`] ? { file: pendingFiles[`ins_${item.id}`], preview: '', name: 'Pending Upload', type: 'application/pdf', size: 0 } : (f.value ? { preview: f.value, name: 'Current Master', type: 'application/pdf', size: 0 } as UploadedFile : null)} 
                                           onFileChange={uf => { setFile(`ins_${item.id}`, uf); if (!uf) f.onChange(''); }} />
                                       )} />
                                   </div>
                                   <Button type="button" variant="danger" size="sm" className="absolute top-4 right-4" onClick={() => removeIns(index)}><Trash2 className="w-4 h-4" /></Button>
                               </div>
                           ))}
                        </div>
                    </div>

                    {/* Policies Sequence */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h4 className="text-lg font-semibold text-primary-text">Internal Policies</h4>
                            <Button type="button" variant="outline" size="sm" onClick={() => appendPol({ id: `pol_${Date.now()}`, name: '', level: 'Both', documentUrl: '' })}><Plus className="w-4 h-4 mr-2" /> New Entry</Button>
                        </div>
                        <div className="space-y-6">
                           {polFields.map((item, index) => (
                               <div key={item.id} className="p-6 border border-border rounded-2xl bg-page/40 relative shadow-sm">
                                   <Input label="Global/Local Policy Name" id={`pol_${index}`} registration={register(`policies.${index}.name` as const)} error={errors.policies?.[index]?.name?.message} />
                                   <div className="mt-3"><Select label="Deployment Level" id={`lvl_${index}`} registration={register(`policies.${index}.level` as const)}><option value="Both">Both BO & Site</option><option value="BO">BO Level Only</option><option value="Site">Site Level Only</option></Select></div>
                                   <div className="mt-4">
                                       <Controller name={`policies.${index}.documentUrl` as const} control={control} render={({ field: f }) => (
                                           <UploadDocument label="Upload Policy Directive" file={pendingFiles[`pol_${item.id}`] ? { file: pendingFiles[`pol_${item.id}`], preview: '', name: 'Pending Upload', type: 'application/pdf', size: 0 } : (f.value ? { preview: f.value, name: 'Attached Directive', type: 'application/pdf', size: 0 } as UploadedFile : null)} 
                                           onFileChange={uf => { setFile(`pol_${item.id}`, uf); if (!uf) f.onChange(''); }} />
                                       )} />
                                   </div>
                                   <Button type="button" variant="danger" size="sm" className="absolute top-4 right-4" onClick={() => removePol(index)}><Trash2 className="w-4 h-4" /></Button>
                               </div>
                           ))}
                        </div>
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
      </div>
  );
};

export default CompanyForm;
