import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import type { OnboardingData } from '../../types';
import { api } from '../../services/api';
import { Download, Loader2, ArrowLeft, Printer, CheckCircle2, Building, User, Phone, MapPin, CreditCard, ShieldCheck, FileCheck, Calendar, Briefcase, GraduationCap, Users, Shirt, HeartPulse } from 'lucide-react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useLogoStore } from '../../store/logoStore';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { getProxyUrl } from '../../utils/fileUrl';

import { generatePifsCompliancePdf, savePifsCompliancePdfToServer } from '../../services/pifsCompliancePdfService';
import { downloadOnboardingAckSlipPdf } from '../../services/pifsAckSlipPdfService';

const OnboardingPdfOutput: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [employeeData, setEmployeeData] = useState<OnboardingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { data: storeData, setFormsGenerated } = useOnboardingStore();
    const user = useAuthStore((state) => state.user);
    const logo = useLogoStore((state) => state.currentLogo);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingAck, setIsGeneratingAck] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            if (id && !id.startsWith('draft_')) {
                try {
                    const data = await api.getOnboardingDataById(id);
                    setEmployeeData(data || storeData);
                } catch {
                    setEmployeeData(storeData);
                }
            } else {
                setEmployeeData(storeData);
            }
            setIsLoading(false);
        };
        fetchData();
    }, [id, storeData]);

    const handleExportAckSlip = async () => {
        if (!employeeData) return;
        setIsGeneratingAck(true);
        try {
            await downloadOnboardingAckSlipPdf(employeeData);
        } catch (error) {
            console.error("Ack Slip PDF generation failed:", error);
            alert(`Could not generate Ack Slip PDF: ${(error as any)?.message || error}`);
        } finally {
            setIsGeneratingAck(false);
        }
    };

    const handleExport = async () => {
        if (!employeeData) return;
        setIsGenerating(true);
        try {
            const pdfBytes = await generatePifsCompliancePdf(employeeData);
            const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const empId = (employeeData.personal?.employeeId || employeeData.id || 'employee').replace(/-/g, ' ');
            link.download = `PIFS Data Sheet ${empId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 5000);

            // Save on server in background
            savePifsCompliancePdfToServer(employeeData, pdfBytes).catch((err) => {
                console.warn('Background server compliance upload warning:', err);
            });
        } catch (error) {
            console.error("PIFS Compliance PDF generation failed:", error);
            alert(`Could not generate official 21-page PDF: ${(error as any)?.message || error}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirm = async () => {
        if (!employeeData) return;
        setIsConfirming(true);
        try {
            // Auto save to server
            try {
                const { savePifsCompliancePdfToServer } = await import('../../services/pifsCompliancePdfService');
                savePifsCompliancePdfToServer(employeeData).catch((err) => {
                    console.warn('Server compliance upload warning on confirm:', err);
                });
            } catch {
                /* non-blocking */
            }

            setFormsGenerated(true);
            const updated = { ...employeeData, formsGenerated: true };
            useOnboardingStore.getState().setData(updated);
            if (id && !id.startsWith('draft_')) {
                try {
                    await api.updateOnboarding(updated);
                } catch (err) {
                    console.warn("Could not sync formsGenerated to database:", err);
                }
            }
            navigate(`/onboarding/add/review${id ? `?id=${id}` : ''}`);
        } finally {
            setIsConfirming(false);
        }
    };

    if (isLoading) {
        return <LoadingScreen message="Compiling official employee onboarding forms..." />;
    }

    if (!employeeData) {
        return (
            <div className="text-center p-12 bg-card rounded-2xl m-6">
                <p className="text-rose-500 font-bold mb-4">Could not find employee onboarding records.</p>
                <Button onClick={() => navigate('/onboarding/add/review')}>Return to Review</Button>
            </div>
        );
    }

    const d = employeeData;
    const fullName = `${d.personal.firstName} ${d.personal.middleName || ''} ${d.personal.lastName}`.replace(/\s+/g, ' ').trim();
    const officerName = d.verifiedBy || user?.name || 'Authorized Field Officer';
    const officerRole = user?.role ? user.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Field Officer';
    const fatherName = d.family?.find(f => f.relation === 'Father')?.name || '—';
    const spouseName = d.family?.find(f => f.relation === 'Spouse')?.name || '—';
    const motherName = d.family?.find(f => f.relation === 'Mother')?.name || '—';
    const validEducation = d.education?.filter(edu => edu && (edu.degree?.trim() || edu.institution?.trim() || edu.endYear?.trim())) || [];
    const validFamily = d.family?.filter(fam => fam && (fam.name?.trim() || fam.relation?.trim())) || [];
    const validUniforms = d.uniforms?.filter(u => u && (u.itemName || u.quantity)) || [];
    const hasEducationOrFamily = validEducation.length > 0 || validFamily.length > 0;
    const photoUrl = d.personal.photo?.preview || (d.personal.photo as any)?.url || '';
    const signatureUrl = d.biometrics?.signatureImage?.preview || (d.biometrics?.signatureImage as any)?.url || '';

    return (
        <div className="bg-slate-100 min-h-screen py-6 px-3 sm:px-6">
            <div className="max-w-4xl mx-auto">
                {/* ── Top Header Toolbar ── */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 sticky top-4 z-20 print:hidden flex flex-col sm:flex-row justify-between items-center gap-4">
                    <Button 
                        type="button" 
                        onClick={() => navigate(-1)} 
                        variant="secondary"
                        className="w-full sm:w-auto"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                    </Button>

                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-emerald-600" />
                            <h2 className="font-bold text-base sm:text-lg text-slate-800">Official Onboarding Dossier</h2>
                        </div>
                        <p className="text-xs text-slate-500">Ref: ONB-{d.personal.employeeId} • Review before final submission</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                        <Button 
                            type="button" 
                            onClick={() => window.print()} 
                            variant="outline" 
                            size="sm"
                            title="Print Booklet"
                            className="hidden md:flex"
                        >
                            <Printer className="h-4 w-4 mr-1.5" /> Print
                        </Button>
                        <Button 
                            type="button" 
                            onClick={handleExportAckSlip} 
                            variant="outline" 
                            disabled={isGeneratingAck}
                            size="sm"
                            title="Download Onboarding Acknowledgement Slip PDF"
                            className="flex-1 sm:flex-none border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-semibold"
                        >
                            {isGeneratingAck ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600" /> : <FileCheck className="mr-2 h-4 w-4 text-emerald-600" />}
                            {isGeneratingAck ? 'Generating...' : 'Download Ack Slip'}
                        </Button>
                        <Button 
                            type="button" 
                            onClick={handleExport} 
                            variant="outline" 
                            disabled={isGenerating}
                            size="sm"
                            title="Download 21-Page Official Statutory Compliance Data Sheet"
                            className="flex-1 sm:flex-none"
                        >
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600" /> : <Download className="mr-2 h-4 w-4" />}
                            {isGenerating ? 'Generating...' : 'Download PIFS Data Sheet'}
                        </Button>
                        <Button 
                            type="button" 
                            onClick={handleConfirm}
                            disabled={isConfirming}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1 sm:flex-none shadow-md"
                        >
                            {isConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Confirm & Continue
                        </Button>
                    </div>
                </div>

                {/* ── Official Employee Onboarding Booklet ── */}
                <div className="space-y-6">
                    {/* PAGE 1: Personal Dossier & Identity Record */}
                    <div className="bg-white rounded-2xl border border-slate-300 shadow-xl p-6 sm:p-10 text-slate-800 text-xs sm:text-sm">
                        {/* Company Header */}
                        <div className="border-b-2 border-emerald-700 pb-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                {logo ? (
                                    <img src={logo} alt="Paradigm" className="h-10 object-contain" />
                                ) : (
                                    <div className="h-10 w-10 bg-emerald-700 text-white font-black rounded-lg flex items-center justify-center text-xl">P</div>
                                )}
                                <div>
                                    <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">PARADIGM INTEGRATED SERVICES</h1>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Employee Onboarding Dossier & Service Book</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold text-xs px-3 py-1 rounded-md">
                                    ID: {d.personal.employeeId}
                                </span>
                                <p className="text-[10px] text-slate-400 mt-1">Date: {d.enrollmentDate || new Date().toISOString().split('T')[0]}</p>
                            </div>
                        </div>

                        {/* Top Card: Photo + Core Badges */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center gap-6">
                            <div className="w-24 h-28 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0 border-2 border-slate-300 flex items-center justify-center shadow-inner">
                                {photoUrl ? (
                                    <img src={getProxyUrl(photoUrl)} alt={fullName} className="w-full h-full object-cover" />
                                ) : (
                                    <User className="h-10 w-10 text-slate-400" />
                                )}
                            </div>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left w-full">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Employee Full Name</p>
                                    <p className="font-extrabold text-slate-900 text-base">{fullName || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Designation</p>
                                    <p className="font-bold text-emerald-700">{d.organization.designation || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Allocated Site / Client</p>
                                    <p className="font-semibold text-slate-800">{d.organization.organizationName || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Department</p>
                                    <p className="font-semibold text-slate-800">{d.organization.department || 'Operations'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Section: Personal Particulars */}
                        <div className="mb-6">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-md mb-3 flex items-center gap-2">
                                <User className="h-3.5 w-3.5" /> 1. Personal Particulars & Identity
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
                                <div><span className="text-slate-400 text-xs block">Father's Name:</span> <span className="font-semibold">{fatherName}</span></div>
                                <div><span className="text-slate-400 text-xs block">Mother's Name:</span> <span className="font-semibold">{motherName}</span></div>
                                <div><span className="text-slate-400 text-xs block">Spouse's Name:</span> <span className="font-semibold">{spouseName}</span></div>
                                <div><span className="text-slate-400 text-xs block">Date of Birth:</span> <span className="font-semibold">{d.personal.dob || '—'}</span></div>
                                <div><span className="text-slate-400 text-xs block">Gender:</span> <span className="font-semibold">{d.personal.gender || '—'}</span></div>
                                <div><span className="text-slate-400 text-xs block">Blood Group:</span> <span className="font-semibold">{d.personal.bloodGroup || '—'}</span></div>
                                <div><span className="text-slate-400 text-xs block">Marital Status:</span> <span className="font-semibold">{d.personal.maritalStatus || '—'}</span></div>
                                <div><span className="text-slate-400 text-xs block">Aadhaar Number:</span> <span className="font-mono font-semibold">{d.personal.aadhaarNumber || d.personal.idProofNumber || '—'}</span></div>
                                <div><span className="text-slate-400 text-xs block">PAN Card Number:</span> <span className="font-mono font-semibold uppercase">{d.personal.panNumber || '—'}</span></div>
                            </div>
                        </div>

                        {/* Section: Contact & Addresses */}
                        <div className="mb-6">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-md mb-3 flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5" /> 2. Residential & Communication Addresses
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Present Address</p>
                                    <p className="text-xs font-medium text-slate-700">
                                        {d.address.present.line1}, {d.address.present.city}, {d.address.present.state} - {d.address.present.pincode}
                                    </p>
                                    <p className="text-xs font-semibold text-slate-600 mt-2">📱 Phone: {d.personal.mobile || '—'}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Permanent Address</p>
                                    <p className="text-xs font-medium text-slate-700">
                                        {d.address.sameAsPresent 
                                            ? 'Same as present address' 
                                            : `${d.address.permanent.line1}, ${d.address.permanent.city}, ${d.address.permanent.state} - ${d.address.permanent.pincode}`}
                                    </p>
                                    <p className="text-xs font-semibold text-slate-600 mt-2">🚨 Emergency: {d.personal.emergencyContactName} ({d.personal.relationship}) - {d.personal.emergencyContactNumber}</p>
                                </div>
                            </div>
                        </div>

                        {/* Section: Statutory PF & ESI Details */}
                        <div className="mb-6">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-md mb-3 flex items-center gap-2">
                                <ShieldCheck className="h-3.5 w-3.5" /> 3. Statutory Compliance (PF Form 11 & ESI)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div><span className="text-slate-400 text-xs block">UAN Number:</span> <span className="font-mono font-bold text-slate-800">{d.uan.uanNumber || '—'}</span></div>
                                <div><span className="text-slate-400 text-xs block">PF Member ID:</span> <span className="font-mono font-bold text-slate-800">{d.uan.pfNumber || '—'}</span></div>
                                <div><span className="text-slate-400 text-xs block">ESI Insurance No:</span> <span className="font-mono font-bold text-slate-800">{d.esi.esiNumber || '—'}</span></div>
                                <div><span className="text-slate-400 text-xs block">Monthly Gross Salary:</span> <span className="font-bold text-emerald-700">₹{d.personal.salary ? d.personal.salary.toLocaleString('en-IN') : '—'}</span></div>
                            </div>
                        </div>

                        {/* Section: Bank Mandate */}
                        <div className="mb-6">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-md mb-3 flex items-center gap-2">
                                <CreditCard className="h-3.5 w-3.5" /> 4. Bank Mandate & Salary Disbursal Account
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div><span className="text-slate-400 text-xs block">Bank Name:</span> <span className="font-semibold">{d.bank.bankName || '—'}</span></div>
                                <div><span className="text-slate-400 text-xs block">Account Holder:</span> <span className="font-semibold">{d.bank.accountHolderName || fullName}</span></div>
                                <div><span className="text-slate-400 text-xs block">Account Number:</span> <span className="font-mono font-bold text-slate-900">{d.bank.accountNumber || '—'}</span></div>
                                <div><span className="text-slate-400 text-xs block">IFSC Code:</span> <span className="font-mono font-bold text-slate-800 uppercase">{d.bank.ifscCode || '—'}</span></div>
                            </div>
                        </div>

                        {/* Section: Dependents & Education */}
                        {hasEducationOrFamily && (
                            <div className={`mb-6 grid gap-4 ${validEducation.length > 0 && validFamily.length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                                {validEducation.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold uppercase text-slate-600 mb-2 flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-emerald-700" /> Education Qualifications</h4>
                                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                                            <table className="min-w-full divide-y divide-slate-200 text-xs">
                                                <thead className="bg-slate-50 font-bold text-slate-600">
                                                    <tr><th className="p-2 text-left">Qualification</th><th className="p-2 text-left">Institution</th><th className="p-2 text-left">Year</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {validEducation.map((edu, i) => (
                                                        <tr key={i}><td className="p-2 font-medium">{edu.degree || '—'}</td><td className="p-2">{edu.institution || '—'}</td><td className="p-2">{edu.endYear || '—'}</td></tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                {validFamily.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold uppercase text-slate-600 mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-emerald-700" /> Family Dependents</h4>
                                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                                            <table className="min-w-full divide-y divide-slate-200 text-xs">
                                                <thead className="bg-slate-50 font-bold text-slate-600">
                                                    <tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Relation</th><th className="p-2 text-left">Dependent</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {validFamily.map((fam, i) => (
                                                        <tr key={i}><td className="p-2 font-medium">{fam.name || '—'}</td><td className="p-2">{fam.relation}</td><td className="p-2">{fam.dependent ? 'Yes' : 'No'}</td></tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Section: Uniform Allocation (if any) */}
                        {validUniforms.length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-xs font-bold uppercase text-slate-600 mb-2 flex items-center gap-1.5"><Shirt className="h-3.5 w-3.5 text-emerald-700" /> Uniform Allotment Docket</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                                    {validUniforms.map((uni, i) => (
                                        <div key={i}><span className="text-slate-400 block">{uni.itemName}:</span> <span className="font-bold">{uni.quantity}x (Size {uni.sizeLabel} - {uni.fit})</span></div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Solemn Declaration & Signature Docket */}
                        <div className="mt-8 pt-6 border-t-2 border-slate-200">
                            <p className="text-[11px] text-slate-500 italic mb-6">
                                "I hereby solemnly declare and affirm that all details, certificates, and particulars submitted in this onboarding dossier are accurate and true to the best of my knowledge. I understand that any false declaration will subject me to disciplinary and statutory actions."
                            </p>
                            <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
                                <div className="text-center">
                                    <div className="h-16 w-44 border-b-2 border-slate-400 flex items-center justify-center mb-1">
                                        {signatureUrl ? (
                                            <img src={getProxyUrl(signatureUrl)} alt="Candidate Signature" className="max-h-14 max-w-full object-contain" />
                                        ) : (
                                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Digitally Signed</span>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold text-slate-800">Employee Signature</p>
                                    <p className="text-[10px] text-slate-400">{fullName}</p>
                                </div>
                                <div className="text-center">
                                    <div className="h-16 w-48 border-b-2 border-slate-400 flex flex-col items-center justify-center mb-1">
                                        <span className="text-sm font-serif font-bold text-emerald-800 italic">{officerName}</span>
                                        <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">Enrolled & Attested</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-800">Field Officer / HR Attestation</p>
                                    <p className="text-[10px] text-emerald-700 font-semibold">{officerName} ({officerRole})</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Action Strip */}
                <div className="mt-6 flex justify-between items-center print:hidden">
                    <Button type="button" onClick={() => navigate(-1)} variant="secondary">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Return to Review
                    </Button>
                    <Button 
                        type="button" 
                        onClick={handleConfirm}
                        disabled={isConfirming}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg text-sm px-6 py-2.5"
                    >
                        {isConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Confirm & Proceed to e-Signature
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingPdfOutput;