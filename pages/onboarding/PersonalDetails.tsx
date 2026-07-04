import React, { useEffect, useRef, useMemo } from 'react';
// Fix: Use inline type import for SubmitHandler
import { useForm, Controller, type SubmitHandler, type Resolver } from 'react-hook-form';
import { useOutletContext } from 'react-router-dom';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useOnboardingStore } from '../../store/onboardingStore';
import type { PersonalDetails, UploadedFile } from '../../types';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { AvatarUpload } from '../../components/onboarding/AvatarUpload';
import FormHeader from '../../components/onboarding/FormHeader';
import DatePicker from '../../components/ui/DatePicker';
import VerifiedInput from '../../components/ui/VerifiedInput';
import MultiSelect from '../../components/ui/MultiSelect';
import { AlertTriangle } from 'lucide-react';
import { useEnrollmentRulesStore } from '../../store/enrollmentRulesStore';

const calculateAge = (dobString: string | undefined): number | null => {
    if (!dobString) return null;
    try {
        const birthDate = new Date(dobString);
        if (isNaN(birthDate.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    } catch {
        return null;
    }
};

// Fix: Removed generic type arguments from yup calls
const validationSchema = yup.object({
    employeeId: yup.string().required(),
    firstName: yup.string().required('First name is required'),
    middleName: yup.string().optional(),
    lastName: yup.string().required('Last name is required'),
    preferredName: yup.string().optional(),
    badgeName: yup.string().max(18, 'Badge name must be 18 characters or less').optional(),
    dob: yup.string().required('Date of birth is required'),
    gender: yup.string().oneOf(['Male', 'Female', 'Other', '']).required('Gender is required'),
    maritalStatus: yup.string().oneOf(['Single', 'Married', 'Divorced', 'Widowed', '']).required('Marital status is required'),
    bloodGroup: yup.string().oneOf(['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).required('Blood group is required'),
    mobile: yup.string().required('Mobile number is required').matches(/^[6-9][0-9]{9}$/, 'Must be a valid 10-digit Indian mobile number'),
    alternateMobile: yup.string().optional().nullable(),
    email: yup.string().email('Must be a valid email').required('Email is required'),
    idProofType: yup.string().oneOf(['Aadhaar', 'PAN', 'Voter ID', '']).optional(),
    idProofNumber: yup.string().optional(),
    photo: yup.mixed().optional().nullable(),
    idProofFront: yup.mixed().optional().nullable(),
    idProofBack: yup.mixed().optional().nullable(),
    emergencyContactName: yup.string().required('Emergency contact name is required'),
    emergencyContactNumber: yup.string().required('Emergency contact number is required').matches(/^[6-9][0-9]{9}$/, 'Must be a valid 10-digit number'),
    emergencyContactId: yup.string().optional().nullable(),
    relationship: yup.string().oneOf(['Spouse', 'Child', 'Father', 'Mother', 'Sibling', 'Other', '']).required('Relationship is required'),
    salary: yup.number().typeError('Salary must be a number').min(0).required('Salary is required').nullable(),
    spokenLanguages: yup.array().of(yup.string().required()).optional(),
    writtenLanguages: yup.array().of(yup.string().required()).optional(),
    verifiedStatus: yup.object().optional(),
}).defined();


interface OutletContext {
    onValidated: () => Promise<void>;
}

const PersonalDetails = () => {
    const { onValidated } = useOutletContext<OutletContext>();
    const { data, updatePersonal, addOrUpdateEmergencyContactAsFamilyMember, setPersonalVerifiedStatus } = useOnboardingStore();
    const { esiCtcThreshold } = useEnrollmentRulesStore();

    const family = data.family || [];
    const INDIAN_LANGUAGES = [
        { id: 'English', name: 'English' }, { id: 'Hindi', name: 'Hindi' }, { id: 'Assamese', name: 'Assamese' },
        { id: 'Bengali', name: 'Bengali' }, { id: 'Bodo', name: 'Bodo' }, { id: 'Dogri', name: 'Dogri' },
        { id: 'Gujarati', name: 'Gujarati' }, { id: 'Kannada', name: 'Kannada' }, { id: 'Kashmiri', name: 'Kashmiri' },
        { id: 'Konkani', name: 'Konkani' }, { id: 'Maithili', name: 'Maithili' }, { id: 'Malayalam', name: 'Malayalam' },
        { id: 'Manipuri', name: 'Manipuri' }, { id: 'Marathi', name: 'Marathi' }, { id: 'Nepali', name: 'Nepali' },
        { id: 'Odia', name: 'Odia' }, { id: 'Punjabi', name: 'Punjabi' }, { id: 'Sanskrit', name: 'Sanskrit' },
        { id: 'Santali', name: 'Santali' }, { id: 'Sindhi', name: 'Sindhi' }, { id: 'Tamil', name: 'Tamil' },
        { id: 'Telugu', name: 'Telugu' }, { id: 'Urdu', name: 'Urdu' }
    ];

    const initialPersonal = useMemo(() => {
        const personal = { ...data.personal };
        
        // Auto-detect Spouse → set marital status to Married (if empty/unset)
        const hasSpouse = family.some(member => member.relation === 'Spouse');
        if (hasSpouse && !personal.maritalStatus) {
            personal.maritalStatus = 'Married';
        }
        
        // Auto-sync preferredName = firstName if empty
        if (personal.firstName && !personal.preferredName) {
            personal.preferredName = personal.firstName;
        }

        // Auto-populate Emergency Contact if fields are empty
        const isFormEmpty = !personal.emergencyContactName && !personal.emergencyContactNumber && !personal.relationship;
        if (isFormEmpty && family.length > 0) {
            const spouse = family.find(f => f.relation === 'Spouse' && f.name);
            const defaultMember = spouse || (family.length === 1 && family[0].name ? family[0] : null);
            if (defaultMember) {
                personal.emergencyContactName = defaultMember.name;
                personal.emergencyContactNumber = defaultMember.phone || '';
                personal.relationship = defaultMember.relation || 'Other';
                personal.emergencyContactId = defaultMember.id;
            }
        }
        
        return personal;
    }, [data.personal, family]);

    const { register, handleSubmit, formState: { errors }, control, reset, watch, setValue } = useForm<PersonalDetails>({
        // FIX: Cast resolver to resolve type incompatibility between yup and react-hook-form.
        resolver: yupResolver(validationSchema) as unknown as Resolver<PersonalDetails>,
        defaultValues: initialPersonal,
    });
    
    const personalData = watch();
    const dobValue = personalData.dob;
    const age = calculateAge(dobValue);
    const isUnder18 = age !== null && age < 18;
    const familySuggestions = family.filter(member => member.name && member.relation);
    const preferredNameManuallyEdited = useRef(false);
    
    const salaryVal = personalData.salary;
    const isEsiEligible = typeof salaryVal === 'number' && salaryVal <= esiCtcThreshold;

    // L-08: Auto-sync preferredName = firstName (stops if user edits preferredName)
    useEffect(() => {
        const firstName = personalData.firstName || '';
        const preferred = personalData.preferredName || '';
        if (!preferredNameManuallyEdited.current && firstName && preferred !== firstName) {
            setValue('preferredName', firstName, { shouldValidate: true });
        }
    }, [personalData.firstName, setValue]);

    // Auto-populate/sync Emergency Contact with Spouse (or single family member if only one exists)
    useEffect(() => {
        const family = data.family || [];
        
        // 1. If a relationship is selected in the dropdown, and name is empty OR current ID is not matching,
        // search for a matching family member and auto-fill.
        if (personalData.relationship) {
            const matchingMembers = family.filter(
                member => member.relation === personalData.relationship && member.name
            );
            if (matchingMembers.length === 1) {
                const match = matchingMembers[0];
                const needsNameOrNum = !personalData.emergencyContactName || !personalData.emergencyContactNumber;
                const isNotLinked = personalData.emergencyContactId !== match.id;
                
                if (needsNameOrNum || isNotLinked) {
                    setValue('emergencyContactName', match.name, { shouldValidate: true });
                    setValue('emergencyContactNumber', match.phone || '', { shouldValidate: true });
                    setValue('emergencyContactId', match.id, { shouldValidate: true });
                    return; // Stop here since we populated from selected relationship
                }
            }
        }

        // 2. Defaulting logic: If no emergency contact name is filled, try to default to Spouse or single family member
        const spouseMember = family.find(member => member.relation === 'Spouse');
        let defaultMember = spouseMember;
        
        // If no spouse, but there is exactly one family member, default to that member
        if (!defaultMember && family.length === 1 && family[0].name) {
            defaultMember = family[0];
        }
        
        if (defaultMember) {
            // Check if another family member is explicitly set as the emergency contact
            const isOtherFamilyMemberSet = family.some(
                member => member.id !== defaultMember.id && member.id === personalData.emergencyContactId
            );
            
            if (!isOtherFamilyMemberSet) {
                const isFormEmpty = !personalData.emergencyContactName && !personalData.emergencyContactNumber && !personalData.relationship;
                
                // Auto-fill if the form is empty
                if (isFormEmpty) {
                    setValue('emergencyContactName', defaultMember.name, { shouldValidate: true });
                    setValue('emergencyContactNumber', defaultMember.phone || '', { shouldValidate: true });
                    setValue('relationship', defaultMember.relation || 'Other', { shouldValidate: true });
                    setValue('emergencyContactId', defaultMember.id, { shouldValidate: true });
                }
                // If already set to the target member, keep details in sync
                else if (personalData.emergencyContactId === defaultMember.id) {
                    if (
                        personalData.emergencyContactName !== defaultMember.name ||
                        personalData.emergencyContactNumber !== (defaultMember.phone || '') ||
                        personalData.relationship !== (defaultMember.relation || 'Other')
                    ) {
                        setValue('emergencyContactName', defaultMember.name, { shouldValidate: true });
                        setValue('emergencyContactNumber', defaultMember.phone || '', { shouldValidate: true });
                        setValue('relationship', defaultMember.relation || 'Other', { shouldValidate: true });
                    }
                }
            }
        }
    }, [data.family, personalData.emergencyContactId, personalData.emergencyContactName, personalData.emergencyContactNumber, personalData.relationship, setValue]);

    useEffect(() => {
        reset(initialPersonal);
    }, [initialPersonal, reset]);

    // This effect syncs the form state back to the Zustand store on change, with a debounce.
    useEffect(() => {
        let debounceTimer: number;
        const subscription = watch((value) => {
            clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(() => {
                updatePersonal(value as PersonalDetails);
            }, 500);
        });
        return () => {
            subscription.unsubscribe();
            clearTimeout(debounceTimer);
        };
    }, [watch, updatePersonal]);

    // Clear emergencyContactId if the user manually overrides emergency contact fields
    const emergencyName = watch('emergencyContactName');
    const emergencyNumber = watch('emergencyContactNumber');
    const emergencyRelation = watch('relationship');
    const emergencyId = watch('emergencyContactId');

    useEffect(() => {
        if (!emergencyId) return;
        const matchingMember = (data.family || []).find(f => f.id === emergencyId);
        if (matchingMember) {
            const nameDiverged = emergencyName !== matchingMember.name;
            const numberDiverged = emergencyNumber !== (matchingMember.phone || '');
            const relationDiverged = emergencyRelation !== matchingMember.relation;
            if (nameDiverged || numberDiverged || relationDiverged) {
                setValue('emergencyContactId', '', { shouldValidate: false });
            }
        } else {
            setValue('emergencyContactId', '', { shouldValidate: false });
        }
    }, [emergencyName, emergencyNumber, emergencyRelation, emergencyId, data.family, setValue]);

    const onSubmit: SubmitHandler<PersonalDetails> = async (formData) => {
        updatePersonal(formData); // Final sync before processing
        addOrUpdateEmergencyContactAsFamilyMember();
        await onValidated();
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} id="personal-form">
            <div className="text-left">
                <FormHeader title="Personal Details" subtitle="Please provide your personal information as per your official documents." />
            </div>
            
            <div className="flex flex-col md:flex-row gap-8 md:items-start">
                <div className="flex-shrink-0 mx-auto md:mx-0">
                     <Controller
                        name="photo"
                        control={control}
                        render={({ field }) => (
                            <AvatarUpload
                                file={field.value}
                                onFileChange={(file) => field.onChange(file)}
                             />
                        )}
                    />
                </div>

                <div className="w-full flex-grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="md:col-span-3">
                        <Input label="Employee ID" id="employeeId" registration={register('employeeId')} error={errors.employeeId?.message} readOnly className="bg-gray-100" />
                    </div>
                    <VerifiedInput label="First Name" id="firstName" registration={register('firstName')} error={errors.firstName?.message} isVerified={data.personal.verifiedStatus?.name === true} hasValue={!!personalData.firstName} onManualInput={() => setPersonalVerifiedStatus({ name: false })} />
                    <Input label="Middle Name (Optional)" id="middleName" registration={register('middleName')} />
                    <VerifiedInput label="Last Name" id="lastName" registration={register('lastName')} error={errors.lastName?.message} isVerified={data.personal.verifiedStatus?.name === true} hasValue={!!personalData.lastName} onManualInput={() => setPersonalVerifiedStatus({ name: false })} />
                    <Input label="Preferred Name (Optional)" id="preferredName" registration={register('preferredName', { onChange: () => { preferredNameManuallyEdited.current = true; } })} />
                    <Input label="Badge Name (ID Card)" id="badgeName" maxLength={18} registration={register('badgeName')} error={errors.badgeName?.message} description="Max 18 characters" />
                    <div className="relative">
                        <Controller
                            name="dob"
                            control={control}
                            render={({ field }) => (                           
                                <DatePicker
                                    label={
                                        <span className="flex items-center gap-2">
                                            Date of Birth
                                            {age !== null && (
                                                <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${isUnder18 ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                                                    Age: {age} yrs {isUnder18 && '(Minor)'}
                                                </span>
                                            )}
                                        </span>
                                    }
                                    id="dob"
                                    error={errors.dob?.message}
                                    value={field.value}
                                    onChange={(val) => {
                                        field.onChange(val);
                                        setPersonalVerifiedStatus({ dob: false });
                                    }}
                                    maxDate={new Date()}
                                />
                            )}
                        />
                        {isUnder18 && (
                            <p className="mt-1 text-xs text-red-500 flex items-center gap-1 animate-fade-in-down">
                                <AlertTriangle className="h-3 w-3 flex-shrink-0 text-red-500" />
                                Warning: Employee is under 18 years of age.
                            </p>
                        )}
                    </div>
                    <Select label="Gender" id="gender" registration={register('gender')} error={errors.gender?.message}>
                        <option value="">Select Gender</option><option>Male</option><option>Female</option><option>Other</option>
                    </Select>
                    <Select label="Marital Status" id="maritalStatus" registration={register('maritalStatus')} error={errors.maritalStatus?.message}>
                        <option value="">Select Status</option><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
                    </Select>
                    <Select label="Blood Group" id="bloodGroup" registration={register('bloodGroup')} error={errors.bloodGroup?.message}>
                        <option value="">Select</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
                    </Select>
                    
                    <Controller
                        name="spokenLanguages"
                        control={control}
                        render={({ field }) => (
                            <MultiSelect 
                                label="Spoken Languages" 
                                id="spokenLanguages" 
                                options={INDIAN_LANGUAGES} 
                                value={field.value || []} 
                                onChange={field.onChange} 
                            />
                        )}
                    />
                    <Controller
                        name="writtenLanguages"
                        control={control}
                        render={({ field }) => (
                            <MultiSelect 
                                label="Written Languages" 
                                id="writtenLanguages" 
                                options={INDIAN_LANGUAGES} 
                                value={field.value || []} 
                                onChange={field.onChange} 
                            />
                        )}
                    />

                    <Input label="Mobile Number" id="mobile" type="tel" registration={register('mobile')} error={errors.mobile?.message} description="Onboarding updates and alerts will be sent to this number via WhatsApp." />
                    <Input label="Alternate Mobile (Optional)" id="alternateMobile" type="tel" registration={register('alternateMobile')} />
                    <Input label="Email Address" id="email" type="email" registration={register('email')} error={errors.email?.message} />
                    <div>
                        <Input label="Monthly Salary (Gross)" id="salary" type="number" registration={register('salary')} error={errors.salary?.message} />
                        {typeof salaryVal === 'number' && (
                            <p className="mt-1 text-xs flex items-center gap-1">
                                {isEsiEligible ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        ✓ Eligible for Employee State Insurance (ESI) (salary ≤ ₹{esiCtcThreshold.toLocaleString()}/mo)
                                    </span>
                                ) : (
                                    <span className="text-muted">
                                        ℹ Not eligible for ESI (salary &gt; ₹{esiCtcThreshold.toLocaleString()}/mo)
                                    </span>
                                )}
                            </p>
                        )}
                    </div>

                    <div className="md:col-span-3 pt-4 border-t">
                         <h4 className="text-md font-semibold text-primary-text mb-4">Emergency Contact</h4>
                         {familySuggestions.length > 0 && (
                            <div className="mb-4 flex flex-wrap gap-2 items-center bg-[#243524]/20 p-3 rounded-lg border border-emerald-950/20">
                                <span className="text-xs text-muted font-medium">Use family member details:</span>
                                {familySuggestions.map(member => (
                                    <button
                                        key={member.id}
                                        type="button"
                                        onClick={() => {
                                            setValue('emergencyContactName', member.name, { shouldValidate: true });
                                            setValue('emergencyContactNumber', member.phone || '', { shouldValidate: true });
                                            setValue('relationship', member.relation || 'Other', { shouldValidate: true });
                                            setValue('emergencyContactId', member.id, { shouldValidate: true });
                                        }}
                                        className="px-2.5 py-1 text-xs font-semibold rounded bg-[#243524] text-emerald-400 border border-emerald-950/30 hover:bg-emerald-500/10 active:scale-95 transition-all flex items-center gap-1"
                                    >
                                        {member.relation}: {member.name}
                                    </button>
                                ))}
                            </div>
                         )}
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <input type="hidden" {...register('emergencyContactId')} />
                            <Input label="Contact Name" id="emergencyContactName" registration={register('emergencyContactName')} error={errors.emergencyContactName?.message} />
                            <Input label="Contact Number" id="emergencyContactNumber" type="tel" registration={register('emergencyContactNumber')} error={errors.emergencyContactNumber?.message} />
                            <Select label="Relationship" id="relationship" registration={register('relationship')} error={errors.relationship?.message}>
                                <option value="">Select Relationship</option>
                                <option>Spouse</option><option>Child</option><option>Father</option><option>Mother</option><option>Sibling</option><option>Other</option>
                            </Select>
                         </div>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default PersonalDetails;