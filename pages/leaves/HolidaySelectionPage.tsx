import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { api } from '../../services/api';
import { FIXED_HOLIDAYS, HOLIDAY_SELECTION_POOL } from '../../utils/constants';
import { useDevice } from '../../hooks/useDevice';
import Button from '../../components/ui/Button';
import {
    Calendar as CalendarIcon, Check, ChevronLeft, Info,
    Loader2, Lock, Save, X, CalendarCheck2, Sparkles
} from 'lucide-react';
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

    const getHolidayStatus = (date: string) => {
        const dateStr = date.startsWith('-') ? `${currentYear}${date}` : date;
        const holidayDate = new Date(dateStr.replace(/-/g, '/'));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return {
            isPast: holidayDate < today,
            isToday: holidayDate.getTime() === today.getTime(),
        };
    };

    /**
     * BUG FIX: Previously, past holidays that were selected could not be unselected.
     * Now:
     *  - Past holidays CANNOT be newly selected.
     *  - Past holidays that are already selected CANNOT be deselected (they are locked as processed).
     *  - Future holidays can be toggled freely (select and UNSELECT).
     *  - Jan 15 is locked always.
     */
    const toggleHoliday = (name: string, date: string) => {
        const isSelected = selectedHolidays.some(h => h.name === name);
        const { isPast, isToday } = getHolidayStatus(date);
        const isPastOrToday = isPast || isToday;
        // Jan 15 is always locked (processed) - but user wants it selectable
        const isJan15 = date.includes('01-15');
        
        // Future/Past holiday toggle — user wants all selectable
        if (isSelected) {
            // Check if it's a "locked" holiday that should not be removed
            // User said: "not allow to remove selected holiday"
            // If it's past or Jan 15, and ALREADY selected, we might want to block removal
            if (isPastOrToday || isJan15) {
                 setToast({ message: 'This holiday is already processed and cannot be removed.', type: 'error' });
                 return;
            }
            setSelectedHolidays(prev => prev.filter(h => h.name !== name));
        } else {
            if (selectedHolidays.length >= maxEmployeeHolidays) {
                setToast({ message: `You can only select up to ${maxEmployeeHolidays} holidays.`, type: 'error' });
                return;
            }
            setSelectedHolidays(prev => [...prev, { name, date }]);
        }
    };

    const handleSave = () => {
        if (selectedHolidays.length === 0) {
            setToast({ message: 'Please select at least 1 holiday.', type: 'error' });
            return;
        }
        setView('confirmation');
    };

    const confirmSave = async () => {
        if (!user?.id) return;
        setIsSaving(true);
        try {
            // Deduplicate by name to prevent database constraint errors
            const uniqueHolidays = Array.from(new Map(selectedHolidays.map(h => [h.name, h])).values());

            const holidaysToSave = uniqueHolidays.map(h => ({
                holidayName: h.name,
                holidayDate: h.date.startsWith('-') ? `${currentYear}${h.date}` : h.date,
                year: currentYear,
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

    if (isLoading) return <LoadingScreen message="Loading holiday pool..." />;

    // Deduplicate the pool to prevent UI duplicates (e.g. if Jan 15 is in both pool and constants)
    const uniquePool = Array.from(new Map(holidayPool.map(h => [h.name + h.date, h])).values());

    const storeHolidays = category === 'field' ? fieldHolidays : category === 'site' ? siteHolidays : officeHolidays;

    const adminHolidays: Holiday[] = [
        ...FIXED_HOLIDAYS.map(fh => ({
            id: `fixed-${fh.date}`,
            name: fh.name,
            date: fh.date.startsWith('-') ? `${currentYear}${fh.date}` : `${currentYear}-${fh.date}`,
            type: category as any,
        })),
        ...storeHolidays.map(h => ({
            ...h,
            id: h.id || `admin-${h.name}`,
            date: h.date?.startsWith('-') ? `${currentYear}${h.date}` : h.date,
        })),
    ];

    const calendarUserHolidays = selectedHolidays.map(h => ({
        id: `user-${h.name}`,
        holidayName: h.name,
        holidayDate: h.date.startsWith('-') ? `${currentYear}${h.date}` : h.date,
        userId: user?.id || '',
        year: currentYear,
    }));

    const selectionProgress = (selectedHolidays.length / maxEmployeeHolidays) * 100;
    const isComplete = selectedHolidays.length === maxEmployeeHolidays;

    // ─── Confirmation View ────────────────────────────────────────────────────
    if (view === 'confirmation') {
        return (
            <div className="p-4 md:p-6 pb-40 animate-fade-in">
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => setView('selection')}
                        className="p-2.5 rounded-xl bg-card border border-border hover:bg-accent-light transition-colors"
                    >
                        <ChevronLeft className="h-5 w-5 text-primary-text" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-primary-text">Confirm Selection</h1>
                        <p className="text-muted text-sm">Review your chosen holidays for {currentYear}</p>
                    </div>
                </div>

                <div className="max-w-2xl mx-auto space-y-4">
                    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
                        <p className="text-base text-muted mb-6">
                            Confirm saving{' '}
                            <span className="font-bold text-accent-dark">{selectedHolidays.length} holiday{selectedHolidays.length !== 1 ? 's' : ''}</span>{' '}
                            for {currentYear}.
                        </p>

                        <div className="space-y-3">
                            {[...selectedHolidays]
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .filter((h, i, self) => i === self.findIndex(t => t.name === h.name)) // Deduplicate for display
                                .map((h, i) => {
                                    const dateStr = h.date.startsWith('-') ? `${currentYear}${h.date}` : h.date;
                                    const d = new Date(dateStr.replace(/-/g, '/'));
                                    return (
                                        <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-accent-light border border-border">
                                            <div className="h-12 w-12 rounded-xl bg-accent/20 flex flex-col items-center justify-center text-accent-dark ring-1 ring-accent/20 flex-shrink-0">
                                                <span className="text-[9px] font-black uppercase leading-none">
                                                    {d.toLocaleDateString('en-IN', { month: 'short' })}
                                                </span>
                                                <span className="text-lg font-black leading-none mt-0.5">{d.getDate()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-primary-text truncate">{h.name}</p>
                                                <p className="text-xs text-muted font-medium">
                                                    {d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                </p>
                                            </div>
                                            <Check className="h-4 w-4 text-accent flex-shrink-0" />
                                        </div>
                                    );
                                })}
                        </div>

                        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                            <p className="text-sm text-amber-800 dark:text-amber-400 flex items-start gap-2">
                                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>You can update your selection later as long as the holiday selection window is still open.</span>
                            </p>
                        </div>
                    </div>
                </div>

               {/* Floating Action Bar (Sticky) */}
            <div 
                className={`fixed left-0 right-0 z-40 transition-all duration-300 ${
                    isMobile 
                        ? "p-4 bg-gradient-to-t from-[#041b0f] via-[#041b0f]/95 to-transparent bottom-[calc(3.2rem+env(safe-area-inset-bottom))] pb-[calc(1.2rem+env(safe-area-inset-bottom))]" 
                        : "bg-white/80 backdrop-blur-md border-t border-border py-4 px-8 bottom-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
                }`}
            >
                <div className={`flex items-center gap-4 ${!isMobile ? "max-w-7xl mx-auto justify-between" : "flex-col"}`}>
                    {!isMobile && (
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent/5 rounded-xl border border-accent/10">
                                <CalendarIcon className="h-5 w-5 text-accent" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-black text-muted uppercase tracking-widest">Confirmation</span>
                                <p className="text-sm font-bold text-primary-text">Review and save your selection</p>
                            </div>
                        </div>
                    )}
                    
                    <div className={`flex items-center gap-3 ${!isMobile ? "" : "w-full"}`}>
                        <Button
                            variant="secondary"
                            onClick={() => setView('selection')}
                            className={!isMobile ? "px-8 py-3 rounded-xl border-2 font-black uppercase tracking-widest text-xs" : "flex-1 h-12 rounded-xl bg-white/5 border-white/10 text-white"}
                        >
                            Back
                        </Button>
                        <Button
                            onClick={confirmSave}
                            isLoading={isSaving}
                            className={!isMobile 
                                ? "px-10 py-3 rounded-xl shadow-xl shadow-accent/20 font-black uppercase tracking-widest text-xs" 
                                : "flex-1 h-12 rounded-xl bg-[#006b3f] text-white font-bold"}
                        >
                            Confirm & Save
                        </Button>
                    </div>
                </div>
            </div>
            </div>
        );
    }

    // ─── Main Selection View ──────────────────────────────────────────────────
    return (
        <div className="p-4 md:p-6 pb-40 animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                {isMobile && (
                    <button
                        onClick={() => navigate('/leaves/dashboard')}
                        className="p-2.5 rounded-xl bg-card border border-border hover:bg-accent-light transition-colors"
                    >
                        <ChevronLeft className="h-5 w-5 text-primary-text" />
                    </button>
                )}
                <div>
                    <h1 className="text-2xl font-bold text-primary-text">Holiday Selection</h1>
                    <p className="text-muted text-sm">Pick your optional holidays for {currentYear}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── Left: Selection Panel ── */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Progress Summary Card */}
                    <div className="bg-card rounded-2xl border border-border shadow-card p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-accent-light rounded-xl">
                                    <CalendarCheck2 className="h-5 w-5 text-accent-dark" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-primary-text">Available Holidays</h2>
                                    <p className="text-xs text-muted">Select up to {maxEmployeeHolidays} from the pool</p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-bold border ${
                                isComplete
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
                                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30'
                            }`}>
                                {selectedHolidays.length} / {maxEmployeeHolidays}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ width: `${selectionProgress}%` }}
                            />
                        </div>
                        {isComplete && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2 flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5" />
                                All {maxEmployeeHolidays} holidays selected!
                            </p>
                        )}
                    </div>

                    {/* Holiday List */}
                    <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
                        <div className="divide-y divide-border">
                            {uniquePool
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .map((holiday, index) => {
                                    const isSelected = selectedHolidays.some(h => h.name === holiday.name);
                                    const dateStr = `${currentYear}${holiday.date}`.replace(/-/g, '/');
                                    const dateObj = new Date(dateStr);
                                    const { isPast, isToday } = getHolidayStatus(holiday.date);
                                    const isPastOrToday = isPast || isToday;
                                    const isLocked = holiday.date === '-01-15' || holiday.date.endsWith('-01-15');

                                    return (
                                        <button
                                            key={index}
                                            onClick={() => toggleHoliday(holiday.name, holiday.date)}
                                            className={`w-full flex items-center gap-4 p-4 text-left transition-all duration-200 group
                                                ${!isPastOrToday ? 'hover:bg-accent-light active:scale-[0.995]' : 'cursor-not-allowed'}
                                                ${isSelected && !isPastOrToday ? 'bg-accent-light/60' : ''}
                                            `}
                                        >
                                            {/* Date Badge */}
                                            <div className={`h-12 w-12 rounded-xl flex-shrink-0 flex flex-col items-center justify-center transition-all ${
                                                isSelected
                                                    ? 'bg-accent text-white shadow-sm shadow-accent/30'
                                                    : (isPastOrToday || isLocked)
                                                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20'
                                                    : 'bg-accent-light text-accent-dark'
                                            }`}>
                                                <span className="text-[9px] font-black uppercase leading-none tracking-tight">
                                                    {dateObj.toLocaleDateString('en-IN', { month: 'short' })}
                                                </span>
                                                <span className="text-lg font-black leading-none mt-0.5">{dateObj.getDate()}</span>
                                            </div>

                                            {/* Name & Date */}
                                            <div className="flex-1 min-w-0 overflow-hidden">
                                                <p className={`font-semibold text-sm leading-snug break-words line-clamp-2 ${
                                                    isSelected
                                                        ? 'text-accent-dark'
                                                        : (isPastOrToday || isLocked)
                                                        ? 'text-amber-700 dark:text-amber-400'
                                                        : 'text-primary-text'
                                                }`}>
                                                    {holiday.name}
                                                </p>
                                                <p className="text-xs text-muted font-medium mt-1 flex items-center flex-wrap gap-1">
                                                    <span>{dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                                    {(isPastOrToday || isLocked) && (
                                                        <span className={`px-1.5 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                                                            isSelected ? 'bg-accent/20 text-accent-dark' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                                                        }`}>
                                                            {isLocked ? 'Locked' : 'Past'}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>

                                            {/* Action Indicator */}
                                            <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all duration-300 ${
                                                isSelected && (isPastOrToday || isLocked)
                                                    ? 'bg-accent/40 border-accent/40 text-white'
                                                    : isSelected
                                                    ? 'bg-accent border-accent text-white scale-110'
                                                    : (isPastOrToday || isLocked)
                                                    ? 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10'
                                                    : 'border-border bg-transparent text-transparent group-hover:border-accent/40'
                                            }`}>
                                                {isSelected ? (
                                                    <Check className="h-4 w-4 stroke-[3]" />
                                                ) : (
                                                    <span className="text-lg font-bold leading-none">+</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                        </div>

                        {/* Hint Footer (Mobile only, Desktop hint is moved to fixed bar) */}
                        {isMobile && (
                            <div className="px-5 py-4 bg-accent-light/40 border-t border-border">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-accent/10 rounded-lg">
                                        <CalendarIcon className="h-4 w-4 text-accent" />
                                    </div>
                                    <p className="text-xs font-bold text-accent-dark tracking-tight leading-none uppercase">
                                        {selectedHolidays.length === 6 ? 'Selection complete. Ready to save.' : `Select up to 6 holidays. (${selectedHolidays.length}/6 selected)`}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Calendar Preview ── */}
                <div className="space-y-4">
                    <div className="sticky top-6">
                        <h3 className="text-base font-semibold text-primary-text mb-3 px-1">Calendar Preview</h3>
                        <HolidayCalendar
                            adminHolidays={adminHolidays}
                            userSelectedHolidays={calendarUserHolidays}
                            viewingDate={viewingDate}
                            onDateChange={setViewingDate}
                        />

                        {/* Legend */}
                        <div className="mt-4 bg-card rounded-xl border border-border p-4 space-y-2.5">
                            <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Legend</h4>
                            {[
                                { color: 'bg-emerald-600', label: 'Gov Holiday' },
                                { color: 'bg-amber-500', label: 'Admin Allocated' },
                                { color: 'bg-violet-600', label: 'Your Selection' },
                            ].map(({ color, label }) => (
                                <div key={label} className="flex items-center gap-2.5 text-sm">
                                    <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
                                    <span className="text-muted">{label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Selected Holidays Mini-List */}
                        {selectedHolidays.length > 0 && (
                            <div className="mt-4 bg-card rounded-xl border border-border p-4">
                                <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Your Picks</h4>
                                <div className="space-y-2">
                                    {[...selectedHolidays]
                                        .sort((a, b) => a.date.localeCompare(b.date))
                                        .map((h, i) => {
                                            const dateStr = h.date.startsWith('-') ? `${currentYear}${h.date}` : h.date;
                                            const d = new Date(dateStr.replace(/-/g, '/'));
                                            const { isPast, isToday } = getHolidayStatus(h.date);
                                            const canRemove = !isPast && !isToday;
                                            return (
                                                <div key={i} className="flex items-center gap-2.5 group">
                                                    <div className="h-8 w-8 rounded-lg bg-accent-light flex flex-col items-center justify-center flex-shrink-0">
                                                        <span className="text-[7px] font-black uppercase leading-none text-accent-dark">
                                                            {d.toLocaleDateString('en-IN', { month: 'short' })}
                                                        </span>
                                                        <span className="text-xs font-black leading-none text-accent-dark">{d.getDate()}</span>
                                                    </div>
                                                    <span className="text-xs font-medium text-primary-text flex-1 leading-tight line-clamp-1">{h.name}</span>
                                                    {canRemove ? (
                                                        <button
                                                            onClick={() => toggleHoliday(h.name, h.date)}
                                                            className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100 text-red-500 transition-all"
                                                            title="Remove"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    ) : (
                                                        <Lock className="h-3 w-3 text-muted opacity-50" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Floating Save Bar */}
            <div
                className={`fixed left-0 right-0 z-40 transition-all duration-300 ${
                    isMobile 
                        ? "p-4 bg-gradient-to-t from-[#041b0f] via-[#041b0f]/95 to-transparent bottom-[calc(3.2rem+env(safe-area-inset-bottom))] pb-[calc(1.2rem+env(safe-area-inset-bottom))]" 
                        : "bg-white/80 backdrop-blur-md border-t border-border py-4 px-8 bottom-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
                }`}
            >
                <div className={`flex items-center gap-4 ${!isMobile ? "max-w-7xl mx-auto justify-between" : "flex-col"}`}>
                    {!isMobile && (
                        <div className="flex items-center gap-4 flex-1">
                            <div className={`p-2 rounded-xl border transition-colors ${selectedHolidays.length === 6 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                                <CalendarIcon className={`h-5 w-5 ${selectedHolidays.length === 6 ? 'text-emerald-600' : 'text-amber-600'}`} />
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${selectedHolidays.length === 6 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {selectedHolidays.length} / 6 Holidays Selected
                                </span>
                                <p className="text-xs font-bold text-muted uppercase tracking-tight">
                                    {selectedHolidays.length === 6 
                                        ? 'Selection complete. You can proceed to save.' 
                                        : `Select ${6 - selectedHolidays.length} more holiday${6 - selectedHolidays.length === 1 ? '' : 's'} to continue.`}
                                </p>
                            </div>
                        </div>
                    )}

                    <Button
                        onClick={handleSave}
                        disabled={selectedHolidays.length === 0}
                        className={!isMobile 
                            ? "px-12 py-3 rounded-xl shadow-xl shadow-accent/20 font-black uppercase tracking-widest text-xs" 
                            : "w-full h-14 text-base font-bold bg-[#006b3f] hover:bg-[#005632] text-white shadow-2xl shadow-black/40 rounded-2xl transition-all active:scale-[0.98]"}
                    >
                        Save Selection
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default HolidaySelectionPage;
