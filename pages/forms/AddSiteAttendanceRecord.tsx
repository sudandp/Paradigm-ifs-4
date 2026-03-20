import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import type { SiteInvoiceRecord, SiteInvoiceDefault, Organization } from '../../types';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { Save, ArrowLeft, ClipboardList, TrendingUp, Building, Calendar, Users, Briefcase, FileText, Clock } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { format, getDate, getMonth, getYear, set, parseISO } from 'date-fns';
import LoadingScreen from '../../components/ui/LoadingScreen';


const AddSiteAttendanceRecord: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditing = !!id;
    const isMobile = useMediaQuery('(max-width: 767px)');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [sites, setSites] = useState<Organization[]>([]);
    const [record, setRecord] = useState<Partial<SiteInvoiceRecord>>({
        siteId: '',
        siteName: '',
        companyName: '',
        billingCycle: '',
        opsRemarks: '',
        hrRemarks: '',
        financeRemarks: '',
        opsIncharge: '',
        hrIncharge: '',
        invoiceIncharge: '',
        managerTentativeDate: '',
        managerReceivedDate: '',
        hrTentativeDate: '',
        hrReceivedDate: '',
        attendanceReceivedTime: '',
        invoiceSharingTentativeDate: '',
        invoicePreparedDate: '',
        invoiceSentTime: '',
        invoiceSentMethodRemarks: ''
    });
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const BILLING_CYCLES = ['1st Billing Cycle', '2nd Billing Cycle', '3rd Billing Cycle'];
    const [opsInchargeOptions, setOpsInchargeOptions] = useState<string[]>([]);
    const [hrInchargeOptions, setHrInchargeOptions] = useState<string[]>([]);
    const [invoiceInchargeOptions, setInvoiceInchargeOptions] = useState<string[]>([]);

    const [siteDefaults, setSiteDefaults] = useState<SiteInvoiceDefault[]>([]);
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [fetchedSites, fetchedDefaults, trackerRecords] = await Promise.all([
                    api.getOrganizations(),
                    api.getSiteInvoiceDefaults(),
                    api.getSiteInvoiceRecords()
                ]);

                // Extract unique site names from tracker records
                const trackerSiteNames = Array.from(new Set(trackerRecords.map(r => r.siteName).filter(Boolean)));
                
                // Merge with fetched sites
                const allSites: Organization[] = [...(fetchedSites || [])];
                trackerSiteNames.forEach(name => {
                    if (!allSites.find(s => s.shortName === name)) {
                        allSites.push({ id: name!, shortName: name!, name: name! } as any as Organization);
                    }
                });
                
                setSites(allSites);
                setSiteDefaults(fetchedDefaults || []);

                // Extract unique incharge names from tracker records
                const opsSet = new Set<string>();
                const hrSet = new Set<string>();
                const invoiceSet = new Set<string>();

                trackerRecords.forEach(r => {
                    if (r.opsIncharge) opsSet.add(r.opsIncharge);
                    if (r.hrIncharge) hrSet.add(r.hrIncharge);
                    if (r.invoiceIncharge) invoiceSet.add(r.invoiceIncharge);
                });

                // Add default options if not present
                ['Sandeep', 'Shilpa', 'Isaac', 'Venkat'].forEach(name => opsSet.add(name));
                ['Chandana', 'Pooja', 'Kavya'].forEach(name => hrSet.add(name));
                ['Arpitha', 'Sinchana'].forEach(name => invoiceSet.add(name));

                setOpsInchargeOptions(Array.from(opsSet).sort());
                setHrInchargeOptions(Array.from(hrSet).sort());
                setInvoiceInchargeOptions(Array.from(invoiceSet).sort());

                const { user: authUser } = useAuthStore.getState();
                if (authUser) {
                    setCurrentUser({ id: authUser.id, name: authUser.name || 'Unknown' });
                }

                if (isEditing && id) {
                    const existingRecord = trackerRecords.find(r => r.id === id);
                    if (existingRecord) {
                        // Ensure siteId is not null/empty if siteName exists
                        if (!existingRecord.siteId && existingRecord.siteName) {
                            existingRecord.siteId = existingRecord.siteName;
                        }
                        setRecord(existingRecord);
                    } else {
                        setToast({ message: 'Record not found', type: 'error' });
                        setTimeout(() => navigate('/finance?tab=attendance'), 2000);
                    }
                }
            } catch (error) {
                console.error('Error loading form data:', error);
                setToast({ message: 'Failed to load data', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id, isEditing, navigate]);

    const handleInputChange = (field: keyof SiteInvoiceRecord, value: any) => {
        setRecord(prev => {
            const updated = { ...prev, [field]: value };

            if (field === 'siteId') {
                const site = sites.find(s => s.id === value || s.shortName === value);
                if (site) {
                    updated.siteId = site.id;
                    updated.siteName = site.shortName;
                } else {
                    updated.siteId = value;
                    updated.siteName = value;
                }
                
                // Auto-fill from defaults
                const targetId = site ? site.id : value;
                const defaults = siteDefaults.find(d => d.siteId === targetId || d.siteName === value);
                if (defaults) {
                    const defs = defaults as any;
                    updated.companyName = defs.companyName || updated.companyName;
                    updated.billingCycle = defs.billingCycle || updated.billingCycle;
                    updated.opsIncharge = defs.opsIncharge || updated.opsIncharge;
                    updated.hrIncharge = defs.hrIncharge || updated.hrIncharge;
                    updated.invoiceIncharge = defs.invoiceIncharge || updated.invoiceIncharge;

                    // Dynamic Date Adjustment: Use the day from defaults, but current Year & Month
                    const adjustDateToCurrentPeriod = (dateStr: string | undefined): string => {
                        if (!dateStr) return '';
                        try {
                            const defaultDate = parseISO(dateStr);
                            const today = new Date();
                            const adjustedDate = set(today, { 
                                date: getDate(defaultDate),
                                month: getMonth(today), 
                                year: getYear(today) 
                            });
                            return format(adjustedDate, 'yyyy-MM-dd');
                        } catch (e) {
                            console.error('Date adjustment error:', e);
                            return '';
                        }
                    };

                    updated.managerTentativeDate = adjustDateToCurrentPeriod(defs.managerTentativeDate) || updated.managerTentativeDate;
                    updated.hrTentativeDate = adjustDateToCurrentPeriod(defs.hrTentativeDate) || updated.hrTentativeDate;
                    updated.invoiceSharingTentativeDate = adjustDateToCurrentPeriod(defs.invoiceSharingTentativeDate) || updated.invoiceSharingTentativeDate;
                }
            }

            return updated;
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!record.siteId || !record.siteName) {
            setToast({ message: 'Please select a site', type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            const payload = { ...record };
            
            // Validate UUID for siteId. If custom name (not UUID), set siteId to null to avoid 400 error
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (payload.siteId && !uuidRegex.test(payload.siteId)) {
                // For SiteInvoiceRecord, site_id is nullable (based on migration script analysis)
                // However, types might be strict. Let's force it to null/undefined for the API call
                (payload as any).siteId = null;
            }

            if (!isEditing && currentUser) {
                const { user: authUser } = useAuthStore.getState();
                payload.createdBy = currentUser.id;
                payload.createdByName = currentUser.name;
                payload.createdByRole = authUser?.role;
            }
            await api.saveSiteInvoiceRecord(payload);
            setToast({ message: `Record ${isEditing ? 'updated' : 'created'} successfully!`, type: 'success' });
            setTimeout(() => navigate('/finance?tab=attendance'), 1500);
        } catch (error) {
            console.error('Save error:', error);
            setToast({ message: 'Failed to save record', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted italic">Loading form...</p>
            </div>
        );
    }

    const SectionHeader = ({ icon: Icon, title, bgColor }: { icon: any, title: string, bgColor: string }) => (
        <h4 className={`text-sm font-bold uppercase tracking-wider border-b ${isMobile ? 'border-[#1f3d2b]' : 'border-border/60'} pb-3 mb-6 flex items-center ${bgColor}`}>
            <Icon className="w-5 h-5 mr-2" />
            {title}
        </h4>
    );

    const labelClass = isMobile ? "text-xs font-bold text-gray-400 uppercase tracking-tight ml-1" : "text-xs font-bold text-muted uppercase tracking-tight ml-1";
    const inputClass = isMobile ? "rounded-xl bg-[#0c2e1f] border-[#1f3d2b] text-white placeholder:text-gray-500" : "rounded-xl";

    const selectClass = isMobile 
        ? "w-full flex h-11 rounded-xl border border-[#1f3d2b] bg-[#0c2e1f] px-3 py-2 text-sm text-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
        : "w-full flex h-11 rounded-xl border border-border bg-white px-3 py-2 text-sm text-primary-text focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm";

    const sectionContainerClass = isMobile 
        ? "bg-card/50 p-4 rounded-xl border border-border space-y-4"
        : "bg-white/40 p-6 rounded-3xl border border-border/50 shadow-sm transition-all hover:shadow-md";

    const FormContent = (
        <form onSubmit={handleSave} className="space-y-12">
            {/* Description Section */}
            <div className={sectionContainerClass}>
                <SectionHeader icon={Briefcase} title="Description" bgColor="text-orange-600" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1 group">
                        <SearchableSelect
                            label="Select Site"
                            placeholder="Select or type site name..."
                            options={sites.map(s => ({ id: s.id, name: s.shortName }))}
                            value={record.siteName || ''}
                            onChange={(val) => {
                                const matchedSite = sites.find(s => s.shortName === val);
                                if (matchedSite) {
                                    handleInputChange('siteId', matchedSite.id);
                                } else {
                                    handleInputChange('siteId', val);
                                }
                            }}
                            allowCustom
                        />
                    </div>
                    <Input
                        id="companyName"
                        name="companyName"
                        label="Company Name"
                        placeholder="e.g. IFS, IBM"
                        value={record.companyName || ''}
                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                        className={inputClass}
                    />
                    <div className="space-y-1 group">
                        <label htmlFor="billingCycle" className={labelClass}>Billing Cycle</label>
                        <select
                            id="billingCycle"
                            name="billingCycle"
                            className={selectClass}
                            value={record.billingCycle || ''}
                            onChange={(e) => handleInputChange('billingCycle', e.target.value)}
                        >
                            <option value="">Select cycle...</option>
                            {BILLING_CYCLES.map(cycle => (
                                <option key={cycle} value={cycle}>{cycle}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1 group">
                        <SearchableSelect
                            label="Ops Incharge"
                            placeholder="Select or type name..."
                            options={opsInchargeOptions.map(name => ({ id: name, name }))}
                            value={record.opsIncharge || ''}
                            onChange={(val) => handleInputChange('opsIncharge', val)}
                            allowCustom
                        />
                    </div>
                    <div className="space-y-1 group">
                        <SearchableSelect
                            label="HR Incharge"
                            placeholder="Select or type name..."
                            options={hrInchargeOptions.map(name => ({ id: name, name }))}
                            value={record.hrIncharge || ''}
                            onChange={(val) => handleInputChange('hrIncharge', val)}
                            allowCustom
                        />
                    </div>
                    <div className="space-y-1 group">
                        <SearchableSelect
                            label="Invoice Incharge"
                            placeholder="Select or type name..."
                            options={invoiceInchargeOptions.map(name => ({ id: name, name }))}
                            value={record.invoiceIncharge || ''}
                            onChange={(val) => handleInputChange('invoiceIncharge', val)}
                            allowCustom
                        />
                    </div>
                    <Input
                        id="opsRemarks"
                        name="opsRemarks"
                        label="Ops Remarks"
                        placeholder="Operational notes"
                        value={record.opsRemarks || ''}
                        onChange={(e) => handleInputChange('opsRemarks', e.target.value)}
                        className={inputClass}
                    />
                    <Input
                        id="hrRemarks"
                        name="hrRemarks"
                        label="HR Remarks"
                        placeholder="HR notes"
                        value={record.hrRemarks || ''}
                        onChange={(e) => handleInputChange('hrRemarks', e.target.value)}
                        className={inputClass}
                    />
                    <Input
                        id="financeRemarks"
                        name="financeRemarks"
                        label="Finance Remarks"
                        placeholder="Finance notes"
                        value={record.financeRemarks || ''}
                        onChange={(e) => handleInputChange('financeRemarks', e.target.value)}
                        className={inputClass}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Manager Status Section */}
                <div className={`${sectionContainerClass} border-l-4 border-l-yellow-400`}>
                    <SectionHeader icon={Users} title="Attendance Status (Managers)" bgColor="text-yellow-700" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Input
                            id="managerTentativeDate"
                            name="managerTentativeDate"
                            label="Tentative Submission Date"
                            type="date"
                            value={record.managerTentativeDate || ''}
                            onChange={(e) => handleInputChange('managerTentativeDate', e.target.value)}
                            className={inputClass}
                        />
                        <Input
                            id="managerReceivedDate"
                            name="managerReceivedDate"
                            label="Attendance Received Date"
                            type="date"
                            value={record.managerReceivedDate || ''}
                            onChange={(e) => handleInputChange('managerReceivedDate', e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>

                {/* HR Status Section */}
                <div className={`${sectionContainerClass} border-l-4 border-l-blue-400`}>
                    <SectionHeader icon={ClipboardList} title="Attendance Status (HR)" bgColor="text-blue-700" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Input
                            id="hrTentativeDate"
                            name="hrTentativeDate"
                            label="Tentative Submission Date"
                            type="date"
                            value={record.hrTentativeDate || ''}
                            onChange={(e) => handleInputChange('hrTentativeDate', e.target.value)}
                            className={inputClass}
                        />
                        <Input
                            id="hrReceivedDate"
                            name="hrReceivedDate"
                            label="Received from HR Date"
                            type="date"
                            value={record.hrReceivedDate || ''}
                            onChange={(e) => handleInputChange('hrReceivedDate', e.target.value)}
                            className={inputClass}
                        />
                        <Input
                            id="attendanceReceivedTime"
                            name="attendanceReceivedTime"
                            label="Attendance Received Time"
                            placeholder="e.g. 5:00 AM"
                            value={record.attendanceReceivedTime || ''}
                            onChange={(e) => handleInputChange('attendanceReceivedTime', e.target.value)}
                            icon={<Clock className="h-4 w-4" />}
                            className={inputClass.replace('rounded-xl', '')} // Input handles rounded internally sometimes, or override here if needed, keeping simple. Actually Input assumes className appends.
                        />
                    </div>
                </div>
            </div>

            {/* Invoice Status Section */}
                <div className={`${sectionContainerClass} border-t-4 border-t-green-400`}>
                <SectionHeader icon={FileText} title="Invoice Status" bgColor="text-green-700" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Input
                        id="invoiceSharingTentativeDate"
                        name="invoiceSharingTentativeDate"
                        label="Tentative Sharing Date"
                        type="date"
                        value={record.invoiceSharingTentativeDate || ''}
                        onChange={(e) => handleInputChange('invoiceSharingTentativeDate', e.target.value)}
                        className={inputClass}
                    />
                    <Input
                        id="invoicePreparedDate"
                        name="invoicePreparedDate"
                        label="Invoice Prepared Date"
                        type="date"
                        value={record.invoicePreparedDate || ''}
                        onChange={(e) => handleInputChange('invoicePreparedDate', e.target.value)}
                        className={inputClass}
                    />
                    <Input
                        id="invoiceSentDate"
                        name="invoiceSentDate"
                        label="Invoice Sent Date"
                        type="date"
                        value={record.invoiceSentDate || ''}
                        onChange={(e) => handleInputChange('invoiceSentDate', e.target.value)}
                        className={inputClass}
                    />
                    <Input
                        id="invoiceSentTime"
                        name="invoiceSentTime"
                        label="Sent Timing"
                        placeholder="e.g. 12:35 PM"
                        value={record.invoiceSentTime || ''}
                        onChange={(e) => handleInputChange('invoiceSentTime', e.target.value)}
                        icon={<Clock className="h-4 w-4" />}
                        className={inputClass}
                    />
                </div>
            </div>

            {!isMobile && (
                <div className="flex justify-end space-x-4 pt-8 border-t border-border">
                    <Button type="button" variant="secondary" onClick={() => navigate('/finance?tab=attendance')} className="px-6 rounded-xl border-2">
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isSaving} className="px-10 rounded-xl shadow-lg shadow-primary/20">
                        <Save className="h-4 w-4 mr-2" />
                        {isEditing ? 'Update Entry' : 'Create Entry'}
                    </Button>
                </div>
            )}
        </form>
    );

    if (isMobile) {
        return (
            <div className="min-h-screen bg-[#041b0f] pb-20">
                <header 
                    className="fixed top-0 left-0 right-0 z-50 bg-[#041b0f] border-b border-[#1f3d2b] p-4 flex items-center gap-4"
                    style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
                >
                    <button onClick={() => navigate('/finance?tab=attendance')} className="p-2 hover:bg-white/5 rounded-full text-white">
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white tracking-tight">{isEditing ? 'Edit Entry' : 'New Entry'}</h1>
                </header>

                <main className="p-4" style={{ paddingTop: 'calc(5rem + env(safe-area-inset-top))' }}>
                    {FormContent}
                </main>

                <footer className="fixed bottom-0 left-0 right-0 p-4 bg-[#041b0f] border-t border-[#1f3d2b] flex gap-4 z-[60]">
                    <Button type="button" variant="secondary" onClick={() => navigate('/finance?tab=attendance')} className="flex-1 rounded-xl border border-[#1f3d2b] text-white hover:bg-white/5">
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} isLoading={isSaving} className="flex-1 rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20">
                        {isEditing ? 'Update' : 'Create'}
                    </Button>
                </footer>
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            </div>
        );
    }

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    return (
        <div className="p-6 lg:p-10">
            <button 
                onClick={() => navigate('/finance?tab=attendance')}
                className="flex items-center text-sm font-bold text-muted hover:text-primary transition-all mb-8 group"
            >
                <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Finance
            </button>

            <div className="flex items-start mb-8">
                <div>
                    <h2 className="text-3xl font-black text-primary-text tracking-tight leading-tight">{isEditing ? 'Edit Tracker Record' : 'Create Tracker Record'}</h2>
                    <p className="text-muted text-lg">Input attendance and invoicing status for site monitoring.</p>
                </div>
            </div>

            {FormContent}
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default AddSiteAttendanceRecord;
