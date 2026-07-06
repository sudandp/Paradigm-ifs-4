import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { FileStack, User, CreditCard, UserCheck, Calendar, Users, ArrowRight, Plus, Trash2, AlertTriangle, Loader2, ArrowLeft, Phone, Mail, MapPin, Save } from 'lucide-react';
import DraftSaveIndicator, { type DraftSaveStatus } from '../../components/onboarding/DraftSaveIndicator';
import { AadhaarData, parseAadhaarZip, isAgeAbove18, formatNameToTitleCase } from '../../utils/aadhaarUtils';
import Modal from '../../components/ui/Modal';
import MismatchModal from '../../components/modals/MismatchModal';
import { useAuthStore } from '../../store/authStore';
import Input from '../../components/ui/Input';
import Logo from '../../components/ui/Logo';
import NotificationBell from '../../components/notifications/NotificationBell';

// Per-field mandatory override state
interface MandatoryFieldState {
    idProofFront: boolean;
    idProofBack: boolean;
    bankProof: boolean;
    uanProof: boolean;
    panCard: boolean;
    salarySlip: boolean;
    familyAadhaar: boolean;
    educationCertificate: boolean;
    photo: boolean;
}

interface MandatoryToggleProps {
    fieldKey: keyof MandatoryFieldState;
    label: string;
    checked: boolean;
    onChange: (key: keyof MandatoryFieldState, value: boolean) => void;
}

