import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller, SubmitHandler, useFieldArray, Resolver } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useEnrollmentRulesStore } from '../../store/enrollmentRulesStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { UploadedFile, PersonalDetails, BankDetails, UanDetails, EsiDetails, FamilyMember, DocumentRules, EducationRecord } from '../../types';
import FormHeader from '../../components/onboarding/FormHeader';
import UploadDocument from '../../components/UploadDocument';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Select from '../../components/ui/Select';
import { api } from '../../services/api';
import { Type } from "@google/genai";
import { format } from 'date-fns';
import { FileStack, User, CreditCard, UserCheck, Calendar, Users, ArrowRight, Plus, Trash2, AlertTriangle, Loader2, ArrowLeft, Phone, Mail, MapPin } from 'lucide-react';
import { AadhaarData, parseAadhaarZip, isAgeAbove18, formatNameToTitleCase } from '../../utils/aadhaarUtils';
import Modal from '../../components/ui/Modal';
import MismatchModal from '../../components/modals/MismatchModal';
import { useAuthStore } from '../../store/authStore';
import Input from '../../components/ui/Input';
import Logo from '../../components/ui/Logo';
import NotificationBell from '../../components/notifications/NotificationBell';


const defaultDesignationRules = {
    documents: {
        aadhaar: true,
        pan: true,
        bankProof: true,
        educationCertificate: true,
        salarySlip: true,
        uanProof: true,
        familyAadhaar: true,
    },
    verifications: {
        requireBengaluruAddress: true,
        requireDobVerification: true,
    }
};

const getValidationSchema = (rules: { documents: DocumentRules }) => {
    const familyMemberUploadSchema = yup.object({
        id: yup.string().required(),
        relation: yup.string<FamilyMember['relation']>().oneOf(['Spouse', 'Child', 'Father', 'Mother', '']).required("Relation is required"),
        phone: yup.string()
            .when('relation', {
                is: 'Child',
                then: (schema) => schema.optional().nullable().matches(/^[6-9][0-9]{9}$/, { message: 'Must be a valid 10-digit number', excludeEmptyString: true }),
                otherwise: (schema) => schema.required("Phone number is required").matches(/^[6-9][0-9]{9}$/, 'Must be a valid 10-digit Indian number'),
            }),
        idProof: rules.documents.familyAadhaar
            ? yup.mixed<UploadedFile | null>().nonNullable("Aadhaar proof is required for each family member.")
            : yup.mixed<UploadedFile | null>().optional().nullable(),
    });

    const educationRecordUploadSchema = yup.object({
        id: yup.string().required(),
        document: rules.documents.educationCertificate
            ? yup.mixed<UploadedFile | null>().nonNullable("Education certificate is required.")
            : yup.mixed<UploadedFile | null>().optional().nullable(),
    });

    return yup.object({
        photo: yup.mixed<UploadedFile | null>().optional().nullable(),
        aadhaarLinkedMobile: yup.string().required('Aadhaar-linked mobile number is required.').matches(/^[6-9][0-9]{9}$/, 'Must be a valid 10-digit number'),
        alternateMobile: yup.string().optional().nullable().matches(/^[6-9][0-9]{9}$/, { message: 'Must be a valid 10-digit number', excludeEmptyString: true }),
        idProofType: yup.string().oneOf(['Aadhaar', 'PAN', 'Voter ID', '']).required(),

        idProofFront: yup.mixed<UploadedFile | null>().nonNullable("Aadhaar (Front) is required."),
        idProofBack: yup.mixed<UploadedFile | null>().nonNullable("Aadhaar (Back) is required."),
        bankProof: yup.mixed<UploadedFile | null>().nonNullable("Bank proof document is required."),
        uanProof: yup.mixed<UploadedFile | null>().nonNullable("UAN proof document is required."),

        panCard: rules.documents.pan
            ? yup.mixed<UploadedFile | null>().nonNullable("PAN card is required.")
            : yup.mixed<UploadedFile | null>().optional().nullable(),

        salarySlip: rules.documents.salarySlip
            ? yup.mixed<UploadedFile | null>().nonNullable("Salary slip is required.")
            : yup.mixed<UploadedFile | null>().optional().nullable(),

        family: yup.array().of(familyMemberUploadSchema).optional(),
        education: yup.array().of(educationRecordUploadSchema).optional(),
    }).defined();
};


