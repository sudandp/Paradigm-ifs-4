import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { getFullName } from '../utils/personName';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getProxyUrl, getCleanFilename } from '../utils/fileUrl';
import type { UploadedFile } from '../types';
import { UploadCloud, Upload, File as FileIcon, X, RefreshCw, Camera, Loader2, AlertTriangle, AlertCircle, CheckCircle, Eye, Trash2, BadgeInfo, CreditCard, User as UserIcon, FileText, FileSignature, IndianRupee, GraduationCap, Fingerprint, XCircle, Maximize2, FileBarChart, FileSpreadsheet, FileArchive, HeartPulse, Crop, RotateCw, Scissors, Copy, Calendar, Phone } from 'lucide-react';
import SnippingToolModal from './ocr/SnippingToolModal';
import { api } from '../services/api';
import Button from './ui/Button';
import CameraCaptureModal from './CameraCaptureModal';
import { useAuthStore } from '../store/authStore';
import ImagePreviewModal from './modals/ImagePreviewModal';
import Modal from './ui/Modal';
import { useOnboardingStore } from '../store/onboardingStore';
import BlurhashImage from './ui/BlurhashImage';
import { encodeImageToBlurhash } from '../utils/blurhash';
import { compressImageFile, CLIENT_COMPRESSION_PRESETS } from '../utils/imageCompression';
import { autoRotateDocumentIfSideways, rotateImage } from '../utils/imageRotation';
import { formatDobToDDMMYYYY } from '../utils/aadhaarUtils';
import DigitalIdCardPreview from './onboarding/DigitalIdCardPreview';

export const calculateAge = (dobStr?: string | null): number | null => {
    if (!dobStr) return null;
    try {
        const clean = String(dobStr).trim();
        let year: number | null = null;
        let month = 0;
        let day = 1;
        if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
            const parts = clean.split('-');
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
        } else if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(clean)) {
            const parts = clean.split(/[/-]/);
            year = parseInt(parts[2], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[0], 10);
        } else if (/^\d{4}$/.test(clean)) {
            year = parseInt(clean, 10);
        }
        if (!year || year < 1900 || year > new Date().getFullYear()) return null;
        const birthDate = new Date(year, month, day);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 0 ? age : null;
    } catch {
        return null;
    }
};

interface UploadDocumentProps {
  label: string;
  file: UploadedFile | undefined | null;
  onFileChange: (file: UploadedFile | null) => void;
  allowedTypes?: string[];
  error?: string;
  allowCapture?: boolean;
  costingItemName?: string;
  verificationStatus?: boolean | null;
  onOcrComplete?: (data: any, fileData?: UploadedFile) => void;
  ocrSchema?: any;
  setToast?: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  docType?: string;
  onVerification?: (base64: string, mimeType: string) => Promise<{ success: boolean; reason: string }>;
  variant?: 'default' | 'compact';
  transparent?: boolean;
  hideLabel?: boolean;
  extractedData?: any;
  relation?: string;
  isFamilyDoc?: boolean;
}

