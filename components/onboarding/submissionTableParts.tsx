/**
 * Shared building blocks for the onboarding submissions tables
 * (Verification Dashboard + My Submissions).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckSquare, XSquare, Square, MoreHorizontal } from 'lucide-react';
import type { OnboardingData } from '@/types';

export const getDocValue = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object') return (val.url || val.preview || val.name || '').trim();
    return String(val).trim();
};

export interface DocumentVerificationBadgesProps {
    submission: OnboardingData;
    onToggleDoc?: (docType: string) => void;
    hideLabels?: boolean;
}

// Shared document-status rules (used by the full badges and the compact table summary).
export const computeDocList = (submission: OnboardingData) => {
    const personal = (submission.personal as any) || {};
    const documents = (submission as any)?.documents || {};
    const bank = (submission.bank as any) || {};
    const uan = (submission.uan as any) || {};
    const address = (submission.address as any) || {};

    // 1. PAN Verification Status
    const hasPanNumber = Boolean(
        getDocValue(personal.panCard) ||
        getDocValue(personal.panNumber) ||
        (personal.idProofType === 'PAN' && getDocValue(personal.idProofNumber)) ||
        documents.panCard
    );
    const hasPanDoc = Boolean(
        (personal.idProofType === 'PAN' && (personal.idProofFront || personal.idProofBack)) ||
        documents.panCard
    );
    const isExplicitlyPanVerified = personal.verifiedStatus?.panCard === true || 
        personal.verifiedStatus?.panNumber === true || 
        (personal.idProofType === 'PAN' && personal.verifiedStatus?.idProofNumber === true);
    const isExplicitlyPanFailed = personal.verifiedStatus?.panCard === false || 
        personal.verifiedStatus?.panNumber === false || 
        (personal.idProofType === 'PAN' && personal.verifiedStatus?.idProofNumber === false);
    const isPanVerified = (hasPanNumber || hasPanDoc) && !isExplicitlyPanFailed && (isExplicitlyPanVerified || hasPanNumber);

    // 2. Aadhaar Verification Status
    const hasAadhaarNumber = Boolean(
        getDocValue(personal.aadhaarNumber) ||
        (personal.idProofType === 'Aadhaar' && getDocValue(personal.idProofNumber)) ||
        documents.aadhaarNumber
    );
    const hasAadhaarDoc = Boolean(
        (personal.idProofType === 'Aadhaar' && (personal.idProofFront || personal.idProofBack)) ||
        documents.aadhaarFront ||
        documents.aadhaarBack
    );
    const isExplicitlyAadhaarVerified = personal.isQrVerified === true || 
        personal.verifiedStatus?.aadhaarNumber === true || 
        (personal.idProofType === 'Aadhaar' && personal.verifiedStatus?.idProofNumber === true);
    const isExplicitlyAadhaarFailed = personal.verifiedStatus?.aadhaarNumber === false || 
        (personal.idProofType === 'Aadhaar' && personal.verifiedStatus?.idProofNumber === false);
    const isAadhaarVerified = (hasAadhaarNumber || hasAadhaarDoc) && !isExplicitlyAadhaarFailed && (isExplicitlyAadhaarVerified || hasAadhaarNumber);

    // 3. UAN Verification Status
    const isUanApplicable = Boolean(uan.hasPreviousPf);
    const hasUanNumber = Boolean(getDocValue(uan.uanNumber));
    const hasUanDoc = Boolean(uan.document || uan.salarySlip);
    const isExplicitlyUanVerified = uan.verifiedStatus?.uanNumber === true;
    const isExplicitlyUanFailed = uan.verifiedStatus?.uanNumber === false;
    const isUanVerified = isUanApplicable ? (
        (hasUanNumber || hasUanDoc) && !isExplicitlyUanFailed && (isExplicitlyUanVerified || hasUanNumber)
    ) : null;

    // 4. Bank Account Verification Status
    const hasBankAcc = Boolean(getDocValue(bank.accountNumber));
    const hasBankIfsc = Boolean(getDocValue(bank.ifscCode));
    const isExplicitlyBankVerified = bank.verifiedStatus?.accountNumber === true;
    const isExplicitlyBankFailed = bank.verifiedStatus?.accountNumber === false;
    const isBankVerified = hasBankAcc && hasBankIfsc && !isExplicitlyBankFailed && (isExplicitlyBankVerified || (hasBankAcc && hasBankIfsc));

    // 5. Address Verification Status
    const hasPresentAddr = Boolean(getDocValue(address.present?.line1));
    const hasPermanentAddr = Boolean(address.sameAsPresent || getDocValue(address.permanent?.line1));
    const isExplicitlyAddrVerified = address.present?.verifiedStatus?.line1 === true;
    const isExplicitlyAddrFailed = address.present?.verifiedStatus?.line1 === false;
    const isAddressVerified = hasPresentAddr && hasPermanentAddr && !isExplicitlyAddrFailed && (isExplicitlyAddrVerified || (hasPresentAddr && hasPermanentAddr));

    const docList = [
        { 
            key: 'pan', 
            label: 'PAN', 
            verified: isPanVerified,
            activeColor: 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100',
            iconColor: 'text-blue-600 dark:text-blue-400'
        },
        { 
            key: 'aadhaar', 
            label: 'Aadhaar', 
            verified: isAadhaarVerified,
            activeColor: 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100',
            iconColor: 'text-emerald-600 dark:text-emerald-400'
        },
        { 
            key: 'uan', 
            label: 'UAN', 
            verified: isUanVerified, 
            applicable: isUanApplicable,
            activeColor: 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100',
            iconColor: 'text-amber-600 dark:text-amber-400'
        },
        { 
            key: 'bank', 
            label: 'Bank', 
            verified: isBankVerified,
            activeColor: 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100',
            iconColor: 'text-indigo-600 dark:text-indigo-400'
        },
        { 
            key: 'address', 
            label: 'Address', 
            verified: isAddressVerified,
            activeColor: 'bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-100',
            iconColor: 'text-teal-600 dark:text-teal-400'
        },
    ];
    return docList;
};

export const DocumentVerificationBadges: React.FC<DocumentVerificationBadgesProps> = ({ submission, onToggleDoc, hideLabels }) => {
    const docList = computeDocList(submission);

    return (
        <div className={`flex items-center ${hideLabels ? 'gap-1.5 justify-center' : 'gap-2 flex-wrap'}`}>
            {docList.map(doc => {
                if (doc.applicable === false) {
                    return (
                        <span 
                            key={doc.key} 
                            className={`inline-flex items-center justify-center gap-1 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-[#041b0f] text-slate-400 dark:text-white/40 border border-slate-200 dark:border-[#134426] ${
                                hideLabels ? 'w-6 h-6 p-0' : 'px-2 py-0.5'
                            }`}
                            title={`${doc.label}: Not Applicable`}
                        >
                            <Square className="w-3 h-3 text-slate-300 dark:text-white/30" />
                            {!hideLabels && <span>{doc.label} (N/A)</span>}
                        </span>
                    );
                }
                const isVerified = doc.verified === true;
                return (
                    <button
                        key={doc.key}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleDoc?.(doc.key);
                        }}
                        className={`inline-flex items-center justify-center gap-1 rounded-md text-[10px] font-bold transition-all duration-150 shadow-2xs ${
                            hideLabels ? 'w-6 h-6 p-0' : 'px-2 py-0.5'
                        } ${
                            isVerified 
                                ? doc.activeColor 
                                : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                        }`}
                        title={`${doc.label}: ${isVerified ? 'Verified (Click to toggle)' : 'Not Verified (Click to toggle)'}`}
                    >
                        {isVerified ? (
                            <CheckSquare className={`w-3.5 h-3.5 ${doc.iconColor} flex-shrink-0`} />
                        ) : (
                            <XSquare className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                        )}
                        {!hideLabels && <span>{doc.label}</span>}
                    </button>
                );
            })}
        </div>
    );
};

// ── Table helpers (redesigned desktop table) ──────────────────────────────────

/** Title-case strings that were stored in ALL CAPS; keep short tokens like HK / MM as-is. */
export const prettyText = (value?: string | null): string => {
    const t = (value || '').trim();
    if (!t || t !== t.toUpperCase()) return t;
    return t.toLowerCase().replace(/\b([a-z])([a-z]*)/g, (m, a: string, b: string) =>
        m.length <= 2 ? m.toUpperCase() : a.toUpperCase() + b
    );
};

