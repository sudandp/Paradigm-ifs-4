import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { api } from '../../services/api';
import { FIXED_HOLIDAYS, HOLIDAY_SELECTION_POOL } from '../../utils/constants';
import { useDevice } from '../../hooks/useDevice';
import Button from '../../components/ui/Button';
import { Calendar as CalendarIcon, Check, ChevronLeft, Info, Loader2, Lock, Save } from 'lucide-react';
import Toast from '../../components/ui/Toast';
import HolidayCalendar from './HolidayCalendar';
import type { UserHoliday, Holiday, StaffAttendanceRules } from '../../types';
import LoadingScreen from '../../components/ui/LoadingScreen';


const HolidaySelectionPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { attendance, officeHolidays, fieldHolidays, siteHolidays } = useSettingsStore();
    const { isMobile } = useDevice();
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [userHolidays, setUserHolidays] = useState<UserHoliday[]>([]);
    const [selectedHolidays, setSelectedHolidays] = useState<{ name: string; date: string }[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [viewingDate, setViewingDate] = useState(new Date());
    const [view, setView] = useState<'selection' | 'confirmation'>('selection');

    const currentYear = new Date().getFullYear();
    const userRole = user?.role?.toLowerCase();
    const category = userRole?.includes('field') ? 'field' : userRole?.includes('site') ? 'site' : 'office';
    const rules = attendance[category as 'office' | 'field' | 'site'] as StaffAttendanceRules;
    
    const holidayPool = rules?.holidayPool || HOLIDAY_SELECTION_POOL;
    const maxEmployeeHolidays = 6;

    useEffect(() => {
        const fetchUserHolidays = async () => {
            if (!user?.id) return;
            setIsLoading(true);
            try {
                const holidays = await api.getUserHolidays(user.id);
                setUserHolidays(holidays);
                setSelectedHolidays(holidays.map(h => ({ name: h.holidayName, date: h.holidayDate })));
            } catch (error) {
                console.error('Failed to fetch user holidays:', error);
                setToast({ message: 'Failed to load your holiday selections.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserHolidays();
    }, [user?.id]);

    const toggleHoliday = (name: string, date: string) => {
        const isSelected = selectedHolidays.some(h => h.name === name);
        
        // Prevent changes to past or current day holidays
        const dateStr = date.startsWith('-') ? `${currentYear}${date}` : date;
        const holidayDate = new Date(dateStr.replace(/-/g, '/'));
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (holidayDate <= today) {
            if (isSelected) {
                setToast({ message: "You cannot deselect a holiday that has already passed or is today.", type: 'error' });
            } else {
                setToast({ message: "You cannot select a holiday that has already passed.", type: 'error' });
            }
            return;
        }

        if (isSelected) {
            setSelectedHolidays(selectedHolidays.filter(h => h.name !== name));
        } else {
            if (selectedHolidays.length >= maxEmployeeHolidays) {
                setToast({ message: `You can only select up to ${maxEmployeeHolidays} holidays.`, type: 'error' });
                return;
            }
            setSelectedHolidays([...selectedHolidays, { name, date }]);
        }
    };

    const handleSave = async () => {
        if (selectedHolidays.length === 0) {
            setToast({ message: `Please select at least 1 holiday.`, type: 'error' });
            return;
        }
        
        if (selectedHolidays.length > maxEmployeeHolidays) {
            setToast({ message: `You can only select up to ${maxEmployeeHolidays} holidays.`, type: 'error' });
            return;
        }

        setView('confirmation');
    };

    const confirmSave = async () => {
        if (!user?.id) return;

        setIsSaving(true);
        try {
            const holidaysToSave = selectedHolidays.map(h => ({
                holidayName: h.name,
                holidayDate: h.date.startsWith('-') ? `${currentYear}${h.date}` : h.date,
                year: currentYear
            }));
            await api.saveUserHolidays(user.id, holidaysToSave);
            setToast({ message: 'Holiday selection saved successfully!', type: 'success' });
            setTimeout(() => navigate('/leaves/dashboard'), 1500);
        } catch (error) {
            console.error('Failed to save holidays:', error);
            setToast({ message: 'Failed to save holiday selection.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
                <p className="text-muted">Loading holiday pool...</p>
            </div>
        );
    }

    const storeHolidays = category === 'field' ? fieldHolidays : category === 'site' ? siteHolidays : officeHolidays;
    
    // Prepare holidays for calendar view
    const adminHolidays: Holiday[] = [
        ...FIXED_HOLIDAYS.map(fh => ({
            id: `fixed-${fh.date}`,
            name: fh.name,
            date: `${currentYear}-${fh.date}`,
            type: category as any
        })),
        ...storeHolidays.filter(h => !FIXED_HOLIDAYS.some(fh => fh.name === h.name))
    ];

    const calendarUserHolidays = selectedHolidays.map(h => ({
        id: `user-${h.name}`,
        holidayName: h.name,
        holidayDate: `${currentYear}${h.date}`, // Convert -MM-DD to YYYY-MM-DD
        userId: user?.id || '',
        year: currentYear
    }));

    if (isLoading) {
        return <LoadingScreen message="Loading page data..." />;
    }

    if (view === 'confirmation') {
        return (
            <div className="p-4 md:p-6 pb-40 animate-fade-in">
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
                
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="secondary" size="md" onClick={() => setView('selection')} className="p-2 rounded-full h-10 w-10 flex items-center justify-center">
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-primary-text">Confirm Selection</h1>
                        <p className="text-muted">Review your chosen holidays for {currentYear}</p>
                    </div>
                </div>

                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="bg-card rounded-2xl p-6 shadow-card border border-border">
                        <p className="text-lg mb-6">Are you sure you want to save these <span className="font-bold text-accent">{selectedHolidays.length}</span> holidays?</p>
                        
                        <div className="space-y-3">
                            {[...selectedHolidays].sort((a, b) => a.date.localeCompare(b.date)).map((h, i) => {
                                const dateStr = h.date.startsWith('-') ? `${currentYear}${h.date}` : h.date;
                                const displayDate = new Date(dateStr.replace(/-/g, '/'));
                                
                                return (
                                    <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-accent/5 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-lg bg-accent/10 flex flex-col items-center justify-center text-accent">
                                                <span className="text-[8px] font-bold uppercase leading-none">{displayDate.toLocaleDateString('en-IN', { month: 'short' })}</span>
                                                <span className="text-sm font-bold leading-none mt-0.5">{displayDate.getDate()}</span>
                                            </div>
                                            <span className="font-semibold text-primary-text text-lg">{h.name}</span>
                                        </div>
                                        <span className="text-sm text-muted font-medium bg-muted/10 px-3 py-1 rounded-full">
                                            {displayDate.toLocaleDateString('en-IN', { weekday: 'short' })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-100">
                            <p className="text-sm text-amber-800 flex items-start gap-2">
                                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>Note: You can change your selection later if the holiday selection window is still open.</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Floating Action Bar */}
                <div 
                    className="fixed left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-card via-card to-transparent border-t border-border z-40"
                    style={{ 
                        bottom: isMobile ? 'calc(4rem + env(safe-area-inset-bottom))' : '0' 
                    }}
                >
                    <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                        <Button 
                            variant="secondary"
                            onClick={() => setView('selection')}
                            className="flex-1 md:flex-none px-8 py-3 h-14 text-lg"
                        >
                            Back to Selection
                        </Button>
                        <Button 
                            onClick={confirmSave} 
                            isLoading={isSaving} 
                            className="flex-[2] md:flex-none px-12 py-3 shadow-lg shadow-accent/20 text-lg h-14"
                        >
                            <Check className="mr-2 h-6 w-6" />
                            Confirm & Save
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 pb-40 animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            <div className="flex items-center gap-4 mb-8">
            {isMobile && (
                <Button variant="secondary" size="md" onClick={() => navigate('/leaves/dashboard')} className="p-2 rounded-full h-10 w-10 flex items-center justify-center">
                    <ChevronLeft className="h-6 w-6" />
                </Button>
            )}
                <div>
                    <h1 className="text-2xl font-bold text-primary-text">Holiday Selection</h1>
                    <p className="text-muted">Pick your optional holidays for {currentYear}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Selection Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card rounded-2xl p-6 shadow-card border border-border">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-accent" />
                                Available Holidays
                            </h2>
                            <div className={`px-4 py-1 rounded-full text-sm font-medium ${selectedHolidays.length > 0 && selectedHolidays.length <= maxEmployeeHolidays ? 'bg-emerald-500/10 text-emerald-500' : 'bg-accent/10 text-accent'}`}>
                                {selectedHolidays.length} / {maxEmployeeHolidays} Selected
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {[...holidayPool].sort((a, b) => a.date.localeCompare(b.date)).map((holiday, index) => {
                                const isSelected = selectedHolidays.some(h => h.name === holiday.name);
                                const dateObj = new Date(`${currentYear}${holiday.date}`.replace(/-/g, '/'));
                                const formattedDate = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
                                
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const isPastOrToday = dateObj <= today;

                                return (
                                    <button
                                        key={index}
                                        onClick={() => toggleHoliday(holiday.name, holiday.date)}
                                        disabled={isPastOrToday}
                                        className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 text-left ${
                                            !isPastOrToday ? 'hover:scale-[1.01] active:scale-[0.99]' : 'cursor-not-allowed'
                                        } ${
                                            isSelected 
                                            ? 'bg-accent/10 border-accent shadow-sm ring-1 ring-accent/20' 
                                            : isPastOrToday 
                                                ? 'bg-gray-100 border-gray-200 opacity-60' 
                                                : 'bg-transparent border-border hover:border-accent/30 hover:bg-accent/5'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center transition-colors ${
                                                isSelected 
                                                    ? (isPastOrToday ? 'bg-gray-400 text-white' : 'bg-accent text-white') 
                                                    : 'bg-muted/10 text-muted'
                                            }`}>
                                                <span className="text-[10px] font-bold uppercase leading-none">{dateObj.toLocaleDateString('en-IN', { month: 'short' })}</span>
                                                <span className="text-lg font-bold leading-none mt-0.5">{dateObj.getDate()}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className={`text-lg font-semibold ${isSelected ? 'text-accent' : 'text-primary-text'} ${isPastOrToday && !isSelected ? 'text-muted' : ''}`}>{holiday.name}</p>
                                                    {isPastOrToday && isSelected && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                                                </div>
                                                <p className="text-sm text-muted">
                                                    {formattedDate} 
                                                    {isPastOrToday && (
                                                        <span className="ml-2 text-[10px] items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase font-bold">
                                                            {dateObj < today ? 'Passed' : 'Today'}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center border transition-all duration-300 ${
                                            isSelected 
                                            ? (isPastOrToday ? 'bg-gray-300 border-gray-300 text-white' : 'bg-accent border-accent text-white rotate-0 scale-100')
                                            : 'border-border bg-card rotate-90 scale-75 opacity-50'
                                        }`}>
                                            {isSelected && (isPastOrToday ? <Lock className="h-3 w-3" /> : <Check className="h-4 w-4" />)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-8 pt-6 border-t border-border">
                            <p className="text-sm text-muted flex items-start gap-2">
                                <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-accent" />
                                <span>You can select up to <strong>{maxEmployeeHolidays} holidays</strong> from the pool. Make sure to choose the ones that are most important to you.</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Preview Section */}
                <div className="space-y-6">
                    <div className="sticky top-6">
                        <h3 className="text-lg font-semibold mb-4 px-1">Calendar Preview</h3>
                        <HolidayCalendar 
                            adminHolidays={adminHolidays}
                            userSelectedHolidays={calendarUserHolidays}
                            viewingDate={viewingDate}
                            onDateChange={setViewingDate}
                        />
                        <div className="mt-6 p-4 bg-accent/5 border border-accent/10 rounded-xl space-y-3">
                            <h4 className="text-sm font-semibold text-accent-dark">Legend</h4>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-3 w-3 rounded-full bg-emerald-600"></div>
                                <span className="text-muted">Gov Holiday</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                                <span className="text-muted">Admin Allocated</span>
                            </div>
                            <div className={`flex items-center gap-3 text-sm transition-opacity ${selectedHolidays.length > 0 ? 'opacity-100' : 'opacity-50'}`}>
                                <div className="h-3 w-3 rounded-full bg-violet-600"></div>
                                <span className="text-muted">Your Selection</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Save Selection Bar */}
            <div 
                className="fixed left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-card via-card to-transparent border-t border-border z-40"
                style={{ 
                    bottom: isMobile ? 'calc(4rem + env(safe-area-inset-bottom))' : '0' 
                }}
            >
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                    {!isMobile && (
                        <div className="text-sm text-muted">
                            <span className="font-semibold text-accent">{selectedHolidays.length}</span> of {maxEmployeeHolidays} holidays selected
                        </div>
                    )}
                    <Button 
                        onClick={handleSave} 
                        isLoading={isSaving} 
                        disabled={selectedHolidays.length === 0}
                        className="w-full md:w-auto px-12 py-3 shadow-lg shadow-accent/20 text-lg h-14"
                    >
                        <Save className="mr-2 h-6 w-6" />
                        Save Selection
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default HolidaySelectionPage;
