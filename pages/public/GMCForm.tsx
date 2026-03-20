
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { format, differenceInYears } from 'date-fns';
import { 
    ArrowLeft, Image as ImageIcon, User, Building2, MapPin, 
    Calendar, Users, Phone, Heart, Plus, Trash2, CheckCircle2,
    Download, Printer, FileText, ChevronRight, ShieldCheck
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Checkbox from '../../components/ui/Checkbox';
import Logo from '../../components/ui/Logo';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { api } from '../../services/api';
import { useDevice } from '../../hooks/useDevice';
import { pdf } from '@react-pdf/renderer';
import { GMCFormReceiptDocument } from '../attendance/PDFReports';
import { useLogoStore } from '../../store/logoStore';
import LoadingScreen from '../../components/ui/LoadingScreen';




const validationSchema = yup.object({
    employeeName: yup.string().required('Employee name is required'),
    employeeId: yup.string().optional(),
    dateOfJoining: yup.string().required('Date of joining is required'),
    designation: yup.string().required('Designation is required'),
    companyName: yup.string().required('Company name is required'),
    siteName: yup.string().required('Site name is required'),
    dob: yup.string().required('Date of birth is required'),
    gender: yup.string().oneOf(['Male', 'Female', 'Other']).required('Gender is required'),
    contactNumber: yup.string().required('Contact number is required').matches(/^[0-9]{10}$/, 'Must be a 10-digit number'),
    includeSpouse: yup.boolean().optional(),
    spouseName: yup.string().when('includeSpouse', {
        is: true,
        then: schema => schema.required('Spouse name is required'),
        otherwise: schema => schema.optional()
    }),
    spouseDob: yup.string().when('includeSpouse', {
        is: true,
        then: schema => schema.required('Spouse DOB is required').test('is-adult', 'Spouse must be at least 18 years old', (value) => {
            if (!value) return false;
            return differenceInYears(new Date(), new Date(value)) >= 18;
        }),
        otherwise: schema => schema.optional()
    }),
    spouseGender: yup.string().when('includeSpouse', {
        is: true,
        then: schema => schema.oneOf(['Male', 'Female']).required('Spouse gender is required'),
        otherwise: schema => schema.optional()
    }),
    spouseContact: yup.string().when('includeSpouse', {
        is: true,
        then: schema => schema.required('Spouse contact is required').matches(/^[0-9]{10}$/, 'Must be a 10-digit number'),
        otherwise: schema => schema.optional()
    }),

    children: yup.array().of(
        yup.object({
            name: yup.string().required('Child name is required'),
            dob: yup.string().required('Child DOB is required').test('is-eligible', 'Child must be 25 years or younger', (value) => {
                if (!value) return false;
                return differenceInYears(new Date(), new Date(value)) <= 25;
            }),
            gender: yup.string().oneOf(['Male', 'Female', 'Other']).required('Child gender is required'),
        })
    ).max(2, 'Only 2 children allowed').optional(),
    acknowledged: yup.boolean().oneOf([true], 'You must acknowledge the plan to continue').required()
});

type GMCFormData = yup.InferType<typeof validationSchema>;

const GMCForm: React.FC = () => {
    const navigate = useNavigate();

    const [gmcRates, setGmcRates] = useState<any[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [submissionData, setSubmissionData] = useState<any>(null);
    const [sites, setSites] = useState<any[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const { isMobile } = useDevice();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [entitiesData, groupsData, ratesData] = await Promise.all([
                    api.getEntities(),
                    api.getGroups(),
                    api.getGMCRates()
                ]);
                setSites(entitiesData);
                setCompanies(groupsData);
                setGmcRates(ratesData);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, []);

    const { register, control, handleSubmit, watch, trigger, setValue, formState: { errors } } = useForm<GMCFormData>({
        resolver: yupResolver(validationSchema) as any,
        defaultValues: {
            includeSpouse: false,
            children: [],
            acknowledged: false,

        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'children'
    });

    const watchDob = watch('dob');
    const watchGender = watch('gender');
    const watchIncludeSpouse = watch('includeSpouse');
    const watchChildren = watch('children');

    useEffect(() => {
        if (watchIncludeSpouse && watchGender) {
            if (watchGender === 'Male') {
                setValue('spouseGender', 'Female');
            } else if (watchGender === 'Female') {
                setValue('spouseGender', 'Male');
            }
        }
    }, [watchGender, watchIncludeSpouse, setValue]);

    const employeeAge = useMemo(() => {
        if (!watchDob) return null;
        return differenceInYears(new Date(), new Date(watchDob));
    }, [watchDob]);

    const getAge = (dateStr: string) => {
        if (!dateStr) return null;
        return differenceInYears(new Date(), new Date(dateStr));
    };

    const getRateForAge = (age: number) => {
        // Obsolete: Fixed pricing now
        return 0;
    };

    const premiumBreakdown = useMemo(() => {
        let total = 0;
        const breakdown = [];

        // Employee (Fixed 200)
        breakdown.push({ name: 'Employee', age: employeeAge, rate: 200 });
        total += 200;

        // Spouse (Fixed 200)
        if (watch('includeSpouse')) {
            const spouseDob = watch('spouseDob');
            const spouseAge = spouseDob ? differenceInYears(new Date(), new Date(spouseDob)) : null;
            breakdown.push({ name: 'Spouse', age: spouseAge, rate: 200 });
            total += 200;
        }

        // Children (Fixed 150 each)
        if (watchChildren && watchChildren.length > 0) {
            watchChildren.forEach((child, index) => {
                const childAge = child.dob ? differenceInYears(new Date(), new Date(child.dob)) : null;
                breakdown.push({ name: `Child ${index + 1}`, age: childAge, rate: 150 });
                total += 150;
            });
        }

        return { breakdown, total };
    }, [employeeAge, watch('includeSpouse'), watch('spouseDob'), JSON.stringify(watchChildren)]);



    const onSubmit = async (data: GMCFormData) => {
        setIsSubmitting(true);
        try {
            // Helper to convert empty strings to null to avoid DB errors (e.g. invalid date format)
            const sanitizeData = (obj: any): any => {
                if (obj === null || typeof obj !== 'object') return obj;
                if (Array.isArray(obj)) return obj.map(sanitizeData);
                
                const sanitized: any = {};
                for (const [key, value] of Object.entries(obj)) {
                    sanitized[key] = value === '' ? null : sanitizeData(value);
                }
                return sanitized;
            };

            const { includeSpouse, acknowledged, ...submissionPayload } = data;

            const finalData = {
                ...sanitizeData(submissionPayload),
                // Legacy compatibility: Infer marital status
                maritalStatus: includeSpouse ? 'Married' : 'Single',
                employeeId: data.employeeId || `TEMP_${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
                plan_name: `GMC Family Cover (Total: ₹${premiumBreakdown.total})`,
                premium_amount: premiumBreakdown.total
            };
            
            await api.submitGmcPublicForm(finalData);
            setSubmissionData(finalData);
            setIsSuccess(true);
        } catch (error) {
            console.error('Failed to submit GMC form', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const downloadPdf = async () => {
        if (!submissionData) return;
        setIsSubmitting(true);
        try {
            const doc = <GMCFormReceiptDocument data={submissionData} />;
            const blob = await pdf(doc).toBlob();
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `GMC_Receipt_${submissionData.employeeName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
                link.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('PDF generation failed:', error);
            alert('Failed to generate PDF receipt.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className={`min-h-screen flex flex-col transition-colors duration-500 ${isMobile ? 'bg-[#041b0f]' : 'bg-white'}`}>
                <div className={`w-full flex-grow flex flex-col animate-fade-in ${isMobile ? '!bg-[#041b0f]' : 'bg-white'}`}>
                    <div className={`border-b border-border ${isMobile ? '!bg-transparent !border-white/10' : 'bg-white'}`}>
                        <div className="w-full p-8 text-center">
                            <div className="flex justify-center mb-6">
                                <div className="p-4 bg-accent-light rounded-full ring-8 ring-accent-light/50">
                                    <CheckCircle2 className="h-16 w-16 text-accent" />
                                </div>
                            </div>
                            <h1 className={`text-3xl font-bold mb-4 ${isMobile ? 'text-white' : 'text-primary-text'}`}>Submission Successful!</h1>
                            <p className={`${isMobile ? 'text-gray-400' : 'text-muted'} mb-0`}>
                                Thank you for submitting your GMC enrollment form. We have recorded your details and insurance plan choice.
                            </p>
                        </div>
                    </div>

                    <div className="w-full p-8 space-y-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button
                                onClick={downloadPdf}
                                className="flex-1 sm:flex-initial sm:px-10 flex items-center justify-center gap-3 h-14 !rounded-2xl !text-base shadow-lg shadow-accent/20"
                            >
                                <Download className="h-5 w-5" />
                                Download PDF Receipt
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => navigate('/auth/login')}
                                className="flex-1 sm:flex-initial sm:px-10 flex items-center justify-center gap-3 h-14 !rounded-2xl !text-base"
                            >
                                <ArrowLeft className="h-5 w-5" />
                                Back to Login
                            </Button>
                        </div>
                    </div>

                    {/* Receipt document is now generated via @react-pdf */}
                </div>
            </div>
        );
    }

    if (isLoadingData) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <>
            <div className={`min-h-screen flex flex-col transition-colors duration-500 ${isMobile ? 'bg-[#041b0f]' : 'bg-white'}`}>
            <div className={`w-full flex-grow flex flex-col animate-fade-in ${isMobile ? '!bg-[#041b0f]' : 'bg-white'}`}>
                <header className={`border-b border-border bg-white relative ${isMobile ? '!bg-transparent !border-white/10' : ''}`}>
                    <div className="w-full p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        {/* Navigation on the left */}
                        <div className="flex items-center justify-between md:justify-start w-full md:w-auto">
                            <Button 
                                variant="secondary"
                                size="sm"
                                onClick={() => navigate('/public/forms')}
                                className={`!rounded-xl ${isMobile ? '!bg-white/10 !border-white/20 !text-white' : ''}`}
                            >
                                <ArrowLeft className="h-5 w-5 mr-1" />
                                Exit
                            </Button>

                            {/* Mobile-only centered logo placeholder to maintain spacing if needed, but we'll use absolute centering */}
                            <div className="md:hidden invisible">
                                <Button size="sm" variant="secondary" className="opacity-0 pointer-events-none">Exit</Button>
                            </div>
                        </div>

                        {/* Absolutely centered logo */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mt-[-12px] md:mt-0">
                            <Logo className="h-8 md:h-10" />
                        </div>
                        
                        {/* Stepper on the right */}
                        <div className="flex items-center justify-center md:justify-end gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full md:w-auto">

                        </div>
                    </div>
                </header>

                <div className="flex-grow">
                    <div className="w-full p-6 md:p-10">
                        <form onSubmit={handleSubmit(onSubmit, (errors) => {
                            console.error('Validation Errors:', errors);
                            const errorMessages = Object.values(errors).map((err: any) => err.message).join('\n');
                            alert(`Please fix the following errors:\n${errorMessages}`);
                        })} className="space-y-12">
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <h2 className={`text-2xl font-bold mb-2 ${isMobile ? 'text-white' : 'text-primary-text'}`}>GMC Coverage Request</h2>
                                    <p className={`${isMobile ? 'text-gray-400' : 'text-muted'} text-sm`}>Please provide your official employment and personal information.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    <Input
                                        label="Full Name of Employee"
                                        placeholder="As per salary documents"
                                        registration={register('employeeName')}
                                        error={errors.employeeName?.message}
                                        className={isMobile ? 'public-form-input' : ''}
                                        labelClassName={isMobile ? 'public-form-label' : ''}
                                    />
                                    <Input
                                        label="Employee ID"
                                        placeholder="Refer Payslip (Leave blank for temp ID)"
                                        registration={register('employeeId')}
                                        error={errors.employeeId?.message}
                                        className={isMobile ? 'public-form-input' : ''}
                                        labelClassName={isMobile ? 'public-form-label' : ''}
                                    />
                                    <Input
                                        type="date"
                                        label="Date of Joining"
                                        registration={register('dateOfJoining')}
                                        error={errors.dateOfJoining?.message}
                                        className={isMobile ? 'public-form-input' : ''}
                                        labelClassName={isMobile ? 'public-form-label' : ''}
                                    />
                                    <Input
                                        label="Employee Designation"
                                        placeholder="As per pay slip"
                                        registration={register('designation')}
                                        error={errors.designation?.message}
                                        className={isMobile ? 'public-form-input' : ''}
                                        labelClassName={isMobile ? 'public-form-label' : ''}
                                    />
                                     <Select
                                         label="Company/Organization"
                                         registration={register('companyName')}
                                         error={errors.companyName?.message}
                                         className={isMobile ? 'public-form-input' : ''}
                                         labelClassName={isMobile ? 'public-form-label !mb-2' : ''}
                                     >
                                         <option value="">Select company</option>
                                         {companies.map(c => (
                                             <option key={c.id} value={c.name}>{c.name}</option>
                                         ))}
                                     </Select>
                                     <Select
                                         label="Current Site/Project"
                                         registration={register('siteName')}
                                         error={errors.siteName?.message}
                                         className={isMobile ? 'public-form-input' : ''}
                                         labelClassName={isMobile ? 'public-form-label !mb-2' : ''}
                                     >
                                         <option value="">Select site</option>
                                         {sites.map(s => (
                                             <option key={s.id} value={s.name}>{s.name}</option>
                                         ))}
                                     </Select>
                                    <div className="space-y-2">
                                        <label className={`text-sm font-semibold block mb-2 ${isMobile ? 'text-white/60 text-[10px] uppercase tracking-widest' : 'text-primary-text'}`}>Gender</label>
                                        <Controller
                                            name="gender"
                                            control={control}
                                            render={({ field }) => (
                                                <div className={`flex gap-2 p-1 border rounded-xl ${isMobile ? 'bg-white/5 border-white/10' : 'bg-page border-border'}`}>
                                                    {['Male', 'Female', 'Other'].map(option => (
                                                        <button
                                                            key={option}
                                                            type="button"
                                                            onClick={() => field.onChange(option)}
                                                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                                                                field.value === option
                                                                    ? (isMobile ? 'bg-accent text-white shadow-lg' : 'bg-white text-accent shadow-sm')
                                                                    : (isMobile ? 'text-gray-500 hover:text-white' : 'text-muted hover:text-primary-text')
                                                            }`}
                                                        >
                                                            {option}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        />
                                        {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender.message}</p>}
                                    </div>
                                    <Input
                                        type="date"
                                        label="Date of Birth"
                                        registration={register('dob')}
                                        error={errors.dob?.message}
                                        className={isMobile ? 'public-form-input' : ''}
                                        labelClassName={isMobile ? 'public-form-label' : ''}
                                    />
                                    <Input
                                        label="Contact Number"
                                        placeholder="10 digit mobile"
                                        registration={register('contactNumber')}
                                        error={errors.contactNumber?.message}
                                        maxLength={10}
                                        className={isMobile ? 'public-form-input' : ''}
                                        labelClassName={isMobile ? 'public-form-label' : ''}
                                    />
                                </div>
                            </div>
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <h2 className={`text-2xl font-bold mb-2 ${isMobile ? 'text-white' : 'text-primary-text'}`}>Employee Relationship Details</h2>
                                    <p className={`${isMobile ? 'text-gray-400' : 'text-muted'} text-sm`}>Add eligible family members to your coverage.</p>
                                </div>

                                <div className="space-y-8">
                                    {/* Toolbar */}
                                    <div className={`p-4 rounded-xl border flex items-center justify-between ${isMobile ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-border'}`}>
                                        <p className="text-sm font-bold opacity-70">Add Member</p>
                                        <div className="flex gap-2">
                                            <select
                                                className={`h-10 px-3 rounded-lg text-sm font-bold border transition-colors ${
                                                    isMobile ? 'bg-black text-white border-white/20' : 'bg-white text-primary-text border-gray-300'
                                                }`}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'Spouse') {
                                                        if (watch('includeSpouse')) {
                                                            alert('You can only add 1 Spouse.');
                                                        } else {
                                                            setValue('includeSpouse', true);
                                                        }
                                                    } else if (val === 'Child') {
                                                        if (fields.length >= 2) {
                                                            alert('Maximum 2 children allowed.');
                                                        } else {
                                                            append({ name: '', dob: '', gender: 'Male' });
                                                        }
                                                    }
                                                    e.target.value = ''; // Reset
                                                }}
                                            >
                                                <option value="">Select Relationship...</option>
                                                <option value="Spouse">Spouse</option>
                                                <option value="Child">Child</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Employee Card */}
                                    <div className={`p-6 rounded-2xl border relative ${isMobile ? 'bg-white/5 border-white/10' : 'bg-white border-border shadow-sm'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <User className="h-5 w-5 text-accent" />
                                                    <h3 className="font-bold text-lg">Employee (Self) {employeeAge !== null && <span className="text-sm opacity-60 font-normal ml-1">({employeeAge} Yrs)</span>}</h3>
                                                </div>
                                                <p className="text-xs opacity-60">Primary Policy Holder</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold uppercase tracking-widest opacity-50">Premium</p>
                                                <p className="text-xl font-black text-accent">₹200</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Spouse Card */}
                                    {watch('includeSpouse') && (
                                        <div className={`p-6 rounded-2xl border relative animate-slide-up ${isMobile ? 'bg-white/5 border-white/10' : 'bg-white border-border shadow-sm'}`}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setValue('includeSpouse', false);
                                                    setValue('spouseName', undefined as any); // Reset fields
                                                    setValue('spouseDob', undefined as any);
                                                    setValue('spouseContact', undefined as any);
                                                }}
                                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-red-50 text-red-500 transition-colors"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                            
                                            <div className="flex justify-between items-start mb-6 pr-10">
                                                <div className="flex items-center gap-2">
                                                    <Heart className="h-5 w-5 text-rose-500" />
                                                    <h3 className="font-bold text-lg">Spouse {getAge(watch('spouseDob')) !== null && <span className="text-sm opacity-60 font-normal ml-1 text-gray-800">({getAge(watch('spouseDob'))} Yrs)</span>}</h3>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-bold uppercase tracking-widest opacity-50">Premium</p>
                                                    <p className="text-xl font-black text-accent">₹200</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <Input
                                                    label="Spouse Name"
                                                    placeholder="Husband/Wife full name"
                                                    registration={register('spouseName')}
                                                    error={errors.spouseName?.message}
                                                    className={isMobile ? 'public-form-input' : ''}
                                                    labelClassName={isMobile ? 'public-form-label' : ''}
                                                />
                                                <Input
                                                    label="Spouse Contact"
                                                    placeholder="10 digit number"
                                                    registration={register('spouseContact')}
                                                    error={errors.spouseContact?.message}
                                                    maxLength={10}
                                                    className={isMobile ? 'public-form-input' : ''}
                                                    labelClassName={isMobile ? 'public-form-label' : ''}
                                                />
                                                <Input
                                                    type="date"
                                                    label="Spouse DOB"
                                                    registration={register('spouseDob')}
                                                    error={errors.spouseDob?.message}
                                                    className={isMobile ? 'public-form-input' : ''}
                                                    labelClassName={isMobile ? 'public-form-label' : ''}
                                                />
                                                <div className="space-y-2">
                                                    <label className={`text-sm font-semibold block mb-2 ${isMobile ? 'text-white/60 text-[10px] uppercase tracking-widest' : 'text-primary-text'}`}>Spouse Gender</label>
                                                    <Controller
                                                        name="spouseGender"
                                                        control={control}
                                                        render={({ field }) => (
                                                            <select 
                                                                {...field}
                                                                className={`w-full h-12 px-4 rounded-xl border-2 text-sm font-bold transition-all ${isMobile ? 'bg-white/5 border-white/10 text-white shadow-lg' : 'bg-white border-border text-primary-text'}`}
                                                            >
                                                                <option value="Male">Male</option>
                                                                <option value="Female">Female</option>
                                                            </select>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Children Cards */}
                                    {fields.map((field, index) => (
                                        <div key={field.id} className={`p-6 rounded-2xl border relative animate-slide-up ${isMobile ? 'bg-white/5 border-white/10' : 'bg-white border-border shadow-sm'}`}>
                                            <button
                                                type="button"
                                                onClick={() => remove(index)}
                                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-red-50 text-red-500 transition-colors"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>

                                            <div className="flex justify-between items-start mb-6 pr-10">
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-5 w-5 text-blue-500" />
                                                    <h3 className="font-bold text-lg">Child {index + 1} {getAge(watchChildren?.[index]?.dob) !== null && <span className="text-sm opacity-60 font-normal ml-1 text-gray-800">({getAge(watchChildren?.[index]?.dob)} Yrs)</span>}</h3>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-bold uppercase tracking-widest opacity-50">Premium</p>
                                                    <p className="text-xl font-black text-accent">₹150</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <Input
                                                    label={`Child Name`}
                                                    registration={register(`children.${index}.name` as const)}
                                                    error={errors.children?.[index]?.name?.message}
                                                    className={isMobile ? 'public-form-input' : ''}
                                                    labelClassName={isMobile ? 'public-form-label' : ''}
                                                />
                                                <Input
                                                    type="date"
                                                    label="Date of Birth"
                                                    registration={register(`children.${index}.dob` as const)}
                                                    error={errors.children?.[index]?.dob?.message}
                                                    className={isMobile ? 'public-form-input' : ''}
                                                    labelClassName={isMobile ? 'public-form-label' : ''}
                                                />
                                                <div className="space-y-2">
                                                    <label className={`text-sm font-semibold block mb-2 ${isMobile ? 'text-white/60 text-[10px] uppercase tracking-widest' : 'text-primary-text'}`}>Gender</label>
                                                    <Controller
                                                        name={`children.${index}.gender` as const}
                                                        control={control}
                                                        render={({ field }) => (
                                                            <select 
                                                                {...field}
                                                                className={`w-full h-10 px-3 rounded-xl border text-sm font-bold ${isMobile ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-border text-primary-text'}`}
                                                            >
                                                                <option value="Male">Male</option>
                                                                <option value="Female">Female</option>
                                                            </select>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <h2 className={`text-2xl font-bold mb-2 ${isMobile ? 'text-white' : 'text-primary-text'}`}>Plan Recommendation</h2>
                                    <p className={`${isMobile ? 'text-gray-400' : 'text-muted'} text-sm`}>Your customized insurance tier based on verified records.</p>
                                </div>

                                {premiumBreakdown.total > 0 ? (
                                    <div className="space-y-6">
                                        <div className="p-6 bg-gradient-to-br from-accent to-accent-dark rounded-3xl text-white shadow-xl shadow-accent/20 relative overflow-hidden">
                                            <div className="absolute -right-10 -bottom-10 opacity-10 transform rotate-12">
                                                <ShieldCheck className="h-64 w-64" />
                                            </div>
                                            
                                            <div className="relative z-10">
                                                <h3 className="font-bold text-xs uppercase tracking-widest mb-6 opacity-80">Premium Breakdown</h3>
                                                <div className="space-y-3 mb-6">
                                                    {premiumBreakdown.breakdown.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-center border-b border-white/10 pb-2 last:border-0">
                                                            <div>
                                                                <p className="font-bold text-sm">{item.name}</p>
                                                                <p className="text-xs opacity-70">Age: {item.age !== null ? item.age : '--'} {item.error && <span className="text-rose-300 ml-1">({item.error})</span>}</p>
                                                            </div>
                                                            <p className="font-bold text-lg">₹{item.rate}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <div className="pt-4 border-t border-white/20 flex justify-between items-end">
                                                    <div>
                                                        <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">Total Monthly Premium</p>
                                                        <p className="text-3xl font-black">₹{premiumBreakdown.total}</p>
                                                    </div>
                                                    <div className="text-right hidden md:block">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Rate Card</p>
                                                        <div className="flex gap-3 text-xs font-medium bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                                                            <span>Emp: ₹200</span>
                                                            <span className="w-px h-3 bg-white/20"></span>
                                                            <span>Spouse: ₹200</span>
                                                            <span className="w-px h-3 bg-white/20"></span>
                                                            <span>Child: ₹150</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-10 bg-rose-50 rounded-3xl border-2 border-dashed border-rose-200 text-center flex flex-col items-center gap-4">
                                        <div className="p-4 bg-rose-100 rounded-full">
                                            <ImageIcon className="h-10 w-10 text-rose-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-rose-900 text-lg">Incomplete Data</h3>
                                            <p className="text-rose-500 text-sm">Please return to Step 1 and provide a valid Date of Birth.</p>
                                        </div>
                                        <Button variant="secondary" size="sm" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Fix Now</Button>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-accent" />
                                        <h3 className={`font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}>Declarations & Consent</h3>
                                    </div>
                                    
                                    <div className={`border rounded-2xl p-6 h-48 overflow-y-auto space-y-4 text-sm leading-relaxed thin-scrollbar ${isMobile ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-page border-border text-muted'}`}>
                                        <div className="flex gap-3">
                                            <div className="w-5 h-5 rounded-full bg-accent-light text-accent flex items-center justify-center shrink-0 font-bold text-[10px]">1</div>
                                            <p>I authorize <strong>Paradigm Services</strong> to enroll me and my declared family members (Spouse/Children) in the Group Medical Cover (GMC) policy.</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="w-5 h-5 rounded-full bg-accent-light text-accent flex items-center justify-center shrink-0 font-bold text-[10px]">2</div>
                                            <p>I agree to the monthly premium deduction from my salary based on the age-based tier calculation displayed above.</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="w-5 h-5 rounded-full bg-accent-light text-accent flex items-center justify-center shrink-0 font-bold text-[10px]">3</div>
                                            <p>I understand that medical claims and settlements are subject to insurers' verification of the relationship and age documents declared here.</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="w-5 h-5 rounded-full bg-accent-light text-accent flex items-center justify-center shrink-0 font-bold text-[10px]">4</div>
                                            <p>All declarations made are truthful; any discrepancies found may lead to policy cancellation and corporate disciplinary action.</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="w-5 h-5 rounded-full bg-accent-light text-accent flex items-center justify-center shrink-0 font-bold text-[10px]">5</div>
                                            <p>This coverage will be carried forward for upcoming months. If you work for even one day in a month, these premium charges will be deducted.</p>
                                        </div>
                                    </div>

                                    <div className={`p-4 border rounded-xl shadow-sm ${isMobile ? 'bg-white/5 border-white/10' : 'bg-white border-border'}`}>
                                        <Controller
                                            name="acknowledged"
                                            control={control}
                                            render={({ field }) => (
                                                <Checkbox
                                                    id="acknowledged"
                                                    label="I verify my declarations and agree to the GMC enrollment terms."
                                                    labelClassName={`text-sm font-bold ${isMobile ? 'text-white' : 'text-primary-text'}`}
                                                    checked={field.value}
                                                    onChange={field.onChange}
                                                    inputClassName={isMobile ? 'text-accent border-white/20 bg-black/40 rounded' : ''}
                                                />
                                            )}
                                        />
                                        {errors.acknowledged && <p className="text-xs text-red-500 font-bold mt-2 ml-7">{errors.acknowledged.message}</p>}
                                    </div>
                                </div>
                            </div>


                        <div className={`flex flex-col sm:flex-row justify-end gap-4 pt-10 border-t ${isMobile ? 'border-white/10' : 'border-border'}`}>
                            <Button
                                type="submit"
                                className="w-full sm:w-64 h-12 !rounded-2xl !text-base !font-bold !shadow-lg shadow-accent/20"
                                isLoading={isSubmitting}
                            >
                                Confirm & Secure Enrollment
                                <ChevronRight className="h-5 w-5 ml-2" />
                            </Button>
                        </div>
                    </form>
                </div>

                <footer className={`border-t flex flex-col md:flex-row items-center justify-between text-[10px] md:text-xs font-bold uppercase tracking-widest ${
                    isMobile 
                        ? 'bg-black/20 border-white/10 text-gray-500' 
                        : 'bg-gray-50/50 border-border text-muted'
                }`}>
                    <div className="w-full p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-accent" />
                            <span>Secure SSL encrypted connection</span>
                        </div>
                        <span>&copy; {new Date().getFullYear()} Paradigm Services</span>
                    </div>
                </footer>
            </div>
        </div>
    </div>

    <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .thin-scrollbar::-webkit-scrollbar { width: 4px; }
                .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .thin-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scale-in { from { transform: scale(0.98); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
                .animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
                @keyframes slide-up { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </>
    );
};

export default GMCForm;
