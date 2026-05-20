import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { HOLIDAY_SELECTION_POOL } from '../../utils/constants';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import Select from '../ui/Select';
import { Calendar, Save, Loader2, Check } from 'lucide-react';

const SiteHolidayAllocator: React.FC = () => {
    const [sites, setSites] = useState<any[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [allocatedHolidays, setAllocatedHolidays] = useState<{date: string, name: string}[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

    const currentYear = new Date().getFullYear();

    useEffect(() => {
        const fetchSites = async () => {
            try {
                const orgs = await api.getOrganizations();
                setSites(orgs || []);
            } catch (err) {
                console.error("Failed to fetch sites", err);
            }
        };
        fetchSites();
    }, []);

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
            } catch (err) {
                setToast({ message: 'Failed to load holidays for site', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchHolidays();
    }, [selectedSiteId]);

    const handleToggleHoliday = (ph: {date: string, name: string}) => {
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
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold flex items-center text-emerald-800">
                            <Check className="mr-2 h-4 w-4" /> Allocated Dates
                        </h4>
                        <div className="bg-white px-3 py-1 rounded-full text-sm font-bold text-emerald-700 shadow-sm border border-emerald-100">
                            {allocatedHolidays.length} Days Allocated
                        </div>
                    </div>

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

                    <div className="mt-6 flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving || isLoading} style={{backgroundColor: '#006B3F', color: '#FFF'}} className="px-6 border-0 shadow-md">
                            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Package to Site
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SiteHolidayAllocator;
