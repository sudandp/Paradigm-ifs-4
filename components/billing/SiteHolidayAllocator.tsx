import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { HOLIDAY_SELECTION_POOL } from '../../utils/constants';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import Select from '../ui/Select';
import { Calendar, Save, Loader2, Check } from 'lucide-react';

interface SiteHolidayAllocatorProps {
    initialSiteId?: string;
    filteredSites?: { id: string; name: string }[];
}

const SiteHolidayAllocator: React.FC<SiteHolidayAllocatorProps> = ({ initialSiteId, filteredSites }) => {
    const [allSites, setAllSites] = useState<any[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [allocatedHolidays, setAllocatedHolidays] = useState<{date: string, name: string}[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [targetCount, setTargetCount] = useState<10 | 12>(10);

    const currentYear = new Date().getFullYear();

    // Use filtered sites from parent if provided, otherwise fetch all
    const sites = filteredSites && filteredSites.length > 0 ? filteredSites : allSites;

    useEffect(() => {
        // Only fetch all organizations if parent doesn't provide filtered list
        if (filteredSites && filteredSites.length > 0) return;
        const fetchSites = async () => {
            try {
                const orgs = await api.getOrganizations();
                setAllSites(orgs || []);
            } catch (err) {
                console.error("Failed to fetch sites", err);
            }
        };
        fetchSites();
    }, [filteredSites]);

    // Sync with parent entity filter — only after sites are loaded and ID is valid
    useEffect(() => {
        if (initialSiteId && sites.length > 0) {
            const isValidSite = sites.some(s => s.id === initialSiteId);
            if (isValidSite) {
                setSelectedSiteId(initialSiteId);
            }
        }
    }, [initialSiteId, sites]);

    useEffect(() => {
        if (!selectedSiteId) {
            setAllocatedHolidays([]);
            return;
        }
        
        const fetchHolidays = async () => {
            setIsLoading(true);
            try {
                const holidays = await api.getSiteSpecificHolidays(selectedSiteId);
                setAllocatedHolidays(holidays);
                if (holidays.length > 10) {
                    setTargetCount(12);
                } else {
                    setTargetCount(10);
                }
            } catch (err) {
                console.error('Failed to load holidays for site:', err);
                setAllocatedHolidays([]);
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchHolidays();
    }, [selectedSiteId]);

    const selectedSite = sites.find(s => s.id === selectedSiteId);
    const holidayType = selectedSite?.holidayConfig?.holidayType || 'custom';
    const isFixedCompanyHoliday = holidayType === 'company_10' || holidayType === 'company_12';
    const fixedCount = holidayType === 'company_12' ? 12 : 10;

    const handleToggleHoliday = (ph: {date: string, name: string}) => {
        if (isFixedCompanyHoliday) return;
        
        const poolDate = `${currentYear}${ph.date}`;
        setAllocatedHolidays(prev => {
            const exists = prev.some(h => h.date === poolDate && h.name === ph.name);
            if (exists) {
                return prev.filter(h => !(h.date === poolDate && h.name === ph.name));
            } else {
                return [...prev, { date: poolDate, name: ph.name }];
            }
        });
    };

    const handleSave = async () => {
        if (!selectedSiteId) return;
        setIsSaving(true);
        try {
            await api.saveSiteSpecificHolidays(selectedSiteId, allocatedHolidays);
            setToast({ message: 'Site holidays saved successfully!', type: 'success' });
        } catch (err) {
            setToast({ message: 'Failed to save site holidays', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            <div className="p-4 bg-page rounded-xl border border-border">
                <h3 className="font-semibold text-lg mb-4 flex items-center text-primary-text">
                    <Calendar className="mr-2 h-5 w-5 text-emerald-600" />
                    Template-to-Site Holiday Allocation
                </h3>
                
                <p className="text-sm text-muted mb-4">
                    Select a site to allocate a specific package of holidays. Any staff member enrolled at this site will automatically inherit these dates.
                </p>

                <div className="max-w-md">
                    <label className="block text-sm font-medium text-primary-text mb-1">Target Site</label>
                    <Select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
                        <option value="">-- Select a Site --</option>
                        {sites.map(site => (
                            <option key={site.id} value={site.id}>{site.shortName || site.name}</option>
                        ))}
                    </Select>
                </div>
            </div>

            {selectedSiteId && (
                <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-4">
                            <h4 className="font-semibold flex items-center text-emerald-800">
                                <Check className="mr-2 h-4 w-4" /> Allocated Dates
                            </h4>
                            {!isFixedCompanyHoliday && (
                                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-border">
                                    <button
                                        type="button"
                                        onClick={() => setTargetCount(10)}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${targetCount === 10 ? 'bg-emerald-100 text-emerald-800' : 'text-muted hover:bg-gray-50'}`}
                                    >
                                        10 Days Package
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTargetCount(12)}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${targetCount === 12 ? 'bg-emerald-100 text-emerald-800' : 'text-muted hover:bg-gray-50'}`}
                                    >
                                        12 Days Package
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-bold shadow-sm border whitespace-nowrap ${
                            allocatedHolidays.length === (isFixedCompanyHoliday ? fixedCount : targetCount)
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                                : allocatedHolidays.length > (isFixedCompanyHoliday ? fixedCount : targetCount)
                                    ? 'bg-red-100 text-red-700 border-red-200'
                                    : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                            {allocatedHolidays.length} / {isFixedCompanyHoliday ? fixedCount : targetCount} Selected
                        </div>
                    </div>
                    
                    {isFixedCompanyHoliday && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                            This site uses a Fixed Company Holiday Package ({fixedCount} Days) defined in Client Management. 
                            Manual allocation is disabled.
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {HOLIDAY_SELECTION_POOL.map((ph) => {
                                const poolDate = `${currentYear}${ph.date}`;
                                const isSelected = allocatedHolidays.some(h => h.date === poolDate && h.name === ph.name);
                                
                                return (
                                    <button
                                        key={ph.name + ph.date}
                                        type="button"
                                        onClick={() => handleToggleHoliday(ph)}
                                        className={`flex items-center gap-3 px-4 py-3 text-sm rounded-xl border transition-all text-left group ${
                                            isSelected 
                                            ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/50 shadow-sm' 
                                            : 'bg-white hover:border-emerald-300 text-primary-text border-border/50'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-emerald-500 bg-emerald-500 text-white scale-110 shadow-sm' : 'border-border group-hover:border-emerald-400'}`}>
                                            {isSelected && <Check className="h-3.5 w-3.5" />}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="font-semibold text-primary-text truncate">{ph.name}</div>
                                            <div className={`text-xs ${isSelected ? 'text-emerald-600/80' : 'text-muted'}`}>{poolDate}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {!isFixedCompanyHoliday && (
                        <div className="mt-6 flex justify-end">
                            <Button onClick={handleSave} disabled={isSaving || isLoading} style={{backgroundColor: '#006B3F', color: '#FFF'}} className="px-6 border-0 shadow-md">
                                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                Save Package to Site
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SiteHolidayAllocator;