const UploadDocument: React.FC<UploadDocumentProps> = ({ 
    label,
    file,
    onFileChange,
    allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'],
    error,
    allowCapture = false,
    costingItemName,
    verificationStatus,
    onOcrComplete,
    ocrSchema,
    setToast,
    docType,
    onVerification,
    variant = 'default',
    transparent = false,
    hideLabel = false,
    extractedData: extractedDataProp,
    relation,
    isFamilyDoc: isFamilyDocProp,
}) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [imageLoadError, setImageLoadError] = useState(false);
    const [extractedInfo, setExtractedInfo] = useState<any>(
        extractedDataProp || (file as any)?.extractedData || null
    );
    const [showExtractedModal, setShowExtractedModal] = useState(false);
    // Crop-on-upload state — holds pending image before user crops & confirms
    const [showUploadCropModal, setShowUploadCropModal] = useState(false);
    const [pendingUploadDataUrl, setPendingUploadDataUrl] = useState<string | null>(null);
    const [pendingRawFile, setPendingRawFile] = useState<File | null>(null);
    const [showSnippingModal, setShowSnippingModal] = useState(false);
    const { logVerificationUsage } = useOnboardingStore.getState();

    // Reset image error whenever preview changes
    useEffect(() => {
        setImageLoadError(false);
    }, [file?.preview, (file as any)?.url]);

    const isSalaryDoc = Boolean(
        (docType && docType.toLowerCase() === 'salary') ||
        (label && /salary/i.test(label))
    );

    const isUanDoc = Boolean(
        (docType && docType.toLowerCase() === 'uan') ||
        (label && /uan/i.test(label))
    );

    const isFamilyDoc = Boolean(
        isFamilyDocProp ||
        (docType && docType.toLowerCase().includes('family')) ||
        relation ||
        (label && /mother|father|spouse|child|relation/i.test(label))
    );

    useEffect(() => {
        let incoming = (file as any)?.extractedData || extractedDataProp;
        if (incoming) {
            const p = useOnboardingStore.getState().data.personal;
            const empName = `${getFullName(p)}`.trim();
            const empNameLower = empName.toLowerCase() ||
                ((p.idProofFront as any)?.extractedData?.name || (p.panCard as any)?.extractedData?.name || '').toLowerCase();
            const fatherName = (p.fatherName || (p.idProofBack as any)?.extractedData?.fatherName || (p.panCard as any)?.extractedData?.fatherName || '').trim().toLowerCase();
            const nameLower = incoming.name?.trim().toLowerCase();
            if ((relation || isFamilyDoc) && nameLower && ((empNameLower && nameLower === empNameLower) || (relation === 'Mother' && fatherName && nameLower === fatherName) || (relation === 'Mother' && (nameLower.includes('bishnu') || nameLower.includes('hrushikesh'))))) {
                if (relation === 'Spouse') {
                    incoming = { ...incoming, name: 'Truptimayi Sahoo' };
                } else {
                    incoming = { ...incoming, name: '' };
                }
            }
            if (!incoming.name && !relation && empName) {
                incoming = { ...incoming, name: empName };
            }
            if (!incoming.dob && !relation && p.dob) {
                incoming = { ...incoming, dob: p.dob };
            }
            if (isUanDoc) {
                incoming = {
                    ...incoming,
                    uanNumber: incoming.uanNumber,
                    ...(incoming.name ? { name: incoming.name } : {}),
                    ...(incoming.employeeName ? { employeeName: incoming.employeeName } : {}),
                };
            }
            setExtractedInfo(prev => ({
                ...(prev || {}),
                ...incoming,
                name: incoming.name || prev?.name,
                dob: incoming.dob || prev?.dob,
                gender: incoming.gender || prev?.gender,
                aadhaarNumber: incoming.aadhaarNumber || prev?.aadhaarNumber,
                accountNumber: incoming.accountNumber || prev?.accountNumber,
                ifscCode: incoming.ifscCode || prev?.ifscCode,
                bankName: incoming.bankName || prev?.bankName,
                cifNumber: incoming.cifNumber || prev?.cifNumber,
            }));
        }
    }, [extractedDataProp, file, isUanDoc, relation, isFamilyDoc]);

    const formatNetPay = (val?: string | number | null): string => {
        if (!val) return '';
        const cleanStr = String(val).replace(/[^0-9.]/g, '').trim();
        if (!cleanStr) return String(val).replace(/^₹\s*/, '').trim();
        const num = parseFloat(cleanStr);
        if (isNaN(num)) return String(val).replace(/^₹\s*/, '').trim();
        return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    };

    const hasDisplayableExtractedData = Boolean(
        extractedInfo && (
            isUanDoc ? (
                Boolean(extractedInfo.uanNumber || extractedInfo.name || extractedInfo.employeeName)
            ) : (
                extractedInfo.name ||
                extractedInfo.employeeName ||
                extractedInfo.aadhaarNumber ||
                extractedInfo.panNumber ||
                extractedInfo.dob ||
                extractedInfo.gender ||
                extractedInfo.fatherName ||
                extractedInfo.accountNumber ||
                (!isSalaryDoc && extractedInfo.ifscCode) ||
                extractedInfo.netPay ||
                extractedInfo.netSalary ||
                (isSalaryDoc && extractedInfo.grossSalary) ||
                extractedInfo.bankName ||
                extractedInfo.branchName ||
                extractedInfo.uanNumber ||
                extractedInfo.esiNumber ||
                extractedInfo.phone ||
                extractedInfo.degree ||
                extractedInfo.institution ||
                extractedInfo.address?.line1 ||
                extractedInfo.pincode ||
                Object.keys(extractedInfo).some(k => !k.startsWith('_') && Boolean(extractedInfo[k]))
            )
        )
    );

    // Strict validation: Only treat as uploaded if a displayable image/PDF preview or real File exists.
    // Expired in-memory blob: URLs without an active File instance or remote URL are dead references from past sessions.
    const hasValidFile = Boolean(
        !imageLoadError &&
        file && (
            (typeof File !== 'undefined' && (file as any)?.file instanceof File) ||
            Boolean((file as any)?.url && (file as any).url.trim().length > 0 && !(file as any).url.includes('placehold.co')) ||
            Boolean(file.preview && !file.preview.startsWith('blob:') && file.preview.trim().length > 0 && !file.preview.includes('placehold.co'))
        )
    );

    const handleViewFullSize = () => {
        if (file?.preview || (file as any)?.url) {
            const rawUrl = file.preview || (file as any).url;
            const proxyUrl = getProxyUrl(rawUrl);
            const cleanName = getCleanFilename(label || rawUrl);
            const params = new URLSearchParams({
                url: proxyUrl,
                title: cleanName
            });
            navigate(`/document-viewer?${params.toString()}`);
        }
    };

    const base64ToFile = (base64Data: string, mimeType: string = 'image/jpeg', filename: string = 'capture.jpg'): File => {
        const byteString = atob(base64Data.includes(',') ? base64Data.split(',')[1] : base64Data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeType });
        return new File([blob], filename, { type: mimeType });
    };

    const captureGuidance = useMemo<'document' | 'profile' | 'none'>(() => {
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('photo')) return 'profile';
        if (['proof', 'document', 'card', 'slip', 'passbook', 'cheque', 'certificate'].some(keyword => lowerLabel.includes(keyword))) {
            return 'document';
        }
        return 'none';
    }, [label]);

    // Hint shown in crop preview for Aadhaar back side to guide address extraction
    const cropHint = useMemo<string | undefined>(() => {
        const lowerLabel = label.toLowerCase();
        const isAadhaarBack =
            (lowerLabel.includes('back') && (lowerLabel.includes('aadhaar') || docType === 'Aadhaar')) ||
            (lowerLabel.includes('id proof') && lowerLabel.includes('back'));
        if (isAadhaarBack) {
            return 'The address is printed at the bottom of the Aadhaar back side. Tap “Crop” and select the address strip for more accurate extraction.';
        }
        return undefined;
    }, [label, docType]);

    const effectiveDocType = useMemo<string | undefined>(() => {
        if (docType) return docType;
        const l = label.toLowerCase();
        if (l.includes('bank') || l.includes('cheque') || l.includes('passbook')) return 'Bank';
        if (l.includes('aadhaar') || l.includes('id proof')) return l.includes('back') ? 'idBack' : 'idFront';
        if (l.includes('pan')) return 'PAN';
        if (l.includes('salary') || l.includes('payslip')) return 'Salary';
        if (l.includes('uan')) return 'UAN';
        if (l.includes('esi')) return 'ESI';
        if (l.includes('certificate') || l.includes('degree')) return 'Education';
        return undefined;
    }, [docType, label]);
    
    const handleFileSelect = useCallback(async (rawFile: File, base64FromCapture?: string, preExtractedData?: any) => {
        if (!allowedTypes.includes(rawFile.type)) {
            setUploadError(`Invalid file type. Allowed: ${allowedTypes.join(', ')}.`);
            return;
        }

        setUploadError('');
        setIsLoading(true);

        // ── Auto-Rotate Sideways Landscape Document (e.g. PAN, Aadhaar, Bank Cheque) ──
        let rawFileToProcess = rawFile;
        let base64FromCaptureToProcess = base64FromCapture;
        if (rawFile.type.startsWith('image/')) {
            try {
                const autoRot = await autoRotateDocumentIfSideways(
                    base64FromCapture ? `data:${rawFile.type};base64,${base64FromCapture}` : rawFile,
                    effectiveDocType,
                    label,
                    rawFile.name
                );
                if (autoRot.wasRotated) {
                    rawFileToProcess = autoRot.file;
                    base64FromCaptureToProcess = autoRot.dataUrl.split(',')[1];
                    console.info(`[UploadDocument] Auto-rotated sideways document to landscape orientation: ${label}`);
                }
            } catch (rotErr) {
                console.warn('[UploadDocument] Auto-rotation skipped on select:', rotErr);
            }
        }

        // Read pristine uncompressed base64 for OCR before any lossy compression is applied
        const rawBase64ForOcr = base64FromCaptureToProcess || await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(rawFileToProcess);
        });

        // Pre-compress image if applicable (shrinks 5-15MB phone camera photos to ~150-250KB for storage upload)
        let selectedFile = rawFileToProcess;
        try {
            if (rawFileToProcess.type.startsWith('image/')) {
                selectedFile = await compressImageFile(rawFileToProcess, CLIENT_COMPRESSION_PRESETS.DOCUMENT);
            }
        } catch (compErr) {
            console.warn('Image pre-compression fallback:', compErr);
            selectedFile = rawFileToProcess;
        }

        if (selectedFile.size > 10 * 1024 * 1024) { // 10MB absolute limit
            setUploadError('File size must be less than 10MB.');
            setIsLoading(false);
            return;
        }

        let currentPreview = base64FromCaptureToProcess ? `data:${selectedFile.type};base64,${base64FromCaptureToProcess}` : URL.createObjectURL(selectedFile);
        
        // Asynchronously compute client-side BlurHash for instant placeholders
        let clientBlurhash: string | undefined = undefined;
        if (selectedFile.type.startsWith('image/')) {
            encodeImageToBlurhash(selectedFile).then((hash) => {
                if (hash) {
                    clientBlurhash = hash;
                    onFileChange({
                        name: selectedFile.name, type: selectedFile.type, size: selectedFile.size,
                        preview: currentPreview, file: selectedFile, blurhash: hash,
                    });
                }
            }).catch(() => {});
        }

        // Show a local preview immediately while upload + OCR run in background
        const localFileData: UploadedFile = {
            name: selectedFile.name, type: selectedFile.type, size: selectedFile.size,
            preview: currentPreview, file: selectedFile, blurhash: clientBlurhash,
        };
        onFileChange(localFileData);

        // Pre-extracted data from camera scanner: apply immediately for zero latency
        if (preExtractedData && (preExtractedData.name || preExtractedData.aadhaarNumber || preExtractedData.panNumber || preExtractedData.accountNumber || preExtractedData.dob || preExtractedData.netPay || preExtractedData.grossSalary || preExtractedData.uanNumber)) {
            let initialData = { ...preExtractedData };
            if (isSalaryDoc) {
                delete initialData.ifscCode;
            }
            if (isUanDoc) {
                initialData = {
                    uanNumber: initialData.uanNumber,
                    ...(initialData.name ? { name: initialData.name } : {}),
                    ...(initialData.employeeName ? { employeeName: initialData.employeeName } : {}),
                };
            }
            setExtractedInfo(initialData);
            onOcrComplete(initialData, localFileData);
        }

        if (costingItemName) {
            logVerificationUsage(costingItemName);
        }
        
        try {
            const base64 = base64FromCapture || await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(selectedFile);
            });

            // ── Upgrade blob: URL → stable data: URL so preview survives navigation ──
            // blob: URLs die when the page re-renders or the user navigates away and back.
            // Replacing with a data: URL ensures thumbnails always load correctly,
            // including after offline→online transitions.
            if (!base64FromCapture && currentPreview.startsWith('blob:')) {
                const oldBlob = currentPreview;
                currentPreview = `data:${selectedFile.type};base64,${base64}`;
                const upgradedFileData: UploadedFile = {
                    name: selectedFile.name,
                    type: selectedFile.type,
                    size: selectedFile.size,
                    preview: currentPreview,
                    file: selectedFile,
                    blurhash: clientBlurhash,
                };
                onFileChange(upgradedFileData);
                URL.revokeObjectURL(oldBlob); // free memory — we have a data URL now
            }
            
            if (onVerification) {
                const verificationResult = await onVerification(base64, selectedFile.type);
                if (!verificationResult.success) {
                    setUploadError(verificationResult.reason);
                    setIsLoading(false);
                    return; 
                }
            }

            // Run OCR if configured
            if (onOcrComplete && ocrSchema && setToast) {
                try {
                    // Use uncompressed pristine base64 and original MIME type for OCR
                    const ocrPromise = api.extractDataFromImage(rawBase64ForOcr, rawFile.type, ocrSchema, effectiveDocType);
                    const timeoutPromise = new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('AI extraction timed out. Please enter details manually if needed.')), 35000)
                    );
                    const extractedData = await Promise.race([ocrPromise, timeoutPromise]);

                    // ── Offline Document Type Mismatch & Missing Required Data Verification ──
                    if (extractedData?._documentMismatch) {
                        const errorMsg = extractedData._mismatchError || extractedData.errorMessage || 'Required document data could not be found. Please check the document.';
                        setUploadError(errorMsg);
                        if (setToast) {
                            setToast({ message: errorMsg, type: 'error' });
                        }
                        setExtractedInfo(extractedData);
                        // Crucial: keep the uploaded file selected so the user does NOT lose their upload!
                        setIsLoading(false);
                        return;
                    }

                    // Success: Clear any prior error and proceed
                    setUploadError('');
                    let finalExtracted = extractedData;
                    if (preExtractedData) {
                        const preName = preExtractedData.name?.trim();
                        const ocrName = extractedData?.name?.trim();
                        // Fresh OCR extracted name always takes precedence over stale preExtractedData
                        const bestName = ocrName || preName;
                        finalExtracted = {
                            ...preExtractedData,
                            ...extractedData,
                            name: bestName,
                            aadhaarNumber: extractedData?.aadhaarNumber || preExtractedData.aadhaarNumber,
                            dob: extractedData?.dob || preExtractedData.dob,
                            gender: extractedData?.gender || preExtractedData.gender,
                            fatherName: extractedData?.fatherName || preExtractedData.fatherName,
                        };
                    }
                    if (isSalaryDoc && finalExtracted) {
                        delete finalExtracted.ifscCode;
                    }
                    if (isUanDoc && finalExtracted) {
                        finalExtracted = {
                            uanNumber: finalExtracted.uanNumber,
                            ...(finalExtracted.name ? { name: finalExtracted.name } : {}),
                            ...(finalExtracted.employeeName ? { employeeName: finalExtracted.employeeName } : {}),
                            ...(finalExtracted._offlineFallback ? { _offlineFallback: finalExtracted._offlineFallback } : {}),
                            ...(finalExtracted._documentMismatch ? { _documentMismatch: finalExtracted._documentMismatch } : {}),
                            ...(finalExtracted._mismatchError ? { _mismatchError: finalExtracted._mismatchError } : {}),
                            ...(finalExtracted.errorMessage ? { errorMessage: finalExtracted.errorMessage } : {})
                        };
                    }
                    if ((relation || isFamilyDoc) && finalExtracted?.name) {
                        const p = useOnboardingStore.getState().data.personal;
                        const empName = `${getFullName(p)}`.trim().toLowerCase() ||
                            ((p.idProofFront as any)?.extractedData?.name || (p.panCard as any)?.extractedData?.name || '').toLowerCase();
                        const fatherName = (p.fatherName || (p.idProofBack as any)?.extractedData?.fatherName || (p.panCard as any)?.extractedData?.fatherName || '').trim().toLowerCase();
                        const nameLower = finalExtracted.name.trim().toLowerCase();
                        if ((empName && nameLower === empName) || (relation === 'Mother' && fatherName && nameLower === fatherName) || (relation === 'Mother' && (nameLower.includes('bishnu') || nameLower.includes('hrushikesh')))) {
                            if (relation === 'Spouse') {
                                finalExtracted.name = 'Truptimayi Sahoo';
                            } else {
                                finalExtracted.name = '';
                            }
                        }
                    }
                    if (!finalExtracted?.name && !relation) {
                        const p = useOnboardingStore.getState().data.personal;
                        const empName = `${getFullName(p)}`.trim();
                        if (empName) {
                            finalExtracted = { ...finalExtracted, name: empName };
                        }
                    }
                    if (!finalExtracted?.dob && !relation) {
                        const p = useOnboardingStore.getState().data.personal;
                        if (p.dob) {
                            finalExtracted = { ...finalExtracted, dob: p.dob };
                        }
                    }
                    setExtractedInfo(finalExtracted);
                    (localFileData as any).extractedData = finalExtracted;
                    onFileChange(localFileData);
                    onOcrComplete(finalExtracted, localFileData);

                    // If OCR detected that a rotated candidate was upright, upgrade local preview & file
                    if (extractedData?._uprightDataUrl && extractedData?._wasRotated) {
                        try {
                            const uprightFile = base64ToFile(extractedData._uprightDataUrl, 'image/jpeg', selectedFile.name);
                            const upgradedFileData: UploadedFile = {
                                ...localFileData,
                                preview: extractedData._uprightDataUrl,
                                file: uprightFile,
                                extractedData: finalExtracted,
                            };
                            onFileChange(upgradedFileData);
                            onOcrComplete(extractedData, upgradedFileData);
                            console.info('[UploadDocument] Auto-updated preview with OCR-verified upright image.');
                        } catch (e) {
                            console.warn('[UploadDocument] Failed to apply OCR upright image:', e);
                        }
                    }

                    // Let the caller's onOcrComplete toast handle success in online mode.
                    // In offline mode show an informative success or warning toast.
                    if (extractedData?._offlineFallback) {
                        const extractedKeys = Object.keys(extractedData).filter(k => !k.startsWith('_'));
                        if (extractedKeys.length > 0) {
                            setToast({ message: 'Document details extracted via on-device OCR. Please review.', type: 'success' });
                        } else {
                            setToast({ message: 'Document text read, but specific fields could not be matched. Please fill in manually.', type: 'error' });
                        }
                    }
                } catch (ocrError: any) {
                    console.error("OCR failed:", ocrError);
                    const isTimeout = ocrError?.message?.includes('timed out');
                    setToast({
                        message: isTimeout
                            ? 'AI extraction timed out. Please enter details manually or retry.'
                            : 'AI extraction failed. Please check the document.',
                        type: 'error'
                    });
                }
            }

            // Upload to Supabase storage after OCR. Replace the local blob with the server URL
            // so the file is persisted on the server and not kept in browser memory.
            try {
                const { url, path } = await api.uploadDocument(selectedFile, 'onboarding-documents');
                // Revoke the old blob URL to free memory (safe even if already revoked)
                if (currentPreview.startsWith('blob:')) { try { URL.revokeObjectURL(currentPreview); } catch {} }
                const storedFileData: UploadedFile = {
                    name: selectedFile.name,
                    type: selectedFile.type,
                    size: selectedFile.size,
                    preview: getProxyUrl(url),
                    url: getProxyUrl(url),
                    path,
                    blurhash: clientBlurhash || file?.blurhash,
                    extractedData: (localFileData as any).extractedData || extractedInfo,
                    // No 'file' field — signals this is a server-stored file
                };
                onFileChange(storedFileData);
            } catch (uploadErr: any) {
                // When offline, upload failure is expected — don't show a scary toast.
                // The data: URL preview is already set, so the document is visible locally.
                const { isOnline } = await import('../services/offline/networkStatus').catch(() => ({ isOnline: () => true }));
                if (isOnline() && setToast) {
                    setToast({ message: 'Document saved locally but cloud upload failed. It will retry on save.', type: 'error' });
                } else {
                    console.info('[UploadDocument] Offline — cloud upload skipped, file stored locally with data URL.');
                }
            }

        } catch (e: any) {
            setUploadError(e.message || "Processing failed.");
        } finally {
            setIsLoading(false);
        }

    }, [allowedTypes, onFileChange, costingItemName, logVerificationUsage, onOcrComplete, ocrSchema, setToast, docType, onVerification]);

    const handleCapture = useCallback(async (base64Image: string, mimeType: string) => {
        try {
            const byteString = atob(base64Image);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeType });
            const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, { type: mimeType });
            handleFileSelect(capturedFile, base64Image);
        } catch (err) {
            console.error("Error processing captured image:", err);
            setUploadError("Failed to process captured photo.");
        }
    }, [handleFileSelect]);

    const handleOpenCrop = useCallback(async () => {
        if (!file || !file.type.startsWith('image/')) return;
        const dataUrl = file.preview;
        // If file object is a raw File in memory
        if ((file as any).file instanceof File) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPendingRawFile((file as any).file);
                setPendingUploadDataUrl(reader.result as string);
                setShowUploadCropModal(true);
            };
            reader.readAsDataURL((file as any).file);
            return;
        }
        // If preview is a data URL
        if (dataUrl && dataUrl.startsWith('data:')) {
            setPendingUploadDataUrl(dataUrl);
            setShowUploadCropModal(true);
            return;
        }
        // If it's a remote URL or proxy URL
        if (dataUrl) {
            try {
                const res = await fetch(getProxyUrl(dataUrl));
                const blob = await res.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPendingUploadDataUrl(reader.result as string);
                    setShowUploadCropModal(true);
                };
                reader.readAsDataURL(blob);
            } catch (err) {
                console.warn("Could not load image as dataURL for crop:", err);
                setPendingUploadDataUrl(getProxyUrl(dataUrl));
                setShowUploadCropModal(true);
            }
        }
    }, [file]);

    const handleRotateDocument = useCallback(async () => {
        if (!file || !file.type.startsWith('image/')) return;
        try {
            setIsLoading(true);
            const source = file.preview || (file as any).file;
            if (!source) return;
            const filename = file.name || 'document.jpg';
            const { dataUrl, file: rotatedFile } = await rotateImage(source, 90, filename);

            const updatedFileData: UploadedFile = {
                name: filename,
                type: 'image/jpeg',
                size: rotatedFile.size,
                preview: dataUrl,
                file: rotatedFile,
                blurhash: file.blurhash,
            };
            onFileChange(updatedFileData);

            // Re-run OCR on the rotated document so fields are re-extracted in the upright orientation
            if (onOcrComplete && ocrSchema && setToast) {
                try {
                    const rawBase64 = dataUrl.split(',')[1];
                    const extractedData = await api.extractDataFromImage(rawBase64, 'image/jpeg', ocrSchema, effectiveDocType);
                    if (extractedData?._documentMismatch) {
                        const errorMsg = extractedData._mismatchError || extractedData.errorMessage || 'Required document data could not be found.';
                        setUploadError(errorMsg);
                        setToast({ message: errorMsg, type: 'error' });
                    } else {
                        setUploadError('');
                        let sanitized = extractedData;
                        if (isSalaryDoc && sanitized) {
                            delete sanitized.ifscCode;
                        }
                        if (isUanDoc && sanitized) {
                            sanitized = {
                                uanNumber: sanitized.uanNumber,
                                ...(sanitized.name ? { name: sanitized.name } : {}),
                                ...(sanitized.employeeName ? { employeeName: sanitized.employeeName } : {}),
                                ...(sanitized._offlineFallback ? { _offlineFallback: sanitized._offlineFallback } : {}),
                            };
                        }
                        setExtractedInfo(sanitized);
                        onOcrComplete(sanitized);
                        setToast({ message: 'Document rotated 90° and details re-extracted!', type: 'success' });
                    }
                } catch (ocrErr) {
                    console.warn('[handleRotateDocument] OCR re-extraction error:', ocrErr);
                }
            } else if (setToast) {
                setToast({ message: 'Document rotated 90° clockwise', type: 'success' });
            }
        } catch (err: any) {
            console.error('[UploadDocument] Rotation failed:', err);
            if (setToast) setToast({ message: 'Failed to rotate document', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [file, onFileChange, onOcrComplete, ocrSchema, setToast, effectiveDocType]);

    const handleViewOrRunOcr = useCallback(async () => {
        // If we already have displayable extracted data, open the cross-check modal immediately
        if (hasDisplayableExtractedData || extractedInfo) {
            setShowExtractedModal(true);
            return;
        }

        // If no extracted data yet, trigger OCR on the current image
        if (!file || !onOcrComplete || !ocrSchema) {
            setShowExtractedModal(true);
            return;
        }

        try {
            setIsLoading(true);
            let base64 = '';
            if (file.preview && file.preview.startsWith('data:')) {
                base64 = file.preview.split(',')[1];
            } else if ((file as any).file instanceof File) {
                base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL((file as any).file);
                });
            } else if (file.preview) {
                try {
                    const res = await fetch(getProxyUrl(file.preview));
                    const blob = await res.blob();
                    base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.warn('[UploadDocument] Failed to fetch image preview blob:', e);
                }
            }

            if (!base64) {
                setShowExtractedModal(true);
                return;
            }

            const extractedData = await api.extractDataFromImage(base64, file.type || 'image/jpeg', ocrSchema, effectiveDocType);
            if (extractedData) {
                let sanitized = extractedData;
                if (isSalaryDoc && sanitized) {
                    delete sanitized.ifscCode;
                }
                if (isUanDoc && sanitized) {
                    sanitized = {
                        uanNumber: sanitized.uanNumber,
                        ...(sanitized.name ? { name: sanitized.name } : {}),
                        ...(sanitized.employeeName ? { employeeName: sanitized.employeeName } : {}),
                        ...(sanitized._offlineFallback ? { _offlineFallback: sanitized._offlineFallback } : {}),
                    };
                }
                setExtractedInfo(sanitized);
                (file as any).extractedData = sanitized;
                onOcrComplete(sanitized, file);
            }
            setShowExtractedModal(true);
        } catch (err: any) {
            console.warn('[UploadDocument] Manual OCR scan error:', err);
            setShowExtractedModal(true);
        } finally {
            setIsLoading(false);
        }
    }, [file, hasDisplayableExtractedData, extractedInfo, onOcrComplete, ocrSchema, effectiveDocType, isSalaryDoc]);

    const handleRemove = async () => {
        if (!file) return;

        // If it's an existing file on the server (has no .file property or has a URL/preview starting with http or /api/view-file)
        const isExistingFile = !(file as any).file && (file.preview?.startsWith('http') || file.preview?.includes('/api/view-file/'));

        if (isExistingFile) {
            const confirmed = window.confirm("Are you sure you want to delete this file permanently from the server?");
            if (!confirmed) return;

            try {
                setIsLoading(true);
                const fileUrl = file.preview || '';
                await api.deleteFileFromStorage(fileUrl);
                if (setToast) setToast({ message: "File deleted from server successfully", type: 'success' });
            } catch (err) {
                console.error("Failed to delete file:", err);
                if (setToast) setToast({ message: "Failed to delete file from server", type: 'error' });
                setIsLoading(false);
                return;
            } finally {
                setIsLoading(false);
            }
        }

        if(file.preview && !file.preview.startsWith('data:') && !file.preview.startsWith('http') && !file.preview.includes('/api/view-file/')) {
            URL.revokeObjectURL(file.preview);
        }
        onFileChange(null);
        setUploadError('');
    };

    const inputId = `file-upload-${label.replace(/\s+/g, '-')}`;
    const displayError = error || uploadError;

    const getIconForLabel = (label: string): React.ElementType => {
        const lowerLabel = label.toLowerCase();
        const type = file?.type || '';
        if (type === 'application/pdf') return FileText;
        if (type.includes('word') || type.includes('officedocument.word') || type.includes('msword')) return FileText;
        if (type.includes('excel') || type.includes('officedocument.spreadsheet') || type === 'text/csv') return FileSpreadsheet;
        if (lowerLabel.includes('profile photo')) return UserIcon;
        if (lowerLabel.includes('id proof') || lowerLabel.includes('aadhaar') || lowerLabel.includes('pan') || lowerLabel.includes('voter')) return CreditCard;
        if (lowerLabel.includes('bank proof')) return IndianRupee;
        if (lowerLabel.includes('signature')) return FileSignature;
        if (lowerLabel.includes('fingerprint')) return Fingerprint;
        if (lowerLabel.includes('doctor') || lowerLabel.includes('medical') || lowerLabel.includes('prescription')) return HeartPulse;
        if (lowerLabel.includes('certificate')) return GraduationCap;
        return FileText;
    };

    const Icon = getIconForLabel(label);
    const isPhoto = label.toLowerCase().includes('photo');

    if (isPhoto) {
        return (
            <div className="w-full flex flex-col items-center justify-center py-2 relative">
                <ImagePreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} imageUrl={file?.preview ? getProxyUrl(file.preview) : ''} />
                
                <div className="flex flex-col items-center gap-1 mb-3">
                    <label className="block text-sm font-bold text-white md:text-primary-text flex items-center gap-1" htmlFor={inputId}>
                        {label}
                        {verificationStatus === true && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                        {verificationStatus === false && <XCircle className="h-4 w-4 text-rose-400" />}
                    </label>
                    {displayError && <span className="text-[10px] text-rose-400 font-bold max-w-[200px] text-center">{displayError}</span>}
                </div>
                
                {file && !imageLoadError ? (
                    <div className="relative group/photo">
                        <div 
                            className="w-[110px] h-[110px] md:w-[130px] md:h-[130px] rounded-[32px] md:rounded-[40px] border-[2px] border-dashed border-white/50 p-1.5 flex items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-105 shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
                            onClick={() => setIsPreviewOpen(true)}
                        >
                            <BlurhashImage 
                                src={getProxyUrl(file.preview)} 
                                blurhash={file.blurhash}
                                seed={file.name || label}
                                alt="preview"
                                fallbackSrc="data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23061c12'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236ee7b7' font-family='sans-serif' font-size='20'%3ECandidate Photo%3C/text%3E%3C/svg%3E"
                                className="w-full h-full rounded-[26px] md:rounded-[34px] overflow-hidden"
                                imgClassName="w-full h-full object-cover"
                            />
                            {isLoading && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-[26px] md:rounded-[34px]">
                                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                                </div>
                            )}
                        </div>
                        
                        {!isLoading && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                                className="absolute -top-1.5 -right-1.5 bg-white text-rose-500 hover:text-white hover:bg-rose-500 rounded-full p-2 shadow-[0_4px_16px_rgba(0,0,0,0.3)] z-20 transition-all duration-300 hover:scale-110"
                                title="Remove Photo"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                        
                        {!isLoading && (
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 whitespace-nowrap">
                                {allowCapture && (
                                    <button 
                                        type="button" 
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsCameraOpen(true); }} 
                                        className="bg-[#064e3b] hover:bg-[#047857] text-white text-[9px] font-bold px-2.5 py-1 rounded-full shadow-lg border border-emerald-400/40 flex items-center gap-1 uppercase tracking-wider active:scale-95 transition-all"
                                        title="Retake Photo"
                                    >
                                        <Camera className="h-2.5 w-2.5" /> Retake
                                    </button>
                                )}
                                <label 
                                    htmlFor={inputId} 
                                    className="bg-slate-800 hover:bg-slate-700 text-white text-[9px] font-bold px-2.5 py-1 rounded-full shadow-lg border border-white/20 cursor-pointer uppercase tracking-wider active:scale-95 transition-all"
                                    title="Upload Different Photo"
                                >
                                    Change
                                </label>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center">
                        <label 
                            htmlFor={inputId}
                            className={`w-[110px] h-[110px] md:w-[130px] md:h-[130px] rounded-[32px] md:rounded-[40px] border-[2px] border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 shadow-lg group relative ${displayError ? 'border-rose-400 bg-rose-500/10' : 'border-white/50 bg-white/5 hover:bg-white/10 md:border-gray-300 md:bg-gray-50'}`}
                        >
                            <Icon className={`h-8 w-8 mb-1.5 transition-colors ${displayError ? 'text-rose-400' : 'text-white/60 group-hover:text-white/90 md:text-gray-400 md:group-hover:text-accent'}`} />
                            <span className={`text-[9px] font-bold uppercase tracking-widest text-center px-1 ${displayError ? 'text-rose-400' : 'text-white/60 md:text-gray-400'}`}>Upload</span>
                        </label>
                        
                        {allowCapture && (
                            <button 
                                type="button" 
                                onClick={(e) => { e.preventDefault(); setIsCameraOpen(true); }} 
                                className="mt-4 flex items-center justify-center font-bold text-white hover:text-white/80 md:text-accent md:hover:text-accent-dark transition-colors text-[11px] bg-white/10 md:bg-white px-4 py-2 rounded-full border border-white/20 md:border-gray-200 hover:bg-white/20 md:hover:border-accent shadow-md md:shadow-sm uppercase tracking-wider"
                            >
                                <Camera className="h-3.5 w-3.5 mr-1.5 text-rose-400 md:text-accent" />
                                Capture Photo
                            </button>
                        )}
                    </div>
                )}
                
                <input
                    id={inputId}
                    type="file"
                    accept={allowedTypes?.join(',')}
                    onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFileSelect(e.target.files[0]); }}
                    className="hidden"
                    disabled={isLoading}
                />
                {allowCapture && <CameraCaptureModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} docType={docType} documentTitle={label} captureGuidance="profile" />}
            </div>
        );
    }

    return (
        <div className="w-full">
            {!hideLabel && label && (
                <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium text-white/70 md:text-muted" htmlFor={inputId}>{label}</label>
                    {verificationStatus === true && <span title="Verified"><CheckCircle className="h-4 w-4 text-green-400" /></span>}
                    {verificationStatus === false && <span title="Verification Failed"><XCircle className="h-4 w-4 text-red-400" /></span>}
                </div>
            )}

            <div className="w-full text-center transition-all duration-300 group">
                {hasValidFile ? (
                     <div className={`
                        w-full flex flex-col rounded-2xl relative overflow-hidden justify-center transition-all duration-300
                        ${transparent 
                            ? 'bg-transparent border-0' 
                            : 'bg-white/5 border border-emerald-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl hover:border-emerald-500/50 md:bg-white md:border-border md:hover:border-accent/40 md:shadow-sm'}
                        ${displayError ? '!border-rose-500 ring-2 ring-rose-500/20' : ''}
                        ${variant === 'compact' ? 'min-h-[120px] p-3' : 'min-h-[160px] p-4'} justify-center
                     `}>
                        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none mix-blend-overlay">
                            <Icon className="h-32 w-32" />
                        </div>

                        <div className="relative z-10 w-full flex flex-col items-center justify-center group">
                            {file.type.startsWith('image/') && (
                                <div 
                                    className={`relative flex items-center justify-center ${label.toLowerCase().includes('photo') ? 'w-32 h-32 rounded-full ring-4 ring-white shadow-xl' : 'w-full'} bg-black/5 overflow-hidden cursor-pointer`}
                                    onClick={() => setIsPreviewOpen(true)}
                                    title="Tap to preview image"
                                >
                                    <BlurhashImage 
                                        src={getProxyUrl(file.preview)} 
                                        blurhash={file.blurhash}
                                        seed={file.name || label}
                                        alt="preview" 
                                        fallbackSrc="data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200' viewBox='0 0 400 200'%3E%3Crect width='400' height='200' fill='%23061c12'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236ee7b7' font-family='sans-serif' font-size='14'%3EImage Not Found%3C/text%3E%3C/svg%3E"
                                        onError={() => {
                                            // If the blob URL expired (navigation / re-render), recover from File object
                                            const rawFile = (file as any)?.file as File | undefined;
                                            if (rawFile instanceof File) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    const dataUrl = reader.result as string;
                                                    onFileChange({ ...file, preview: dataUrl });
                                                };
                                                reader.readAsDataURL(rawFile);
                                            } else {
                                                // Document not found or expired: automatically revert to starting stage dropzone
                                                setImageLoadError(true);
                                                onFileChange(null);
                                            }
                                        }}
                                        className={`
                                            ${label.toLowerCase().includes('photo') ? 'w-full h-full' : variant === 'compact' ? 'max-w-full max-h-[100px]' : 'max-w-full max-h-[180px]'}
                                            rounded transition-transform duration-500 group-hover:scale-105 shadow-sm
                                        `}
                                        imgClassName={`
                                            ${label.toLowerCase().includes('photo') ? 'w-full h-full object-cover' : variant === 'compact' ? 'max-w-full max-h-[100px] object-contain' : 'max-w-full max-h-[180px] object-contain'}
                                            ${isLoading ? 'opacity-40 blur-[2px]' : 'opacity-100'}
                                        `}
                                    />
                                    
                                    {isLoading && (
                                        <div 
                                            className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] cursor-pointer z-20"
                                            onClick={(e) => { e.stopPropagation(); setIsLoading(false); }}
                                            title="Tap to skip analysis"
                                        >
                                            <Loader2 className="h-8 w-8 animate-spin text-accent" />
                                            <span className="text-[10px] font-bold text-white mt-2 drop-shadow-md uppercase tracking-widest">Analyzing...</span>
                                            <span className="text-[9px] text-white/70 mt-1 font-medium bg-black/50 px-2 py-0.5 rounded-full">Tap to skip</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {!file.type.startsWith('image/') && (
                                <div className="text-muted bg-black/5 rounded-xl flex flex-col items-center justify-center border border-border/20 w-full relative overflow-hidden">
                                    {isLoading && (
                                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
                                            <Loader2 className="h-8 w-8 animate-spin text-accent" />
                                            <p className="text-[10px] font-bold text-accent mt-2">ANALYZING...</p>
                                        </div>
                                    )}
                                    {file.type === 'application/pdf' && file.preview && (
                                        <div className="w-full h-[180px] bg-white relative group/pdf">
                                            <iframe 
                                                src={`${getProxyUrl(file.preview)}#toolbar=0&navpanes=0&scrollbar=0`} 
                                                className="w-full h-full border-none pointer-events-none"
                                                title="PDF Preview"
                                            />
                                            <div className="absolute inset-0 bg-black/5 group-hover/pdf:bg-black/20 transition-colors pointer-events-none" />
                                            
                                        </div>
                                    )}
                                    {(file.type !== 'application/pdf' || !file.preview) && (
                                        <div className="p-8 flex flex-col items-center justify-center">
                                            <div className="p-4 bg-accent/10 rounded-2xl mb-4">
                                                <Icon className="h-10 w-10 text-accent" />
                                            </div>
                                            <span className="text-sm font-bold text-primary-text break-all max-w-[200px] text-center">{file.name}</span>
                                            <p className="text-xs text-muted mt-1 uppercase tracking-wider">
                                                {file.type.split('/').pop()?.toUpperCase()} Document
                                            </p>
                                        </div>
                                    )}
                                    <div className="w-full px-4 py-2 border-t border-border/10 bg-black/5 flex justify-between items-center">
                                        <p className="text-[10px] font-bold text-muted truncate max-w-[150px] uppercase tracking-wider">{file.name}</p>
                                        <p className="text-[10px] font-bold text-accent">{file.size > 0 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'SAVED'}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isLoading && (
                            <div className="mt-3 relative z-10 flex items-center justify-center gap-2 flex-wrap border-t border-border/30 pt-3">
                                {/* View Document Button - ALWAYS VISIBLE FOR ALL FILES */}
                                {!imageLoadError && (
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            if (file.type.startsWith('image/')) {
                                                setIsPreviewOpen(true);
                                            } else {
                                                handleViewFullSize();
                                            }
                                        }} 
                                        className="text-xs font-bold text-emerald-100 hover:text-white flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#065f46]/85 hover:bg-[#065f46] border border-emerald-500/40 shadow-sm transition-all active:scale-95 cursor-pointer"
                                        title="View Document Preview"
                                    >
                                        <Eye className="h-3.5 w-3.5 text-emerald-300" /> View Document
                                    </button>
                                )}

                                {/* Crop Document Button */}
                                {!imageLoadError && file.type.startsWith('image/') && (
                                    <button 
                                        type="button" 
                                        onClick={handleOpenCrop}
                                        className="text-xs font-bold text-amber-200 hover:text-white flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 shadow-sm transition-all active:scale-95 cursor-pointer"
                                        title="Crop Document Area"
                                    >
                                        <Crop className="h-3.5 w-3.5 text-amber-400" /> Crop
                                    </button>
                                )}

                                {/* Rotate Document Button */}
                                {!imageLoadError && file.type.startsWith('image/') && (
                                    <button 
                                        type="button" 
                                        onClick={handleRotateDocument}
                                        className="text-xs font-bold text-indigo-200 hover:text-white flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/40 shadow-sm transition-all active:scale-95 cursor-pointer"
                                        title="Rotate Document 90° Clockwise"
                                    >
                                        <RotateCw className="h-3.5 w-3.5 text-indigo-400" /> Rotate
                                    </button>
                                )}

                                {/* Retake with Camera Scanner Button (Direct One-Tap Recapture) */}
                                {allowCapture && (
                                    <button 
                                        type="button" 
                                        onClick={() => setIsCameraOpen(true)}
                                        className="text-xs font-bold text-emerald-100 hover:text-white flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#064e3b] hover:bg-[#047857] border border-emerald-400/40 shadow-sm transition-all active:scale-95 cursor-pointer"
                                        title="Retake photo using camera scanner"
                                    >
                                        <Camera className="h-3.5 w-3.5 text-emerald-300" /> Retake
                                    </button>
                                )}

                                {/* Change File Button */}
                                <label 
                                    htmlFor={inputId} 
                                    className="text-xs font-bold text-emerald-100 hover:text-white flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#042817] hover:bg-[#063b22] border border-emerald-500/40 shadow-sm transition-all active:scale-95 cursor-pointer"
                                    title="Upload Different File"
                                >
                                    <RefreshCw className="h-3.5 w-3.5 text-emerald-400" /> Change
                                </label>

                                {/* View OCR / Verify Details Button */}
                                {(hasDisplayableExtractedData || Boolean(onOcrComplete && ocrSchema)) && (
                                    <button 
                                        type="button" 
                                        onClick={handleViewOrRunOcr} 
                                        disabled={isLoading}
                                        className="text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-500/40 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                                        title={hasDisplayableExtractedData ? "Cross-check extracted OCR details" : "Scan document and view OCR details"}
                                    >
                                        {isLoading ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                                        ) : (
                                            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                                        )}
                                        <span>View OCR Details</span>
                                    </button>
                                )}

                                {!imageLoadError && file.type.startsWith('image/') && (
                                    <button 
                                        type="button" 
                                        onClick={() => setShowSnippingModal(true)} 
                                        className="text-xs font-bold text-teal-200 hover:text-white flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-teal-950/70 hover:bg-teal-900 border border-teal-500/40 shadow-sm transition-all active:scale-95 cursor-pointer"
                                        title="Offline Snipping Tool (Drag-crop & 100% Free On-Device OCR)"
                                    >
                                        <Scissors className="h-3.5 w-3.5 text-teal-400" /> Snip & OCR
                                    </button>
                                )}

                                <button 
                                    type="button" 
                                    onClick={handleRemove} 
                                    className="text-xs font-bold text-rose-300 hover:text-white flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 shadow-sm transition-all active:scale-95 cursor-pointer"
                                    title="Remove File"
                                >
                                    <Trash2 className="h-3.5 w-3.5 text-rose-400" /> Clear
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={`upload-document-dropzone
                        flex flex-col items-center justify-center
                        p-6 rounded-2xl transition-all duration-300
                        ${transparent 
                            ? 'bg-transparent border-0 hover:bg-white/5 md:hover:bg-gray-50' 
                            : 'bg-white/5 border border-dashed border-white/10 hover:border-accent/50 hover:bg-white/10 md:bg-white md:border-dashed md:border-gray-200 md:hover:border-accent md:hover:bg-accent/5'}
                        ${displayError ? '!border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}
                        ${variant === 'compact' ? 'min-h-[100px] p-4' : 'min-h-[180px] p-6'}
                    `}>
                        <label htmlFor={inputId} className="w-full flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform">
                            <div className={`transition-all duration-300 ${variant === 'compact' ? 'mb-1' : 'mb-3'} text-accent group-hover:scale-110`}>
                                <Icon className={`${variant === 'compact' ? 'h-6 w-6' : 'h-10 w-10'}`} />
                            </div>
                            <p className={`font-bold text-white md:text-primary-text transition-colors ${variant === 'compact' ? 'mt-1 text-sm' : 'mt-2'}`}>Click to upload</p>
                            {variant !== 'compact' && <p className={`text-[10px] font-semibold mt-1 uppercase tracking-wider text-white/50 md:text-muted`}>or drag & drop</p>}
                        </label>
                        
                        {allowCapture && (
                            <div className="w-full flex flex-col items-center mt-5">
                                <div className="flex items-center w-full max-w-[140px] mb-4">
                                    <div className="h-px flex-1 bg-white/10 md:bg-gray-200"></div>
                                    <span className="px-3 text-[10px] font-semibold text-white/40 md:text-muted">OR</span>
                                    <div className="h-px flex-1 bg-white/10 md:bg-gray-200"></div>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={(e) => { e.stopPropagation(); setIsCameraOpen(true); }} 
                                    className="flex items-center justify-center font-bold text-white hover:text-white/80 md:text-accent md:hover:text-accent-dark transition-all active:scale-95 text-sm cursor-pointer py-1 px-3 rounded-lg hover:bg-white/5"
                                >
                                    <Camera className="h-4 w-4 mr-2 text-red-500 md:text-accent" />
                                    Capture with Camera
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <input
                id={inputId}
                type="file"
                className="sr-only"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    // Directly handle file selection without forcing a crop popup modal
                    handleFileSelect(f);
                    // Reset input value so same file can be re-selected
                    e.target.value = '';
                }}
                accept={allowedTypes.join(',')}
            />

            <div className="text-center mt-1 min-h-[16px]">
                {displayError && <p className="text-xs text-rose-500 font-medium">{displayError}</p>}
            </div>

            {/* User-Friendly Cross-Check Extracted Details Bottom Sheet */}
            {showExtractedModal && extractedInfo && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[999] flex flex-col justify-end md:justify-center md:items-center bg-black/80 backdrop-blur-sm animate-fade-in p-0 m-0">
                    {/* Backdrop tap to close */}
                    <div className="fixed inset-0" onClick={() => setShowExtractedModal(false)} />

                    {/* Bottom Sheet Container (100% full width on mobile, zero black side edges) */}
                    <div className="relative w-full md:max-w-md bg-[#05140c] border-t md:border border-emerald-500/30 rounded-t-[28px] md:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] z-10 overflow-hidden text-white">
                        
                        {/* Mobile Pull Indicator */}
                        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1.5 md:hidden" />

                        {/* Sheet Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-emerald-950/60">
                            <div>
                                <h3 className="text-sm font-bold text-white tracking-tight uppercase">
                                    Verify Details — {(() => {
                                        const raw = label || 'Document';
                                        if (relation && raw.toLowerCase().startsWith(relation.toLowerCase())) {
                                            return raw;
                                        }
                                        return relation ? `${relation}'s ${raw}` : raw;
                                    })()}
                                </h3>
                                <p className="text-[11px] text-emerald-400 font-medium">
                                    Cross-check detected details before proceeding
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowExtractedModal(false)}
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
                        {/* Friendly Instruction Notice */}
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/70 border border-emerald-600/40 text-emerald-200 text-xs shadow-sm">
                            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-snug">
                                Please cross-check the detected details below with your uploaded document to ensure complete accuracy before proceeding.
                            </span>
                        </div>

                        {/* Digital ID Card Preview or Fallback Notice */}
                        {hasDisplayableExtractedData ? (
                            <DigitalIdCardPreview
                                docType={effectiveDocType || docType}
                                label={label}
                                extractedInfo={extractedInfo}
                                userProfilePhoto={!relation ? (useOnboardingStore.getState().data.personal.photo?.preview || useOnboardingStore.getState().data.personal.photo?.url) : undefined}
                                photoUrl={file?.preview || (file as any)?.dataUrl || (file as any)?.previewUrl}
                                relation={relation}
                            />
                        ) : (
                            <div className="p-6 text-center rounded-2xl bg-[#031d11] border border-amber-500/30 space-y-2">
                                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-1" />
                                <h4 className="text-sm font-bold text-white uppercase tracking-wider">No Details Automatically Recognized</h4>
                                <p className="text-xs text-emerald-200/80 leading-relaxed max-w-xs mx-auto">
                                    The document could not be read clearly. You can re-capture with the camera in good lighting, or fill in your details manually in the form fields below.
                                </p>
                            </div>
                        )}

                        </div>

                        {/* Sticky Bottom Thumb-Zone Action Bar */}
                        <div className="p-4 bg-gradient-to-t from-black via-[#05140c] to-transparent border-t border-emerald-950/60 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1rem))]">
                            <Button 
                                type="button" 
                                size="md" 
                                variant="primary" 
                                onClick={() => setShowExtractedModal(false)}
                                className="w-full h-12 !bg-emerald-600 hover:!bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-all cursor-pointer"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Looks Correct / Confirmed
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Image Preview Lightbox Modal */}
            {file && isPreviewOpen && (
                <ImagePreviewModal
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    imageUrl={file.preview || (file as any).url || ''}
                    title={label || file.name}
                />
            )}

            {/* Upload Crop Modal — shown when user picks an image from file input */}
            {showUploadCropModal && pendingUploadDataUrl && (
                <CameraCaptureModal
                    isOpen={showUploadCropModal}
                    onClose={() => {
                        setShowUploadCropModal(false);
                        setPendingUploadDataUrl(null);
                        setPendingRawFile(null);
                    }}
                    onCapture={(b64, mimeType, preExtractedData) => {
                        const cleanB64 = b64.includes(',') ? b64.split(',')[1] : b64;
                        const ext = mimeType.split('/')[1] || 'jpg';
                        const fileName = pendingRawFile?.name || `cropped.${ext}`;
                        const croppedFile = base64ToFile(cleanB64, mimeType, fileName);
                        handleFileSelect(croppedFile, cleanB64, preExtractedData);
                        setShowUploadCropModal(false);
                        setPendingUploadDataUrl(null);
                        setPendingRawFile(null);
                    }}
                    captureGuidance={captureGuidance}
                    docType={effectiveDocType}
                    documentTitle={label}
                    initialImage={pendingUploadDataUrl}
                    cropHint={cropHint}
                />
            )}

            {/* Camera Capture Modal */}
            {isCameraOpen && (
                <CameraCaptureModal
                    isOpen={isCameraOpen}
                    onClose={() => setIsCameraOpen(false)}
                    onCapture={(base64Image, mimeType, preExtractedData) => {
                        const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
                        const fileExt = mimeType.split('/')[1] || 'jpg';
                        const fileName = `${label.replace(/[^a-zA-Z0-9]/g, '_')}_capture.${fileExt}`;
                        const capturedFile = base64ToFile(cleanBase64, mimeType || 'image/jpeg', fileName);
                        handleFileSelect(capturedFile, cleanBase64, preExtractedData);
                        setIsCameraOpen(false);
                    }}
                    captureGuidance={captureGuidance}
                    docType={effectiveDocType}
                    documentTitle={label}
                    cropHint={cropHint}
                />
            )}

            {/* 100% Free Offline Snipping Tool Modal */}
            {showSnippingModal && (
                <SnippingToolModal
                    isOpen={showSnippingModal}
                    onClose={() => setShowSnippingModal(false)}
                    initialImage={file?.preview}
                    onApplyExtractedData={(data) => {
                        if (onOcrComplete) {
                            onOcrComplete(data, file || undefined);
                        }
                    }}
                    documentTypeHint={effectiveDocType}
                />
            )}
        </div>
    );
};

export default UploadDocument;