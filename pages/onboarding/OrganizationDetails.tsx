import React, { useState, useEffect, useMemo, useRef } from 'react';
// Fix: Use inline type import for SubmitHandler
import { useForm, Controller, type SubmitHandler, type Resolver } from 'react-hook-form';
import { useOutletContext } from 'react-router-dom';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useOnboardingStore } from '../../store/onboardingStore';
import type { OrganizationDetails, Organization, OrganizationGroup } from '../../types';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import FormHeader from '../../components/onboarding/FormHeader';
import DatePicker from '../../components/ui/DatePicker';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import Checkbox from '../../components/ui/Checkbox';
import { Building, CheckCircle2 } from 'lucide-react';

// Fix: Removed generic type argument from yup.object and yup.string
export const organizationDetailsSchema = yup.object({
    designation: yup.string().required('Designation is required'),
    department: yup.string().required('Department is required'),
    reportingManager: yup.string().nullable().optional(),
    organizationId: yup.string().required('Organization is required'),
    organizationName: yup.string().nullable().optional(),
    joiningDate: yup.string().required('Joining date is required'),
    workType: yup.string().oneOf(['Full-time', 'Part-time', 'Contract', '']).required('Work type is required'),
    site: yup.string().nullable().optional(),
    defaultSalary: yup.number().nullable().optional(),
    oshFitness: yup.object().nullable().optional(),
    compensationPackage: yup.mixed().nullable().optional(),
}).defined();

