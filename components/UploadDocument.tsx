import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProxyUrl, getCleanFilename } from '../utils/fileUrl';
import type { UploadedFile } from '../types';
import { UploadCloud, File as FileIcon, X, RefreshCw, Camera, Loader2, AlertTriangle, CheckCircle, Eye, Trash2, BadgeInfo, CreditCard, User as UserIcon, FileText, FileSignature, IndianRupee, GraduationCap, Fingerprint, XCircle, Maximize2, FileBarChart, FileSpreadsheet, FileArchive } from 'lucide-react';
import { api } from '../services/api';
import Button from './ui/Button';
import CameraCaptureModal from './CameraCaptureModal';
import { useAuthStore } from '../store/authStore';
import ImagePreviewModal from './modals/ImagePreviewModal';
import { useOnboardingStore } from '../store/onboardingStore';

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
}) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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

    const captureGuidance = useMemo(() => {
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('photo')) return 'profile';
        if (['proof', 'document', 'card', 'slip', 'passbook', 'cheque', 'certificate'].some(keyword => lowerLabel.includes(keyword))) {
            return 'document';
        }
        return 'none';
    }, [label]);
    
    const handleFileSelect = useCallback(async (selectedFile: File, base64FromCapture?: string) => {
        if (!allowedTypes.includes(selectedFile.type)) {
            setUploadError(`Invalid file type. Allowed: ${allowedTypes.join(', ')}.`);
            return;
        }
        if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
            setUploadError('File size must be less than 5MB.');
            return;
        }

        setUploadError('');
        setIsLoading(true);

        const preview = base64FromCapture ? `data:${selectedFile.type};base64,${base64FromCapture}` : URL.createObjectURL(selectedFile);
        
        const fileData: UploadedFile = {
            name: selectedFile.name, type: selectedFile.type, size: selectedFile.size,
            preview, file: selectedFile,
        };
        onFileChange(fileData);

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
            
            if (onVerification) {
                const verificationResult = await onVerification(base64, selectedFile.type);
                if (!verificationResult.success) {
                    setUploadError(verificationResult.reason);
                    setIsLoading(false);
                    return; 
                }
            }

            if (onOcrComplete && ocrSchema && setToast) {
                try {
                    const extractedData = await api.extractDataFromImage(base64, selectedFile.type, ocrSchema, docType);
                    onOcrComplete(extractedData);
                } catch (ocrError: any) {
                    console.error("OCR failed:", ocrError);
                    setToast({ message: `AI extraction failed. Please check the document.`, type: 'error' });
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

    const handleRemove = () => {
        if(file && file.preview && !file.preview.startsWith('data:')) URL.revokeObjectURL(file.preview);
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
        if (lowerLabel.includes('certificate')) return GraduationCap;
        return FileText;
    };

    const Icon = getIconForLabel(label);

    return (
        <div className="w-full">
            <ImagePreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} imageUrl={file?.preview || ''} />
            {isCameraOpen && <CameraCaptureModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} captureGuidance={captureGuidance} autoConfirm={true} />}

            <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-muted" htmlFor={inputId}>{label}</label>
                {verificationStatus === true && <span title="Verified"><CheckCircle className="h-4 w-4 text-green-400" /></span>}
                {verificationStatus === false && <span title="Verification Failed"><XCircle className="h-4 w-4 text-red-400" /></span>}
            </div>

            <div className="w-full text-center transition-all duration-300">
                {file ? (
                     <div className={`
                        w-full flex flex-col p-4 border-2 border-dashed rounded-lg bg-page/50 relative overflow-hidden
                        border-accent/30 pro-dark-theme:bg-accent/5 pro-dark-theme:border-accent/40
                        ${variant === 'compact' ? 'min-h-[100px]' : 'min-h-[160px]'} justify-center
                     `}>
                        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none">
                            <Icon className="h-32 w-32" />
                        </div>

                        <div className="relative z-10 w-full flex flex-col items-center justify-center group">
                            {file.type.startsWith('image/') && (
                                 <div className={`relative flex items-center justify-center ${label.toLowerCase().includes('photo') ? 'w-32 h-32 rounded-full ring-4 ring-white shadow-xl' : 'w-full'} bg-black/5 overflow-hidden`}>
                                    <img 
                                        src={file.preview} 
                                        alt="preview" 
                                        className={`
                                            ${label.toLowerCase().includes('photo') ? 'w-full h-full object-cover' : variant === 'compact' ? 'max-w-full max-h-[80px] object-contain' : 'max-w-full max-h-[180px] object-contain'}
                                            rounded transition-transform duration-500 group-hover:scale-105 shadow-sm
                                            ${isLoading ? 'opacity-40 blur-[2px]' : 'opacity-100'}
                                        `} 
                                    />
                                    {!isLoading && (
                                        <label htmlFor={inputId} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                            <div className="bg-white/20 backdrop-blur-md p-3 rounded-full transform scale-90 group-hover:scale-100 transition-transform">
                                                <RefreshCw className="h-6 w-6 text-white" />
                                            </div>
                                        </label>
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
                                                src={`${file.preview}#toolbar=0&navpanes=0&scrollbar=0`} 
                                                className="w-full h-full border-none pointer-events-none"
                                                title="PDF Preview"
                                            />
                                            <div className="absolute inset-0 bg-black/5 group-hover/pdf:bg-black/20 transition-colors pointer-events-none" />
                                            {!isLoading && (
                                                <label htmlFor={inputId} className="absolute inset-0 opacity-0 group-hover/pdf:opacity-100 transition-opacity flex items-center justify-center cursor-pointer bg-black/40">
                                                    <div className="bg-white/20 backdrop-blur-md p-3 rounded-full transform scale-90 group-hover/pdf:scale-100 transition-transform">
                                                        <RefreshCw className="h-6 w-6 text-white" />
                                                    </div>
                                                </label>
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
                                            {!isLoading && (
                                                <label htmlFor={inputId} className="mt-4 text-xs font-bold bg-accent text-white px-5 py-2 rounded-full cursor-pointer hover:bg-accent-dark transition-all shadow-sm active:scale-95">
                                                    Change File
                                                </label>
                                            )}
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
                            <div className="mt-3 relative z-10 flex items-center justify-center gap-4 border-t border-border/30 pt-3">
                                {!file.type.startsWith('image/') && (
                                    <button type="button" onClick={handleViewFullSize} className="text-xs font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 transition-colors">
                                        <Eye className="h-3.5 w-3.5" /> View Document
                                    </button>
                                )}
                                <button type="button" onClick={handleRemove} className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 transition-colors">
                                    <Trash2 className="h-3.5 w-3.5" /> Clear
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <label htmlFor={inputId} className={`
                        cursor-pointer flex flex-col items-center justify-center
                        p-6 border-2 border-dashed rounded-lg transition-all duration-300
                        bg-page/30 border-border hover:border-accent hover:bg-accent-light
                        pro-dark-theme:border-accent/30 pro-dark-theme:hover:border-accent pro-dark-theme:bg-accent/5
                        ${displayError ? '!border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : ''}
                        ${variant === 'compact' ? 'min-h-[100px] p-4' : 'min-h-[180px] p-6'}
                    `}>
                        <div className={`${variant === 'compact' ? 'p-2' : 'p-4'} bg-accent/5 rounded-full text-accent pro-dark-theme:bg-accent/10`}>
                            <Icon className={`${variant === 'compact' ? 'h-6 w-6' : 'h-10 w-10'}`} />
                        </div>
                        <p className={`font-bold text-primary-text ${variant === 'compact' ? 'mt-2 text-sm' : 'mt-3'}`}>Click to upload</p>
                        {variant !== 'compact' && <p className="text-xs text-muted mt-1 uppercase tracking-wider">or drag & drop</p>}
                        
                        {allowCapture && (
                            <div className="w-full flex flex-col items-center mt-4">
                                <div className="flex items-center w-full max-w-[120px] mb-4">
                                    <div className="h-px flex-1 bg-border/50"></div>
                                    <span className="px-3 text-[10px] font-bold text-muted/60">OR</span>
                                    <div className="h-px flex-1 bg-border/50"></div>
                                </div>
                                <Button 
                                    type="button" 
                                    onClick={(e) => { e.preventDefault(); setIsCameraOpen(true); }} 
                                    variant="secondary" 
                                    size="sm"
                                    className="!rounded-full font-bold shadow-sm">
                                    <Camera className="h-4 w-4 mr-2 text-accent" />
                                    Capture with Camera
                                </Button>
                            </div>
                        )}
                    </label>
                )}
            </div>
            
            <input id={inputId} type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} accept={allowedTypes.join(',')}/>
            
            <div className="text-center mt-1 min-h-[16px]">
                {displayError && <p className="text-xs text-red-500">{displayError}</p>}
            </div>
        </div>
    );
};

export default UploadDocument;