import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useForm, Controller, useFormContext } from 'react-hook-form';
import { useOnboardingStore } from '../../store/onboardingStore';
import FormHeader from '../../components/onboarding/FormHeader';
import UploadDocument from '../../components/UploadDocument';
import type { OnboardingData } from '../../types';
import { Type } from "@google/genai";
import { format } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { Plus } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import Tesseract from 'tesseract.js';
import Input from '../../components/ui/Input';

const formatNameToTitleCase = (value: string | undefined) => {
    if (!value) return '';
    return value.toLowerCase().replace(/\b(\w)/g, s => s.toUpperCase());
}

interface OutletContext {
  onValidated: () => Promise<void>;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

const Documents = () => {
    const { onValidated, setToast } = useOutletContext<OutletContext>();
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const { data, updatePersonal, updateBank, addEducationRecord, updateFamilyMember, updateEducationRecord, updateUan, updateEsi, updateGmc } = useOnboardingStore();
    const isMobile = useMediaQuery('(max-width: 767px)');
    
    const [techLicenseFile, setTechLicenseFile] = useState<File | null>(null);
    const [techLicenseExpiry, setTechLicenseExpiry] = useState<string>('');
    const [isOcrProcessing, setIsOcrProcessing] = useState(false);
    
    const processLicenseOcr = async (file: File) => {
        setTechLicenseFile(file);
        setIsOcrProcessing(true);
        setToast({ message: 'Analyzing license for expiry date...', type: 'success' });
        try {
            const result = await Tesseract.recognize(file, 'eng');
            const text = result.data.text;
            
            // Basic regex to find common expiry date formats (e.g., DD/MM/YYYY, DD-MM-YYYY, Exp: 12/2026)
            const dateMatch = text.match(/(?:valid till|expiry|exp|validity|valid upto)[\s:]*([\d]{2}[\/\-][\d]{2}[\/\-][\d]{4})/i) ||
                              text.match(/([\d]{2}[\/\-][\d]{2}[\/\-][\d]{4})/);
                              
            if (dateMatch && dateMatch[1]) {
                // Convert DD/MM/YYYY to YYYY-MM-DD for input type="date"
                const parts = dateMatch[1].split(/[\/\-]/);
                if (parts.length === 3) {
                    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    setTechLicenseExpiry(isoDate);
                    setToast({ message: 'Expiry date successfully extracted!', type: 'success' });
                }
            } else {
                setToast({ message: 'Could not automatically detect expiry date. Please enter manually.', type: 'error' });
            }
        } catch (error) {
            setToast({ message: 'OCR processing failed.', type: 'error' });
        } finally {
            setIsOcrProcessing(false);
        }
    };
    
    const handlePersonalIdOcr = (extractedData: any) => {
        const update: Partial<OnboardingData['personal']> = {};
         if (extractedData.name) {
            const nameParts = extractedData.name.split(' ');
            update.firstName = formatNameToTitleCase(nameParts.shift() || '');
            update.lastName = formatNameToTitleCase(nameParts.pop() || '');
            update.middleName = formatNameToTitleCase(nameParts.join(' '));
        }
        if (extractedData.dob) {
            try {
                const date = new Date(extractedData.dob);
                if(!isNaN(date.getTime())) update.dob = format(date, 'yyyy-MM-dd');
            } catch(e) {}
        }
        if (extractedData.aadhaarNumber) {
            update.idProofNumber = extractedData.aadhaarNumber.replace(/\s/g, '');
            update.idProofType = 'Aadhaar';
        }
        updatePersonal(update);
    };

    const handleBankOcr = (extractedData: any) => {
        const update: Partial<OnboardingData['bank']> = {};
         if (extractedData.accountHolderName) {
            update.accountHolderName = formatNameToTitleCase(extractedData.accountHolderName);
        }
        if (extractedData.accountNumber) {
            const acNum = extractedData.accountNumber.replace(/\D/g, '');
            update.accountNumber = acNum;
            update.confirmAccountNumber = acNum;
        }
        if (extractedData.ifscCode) {
            update.ifscCode = extractedData.ifscCode.toUpperCase().replace(/\s/g, '');
        }
        updateBank(update);
    };
    
    const handleUanOcr = (extractedData: any) => {
        const update: Partial<OnboardingData['uan']> = {};
        if(extractedData.uanNumber) {
            update.uanNumber = extractedData.uanNumber.replace(/\D/g, '');
            update.hasPreviousPf = true;
        }
        updateUan(update);
    };
    
    const handleEsiOcr = (extractedData: any) => {
        const update: Partial<OnboardingData['esi']> = {};
        if(extractedData.esiNumber) {
            update.esiNumber = extractedData.esiNumber.replace(/\D/g, '');
            update.hasEsi = true;
        }
        updateEsi(update);
    };

    const handleFamilyOcr = (id: string) => (extractedData: any) => {
        const update: Partial<OnboardingData['family'][0]> = {};
        if (extractedData.name) {
            update.name = formatNameToTitleCase(extractedData.name);
        }
        if (extractedData.dob) {
           try {
                const date = new Date(extractedData.dob);
                if(!isNaN(date.getTime())) update.dob = format(date, 'yyyy-MM-dd');
            } catch(e) {}
        }
        updateFamilyMember(id, update);
    };
    
    const handleEducationOcr = (id: string) => (extractedData: any) => {
         const update: Partial<OnboardingData['education'][0]> = {};
         if (extractedData.degree) update.degree = extractedData.degree;
         if (extractedData.institution) update.institution = extractedData.institution;
         if (extractedData.endYear) update.endYear = extractedData.endYear.toString();
         updateEducationRecord(id, update);
    };

    const idProofSchema = { type: Type.OBJECT, properties: { name: { type: Type.STRING }, dob: { type: Type.STRING }, aadhaarNumber: { type: Type.STRING } } };
    const bankProofSchema = { type: Type.OBJECT, properties: { accountHolderName: { type: Type.STRING }, accountNumber: { type: Type.STRING }, ifscCode: { type: Type.STRING } } };
    const salarySlipSchema = { type: Type.OBJECT, properties: { uanNumber: { type: Type.STRING, description: "The 12-digit Universal Account Number (UAN)." }, pfNumber: { type: Type.STRING, description: "The Provident Fund (PF) account number." }, esiNumber: { type: Type.STRING, description: "The 10 or 17-digit ESI number." } } };
    const uanSchema = { type: Type.OBJECT, properties: { uanNumber: { type: Type.STRING } } };
    const esiSchema = { type: Type.OBJECT, properties: { esiNumber: { type: Type.STRING } } };
    const educationSchema = { type: Type.OBJECT, properties: { degree: { type: Type.STRING }, institution: { type: Type.STRING }, endYear: { type: Type.STRING } } };


    if (isMobile) {
        return (
            <form onSubmit={async (e) => { e.preventDefault(); await onValidated(); }} id="documents-form">
                <p className="text-sm text-gray-400 mb-6">Upload supporting documents. You can also do this within each relevant section.</p>
                <div className="space-y-4">
                    <UploadDocument label="ID Proof (Front Side)" file={data.personal.idProofFront} onFileChange={(file) => updatePersonal({ idProofFront: file })} onOcrComplete={handlePersonalIdOcr} ocrSchema={idProofSchema} setToast={setToast} allowCapture docType={data.personal.idProofType || 'Aadhaar'} />
                    <UploadDocument label="ID Proof (Back Side)" file={data.personal.idProofBack} onFileChange={(file) => updatePersonal({ idProofBack: file })} onOcrComplete={handlePersonalIdOcr} ocrSchema={idProofSchema} setToast={setToast} allowCapture docType={data.personal.idProofType || 'Aadhaar'} />
                    <UploadDocument label="Profile Photo" file={data.personal.photo} onFileChange={(file) => updatePersonal({ photo: file })} allowCapture allowedTypes={['image/jpeg', 'image/png', 'image/webp']} />
                    <UploadDocument label="Bank Proof" file={data.bank.bankProof} onFileChange={(file) => updateBank({ bankProof: file })} onOcrComplete={handleBankOcr} ocrSchema={bankProofSchema} setToast={setToast} allowCapture docType="Bank" />
                    <UploadDocument label="Latest Salary Slip (Optional, for UAN/ESI)" file={data.uan.salarySlip} onFileChange={(file) => updateUan({ salarySlip: file })} onOcrComplete={(d) => { handleUanOcr(d); handleEsiOcr(d); }} ocrSchema={salarySlipSchema} setToast={setToast} allowCapture docType="Salary" />
                    {data.uan.hasPreviousPf && <UploadDocument label="UAN Document" file={data.uan.document} onFileChange={(file) => updateUan({ document: file })} onOcrComplete={handleUanOcr} ocrSchema={uanSchema} setToast={setToast} allowCapture docType="UAN" />}
                    {data.esi.hasEsi && <UploadDocument label="ESI Document" file={data.esi.document} onFileChange={(file) => updateEsi({ document: file })} onOcrComplete={handleEsiOcr} ocrSchema={esiSchema} setToast={setToast} allowCapture />}
                    {data.gmc.isOptedIn === false && <UploadDocument label="GMC Policy Copy" file={data.gmc.gmcPolicyCopy} onFileChange={(file) => updateGmc({ gmcPolicyCopy: file })} allowCapture />}
                    
                    <div className="mt-6 pt-6 border-t border-[#374151]">
                        <h4 className="form-header-title mb-4">Education Certificates</h4>
                        <div className="space-y-4">
                             {data.education.map(record => (
                                 <UploadDocument key={record.id} label={`Certificate for ${record.degree || 'Qualification'}`} file={record.document} onFileChange={(file) => updateEducationRecord(record.id, { document: file })} onOcrComplete={handleEducationOcr(record.id)} ocrSchema={educationSchema} setToast={setToast} allowCapture />
                            ))}
                            <Button type="button" onClick={() => navigate('/onboarding/add/education')} variant="secondary" className="w-full flex items-center justify-center">
                                <Plus className="mr-2 h-4 w-4" />
                                <span>Add / Edit Qualifications</span>
                            </Button>
                        </div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-[#374151]">
                        <h4 className="form-header-title mb-4">Family Member Documents</h4>
                         <div className="space-y-4">
                            {data.family.map(member => (
                                <UploadDocument key={member.id} label={`ID Proof for ${member.name || 'Family Member'}`} file={member.idProof} onFileChange={(file) => updateFamilyMember(member.id, { idProof: file })} onOcrComplete={handleFamilyOcr(member.id)} ocrSchema={idProofSchema} setToast={setToast} allowCapture docType="Aadhaar" />
                            ))}
                            {data.family.length === 0 && <p className="text-sm text-gray-400">No family members added.</p>}
                            <Button type="button" onClick={() => navigate('/onboarding/add/family')} variant="secondary" className="w-full flex items-center justify-center">
                                <Plus className="mr-2 h-4 w-4" />
                                <span>Add/Edit on Family Page</span>
                            </Button>
                        </div>
                    </div>
                    
                    {/* Technical License Expiry Vault */}
                    <div className="mt-6 pt-6 border-t border-[#374151]">
                        <h4 className="form-header-title mb-4">Technical License Expiry Vault</h4>
                        <div className="space-y-4">
                            <UploadDocument 
                                label="Upload Technical License (e.g., Driving, Electrical, Arms)" 
                                file={techLicenseFile ? { name: techLicenseFile.name, url: URL.createObjectURL(techLicenseFile) } as any : null} 
                                onFileChange={(file) => {
                                    if (file && file instanceof File) {
                                        processLicenseOcr(file);
                                    }
                                }} 
                                allowCapture 
                            />
                            {isOcrProcessing && <p className="text-sm text-accent animate-pulse">Running OCR Engine...</p>}
                            <div className="mt-2">
                                <label className="block text-sm font-medium text-gray-300 mb-1">Detected Expiry Date</label>
                                <input 
                                    type="date" 
                                    value={techLicenseExpiry} 
                                    onChange={(e) => setTechLicenseExpiry(e.target.value)} 
                                    className="form-input bg-[#243524] text-white border-[#374151]" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        );
    }

    return (
        <form onSubmit={async (e) => { e.preventDefault(); await onValidated(); }} id="documents-form">
            <FormHeader title="Document Collection" subtitle="Upload supporting documents. You can also do this within each relevant section." />

            <div className="space-y-6">
                <section>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <UploadDocument
                            label="Employee ID Proof (Aadhaar/PAN) - Front Side"
                            file={data.personal.idProofFront}
                            onFileChange={(file) => updatePersonal({ idProofFront: file })}
                            onOcrComplete={handlePersonalIdOcr}
                            ocrSchema={idProofSchema}
                            setToast={setToast}
                            docType={data.personal.idProofType || 'Aadhaar'}
                        />
                         <UploadDocument
                            label="Employee ID Proof (Aadhaar/PAN) - Back Side"
                            file={data.personal.idProofBack}
                            onFileChange={(file) => updatePersonal({ idProofBack: file })}
                            onOcrComplete={handlePersonalIdOcr}
                            ocrSchema={idProofSchema}
                            setToast={setToast}
                            docType={data.personal.idProofType || 'Aadhaar'}
                        />
                        <UploadDocument
                            label="Bank Proof (Passbook/Cancelled Cheque)"
                            file={data.bank.bankProof}
                            onFileChange={(file) => updateBank({ bankProof: file })}
                            onOcrComplete={handleBankOcr}
                            ocrSchema={bankProofSchema}
                            setToast={setToast}
                            docType="Bank"
                        />
                        <UploadDocument
                            label="Latest Salary Slip (Optional, for UAN/ESI)"
                            file={data.uan.salarySlip}
                            onFileChange={(file) => updateUan({ salarySlip: file })}
                            onOcrComplete={(d) => { handleUanOcr(d); handleEsiOcr(d); }}
                            ocrSchema={salarySlipSchema}
                            setToast={setToast}
                            docType="Salary"
                         />
                    </div>
                </section>
                
                 <section>
                    <h4 className="text-md font-semibold text-primary-text mb-4 border-b pb-2">Education Certificates</h4>
                    <div className="space-y-4">
                        {data.education.map((record) => (
                            <UploadDocument
                                key={record.id}
                                label={`Certificate for ${record.degree || 'New Qualification'}`}
                                file={record.document}
                                onFileChange={(file) => updateEducationRecord(record.id, { document: file })}
                                onOcrComplete={handleEducationOcr(record.id)}
                                ocrSchema={educationSchema}
                                setToast={setToast}
                            />
                        ))}
                        <Button type="button" variant="outline" onClick={() => addEducationRecord()}>
                            <Plus className="mr-2 h-4 w-4" /> Add Qualification
                        </Button>
                    </div>
                </section>

                <section>
                    <h4 className="text-md font-semibold text-primary-text mb-4 border-b pb-2">Family Member Documents</h4>
                    <div className="space-y-4">
                        {data.family.map((member) => (
                            <UploadDocument
                                key={member.id}
                                label={`ID Proof for ${member.name || `(${member.relation})`}`}
                                file={member.idProof}
                                onFileChange={(file) => updateFamilyMember(member.id, { idProof: file })}
                                onOcrComplete={handleFamilyOcr(member.id)}
                                ocrSchema={idProofSchema}
                                setToast={setToast}
                                docType="Aadhaar"
                            />
                        ))}
                        {data.family.length === 0 && <p className="text-sm text-muted">No family members added yet.</p>}
                        <Button type="button" variant="outline" onClick={() => navigate('/onboarding/add/family')}>
                            <Plus className="mr-2 h-4 w-4" /> Go to Family Page to Add/Edit
                        </Button>
                    </div>
                </section>
                
                {/* Technical License Expiry Vault */}
                <section>
                    <h4 className="text-md font-semibold text-primary-text mb-4 border-b pb-2">Technical License Expiry Vault</h4>
                    <p className="text-sm text-muted mb-4">Upload technical licenses (Driving, Firearms, Electrical, etc.). Our OCR engine will automatically detect the expiry date for the expiry vault.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
                        <div>
                            <UploadDocument 
                                label="Upload License Document" 
                                file={techLicenseFile ? { name: techLicenseFile.name, url: URL.createObjectURL(techLicenseFile) } as any : null} 
                                onFileChange={(file) => {
                                    if (file && file instanceof File) {
                                        processLicenseOcr(file);
                                    }
                                }} 
                                allowCapture 
                            />
                            {isOcrProcessing && <p className="text-sm text-accent mt-2 animate-pulse">Running Tesseract.js OCR Engine...</p>}
                        </div>
                        <div>
                            <Input 
                                type="date" 
                                label="License Expiry Date (Auto-detected)"
                                value={techLicenseExpiry} 
                                onChange={(e) => setTechLicenseExpiry(e.target.value)} 
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                Expiry dates are monitored in the Expiry Vault to ensure 100% compliance. 
                                Notifications will be sent 30 days prior to expiration.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </form>
    );
};

export default Documents;