/** Closes a floating popover on scroll / resize / Escape. */
export const useDismissOnScroll = (active: boolean, close: () => void) => {
    useEffect(() => {
        if (!active) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('keydown', onKey);
        };
    }, [active, close]);
};

/** Compact "4/5" document summary; click to open the full toggle badges in a popover. */
export const CompactDocSummary: React.FC<{ submission: OnboardingData; onToggleDoc: (key: string) => void }> = ({ submission, onToggleDoc }) => {
    const [anchor, setAnchor] = useState<DOMRect | null>(null);
    const close = useCallback(() => setAnchor(null), []);
    useDismissOnScroll(!!anchor, close);

    const docs = computeDocList(submission).filter(d => (d as any).applicable !== false);
    const done = docs.filter(d => d.verified === true).length;
    const total = docs.length;
    const tone = done === total ? 'text-emerald-700' : done === 0 ? 'text-rose-600' : 'text-amber-700';

    const popTop = anchor ? (anchor.bottom + 110 > window.innerHeight ? anchor.top - 104 : anchor.bottom + 6) : 0;
    const popLeft = anchor ? Math.max(8, Math.min(anchor.left - 8, window.innerWidth - 340)) : 0;

    return (
        <>
            <button
                type="button"
                onClick={(e) => setAnchor(anchor ? null : e.currentTarget.getBoundingClientRect())}
                className="inline-flex items-center gap-2 px-2 py-1 -mx-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#134426] transition-colors cursor-pointer"
                title={docs.map(d => `${d.label}: ${d.verified ? 'Verified' : 'Not verified'}`).join('\n')}
                aria-label={`${done} of ${total} documents verified`}
            >
                <span className="flex items-center gap-0.5">
                    {docs.map(d => (
                        <span key={d.key} className={`h-1.5 w-3 rounded-full ${d.verified ? 'bg-emerald-500' : 'bg-rose-300 dark:bg-rose-700'}`} />
                    ))}
                </span>
                <span className={`text-xs font-bold tabular-nums ${tone}`}>{done}/{total}</span>
            </button>
            {anchor && createPortal(
                <div className="fixed inset-0 z-[90]" onClick={close}>
                    <div
                        className="fixed bg-white dark:bg-[#092c19] rounded-xl shadow-xl border border-slate-200 dark:border-[#134426] p-3"
                        style={{ top: popTop, left: popLeft }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50 mb-2">
                            Documents · click to toggle
                        </div>
                        <DocumentVerificationBadges submission={submission} onToggleDoc={onToggleDoc} />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export interface RowMenuItem {
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    danger?: boolean;
}

/** "⋯" overflow menu for secondary row actions. */
export const RowActionsMenu: React.FC<{ items: RowMenuItem[] }> = ({ items }) => {
    const [anchor, setAnchor] = useState<DOMRect | null>(null);
    const close = useCallback(() => setAnchor(null), []);
    useDismissOnScroll(!!anchor, close);

    const menuHeight = items.length * 34 + 12;
    const top = anchor ? (anchor.bottom + menuHeight + 8 > window.innerHeight ? anchor.top - menuHeight - 4 : anchor.bottom + 4) : 0;
    const left = anchor ? Math.max(8, anchor.right - 200) : 0;

    return (
        <>
            <button
                type="button"
                onClick={(e) => setAnchor(anchor ? null : e.currentTarget.getBoundingClientRect())}
                className={`h-7 w-7 inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                    anchor
                        ? 'bg-slate-100 border-slate-300 text-slate-800 dark:bg-[#134426] dark:text-white'
                        : 'bg-white dark:bg-[#041b0f] border-slate-200 dark:border-[#134426] text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-white/60'
                }`}
                title="More actions"
                aria-label="More actions"
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>
            {anchor && createPortal(
                <div className="fixed inset-0 z-[90]" onClick={close}>
                    <div
                        className="fixed w-[200px] bg-white dark:bg-[#092c19] rounded-xl shadow-xl border border-slate-200 dark:border-[#134426] py-1.5"
                        style={{ top, left }}
                        onClick={(e) => e.stopPropagation()}
                        role="menu"
                    >
                        {items.map(item => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.label}
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { close(); item.onClick(); }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-left transition-colors cursor-pointer ${
                                        item.danger
                                            ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                            : 'text-slate-700 dark:text-white/80 hover:bg-slate-50 dark:hover:bg-[#134426]'
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5 shrink-0" />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
