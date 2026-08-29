import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { OnboardingData } from '../../types';
import Button from '../ui/Button';
import { Download, Loader2, Printer, CheckCircle2, ShieldCheck, User, MapPin, CreditCard, GraduationCap, Users, Shirt, X } from 'lucide-react';
import { useLogoStore } from '../../store/logoStore';
import { useAuthStore } from '../../store/authStore';
import { getProxyUrl } from '../../utils/fileUrl';

interface OnboardingBookletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    employeeData: OnboardingData;
}

export const OnboardingBookletModal: React.FC<OnboardingBookletModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    employeeData
}) => {
    const logo = useLogoStore((state) => state.currentLogo);
    const user = useAuthStore((state) => state.user);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    if (!isOpen || !employeeData) return null;

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

    const handleExport = async () => {
        setIsGenerating(true);
        try {
            const [{ pdf }, { EmployeeOnboardingDocument }] = await Promise.all([
                import('@react-pdf/renderer'),
                import('../../pages/attendance/PDFReports')
            ]);
            const doc = <EmployeeOnboardingDocument data={employeeData} logoUrl={logo} />;
            const blob = await pdf(doc).toBlob();
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Onboarding_Forms_${d.personal.employeeId || 'employee'}.pdf`;
                link.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error("PDF generation failed:", error);
            window.print();
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirm = async () => {
        setIsConfirming(true);
        try {
            await onConfirm();
        } finally {
            setIsConfirming(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex flex-col bg-slate-900/80 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
            {/* Top Modal Navigation Bar */}
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-sm">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 flex-shrink-0">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-slate-900 leading-tight">Official Onboarding Dossier</h3>
                        <p className="text-xs text-slate-500">Ref: ONB-{d.personal.employeeId || 'DRAFT'} • Verify all candidate details</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button 
                        type="button" 
                        onClick={() => window.print()} 
                        variant="outline" 
                        size="sm"
                        className="hidden md:flex"
                    >
                        <Printer className="h-4 w-4 mr-1.5" /> Print
                    </Button>
                    <Button 
                        type="button" 
                        onClick={handleExport} 
                        variant="outline" 
                        disabled={isGenerating}
                        size="sm"
                        className="flex-1 sm:flex-none"
                    >
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600" /> : <Download className="mr-2 h-4 w-4" />}
                        {isGenerating ? 'Generating...' : 'Download PDF'}
                    </Button>
                    <Button 
                        type="button" 
                        onClick={handleConfirm}
                        disabled={isConfirming}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1 sm:flex-none shadow-md"
                        size="sm"
                    >
                        {isConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Confirm & Continue
                    </Button>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-1"
                        aria-label="Close modal"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </header>

            {/* Scrollable Booklet Content */}
            <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 bg-slate-100">
                <div className="max-w-4xl mx-auto space-y-6">
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

                        {/* Top Profile Card: Photo + Core Details */}
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

                        {/* Section 1: Personal Particulars */}
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

                        {/* Section 2: Residential Addresses */}
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

                        {/* Section 3: Statutory Compliance */}
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

                        {/* Section 4: Bank Mandate */}
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

                        {/* Section 5: Education & Family */}
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

                        {/* Section 6: Uniform Allotment (if any) */}
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
            </main>
        </div>,
        document.body
    );
};

export default OnboardingBookletModal;