interface OutletContext {
  onValidated: () => Promise<void>;
  setToast?: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

const OrganizationDetails = () => {
    const { onValidated, setToast } = useOutletContext<OutletContext>();
    const { user } = useAuthStore();
    const { data, updateOrganization } = useOnboardingStore();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [structure, setStructure] = useState<OrganizationGroup[]>([]);
    const isMobile = useMediaQuery('(max-width: 767px)');
    
    const { register, handleSubmit, formState: { errors }, control, watch, setValue, reset } = useForm<OrganizationDetails>({
        resolver: yupResolver(organizationDetailsSchema) as unknown as Resolver<OrganizationDetails>,
        defaultValues: data.organization,
    });
    
    const selectedOrgId = watch('organizationId');
    const designation = watch('designation');
    const isOrgPreselected = !!data.organization.organizationId;
    const { location, companyId, groupId } = data.organization;

    const isBangalore = useMemo(() => location?.trim().toLowerCase() === 'bangalore', [location]);

    const filteredEntities = useMemo(() => {
        if (!isBangalore || !structure || !companyId) return [];
        const group = structure.find(g => g.id === groupId);
        const companies = group ? group.companies : structure.flatMap(g => g.companies);
        const company = companies.find(c => c.id === companyId);
        return company ? company.entities : [];
    }, [structure, groupId, companyId, isBangalore]);

    const dropdownOptions = useMemo(() => {
        let baseOptions: { id: string; name: string }[] = [];
        if (isBangalore) {
            baseOptions = filteredEntities.map(entity => ({
                id: entity.organizationId || entity.id,
                name: entity.name
            }));
        } else {
            baseOptions = organizations.map(org => ({
                id: org.id,
                name: org.shortName || org.fullName
            }));
        }

        if (data.organization?.organizationId) {
            const exists = baseOptions.some(o => o.id === data.organization.organizationId);
            if (!exists) {
                baseOptions.unshift({
                    id: data.organization.organizationId,
                    name: data.organization.organizationName || data.organization.site || 'Selected Client/Site'
                });
            }
        }

        return baseOptions;
    }, [isBangalore, filteredEntities, organizations, data.organization]);

    useEffect(() => {
        api.getOrganizations().then(setOrganizations);
        api.getOrganizationStructure().then(setStructure);
    }, []);

    const loadedRecordIdRef = useRef<string | null>(null);

    useEffect(() => {
        const currentRecordId = data.id || 'new';
        if (loadedRecordIdRef.current !== currentRecordId) {
            loadedRecordIdRef.current = currentRecordId;
            reset({
                ...data.organization,
                designation: data.organization?.designation || '',
                organizationId: data.organization?.organizationId || '',
                organizationName: data.organization?.organizationName || data.organization?.site || '',
                department: data.organization?.department || '',
                joiningDate: data.organization?.joiningDate || new Date().toISOString().split('T')[0],
                workType: data.organization?.workType || 'Full-time',
                site: data.organization?.site || '',
            });
        } else {
            if (data.organization?.organizationId) {
                setValue('organizationId', data.organization.organizationId, { shouldValidate: true });
            }
            if (data.organization?.organizationName || data.organization?.site) {
                setValue('organizationName', data.organization.organizationName || data.organization.site || '', { shouldValidate: true });
            }
            if (data.organization?.designation) {
                setValue('designation', data.organization.designation, { shouldValidate: true });
            }
            if (data.organization?.department) {
                setValue('department', data.organization.department, { shouldValidate: true });
            }
            if (data.organization?.joiningDate) {
                setValue('joiningDate', data.organization.joiningDate, { shouldValidate: true });
            }
            if (data.organization?.workType) {
                setValue('workType', data.organization.workType, { shouldValidate: true });
            }
            if (data.organization?.site) {
                setValue('site', data.organization.site, { shouldValidate: true });
            }
        }
    }, [data.id, data.organization, reset, setValue]);

    // This effect syncs the form state back to the Zustand store on change, with a debounce.
    useEffect(() => {
        let debounceTimer: number;
        const subscription = watch((value) => {
            // Guard: never overwrite existing valid organization data with blank values
            if (!value.organizationId && !value.designation && data.organization?.organizationId) {
                return;
            }
            clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(() => {
                const cleaned: Partial<OrganizationDetails> = {};
                if (value.organizationId) cleaned.organizationId = value.organizationId;
                if (value.organizationName) cleaned.organizationName = value.organizationName;
                if (value.designation) cleaned.designation = value.designation;
                if (value.department) cleaned.department = value.department;
                if (value.reportingManager !== undefined) cleaned.reportingManager = value.reportingManager;
                if (value.joiningDate) cleaned.joiningDate = value.joiningDate;
                if (value.workType) cleaned.workType = value.workType;
                if (value.site) cleaned.site = value.site;
                if (value.defaultSalary !== undefined) cleaned.defaultSalary = value.defaultSalary;
                if (value.compensationPackage !== undefined) cleaned.compensationPackage = value.compensationPackage;
                if (value.oshFitness !== undefined) cleaned.oshFitness = value.oshFitness;
                updateOrganization(cleaned);
            }, 500);
        });
        return () => {
            subscription.unsubscribe();
            clearTimeout(debounceTimer);
        };
    }, [watch, updateOrganization, data.organization]);


    useEffect(() => {
        const selectedOrg = dropdownOptions.find(o => o.id === selectedOrgId);
        if (selectedOrg) {
            setValue('organizationName', selectedOrg.name);
            
            // Flag-Based Compensation Engine (Excluding Minimum Wage Zoning/Skill Matrix)
            api.getManpowerDetails(selectedOrg.id).then((details: any) => {
                if (details && details.length > 0) {
                    // Just take a basic matching or first structure
                    setValue('compensationPackage', details[0]);
                    setValue('defaultSalary', details[0].gross_salary || null);
                } else {
                    setValue('compensationPackage', null);
                }
            }).catch(() => {
                setValue('compensationPackage', null);
            });
        }
    }, [selectedOrgId, dropdownOptions, setValue]);
    
    useEffect(() => {
        if (designation) {
            api.suggestDepartmentForDesignation(designation).then(suggestedDept => {
                if (suggestedDept) {
                    setValue('department', suggestedDept, { shouldValidate: true });
                }
            });
        }
    }, [designation, setValue]);


    const onSubmit: SubmitHandler<OrganizationDetails> = async (formData) => {
        const selectedOrg = dropdownOptions.find(o => o.id === formData.organizationId);
        const finalData = {
            ...formData,
            organizationName: formData.organizationName || selectedOrg?.name || data.organization.organizationName || data.organization.site || 'Selected Client/Site'
        };
        updateOrganization(finalData);
        await onValidated();
    };

    const onInvalid = (errors: any) => {
        console.error("OrganizationDetails Validation Errors:", errors);
        const firstErr = Object.values(errors)[0] as any;
        if (firstErr?.message && setToast) {
            setToast({ message: `Please fix: ${firstErr.message}`, type: 'error' });
        }
    };

    const isPreSelected = !!(data.organization?.organizationId || data.organization?.organizationName || data.organization?.site) && !!data.organization?.designation;

    if (isMobile) {
        return (
            <form onSubmit={handleSubmit(onSubmit, onInvalid)} id="organization-form">
                 <div className="space-y-4">
                    <p className="text-sm text-gray-400">Employment details for the new employee within the organization.</p>
                    
                    {/* Confirmed Selection Banner if chosen at SelectOrganization */}
                    {isPreSelected && (
                        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4 text-emerald-400" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Selected Client & Role</span>
                                </div>
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Confirmed
                                </span>
                            </div>
                            <div className="bg-[#03130a]/60 rounded-xl p-3 border border-emerald-900/40 space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400">Client / Site:</span>
                                    <span className="font-semibold text-white text-right max-w-[200px] truncate">{data.organization.organizationName || data.organization.site || 'Site Selected'}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400">Designation:</span>
                                    <span className="font-semibold text-emerald-400">{data.organization.designation}</span>
                                </div>
                                {data.organization.department && (
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-400">Department:</span>
                                        <span className="font-medium text-gray-300">{data.organization.department}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Hidden inputs to keep react-hook-form registered and valid */}
                    <input type="hidden" {...register('organizationId')} />
                    <input type="hidden" {...register('organizationName')} />
                    <input type="hidden" {...register('designation')} />
                    <input type="hidden" {...register('department')} />

                    {!isPreSelected && (
                        <>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Organization / Site</label>
                                <select {...register('organizationId')} className="pro-select pro-select-arrow w-full">
                                    <option value="">Select Organization</option>
                                    {dropdownOptions.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                                </select>
                                {errors.organizationId && <p className="mt-1 text-xs text-red-500">{errors.organizationId.message}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Designation</label>
                                <input placeholder="Designation" {...register('designation')} className="form-input w-full" />
                                {errors.designation && <p className="mt-1 text-xs text-red-500">{errors.designation.message}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Department</label>
                                <input placeholder="Department" {...register('department')} className="form-input w-full" />
                                {errors.department && <p className="mt-1 text-xs text-red-500">{errors.department.message}</p>}
                            </div>
                        </>
                    )}

                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Reporting Manager (Optional)</label>
                        <input placeholder="Reporting Manager" {...register('reportingManager')} className="form-input w-full" />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Joining Date</label>
                        <Controller name="joiningDate" control={control} render={({ field }) => (
                            <input type="date" {...field} className="form-input w-full" />
                        )} />
                        {errors.joiningDate && <p className="mt-1 text-xs text-red-500">{errors.joiningDate.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Work Type</label>
                        <select {...register('workType')} className="pro-select pro-select-arrow w-full">
                            <option value="">Select Work Type</option>
                            <option value="Full-time">Full-time</option>
                            <option value="Part-time">Part-time</option>
                            <option value="Contract">Contract</option>
                        </select>
                        {errors.workType && <p className="mt-1 text-xs text-red-500">{errors.workType.message}</p>}
                    </div>
                </div>
            </form>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} id="organization-form">
            <FormHeader title="Organization Details" subtitle="Your employment details within the organization." />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Select label="Organization / Client" requiredIndicator={true} id="organizationId" error={errors.organizationId?.message} registration={register('organizationId')}>
                    <option value="">Select Organization</option>
                    {dropdownOptions.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                </Select>
                <Input
                    label="Designation"
                    requiredIndicator={true}
                    id="designation"
                    error={errors.designation?.message}
                    registration={register('designation')}
                />
                <Input
                    label="Department"
                    requiredIndicator={true}
                    id="department"
                    error={errors.department?.message}
                    registration={register('department')}
                />
                <Input label="Reporting Manager (Optional)" id="reportingManager" error={errors.reportingManager?.message} registration={register('reportingManager')} />
                <Controller name="joiningDate" control={control} render={({ field }) => (
                    <DatePicker label="Joining Date" requiredIndicator={true} id="joiningDate" error={errors.joiningDate?.message} value={field.value} onChange={field.onChange} />
                 )} />
                <Select label="Work Type" requiredIndicator={true} id="workType" error={errors.workType?.message} registration={register('workType')}>
                    <option value="">Select Work Type</option>
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                </Select>
            </div>
            
            {/* OSH Occupational Fitness Checklist */}
            <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Occupational Safety and Health (OSH) Fitness</h3>
                <p className="text-sm text-gray-600 mb-4">Verify the physical and mental fitness required for facility management roles.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <Controller
                        name="oshFitness.heightPhobia"
                        control={control}
                        render={({ field }) => (
                            <Checkbox 
                                id="heightPhobia" 
                                label="Cleared for Height Work (No Acrophobia)" 
                                checked={!!field.value} 
                                onChange={(e) => field.onChange(e.target.checked)} 
                            />
                        )}
                    />
                    <Controller
                        name="oshFitness.nightShift"
                        control={control}
                        render={({ field }) => (
                            <Checkbox 
                                id="nightShift" 
                                label="Cleared for Night Shifts" 
                                checked={!!field.value} 
                                onChange={(e) => field.onChange(e.target.checked)} 
                            />
                        )}
                    />
                    <Controller
                        name="oshFitness.heavyLifting"
                        control={control}
                        render={({ field }) => (
                            <Checkbox 
                                id="heavyLifting" 
                                label="Capable of Heavy Lifting (>15kg)" 
                                checked={!!field.value} 
                                onChange={(e) => field.onChange(e.target.checked)} 
                            />
                        )}
                    />
                    <Controller
                        name="oshFitness.eyeSight"
                        control={control}
                        render={({ field }) => (
                            <Checkbox 
                                id="eyeSight" 
                                label="Eye Sight Cleared for Duty" 
                                checked={!!field.value} 
                                onChange={(e) => field.onChange(e.target.checked)} 
                            />
                        )}
                    />
                </div>
            </div>

            {/* Compensation Overview */}
            {watch('compensationPackage') && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Compensation Structure</h3>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-emerald-800 font-medium">Standard Gross Salary</p>
                            <p className="text-2xl font-bold text-emerald-900">₹{watch('defaultSalary') || watch('compensationPackage')?.gross_salary || '---'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-emerald-800 font-medium">Role Level</p>
                            <p className="text-md text-emerald-900 capitalize">{watch('compensationPackage')?.skill_category || 'General'}</p>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
};

export default OrganizationDetails;
