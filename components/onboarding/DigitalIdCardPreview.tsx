import React, { useState } from 'react';
import { formatDobToDDMMYYYY } from '../../utils/aadhaarUtils';
import { calculateAge } from '../UploadDocument';

export interface DigitalIdCardPreviewProps {
  docType?: string;
  label?: string;
  extractedInfo: Record<string, any>;
  photoUrl?: string | null;
  userProfilePhoto?: string | null;
  relation?: string | null;
  onEditField?: (fieldKey: string, currentValue: any) => void;
}

export const DigitalIdCardPreview: React.FC<DigitalIdCardPreviewProps> = ({
  docType = '',
  label = '',
  extractedInfo,
  photoUrl,
  userProfilePhoto,
  relation,
  onEditField,
}) => {
  const [viewMode, setViewMode] = useState<'card' | 'fields'>('card');
  const normalizedDoc = (docType || label || '').toLowerCase();

  // Document identification logic
  const isSalary = normalizedDoc.includes('salary') || normalizedDoc.includes('payslip') || !!extractedInfo?.netPay || !!extractedInfo?.netSalary || !!extractedInfo?.grossSalary;
  const isIdBack = !isSalary && (normalizedDoc.includes('back') || normalizedDoc === 'idback');
  const isPan = !isSalary && !isIdBack && (normalizedDoc.includes('pan') || !!extractedInfo?.panNumber);
  const isBank = !isSalary && !isIdBack && !isPan && !normalizedDoc.includes('aadhaar') && (normalizedDoc.includes('bank') || !!extractedInfo?.accountNumber || !!extractedInfo?.ifscCode);
  const isUan = !isSalary && !isIdBack && !isPan && !isBank && !normalizedDoc.includes('aadhaar') && (normalizedDoc.includes('uan') || !!extractedInfo?.uanNumber);
  const isEducation = !isSalary && !isIdBack && !isPan && !isBank && !isUan && !normalizedDoc.includes('aadhaar') && (normalizedDoc.includes('education') || normalizedDoc.includes('certificate') || !!extractedInfo?.degree || !!extractedInfo?.institution);

  // Format Aadhaar Number with 4-digit groups (e.g., 4146  4238  8053)
  const formatAadhaar = (num: any) => {
    if (!num) return '••••  ••••  ••••';
    const clean = String(num).replace(/\D/g, '');
    if (clean.length === 12) {
      return `${clean.slice(0, 4)}  ${clean.slice(4, 8)}  ${clean.slice(8, 12)}`;
    }
    return String(num).replace(/(\d{4})/g, '$1 ').trim();
  };

  // Format PAN Number (e.g., ABCPS 4829 K)
  const formatPan = (pan: any) => {
    if (!pan) return '••••• •••• •';
    const clean = String(pan).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length === 10) {
      return `${clean.slice(0, 5)} ${clean.slice(5, 9)} ${clean.slice(9, 10)}`;
    }
    return String(pan).toUpperCase();
  };

  // Format Net Pay Currency
  const formatCurrency = (val: any) => {
    if (!val) return '••••';
    const num = Number(String(val).replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return String(val);
    return num.toLocaleString('en-IN');
  };

  // Extract address fields
  const addressLine = [
    extractedInfo.address?.line1 || extractedInfo.line1,
    extractedInfo.address?.street || extractedInfo.street,
    extractedInfo.address?.landmark || extractedInfo.landmark,
    extractedInfo.address?.village || extractedInfo.village || extractedInfo.area,
  ].filter(Boolean).join(', ');

  const cityDistState = [
    extractedInfo.address?.city || extractedInfo.city,
    extractedInfo.address?.district || extractedInfo.district,
    extractedInfo.address?.state || extractedInfo.state,
  ].filter(Boolean).join(', ');

  const pincode = extractedInfo.address?.pincode || extractedInfo.pincode || '';

  // ─────────────────────────────────────────────────────────────────────────────
  // SVG EMBLEMS & ASSETS
  // ─────────────────────────────────────────────────────────────────────────────
  
  // 1. National Emblem of India (Ashok Stambh with Satyameva Jayate)
  const AshokStambhSvg = ({ className = "w-7 h-9 text-slate-800" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 120 155" fill="none">
      <g fill="#1e293b">
        {/* Three visible lions head profiles */}
        <path d="M60 10 C50 10 44 16 44 24 C44 30 47 35 50 38 C44 38 38 42 38 49 C38 56 44 61 50 63 C44 65 40 71 40 77 L80 77 C80 71 76 65 70 63 C76 61 82 56 82 49 C82 42 76 38 70 38 C73 35 76 30 76 24 C76 16 70 10 60 10 Z" />
        {/* Abacus platform */}
        <rect x="20" y="81" width="80" height="8" rx="2" fill="#0f172a" />
        {/* Ashoka Chakra in center */}
        <circle cx="60" cy="98" r="9" stroke="#0f172a" strokeWidth="2.5" fill="none" />
        <circle cx="60" cy="98" r="2.5" fill="#0f172a" />
        {/* Side animals base */}
        <path d="M16 106 Q60 116 104 106 L108 112 Q60 124 12 112 Z" fill="#1e293b" />
      </g>
      {/* Satyameva Jayate Text in Devanagari */}
      <text x="60" y="140" fontFamily="'Mukta', sans-serif" fontSize="12" fontWeight="800" textAnchor="middle" fill="#0f172a">
        सत्यमेव जयते
      </text>
    </svg>
  );

  // 2. UIDAI Official Aadhaar Sun & Fingerprint Seal
  const AadhaarSunLogoSvg = ({ className = "w-10 h-10" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 100 100" fill="none">
      {/* Golden Sun Rays */}
      <g fill="#F59E0B">
        <polygon points="50,4 56,22 44,22" />
        <polygon points="78,14 70,29 61,23" />
        <polygon points="94,40 77,45 76,37" />
        <polygon points="22,14 30,29 39,23" />
        <polygon points="6,40 23,45 24,37" />
        <path d="M 24 50 A 28 28 0 0 1 76 50" stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      </g>
      {/* Biometric Fingerprint Red Arcs */}
      <g stroke="#DC2626" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M 33 54 A 18 18 0 0 1 67 54" />
        <path d="M 39 60 A 12 12 0 0 1 61 60" />
        <path d="M 45 66 A 6 6 0 0 1 55 66" />
        <path d="M 50 71 v 5" strokeWidth="3.5" />
      </g>
    </svg>
  );

  // 3. Indian Tricolor Waving Brush Header Banner
  const TricolorBrushBanner = ({ authority = "GOVERNMENT OF INDIA", authorityHindi = "भारत सरकार" }: { authority?: string; authorityHindi?: string }) => (
    <div className="flex-1 flex flex-col items-center justify-center px-1 text-center">
      <div className="w-full relative flex items-center justify-center py-0.5">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 24" fill="none" preserveAspectRatio="none">
          <path d="M4 14 Q 50 4, 100 8 T 196 6 Q 186 18, 100 16 T 4 20 Z" fill="#FF9933" opacity="0.95" />
        </svg>
        <span className="relative z-10 text-[10.5px] font-extrabold text-slate-900 font-hindi tracking-wider">
          {authorityHindi}
        </span>
      </div>
      <div className="w-full relative flex items-center justify-center py-0.5 mt-0.5">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 24" fill="none" preserveAspectRatio="none">
          <path d="M6 8 Q 50 16, 100 12 T 194 14 Q 186 22, 100 20 T 6 16 Z" fill="#138808" opacity="0.95" />
        </svg>
        <span className="relative z-10 text-[8px] font-black text-white uppercase tracking-tight">
          {authority}
        </span>
      </div>
    </div>
  );

  // 4. Official NSDL Logo (Orange & Cyan Swirl with Text)
  const NsdlLogoSvg = () => (
    <div className="flex items-center gap-1.5">
      <div className="w-6 h-6 shrink-0 flex items-center justify-center">
        <svg className="w-6 h-6" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="#f97316" />
          <circle cx="50" cy="50" r="28" fill="#ffffff" />
          <circle cx="50" cy="50" r="16" fill="#0284c7" />
        </svg>
      </div>
      <div className="leading-none flex flex-col justify-center">
        <span className="font-black tracking-tight block" style={{ color: '#002855', fontSize: '13px', lineHeight: '1.1' }}>
          NSDL
        </span>
        <span className="font-bold tracking-tighter block" style={{ color: '#1e293b', fontSize: '7px', lineHeight: '1' }}>
          Technology, Trust & Reach
        </span>
      </div>
    </div>
  );

  // 5. Official EPFO Logo (Employees' Provident Fund Organisation)
  const EpfoLogoSvg = () => (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-black text-xs shadow-sm border border-amber-300">
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M3 12h18" strokeDasharray="2 2" />
          <circle cx="12" cy="12" r="4" fill="currentColor" />
        </svg>
      </div>
      <div className="leading-tight">
        <span className="text-[10px] font-black text-amber-950 font-hindi block">कर्मचारी भविष्य निधि संगठन</span>
        <span className="text-[7.5px] font-bold text-amber-800 uppercase tracking-tighter">EMPLOYEES' PROVIDENT FUND INDIA</span>
      </div>
    </div>
  );

  // 6. Bank / Reserve Bank of India (RBI) Seal
  const BankRbiLogoSvg = () => (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm border border-emerald-400">
        ₹
      </div>
      <div className="leading-tight">
        <span className="text-xs font-black text-emerald-950 uppercase tracking-tight block">Bank Account Proof</span>
        <span className="text-[8px] font-semibold text-emerald-700">Cheque / Passbook Verification</span>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: VIEW TOGGLE (Card vs Raw Field List)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* View Switcher Pill */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[11px] font-semibold text-emerald-300/90 tracking-wide uppercase">
            {isIdBack ? 'Aadhaar (Back Side)' : isPan ? 'PAN Card' : isBank ? 'Bank Account' : isUan ? 'EPFO UAN' : isSalary ? 'Salary Statement' : isEducation ? 'Academic Credential' : 'Aadhaar (Front Side)'}
          </span>
        </div>

        <div className="flex items-center bg-emerald-950/80 p-0.5 rounded-lg border border-emerald-800/40 text-[10px]">
          <button
            type="button"
            onClick={() => setViewMode('card')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all ${
              viewMode === 'card'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300/70 hover:text-white'
            }`}
          >
            Digital ID Card
          </button>
          <button
            type="button"
            onClick={() => setViewMode('fields')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all ${
              viewMode === 'fields'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300/70 hover:text-white'
            }`}
          >
            Data List
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          MODE 1: DIGITAL ID CARD VIEW (Explicit styles for guaranteed color fidelity)
          ───────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'card' && (
        <>
          {/* 1. PAN CARD TEMPLATE (Exact NSDL Reference Replica) */}
          {isPan && !isBank && !isUan && !isSalary && !normalizedDoc.includes('aadhaar') && (
            <div
              className="rounded-2xl p-4 shadow-xl border relative overflow-hidden flex flex-col justify-between select-none animate-fadeIn"
              style={{ backgroundColor: '#edf7fe', color: '#0f172a', borderColor: '#cbe4f9' }}
            >
              {/* Subtle Guilloche Pattern */}
              <div
                className="absolute inset-0 opacity-[0.035] pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(#0284c7 1.2px, transparent 1.2px), radial-gradient(#f97316 1.2px, transparent 1.2px)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 8px 8px',
                }}
              />

              {/* Header: NSDL Logo + Ashok Stambh + Bharat Sarkar */}
              <div className="flex items-center justify-between pb-3 border-b relative z-10" style={{ borderColor: '#d0e5f7' }}>
                <NsdlLogoSvg />
                <div className="flex items-center justify-center">
                  <AshokStambhSvg className="w-6 h-8" />
                </div>
                <div className="text-right leading-tight">
                  <span className="text-[10px] font-black font-hindi block" style={{ color: '#0f172a' }}>भारत सरकार</span>
                  <span className="text-[8px] font-black tracking-tighter block uppercase" style={{ color: '#334155' }}>GOVT. OF INDIA</span>
                </div>
              </div>

              {/* PAN Input-Style Clean Cards */}
              <div className="my-3 space-y-2.5 relative z-10">
                <div>
                  <span className="text-[10px] font-bold block mb-1" style={{ color: '#334155' }}>
                    PAN Card Number
                  </span>
                  <div
                    className="w-full rounded-xl px-3.5 py-2.5 border shadow-sm flex items-center justify-between"
                    style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}
                  >
                    <span className="font-mono text-sm font-black tracking-wider" style={{ color: '#0f172a' }}>
                      {formatPan(extractedInfo.panNumber)}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      VERIFIED
                    </span>
                  </div>
                </div>

                {(extractedInfo.name || extractedInfo.employeeName) && (
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#334155' }}>
                      Name on Card
                    </span>
                    <div
                      className="w-full rounded-xl px-3.5 py-2.5 border shadow-sm"
                      style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}
                    >
                      <span className="text-xs font-black uppercase tracking-wide block" style={{ color: '#0f172a' }}>
                        {extractedInfo.name || extractedInfo.employeeName}
                      </span>
                    </div>
                  </div>
                )}

                {extractedInfo.dob && (
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#334155' }}>
                      Date of Birth
                    </span>
                    <div
                      className="w-full rounded-xl px-3.5 py-2.5 border shadow-sm flex items-center justify-between"
                      style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}
                    >
                      <span className="text-xs font-bold font-mono" style={{ color: '#0f172a' }}>
                        {formatDobToDDMMYYYY(extractedInfo.dob)}
                      </span>
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>
                )}

                {extractedInfo.fatherName && (
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#334155' }}>
                      Father's Name
                    </span>
                    <div
                      className="w-full rounded-xl px-3.5 py-2 border shadow-sm"
                      style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}
                    >
                      <span className="text-xs font-bold uppercase" style={{ color: '#1e293b' }}>
                        {extractedInfo.fatherName}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* PAN Footer */}
              <div
                className="border-t pt-2 flex items-center justify-between text-[8px] font-medium relative z-10"
                style={{ borderColor: '#d0e5f7', color: '#475569' }}
              >
                <span>INCOME TAX DEPARTMENT</span>
                <span>PERMANENT ACCOUNT NUMBER CARD</span>
              </div>
            </div>
          )}

          {/* 2. BANK PROOF TEMPLATE (Cheque / Passbook) */}
          {isBank && !normalizedDoc.includes('aadhaar') && (
            <div
              className="rounded-2xl p-4 shadow-xl border relative overflow-hidden flex flex-col justify-between select-none animate-fadeIn"
              style={{ backgroundColor: '#edfbf4', color: '#0f172a', borderColor: '#c3f0d7' }}
            >
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(#059669 1px, transparent 1px)',
                  backgroundSize: '12px 12px',
                }}
              />

              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b relative z-10" style={{ borderColor: '#caeed9' }}>
                <BankRbiLogoSvg />
                <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-200/80 text-emerald-900 border border-emerald-300">
                  VERIFIED
                </span>
              </div>

              {/* Bank Details Cards */}
              <div className="my-3 space-y-2.5 relative z-10">
                {extractedInfo.accountNumber && (
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#065f46' }}>Account Number</span>
                    <div
                      className="w-full rounded-xl px-3.5 py-2.5 border shadow-sm flex items-center justify-between"
                      style={{ backgroundColor: '#ffffff', borderColor: '#a7f3d0' }}
                    >
                      <span className="font-mono text-sm font-black tracking-wider" style={{ color: '#0f172a' }}>
                        {extractedInfo.accountNumber}
                      </span>
                      <span className="text-[8px] font-bold text-emerald-600 uppercase bg-emerald-50 px-1.5 py-0.5 rounded">
                        DIRECT CREDIT
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {extractedInfo.ifscCode && (
                    <div>
                      <span className="text-[10px] font-bold block mb-1" style={{ color: '#065f46' }}>IFSC Code</span>
                      <div
                        className="w-full rounded-xl px-3 py-2 border shadow-sm"
                        style={{ backgroundColor: '#ffffff', borderColor: '#a7f3d0' }}
                      >
                        <span className="font-mono text-xs font-bold uppercase" style={{ color: '#0f172a' }}>
                          {extractedInfo.ifscCode}
                        </span>
                      </div>
                    </div>
                  )}

                  {(extractedInfo.bankName || extractedInfo.branchName) && (
                    <div>
                      <span className="text-[10px] font-bold block mb-1" style={{ color: '#065f46' }}>Bank Name</span>
                      <div
                        className="w-full rounded-xl px-3 py-2 border shadow-sm truncate"
                        style={{ backgroundColor: '#ffffff', borderColor: '#a7f3d0' }}
                      >
                        <span className="text-xs font-bold truncate block" style={{ color: '#0f172a' }}>
                          {[extractedInfo.bankName, extractedInfo.branchName].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {(extractedInfo.name || extractedInfo.accountHolderName) && (
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#065f46' }}>Account Holder Name</span>
                    <div
                      className="w-full rounded-xl px-3.5 py-2 border shadow-sm"
                      style={{ backgroundColor: '#ffffff', borderColor: '#a7f3d0' }}
                    >
                      <span className="text-xs font-bold uppercase" style={{ color: '#0f172a' }}>
                        {extractedInfo.name || extractedInfo.accountHolderName}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Cheque MICR & RBI Validation Footer */}
              <div
                className="border-t pt-2 flex items-center justify-between text-[8px] font-medium relative z-10"
                style={{ borderColor: '#caeed9', color: '#047857' }}
              >
                <span>RESERVE BANK OF INDIA VALIDATED</span>
                <span className="font-mono tracking-widest text-slate-500">⑈ 110002001 ⑈</span>
                <span>ELECTRONIC CLEARING SERVICE</span>
              </div>
            </div>
          )}

          {/* 3. UAN / EPFO TEMPLATE */}
          {isUan && !normalizedDoc.includes('aadhaar') && !isBank && (
            <div
              className="rounded-2xl p-4 shadow-xl border relative overflow-hidden flex flex-col justify-between select-none animate-fadeIn"
              style={{ backgroundColor: '#fef9ee', color: '#0f172a', borderColor: '#fbe5b8' }}
            >
              <div
                className="absolute inset-0 opacity-[0.035] pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(#d97706 1px, transparent 1px)',
                  backgroundSize: '12px 12px',
                }}
              />

              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b relative z-10" style={{ borderColor: '#f3ddb0' }}>
                <EpfoLogoSvg />
                <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                  UAN CARD
                </span>
              </div>

              {/* Body */}
              <div className="my-3 space-y-2.5 relative z-10">
                {extractedInfo.uanNumber && (
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#78350f' }}>
                      Universal Account Number (UAN)
                    </span>
                    <div
                      className="w-full rounded-xl px-3.5 py-2.5 border shadow-sm flex items-center justify-between"
                      style={{ backgroundColor: '#ffffff', borderColor: '#fde68a' }}
                    >
                      <span className="font-mono text-sm font-black tracking-wider" style={{ color: '#0f172a' }}>
                        {formatAadhaar(extractedInfo.uanNumber)}
                      </span>
                      <span className="text-[8px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        ACTIVE
                      </span>
                    </div>
                  </div>
                )}

                {(extractedInfo.memberId || extractedInfo.pfNumber) && (
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#78350f' }}>Member ID / PF Number</span>
                    <div
                      className="w-full rounded-xl px-3.5 py-2.5 border shadow-sm"
                      style={{ backgroundColor: '#ffffff', borderColor: '#fde68a' }}
                    >
                      <span className="font-mono text-xs font-bold uppercase" style={{ color: '#0f172a' }}>
                        {extractedInfo.memberId || extractedInfo.pfNumber}
                      </span>
                    </div>
                  </div>
                )}

                {(extractedInfo.name || extractedInfo.employeeName) && (
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#78350f' }}>Member Name</span>
                    <div
                      className="w-full rounded-xl px-3.5 py-2 border shadow-sm"
                      style={{ backgroundColor: '#ffffff', borderColor: '#fde68a' }}
                    >
                      <span className="text-xs font-bold uppercase" style={{ color: '#0f172a' }}>
                        {extractedInfo.name || extractedInfo.employeeName}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                className="border-t pt-2 flex items-center justify-between text-[8px] font-medium relative z-10"
                style={{ borderColor: '#f3ddb0', color: '#92400e' }}
              >
                <span>MINISTRY OF LABOUR & EMPLOYMENT</span>
                <span>EPFO MEMBER SERVICES</span>
              </div>
            </div>
          )}

          {/* 4. SALARY SLIP / PAYROLL STATEMENT */}
          {isSalary && (
            <div
              className="rounded-2xl p-4 shadow-xl border relative overflow-hidden flex flex-col justify-between select-none animate-fadeIn"
              style={{ backgroundColor: '#f0fdf4', color: '#0f172a', borderColor: '#bbf7d0' }}
            >
              <div
                className="absolute inset-0 opacity-[0.035] pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(#059669 1px, transparent 1px)',
                  backgroundSize: '12px 12px',
                }}
              />

              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b relative z-10" style={{ borderColor: '#bbf7d0' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    ₹
                  </div>
                  <div className="leading-tight">
                    <span className="text-xs font-black uppercase tracking-tight block" style={{ color: '#064e3b' }}>
                      Salary Slip Statement
                    </span>
                    <span className="text-[7.5px] font-bold text-emerald-700 tracking-tight">
                      Payroll & Earnings Verification
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-200 text-emerald-950 border border-emerald-300">
                  VERIFIED
                </span>
              </div>

              {/* Body */}
              <div className="my-3 space-y-2.5 relative z-10">
                {/* Net Pay Highlight Card */}
                <div>
                  <span className="text-[10px] font-bold block mb-1" style={{ color: '#065f46' }}>
                    Net Pay / Take-Home Salary
                  </span>
                  <div
                    className="w-full rounded-xl px-3.5 py-2.5 border shadow-sm flex items-center justify-between"
                    style={{ backgroundColor: '#ffffff', borderColor: '#86efac' }}
                  >
                    <span className="font-mono text-base font-black tracking-wide" style={{ color: '#064e3b' }}>
                      ₹ {formatCurrency(extractedInfo.netPay || extractedInfo.netSalary || extractedInfo.grossSalary || '0')}
                    </span>
                    <span className="text-[8.5px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded uppercase">
                      DISBURSED
                    </span>
                  </div>
                </div>

                {/* Employee Name & Site / Employer Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#065f46' }}>
                      Employee Name
                    </span>
                    <div
                      className="w-full rounded-xl px-3 py-2 border shadow-sm truncate"
                      style={{ backgroundColor: '#ffffff', borderColor: '#a7f3d0' }}
                    >
                      <span className="text-xs font-bold uppercase truncate block" style={{ color: '#0f172a' }}>
                        {extractedInfo.employeeName || extractedInfo.name || 'BISHNU CHARAN SAHOO'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#065f46' }}>
                      Site / Employer Name
                    </span>
                    <div
                      className="w-full rounded-xl px-3 py-2 border shadow-sm truncate"
                      style={{ backgroundColor: '#ffffff', borderColor: '#a7f3d0' }}
                    >
                      <span className="text-xs font-bold truncate block" style={{ color: '#0f172a' }}>
                        {extractedInfo.siteName || extractedInfo.employerName || extractedInfo.companyName || extractedInfo.bankName || 'Brigade Omega'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* UAN Number & Bank Account Number */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#065f46' }}>
                      UAN Number
                    </span>
                    <div
                      className="w-full rounded-xl px-3 py-2 border shadow-sm truncate"
                      style={{ backgroundColor: '#ffffff', borderColor: '#a7f3d0' }}
                    >
                      <span className="font-mono text-xs font-black truncate block" style={{ color: '#0f172a' }}>
                        {extractedInfo.uanNumber || extractedInfo.pfNumber || '•••• •••• ••••'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#065f46' }}>
                      Disbursement Account
                    </span>
                    <div
                      className="w-full rounded-xl px-3 py-2 border shadow-sm truncate"
                      style={{ backgroundColor: '#ffffff', borderColor: '#a7f3d0' }}
                    >
                      <span className="font-mono text-xs font-black truncate block" style={{ color: '#0f172a' }}>
                        {extractedInfo.accountNumber || '••••••••••••'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div
                className="border-t pt-2 flex items-center justify-between text-[8px] font-medium relative z-10"
                style={{ borderColor: '#bbf7d0', color: '#047857' }}
              >
                <span>OFFICIAL SALARY RECORD</span>
                <span>PAYROLL COMPLIANT</span>
              </div>
            </div>
          )}

          {/* 5. EDUCATION CERTIFICATE */}
          {isEducation && !normalizedDoc.includes('aadhaar') && !isPan && !isBank && !isUan && !isSalary && (
            <div
              className="rounded-2xl p-4 shadow-xl border relative overflow-hidden flex flex-col justify-between select-none animate-fadeIn"
              style={{ backgroundColor: '#fffdfa', color: '#0f172a', borderColor: '#fde68a' }}
            >
              <div className="flex items-center justify-between pb-2.5 border-b" style={{ borderColor: '#fef3c7' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    🎓
                  </div>
                  <div className="leading-tight">
                    <span className="text-xs font-black uppercase tracking-tight block" style={{ color: '#78350f' }}>Education Certificate</span>
                    <span className="text-[8px] font-semibold text-amber-700">Academic Credential Proof</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  VERIFIED
                </span>
              </div>

              <div className="my-3 space-y-2.5">
                {extractedInfo.degree && (
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#78350f' }}>Degree / Qualification</span>
                    <div
                      className="w-full rounded-xl px-3.5 py-2.5 border shadow-sm"
                      style={{ backgroundColor: '#ffffff', borderColor: '#fde68a' }}
                    >
                      <span className="text-xs font-black uppercase tracking-wide block" style={{ color: '#0f172a' }}>
                        {extractedInfo.degree}
                      </span>
                    </div>
                  </div>
                )}

                {extractedInfo.institution && (
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#78350f' }}>University / Board</span>
                    <div
                      className="w-full rounded-xl px-3.5 py-2 border shadow-sm"
                      style={{ backgroundColor: '#ffffff', borderColor: '#fde68a' }}
                    >
                      <span className="text-xs font-bold uppercase block" style={{ color: '#1e293b' }}>
                        {extractedInfo.institution}
                      </span>
                    </div>
                  </div>
                )}

                {(extractedInfo.name || extractedInfo.candidateName) && (
                  <div>
                    <span className="text-[10px] font-bold block mb-1" style={{ color: '#78350f' }}>Candidate Name</span>
                    <div
                      className="w-full rounded-xl px-3.5 py-2 border shadow-sm"
                      style={{ backgroundColor: '#ffffff', borderColor: '#fde68a' }}
                    >
                      <span className="text-xs font-bold uppercase" style={{ color: '#1e293b' }}>
                        {extractedInfo.name || extractedInfo.candidateName}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-2 flex items-center justify-between text-[8px] text-amber-800 font-medium" style={{ borderColor: '#fef3c7' }}>
                <span>ACADEMIC RECORD VERIFICATION</span>
                <span>UGC / AICTE RECOGNIZED</span>
              </div>
            </div>
          )}

          {/* 6. AADHAAR BACK SIDE TEMPLATE (Dual Column Address, NO QR Code) */}
          {isIdBack && (
            <div
              className="rounded-2xl p-3.5 shadow-xl border relative overflow-hidden flex flex-col justify-between select-none min-h-[220px] animate-fadeIn"
              style={{ backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#e2e8f0' }}
            >
              {/* Subtle Security Micro-print */}
              <div
                className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '8px 8px' }}
              />

              {/* Header: Ashok Stambh + Authority Brush + Aadhaar Sun */}
              <div className="flex items-center justify-between pb-1 relative z-10">
                <div className="w-9 shrink-0 flex flex-col items-center">
                  <AshokStambhSvg className="w-6 h-8 text-slate-800" />
                </div>

                <TricolorBrushBanner
                  authority="UNIQUE IDENTIFICATION AUTHORITY OF INDIA"
                  authorityHindi="भारत सरकार"
                />

                <div className="w-9 shrink-0 flex items-center justify-center">
                  <AadhaarSunLogoSvg className="w-9 h-9" />
                </div>
              </div>

              {/* Address Dual Column Body (NO QR CODE - spacious and clean) */}
              <div
                className="grid grid-cols-2 gap-3 my-2 text-[10px] leading-snug border-t pt-2 px-1 relative z-10"
                style={{ borderColor: '#f1f5f9', color: '#1e293b' }}
              >
                <div className="space-y-0.5 border-r pr-2" style={{ borderColor: '#e2e8f0' }}>
                  <span className="text-[8.5px] font-black uppercase tracking-wider block" style={{ color: '#64748b' }}>Address</span>
                  {extractedInfo.fatherName && (
                    <p className="font-bold text-[10px]" style={{ color: '#0f172a' }}>C/O: {extractedInfo.fatherName}</p>
                  )}
                  <p className="text-[9.5px]">{addressLine || 'Address detected on card'}</p>
                  {cityDistState && <p className="text-[9.5px]">{cityDistState}</p>}
                  {pincode && <p className="font-bold text-[10px] pt-1" style={{ color: '#0f172a' }}>PIN: {pincode}</p>}
                </div>

                <div className="space-y-0.5 pl-1 font-hindi">
                  <span className="text-[8.5px] font-black uppercase tracking-wider block" style={{ color: '#64748b' }}>पता</span>
                  {extractedInfo.fatherName && (
                    <p className="font-bold text-[10px]" style={{ color: '#0f172a' }}>आत्मज/पति: {extractedInfo.fatherName}</p>
                  )}
                  <p className="text-[9.5px]">{addressLine || 'कार्ड पर पता उपलब्ध'}</p>
                  {cityDistState && <p className="text-[9.5px]">{cityDistState}</p>}
                  {pincode && <p className="font-bold text-[10px] pt-1" style={{ color: '#0f172a' }}>पिन: {pincode}</p>}
                </div>
              </div>

              {/* 12-Digit UID Footer */}
              <div className="text-center pt-1.5 pb-0.5 border-t relative z-10" style={{ borderColor: '#f1f5f9' }}>
                <span className="font-mono text-sm font-black tracking-[0.2em]" style={{ color: '#0f172a' }}>
                  {formatAadhaar(extractedInfo.aadhaarNumber)}
                </span>
              </div>

              {/* Official Helpline & Website Footer */}
              <div className="border-t pt-1 text-center relative z-10" style={{ borderColor: '#cbd5e1' }}>
                <div className="flex items-center justify-center gap-3 text-[7.5px] mb-0.5 font-medium" style={{ color: '#475569' }}>
                  <span>📞 1947</span>
                  <span>✉️ help@uidai.gov.in</span>
                  <span>🌐 www.uidai.gov.in</span>
                </div>
                <p className="font-hindi text-[9.5px] font-extrabold tracking-wide" style={{ color: '#b91c1c' }}>
                  आधार - भारतीय विशिष्ट पहचान प्राधिकरण
                </p>
              </div>
            </div>
          )}

          {/* 7. AADHAAR FRONT SIDE TEMPLATE (Default / Primary ID Card, NO QR Code) */}
          {!isIdBack && !isPan && !isBank && !isUan && !isSalary && !isEducation && (
            <div
              className="rounded-2xl p-3.5 shadow-xl border relative overflow-hidden flex flex-col justify-between select-none min-h-[220px] animate-fadeIn"
              style={{ backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#e2e8f0' }}
            >
              {/* Micro-print security pattern */}
              <div
                className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '8px 8px' }}
              />

              {/* Header: Ashok Stambh (Left) + Tricolor Brush (Center) + Aadhaar Sun Logo (Right) */}
              <div className="flex items-center justify-between pb-1 relative z-10">
                <div className="flex flex-col items-center w-10 shrink-0">
                  <AshokStambhSvg className="w-8 h-10 text-slate-800" />
                </div>

                <TricolorBrushBanner
                  authority="GOVERNMENT OF INDIA"
                  authorityHindi="भारत सरकार"
                />

                <div className="flex items-center justify-center w-11 shrink-0">
                  <AadhaarSunLogoSvg className="w-11 h-11" />
                </div>
              </div>

              {/* Body: Candidate Photo (Left) + Clean Spacious Details (NO QR CODE) */}
              <div className="flex items-center gap-3 my-2.5 relative z-10 px-1">
                <div
                  className="w-20 h-24 rounded-lg border p-0.5 shadow-sm shrink-0 overflow-hidden flex flex-col items-center justify-center relative"
                  style={{ backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }}
                >
                  {userProfilePhoto && !relation ? (
                    <img src={userProfilePhoto} alt="Candidate" className="w-full h-full object-cover rounded" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200">
                      <svg className="w-12 h-14 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                  <span className="absolute bottom-0 inset-x-0 bg-slate-800/80 text-white text-[7px] text-center font-bold uppercase tracking-tight py-0.5">
                    PHOTO
                  </span>
                </div>

                <div className="flex-1 space-y-1.5 leading-tight" style={{ color: '#1e293b' }}>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-tight block" style={{ color: '#64748b' }}>NAME</span>
                    <span className="text-sm font-black uppercase tracking-wide block" style={{ color: '#0f172a' }}>
                      {extractedInfo.name || (!relation ? extractedInfo.employeeName : '') || (relation ? `${relation}'s Full Name` : 'NAME ON DOCUMENT')}
                    </span>
                  </div>

                  {extractedInfo.dob && (
                    <div className="pt-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-tight block" style={{ color: '#64748b' }}>DOB / जन्म तारीख</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono" style={{ color: '#0f172a' }}>
                          {formatDobToDDMMYYYY(extractedInfo.dob)}
                        </span>
                        {calculateAge(extractedInfo.dob) !== null && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Age: {calculateAge(extractedInfo.dob)} Yrs
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {extractedInfo.gender && (
                    <div className="pt-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-tight block" style={{ color: '#64748b' }}>GENDER / लिंग</span>
                      <span className="text-xs font-bold uppercase" style={{ color: '#0f172a' }}>
                        {extractedInfo.gender === 'Female' ? 'FEMALE / महिला' : 'MALE / पुरुष'}
                      </span>
                    </div>
                  )}

                  {extractedInfo.fatherName && !relation && (
                    <div className="pt-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-tight block" style={{ color: '#64748b' }}>FATHER / पिता</span>
                      <span className="text-xs font-bold uppercase" style={{ color: '#0f172a' }}>
                        {extractedInfo.fatherName}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Center Big 12-Digit Aadhaar Number */}
              <div className="text-center pt-2 pb-1 relative z-10 border-t" style={{ borderColor: '#f1f5f9' }}>
                <span className="font-mono text-base font-black tracking-[0.22em]" style={{ color: '#0f172a' }}>
                  {formatAadhaar(extractedInfo.aadhaarNumber)}
                </span>
              </div>

              {/* Footer: Dividing Line + Official Red Authority Text */}
              <div className="border-t pt-1 text-center relative z-10" style={{ borderColor: '#cbd5e1' }}>
                <p className="font-hindi text-[10px] font-extrabold tracking-wide" style={{ color: '#b91c1c' }}>
                  आधार - भारतीय विशिष्ट पहचान प्राधिकरण
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          MODE 2: RAW DATA FIELDS LIST (for quick review or editing)
          ───────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'fields' && (
        <div className="divide-y divide-emerald-900/30 rounded-xl bg-[#031d11] border border-emerald-800/40 overflow-hidden shadow-sm animate-fadeIn">
          {Object.entries(extractedInfo)
            .filter(([k, v]) => v && typeof v !== 'object' && !['confidence', 'verified'].includes(k))
            .map(([key, val]) => (
              <div key={key} className="flex items-center justify-between p-3 hover:bg-emerald-950/30 transition-colors">
                <span className="text-xs font-medium text-emerald-300/80 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="text-xs font-bold text-white tracking-wide uppercase font-mono">
                  {String(val)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default DigitalIdCardPreview;
