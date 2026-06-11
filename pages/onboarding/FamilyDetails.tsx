import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useOnboardingStore } from '../../store/onboardingStore';
// Fix: Use inline type import for SubmitHandler
import { useForm, useFieldArray, Controller, type SubmitHandler, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { FamilyMember, UploadedFile } from '../../types';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Plus, Trash2 } from 'lucide-react';
import FormHeader from '../../components/onboarding/FormHeader';
import UploadDocument from '../../components/UploadDocument';
import { useEnrollmentRulesStore } from '../../store/enrollmentRulesStore';
import { useAuthStore } from '../../store/authStore';
import DatePicker from '../../components/ui/DatePicker';
import Checkbox from '../../components/ui/Checkbox';
import { Type } from '@google/genai';
import { format, parse } from 'date-fns';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface OutletContext {
  onValidated: () => Promise<void>;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

type FormData = {
    family: FamilyMember[];
};

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

// FIX: Removed React.FC type annotation to fix a type inference issue with React Hooks and functional components.
// FIX: Changed from named to default export for consistency with other components.
const FamilyDetails = () => {
    const { onValidated, setToast } = useOutletContext<OutletContext>();
    const { data: onboardingData, updateFamily, updatePersonal } = useOnboardingStore();
    const { rulesByDesignation } = useEnrollmentRulesStore();
    const isMobile = useMediaQuery('(max-width: 767px)');

    const designation = onboardingData.organization.designation;
    const familyAadhaarRequired = useMemo(() => {
        const rules = designation && rulesByDesignation[designation];
        return rules ? rules.documents.familyAadhaar : false;
    }, [designation, rulesByDesignation]);

    // Fix: Removed generic type arguments from yup calls
    const familyMemberSchema = yup.object({
        id: yup.string().required(),
        relation: yup.string().oneOf(['Spouse', 'Child', 'Father', 'Mother', '']).required("Relation is required"),
        name: yup.string().required("Name is required"),
        dob: yup.string().required("Date of birth is required"),
        gender: yup.string().oneOf(['Male', 'Female', 'Other', '']).required("Gender is required"),
        occupation: yup.string().optional(),
        dependent: yup.boolean().required(),
        phone: yup.string()
            .when('relation', {
                is: 'Child',
                then: (schema) => schema.optional().nullable().matches(/^[6-9][0-9]{9}$/, { message: 'Must be a valid 10-digit number', excludeEmptyString: true }),
                otherwise: (schema) => schema.required("Phone number is required").matches(/^[6-9][0-9]{9}$/, 'Must be a valid 10-digit Indian number'),
            }),
        idProof: yup.mixed().nullable().when([], {
            is: () => familyAadhaarRequired,
            then: (schema) => schema.test('is-required', "Aadhaar proof is required for this designation.", value => value != null).nullable(),
            otherwise: (schema) => schema.optional().nullable(),
        }),
    });

    // Fix: Removed generic type argument from yup.object
    const validationSchema = yup.object({
        family: yup.array().of(familyMemberSchema).required()
    });

    const { control, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormData>({
        // FIX: Cast resolver to resolve type incompatibility between yup and react-hook-form.
        resolver: yupResolver(validationSchema) as unknown as Resolver<FormData>,
        defaultValues: { family: onboardingData.family },
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'family' });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<number | null>(null);

    // Auto-save form data back to the global store with a debounce.
    useEffect(() => {
        let debounceTimer: number;
        const subscription = watch((value) => {
            clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(() => {
                updateFamily((value as FormData).family);
            }, 500);
        });
        return () => {
            subscription.unsubscribe();
            clearTimeout(debounceTimer);
        };
    }, [watch, updateFamily]);

    // L-03: Clear phone number of minor children automatically
    const familyWatch = watch('family');
    useEffect(() => {
        if (!familyWatch) return;
        familyWatch.forEach((member, index) => {
            if (member && member.relation === 'Child') {
                const age = calculateAge(member.dob);
                if (age !== null && age < 18 && member.phone) {
                    setValue(`family.${index}.phone`, '', { shouldValidate: false });
                }
            }
        });
    }, [familyWatch, setValue]);

    // L-16: Keep emergency contact in sync if the selected family member's details change in the form
    useEffect(() => {
        if (!familyWatch) return;
        familyWatch.forEach((member) => {
            if (member && member.id && member.id === onboardingData.personal.emergencyContactId) {
                const phoneChanged = member.phone !== onboardingData.personal.emergencyContactNumber;
                const nameChanged = member.name !== onboardingData.personal.emergencyContactName;
                const relationChanged = member.relation !== onboardingData.personal.relationship;
                if (phoneChanged || nameChanged || relationChanged) {
                    updatePersonal({
                        emergencyContactName: member.name || '',
                        emergencyContactNumber: member.phone || '',
                        relationship: member.relation as any,
                    });
                }
            }
        });
    }, [familyWatch, onboardingData.personal.emergencyContactId, onboardingData.personal.emergencyContactName, onboardingData.personal.relationship, onboardingData.personal.emergencyContactNumber, updatePersonal]);

    // L-01 + L-02: When relation is selected, infer gender and mark dependent
    const handleRelationChange = (index: number, relation: any) => {
        setValue(`family.${index}.relation`, relation, { shouldValidate: true });

        // Infer gender from relation
        if (relation === 'Father') {
            setValue(`family.${index}.gender`, 'Male', { shouldValidate: false });
        } else if (relation === 'Mother') {
            setValue(`family.${index}.gender`, 'Female', { shouldValidate: false });
        } else if (relation === 'Spouse') {
            // Spouse gender is opposite of the employee's gender
            const empGender = onboardingData.personal.gender;
            const spouseGender = empGender === 'Male' ? 'Female' : empGender === 'Female' ? 'Male' : '';
            if (spouseGender) setValue(`family.${index}.gender`, spouseGender, { shouldValidate: false });
        }

        // Auto-mark as dependent for all common relations
        if (['Spouse', 'Child', 'Father', 'Mother'].includes(relation)) {
            setValue(`family.${index}.dependent`, true, { shouldValidate: false });
        }
    };


    const handleOcrComplete = (index: number) => (extractedData: any) => {
        let updated = false;
        if (extractedData.name) {
            const formattedName = extractedData.name.toLowerCase().replace(/\b(\w)/g, (s: string) => s.toUpperCase());
            setValue(`family.${index}.name`, formattedName, { shouldValidate: true });
            updated = true;
        }
        if (extractedData.dob) {
            try {
                // Attempt to parse various date formats
                const dateString = extractedData.dob.replace(/[/.]/g, '-');
                const formatsToTry = ['dd-MM-yyyy', 'yyyy-MM-dd', 'MM-dd-yyyy', 'd-M-yyyy'];
                let parsedDate: Date | null = null;
                for (const fmt of formatsToTry) {
                    const dt = parse(dateString, fmt, new Date());
                    if (!isNaN(dt.getTime())) {
                        parsedDate = dt;
                        break;
                    }
                }
                if (parsedDate) {
                    const formattedDate = format(parsedDate, 'yyyy-MM-dd');
                    setValue(`family.${index}.dob`, formattedDate, { shouldValidate: true });
                    updated = true;
                }
            } catch (e) {
                console.error("Could not parse date from OCR:", extractedData.dob);
            }
        }
        if (extractedData.gender) {
            const genderLower = extractedData.gender.toLowerCase().trim();
            if (genderLower.includes('male') || genderLower.includes('purush') || genderLower === 'm') {
                setValue(`family.${index}.gender`, 'Male', { shouldValidate: true });
                updated = true;
            } else if (genderLower.includes('female') || genderLower.includes('mahila') || genderLower === 'f') {
                setValue(`family.${index}.gender`, 'Female', { shouldValidate: true });
                updated = true;
            }
        }
        if(updated) {
            setToast({ message: 'Family member details auto-filled.', type: 'success' });
        }
    };
    
    const familyAadhaarSchema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            dob: { type: Type.STRING },
            gender: { type: Type.STRING },
        }
    };

    const handleAddMember = () => {
        append({ id: `fam_${Date.now()}`, relation: '', name: '', dob: '', gender: '', occupation: '', dependent: false, idProof: null, phone: '' });
    };

    const handleRemoveClick = (index: number) => {
        setMemberToRemove(index);
        setIsModalOpen(true);
    };

    const handleConfirmRemove = () => {
        if (memberToRemove !== null) {
            remove(memberToRemove);
            setIsModalOpen(false);
            setMemberToRemove(null);
        }
    };
    
    const onSubmit: SubmitHandler<FormData> = async (formData) => {
        updateFamily(formData.family);
        await onValidated();
    };
    
    if (isMobile) {
        return (
            <form onSubmit={handleSubmit(onSubmit)} id="family-form">
                <p className="text-sm text-gray-400 mb-6">List your immediate family members.</p>
                <div className="space-y-4">
                    {fields.map((field, index) => {
                        const rel = watch(`family.${index}.relation`);
                        const dob = watch(`family.${index}.dob`);
                        const age = calculateAge(dob);
                        const isMinorChild = rel === 'Child' && age !== null && age < 18;

                        const memberId = watch(`family.${index}.id`);
                        const memberName = watch(`family.${index}.name`);
                        const memberPhone = watch(`family.${index}.phone`);
                        const memberRelation = watch(`family.${index}.relation`);
                        const isEmergencyContact = !!(onboardingData.personal.emergencyContactId &&
                            onboardingData.personal.emergencyContactId === memberId);

                        return (
                            <div key={field.id} className="p-4 border border-border rounded-xl relative space-y-4">
                                <button type="button" onClick={() => handleRemoveClick(index)} className="absolute top-2 right-2 p-1 text-red-500 rounded-full z-10" aria-label="Remove family member">
                                    <Trash2 className="h-5 w-5" />
                                </button>
                                <Controller name={`family.${index}.relation`} control={control} render={({ field }) => (
                                    <select
                                        {...field}
                                        className="pro-select pro-select-arrow"
                                        onChange={(e) => handleRelationChange(index, e.target.value)}
                                    >
                                        <option value="">Select Relation</option>
                                        <option>Spouse</option><option>Child</option><option>Father</option><option>Mother</option>
                                    </select>
                                )} />
                                 <Controller name={`family.${index}.name`} control={control} render={({ field }) => <input placeholder="Full Name" {...field} className="form-input"/>} />
                                 <div className="relative">
                                     <Controller name={`family.${index}.dob`} control={control} render={({ field }) => <input type="date" placeholder="Date of Birth" {...field} className="form-input"/>} />
                                     {age !== null && (
                                         <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 pointer-events-none">
                                             Age: {age}
                                         </span>
                                     )}
                                 </div>
                                 {!isMinorChild && (
                                     <Controller name={`family.${index}.phone`} control={control} render={({ field }) => <input placeholder="Phone Number" type="tel" {...field} className="form-input"/>} />
                                 )}
                                 {rel !== 'Child' && memberName && memberPhone && (
                                     <div className="flex items-center gap-3 pt-2">
                                         <input
                                             type="checkbox"
                                             id={`fam-mob-emergency-${index}`}
                                             checked={isEmergencyContact}
                                             onChange={(e) => {
                                                 if (e.target.checked) {
                                                     updatePersonal({
                                                         emergencyContactName: memberName || '',
                                                         emergencyContactNumber: memberPhone || '',
                                                         relationship: memberRelation as any,
                                                         emergencyContactId: memberId
                                                     });
                                                 } else {
                                                     updatePersonal({
                                                         emergencyContactName: '',
                                                         emergencyContactNumber: '',
                                                         relationship: '',
                                                         emergencyContactId: ''
                                                     });
                                                 }
                                             }}
                                             className="h-5 w-5 rounded text-accent focus:ring-accent bg-transparent border-[#9ca89c]"
                                         />
                                         <label htmlFor={`fam-mob-emergency-${index}`} className="text-sm text-gray-200">Set as Emergency Contact</label>
                                     </div>
                                 )}
                            </div>
                        );
                    })}
                </div>
                 <Button type="button" onClick={handleAddMember} variant="secondary" className="mt-6 w-full flex items-center justify-center">
                    <Plus className="mr-2 h-4 w-4" /> Add Family Member
                </Button>
            </form>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} id="family-form">
            <Modal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onConfirm={handleConfirmRemove}
              title="Confirm Deletion"
            >
              Are you sure you want to remove this family member? This action cannot be undone.
            </Modal>

            <FormHeader title="Family Details" subtitle="List your immediate family members." />
            
            <div className="space-y-6">
                {fields.map((field, index) => {
                    const rel = watch(`family.${index}.relation`);
                    const dob = watch(`family.${index}.dob`);
                    const age = calculateAge(dob);
                    const isMinorChild = rel === 'Child' && age !== null && age < 18;

                    const memberId = watch(`family.${index}.id`);
                    const memberName = watch(`family.${index}.name`);
                    const memberPhone = watch(`family.${index}.phone`);
                    const memberRelation = watch(`family.${index}.relation`);
                    const isEmergencyContact = !!(onboardingData.personal.emergencyContactId &&
                        onboardingData.personal.emergencyContactId === memberId);

                    return (
                        <div key={field.id} className="p-4 border border-border rounded-xl relative">
                            <button type="button" onClick={() => handleRemoveClick(index)} className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-100 rounded-full" aria-label={`Remove ${field.name}`}>
                                <Trash2 className="h-4 w-4" />
                            </button>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                <Controller name={`family.${index}.relation`} control={control} render={({ field }) =>
                                    <Select
                                        label="Relation"
                                        id={field.name}
                                        error={errors.family?.[index]?.relation?.message}
                                        value={field.value}
                                        onChange={(e) => handleRelationChange(index, e.target.value)}
                                    >
                                        <option value="">Select</option>
                                        <option>Spouse</option><option>Child</option><option>Father</option><option>Mother</option>
                                    </Select>
                                } />
                                <Controller name={`family.${index}.name`} control={control} render={({ field }) => <Input label="Full Name" id={field.name} error={errors.family?.[index]?.name?.message} {...field}/>} />
                                <Controller name={`family.${index}.dob`} control={control} render={({ field }) => (
                                    <DatePicker 
                                        label={
                                            <span className="flex items-center gap-2">
                                                Date of Birth
                                                {age !== null && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                        Age: {age} yrs
                                                    </span>
                                                )}
                                            </span>
                                        } 
                                        id={field.name} 
                                        value={field.value} 
                                        onChange={field.onChange} 
                                        error={errors.family?.[index]?.dob?.message} 
                                        maxDate={new Date()} 
                                    />
                                )} />
                                <Controller name={`family.${index}.gender`} control={control} render={({ field }) => <Select label="Gender" id={field.name} error={errors.family?.[index]?.gender?.message} {...field}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></Select>} />
                                {!isMinorChild && (
                                    <Controller name={`family.${index}.phone`} control={control} render={({ field }) => <Input label="Phone Number" id={field.name} type="tel" error={errors.family?.[index]?.phone?.message} {...field} value={field.value ?? ''} />} />
                                )}
                                <Controller name={`family.${index}.occupation`} control={control} render={({ field }) => <Input label="Occupation (Optional)" id={field.name} {...field} value={field.value ?? ''} />} />
                                 <div className="col-span-full md:col-span-1 flex items-center pt-5">
                                    <Controller name={`family.${index}.dependent`} control={control} render={({ field }) => <Checkbox id={field.name} label="Is a dependent?" checked={field.value} onChange={field.onChange} />} />
                                </div>
                                {rel !== 'Child' && memberName && memberPhone && (
                                     <div className="col-span-full md:col-span-1 flex items-center pt-5">
                                        <Checkbox 
                                            id={`fam-emergency-${index}`} 
                                            label="Use as Emergency Contact" 
                                            checked={isEmergencyContact} 
                                            onChange={(checked) => {
                                                if (checked) {
                                                    updatePersonal({
                                                        emergencyContactName: memberName || '',
                                                        emergencyContactNumber: memberPhone || '',
                                                        relationship: memberRelation as any,
                                                        emergencyContactId: memberId
                                                    });
                                                } else {
                                                    updatePersonal({
                                                        emergencyContactName: '',
                                                        emergencyContactNumber: '',
                                                        relationship: '',
                                                        emergencyContactId: ''
                                                    });
                                                }
                                            }} 
                                        />
                                    </div>
                                )}
                                <div className="col-span-full">
                                    <Controller name={`family.${index}.idProof`} control={control} render={({ field, fieldState }) => (
                                        <UploadDocument
                                            label={`Aadhaar Proof ${familyAadhaarRequired ? '(Mandatory)' : '(Optional)'}`}
                                            file={field.value}
                                            onFileChange={field.onChange}
                                            onOcrComplete={handleOcrComplete(index)}
                                            ocrSchema={familyAadhaarSchema}
                                            setToast={setToast}
                                            error={fieldState.error?.message}
                                            docType="Aadhaar"
                                        />
                                    )}/>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <Button type="button" onClick={handleAddMember} variant="outline" className="mt-6">
                <Plus className="mr-2 h-4 w-4" /> Add Family Member
            </Button>
        </form>
    );
};

export default FamilyDetails;