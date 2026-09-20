import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProxyUrl, getCleanFilename } from '../utils/fileUrl';
import type { UploadedFile } from '../types';
import { UploadCloud, File as FileIcon, X, RefreshCw, Camera, Loader2, AlertTriangle, CheckCircle, Eye, Trash2, BadgeInfo, CreditCard, User as UserIcon, FileText, FileSignature, IndianRupee, GraduationCap, Fingerprint, XCircle, Maximize2, FileBarChart, FileSpreadsheet, FileArchive, HeartPulse, Crop, RotateCw } from 'lucide-react';
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

interface UploadDocumentProps {
  label: string;
  file: UploadedFile | undefined | null;
  onFileChange: (file: UploadedFile | null) => void;
  allowedTypes?: string[];
  error?: string;
  allowCapture?: boolean;
  costingItemName?: string;
  verificationStatus?: boolean | null;
  onOcrComplete?: (data: any) => void;
  ocrSchema?: any;
  setToast?: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  docType?: string;
  onVerification?: (base64: string, mimeType: string) => Promise<{ success: boolean; reason: string }>;
  variant?: 'default' | 'compact';
  transparent?: boolean;
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
}) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [extractedInfo, setExtractedInfo] = useState<any>(null);
    const [showExtractedModal, setShowExtractedModal] = useState(false);
    // Crop-on-upload state — holds pending image before user crops & confirms
    const [showUploadCropModal, setShowUploadCropModal] = useState(false);
    const [pendingUploadDataUrl, setPendingUploadDataUrl] = useState<string | null>(null);
    const [pendingRawFile, setPendingRawFile] = useState<File | null>(null);
    const { logVerificationUsage } = useOnboardingStore.getState();

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
    
    const handleFileSelect = useCallback(async (rawFile: File, base64FromCapture?: string) => {
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

        const preview = base64FromCaptureToProcess ? `data:${selectedFile.type};base64,${base64FromCaptureToProcess}` : URL.createObjectURL(selectedFile);
        
        // Asynchronously compute client-side BlurHash for instant placeholders
        let clientBlurhash: string | undefined = undefined;
        if (selectedFile.type.startsWith('image/')) {
            encodeImageToBlurhash(selectedFile).then((hash) => {
                if (hash) {
                    clientBlurhash = hash;
                    onFileChange({
                        name: selectedFile.name, type: selectedFile.type, size: selectedFile.size,
                        preview, file: selectedFile, blurhash: hash,
                    });
                }
            }).catch(() => {});
        }

        // Show a local preview immediately while upload + OCR run in background
        const localFileData: UploadedFile = {
            name: selectedFile.name, type: selectedFile.type, size: selectedFile.size,
            preview, file: selectedFile, blurhash: clientBlurhash,
        };
        onFileChange(localFileData);

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
            if (!base64FromCapture && preview.startsWith('blob:')) {
                const stableDataUrl = `data:${selectedFile.type};base64,${base64}`;
                const upgradedFileData: UploadedFile = {
                    name: selectedFile.name,
                    type: selectedFile.type,
                    size: selectedFile.size,
                    preview: stableDataUrl,
                    file: selectedFile,
                    blurhash: clientBlurhash,
                };
                onFileChange(upgradedFileData);
                URL.revokeObjectURL(preview); // free memory — we have a data URL now
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
                    const extractedData = await api.extractDataFromImage(rawBase64ForOcr, rawFile.type, ocrSchema, effectiveDocType);

                    // ── Offline Document Type Mismatch & Missing Required Data Verification ──
                    if (extractedData?._documentMismatch || extractedData?._requiredDataMissing) {
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
                    setExtractedInfo(extractedData);
                    onOcrComplete(extractedData);

                    // If OCR detected that a rotated candidate was upright, upgrade local preview & file
                    if (extractedData?._uprightDataUrl && extractedData?._wasRotated) {
                        try {
                            const uprightFile = base64ToFile(extractedData._uprightDataUrl, 'image/jpeg', selectedFile.name);
                            onFileChange({
                                ...localFileData,
                                preview: extractedData._uprightDataUrl,
                                file: uprightFile,
                            });
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
                    setToast({ message: `AI extraction failed. Please check the document.`, type: 'error' });
                }
            }

            // Upload to Supabase storage after OCR. Replace the local blob with the server URL
            // so the file is persisted on the server and not kept in browser memory.
            try {
                const { url, path } = await api.uploadDocument(selectedFile, 'onboarding-documents');
                // Revoke the old blob URL to free memory (safe even if already revoked)
                if (preview.startsWith('blob:')) { try { URL.revokeObjectURL(preview); } catch {} }
                const storedFileData: UploadedFile = {
                    name: selectedFile.name,
                    type: selectedFile.type,
                    size: selectedFile.size,
                    preview: getProxyUrl(url),
                    url: getProxyUrl(url),
                    path,
                    blurhash: clientBlurhash || file?.blurhash,
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
                    if (extractedData?._documentMismatch || extractedData?._requiredDataMissing) {
                        const errorMsg = extractedData._mismatchError || extractedData.errorMessage || 'Required document data could not be found.';
                        setUploadError(errorMsg);
                        setToast({ message: errorMsg, type: 'error' });
                    } else {
                        setUploadError('');
                        setExtractedInfo(extractedData);
                        onOcrComplete(extractedData);
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
                
                {file ? (
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
                                fallbackSrc="https://placehold.co/400x400?text=Photo"
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
                            <label 
                                htmlFor={inputId} 
                                className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-lg border border-white/20 cursor-pointer opacity-0 group-hover/photo:opacity-100 transition-opacity hover:bg-slate-700 uppercase tracking-wider"
                            >
                                Change
                            </label>
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
            <ImagePreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} imageUrl={file?.preview ? getProxyUrl(file.preview) : ''} />

            <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-white/70 md:text-muted" htmlFor={inputId}>{label}</label>
                {verificationStatus === true && <span title="Verified"><CheckCircle className="h-4 w-4 text-green-400" /></span>}
                {verificationStatus === false && <span title="Verification Failed"><XCircle className="h-4 w-4 text-red-400" /></span>}
            </div>

            <div className="w-full text-center transition-all duration-300 group">
                {file ? (
                     <div className={`
                        w-full flex flex-col rounded-2xl relative overflow-hidden justify-center transition-all duration-300
                        ${transparent 
                            ? 'bg-transparent border-0' 
                            : 'bg-white/5 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-xl hover:border-white/30 md:bg-white md:border-border md:hover:border-accent/40 md:shadow-sm'}
                        ${displayError ? '!border-rose-500 ring-2 ring-rose-500/20' : ''}
                        ${variant === 'compact' ? 'min-h-[120px] p-3' : 'min-h-[160px] p-4'} justify-center
                     `}>
                        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none mix-blend-overlay">
                            <Icon className="h-32 w-32" />
                        </div>

                        <div className="relative z-10 w-full flex flex-col items-center justify-center group">
                            {file.type.startsWith('image/') && (
                                 <div className={`relative flex items-center justify-center ${label.toLowerCase().includes('photo') ? 'w-32 h-32 rounded-full ring-4 ring-white shadow-xl' : 'w-full'} bg-black/5 overflow-hidden`}>
                                    <BlurhashImage 
                                        src={getProxyUrl(file.preview)} 
                                        blurhash={file.blurhash}
                                        seed={file.name || label}
                                        alt="preview" 
                                        fallbackSrc="https://placehold.co/400x200?text=Image+Not+Found"
                                        onError={() => {
                                            // If the blob URL expired (navigation / re-render), recover from File object
                                            const rawFile = (file as any).file as File | undefined;
                                            if (rawFile instanceof File) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    const dataUrl = reader.result as string;
                                                    onFileChange({ ...file, preview: dataUrl });
                                                };
                                                reader.readAsDataURL(rawFile);
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
                                    {!isLoading && (
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setIsPreviewOpen(true); }}
                                                className="p-2.5 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-all transform scale-90 group-hover:scale-100 shadow-lg"
                                                title="View Full Size"
                                            >
                                                <Eye className="h-5 w-5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleOpenCrop(); }}
                                                className="p-2.5 bg-amber-600/80 hover:bg-amber-600 backdrop-blur-md rounded-full text-white transition-all transform scale-90 group-hover:scale-100 shadow-lg cursor-pointer"
                                                title="Crop Image"
                                            >
                                                <Crop className="h-5 w-5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleRotateDocument(); }}
                                                className="p-2.5 bg-indigo-600/80 hover:bg-indigo-600 backdrop-blur-md rounded-full text-white transition-all transform scale-90 group-hover:scale-100 shadow-lg cursor-pointer"
                                                title="Rotate 90° Clockwise"
                                            >
                                                <RotateCw className="h-5 w-5" />
                                            </button>
                                            <label
                                                htmlFor={inputId}
                                                className="p-2.5 bg-emerald-600/80 hover:bg-emerald-600 backdrop-blur-md rounded-full text-white transition-all transform scale-90 group-hover:scale-100 shadow-lg cursor-pointer"
                                                title="Change File"
                                            >
                                                <RefreshCw className="h-5 w-5" />
                                            </label>
                                        </div>
                                    )}
                                    {isLoading && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 backdrop-blur-[1px]">
                                            <Loader2 className="h-8 w-8 animate-spin text-accent" />
                                            <span className="text-[10px] font-bold text-white mt-2 drop-shadow-md uppercase tracking-widest">Analyzing...</span>
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
                                            {!isLoading && (
                                                <div className="absolute inset-0 opacity-0 group-hover/pdf:opacity-100 transition-opacity flex items-center justify-center gap-2 bg-black/40">
                                                    <button
                                                        type="button"
                                                        onClick={handleViewFullSize}
                                                        className="p-2.5 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-all transform scale-90 group-hover/pdf:scale-100 shadow-lg"
                                                        title="View PDF"
                                                    >
                                                        <Eye className="h-5 w-5" />
                                                    </button>
                                                    <label htmlFor={inputId} className="p-2.5 bg-emerald-600/80 hover:bg-emerald-600 backdrop-blur-md rounded-full text-white transition-all transform scale-90 group-hover/pdf:scale-100 shadow-lg cursor-pointer" title="Change PDF">
                                                        <RefreshCw className="h-5 w-5" />
                                                    </label>
                                                </div>
                                            )}
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
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        if (file.type.startsWith('image/')) {
                                            setIsPreviewOpen(true);
                                        } else {
                                            handleViewFullSize();
                                        }
                                    }} 
                                    className="text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 hover:bg-sky-100 border border-sky-200 shadow-2xs transition-all"
                                    title="View Document Preview"
                                >
                                    <Eye className="h-3.5 w-3.5 text-sky-600" /> View Document
                                </button>

                                {/* Crop Document Button - Available for images whenever user needs to crop */}
                                {file.type.startsWith('image/') && (
                                    <button 
                                        type="button" 
                                        onClick={handleOpenCrop}
                                        className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 shadow-2xs transition-all"
                                        title="Crop Document Area"
                                    >
                                        <Crop className="h-3.5 w-3.5 text-amber-600" /> Crop
                                    </button>
                                )}

                                {/* Rotate Document Button - 1-tap 90° clockwise rotation */}
                                {file.type.startsWith('image/') && (
                                    <button 
                                        type="button" 
                                        onClick={handleRotateDocument}
                                        className="text-xs font-bold text-indigo-700 hover:text-indigo-800 flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow-2xs transition-all cursor-pointer"
                                        title="Rotate Document 90° Clockwise"
                                    >
                                        <RotateCw className="h-3.5 w-3.5 text-indigo-600" /> Rotate
                                    </button>
                                )}

                                {/* Change File Button */}
                                <label 
                                    htmlFor={inputId} 
                                    className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-2xs transition-all cursor-pointer"
                                    title="Upload Different File"
                                >
                                    <RefreshCw className="h-3.5 w-3.5 text-slate-500" /> Change
                                </label>

                                {extractedInfo && (
                                    <button 
                                        type="button" 
                                        onClick={() => setShowExtractedModal(true)} 
                                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-2xs transition-all"
                                    >
                                        <BadgeInfo className="h-3.5 w-3.5 text-emerald-600" /> OCR Data
                                    </button>
                                )}

                                <button 
                                    type="button" 
                                    onClick={handleRemove} 
                                    className="text-xs font-bold text-rose-700 hover:text-rose-800 flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 shadow-2xs transition-all"
                                    title="Remove File"
                                >
                                    <Trash2 className="h-3.5 w-3.5 text-rose-600" /> Clear
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <label htmlFor={inputId} className={`upload-document-dropzone
                        cursor-pointer flex flex-col items-center justify-center
                        p-6 rounded-2xl transition-all duration-300
                        ${transparent 
                            ? 'bg-transparent border-0 hover:bg-white/5 md:hover:bg-gray-50' 
                            : 'bg-white/5 border border-dashed border-white/10 hover:border-accent/50 hover:bg-white/10 md:bg-white md:border-dashed md:border-gray-200 md:hover:border-accent md:hover:bg-accent/5'}
                        ${displayError ? '!border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}
                        ${variant === 'compact' ? 'min-h-[100px] p-4' : 'min-h-[180px] p-6'}
                    `}>
                        <div className={`transition-all duration-300 ${variant === 'compact' ? 'mb-1' : 'mb-3'} text-accent group-hover:scale-110`}>
                            <Icon className={`${variant === 'compact' ? 'h-6 w-6' : 'h-10 w-10'}`} />
                        </div>
                        <p className={`font-bold text-white md:text-primary-text transition-colors ${variant === 'compact' ? 'mt-1 text-sm' : 'mt-2'}`}>Click to upload</p>
                        {variant !== 'compact' && <p className={`text-[10px] font-semibold mt-1 uppercase tracking-wider text-white/50 md:text-muted`}>or drag & drop</p>}
                        
                        {allowCapture && (
                            <div className="w-full flex flex-col items-center mt-5">
                                <div className="flex items-center w-full max-w-[140px] mb-4">
                                    <div className="h-px flex-1 bg-white/10 md:bg-gray-200"></div>
                                    <span className="px-3 text-[10px] font-semibold text-white/40 md:text-muted">OR</span>
                                    <div className="h-px flex-1 bg-white/10 md:bg-gray-200"></div>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={(e) => { e.preventDefault(); setIsCameraOpen(true); }} 
                                    className="flex items-center justify-center font-bold text-white hover:text-white/80 md:text-accent md:hover:text-accent-dark transition-colors text-sm"
                                >
                                    <Camera className="h-4 w-4 mr-2 text-red-500 md:text-accent" />
                                    Capture with Camera
                                </button>
                            </div>
                        )}
                    </label>
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

            {/* Extracted OCR Inspection Modal */}
            {showExtractedModal && extractedInfo && (
                <Modal isOpen={showExtractedModal} onClose={() => setShowExtractedModal(false)} title={`Extracted Data Inspection — ${label}`}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
                            <span className="text-xs font-bold text-gray-700">OCR Engine Used:</span>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${extractedInfo._offlineFallback ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {extractedInfo._offlineFallback ? '📵 On-Device Tesseract.js (Offline)' : '⚡ Gemini 2.5 Flash AI (Online)'}
                            </span>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Structured Form Fields Extracted:</h4>
                            <div className="bg-gray-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-60">
                                <pre>{JSON.stringify(
                                    Object.fromEntries(Object.entries(extractedInfo).filter(([k]) => !k.startsWith('_'))), 
                                    null, 2
                                )}</pre>
                            </div>
                        </div>

                        {extractedInfo._rawText && (
                            <div>
                                <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Raw Recognized OCR Text:</h4>
                                <div className="bg-gray-100 text-gray-800 p-3 rounded-xl font-mono text-xs overflow-y-auto max-h-40 whitespace-pre-wrap border border-gray-200">
                                    {extractedInfo._rawText}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <Button type="button" size="sm" onClick={() => setShowExtractedModal(false)}>Close</Button>
                        </div>
                    </div>
                </Modal>
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
                    onCapture={(b64, mimeType) => {
                        const cleanB64 = b64.includes(',') ? b64.split(',')[1] : b64;
                        const ext = mimeType.split('/')[1] || 'jpg';
                        const fileName = pendingRawFile?.name || `cropped.${ext}`;
                        const croppedFile = base64ToFile(cleanB64, mimeType, fileName);
                        handleFileSelect(croppedFile, cleanB64);
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
                    onCapture={(base64Image, mimeType) => {
                        const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
                        const fileExt = mimeType.split('/')[1] || 'jpg';
                        const fileName = `${label.replace(/[^a-zA-Z0-9]/g, '_')}_capture.${fileExt}`;
                        const capturedFile = base64ToFile(cleanBase64, mimeType || 'image/jpeg', fileName);
                        handleFileSelect(capturedFile, cleanBase64);
                        setIsCameraOpen(false);
                    }}
                    captureGuidance={captureGuidance}
                    docType={effectiveDocType}
                    documentTitle={label}
                    cropHint={cropHint}
                />
            )}
        </div>
    );
};

export default UploadDocument;