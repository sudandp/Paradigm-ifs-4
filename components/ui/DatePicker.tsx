import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday, 
  addMonths, 
  subMonths,
  isBefore,
  startOfDay
} from 'date-fns';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  id: string;
  error?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  maxDate?: Date;
  minDate?: Date;
}

const DatePicker: React.FC<DatePickerProps> = ({ label, id, error, value, onChange, maxDate, minDate, ...props }) => {
  const [isOpenLocal, setIsOpenLocal] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const pickerRef = useRef<HTMLDivElement>(null);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Navigation state within the calendar
  const [viewDate, setViewDate] = useState<Date>(value ? new Date(value + 'T12:00:00') : new Date());
  
  // On mobile, we use search params to manage "screen" state
  const isOpenMobile = isMobile && searchParams.get('picker') === id;
  const isOpen = isMobile ? isOpenMobile : isOpenLocal;

  // Sync viewDate when value changes or picker opens
  useEffect(() => {
    if (isOpen) {
      setViewDate(value ? new Date(value + 'T12:00:00') : new Date());
    }
  }, [isOpen, value]);

  const closePicker = () => {
    if (isMobile && isOpenMobile) {
      navigate(-1);
    } else {
      setIsOpenLocal(false);
    }
  };

  const openPicker = () => {
    if (isMobile) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('picker', id);
      setSearchParams(newParams);
    } else {
      setIsOpenLocal(true);
    }
  };

  const currentSelectedDate = value ? new Date(value + 'T12:00:00') : null;

  const handleDateClick = (date: Date) => {
    // Check if disabled
    if (minDate && isBefore(startOfDay(date), startOfDay(minDate))) return;
    if (maxDate && isBefore(startOfDay(maxDate), startOfDay(date))) return;

    if (onChange) {
      onChange(format(date, 'yyyy-MM-dd'));
    }
    
    // Auto-close only on desktop
    if (!isMobile) {
      closePicker();
    }
  };

  const navigateMonth = (direction: 'next' | 'prev') => {
    setViewDate(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isMobile && pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpenLocal(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile]);

  // Calendar Logic
  const days = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    });
  }, [viewDate]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarContent = (
    <div 
      className={`
        ${isMobile 
          ? 'date-picker-screen animate-slide-up isolate' 
          : 'absolute mt-2 left-0 z-[70] rounded-2xl shadow-2xl overflow-hidden border border-emerald-900/30 w-[320px] bg-[#041b0f] p-4 text-white animate-fade-in-scale'}
      `}
    >
      {/* Header for Mobile - Row 1 */}
      {isMobile ? (
        <header className="flex items-center p-4 border-b border-white/10 bg-[#041b0f] sticky top-0 z-10 flex-shrink-0">
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); closePicker(); }} 
            className="date-picker-btn p-3 -ml-2 bg-emerald-500/20 text-emerald-400 rounded-xl"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h2 className="ml-4 text-xl font-bold text-white tracking-tight">Select {label || 'Date'}</h2>
        </header>
      ) : null}

      <div className={`${isMobile ? 'flex-1 flex flex-col overflow-y-auto' : ''}`}>
        <div className={`${isMobile ? 'flex-shrink-0 flex flex-col justify-center max-w-lg mx-auto w-full px-6 pt-12 mt-auto' : ''}`}>
          {/* Month Navigation */}
          <div className={`flex items-center justify-between px-1 flex-shrink-0 ${isMobile ? 'mb-8' : 'mb-6 pt-2'}`}>
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigateMonth('prev'); }}
              className={`date-picker-btn p-3 rounded-2xl ${isMobile ? 'bg-emerald-500/10 text-emerald-400 scale-110' : 'hover:bg-emerald-800/20 text-emerald-400'}`}
            >
              <ChevronLeft className={`${isMobile ? 'h-7 w-7' : 'h-5 w-5'}`} />
            </button>
            <div className={`${isMobile ? 'text-2xl font-black uppercase tracking-[0.15em] text-emerald-50' : 'text-base font-bold text-white'}`}>
              {format(viewDate, 'MMMM yyyy')}
            </div>
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigateMonth('next'); }}
              className={`date-picker-btn p-3 rounded-2xl ${isMobile ? 'bg-emerald-500/10 text-emerald-400 scale-110' : 'hover:bg-emerald-800/20 text-emerald-400'}`}
            >
              <ChevronRight className={`${isMobile ? 'h-7 w-7' : 'h-5 w-5'}`} />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 w-full mb-4 flex-shrink-0">
            {weekDays.map(day => (
              <div key={day} className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500/40">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 w-full gap-2 sm:gap-4 flex-shrink-0">
            {days.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, viewDate);
              const isSelected = currentSelectedDate && isSameDay(day, currentSelectedDate);
              const isTodayDay = isToday(day);
              const isPast = minDate && isBefore(startOfDay(day), startOfDay(minDate));
              const isFuture = maxDate && isBefore(startOfDay(maxDate), startOfDay(day));
              const isDisabled = isPast || isFuture;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDateClick(day); }}
                  disabled={isDisabled}
                  className={`
                    date-picker-btn relative aspect-square text-base font-black rounded-full transition-all duration-300
                    ${!isCurrentMonth ? 'text-white/5 opacity-20' : 'text-white'}
                    ${isDisabled ? 'opacity-5 cursor-not-allowed scale-90' : 'hover:bg-emerald-500/10 active:scale-90'}
                    ${isSelected ? '!bg-emerald-500 !text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] !opacity-100 scale-110 z-10' : ''}
                    ${isTodayDay && !isSelected ? 'ring-2 ring-emerald-500/30 text-emerald-400' : ''}
                  `}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer / Selection Box for Mobile */}
        {isMobile && (
          <div className="p-10 pb-[40vh] flex justify-end flex-shrink-0 mt-8 mb-auto">
            <div className={`
                p-6 bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 
                flex flex-col items-center gap-4 transition-all duration-500
                ${currentSelectedDate ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
            `}>
              <div className="text-center space-y-1">
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Active Selection</span>
                <span className="block text-lg font-bold text-emerald-400 tabular-nums">
                  {currentSelectedDate ? format(currentSelectedDate, 'dd MMM, yyyy') : '—'}
                </span>
              </div>
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); closePicker(); }}
                disabled={!currentSelectedDate}
                className="date-picker-btn bg-emerald-500 text-white px-8 py-3 text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const baseClass = isMobile ? 'fo-input' : 'form-input';
  const errorClass = isMobile ? 'fo-input--error' : 'form-input--error';
  const finalClassName = `${baseClass} ${error ? errorClass : ''} flex justify-between items-center cursor-pointer ${props.className || ''}`;
  const selectedDateValue = currentSelectedDate || new Date();
  const selectedDateDisplay = value && !isNaN(selectedDateValue.getTime()) ? format(selectedDateValue, 'dd MMM, yyyy') : 'Select date';

  return (
    <div ref={pickerRef} className="w-full">
      {label && <div className={`block text-xs font-semibold mb-1.5 uppercase tracking-wider ${isDark ? 'text-emerald-500/60' : 'text-muted'}`}>{label}</div>}
      <div className="relative">
        <div
          id={id}
          className={finalClassName}
          onClick={openPicker}
          role="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={`Date picker for ${label}`}
        >
          <span className={value ? (isMobile ? 'text-white' : 'text-primary-text') : (isMobile ? 'text-white/30' : 'text-muted')}>
            {selectedDateDisplay}
          </span>
          <CalendarIcon className="h-4 w-4 text-emerald-500/50" />
        </div>
        
        {isOpen && (isMobile ? createPortal(calendarContent, document.body) : calendarContent)}
      </div>
      {error && <p className="mt-1.5 text-[10px] font-medium text-red-500 tracking-wide">{error}</p>}
    </div>
  );
};

export default DatePicker;