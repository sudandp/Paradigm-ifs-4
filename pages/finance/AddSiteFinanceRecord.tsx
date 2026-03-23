import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import type { SiteFinanceRecord, SiteInvoiceDefault, Organization } from '../../types';
import { useForm, Controller } from 'react-hook-form';
import { ArrowLeft, Save, Building, Loader2, IndianRupee, MapPin, Calendar, ClipboardList, Wallet } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { format, startOfMonth } from 'date-fns';
import LoadingScreen from '../../components/ui/LoadingScreen';


const AddSiteFinanceRecord: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditing = !!id;
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [sites, setSites] = useState<Organization[]>([]);
    const [trackerSites, setTrackerSites] = useState<{ id: string; name: string }[]>([]);
    const [siteDefaults, setSiteDefaults] = useState<SiteInvoiceDefault[]>([]);
    const [activeDefault, setActiveDefault] = useState<SiteInvoiceDefault | null>(null);
    const [currentUser, setCurrentUser] = useState<{ id: string, name: string, role: string } | null>(null);
    const [recordMetadata, setRecordMetadata] = useState<{ createdBy?: string, createdByName?: string, createdAt?: string, updatedBy?: string, updatedByName?: string, updatedAt?: string } | null>(null);

    const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<Partial<SiteFinanceRecord>>({
        defaultValues: {
            contractAmount: '' as any,
            contractManagementFee: '' as any,
            billedAmount: '' as any,
            billedManagementFee: '' as any,
            status: 'pending',
            billingMonth: format(startOfMonth(new Date()), 'yyyy-MM-dd')
        }
    });

    const [contractAmount, contractManagementFee, billedAmount, billedManagementFee] = watch(['contractAmount', 'contractManagementFee', 'billedAmount', 'billedManagementFee']);
    
    // Derived values
    const cAmount = Number(contractAmount) || 0;
    const cFee = Number(contractManagementFee) || 0;
    const bAmount = Number(billedAmount) || 0;
    const bFee = Number(billedManagementFee) || 0;

    const billingDiff = bAmount - cAmount;
    const feeDiff = bFee - cFee;
    const totalDiff = billingDiff + feeDiff;
    const isProfit = totalDiff >= 0;

    // Auto-calculate total for submission
    useEffect(() => {
        setValue('totalBilledAmount', bAmount + bFee);
    }, [bAmount, bFee, setValue]);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const [fetchedSites, defaults, financeTrackerSites, attendanceRecords] = await Promise.all([
                    api.getOrganizations(),
                    api.getSiteInvoiceDefaults(),
                    api.getUniqueTrackerSites(),
                    api.getSiteInvoiceRecords()
                ]);
                
                // Handle both array and paginated response
                const sitesList = Array.isArray(fetchedSites) ? fetchedSites : fetchedSites.data || [];
                setSites(sitesList);
                setSiteDefaults(defaults);
                
                // Merge finance and attendance tracker sites
                const allTrackerSites = [...financeTrackerSites];
                attendanceRecords.forEach(r => {
                    if (r.siteName && !allTrackerSites.find(s => s.name === r.siteName)) {
                        allTrackerSites.push({ id: r.siteId || r.siteName, name: r.siteName });
                    }
                });
                setTrackerSites(allTrackerSites);
                
                // Fetch current user
                // Fetch current user details from auth store if available, otherwise fallback to metadata
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser) {
                    const name = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Unknown';
                    // Fetch profile to get role
                    const profile = await api.getUserById(authUser.id);
                    setCurrentUser({ 
                        id: authUser.id, 
                        name, 
                        role: profile?.role || 'user' 
                    });
                }

                if (isEditing && id) {
                    const record = await api.getSiteFinanceRecord(id);
                    if (record) {
                        reset({
                            siteId: record.siteId,
                            siteName: record.siteName,
                            billingMonth: record.billingMonth,
                            companyName: record.companyName,
                            contractAmount: record.contractAmount,
                            contractManagementFee: record.contractManagementFee,
                            billedAmount: record.billedAmount, // Ensure these are set for editing
                            billedManagementFee: record.billedManagementFee,
                            status: record.status
                        });
                        setRecordMetadata({
                            createdBy: record.createdBy,
                            createdByName: record.createdByName,
                            createdAt: record.createdAt,
                            updatedBy: record.updatedBy, // These might not be in the type yet, but good to have
                            updatedAt: record.updatedAt,
                            updatedByName: record.updatedByName // If available
                        });
                    } else {
                        setToast({ message: 'Record not found', type: 'error' });
                        navigate('/finance?tab=site');
                    }
                }
            } catch (error) {
                console.error('Error loading data:', error);
                setToast({ message: 'Failed to load form data', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [isEditing, id, reset, navigate]);

    const onSubmit = async (data: Partial<SiteFinanceRecord>) => {
        setIsLoading(true);
        try {
            // Ensure billingMonth is formatted as YYYY-MM-01 to match tracker filter
            const billingDate = data.billingMonth ? new Date(data.billingMonth) : new Date();
            const formattedBillingMonth = format(startOfMonth(billingDate), 'yyyy-MM-dd');

            const payload = { ...data, billingMonth: formattedBillingMonth, id: id };
            
            // UUID check removed to support text-based Site IDs (e.g. from organizations)
            // if (payload.siteId && !uuidRegex.test(payload.siteId)) {
            //     payload.siteId = null as any; 
            // }

            // Add creator info for new records
            if (!id && currentUser) {
                payload.createdBy = currentUser.id;
                payload.createdByName = currentUser.name;
                payload.createdByRole = currentUser.role;
            } else if (id && currentUser) {
                // Update tracker for edits
                payload.updatedBy = currentUser.id;
                payload.updatedByName = currentUser.name;
                payload.updatedAt = new Date().toISOString();
            }
            
            // Check if contract details updated for the year, and if so, update defaults
            const currentYear = new Date(payload.billingMonth || new Date()).getFullYear();
            const hasContractChanges = 
                payload.contractAmount !== activeDefault?.contractAmount ||
                payload.contractManagementFee !== activeDefault?.contractManagementFee ||
                payload.companyName !== activeDefault?.companyName;

            if (hasContractChanges && payload.siteId && payload.contractAmount !== undefined && payload.contractManagementFee !== undefined && payload.companyName) {
                try {
                    await api.upsertSiteContract(
                         payload.siteId, 
                         currentYear, 
                         { 
                             contractAmount: payload.contractAmount, 
                             contractManagementFee: payload.contractManagementFee,
                             companyName: payload.companyName,
                             createdBy: currentUser.id,
                             createdByName: currentUser.name
                         }
                    );
                    // Refresh defaults in background? Optionally.
                    const newDefaults = await api.getSiteInvoiceDefaults();
                    setSiteDefaults(newDefaults);
                } catch (e) {
                    console.error("Failed to update site contract defaults:", e);
                    // Don't block the main save
                }
            }

            await api.saveSiteFinanceRecord(payload);
            setToast({ message: 'Finance record saved successfully', type: 'success' });
            setTimeout(() => navigate('/finance?tab=site'), 1000);
        } catch (error) {
            console.error('Save error:', error);
            setToast({ message: 'Failed to save record', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // Merge sources for dropdown options
    const mergedSiteOptions = React.useMemo(() => {
        const optionsMap = new Map<string, string>();
        
        // 1. Add organizations (using shortName as base)
        sites.forEach(s => {
             // Prefer Full Name if available? The user wants "Client Name" from tracker.
             // If tracker shows full names, we should try to match.
             // But let's start with shortName as fallback.
             optionsMap.set(s.id, s.shortName);
        });

        // 2. Overlay with tracker sites (preferred source for existing sites)
        trackerSites.forEach(s => {
            if (s.name) {
                optionsMap.set(s.id, s.name);
            }
        });

        return Array.from(optionsMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [sites, trackerSites]);

    const handleSiteSelection = async (selectedSiteId: string, selectedSiteName: string) => {
        setValue('siteId', selectedSiteId);
        setValue('siteName', selectedSiteName);
        
        // Auto-fill from defaults if available - YEAR AWARE
        const currentYear = new Date(watch('billingMonth') || new Date()).getFullYear();
        
        const specificDefault = siteDefaults.find(d => 
            (d.siteId === selectedSiteId || d.siteName === selectedSiteName) && 
            d.billingYear === currentYear
        );
        
        // Fallback to global default (no year)
        const globalDefault = siteDefaults.find(d => 
            (d.siteId === selectedSiteId || d.siteName === selectedSiteName) && 
            (d.billingYear === null || d.billingYear === undefined)
        );
        
        const effectiveDefault = specificDefault || globalDefault;

        if (effectiveDefault) {
            setActiveDefault(effectiveDefault);
            setValue('companyName', effectiveDefault.companyName);
            if (effectiveDefault.contractAmount) setValue('contractAmount', effectiveDefault.contractAmount);
            if (effectiveDefault.contractManagementFee) setValue('contractManagementFee', effectiveDefault.contractManagementFee);
        } else {
            // FALLBACK: Try to fetch the latest finance record for this site
            try {
                // If it's a UUID/ID, try by ID. If it's a custom name, try by name.
                const lastRecord = await api.getLastFinanceRecordForSite(selectedSiteId);
                if (lastRecord) {
                        // Use values from the last record
                        const fallbackDefault: SiteInvoiceDefault = {
                            siteId: selectedSiteId,
                            siteName: selectedSiteName,
                            companyName: lastRecord.companyName,
                            contractAmount: lastRecord.contractAmount,
                            contractManagementFee: lastRecord.contractManagementFee,
                        };
                        setActiveDefault(fallbackDefault);
                        setValue('companyName', lastRecord.companyName);
                        if (lastRecord.contractAmount) setValue('contractAmount', lastRecord.contractAmount);
                        if (lastRecord.contractManagementFee) setValue('contractManagementFee', lastRecord.contractManagementFee);
                        
                        setToast({ message: 'Auto-filled from previous record', type: 'success' });
                } else {
                    setActiveDefault(null);
                    setToast({ message: 'No previous records found for auto-fill', type: 'error' });
                }
            } catch (e) {
                console.error("Error fetching fallback record:", e);
                setActiveDefault(null);
            }
        }
    };

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="w-full p-4 md:p-8 space-y-6">
            <button 
                onClick={() => navigate('/finance?tab=site')}
                className="flex items-center text-xs font-bold text-gray-400 hover:text-primary transition-all group"
            >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back to Tracker
            </button>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-gray-50 rounded-2xl">
                        <ClipboardList className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 leading-none">Add New Record</h2>
                        <p className="text-sm text-gray-500 mt-1.5">Fill in the site billing details below to calculate variations.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                    {/* Top Section: Site & Date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <SearchableSelect
                                label="Select Site"
                                placeholder="Select or type site name..."
                                options={mergedSiteOptions.map(s => ({ id: s.id, name: s.name }))}
                                value={watch('siteId') || watch('siteName') || ''}
                                onChange={(id) => {
                                    const matched = mergedSiteOptions.find(opt => opt.id === id);
                                    handleSiteSelection(id, matched ? matched.name : id);
                                }}
                                allowCustom
                                labelClassName="text-emerald-500 uppercase tracking-wider ml-1"
                            />
                        </div>
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Billing Date</label>
                            <Controller
                                name="billingMonth"
                                control={control}
                                render={({ field }) => (
                                    <Input 
                                        type="date" 
                                        {...field}
                                        value={field.value ? field.value.split('T')[0] : ''} // Ensure YYYY-MM-DD
                                        disabled={false}
                                        className="h-12 !pl-4 border-gray-200 focus:border-emerald-500"
                                    />
                                )}
                            />
                        </div>
                    </div>

                    {/* Middle Section: Grouped Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Contract Details */}
                        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                             <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-6 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Wallet className="h-4 w-4" /> CONTRACT DETAILS
                                </div>
                            </h3>
                            <div className="space-y-6">
                                <Controller
                                    name="companyName"
                                    control={control}
                                    render={({ field }) => (
                                        <Input 
                                            label="Company Name" 
                                            type="text" 
                                            icon={<Building className="h-4 w-4" />} 
                                            placeholder="Auto-filled..."
                                            {...field}
                                            className="bg-white border-gray-200 focus:border-emerald-500"
                                        />
                                    )}
                                />
                                <Controller
                                    name="contractAmount"
                                    control={control}
                                    render={({ field }) => (
                                        <Input 
                                            label="Contract Amount" 
                                            type="number" 
                                            inputMode="numeric"
                                            icon={<IndianRupee className="h-4 w-4" />} 
                                            placeholder="0"
                                            {...field}
                                            className="bg-white border-gray-200 focus:border-emerald-500"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                field.onChange(val === '' ? '' : Number(val));
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                            }}
                                        />
                                    )}
                                />
                                <Controller
                                    name="contractManagementFee"
                                    control={control}
                                    render={({ field }) => (
                                        <Input 
                                            label="Management Fee" 
                                            type="number" 
                                            inputMode="numeric"
                                            icon={<IndianRupee className="h-4 w-4" />} 
                                            placeholder="0"
                                            {...field}
                                            className="bg-white border-gray-200 focus:border-emerald-500"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                field.onChange(val === '' ? '' : Number(val));
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                            }}
                                        />
                                    )}
                                />
                            </div>
                        </div>

                        {/* Billing Details */}
                        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                             <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> BILLING DETAILS
                            </h3>
                            <div className="space-y-6">
                                <Controller
                                    name="billedAmount"
                                    control={control}
                                    render={({ field }) => (
                                        <Input 
                                            label="Billed Amount" 
                                            type="number" 
                                            inputMode="numeric"
                                            icon={<IndianRupee className="h-4 w-4" />} 
                                            placeholder="0"
                                            {...field}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                field.onChange(val === '' ? '' : Number(val));
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                            }}
                                        />
                                    )}
                                />
                                <Controller
                                    name="billedManagementFee"
                                    control={control}
                                    render={({ field }) => (
                                        <Input 
                                            label="Management Fee" 
                                            type="number" 
                                            inputMode="numeric"
                                            icon={<IndianRupee className="h-4 w-4" />} 
                                            placeholder="0"
                                            {...field}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                field.onChange(val === '' ? '' : Number(val));
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                            }}
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Metadata Section (Only for Edits) */}
                    {isEditing && recordMetadata && (
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                             <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Record History</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="block font-bold text-gray-500 mb-0.5">Created By</span>
                                    <span className="text-gray-900 font-medium">{recordMetadata.createdByName || 'Unknown'}</span>
                                    <span className="text-gray-400 ml-2">{recordMetadata.createdAt ? format(new Date(recordMetadata.createdAt), 'dd MMM yyyy, hh:mm a') : '-'}</span>
                                </div>
                                {recordMetadata.updatedAt && (
                                    <div>
                                        <span className="block font-bold text-gray-500 mb-0.5">Last Updated</span>
                                        <span className="text-gray-900 font-medium">{currentUser?.name} (You)</span> 
                                        <span className="text-gray-400 ml-2">{format(new Date(), 'dd MMM yyyy')}</span>
                                    </div>
                                )}
                             </div>
                        </div>
                    )}

                    {/* Bottom Summary Bar */}
                    <div className="bg-white rounded-3xl border border-gray-300 p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">CALCULATED VARIATION</span>
                            <div className={`text-4xl font-black flex items-center ${totalDiff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {totalDiff >= 0 ? '+' : '-'}₹{Math.abs(totalDiff).toLocaleString('en-IN')}
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-full text-right">VARIATION STATUS</span>
                            <div className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-black uppercase transition-all ${
                                isProfit 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-rose-100 text-rose-800'
                            }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isProfit ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {isProfit ? 'PROFIT' : 'LOSS'}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button 
                            type="button" 
                            onClick={() => navigate('/finance?tab=site')}
                            className="px-8 h-12 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isLoading} 
                            className="px-8 h-12 rounded-xl text-sm font-bold bg-[#006B3F] text-white hover:bg-[#005632] transition-colors shadow-lg shadow-emerald-900/10 flex items-center"
                        >
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                            Save Record
                        </button>
                    </div>
                </form>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default AddSiteFinanceRecord;