const MandatoryToggle: React.FC<MandatoryToggleProps> = ({ fieldKey, label, checked, onChange }) => (
    <div className="flex items-center gap-2 mb-2">
        <label className="flex items-center gap-2 cursor-pointer select-none group">
            <div className="relative">
                <input
                    type="checkbox"
                    id={`mandatory-${fieldKey}`}
                    checked={checked}
                    onChange={(e) => onChange(fieldKey, e.target.checked)}
                    className="sr-only peer"
                />
                <div className={`w-9 h-5 rounded-full transition-colors duration-200 ${
                    checked ? 'bg-emerald-500' : 'bg-gray-300'
                }`} />
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                    checked ? 'translate-x-4' : 'translate-x-0'
                }`} />
            </div>
            <span className={`text-xs font-medium transition-colors ${
                checked ? 'text-emerald-600' : 'text-gray-400'
            }`}>
                {checked ? 'Mandatory' : 'Optional'}
            </span>
        </label>
    </div>
);


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

const getValidationSchema = (
    rules: { documents: DocumentRules },
    mandatory: MandatoryFieldState
) => {
    const familyMemberUploadSchema = yup.object({
        id: yup.string().required(),
        relation: yup.string<FamilyMember['relation']>().oneOf(['Spouse', 'Child', 'Father', 'Mother', '']).required("Relation is required"),
        phone: yup.string()
            .when('relation', {
                is: 'Child',
                then: (schema) => schema.optional().nullable().matches(/^[6-9][0-9]{9}$/, { message: 'Must be a valid 10-digit number', excludeEmptyString: true }),
                otherwise: (schema) => schema.required("Phone number is required").matches(/^[6-9][0-9]{9}$/, 'Must be a valid 10-digit Indian number'),
            }),
        idProof: mandatory.familyAadhaar
            ? yup.mixed<UploadedFile | null>().nonNullable("Aadhaar proof is required for each family member.")
            : yup.mixed<UploadedFile | null>().optional().nullable(),
    });

    const educationRecordUploadSchema = yup.object({
        id: yup.string().required(),
        degree: yup.string().optional().nullable(),
        institution: yup.string().optional().nullable(),
        endYear: yup.string().optional().nullable(),
        document: mandatory.educationCertificate
            ? yup.mixed<UploadedFile | null>().nonNullable("Education certificate is required.")
            : yup.mixed<UploadedFile | null>().optional().nullable(),
    });

    return yup.object({
        photo: yup.mixed<UploadedFile | null>().optional().nullable(),
        aadhaarLinkedMobile: yup.string().required('Aadhaar-linked mobile number is required.').matches(/^[6-9][0-9]{9}$/, 'Must be a valid 10-digit number'),
        alternateMobile: yup.string().optional().nullable().matches(/^[6-9][0-9]{9}$/, { message: 'Must be a valid 10-digit number', excludeEmptyString: true }),
        idProofType: yup.string().oneOf(['Aadhaar', 'PAN', 'Voter ID', '']).required(),

        idProofFront: mandatory.idProofFront
            ? yup.mixed<UploadedFile | null>().nonNullable("Aadhaar (Front) is required.")
            : yup.mixed<UploadedFile | null>().optional().nullable(),
        idProofBack: mandatory.idProofBack
            ? yup.mixed<UploadedFile | null>().nonNullable("Aadhaar (Back) is required.")
            : yup.mixed<UploadedFile | null>().optional().nullable(),
        bankProof: mandatory.bankProof
            ? yup.mixed<UploadedFile | null>().nonNullable("Bank proof document is required.")
            : yup.mixed<UploadedFile | null>().optional().nullable(),
        uanProof: mandatory.uanProof
            ? yup.mixed<UploadedFile | null>().nonNullable("UAN proof document is required.")
            : yup.mixed<UploadedFile | null>().optional().nullable(),

        panCard: mandatory.panCard
            ? yup.mixed<UploadedFile | null>().nonNullable("PAN card is required.")
            : yup.mixed<UploadedFile | null>().optional().nullable(),

        salarySlip: mandatory.salarySlip
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
    education: { id: string; degree?: string; institution?: string; endYear?: string; document: UploadedFile | null }[];
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
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
    const [mismatchModalState, setMismatchModalState] = useState({ isOpen: false, employeeName: '', bankName: '', reason: '' });
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [zipReviewData, setZipReviewData] = useState<AadhaarData | null>(null);
    const [isZipReviewOpen, setIsZipReviewOpen] = useState(false);
    const zipInputRef = React.useRef<HTMLInputElement>(null);

    // AI Mode Toggle
    const [isManualMode, setIsManualMode] = useState(true);

    // Draft auto-save state
    const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>('idle');
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const draftDebounceRef = React.useRef<number | null>(null);

    const designation = store.data.organization.designation;
    const currentRules = useMemo(() =>
        (designation && rulesByDesignation[designation])
            ? rulesByDesignation[designation]
            : defaultDesignationRules,
        [designation, rulesByDesignation]);

    // Per-field mandatory toggles — driven by enrollment rules but user-overridable
    const [mandatoryFields, setMandatoryFields] = useState<MandatoryFieldState>({
        idProofFront: true,
        idProofBack: true,
        bankProof: true,
        uanProof: false,          // UAN Proof is optional by default
        panCard: currentRules.documents.pan,
        salarySlip: currentRules.documents.salarySlip,
        familyAadhaar: currentRules.documents.familyAadhaar,
        educationCertificate: currentRules.documents.educationCertificate,
        photo: true,
    });

    // Sync with enrollment rules when designation changes
    useEffect(() => {
        setMandatoryFields(prev => ({
            ...prev,
            panCard: currentRules.documents.pan,
            salarySlip: currentRules.documents.salarySlip,
            familyAadhaar: currentRules.documents.familyAadhaar,
            educationCertificate: currentRules.documents.educationCertificate,
        }));
    }, [currentRules]);

    const handleMandatoryToggle = useCallback((key: keyof MandatoryFieldState, value: boolean) => {
        setMandatoryFields(prev => ({ ...prev, [key]: value }));
    }, []);

    const validationSchema = useMemo(() =>
        getValidationSchema(currentRules, mandatoryFields),
        [currentRules, mandatoryFields]
    );

    // Keep a ref to the latest schema so the dynamic resolver always uses up-to-date rules
    const validationSchemaRef = React.useRef(validationSchema);
    useEffect(() => { validationSchemaRef.current = validationSchema; }, [validationSchema]);

    const dynamicResolver: Resolver<PreUploadFormData> = useCallback(
        (values, context, options) =>
            (yupResolver(validationSchemaRef.current) as Resolver<PreUploadFormData>)(values, context, options),
        []
    );

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobileView = user?.role === 'field_staff' && isMobile;

    const { control, handleSubmit, formState: { errors }, getValues, watch, setValue } = useForm<PreUploadFormData>({
        resolver: dynamicResolver,
        defaultValues: {
            aadhaarLinkedMobile: store.data.personal.mobile || '',
            alternateMobile: store.data.personal.alternateMobile || '',
            photo: store.data.personal.photo || null,
            idProofType: store.data.personal.idProofType || 'Aadhaar',
            idProofFront: store.data.personal.idProofFront || null,
            idProofBack: store.data.personal.idProofBack || null,
            bankProof: store.data.bank.bankProof || null,
            panCard: store.data.personal.panCard || null,
            salarySlip: store.data.uan.salarySlip || null,
            uanProof: store.data.uan.document || null,
            family: store.data.family?.map(f => ({ id: f.id, relation: f.relation || '', idProof: f.idProof || null, phone: f.phone || '' })) || [],
            education: store.data.education?.map(e => ({ id: e.id, degree: e.degree || '', institution: e.institution || '', endYear: e.endYear || '', document: e.document || null })) || []
        },
    });

    const { fields: familyFields, append: appendFamily, remove: removeFamily } = useFieldArray({ control, name: "family" });
    const { fields: educationFields, append: appendEducation, remove: removeEducation } = useFieldArray({ control, name: "education" });
    const idProofType = watch('idProofType');
    const familyValues = watch('family');
    const aadhaarLinkedMobile = watch('aadhaarLinkedMobile');
    const alternateMobile = watch('alternateMobile');

    // Schemas for Gemini OCR extraction
    const idFrontSchema = useMemo(() => ({ type: Type.OBJECT, properties: {
        name: { type: Type.STRING, description: "The person's full name as written on the card." },
        dob: { type: Type.STRING, description: "Date of birth in YYYY-MM-DD format. If only year available, return YYYY-01-01." },
        gender: { type: Type.STRING, description: "Gender: 'Male', 'Female', or 'Other'." },
        aadhaarNumber: { type: Type.STRING, description: "The 12-digit Aadhaar number, if present." },
        panNumber: { type: Type.STRING, description: "The 10-character PAN number, if present." },
        voterIdNumber: { type: Type.STRING, description: "The Voter ID number (EPIC number)." },
        email: { type: Type.STRING, description: "The person's email address if printed on the document." },
        phone: { type: Type.STRING, description: "The person's phone or mobile number if printed on the front of the card." },
    }}), []);

    const addressSchema = useMemo(() => ({ type: Type.OBJECT, properties: {
        address: { type: Type.OBJECT, description: "Full address from the back of an Aadhaar card.", properties: {
            line1: { type: Type.STRING, description: "Address lines excluding city/state/pincode." },
            city: { type: Type.STRING },
            state: { type: Type.STRING },
            pincode: { type: Type.STRING },
        }},
        phone: { type: Type.STRING, description: "The person's phone or mobile number if printed on the back of the card (e.g. 'Mobile: XXXXXXXXXX')." }
    }}), []);

    const bankProofSchema = useMemo(() => ({ type: Type.OBJECT, properties: {
        accountHolderName: { type: Type.STRING, description: "The account holder's full name." },
        accountNumber: { type: Type.STRING, description: "The full bank account number (digits only)." },
        ifscCode: { type: Type.STRING, description: "The bank's IFSC code." },
        bankName: { type: Type.STRING, description: "The name of the bank (e.g., 'HDFC Bank')." },
        branchName: { type: Type.STRING, description: "The name of the bank branch." },
        email: { type: Type.STRING, description: "The account holder's email address if printed on the document." },
        phone: { type: Type.STRING, description: "The account holder's mobile/phone number if printed." },
        line1: { type: Type.STRING, description: "The address line 1 (street, building, etc.) from the bank document." },
        line2: { type: Type.STRING, description: "The address line 2 (area, locality, etc.) if any from the bank document." },
        city: { type: Type.STRING, description: "The city from the address on the bank document." },
        state: { type: Type.STRING, description: "The state from the address on the bank document." },
        pincode: { type: Type.STRING, description: "The pincode/postal code from the address on the bank document." },
    }}), []);

    const salarySlipSchema = useMemo(() => ({ type: Type.OBJECT, properties: {
        uanNumber: { type: Type.STRING, description: "The 12-digit Universal Account Number (UAN)." },
        pfNumber: { type: Type.STRING, description: "The Provident Fund (PF) account number." },
        esiNumber: { type: Type.STRING, description: "The 10 or 17-digit ESI number." },
        grossSalary: { type: Type.STRING, description: "The gross salary / gross earnings amount for the month (numeric string)." },
        employeeName: { type: Type.STRING, description: "The employee's full name as printed on the salary slip." },
        email: { type: Type.STRING, description: "The employee's email address if printed on the salary slip." },
    }}), []);

    const uanProofSchema = useMemo(() => ({ type: Type.OBJECT, properties: { uanNumber: { type: Type.STRING } } }), []);
    const familyAadhaarSchema = useMemo(() => ({
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: "Full name as shown on the document." },
            dob: { type: Type.STRING, description: "Date of birth in YYYY-MM-DD format." },
            phone: { type: Type.STRING, description: "Mobile/phone number if printed on the document (e.g. 'Mobile: XXXXXXXXXX')." }
        }
    }), []);
    const educationSchema = useMemo(() => ({ type: Type.OBJECT, properties: { degree: { type: Type.STRING }, institution: { type: Type.STRING }, endYear: { type: Type.STRING } } }), []);
    const panSchema = useMemo(() => ({ type: Type.OBJECT, properties: {
        name: { type: Type.STRING, description: "Full name as shown on the PAN card." },
        panNumber: { type: Type.STRING, description: "The 10-character PAN number." },
        dob: { type: Type.STRING, description: "Date of birth in YYYY-MM-DD format." },
        email: { type: Type.STRING, description: "The email address if printed on the card." },
        phone: { type: Type.STRING, description: "The phone or mobile number if printed on the PAN card." },
    }}), []);

    // Auto-detect Spouse → set marital status to Married in the store
    useEffect(() => {
        const hasSpouse = familyValues?.some(f => f.relation === 'Spouse');
        if (hasSpouse && store.data.personal.maritalStatus !== 'Married') {
            store.updatePersonal({ maritalStatus: 'Married' });
        }
    }, [familyValues]);

    const handleImmediateOcr = async (docType: string, extractedData: any, index?: number) => {
        try {
            const currentData = store.data;
            let personalUpdate: Partial<PersonalDetails> = {};
            let personalVerified: Partial<PersonalDetails['verifiedStatus']> = {};
            let bankUpdate: Partial<BankDetails> = {};
            let bankVerified: Partial<BankDetails['verifiedStatus']> = {};
            let uanUpdate: Partial<UanDetails> = {};
            let uanVerified: Partial<UanDetails['verifiedStatus']> = {};
            let esiUpdate: Partial<EsiDetails> = {};
            let esiVerified: Partial<EsiDetails['verifiedStatus']> = {};
            let addressUpdate: any = currentData.address;
            let familyUpdate = [...currentData.family];
            let educationUpdate = [...currentData.education];

            const docName = docType === 'idFront'
                ? (idProofType ? `${idProofType} Front` : 'ID Proof Front')
                : docType === 'idBack'
                    ? (idProofType ? `${idProofType} Back` : 'ID Proof Back')
                    : docType === 'pan'
                        ? 'PAN Card'
                        : docType === 'bank'
                            ? 'Bank Proof'
                            : 'document';

            const handleExtractedPhone = (extractedPhone: string | undefined | null, sourceName: string) => {
                if (!extractedPhone) return;
                const cleanPhone = extractedPhone.replace(/\D/g, '').slice(-10);
                if (cleanPhone.length !== 10) return;

                const currentVal = getValues('aadhaarLinkedMobile');
                if (!currentVal || currentVal.trim() === '') {
                    setValue('aadhaarLinkedMobile', cleanPhone, { shouldValidate: true });
                    personalUpdate.mobile = cleanPhone;
                } else {
                    const currentClean = currentVal.replace(/\D/g, '').slice(-10);
                    if (currentClean !== cleanPhone) {
                        setToast({ 
                            message: `We found mobile number ${cleanPhone} in your ${sourceName}, which differs from the entered ${currentVal}.`, 
                            type: 'warning' 
                        });
                    }
                }
            };

            if (docType === 'idFront') {
                const idData = extractedData;
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
                    if (genderLower.includes('male') || genderLower.includes('purush') || genderLower === 'm') personalUpdate.gender = 'Male';
                    else if (genderLower.includes('female') || genderLower.includes('mahila') || genderLower === 'f') personalUpdate.gender = 'Female';
                    else if (genderLower.includes('transgender')) personalUpdate.gender = 'Other';
                }
                if (idData.aadhaarNumber || idData.panNumber || idData.voterIdNumber) {
                    personalUpdate.idProofNumber = (idData.aadhaarNumber || idData.panNumber || idData.voterIdNumber).replace(/\s/g, '');
                    personalVerified.idProofNumber = true;
                }
                if (idData.email && idData.email.includes('@')) {
                    personalUpdate.email = idData.email.toLowerCase().trim();
                }
                if (idData.phone) {
                    handleExtractedPhone(idData.phone, docName);
                }
                setToast({ message: 'ID Proof details extracted and saved.', type: 'success' });
            } else if (docType === 'idBack') {
                if (extractedData.address) {
                    const newAddress = {
                        line1: extractedData.address.line1 || '',
                        line2: extractedData.address.line2 || '',
                        city: extractedData.address.city || '',
                        state: extractedData.address.state || '',
                        country: 'India',
                        pincode: extractedData.address.pincode || '',
                        source: 'Aadhaar Back'
                    };
                    const updatedList = [
                        ...(currentData.address.extractedAddresses || []).filter((a: any) => a.source !== 'Aadhaar Back'),
                        newAddress
                    ];
                    addressUpdate = {
                        present: { ...extractedData.address, country: 'India', verifiedStatus: { line1: true, city: true, state: true, pincode: true, country: true } },
                        permanent: { ...extractedData.address, country: 'India' },
                        sameAsPresent: true,
                        extractedAddresses: updatedList
                    };
                    setToast({ message: 'Address extracted and saved.', type: 'success' });
                }
                if (extractedData.phone) {
                    handleExtractedPhone(extractedData.phone, docName);
                }
            } else if (docType === 'pan') {
                const panData = extractedData;
                if (panData.panNumber) {
                    personalUpdate.idProofNumber = panData.panNumber.replace(/\s/g, '');
                    personalVerified.idProofNumber = true;
                    if (!currentData.personal.firstName && panData.name) {
                        const nameParts = panData.name.split(' ');
                        personalUpdate.firstName = formatNameToTitleCase(nameParts.shift() || '');
                        personalUpdate.lastName = formatNameToTitleCase(nameParts.pop() || '');
                        personalUpdate.middleName = formatNameToTitleCase(nameParts.join(' '));
                        personalUpdate.preferredName = personalUpdate.firstName;
                        personalVerified.name = true;
                    }
                    if (!currentData.personal.dob && panData.dob) { try { personalUpdate.dob = format(new Date(panData.dob.replace(/[-./]/g, '/')), 'yyyy-MM-dd'); personalVerified.dob = true; } catch (e) { } }
                }
                if (panData.email && panData.email.includes('@')) {
                    personalUpdate.email = panData.email.toLowerCase().trim();
                }
                if (panData.phone) {
                    handleExtractedPhone(panData.phone, docName);
                }
                setToast({ message: 'PAN details extracted and saved.', type: 'success' });
            } else if (docType === 'bank') {
                const bankData = extractedData;
                // ─── Bank account fields
                if (bankData.accountHolderName) { bankUpdate.accountHolderName = formatNameToTitleCase(bankData.accountHolderName); bankVerified.accountHolderName = true; }
                if (bankData.accountNumber) { const acNum = bankData.accountNumber.replace(/\D/g, ''); bankUpdate.accountNumber = acNum; bankUpdate.confirmAccountNumber = acNum; bankVerified.accountNumber = true; }
                if (bankData.ifscCode) { bankUpdate.ifscCode = bankData.ifscCode.toUpperCase().replace(/\s/g, ''); bankVerified.ifscCode = true; }
                if (bankData.bankName) bankUpdate.bankName = bankData.bankName;
                if (bankData.branchName) bankUpdate.branchName = bankData.branchName;
                // ─── Personal fields from bank document
                if (bankData.email && bankData.email.includes('@')) {
                    personalUpdate.email = bankData.email.toLowerCase().trim();
                }
                if (bankData.phone) {
                    handleExtractedPhone(bankData.phone, docName);
                }
                // ─── Address from bank document
                if (bankData.city || bankData.line1) {
                    const newAddress = {
                        line1: bankData.line1 || '',
                        line2: bankData.line2 || '',
                        city: bankData.city || '',
                        state: bankData.state || '',
                        country: 'India',
                        pincode: bankData.pincode || '',
                        source: 'Bank Proof'
                    };
                    const updatedList = [
                        ...(currentData.address.extractedAddresses || []).filter((a: any) => a.source !== 'Bank Proof'),
                        newAddress
                    ];
                    
                    const isMainAddressBlank = !currentData.address.present.line1 && !currentData.address.present.city;
                    addressUpdate = {
                        present: isMainAddressBlank ? {
                            line1: bankData.line1 || '',
                            line2: bankData.line2 || '',
                            city: bankData.city || '',
                            state: bankData.state || currentData.address.present.state,
                            pincode: bankData.pincode || currentData.address.present.pincode,
                            country: 'India',
                        } : currentData.address.present,
                        permanent: isMainAddressBlank ? {
                            line1: bankData.line1 || '',
                            line2: bankData.line2 || '',
                            city: bankData.city || '',
                            state: bankData.state || currentData.address.permanent.state,
                            pincode: bankData.pincode || currentData.address.permanent.pincode,
                            country: 'India',
                        } : currentData.address.permanent,
                        sameAsPresent: currentData.address.sameAsPresent,
                        extractedAddresses: updatedList
                    };
                }
                setToast({ message: 'Bank details extracted and saved.', type: 'success' });
            } else if (docType === 'salary' || docType === 'uan') {
                const uan = extractedData.uanNumber?.replace(/\D/g, ''); 
                if (uan && uan.length === 12) { uanUpdate.uanNumber = uan; uanUpdate.hasPreviousPf = true; uanVerified.uanNumber = true; }
                if (extractedData.pfNumber) { uanUpdate.pfNumber = extractedData.pfNumber; uanUpdate.hasPreviousPf = true; }
                if (extractedData.esiNumber) { const esi = extractedData.esiNumber.replace(/\D/g, ''); if (esi.length === 10 || esi.length === 17) { esiUpdate.esiNumber = esi; esiUpdate.hasEsi = true; esiVerified.esiNumber = true; } }
                // ─── Salary from salary slip (only if not already set)
                if (docType === 'salary' && extractedData.grossSalary && !currentData.personal.salary) {
                    const salaryNum = parseFloat(extractedData.grossSalary.replace(/[^0-9.]/g, ''));
                    if (!isNaN(salaryNum) && salaryNum > 0) personalUpdate.salary = salaryNum;
                }
                // ─── Employee name from salary slip (only if personal details not yet filled)
                if (docType === 'salary' && extractedData.employeeName && !currentData.personal.firstName) {
                    const nameParts = extractedData.employeeName.trim().split(' ');
                    personalUpdate.firstName = formatNameToTitleCase(nameParts.shift() || '');
                    personalUpdate.lastName = formatNameToTitleCase(nameParts.pop() || '');
                    personalUpdate.middleName = formatNameToTitleCase(nameParts.join(' '));
                    personalUpdate.preferredName = personalUpdate.firstName;
                    personalVerified.name = true;
                }
                // ─── Email from salary slip (only if present)
                if (docType === 'salary' && extractedData.email && extractedData.email.includes('@')) {
                    personalUpdate.email = extractedData.email.toLowerCase().trim();
                }
                setToast({ message: `${docType === 'salary' ? 'Salary slip' : 'UAN'} details extracted and saved.`, type: 'success' });
            } else if (docType === 'familyAadhaar' && index !== undefined) {
                let dobString = '';
                if (extractedData.dob) { try { dobString = format(new Date(extractedData.dob.replace(/[-./]/g, '/')), 'yyyy-MM-dd'); } catch (e) { } }
                
                let extractedPhone = '';
                if (extractedData.phone) {
                    const cleanPhone = extractedData.phone.replace(/\D/g, '').slice(-10);
                    if (cleanPhone.length === 10) {
                        extractedPhone = cleanPhone;
                    }
                }

                const existingMember = familyUpdate[index];
                if (existingMember) {
                    familyUpdate[index] = {
                        ...existingMember,
                        name: formatNameToTitleCase(extractedData.name) || existingMember.name,
                        dob: dobString || existingMember.dob,
                        phone: extractedPhone || existingMember.phone
                    };
                } else {
                    familyUpdate[index] = {
                        id: `fam_preupload_${Date.now()}_${index}`, 
                        relation: '', name: formatNameToTitleCase(extractedData.name) || '', 
                        dob: dobString, gender: '', occupation: '', dependent: false, 
                        idProof: null, phone: extractedPhone
                    };
                }
                
                if (extractedPhone) {
                    setValue(`family.${index}.phone`, extractedPhone, { shouldValidate: true });
                }
                
                setToast({ message: 'Family details extracted and saved.', type: 'success' });
            } else if (docType === 'education' && index !== undefined) {
                const existingEdu = educationUpdate[index];
                if (existingEdu) {
                    educationUpdate[index] = {
                        ...existingEdu,
                        degree: extractedData.degree || existingEdu.degree,
                        institution: extractedData.institution || existingEdu.institution,
                        endYear: extractedData.endYear || existingEdu.endYear,
                    };
                } else {
                    educationUpdate[index] = {
                        id: `edu_preupload_${Date.now()}_${index}`,
                        degree: extractedData.degree || '',
                        institution: extractedData.institution || '',
                        startYear: '',
                        endYear: extractedData.endYear || '',
                        document: null
                    };
                }
                setToast({ message: 'Education details extracted and saved.', type: 'success' });
            }

            const nextData = {
                ...currentData,
                personal: {
                    ...currentData.personal,
                    ...personalUpdate,
                    verifiedStatus: {
                        ...currentData.personal.verifiedStatus,
                        ...personalVerified,
                    },
                },
                address: addressUpdate,
                bank: {
                    ...currentData.bank,
                    ...bankUpdate,
                    verifiedStatus: {
                        ...currentData.bank.verifiedStatus,
                        ...bankVerified,
                    },
                },
                uan: {
                    ...currentData.uan,
                    ...uanUpdate,
                    verifiedStatus: {
                        ...currentData.uan.verifiedStatus,
                        ...uanVerified,
                    },
                },
                esi: {
                    ...currentData.esi,
                    ...esiUpdate,
                    verifiedStatus: {
                        ...currentData.esi.verifiedStatus,
                        ...esiVerified,
                    },
                },
                family: familyUpdate,
                education: educationUpdate,
            };

            store.setData(nextData);
            
            const { draftId } = await api.saveDraft(nextData);
            if (draftId !== store.data.id) {
                store.setData({ ...nextData, id: draftId });
            }

        } catch (error) {
            console.error("Error updating store with OCR data:", error);
            setToast({ message: 'Failed to save extracted data automatically.', type: 'error' });
        }
    };

    // Auto-save draft: persist text fields (mobile) to the store + DB when the user pauses typing
    const handlePreUploadDraft = useCallback(async () => {
        setSaveStatus('saving');
        try {
            // Build the updated data object explicitly to avoid the stale closure
            // that would result from reading store.data after calling store.updatePersonal().
            const updatedData = {
                ...store.data,
                personal: {
                    ...store.data.personal,
                    mobile: aadhaarLinkedMobile || '',
                    alternateMobile: alternateMobile || '',
                },
            };
            // Sync to store so other components see the latest mobile values
            store.updatePersonal({ mobile: aadhaarLinkedMobile || '', alternateMobile: alternateMobile || '' });
            const { draftId } = await api.saveDraft(updatedData);
            if (draftId !== store.data.id) {
                store.setData({ ...store.data, id: draftId });
            }
            setSaveStatus('saved');
            setLastSavedAt(new Date());
        } catch {
            setSaveStatus('dirty');
        }
    }, [aadhaarLinkedMobile, alternateMobile, store]);

    // Debounce: trigger auto-save 2s after the user stops typing the mobile number
    useEffect(() => {
        if (!aadhaarLinkedMobile) return;
        setSaveStatus('dirty');
        if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
        draftDebounceRef.current = window.setTimeout(() => {
            handlePreUploadDraft();
        }, 2000);
        return () => { if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current); };
    }, [aadhaarLinkedMobile, alternateMobile]);

    const processAndNavigate = async (formData: PreUploadFormData, isOverridden = false) => {
        setIsProcessing(true);
        store.setRequiresManualVerification(isOverridden);

        // Helper: only convert to base64 if the file has a raw File object (i.e., newly uploaded).
        // Files loaded back from the store have no .file and only have a URL/preview.
        const safeFileToBase64 = (f: UploadedFile | null | undefined) => {
            if (!f || !f.file) return Promise.resolve(null);
            return fileToBase64(f.file);
        };

        try {
            // File Conversions — only convert files that are freshly uploaded (have a raw File object)
            const filePromises = [
                safeFileToBase64(formData.idProofFront),
                (formData.idProofType === 'Aadhaar' || formData.idProofType === 'Voter ID') ? safeFileToBase64(formData.idProofBack) : Promise.resolve(null),
                safeFileToBase64(formData.bankProof),
                safeFileToBase64(formData.panCard),
                safeFileToBase64(formData.salarySlip),
                safeFileToBase64(formData.uanProof),
                ...formData.family.map((f) => safeFileToBase64(f.idProof)),
                ...formData.education.map((e) => safeFileToBase64(e.document))
            ];
            const [idFrontFileData, idBackFileData, bankFileData, panFileData, salaryFileData, uanFileData, ...otherFilesData] = await Promise.all(filePromises);
            const familyFilesData = otherFilesData.slice(0, formData.family.length);
            const educationFilesData = otherFilesData.slice(formData.family.length);



            // ─── Atomic store update ─────────────────────────────────────────
            // We just update the document files since OCR data is already saved instantly.
            const currentData = store.data;
            const nextData = {
                ...currentData,
                personal: {
                    ...currentData.personal,
                    idProofType: formData.idProofType,
                    idProofFront: formData.idProofFront,
                    idProofBack: formData.idProofBack,
                    photo: formData.photo,
                    mobile: formData.aadhaarLinkedMobile,
                    alternateMobile: formData.alternateMobile,
                    panCard: formData.panCard,
                },
                bank: {
                    ...currentData.bank,
                    bankProof: formData.bankProof,
                },
                uan: {
                    ...currentData.uan,
                    salarySlip: formData.salarySlip,
                    document: formData.uanProof,
                },
                family: formData.family.map((f, i) => {
                    const currentFam = currentData.family[i] || { 
                        id: `fam_preupload_${Date.now()}_${i}`,
                        name: '', dob: '', gender: '', occupation: '', dependent: false, relation: '', phone: '', idProof: null
                    };
                    return { ...currentFam, relation: f.relation, phone: f.phone, idProof: f.idProof };
                }),
                education: formData.education.map((e, i) => {
                    const currentEdu = currentData.education[i] || { 
                        id: `edu_preupload_${Date.now()}_${i}`,
                        degree: '', institution: '', startYear: '', endYear: '', document: null
                    };
                    return { ...currentEdu, degree: e.degree || currentEdu.degree, institution: e.institution || currentEdu.institution, endYear: e.endYear || currentEdu.endYear, document: e.document };
                }),
                requiresManualVerification: isOverridden,
            };
            store.setData(nextData);

            setToast({ message: 'Application auto-filled! Please review.', type: 'success' });
            // Defer navigation by one tick so React flushes the atomic state
            // update before PersonalDetails mounts and reads defaultValues.
            setTimeout(() => navigate('/onboarding/add/personal'), 0);
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

        // ─── Atomic store update (zip path) ────────────────────────────────
        const currentData = store.data;
        store.setData({
            ...currentData,
            personal: {
                ...currentData.personal,
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
                isQrVerified: true,
                verifiedStatus: {
                    ...currentData.personal.verifiedStatus,
                    name: true,
                    dob: true,
                    idProofNumber: true,
                    email: !!aadhaarData.email,
                },
            },
            address: aadhaarData.address
                ? {
                    present: {
                        line1: aadhaarData.address.line1,
                        city: aadhaarData.address.city,
                        state: aadhaarData.address.state,
                        pincode: aadhaarData.address.pincode,
                        country: 'India',
                        verifiedStatus: { line1: true, city: true, state: true, pincode: true, country: true },
                    },
                    permanent: {
                        line1: aadhaarData.address.line1,
                        city: aadhaarData.address.city,
                        state: aadhaarData.address.state,
                        pincode: aadhaarData.address.pincode,
                        country: 'India',
                    },
                    sameAsPresent: true,
                    extractedAddresses: [
                        ...(currentData.address.extractedAddresses || []).filter((a: any) => a.source !== 'Aadhaar Zip'),
                        {
                            line1: aadhaarData.address.line1,
                            line2: '',
                            city: aadhaarData.address.city,
                            state: aadhaarData.address.state,
                            country: 'India',
                            pincode: aadhaarData.address.pincode,
                            source: 'Aadhaar Zip'
                        }
                    ]
                }
                : currentData.address,
        });

        setIsZipReviewOpen(false);
        setToast({ message: 'Application auto-filled from Zip! Please review.', type: 'success' });
        setTimeout(() => navigate('/onboarding/add/personal'), 0);
    };

    return (
        <>
            {isProcessing && (
                <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-center animate-fade-in">
                    <div className="bg-[#0a2518] md:bg-white border border-white/10 md:border-border p-8 rounded-2xl shadow-xl">
                        <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
                        <p className="mt-4 text-lg font-semibold text-white md:text-primary-text">Processing Documents...</p>
                        <p className="text-white/50 md:text-muted text-center max-w-xs mt-1">Our AI is analyzing your files. This may take a moment.</p>
                    </div>
                </div>
            )}
            <div className="w-full px-0 md:bg-card md:p-6 lg:p-8 md:rounded-xl md:shadow-card md:border md:border-border">
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
                <MismatchModal {...mismatchModalState} onClose={() => setMismatchModalState({ isOpen: false, employeeName: '', bankName: '', reason: '' })} onOverride={handleOverride} />
                <form onSubmit={handleSubmit(handleFormSubmit)}>
                    {/* Page header — matches mobile style */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-xl font-bold text-white md:text-primary-text">Document Collection</h1>
                            <p className="text-sm text-white/50 md:text-muted mt-0.5">Upload documents to auto-fill the application.</p>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 md:bg-gray-100 md:border-gray-200">
                            <span className={`text-sm font-bold ${isManualMode ? 'text-accent' : 'text-white/40 md:text-muted'}`}>Manual</span>
                            <button type="button" onClick={() => setIsManualMode(!isManualMode)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${!isManualMode ? 'bg-accent' : 'bg-white/10 md:bg-gray-200'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${!isManualMode ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                            <span className={`text-sm font-bold ${!isManualMode ? 'text-accent' : 'text-white/40 md:text-muted'}`}>Auto AI</span>
                        </div>
                    </div>

                    <div className="space-y-0">

                        {/* Section 1: Profile & Contact */}
                        <div className="pb-6 mb-6 border-b border-white/10 md:border-border">
                            <p className="text-xs font-bold text-white/40 md:text-muted uppercase tracking-widest mb-4">Profile & Contact</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                                <div className="flex flex-col gap-2">
                                    <MandatoryToggle fieldKey="photo" label="Profile Photo" checked={mandatoryFields.photo} onChange={handleMandatoryToggle} />
                                    <Controller name="photo" control={control} render={({ field }) => <UploadDocument label={`Profile Photo${mandatoryFields.photo ? ' *' : ' (Optional)'}`} file={field.value} onFileChange={field.onChange} allowCapture allowedTypes={['image/jpeg', 'image/png', 'image/webp']} />} />
                                </div>
                                <div className="flex flex-col gap-5 md:pt-8">
                                    <Controller name="aadhaarLinkedMobile" control={control} render={({ field, fieldState }) => (<Input label="Aadhaar Linked Mobile Number" type="tel" {...field} error={fieldState.error?.message} />)} />
                                    <Controller name="alternateMobile" control={control} render={({ field, fieldState }) => (<Input label="Alternative Mobile Number (Optional)" type="tel" {...field} error={fieldState.error?.message} />)} />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Aadhaar Verification */}
                        <div className="pb-6 mb-6 border-b border-white/10 md:border-border">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs font-bold text-white/40 md:text-muted uppercase tracking-widest">Aadhaar Verification</p>
                                <div className="flex items-center gap-2">
                                    <input type="file" accept=".zip" className="hidden" ref={zipInputRef} onChange={handleZipUpload} />
                                    <Button type="button" variant="outline" size="sm" onClick={() => zipInputRef.current?.click()} className="text-xs !py-1">
                                        <FileStack className="h-3.5 w-3.5 mr-1 text-accent" /> Upload Zip
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-white/40 md:text-muted mb-5">Tip: Use "Upload Zip" or "Scan QR" for instant auto-fill, or switch to Auto AI for automatic extraction.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="flex flex-col gap-2">
                                    <MandatoryToggle fieldKey="idProofFront" label="Aadhaar Front" checked={mandatoryFields.idProofFront} onChange={handleMandatoryToggle} />
                                    <Controller name="idProofFront" control={control} render={({ field }) => <UploadDocument label={`Aadhaar (Front Side)${mandatoryFields.idProofFront ? ' *' : ' (Optional)'}`} file={field.value} onFileChange={field.onChange} error={errors.idProofFront?.message as string} allowCapture verificationStatus={store.data.personal.verifiedStatus?.idProofNumber} ocrSchema={!isManualMode ? idFrontSchema : undefined} onOcrComplete={(data) => handleImmediateOcr('idFront', data)} docType={idProofType} setToast={setToast} />} />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <MandatoryToggle fieldKey="idProofBack" label="Aadhaar Back" checked={mandatoryFields.idProofBack} onChange={handleMandatoryToggle} />
                                    <Controller name="idProofBack" control={control} render={({ field }) => <UploadDocument label={`Aadhaar (Back Side)${mandatoryFields.idProofBack ? ' *' : ' (Optional)'}`} file={field.value} onFileChange={field.onChange} error={errors.idProofBack?.message as string} allowCapture verificationStatus={store.data.personal.verifiedStatus?.idProofNumber} ocrSchema={!isManualMode ? addressSchema : undefined} onOcrComplete={(data) => handleImmediateOcr('idBack', data)} docType={idProofType} setToast={setToast} />} />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Financial Documents */}
                        <div className="pb-6 mb-6 border-b border-white/10 md:border-border">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs font-bold text-white/40 md:text-muted uppercase tracking-widest">Financial Documents</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="flex flex-col gap-2">
                                    <MandatoryToggle fieldKey="bankProof" label="Bank Proof" checked={mandatoryFields.bankProof} onChange={handleMandatoryToggle} />
                                    <Controller name="bankProof" control={control} render={({ field }) => <UploadDocument label={`Bank Proof (Passbook/Cancelled Cheque)${mandatoryFields.bankProof ? ' *' : ' (Optional)'}`} file={field.value} onFileChange={field.onChange} error={errors.bankProof?.message as string} allowCapture verificationStatus={store.data.bank.verifiedStatus?.accountNumber} ocrSchema={!isManualMode ? bankProofSchema : undefined} onOcrComplete={(data) => handleImmediateOcr('bank', data)} docType="Bank" setToast={setToast} />} />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <MandatoryToggle fieldKey="uanProof" label="UAN Proof" checked={mandatoryFields.uanProof} onChange={handleMandatoryToggle} />
                                    <Controller name="uanProof" control={control} render={({ field }) => <UploadDocument label={`UAN Proof Document${mandatoryFields.uanProof ? ' *' : ' (Optional)'}`} file={field.value} onFileChange={field.onChange} error={errors.uanProof?.message as string} allowCapture verificationStatus={store.data.uan.verifiedStatus?.uanNumber} ocrSchema={!isManualMode ? uanProofSchema : undefined} onOcrComplete={(data) => handleImmediateOcr('uan', data)} docType="UAN" setToast={setToast} />} />
                                </div>
                                {currentRules.documents.pan && (
                                    <div className="flex flex-col gap-2">
                                        <MandatoryToggle fieldKey="panCard" label="PAN Card" checked={mandatoryFields.panCard} onChange={handleMandatoryToggle} />
                                        <Controller name="panCard" control={control} render={({ field }) => <UploadDocument label={`PAN Card${mandatoryFields.panCard ? ' *' : ' (Optional)'}`} file={field.value} onFileChange={field.onChange} error={errors.panCard?.message as string} allowCapture ocrSchema={!isManualMode ? panSchema : undefined} onOcrComplete={(data) => handleImmediateOcr('pan', data)} docType="PAN" setToast={setToast} />} />
                                    </div>
                                )}
                                {currentRules.documents.salarySlip && (
                                    <div className="flex flex-col gap-2">
                                        <MandatoryToggle fieldKey="salarySlip" label="Salary Slip" checked={mandatoryFields.salarySlip} onChange={handleMandatoryToggle} />
                                        <Controller name="salarySlip" control={control} render={({ field }) => <UploadDocument label={`Latest Salary Slip${mandatoryFields.salarySlip ? ' *' : ' (Optional)'}`} file={field.value} onFileChange={field.onChange} error={errors.salarySlip?.message as string} allowCapture ocrSchema={!isManualMode ? salarySlipSchema : undefined} onOcrComplete={(data) => handleImmediateOcr('salary', data)} docType="Salary" setToast={setToast} />} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 4: Education Certificates */}
                        {currentRules.documents.educationCertificate && (
                            <div className="pb-6 mb-6 border-b border-white/10 md:border-border">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-bold text-white/40 md:text-muted uppercase tracking-widest">Education Certificates</p>
                                    <MandatoryToggle fieldKey="educationCertificate" label="Education Certificate" checked={mandatoryFields.educationCertificate} onChange={handleMandatoryToggle} />
                                </div>
                                <div className="space-y-4">
                                    {educationFields.map((field, index) => (
                                        <div key={field.id} className="border border-white/10 md:border-border rounded-2xl p-5 relative">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
                                                <Controller name={`education.${index}.degree`} control={control} render={({ field: controllerField, fieldState }) => (
                                                    <Select label="Degree / Qualification" error={fieldState.error?.message} {...controllerField}>
                                                        <option value="">Select Degree</option>
                                                        <option>SSLC / 10th</option>
                                                        <option>PUC / 12th</option>
                                                        <option>Graduation</option>
                                                        <option>Post Graduation</option>
                                                        <option>Diploma</option>
                                                        <option>Other</option>
                                                    </Select>
                                                )} />
                                                <Controller name={`education.${index}.institution`} control={control} render={({ field: controllerField, fieldState }) => (
                                                    <Input label="School / College / Institution" {...controllerField} error={fieldState.error?.message} />
                                                )} />
                                                <Controller name={`education.${index}.endYear`} control={control} render={({ field: controllerField, fieldState }) => (
                                                    <Input label="Passing Year" placeholder="e.g. 2024" {...controllerField} error={fieldState.error?.message} />
                                                )} />
                                                <div className="md:col-span-3">
                                                    <Controller name={`education.${index}.document`} control={control} render={({ field: controllerField, fieldState }) => (
                                                        <UploadDocument label="Upload Certificate" file={controllerField.value} onFileChange={controllerField.onChange} error={fieldState.error?.message} allowCapture ocrSchema={!isManualMode ? educationSchema : undefined} onOcrComplete={(data) => handleImmediateOcr('education', data, index)} docType="Education" setToast={setToast} />
                                                    )} />
                                                </div>
                                            </div>
                                            <Button type="button" variant="icon" size="sm" onClick={() => removeEducation(index)} className="!absolute top-3 right-3">
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" onClick={() => appendEducation({ id: `edu_upload_${Date.now()}`, degree: '', institution: '', endYear: '', document: null })}>
                                        <Plus className="mr-2 h-4 w-4" /> Add Education Certificate
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Section 5: Family Member Documents */}
                        {currentRules.documents.familyAadhaar && (
                            <div className="pb-6 mb-6 border-b border-white/10 md:border-border">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-bold text-white/40 md:text-muted uppercase tracking-widest">Family Member Documents</p>
                                    <MandatoryToggle fieldKey="familyAadhaar" label="Family Aadhaar" checked={mandatoryFields.familyAadhaar} onChange={handleMandatoryToggle} />
                                </div>
                                <div className="space-y-4">
                                    {familyFields.map((field, index) => {
                                        const relation = familyValues?.[index]?.relation;
                                        const isChild = relation === 'Child';
                                        return (
                                            <div key={field.id} className="border border-white/10 md:border-border rounded-2xl p-5 relative">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                                                    <Controller name={`family.${index}.relation`} control={control} render={({ field, fieldState }) => (<Select label="Relation" error={fieldState.error?.message} {...field}> <option value="">Select</option><option>Spouse</option><option>Child</option><option>Father</option><option>Mother</option> </Select>)} />
                                                    <Controller name={`family.${index}.phone`} control={control} render={({ field, fieldState }) => (<Input label={`Phone Number${isChild ? ' (Optional)' : ''}`} type="tel" {...field} error={fieldState.error?.message} />)} />
                                                    <div className="md:col-span-2">
                                                        <Controller name={`family.${index}.idProof`} control={control} render={({ field, fieldState }) => (<UploadDocument label="Aadhaar Card" file={field.value} onFileChange={field.onChange} error={fieldState.error?.message} allowCapture ocrSchema={!isManualMode ? familyAadhaarSchema : undefined} onOcrComplete={(data) => handleImmediateOcr('familyAadhaar', data, index)} docType="Aadhaar" setToast={setToast} />)} />
                                                    </div>
                                                </div>
                                                <Button type="button" variant="icon" size="sm" onClick={() => removeFamily(index)} className="!absolute top-3 right-3"><Trash2 className="h-4 w-4 text-red-500" /></Button>
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

                    {/* Footer Actions */}
                    <div className="pt-6 border-t border-white/10 md:border-border">
                        <div className="flex justify-between items-center gap-4">
                            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back
                            </Button>
                            <div className="flex items-center gap-3">
                                <DraftSaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} onManualSave={handlePreUploadDraft} />
                                {saveStatus === 'dirty' && (
                                    <Button type="button" variant="outline" size="sm" onClick={handlePreUploadDraft} className="flex items-center gap-1 text-sm">
                                        <Save className="h-4 w-4" /> Save Draft
                                    </Button>
                                )}
                                <Button type="submit" isLoading={isProcessing}>Process & Continue</Button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            {isZipReviewOpen && zipReviewData && (
                <div className="fixed inset-0 z-[500] flex flex-col bg-[#041b0f] text-white animate-fade-in overflow-hidden">
                    <main className="flex-1 overflow-y-auto px-6 py-4 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 64px)' }}>
                        <div className="space-y-1">
                            <h1 className="text-xl font-bold text-white">Document Collection</h1>
                            <p className="text-sm text-white/50">Upload documents to auto-fill the application.</p>
                        </div>
                        <div className="flex items-center gap-3 py-2">
                            <button type="button" onClick={() => setIsZipReviewOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                <ArrowLeft className="h-6 w-6 text-accent" />
                            </button>
                            <h2 className="text-lg font-bold">Verify Extracted Details</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                {zipReviewData.photo ? (
                                    <img src={zipReviewData.photo} alt="Resident" className="w-20 h-20 rounded-full object-cover border-2 border-accent/20" />
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
                        <Button type="button" className="w-full !bg-accent !text-[#02140a] !h-14 !rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(34,197,94,0.3)]" onClick={confirmZipDataAndFill}>
                            Confirm & Auto-fill
                        </Button>
                        <button type="button" className="w-full h-14 rounded-2xl font-bold text-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                            onClick={() => { setIsZipReviewOpen(false); zipInputRef.current?.click(); }}>
                            Re-upload Zip File
                        </button>
                    </footer>
                </div>
            )}
        </>
    );
};

export default PreUpload;