type PreUploadFormData = {
    photo: UploadedFile | null;
    aadhaarLinkedMobile: string;
    alternateMobile?: string | null;
    idProofType: 'Aadhaar' | 'PAN' | 'Voter ID' | '';
    idProofFront: UploadedFile | null;
    idProofBack: UploadedFile | null;
    bankProof: UploadedFile | null;
    panCard: UploadedFile | null;
    salarySlip: UploadedFile | null;
    uanProof: UploadedFile | null;
    family: { id: string; relation: FamilyMember['relation']; idProof: UploadedFile | null; phone: string; }[];
    education: { id: string; document: UploadedFile | null }[];
};

const fileToBase64 = (file: File): Promise<{ base64: string; type: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1], type: file.type });
        reader.onerror = error => reject(error);
    });
};


const PreUpload = () => {
    const navigate = useNavigate();
    const store = useOnboardingStore();
    const settingsStore = useSettingsStore();
    const { user } = useAuthStore();
    const { rulesByDesignation } = useEnrollmentRulesStore();

    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [mismatchModalState, setMismatchModalState] = useState({ isOpen: false, employeeName: '', bankName: '', reason: '' });
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [zipReviewData, setZipReviewData] = useState<AadhaarData | null>(null);
    const [isZipReviewOpen, setIsZipReviewOpen] = useState(false);
    const zipInputRef = React.useRef<HTMLInputElement>(null);

    const designation = store.data.organization.designation;
    const currentRules = useMemo(() =>
        (designation && rulesByDesignation[designation])
            ? rulesByDesignation[designation]
            : defaultDesignationRules,
        [designation, rulesByDesignation]);

    const validationSchema = useMemo(() => getValidationSchema(currentRules), [currentRules]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobileView = user?.role === 'field_staff' && isMobile;

    const { control, handleSubmit, formState: { errors }, getValues, watch } = useForm<PreUploadFormData>({
        resolver: yupResolver(validationSchema) as Resolver<PreUploadFormData>,
        defaultValues: { aadhaarLinkedMobile: '', alternateMobile: '', photo: null, idProofType: 'Aadhaar', idProofFront: null, idProofBack: null, bankProof: null, panCard: null, salarySlip: null, uanProof: null, family: [], education: [] },
    });

    const { fields: familyFields, append: appendFamily, remove: removeFamily } = useFieldArray({ control, name: "family" });
    const { fields: educationFields, append: appendEducation, remove: removeEducation } = useFieldArray({ control, name: "education" });
    const idProofType = watch('idProofType');
    const familyValues = watch('family');

    const processAndNavigate = async (formData: PreUploadFormData, isOverridden = false) => {
        setIsProcessing(true);
        store.setRequiresManualVerification(isOverridden);

        try {
            const useGemini = settingsStore.geminiApi.enabled;
            const useOffline = settingsStore.offlineOcr.enabled;

            // Schemas for Gemini
            const idFrontSchema = { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "The person's full name as written on the card." }, dob: { type: Type.STRING, description: "The person's date of birth in YYYY-MM-DD format. If only year available, return YYYY-01-01." }, gender: { type: Type.STRING, description: "Gender: 'Male', 'Female', or 'Other'." }, aadhaarNumber: { type: Type.STRING, description: "The 12-digit Aadhaar number, if present." }, panNumber: { type: Type.STRING, description: "The 10-character PAN number, if present." }, voterIdNumber: { type: Type.STRING, description: "The Voter ID number, also known as EPIC number." } } };
            const addressSchema = { type: Type.OBJECT, properties: { address: { type: Type.OBJECT, description: "The full address on the back of an Aadhaar card, parsed into components.", properties: { line1: { type: Type.STRING, description: "Full address line(s) excluding city, state, pincode. e.g., 'S/O: John Doe, 123 Maple Street, Anytown'" }, city: { type: Type.STRING }, state: { type: Type.STRING }, pincode: { type: Type.STRING } } } } };
            const bankProofSchema = { type: Type.OBJECT, properties: { accountHolderName: { type: Type.STRING, description: "The account holder's full name." }, accountNumber: { type: Type.STRING, description: "The full bank account number." }, ifscCode: { type: Type.STRING, description: "The bank's IFSC code." }, bankName: { type: Type.STRING, description: "The name of the bank (e.g., 'State Bank of India')." }, branchName: { type: Type.STRING, description: "The name of the bank branch (e.g., 'Koramangala Branch')." } } };
            const salarySlipSchema = { type: Type.OBJECT, properties: { uanNumber: { type: Type.STRING, description: "The 12-digit Universal Account Number (UAN)." }, pfNumber: { type: Type.STRING, description: "The Provident Fund (PF) account number." }, esiNumber: { type: Type.STRING, description: "The 10 or 17-digit ESI number." } } };
            const uanProofSchema = { type: Type.OBJECT, properties: { uanNumber: { type: Type.STRING } } };
            const familyAadhaarSchema = { type: Type.OBJECT, properties: { name: { type: Type.STRING }, dob: { type: Type.STRING } } };
            const educationSchema = { type: Type.OBJECT, properties: { degree: { type: Type.STRING }, institution: { type: Type.STRING }, endYear: { type: Type.STRING } } };

            // File Conversions
            const filePromises = [
                formData.idProofFront ? fileToBase64(formData.idProofFront.file!) : Promise.resolve(null),
                (formData.idProofType === 'Aadhaar' || formData.idProofType === 'Voter ID') && formData.idProofBack ? fileToBase64(formData.idProofBack.file!) : Promise.resolve(null),
                formData.bankProof ? fileToBase64(formData.bankProof.file!) : Promise.resolve(null),
                formData.panCard ? fileToBase64(formData.panCard.file!) : Promise.resolve(null),
                formData.salarySlip ? fileToBase64(formData.salarySlip.file!) : Promise.resolve(null),
                formData.uanProof ? fileToBase64(formData.uanProof.file!) : Promise.resolve(null),
                ...formData.family.map((f) => f.idProof ? fileToBase64(f.idProof.file!) : Promise.resolve(null)),
                ...formData.education.map((e) => e.document ? fileToBase64(e.document.file!) : Promise.resolve(null))
            ];
            const [idFrontFileData, idBackFileData, bankFileData, panFileData, salaryFileData, uanFileData, ...otherFilesData] = await Promise.all(filePromises);
            const familyFilesData = otherFilesData.slice(0, formData.family.length);
            const educationFilesData = otherFilesData.slice(formData.family.length);

            const panSchema = {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "Full name as shown on the PAN card." },
                    panNumber: { type: Type.STRING, description: "The 10-character PAN number." },
                    dob: { type: Type.STRING, description: "Date of birth in YYYY-MM-DD format." }
                }
            };

            // OCR Extraction Logic
            const extract = async (fileData: { base64: string, type: string } | null, schema: any, docType: string) => {
                if (!fileData) return {};
                if (useGemini) {
                    return api.extractDataFromImage(fileData.base64, fileData.type, schema, docType);
                } else if (useOffline) {
                    return api.extractDataFromImageLocal(fileData.base64, docType);
                }
                return {};
            };

            const [idFrontData, idBackData, bankData, panData, salaryData, uanData, ...ocrResults] = await Promise.all([
                extract(idFrontFileData, idFrontSchema, formData.idProofType as string),
                (formData.idProofType === 'Aadhaar') ? extract(idBackFileData, addressSchema, 'Aadhaar') : Promise.resolve({}),
                extract(bankFileData, bankProofSchema, 'Bank'),
                extract(panFileData, panSchema, 'PAN'),
                extract(salaryFileData, salarySlipSchema, 'Salary'),
                extract(uanFileData, uanProofSchema, 'UAN'),
                ...familyFilesData.map(fData => extract(fData, familyAadhaarSchema, 'Aadhaar')),
                ...educationFilesData.map(eData => extract(eData, educationSchema, 'Education'))
            ]);

            const familyOcrData = ocrResults.slice(0, familyFilesData.length);
            const educationOcrData = ocrResults.slice(familyFilesData.length);
            const idData = { ...idFrontData, ...idBackData };
            // Merge PAN data if available
            if (panData.panNumber) {
                idData.panNumber = panData.panNumber.replace(/\s/g, '');
                if (!idData.name) idData.name = panData.name;
                if (!idData.dob) idData.dob = panData.dob;
            }

            // Verification
            const nameOnId = idData.name || '';
            const nameOnBank = bankData.accountHolderName || '';

            if (!isOverridden && nameOnId && nameOnBank) {
                const { isMatch, reason } = await api.crossVerifyNames(nameOnId, nameOnBank);
                if (!isMatch) {
                    setMismatchModalState({ isOpen: true, employeeName: nameOnId, bankName: nameOnBank, reason });
                    setIsProcessing(false);
                    return;
                }
            }

            // Populate Store
            const personalUpdate: Partial<PersonalDetails> = {
                idProofType: formData.idProofType,
                idProofFront: formData.idProofFront,
                idProofBack: formData.idProofBack,
                photo: formData.photo,
                mobile: formData.aadhaarLinkedMobile,
                alternateMobile: formData.alternateMobile,
            };
            const personalVerified: Partial<PersonalDetails['verifiedStatus']> = {};
            if (idData.name) {
                const nameParts = idData.name.split(' ');
                personalUpdate.firstName = formatNameToTitleCase(nameParts.shift() || '');
                personalUpdate.lastName = formatNameToTitleCase(nameParts.pop() || '');
                personalUpdate.middleName = formatNameToTitleCase(nameParts.join(' '));
                personalUpdate.preferredName = personalUpdate.firstName;
                personalVerified.name = true;
            }
            if (idData.dob) { try { personalUpdate.dob = format(new Date(idData.dob.replace(/[-./]/g, '/')), 'yyyy-MM-dd'); personalVerified.dob = true; } catch (e) { } }
            if (idData.gender) {
                const genderLower = idData.gender.toLowerCase().trim();
                if (genderLower.includes('male') || genderLower.includes('purush') || genderLower === 'm') {
                    personalUpdate.gender = 'Male';
                } else if (genderLower.includes('female') || genderLower.includes('mahila') || genderLower === 'f') {
                    personalUpdate.gender = 'Female';
                } else if (genderLower.includes('transgender')) {
                    personalUpdate.gender = 'Other';
                }
            }
            if (idData.aadhaarNumber || idData.panNumber || idData.voterIdNumber) {
                personalUpdate.idProofNumber = (idData.aadhaarNumber || idData.panNumber || idData.voterIdNumber).replace(/\s/g, '');
                personalVerified.idProofNumber = true;
            }

            const bankUpdate: Partial<BankDetails> = { bankProof: formData.bankProof };
            const bankVerified: Partial<BankDetails['verifiedStatus']> = {};
            if (bankData.accountHolderName) { bankUpdate.accountHolderName = formatNameToTitleCase(bankData.accountHolderName); bankVerified.accountHolderName = true; }
            if (bankData.accountNumber) { const acNum = bankData.accountNumber.replace(/\D/g, ''); bankUpdate.accountNumber = acNum; bankUpdate.confirmAccountNumber = acNum; bankVerified.accountNumber = true; }
            if (bankData.ifscCode) { bankUpdate.ifscCode = bankData.ifscCode.toUpperCase().replace(/\s/g, ''); bankVerified.ifscCode = true; }
            if (bankData.bankName) { bankUpdate.bankName = bankData.bankName; }
            if (bankData.branchName) { bankUpdate.branchName = bankData.branchName; }

            const uanUpdate: Partial<UanDetails> = { salarySlip: formData.salarySlip, document: formData.uanProof };
            const esiUpdate: Partial<EsiDetails> = {};
            const uanVerified: Partial<UanDetails['verifiedStatus']> = {};
            const esiVerified: Partial<EsiDetails['verifiedStatus']> = {};
            const combinedUan = uanData?.uanNumber || salaryData?.uanNumber;
            if (combinedUan) { const uan = combinedUan.replace(/\D/g, ''); if (uan.length === 12) { uanUpdate.uanNumber = uan; uanUpdate.hasPreviousPf = true; uanVerified.uanNumber = true; } }
            if (salaryData?.pfNumber) { uanUpdate.pfNumber = salaryData.pfNumber; uanUpdate.hasPreviousPf = true; }
            if (salaryData?.esiNumber) { const esi = salaryData.esiNumber.replace(/\D/g, ''); if (esi.length === 10 || esi.length === 17) { esiUpdate.esiNumber = esi; esiUpdate.hasEsi = true; esiVerified.esiNumber = true; } }

            const newFamilyMembers: FamilyMember[] = familyOcrData.map((memberData, index) => {
                const formFam = formData.family[index];
                let dobString = '';
                if (memberData.dob) { try { dobString = format(new Date(memberData.dob.replace(/[-./]/g, '/')), 'yyyy-MM-dd'); } catch (e) { } }
                return { id: `fam_preupload_${Date.now()}_${index}`, relation: formFam.relation, name: formatNameToTitleCase(memberData.name) || '', dob: dobString, gender: '', occupation: '', dependent: false, idProof: formFam.idProof, phone: formFam.phone };
            });

            const newEducationRecords: EducationRecord[] = educationOcrData.map((eduData, index) => {
                const formEdu = formData.education[index];
                return { id: `edu_preupload_${Date.now()}_${index}`, degree: eduData.degree || '', institution: eduData.institution || '', startYear: '', endYear: eduData.endYear || '', document: formEdu.document };
            });

            if (idData.address) { store.updateAddress({ present: { ...idData.address, country: 'India', verifiedStatus: { line1: true, city: true, state: true, pincode: true, country: true } }, permanent: { ...idData.address, country: 'India' }, sameAsPresent: true }); }
            store.updateBank(bankUpdate);
            store.setBankVerifiedStatus(bankVerified);
            store.updateUan(uanUpdate);
            store.setUanVerifiedStatus(uanVerified);
            store.updateEsi(esiUpdate);
            store.setEsiVerifiedStatus(esiVerified);
            store.updateFamily(newFamilyMembers);
            store.updateEducation(newEducationRecords);
            store.updatePersonal(personalUpdate);
            store.setPersonalVerifiedStatus(personalVerified);

            setToast({ message: 'Application auto-filled! Please review.', type: 'success' });
            navigate('/onboarding/add/personal');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
            console.error("Document processing failed:", error);
            setToast({ message: `Document processing failed: ${errorMessage}`, type: 'error' });
            setIsProcessing(false);
        }
    };

    const handleFormSubmit: SubmitHandler<PreUploadFormData> = (data) => {
        setMismatchModalState({ isOpen: false, employeeName: '', bankName: '', reason: '' });
        processAndNavigate(data, false);
    };

    const handleOverride = () => {
        setMismatchModalState({ isOpen: false, employeeName: '', bankName: '', reason: '' });
        processAndNavigate(getValues(), true);
    };

    const handleZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setIsProcessing(true);
            const data = await parseAadhaarZip(file);
            if (data) {
                setZipReviewData(data);
                setIsZipReviewOpen(true);
            } else {
                setToast({ message: 'Could not parse Aadhaar data from zip file.', type: 'error' });
            }
        } catch (error) {
            setToast({ message: 'Failed to process zip file.', type: 'error' });
        } finally {
            setIsProcessing(false);
            if (zipInputRef.current) zipInputRef.current.value = '';
        }
    };

    const confirmZipDataAndFill = () => {
        if (!zipReviewData) return;
        
        const aadhaarData = zipReviewData;
        const nameParts = aadhaarData.name.split(' ');
        const firstName = formatNameToTitleCase(nameParts.shift() || '');
        const lastName = formatNameToTitleCase(nameParts.pop() || '');
        const middleName = formatNameToTitleCase(nameParts.join(' '));

        store.updatePersonal({
            firstName,
            lastName,
            middleName,
            preferredName: firstName,
            dob: aadhaarData.dob,
            gender: aadhaarData.gender as any,
            idProofType: 'Aadhaar',
            idProofNumber: aadhaarData.aadhaarNumber, 
            mobile: aadhaarData.mobile,
            email: aadhaarData.email,
            isQrVerified: true
        });

        if (aadhaarData.address) {
            store.updateAddress({
                present: {
                    line1: aadhaarData.address.line1,
                    city: aadhaarData.address.city,
                    state: aadhaarData.address.state,
                    pincode: aadhaarData.address.pincode,
                    country: 'India',
                    verifiedStatus: {
                        line1: true,
                        city: true,
                        state: true,
                        pincode: true,
                        country: true
                    }
                },
                permanent: {
                    line1: aadhaarData.address.line1,
                    city: aadhaarData.address.city,
                    state: aadhaarData.address.state,
                    pincode: aadhaarData.address.pincode,
                    country: 'India'
                },
                sameAsPresent: true
            });
        }

        store.setPersonalVerifiedStatus({
            name: true,
            dob: true,
            idProofNumber: true,
            email: !!aadhaarData.email
        });

        setIsZipReviewOpen(false);
        setToast({ message: 'Application auto-filled from Zip! Please review.', type: 'success' });
        navigate('/onboarding/add/personal');
    };

    return (
        <>
            {isProcessing && (
                <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-center animate-fade-in">
                    <div className="bg-white p-8 rounded-xl shadow-xl">
                        <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
                        <p className="mt-4 text-lg font-semibold text-primary-text">Processing Documents...</p>
                        <p className="text-muted text-center max-w-xs">Our AI is analyzing your files. This may take a moment.</p>
                    </div>
                </div>
            )}
            <div className="bg-card p-4 md:p-6 lg:p-8 rounded-xl shadow-card">
                <MismatchModal {...mismatchModalState} onClose={() => setMismatchModalState({ isOpen: false, employeeName: '', bankName: '', reason: '' })} onOverride={handleOverride} />
                <form onSubmit={handleSubmit(handleFormSubmit)}>
                    <FormHeader title="Document Collection" subtitle="Upload documents to auto-fill the application." />

                    <div className="space-y-8 mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <Controller name="photo" control={control} render={({ field }) => <UploadDocument label="Profile Photo" file={field.value} onFileChange={field.onChange} allowCapture allowedTypes={['image/jpeg', 'image/png', 'image/webp']} />} />
                            <div className="space-y-6">
                                <Controller name="aadhaarLinkedMobile" control={control} render={({ field, fieldState }) => (<Input label="Aadhaar Linked Mobile Number" type="tel" {...field} error={fieldState.error?.message} />)} />
                                <Controller name="alternateMobile" control={control} render={({ field, fieldState }) => (<Input label="Alternative Mobile Number (Optional)" type="tel" {...field} error={fieldState.error?.message} />)} />
                            </div>
                        </div>

                        <div className="border border-border rounded-lg p-4 bg-white">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-primary-text">Aadhaar Verification</h4>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept=".zip"
                                        className="hidden"
                                        ref={zipInputRef}
                                        onChange={handleZipUpload}
                                    />
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => zipInputRef.current?.click()}
                                        className="text-xs"
                                    >
                                        <FileStack className="h-4 w-4 mr-1 text-accent" />
                                        Upload Zip
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <Controller name="idProofFront" control={control} render={({ field }) => <UploadDocument label="Aadhaar (Front Side)" file={field.value} onFileChange={field.onChange} error={errors.idProofFront?.message as string} allowCapture verificationStatus={store.data.personal.verifiedStatus?.idProofNumber} />} />
                                <Controller name="idProofBack" control={control} render={({ field }) => <UploadDocument label="Aadhaar (Back Side)" file={field.value} onFileChange={field.onChange} error={errors.idProofBack?.message as string} allowCapture verificationStatus={store.data.personal.verifiedStatus?.idProofNumber} />} />
                            </div>
                            <p className="text-xs text-muted mt-2">Tip: Use "Upload Zip" or "Scan QR" for instant auto-fill, or upload images for OCR extraction.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <Controller name="bankProof" control={control} render={({ field }) => <UploadDocument label="Bank Proof (Passbook/Cancelled Cheque)" file={field.value} onFileChange={field.onChange} error={errors.bankProof?.message as string} allowCapture verificationStatus={store.data.bank.verifiedStatus?.accountNumber} />} />
                            <Controller name="uanProof" control={control} render={({ field }) => <UploadDocument label="UAN Proof Document" file={field.value} onFileChange={field.onChange} error={errors.uanProof?.message as string} allowCapture verificationStatus={store.data.uan.verifiedStatus?.uanNumber} />} />
                        </div>

                        {currentRules.documents.pan && (
                            <Controller name="panCard" control={control} render={({ field }) => <UploadDocument label="PAN Card" file={field.value} onFileChange={field.onChange} error={errors.panCard?.message as string} allowCapture />} />
                        )}

                        {currentRules.documents.salarySlip && <Controller name="salarySlip" control={control} render={({ field }) => <UploadDocument label={`Latest Salary Slip`} file={field.value} onFileChange={field.onChange} error={errors.salarySlip?.message as string} allowCapture />} />}

                        {currentRules.documents.educationCertificate && (
                            <div className="pt-6 border-t">
                                <h4 className="text-md font-semibold text-primary-text mb-4">Education Certificates</h4>
                                <div className="space-y-4">
                                    {educationFields.map((field, index) => (
                                        <div key={field.id} className="p-4 border rounded-lg bg-page/50 relative">
                                            <Controller name={`education.${index}.document`} control={control} render={({ field: controllerField, fieldState }) => (<UploadDocument label="Certificate" file={controllerField.value} onFileChange={controllerField.onChange} error={fieldState.error?.message} allowCapture />)} />
                                            <Button type="button" variant="icon" size="sm" onClick={() => removeEducation(index)} className="!absolute top-2 right-2"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" onClick={() => appendEducation({ id: `edu_upload_${Date.now()}`, document: null })}><Plus className="mr-2 h-4 w-4" /> Add Certificate</Button>
                                </div>
                            </div>
                        )}

                        {currentRules.documents.familyAadhaar && (
                            <div className="pt-6 border-t">
                                <h4 className="text-md font-semibold text-primary-text mb-4">Family Member Documents</h4>
                                <div className="space-y-4">
                                    {familyFields.map((field, index) => {
                                        const relation = familyValues?.[index]?.relation;
                                        const isChild = relation === 'Child';
                                        return (
                                            <div key={field.id} className="p-4 border rounded-lg bg-page/50 grid grid-cols-1 md:grid-cols-3 gap-4 items-start relative">
                                                <Controller name={`family.${index}.relation`} control={control} render={({ field, fieldState }) => (<Select label="Relation" error={fieldState.error?.message} {...field}> <option value="">Select</option><option>Spouse</option><option>Child</option><option>Father</option><option>Mother</option> </Select>)} />
                                                <Controller name={`family.${index}.phone`} control={control} render={({ field, fieldState }) => (<Input label={`Phone Number${isChild ? ' (Optional)' : ''}`} type="tel" {...field} error={fieldState.error?.message} />)} />
                                                <div className="md:col-start-1 md:col-span-3">
                                                    <Controller name={`family.${index}.idProof`} control={control} render={({ field, fieldState }) => (<UploadDocument label={`Aadhaar Card`} file={field.value} onFileChange={field.onChange} error={fieldState.error?.message} allowCapture />)} />
                                                </div>
                                                <Button type="button" variant="icon" size="sm" onClick={() => removeFamily(index)} className="!absolute top-2 right-2"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                            </div>
                                        )
                                    })}
                                    <Button type="button" variant="outline" onClick={() => appendFamily({ id: `fam_upload_${Date.now()}`, relation: '', idProof: null, phone: '' })}>
                                        <Plus className="mr-2 h-4 w-4" /> Add Family Member
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t flex justify-between items-center gap-4">
                        <Button type="button" variant="secondary" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                        <Button type="submit" isLoading={isProcessing}>Process</Button>
                    </div>
                </form>
            </div>
            {isZipReviewOpen && zipReviewData && (
                <div className="fixed inset-0 z-[500] flex flex-col bg-[#041b0f] text-white animate-fade-in overflow-hidden">
                    {/* Main content starts below the global header */}
                    <main className="flex-1 overflow-y-auto px-6 py-4 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 64px)' }}>
                        {/* Page Header Context */}
                        <div className="space-y-1">
                            <h1 className="text-xl font-bold text-white">Document Collection</h1>
                            <p className="text-sm text-white/50">Upload documents to auto-fill the application.</p>
                        </div>

                        {/* Verification Title */}
                        <div className="flex items-center gap-3 py-2">
                            <button 
                                type="button"
                                onClick={() => setIsZipReviewOpen(false)}
                                className="p-1 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <ArrowLeft className="h-6 w-6 text-accent" />
                            </button>
                            <h2 className="text-lg font-bold">Verify Extracted Details</h2>
                        </div>
                        {/* Photo Section */}
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                {zipReviewData.photo ? (
                                    <img 
                                        src={zipReviewData.photo} 
                                        alt="Resident" 
                                        className="w-20 h-20 rounded-full object-cover border-2 border-accent/20"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border-2 border-accent/10">
                                        <User className="h-10 w-10 text-accent/50" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Your photo</h3>
                                <p className="text-white/40 text-sm">Your digital photo saved on Aadhaar</p>
                            </div>
                        </div>

                        {/* Details List */}
                        <div className="space-y-6">
                            {[
                                { icon: User, label: "Full name", value: zipReviewData.name },
                                { icon: CreditCard, label: "Aadhaar Number", value: zipReviewData.aadhaarNumber, mono: true },
                                { icon: UserCheck, label: "Age Above 18", value: isAgeAbove18(zipReviewData.dob) },
                                { icon: Calendar, label: "Date of Birth", value: zipReviewData.dob },
                                { icon: User, label: "Gender", value: zipReviewData.gender },
                                { icon: Users, label: "Care of / Guardian", value: zipReviewData.careOf || 'N/A' },
                                { icon: MapPin, label: "Address", value: `${zipReviewData.address.line1}, ${zipReviewData.address.city}, ${zipReviewData.address.state} - ${zipReviewData.address.pincode}` },
                                { icon: Phone, label: "Mobile Number", value: zipReviewData.mobile || 'N/A' },
                                { icon: Mail, label: "Email", value: zipReviewData.email || 'N/A' }
                            ].map((item, idx) => (
                                <div key={idx} className="flex gap-4">
                                    <item.icon className="h-5 w-5 text-accent mt-1 flex-shrink-0" />
                                    <div className="space-y-1">
                                        <label className="block text-sm font-medium text-white/60">{item.label}</label>
                                        <p className={`text-accent font-semibold ${item.mono ? 'tracking-wider font-mono' : ''}`}>
                                            {item.value}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </main>

                    <footer className="p-6 space-y-3 bg-[#041b0f] border-t border-[#1f3d2b]">
                        <Button 
                            type="button"
                            className="w-full !bg-accent !text-[#02140a] !h-14 !rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                            onClick={confirmZipDataAndFill}
                        >
                            Confirm & Auto-fill
                        </Button>
                        <button 
                            type="button"
                            className="w-full h-14 rounded-2xl font-bold text-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                            onClick={() => {
                                setIsZipReviewOpen(false);
                                zipInputRef.current?.click();
                            }}
                        >
                            Re-upload Zip File
                        </button>
                    </footer>
                </div>
            )}
        </>
    );
};

export default PreUpload;