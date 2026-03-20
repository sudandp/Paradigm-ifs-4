import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, AlertCircle, Wrench, ShieldCheck, Search, CheckCircle, 
    Camera, MapPin, Clock, ArrowRight, ArrowLeft, Loader2,
    Check, Plus, Trash2, FileText, Info, Activity, Users, 
    Award, MessagesSquare, ClipboardCheck, ChevronDown
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { 
    ChecklistTemplate, ChecklistSection, ChecklistItem, 
    FieldReport, FieldReportResponse, FieldReportEvidence,
    FieldReportJobType
} from '../../types';
import Button from '../ui/Button';
import CameraCaptureModal from '../CameraCaptureModal';
import { format } from 'date-fns';

interface SmartFieldReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reportId: string, summary: string, workType: 'office' | 'field') => Promise<void>;
    isLoading: boolean;
}

type ReportStep = 'context' | 'checklist' | 'evidence' | 'summary';

const SmartFieldReportModal: React.FC<SmartFieldReportModalProps> = ({ 
    isOpen, onClose, onConfirm, isLoading 
}) => {
    const { user, lastCheckInTime } = useAuthStore();
    
    // --- State ---
    const [step, setStep] = useState<ReportStep>('context');
    const [jobType, setJobType] = useState<FieldReportJobType>('PPM');
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
    const [activeTemplate, setActiveTemplate] = useState<ChecklistTemplate | null>(null);
    const [isFetchingTemplate, setIsFetchingTemplate] = useState(false);
    
    // Context Data
    const [siteName, setSiteName] = useState('');
    const [assetArea, setAssetArea] = useState('');
    
    // Checklist Responses
    // Key: item_id
    const [responses, setResponses] = useState<Record<string, FieldReportResponse>>({});
    
    // Evidence
    const [evidence, setEvidence] = useState<FieldReportEvidence[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [activeCameraTarget, setActiveCameraTarget] = useState<string | null>(null); // item_id or 'general'
    
    // Summary
    const [userRemarks, setUserRemarks] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- Effects ---
    
    // 1. Fetch templates when jobType changes or modal opens
    useEffect(() => {
        if (isOpen) {
            fetchTemplates();
            // Auto-populate site name from user's last session or location if available
            // For now, we'll let the user type or we can infer from the last check-in event.
            if (lastCheckInTime) {
                // In a real app, we'd fetch the location name from the database for that event
                setSiteName('Current Site'); 
            }
        }
    }, [isOpen, jobType]);

    const fetchTemplates = async () => {
        setIsFetchingTemplate(true);
        try {
            const data = await api.getChecklistTemplates(jobType);
            setTemplates(data);
            if (data.length > 0) {
                setActiveTemplate(data[0]);
                // Initialize responses based on items
                const initialResponses: Record<string, FieldReportResponse> = {};
                data[0].sections.forEach(section => {
                    section.items.forEach(item => {
                        initialResponses[item.id] = { value: item.type === 'yes_no_na' ? '' : item.type === 'numeric' ? 0 : '' };
                    });
                });
                setResponses(initialResponses);
            }
        } catch (err) {
            console.error('Failed to fetch templates:', err);
            setError('Failed to load checklist. Please check your connection.');
        } finally {
            setIsFetchingTemplate(false);
        }
    };

    // --- Logic ---

    const handleJobTypeChange = (type: string) => {
        setJobType(type as FieldReportJobType);
        setStep('context'); // Reset if they change job type
    };

    const handleResponseChange = (itemId: string, value: string | number) => {
        setResponses(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], value }
        }));
    };

    const handleResponseRemarks = (itemId: string, remarks: string) => {
        setResponses(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], remarks }
        }));
    };

    const handleBack = () => {
        const steps: ReportStep[] = ['context', 'checklist', 'evidence', 'summary'];
        const currIdx = steps.indexOf(step);
        if (currIdx > 0) setStep(steps[currIdx - 1]);
    };

    const handleNext = () => {
        if (step === 'summary') {
            handleSubmit();
            return;
        }
        const steps: ReportStep[] = ['context', 'checklist', 'evidence', 'summary'];
        const currIdx = steps.indexOf(step);
        if (currIdx < steps.length - 1) setStep(steps[currIdx + 1]);
    };

    const addEvidence = () => {
        setActiveCameraTarget('general');
        setIsCameraOpen(true);
    };

    const handleConditionalResponseChange = (itemId: string, field: string, value: any) => {
        setResponses(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field === 'photos' ? 'photoUrls' : field]: value
            }
        }));
    };
    const handleCapture = async (base64: string, mime: string) => {
        // In a real app, we'd upload to Supabase Storage here and get a URL
        // For this demo, we'll use the base64 string as the URL.
        const newEvidence: FieldReportEvidence = {
            url: base64,
            type: 'image',
            timestamp: new Date().toISOString(),
            category: 'general'
        };

        if (activeCameraTarget && activeCameraTarget !== 'general') {
            // Attach to a specific checklist item
            setResponses(prev => ({
                ...prev,
                [activeCameraTarget]: {
                    ...prev[activeCameraTarget],
                    photoUrls: [...(prev[activeCameraTarget].photoUrls || []), base64]
                }
            }));
        } else {
            setEvidence(prev => [...prev, newEvidence]);
        }
        setIsCameraOpen(false);
    };

    const removeEvidence = (index: number) => {
        setEvidence(prev => prev.filter((_, i) => i !== index));
    };

    const removePhotoFromItem = (itemId: string, photoIndex: number) => {
        setResponses(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                photoUrls: prev[itemId].photoUrls?.filter((_, i) => i !== photoIndex)
            }
        }));
    };

    // --- Validation ---
    
    const isStepValid = useMemo(() => {
        if (step === 'context') {
            return siteName.trim().length > 0 && assetArea.trim().length > 0;
        }
        if (step === 'checklist') {
            if (!activeTemplate) return false;
            // Check all mandatory items
            for (const section of activeTemplate.sections) {
                for (const item of section.items) {
                    if (item.required) {
                        const resp = responses[item.id];
                        if (!resp || resp.value === '') return false;
                        // If 'No', check if they provided remarks and at least one photo (per requirement)
                        if (item.type === 'yes_no_na' && resp.value === 'No') {
                            if (!resp.remarks || resp.remarks.trim().length < 5) return false;
                            if (!resp.photoUrls || resp.photoUrls.length === 0) return false;
                        }
                    }
                }
            }
            return true;
        }
        if (step === 'evidence') {
            return true; // Optional general evidence
        }
        return true;
    }, [step, siteName, assetArea, activeTemplate, responses]);

    const generatedSummary = useMemo(() => {
        if (!activeTemplate) return '';
        const lines = [`Site: ${siteName}`, `Job: ${jobType}`, `Asset: ${assetArea}`, ''];
        activeTemplate.sections.forEach(section => {
            lines.push(`-- ${section.title} --`);
            section.items.forEach(item => {
                const resp = responses[item.id];
                lines.push(`${item.label}: ${resp?.value || 'N/A'}`);
                if (resp?.remarks) lines.push(`   Note: ${resp.remarks}`);
            });
            lines.push('');
        });
        return lines.join('\n');
    }, [activeTemplate, siteName, jobType, assetArea, responses]);

    const handleSubmit = async () => {
        if (!user || !activeTemplate) return;
        
        setIsSubmitting(true);
        setError(null);

        try {
            const report: Partial<FieldReport> = {
                templateId: activeTemplate.id,
                userId: user.id,
                siteName,
                jobType,
                assetArea,
                visitStartTime: lastCheckInTime || new Date().toISOString(),
                visitEndTime: new Date().toISOString(),
                responses,
                evidence,
                summary: generatedSummary,
                userRemarks,
                createdAt: new Date().toISOString()
            };

            const savedReport = await api.submitFieldReport(report);
            await onConfirm(savedReport.id!, generatedSummary, 'field');
            onClose();
        } catch (err: any) {
            console.error('Submission failed:', err);
            setError(err.message || 'Failed to submit report. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    // --- Render Helpers ---

    const renderStepIndicator = () => {
        const steps: { key: ReportStep; label: string }[] = [
            { key: 'context', label: 'Context' },
            { key: 'checklist', label: 'Checklist' },
            { key: 'evidence', label: 'Evidence' },
            { key: 'summary', label: 'Review' }
        ];

        return (
            <div className="flex items-center justify-between px-6 py-6 border-b border-border bg-gray-50/50">
                {steps.map((s, i) => {
                    const isActive = step === s.key;
                    const isCompleted = steps.findIndex(st => st.key === step) > i;
                    
                    return (
                        <React.Fragment key={s.key}>
                            <div className="flex flex-col items-center gap-2">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                                    isActive ? 'bg-accent text-white shadow-[0_0_20px_rgba(0,107,63,0.3)] scale-110' : 
                                    isCompleted ? 'bg-accent/20 text-accent' : 'bg-muted/10 text-muted'
                                }`}>
                                    {isCompleted ? <Check className="h-5 w-5" /> : i + 1}
                                </div>
                                <span className={`text-xs uppercase tracking-widest font-bold transition-colors duration-300 ${isActive ? 'text-accent' : 'text-muted'}`}>
                                    {s.label}
                                </span>
                            </div>
                            {i < steps.length - 1 && (
                                <div className={`flex-1 h-[2px] mx-4 -mt-6 transition-all duration-500 ${
                                    steps.findIndex(st => st.key === step) > i ? 'bg-accent/30' : 'bg-border/50'
                                }`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 md:p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity" onClick={onClose}></div>
            
            {/* Modal Content */}
            <div className="relative w-full h-full md:h-[85vh] md:max-w-2xl bg-card border-x md:border border-border md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border bg-gray-50/30">
                    <div>
                        <h3 className="text-xl font-bold text-primary-text tracking-tight">Field Report Redesign</h3>
                        <p className="text-xs text-accent font-medium uppercase tracking-widest mt-0.5">Verified Audit Shield</p>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-muted hover:bg-gray-100 rounded-full transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {renderStepIndicator()}

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    
                    {error && (
                        <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex gap-3 text-rose-400 text-sm animate-in slide-in-from-top-2">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <p className="font-medium">{error}</p>
                        </div>
                    )}

                    {step === 'context' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-accent/5 border border-accent/10 rounded-2xl p-4 flex gap-4">
                                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                                    <Info className="h-5 w-5 text-accent" />
                                </div>
                                <div>
                                    <p className="text-sm text-primary-text font-medium">Smart Context Initialization</p>
                                    <p className="text-xs text-muted leading-relaxed mt-1">
                                        Select the job type to load specific checklists. Site and time details are automatically captured.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-sm font-bold text-muted ml-1 uppercase tracking-wider">Purpose of Visit</label>
                                <div className="relative group">
                                    <Activity className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted group-focus-within:text-accent transition-colors pointer-events-none" />
                                    <select 
                                        value={jobType}
                                        onChange={(e) => handleJobTypeChange(e.target.value)}
                                        className="w-full bg-gray-50 border border-border rounded-2xl py-4 pl-12 pr-12 text-primary-text font-medium focus:ring-2 focus:ring-accent/10 focus:border-accent/50 transition-all outline-none appearance-none"
                                    >
                                        <option value="PPM">PPM (Preventive Maintenance)</option>
                                        <option value="Breakdown/Repair">Breakdown / Repair</option>
                                        <option value="Site Training">Site Training</option>
                                        <option value="Site Visit">Site Visit</option>
                                        <option value="Meeting with Association">Meeting with Association</option>
                                        <option value="Site Inspection">Site Inspection</option>
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-600 pointer-events-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-muted ml-1 uppercase tracking-wider">Site Name</label>
                                    <div className="relative group">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted group-focus-within:text-accent transition-colors" />
                                        <input 
                                            type="text"
                                            value={siteName}
                                            onChange={(e) => setSiteName(e.target.value)}
                                            className="w-full bg-gray-50 border border-border rounded-2xl py-4 pl-12 pr-4 text-primary-text font-medium focus:ring-2 focus:ring-accent/10 focus:border-accent/50 transition-all outline-none"
                                            placeholder="Enter Site Name"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-muted ml-1 uppercase tracking-wider">Asset / Area</label>
                                    <div className="relative group">
                                        <Wrench className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted group-focus-within:text-accent transition-colors" />
                                        <input 
                                            type="text"
                                            value={assetArea}
                                            onChange={(e) => setAssetArea(e.target.value)}
                                            className="w-full bg-gray-50 border border-border rounded-2xl py-4 pl-12 pr-4 text-primary-text font-medium focus:ring-2 focus:ring-accent/10 focus:border-accent/50 transition-all outline-none"
                                            placeholder="e.g., AHU-01, Server Room"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 border border-border rounded-2xl p-5 flex items-center justify-between text-muted text-sm font-medium">
                                <div className="flex items-center gap-3">
                                    <Clock className="h-5 w-5 text-accent/50" />
                                    <span>Started: {lastCheckInTime ? format(new Date(lastCheckInTime), 'HH:mm') : '--:--'}</span>
                                </div>
                                <div className="h-4 w-[1px] bg-border" />
                                <div className="flex items-center gap-3">
                                    <Clock className="h-5 w-5 text-accent/50" />
                                    <span>Ends: {format(new Date(), 'HH:mm')}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'checklist' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            {isFetchingTemplate ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="h-10 w-10 animate-spin text-accent mb-4" />
                                    <p className="text-muted font-medium tracking-wide">Loading Checklist Engine...</p>
                                </div>
                            ) : activeTemplate?.sections.map((section, sIdx) => (
                                <div key={section.id} className="space-y-4">
                                    <div className="flex items-center gap-3 px-1">
                                        <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center">
                                            {section.icon === 'Tool' && <Wrench className="h-4 w-4 text-accent" />}
                                            {section.icon === 'ShieldCheck' && <ShieldCheck className="h-4 w-4 text-accent" />}
                                            {section.icon === 'Search' && <Search className="h-4 w-4 text-accent" />}
                                            {section.icon === 'CheckCircle' && <CheckCircle className="h-4 w-4 text-accent" />}
                                            {section.icon === 'Activity' && <Activity className="h-4 w-4 text-accent" />}
                                            {section.icon === 'Users' && <Users className="h-4 w-4 text-accent" />}
                                            {section.icon === 'Award' && <Award className="h-4 w-4 text-accent" />}
                                            {section.icon === 'MapPin' && <MapPin className="h-4 w-4 text-accent" />}
                                            {section.icon === 'MessagesSquare' && <MessagesSquare className="h-4 w-4 text-accent" />}
                                            {section.icon === 'ClipboardCheck' && <ClipboardCheck className="h-4 w-4 text-accent" />}
                                        </div>
                                        <h4 className="text-sm font-bold text-primary-text uppercase tracking-widest">{section.title}</h4>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {section.items.map(item => {
                                            const resp = responses[item.id];
                                            const isNo = item.type === 'yes_no_na' && resp?.value === 'No';
                                            
                                            return (
                                                <div key={item.id} className={`p-5 rounded-3xl border transition-all ${
                                                    resp?.value ? 'bg-accent/5 border-accent/20' : 'bg-gray-50 border-border'
                                                }`}>
                                                    <div className="flex items-start justify-between gap-4 mb-4">
                                                        <p className="text-sm font-bold text-primary-text leading-relaxed">{item.label}</p>
                                                        {item.required && <span className="text-xs bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full font-bold uppercase tracking-wider">Required</span>}
                                                    </div>

                                                    {item.type === 'yes_no_na' && (
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {['Yes', 'No', 'N/A'].map(opt => (
                                                                <button
                                                                    key={opt}
                                                                    onClick={() => handleResponseChange(item.id, opt)}
                                                                    className={`py-3 px-4 rounded-xl font-bold text-sm transition-all border ${
                                                                        resp?.value === opt 
                                                                            ? opt === 'Yes' ? 'bg-accent border-accent text-white shadow-lg shadow-accent/40' :
                                                                              opt === 'No' ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-900/40' :
                                                                              'bg-gray-500 border-gray-500 text-white'
                                                                            : 'md:bg-white bg-gray-50 border-border text-muted hover:text-primary-text'
                                                                    }`}
                                                                >
                                                                    {opt}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {item.type === 'numeric' && (
                                                        <div className="flex items-center gap-3">
                                                            <input 
                                                                type="number"
                                                                value={resp?.value || ''}
                                                                onChange={(e) => handleResponseChange(item.id, e.target.value)}
                                                                className="flex-1 bg-gray-50 border border-border rounded-xl px-4 py-2 text-primary-text font-medium focus:ring-2 focus:ring-accent/10 focus:border-accent/50 transition-all outline-none"
                                                                placeholder="Enter value"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Conditional "No" Section */}
                                                    {isNo && (
                                                        <div className="mt-4 space-y-4 pt-4 border-t border-border animate-in slide-in-from-top-2">
                                                            <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4 flex gap-3 text-rose-500 text-xs font-bold uppercase tracking-wider mb-2">
                                                                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                                                <span>Action Block: Reason, Remarks & Photo Mandatory</span>
                                                            </div>
                                                            <div className="flex flex-col gap-3">
                                                                <textarea 
                                                                    value={resp?.remarks || ''}
                                                                    onChange={(e) => handleConditionalResponseChange(item.id, 'remarks', e.target.value)}
                                                                    placeholder="Describe the issue / corrective action / reason for 'No'..."
                                                                    className="w-full bg-gray-50 border border-border rounded-xl py-3 px-4 text-primary-text text-sm focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500/50 outline-none h-24 resize-none"
                                                                />
                                                                <div className="flex flex-wrap gap-2">
                                                                    {(resp?.photoUrls || []).map((p, idx) => (
                                                                        <div key={idx} className="relative h-16 w-16 rounded-xl overflow-hidden border border-border">
                                                                            <img src={p} className="h-full w-full object-cover" />
                                                                            <button 
                                                                                onClick={() => {
                                                                                    const newPhotos = [...(resp?.photoUrls || [])];
                                                                                    newPhotos.splice(idx, 1);
                                                                                    handleConditionalResponseChange(item.id, 'photos', newPhotos);
                                                                                }}
                                                                                className="absolute top-0 right-0 p-1 bg-black/50 text-white"
                                                                            >
                                                                                <X size={12} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    <button 
                                                                        onClick={() => {
                                                                            setActiveCameraTarget(item.id);
                                                                            setIsCameraOpen(true);
                                                                        }}
                                                                        className="h-16 w-16 rounded-xl border-2 border-dashed border-border bg-gray-50 flex flex-col items-center justify-center text-muted hover:text-accent hover:border-accent/30 transition-all"
                                                                    >
                                                                        <Camera className="h-6 w-6 mb-1" />
                                                                        <span className="text-[10px] font-bold uppercase">Add Photo</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {step === 'evidence' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                           <div className="bg-accent/5 border border-accent/10 rounded-2xl p-5 flex gap-4">
                                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                                    <Camera className="h-6 w-6 text-accent" />
                                </div>
                                <div>
                                    <p className="text-sm text-primary-text font-bold uppercase tracking-wider">Visual Verification</p>
                                    <p className="text-xs text-muted leading-relaxed mt-1">
                                        Attach high-quality photos of the asset, site condition, or any issues identified for the audit trail.
                                    </p>
                                </div>
                            </div>

                            <button 
                                onClick={addEvidence}
                                className="w-full py-8 border-2 border-dashed border-border rounded-[2rem] bg-gray-50 flex flex-col items-center justify-center text-muted hover:text-accent hover:border-accent/40 transition-all group"
                            >
                                <div className="h-16 w-16 rounded-full bg-accent/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <Camera className="h-8 w-8 text-accent" />
                                </div>
                                <span className="text-sm font-bold uppercase tracking-widest">Add Evidence Photo</span>
                                <span className="text-[10px] text-muted mt-1 uppercase">Max 10MB per unit</span>
                            </button>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {evidence.map((ev, idx) => (
                                    <div key={idx} className="group relative aspect-square rounded-3xl overflow-hidden border border-border bg-card">
                                        <img src={ev.url} alt="Evidence" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
                                                 <span className="text-xs text-white font-bold uppercase tracking-wider">{format(new Date(ev.timestamp), 'HH:mm')}</span>
                                                <button 
                                                    onClick={() => removeEvidence(idx)}
                                                    className="p-1.5 bg-rose-500/80 rounded-lg text-white"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'summary' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-muted ml-1 uppercase tracking-wider">Auto-Generated Summary</label>
                                 <div className="bg-gray-50 border border-border rounded-2xl p-6 font-mono text-xs text-accent font-bold leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {generatedSummary}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="block text-sm font-bold text-muted uppercase tracking-wider">User Remarks</label>
                                     <span className={`text-xs font-bold ${userRemarks.length > 300 ? 'text-rose-500' : 'text-muted'}`}>
                                        {userRemarks.length} / 300
                                    </span>
                                </div>
                                <textarea 
                                    value={userRemarks}
                                    onChange={(e) => setUserRemarks(e.target.value.slice(0, 300))}
                                    placeholder="Add any additional notes or technical observations..."
                                    className="w-full bg-gray-50 border border-border rounded-2xl p-5 text-primary-text text-sm focus:ring-2 focus:ring-accent/10 focus:border-accent/50 transition-all outline-none h-32 resize-none"
                                />
                            </div>

                            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 flex gap-4">
                                <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                    <ShieldCheck className="h-6 w-6 text-amber-600" />
                                </div>
                                <p className="text-xs text-amber-800 leading-relaxed font-semibold uppercase tracking-widest mt-1">
                                    Submission will lock this report and generate a cryptographically-verifiable audit trail for your manager.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-gray-50/50 flex gap-4">
                    {step !== 'context' && (
                        <button 
                            onClick={handleBack}
                            className="flex-1 py-4 px-6 rounded-2xl font-bold text-muted bg-white border border-border hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="h-5 w-5" />
                            <span>Back</span>
                        </button>
                    )}
                    
                    <button 
                        onClick={handleNext}
                        disabled={!isStepValid || isLoading || isSubmitting}
                        className={`flex-[2] py-4 px-8 rounded-2xl font-bold text-white transition-all transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-3 ${
                            isStepValid 
                                ? 'bg-accent hover:bg-accent-dark shadow-accent/20' 
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-100'
                        }`}
                    >
                        {(isLoading || isSubmitting) ? (
                             <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <span>{step === 'summary' ? 'Seal & Submit' : 'Next Step'}</span>
                                <ArrowRight className="h-5 w-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>

            <CameraCaptureModal 
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onCapture={handleCapture}
            />
        </div>
    );
};

export default SmartFieldReportModal;
