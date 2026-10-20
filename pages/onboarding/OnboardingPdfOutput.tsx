import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import type { OnboardingData } from '../../types';
import { api } from '../../services/api';
import { Download, Loader2, ArrowLeft, Printer, CheckCircle2, Building, User, Phone, MapPin, CreditCard, ShieldCheck, FileCheck, Calendar, Briefcase, GraduationCap, Users, Shirt, HeartPulse, ZoomIn, X, ExternalLink } from 'lucide-react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useLogoStore } from '../../store/logoStore';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { getProxyUrl } from '../../utils/fileUrl';

import { generatePifsCompliancePdf, savePifsCompliancePdfToServer, isSouthWallEmployee } from '../../services/pifsCompliancePdfService';
import { downloadOnboardingAckSlipPdf } from '../../services/pifsAckSlipPdfService';
import { formatDisplayDate } from '../../utils/date';
import { triggerPrint } from '../../utils/printHelper';
import MobileTopBar from '../../components/navigation/MobileTopBar';
import { supabase } from '../../services/supabase';

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
    const [fieldOfficerState, setFieldOfficerState] = useState<{ name: string; role: string }>({
        name: '',
        role: 'Field Officer'
    });
    const [zoomedDoc, setZoomedDoc] = useState<{
        title: string;
        url: string;
        details?: { label: string; value: string }[];
    } | null>(null);

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

    useEffect(() => {
        if (!employeeData) return;
        const explicitName = employeeData.createdByName || (employeeData as any).created_by_name || employeeData.createdBy || (employeeData as any).created_by || (employeeData as any).submitted_by;
        const explicitRole = employeeData.createdByRole || (employeeData as any).created_by_role;
        if (explicitName && typeof explicitName === 'string' && explicitName.trim()) {
            setFieldOfficerState({
                name: explicitName,
                role: explicitRole ? explicitRole.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Field Officer'
            });
            return;
        }

        const creatorId = employeeData.createdUserId || (employeeData as any).created_user_id || (employeeData as any).userId || (employeeData as any).user_id;
        if (creatorId) {
            const resolveCreator = async () => {
                try {
                    const { data: u } = await supabase.from('users').select('name, role_id').eq('id', creatorId).single();
                    if (u?.name) {
                        setFieldOfficerState({
                            name: u.name,
                            role: u.role_id === 'field_officer' ? 'Field Officer' : (u.role_id ? u.role_id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Field Officer')
                        });
                    }
                } catch {
                    /* non-blocking */
                }
            };
            resolveCreator();
        }
    }, [employeeData]);

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
            const isSW = isSouthWallEmployee(employeeData);
            let empId = (employeeData.personal?.employeeId || employeeData.id || 'employee').replace(/-/g, ' ');
            if (isSW) {
                empId = empId.replace(/^PARA\s+/i, 'SW ').replace(/^PARA-/i, 'SW-');
                if (!/^SW/i.test(empId)) empId = `SW ${empId}`;
            }
            const docPrefix = isSW ? 'SouthWall Data Sheet' : 'PIFS Data Sheet';
            link.download = `${docPrefix} ${empId}.pdf`;
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
      <MobileTopBar title="ENROLLMENT PDF" parentPath="/verification/dashboard" />
                <p className="text-rose-500 font-bold mb-4">Could not find employee onboarding records.</p>
                <Button onClick={() => navigate('/onboarding/add/review')}>Return to Review</Button>
            </div>
        );
    }

    const d = employeeData;
    const fullName = `${d.personal.firstName} ${d.personal.middleName || ''} ${d.personal.lastName}`.replace(/\s+/g, ' ').trim();
    
    // Field Officer (Who filled details)
    const fieldOfficerName = fieldOfficerState.name || d.createdByName || (d as any).created_by_name || (d as any).createdBy || (user?.role === 'field_officer' ? user.name : '') || 'Authorized Field Officer';
    const fieldOfficerRole = fieldOfficerState.role || (d as any).createdByRole || 'Field Officer';

    // Approved HR (Who approved/verified)
    const isVerified = Boolean(d.verifiedBy || (d as any).verified_by || d.status === 'verified');
    const hrApproverName = d.verifiedBy || (d as any).verified_by || (user?.role?.includes('admin') || user?.role?.includes('manager') ? user.name : 'HR Operations Desk');
    const hrApproverRole = d.verifiedBy ? 'Admin / HR Attestation' : (isVerified ? 'HR Operations Desk' : 'Pending HR Verification');
    const verifiedDateStr = (d.verifiedAt || (d as any).verified_at) ? formatDisplayDate(d.verifiedAt || (d as any).verified_at) : '';
    const fatherName = d.family?.find(f => f.relation === 'Father')?.name || '—';
    const spouseName = d.family?.find(f => f.relation === 'Spouse')?.name || '—';
    const motherName = d.family?.find(f => f.relation === 'Mother')?.name || '—';
    const presentAddressStr = d.address?.present ? `${d.address.present.line1 || ''}, ${d.address.present.city || ''}, ${d.address.present.state || ''} - ${d.address.present.pincode || ''}`.replace(/^[\s,]+|[\s,]+$/g, '') : '—';
    const permanentAddressStr = d.address?.sameAsPresent 
        ? presentAddressStr 
        : (d.address?.permanent ? `${d.address.permanent.line1 || ''}, ${d.address.permanent.city || ''}, ${d.address.permanent.state || ''} - ${d.address.permanent.pincode || ''}`.replace(/^[\s,]+|[\s,]+$/g, '') : '—');
    const emergencyContactStr = d.personal.emergencyContactNumber || d.personal.alternateMobile || d.personal.mobile || '—';
    const validEducation = d.education?.filter(edu => edu && (edu.degree?.trim() || edu.institution?.trim() || edu.endYear?.trim())) || [];
    const validFamily = d.family?.filter(fam => fam && (fam.name?.trim() || fam.relation?.trim())) || [];
    const validUniforms = d.uniforms?.filter(u => u && (u.itemName || u.quantity)) || [];
    const hasEducationOrFamily = validEducation.length > 0 || validFamily.length > 0;
    const photoUrl = d.personal.photo?.preview || (d.personal.photo as any)?.url || '';
    const signatureUrl = d.biometrics?.signatureImage?.preview || (d.biometrics?.signatureImage as any)?.url || '';
    const aadhaarFrontUrl = d.personal.idProofFront?.preview || (d.personal.idProofFront as any)?.url || '';
    const aadhaarBackUrl = d.personal.idProofBack?.preview || (d.personal.idProofBack as any)?.url || '';
    const panCardUrl = d.personal.panCard?.preview || (d.personal.panCard as any)?.url || '';
    const bankProofUrl = d.bank.bankProof?.preview || (d.bank.bankProof as any)?.url || '';

    const isSouthWall = isSouthWallEmployee(employeeData);
    let displayEmpId = d.personal.employeeId || '';
    if (isSouthWall) {
        displayEmpId = displayEmpId.replace(/^PARA\s+/i, 'SW-').replace(/^PARA-/i, 'SW-');
        if (!/^SW/i.test(displayEmpId)) displayEmpId = `SW-${displayEmpId}`;
    }

    return (
        <div className="w-full bg-page min-h-full py-4 px-3 sm:px-6 print:p-0 print:m-0 print:bg-white">
            {/* ── Top Header Toolbar: Full-width stretched across the screen in one single line ── */}
            <div className="w-full bg-white px-4 sm:px-6 py-3.5 rounded-2xl shadow-sm border border-slate-200 mb-6 print:hidden flex items-center justify-between gap-3 overflow-x-auto">
                {/* Left: Back button */}
                <Button 
                    type="button" 
                    onClick={() => navigate(-1)} 
                    variant="secondary"
                    size="sm"
                    className="flex-shrink-0 whitespace-nowrap"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>

                {/* Center: Title & Ref */}
                <div className="flex-shrink-0 text-center px-2">
                    <div className="flex items-center justify-center gap-2">
                        <ShieldCheck className={`h-5 w-5 ${isSouthWall ? 'text-sky-700' : 'text-emerald-600'}`} />
                        <h2 className="font-bold text-sm sm:text-base text-slate-800 whitespace-nowrap">
                            {isSouthWall ? 'SouthWall Onboarding Dossier' : 'Official Onboarding Dossier'}
                        </h2>
                    </div>
                    <p className="text-[11px] text-slate-500 whitespace-nowrap">Ref: ONB-{displayEmpId || d.personal.employeeId} • Review before final submission</p>
                </div>

                {/* Right: Actions on a single horizontal row */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-nowrap justify-end">
                    <Button 
                        type="button" 
                        onClick={() => triggerPrint('onboarding-dossier-booklet', `${isSouthWall ? 'SouthWall' : 'Onboarding'}_Dossier_${displayEmpId || d.personal.employeeId || 'Staff'}`)} 
                        variant="outline" 
                        size="sm"
                        title="Print Booklet"
                        className="whitespace-nowrap"
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
                        className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-semibold whitespace-nowrap"
                    >
                        {isGeneratingAck ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-emerald-600" /> : <FileCheck className="mr-1.5 h-4 w-4 text-emerald-600" />}
                        {isGeneratingAck ? 'Generating...' : 'Download Ack Slip'}
                    </Button>
                    <Button 
                        type="button" 
                        onClick={handleExport} 
                        variant="outline" 
                        disabled={isGenerating}
                        size="sm"
                        title="Download 21-Page Official Statutory Compliance Data Sheet"
                        className="whitespace-nowrap"
                    >
                        {isGenerating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-emerald-600" /> : <Download className="mr-1.5 h-4 w-4" />}
                        {isGenerating ? 'Generating...' : (isSouthWall ? 'Download SouthWall Data Sheet' : 'Download PIFS Data Sheet')}
                    </Button>
                    <Button 
                        type="button" 
                        onClick={handleConfirm}
                        disabled={isConfirming}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md whitespace-nowrap"
                    >
                        {isConfirming ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                        Confirm & Continue
                    </Button>
                </div>
            </div>

            {/* ── Official Employee Onboarding Booklet ── */}
            <div className="max-w-4xl mx-auto">
                <div id="onboarding-dossier-booklet" className="space-y-6">
                    {/* PAGE 1: Personal Dossier & Identity Record */}
                    <div className="bg-white rounded-2xl border border-slate-300 shadow-xl p-6 sm:p-10 text-slate-800 text-xs sm:text-sm min-h-[1123px] flex flex-col justify-between print:min-h-0 print:h-[277mm] print:shadow-none print:border-none print:p-6 print:rounded-none">
                        <div>
                        {/* Company Header */}
                        <div className={`border-b-2 ${isSouthWall ? 'border-sky-800' : 'border-emerald-700'} pb-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4`}>
                            <div className="flex items-center gap-3">
                                {isSouthWall ? (
                                    <img src="/South-Wall-Logo.png" alt="SouthWall Security LLP" className="h-10 object-contain" onError={(e) => { (e.target as any).src = logo || ''; }} />
                                ) : logo ? (
                                    <img src={logo} alt="Paradigm" className="h-10 object-contain" />
                                ) : (
                                    <div className="h-10 w-10 bg-emerald-700 text-white font-black rounded-lg flex items-center justify-center text-xl">P</div>
                                )}
                                <div>
                                    <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                                        {isSouthWall ? 'SOUTHWALL SECURITY LLP' : 'PARADIGM INTEGRATED SERVICES'}
                                    </h1>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                                        {isSouthWall ? 'Security Guard Onboarding Dossier & Service Book' : 'Employee Onboarding Dossier & Service Book'}
                                    </p>
                                    {isSouthWall && (
                                        <p className="text-[10px] text-slate-500 font-medium">
                                            198, 2nd Floor, CMH Road, Indiranagar, Bangalore - 560 038.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`inline-block ${isSouthWall ? 'bg-sky-50 border-sky-300 text-sky-900' : 'bg-emerald-50 border-emerald-200 text-emerald-800'} font-mono font-bold text-xs px-3 py-1 rounded-md`}>
                                    ID: {displayEmpId || d.personal.employeeId}
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
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left w-full">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Employee Full Name</p>
                                    <p className="font-extrabold text-slate-900 text-base">{fullName || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Designation</p>
                                    <p className="font-bold text-emerald-700">{d.organization.designation || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Date of Joining</p>
                                    <p className="font-bold text-slate-900">
                                        {formatDisplayDate(d.organization?.joiningDate || (d as any)?.joining_date || (d as any)?.joiningDate || d.enrollmentDate)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Allocated Site / Client</p>
                                    <p className="font-semibold text-slate-800">{d.organization.organizationName || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Department</p>
                                    <p className="font-semibold text-slate-800">{d.organization.department || 'Operations'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Work Type</p>
                                    <p className="font-semibold text-slate-800">{d.organization?.workType || 'Full-time'}</p>
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
                                <div><span className="text-slate-400 text-xs block">Date of Birth:</span> <span className="font-semibold">{formatDisplayDate(d.personal.dob)}</span></div>
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
                        </div>

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
                                {/* Right: Two-tier Attestation - Field Officer Above, Approved HR Below */}
                                <div className="flex flex-col items-center sm:items-end gap-5">
                                    {/* Above: Field Officer Who Filled Details */}
                                    <div className="text-center">
                                        <div className="h-14 w-52 border-b-2 border-slate-400 flex flex-col items-center justify-center mb-1 bg-emerald-50/50 rounded-t px-2">
                                            <span className="text-sm font-serif font-bold text-emerald-800 italic">{fieldOfficerName}</span>
                                            <span className="text-[9px] text-emerald-700 font-semibold uppercase tracking-wider font-mono">Enrolled & Attested</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800">Field Officer (Form Enroller)</p>
                                        <p className="text-[10px] text-emerald-700 font-semibold">{fieldOfficerName} ({fieldOfficerRole})</p>
                                    </div>

                                    {/* Below: Approved HR Details */}
                                    <div className="text-center">
                                        <div className="h-14 w-52 border-b-2 border-slate-400 flex flex-col items-center justify-center mb-1 bg-sky-50/50 rounded-t px-2">
                                            <span className="text-sm font-serif font-bold text-sky-800 italic">{hrApproverName}</span>
                                            <span className="text-[9px] text-sky-700 font-semibold uppercase tracking-wider font-mono">
                                                {isVerified ? 'Verified & Approved' : 'Pending HR Verification'}
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800">Approved HR Attestation</p>
                                        <p className="text-[10px] text-sky-700 font-semibold">{hrApproverName} ({hrApproverRole})</p>
                                        {verifiedDateStr && <p className="text-[9px] text-slate-400 mt-0.5">Approved on: {verifiedDateStr}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── PAGE 2: Attached Statutory Documents & Identity Proofs ── */}
                    <div className="bg-white rounded-2xl border border-slate-300 shadow-xl p-6 sm:p-10 text-slate-800 text-xs sm:text-sm min-h-[1123px] flex flex-col justify-between print:break-before-page print:min-h-0 print:h-[277mm] print:shadow-none print:border-none print:p-6 print:rounded-none">
                        <div>
                        {/* Company Header */}
                        <div className={`border-b-2 ${isSouthWall ? 'border-sky-800' : 'border-emerald-700'} pb-4 mb-5 flex flex-col sm:flex-row items-center justify-between gap-4`}>
                            <div className="flex items-center gap-3">
                                {isSouthWall ? (
                                    <img src="/South-Wall-Logo.png" alt="SouthWall Security LLP" className="h-10 object-contain" onError={(e) => { (e.target as any).src = logo || ''; }} />
                                ) : logo ? (
                                    <img src={logo} alt="Paradigm" className="h-10 object-contain" />
                                ) : (
                                    <div className="h-10 w-10 bg-emerald-700 text-white font-black rounded-lg flex items-center justify-center text-xl">P</div>
                                )}
                                <div>
                                    <h2 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                                        {isSouthWall ? 'SOUTHWALL SECURITY LLP' : 'PARADIGM INTEGRATED SERVICES'}
                                    </h2>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                                        Attached Verification Documents & Statutory Proofs (Page 2)
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                        Employee: <span className="font-bold text-slate-800">{fullName}</span> • ID: <span className="font-mono font-bold text-slate-800">{displayEmpId || d.personal.employeeId}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`inline-block ${isSouthWall ? 'bg-sky-50 border-sky-300 text-sky-900' : 'bg-emerald-50 border-emerald-200 text-emerald-800'} font-mono font-bold text-xs px-3 py-1 rounded-md`}>
                                    PAGE 2 OF 2
                                </span>
                                <p className="text-[10px] text-slate-400 mt-1">Official Attachment Docket</p>
                            </div>
                        </div>

                        {/* Section Header */}
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-md mb-4 flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5" /> Attached Statutory Identity & Bank Proofs
                        </h3>

                        {/* Grid of 4 Documents: Aadhaar Front, Aadhaar Back, PAN Card, Bank Proof */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
                            {/* Document 1: Aadhaar Front */}
                            <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50 flex flex-col shadow-sm">
                                <div className="bg-slate-100 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                                    <div>
                                        <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                            <FileCheck className="h-3.5 w-3.5 text-emerald-600" /> Aadhaar Card (Front Side)
                                        </span>
                                        <span className="text-[10px] text-slate-500 block font-medium mt-0.5">
                                            Primary Photo & Identity Proof
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {aadhaarFrontUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setZoomedDoc({
                                                    title: 'Aadhaar Card (Front Side)',
                                                    url: getProxyUrl(aadhaarFrontUrl),
                                                    details: [
                                                        { label: 'Full Name', value: fullName },
                                                        { label: 'Aadhaar Number', value: d.personal.aadhaarNumber || d.personal.idProofNumber || '—' },
                                                        { label: 'Date of Birth', value: formatDisplayDate(d.personal.dob) || d.personal.dob || '—' },
                                                        { label: 'Gender', value: d.personal.gender || '—' },
                                                    ]
                                                })}
                                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors"
                                                title="View Full Size Image"
                                            >
                                                <ZoomIn className="h-3 w-3" /> Enlarge
                                            </button>
                                        )}
                                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${aadhaarFrontUrl ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-600'}`}>
                                            {aadhaarFrontUrl ? 'Attached' : 'Not Uploaded'}
                                        </span>
                                    </div>
                                </div>
                                <div 
                                    className={`p-3 flex items-center justify-center min-h-[220px] max-h-[260px] bg-slate-200/50 overflow-hidden relative ${aadhaarFrontUrl ? 'cursor-pointer group' : ''}`}
                                    onClick={() => aadhaarFrontUrl && setZoomedDoc({
                                        title: 'Aadhaar Card (Front Side)',
                                        url: getProxyUrl(aadhaarFrontUrl),
                                        details: [
                                            { label: 'Full Name', value: fullName },
                                            { label: 'Aadhaar Number', value: d.personal.aadhaarNumber || d.personal.idProofNumber || '—' },
                                            { label: 'Date of Birth', value: formatDisplayDate(d.personal.dob) || d.personal.dob || '—' },
                                            { label: 'Gender', value: d.personal.gender || '—' },
                                        ]
                                    })}
                                >
                                    {aadhaarFrontUrl ? (
                                        <>
                                            <img 
                                                src={getProxyUrl(aadhaarFrontUrl)} 
                                                alt="Aadhaar Front" 
                                                className="max-h-[240px] w-auto max-w-full object-contain rounded-lg border border-slate-300 shadow bg-white transition-transform group-hover:scale-[1.02]"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs rounded-lg">
                                                <ZoomIn className="h-4 w-4" /> Click to View High Resolution
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-6 text-slate-400">
                                            <FileCheck className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-500" />
                                            <span className="text-xs font-semibold">No Front Image Uploaded</span>
                                        </div>
                                    )}
                                </div>
                                {/* Verified Aadhaar Particulars Strip */}
                                <div className="bg-emerald-50/80 border-t border-emerald-200 p-2.5 sm:p-3 text-[11px] text-slate-800">
                                    <div className="grid grid-cols-2 gap-2 text-left">
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Name on Card</span>
                                            <span className="font-bold text-slate-900 truncate block">{fullName}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Aadhaar Number</span>
                                            <span className="font-mono font-extrabold text-emerald-900 text-xs tracking-wider block">{d.personal.aadhaarNumber || d.personal.idProofNumber || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">DOB / Age</span>
                                            <span className="font-bold text-slate-800 block">{formatDisplayDate(d.personal.dob) || d.personal.dob || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Gender</span>
                                            <span className="font-bold text-slate-800 block">{d.personal.gender || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Document 2: Aadhaar Back */}
                            <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50 flex flex-col shadow-sm">
                                <div className="bg-slate-100 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                                    <div>
                                        <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                            <FileCheck className="h-3.5 w-3.5 text-emerald-600" /> Aadhaar Card (Back Side)
                                        </span>
                                        <span className="text-[10px] text-slate-500 block font-medium mt-0.5">
                                            Address Verification Proof
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {aadhaarBackUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setZoomedDoc({
                                                    title: 'Aadhaar Card (Back Side / Address Proof)',
                                                    url: getProxyUrl(aadhaarBackUrl),
                                                    details: [
                                                        { label: 'Present Address', value: presentAddressStr },
                                                        { label: 'Permanent Address', value: permanentAddressStr },
                                                        { label: 'Father / Guardian', value: fatherName },
                                                        { label: 'Emergency Contact', value: emergencyContactStr },
                                                    ]
                                                })}
                                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors"
                                                title="View Full Size Image"
                                            >
                                                <ZoomIn className="h-3 w-3" /> Enlarge
                                            </button>
                                        )}
                                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${aadhaarBackUrl ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-600'}`}>
                                            {aadhaarBackUrl ? 'Attached' : 'Not Uploaded'}
                                        </span>
                                    </div>
                                </div>
                                <div 
                                    className={`p-3 flex items-center justify-center min-h-[220px] max-h-[260px] bg-slate-200/50 overflow-hidden relative ${aadhaarBackUrl ? 'cursor-pointer group' : ''}`}
                                    onClick={() => aadhaarBackUrl && setZoomedDoc({
                                        title: 'Aadhaar Card (Back Side / Address Proof)',
                                        url: getProxyUrl(aadhaarBackUrl),
                                        details: [
                                            { label: 'Present Address', value: presentAddressStr },
                                            { label: 'Permanent Address', value: permanentAddressStr },
                                            { label: 'Father / Guardian', value: fatherName },
                                            { label: 'Emergency Contact', value: emergencyContactStr },
                                        ]
                                    })}
                                >
                                    {aadhaarBackUrl ? (
                                        <>
                                            <img 
                                                src={getProxyUrl(aadhaarBackUrl)} 
                                                alt="Aadhaar Back" 
                                                className="max-h-[240px] w-auto max-w-full object-contain rounded-lg border border-slate-300 shadow bg-white transition-transform group-hover:scale-[1.02]"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs rounded-lg">
                                                <ZoomIn className="h-4 w-4" /> Click to View High Resolution
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-6 text-slate-400">
                                            <FileCheck className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-500" />
                                            <span className="text-xs font-semibold">No Back Image Uploaded</span>
                                        </div>
                                    )}
                                </div>
                                {/* Verified Address Strip */}
                                <div className="bg-emerald-50/80 border-t border-emerald-200 p-2.5 sm:p-3 text-[11px] text-slate-800">
                                    <div className="space-y-1.5 text-left">
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Verified Permanent / Home Address</span>
                                            <span className="font-medium text-slate-900 block leading-tight">{permanentAddressStr}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] text-slate-600 pt-1 border-t border-emerald-200/60">
                                            <span>Father/Spouse: <strong className="text-slate-800">{fatherName !== '—' ? fatherName : (spouseName !== '—' ? spouseName : '—')}</strong></span>
                                            <span>Emergency: <strong className="font-mono text-slate-800">{emergencyContactStr}</strong></span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Document 3: PAN Card */}
                            <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50 flex flex-col shadow-sm">
                                <div className="bg-slate-100 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                                    <div>
                                        <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                            <CreditCard className="h-3.5 w-3.5 text-sky-600" /> PAN Card
                                        </span>
                                        <span className="text-[10px] text-slate-500 block font-medium mt-0.5">
                                            Income Tax & Statutory Identification
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {panCardUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setZoomedDoc({
                                                    title: 'Income Tax PAN Card',
                                                    url: getProxyUrl(panCardUrl),
                                                    details: [
                                                        { label: 'PAN Number', value: d.personal.panNumber || '—' },
                                                        { label: 'Cardholder Name', value: fullName },
                                                        { label: 'Father\'s Name', value: fatherName },
                                                        { label: 'Date of Birth', value: formatDisplayDate(d.personal.dob) || d.personal.dob || '—' },
                                                    ]
                                                })}
                                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-sky-700 hover:bg-sky-800 text-white shadow-xs transition-colors"
                                                title="View Full Size Image"
                                            >
                                                <ZoomIn className="h-3 w-3" /> Enlarge
                                            </button>
                                        )}
                                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${panCardUrl ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'bg-slate-200 text-slate-600'}`}>
                                            {panCardUrl ? 'Attached' : 'Not Uploaded'}
                                        </span>
                                    </div>
                                </div>
                                <div 
                                    className={`p-3 flex items-center justify-center min-h-[220px] max-h-[260px] bg-slate-200/50 overflow-hidden relative ${panCardUrl ? 'cursor-pointer group' : ''}`}
                                    onClick={() => panCardUrl && setZoomedDoc({
                                        title: 'Income Tax PAN Card',
                                        url: getProxyUrl(panCardUrl),
                                        details: [
                                            { label: 'PAN Number', value: d.personal.panNumber || '—' },
                                            { label: 'Cardholder Name', value: fullName },
                                            { label: 'Father\'s Name', value: fatherName },
                                            { label: 'Date of Birth', value: formatDisplayDate(d.personal.dob) || d.personal.dob || '—' },
                                        ]
                                    })}
                                >
                                    {panCardUrl ? (
                                        <>
                                            <img 
                                                src={getProxyUrl(panCardUrl)} 
                                                alt="PAN Card" 
                                                className="max-h-[240px] w-auto max-w-full object-contain rounded-lg border border-slate-300 shadow bg-white transition-transform group-hover:scale-[1.02]"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs rounded-lg">
                                                <ZoomIn className="h-4 w-4" /> Click to View High Resolution
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-4 text-slate-400">
                                            <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-500" />
                                            <span className="text-xs font-semibold">No PAN Card Uploaded</span>
                                        </div>
                                    )}
                                </div>
                                {/* Verified PAN Particulars Strip */}
                                <div className="bg-sky-50/80 border-t border-sky-200 p-2.5 sm:p-3 text-[11px] text-slate-800">
                                    <div className="grid grid-cols-2 gap-2 text-left">
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Permanent Account No (PAN)</span>
                                            <span className="font-mono font-extrabold text-sky-900 text-xs tracking-wider block">{d.personal.panNumber || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Name on PAN</span>
                                            <span className="font-bold text-slate-900 truncate block">{fullName}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Father's Name</span>
                                            <span className="font-bold text-slate-800 truncate block">{fatherName}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">DOB</span>
                                            <span className="font-bold text-slate-800 block">{formatDisplayDate(d.personal.dob) || d.personal.dob || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Document 4: Bank Mandate Proof */}
                            <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50 flex flex-col shadow-sm">
                                <div className="bg-slate-100 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                                    <div>
                                        <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                            <Building className="h-3.5 w-3.5 text-emerald-600" /> Bank Proof (Passbook / Cheque)
                                        </span>
                                        <span className="text-[10px] text-slate-500 block font-medium mt-0.5">
                                            Salary Disbursal & Mandate Verification
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {bankProofUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setZoomedDoc({
                                                    title: 'Bank Mandate Proof (Passbook / Cheque)',
                                                    url: getProxyUrl(bankProofUrl),
                                                    details: [
                                                        { label: 'Bank Name', value: d.bank.bankName || 'State Bank of India' },
                                                        { label: 'Account Holder', value: d.bank.accountHolderName || fullName },
                                                        { label: 'Account Number', value: d.bank.accountNumber || '—' },
                                                        { label: 'IFSC Code', value: d.bank.ifscCode || '—' },
                                                        { label: 'Branch Name', value: d.bank.branchName || 'Main Branch' },
                                                    ]
                                                })}
                                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors"
                                                title="View Full Size Image"
                                            >
                                                <ZoomIn className="h-3 w-3" /> Enlarge
                                            </button>
                                        )}
                                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${bankProofUrl ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-600'}`}>
                                            {bankProofUrl ? 'Attached' : 'Not Uploaded'}
                                        </span>
                                    </div>
                                </div>
                                <div 
                                    className={`p-3 flex items-center justify-center min-h-[220px] max-h-[260px] bg-slate-200/50 overflow-hidden relative ${bankProofUrl ? 'cursor-pointer group' : ''}`}
                                    onClick={() => bankProofUrl && setZoomedDoc({
                                        title: 'Bank Mandate Proof (Passbook / Cheque)',
                                        url: getProxyUrl(bankProofUrl),
                                        details: [
                                            { label: 'Bank Name', value: d.bank.bankName || 'State Bank of India' },
                                            { label: 'Account Holder', value: d.bank.accountHolderName || fullName },
                                            { label: 'Account Number', value: d.bank.accountNumber || '—' },
                                            { label: 'IFSC Code', value: d.bank.ifscCode || '—' },
                                            { label: 'Branch Name', value: d.bank.branchName || 'Main Branch' },
                                        ]
                                    })}
                                >
                                    {bankProofUrl ? (
                                        <>
                                            <img 
                                                src={getProxyUrl(bankProofUrl)} 
                                                alt="Bank Proof" 
                                                className="max-h-[240px] w-auto max-w-full object-contain rounded-lg border border-slate-300 shadow bg-white transition-transform group-hover:scale-[1.02]"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs rounded-lg">
                                                <ZoomIn className="h-4 w-4" /> Click to View High Resolution
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-4 text-slate-400">
                                            <Building className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-500" />
                                            <span className="text-xs font-semibold">No Bank Proof Uploaded</span>
                                        </div>
                                    )}
                                </div>
                                {/* Verified Bank Particulars Banner: High-contrast legible text */}
                                <div className="bg-emerald-50/80 border-t border-emerald-200 p-2.5 sm:p-3 text-[11px] text-slate-800">
                                    <div className="grid grid-cols-2 gap-2 text-left">
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Bank Name</span>
                                            <span className="font-bold text-slate-900 truncate block">{d.bank.bankName || 'State Bank of India'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Account Holder</span>
                                            <span className="font-bold text-slate-900 truncate block">{d.bank.accountHolderName || fullName}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Account Number</span>
                                            <span className="font-mono font-extrabold text-emerald-900 text-xs tracking-wider block">{d.bank.accountNumber || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">IFSC Code</span>
                                            <span className="font-mono font-extrabold text-sky-900 text-xs uppercase tracking-wider block">{d.bank.ifscCode || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>

                        {/* Document Verification & Field Officer Attestation Footer */}
                        <div className="pt-4 border-t-2 border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                            <div>
                                <p className="text-[11px] font-semibold text-slate-700">Official Verification Dossier • Statutory Document Attachments</p>
                                <p className="text-[10px] text-slate-500">All attached identity and banking proofs verified against original documents for statutory compliance.</p>
                                <p className="font-mono text-[9px] text-slate-400 mt-0.5">Record ID: ONB-DOCS-{displayEmpId || d.personal.employeeId} • Page 2 of 2</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 rounded-lg text-center">
                                    <span className="text-[8px] uppercase tracking-wider font-bold text-emerald-800 block">Enrolled & Attested</span>
                                    <span className="text-xs font-serif font-bold text-emerald-900">{fieldOfficerName}</span>
                                </div>
                                <div className="border border-sky-200 bg-sky-50/70 px-3 py-1.5 rounded-lg text-center">
                                    <span className="text-[8px] uppercase tracking-wider font-bold text-sky-800 block">{isVerified ? 'HR Approved' : 'Pending Verification'}</span>
                                    <span className="text-xs font-serif font-bold text-sky-900">{hrApproverName}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Full-Width Stretched Bottom Footer Toolbar ── */}
            <div className="w-full bg-white px-4 sm:px-6 py-3.5 rounded-2xl shadow-sm border border-slate-200 mt-6 mb-3 print:hidden flex flex-col sm:flex-row items-center justify-between gap-3 overflow-x-auto">
                {/* Left: Return / Back button */}
                <Button 
                    type="button" 
                    onClick={() => navigate(-1)} 
                    variant="secondary" 
                    size="sm"
                    className="flex-shrink-0 whitespace-nowrap w-full sm:w-auto"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Return to Review
                </Button>

                {/* Right: Actions in a single horizontal row */}
                <div className="flex items-center gap-2.5 flex-shrink-0 flex-nowrap justify-end w-full sm:w-auto">
                    <Button 
                        type="button" 
                        onClick={handleExportAckSlip} 
                        variant="outline" 
                        disabled={isGeneratingAck}
                        size="sm"
                        title="Download Onboarding Acknowledgement Slip PDF"
                        className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-semibold whitespace-nowrap flex-shrink-0"
                    >
                        {isGeneratingAck ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-emerald-600" /> : <FileCheck className="mr-1.5 h-4 w-4 text-emerald-600" />}
                        Download Ack Slip
                    </Button>
                    <Button 
                        type="button" 
                        onClick={handleExport} 
                        variant="outline" 
                        disabled={isGenerating}
                        size="sm"
                        title="Download 21-Page Official Statutory Compliance Data Sheet"
                        className="whitespace-nowrap flex-shrink-0"
                    >
                        {isGenerating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-emerald-600" /> : <Download className="mr-1.5 h-4 w-4" />}
                        {isSouthWall ? 'Download SouthWall Data Sheet' : 'Download PIFS Data Sheet'}
                    </Button>
                    <Button 
                        type="button" 
                        onClick={handleConfirm}
                        disabled={isConfirming}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md whitespace-nowrap flex-shrink-0"
                    >
                        {isConfirming ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                        Confirm & Proceed to e-Signature
                    </Button>
                </div>
            </div>

            {/* Clean compact bottom cushion */}
            <div className="h-6 w-full print:hidden" aria-hidden="true" />

            {/* ── Document Full-Resolution Lightbox Zoom Modal ── */}
            {zoomedDoc && (
                <div 
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-3 sm:p-6 animate-fade-in"
                    onClick={() => setZoomedDoc(null)}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                    {zoomedDoc.title}
                                </h3>
                                <p className="text-[11px] text-slate-400">High-Resolution Official Attachment Docket • Review Verified Data</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={zoomedDoc.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                                    title="Open image in new tab"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setZoomedDoc(null)}
                                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                                    title="Close"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body: Crisp High-Resolution Image */}
                        <div className="flex-1 overflow-auto p-4 bg-slate-950/90 flex items-center justify-center min-h-[350px]">
                            <img 
                                src={zoomedDoc.url} 
                                alt={zoomedDoc.title}
                                className="max-h-[62vh] w-auto max-w-full object-contain rounded-lg shadow-xl border border-slate-800 bg-white"
                            />
                        </div>

                        {/* Modal Footer: High-contrast legible text details */}
                        {zoomedDoc.details && zoomedDoc.details.length > 0 && (
                            <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                {zoomedDoc.details.map((item, idx) => (
                                    <div key={idx}>
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block">{item.label}</span>
                                        <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm block">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OnboardingPdfOutput;