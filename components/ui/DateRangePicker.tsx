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
  startOfDay,
  isAfter,
  parseISO
} from 'date-fns';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface DateRangePickerProps {
  label: string;
  id: string;
  error?: string;
  startDate?: string | null;
  endDate?: string | null;
  onChange: (start: string | null, end: string | null) => void;
  maxDate?: Date;
  minDate?: Date;
  className?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ 
  label, 
  id, 
  error, 
  startDate, 
  endDate, 
  onChange, 
  maxDate, 
  minDate, 
  className 
}) => {
  const [isOpenLocal, setIsOpenLocal] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const pickerRef = useRef<HTMLDivElement>(null);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // local selection state for the range
  const [tempStart, setTempStart] = useState<Date | null>(startDate ? parseISO(startDate) : null);
  const [tempEnd, setTempEnd] = useState<Date | null>(endDate ? parseISO(endDate) : null);

  const [viewDate, setViewDate] = useState<Date>(tempStart || new Date());
  
  const isOpenMobile = isMobile && searchParams.get('picker') === id;
  const isOpen = isMobile ? isOpenMobile : isOpenLocal;

  useEffect(() => {
    if (isOpen) {
      setTempStart(startDate ? parseISO(startDate) : null);
      setTempEnd(endDate ? parseISO(endDate) : null);
      setViewDate(startDate ? parseISO(startDate) : new Date());
    }
  }, [isOpen, startDate, endDate]);

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

  const handleDateClick = (date: Date) => {
    if (minDate && isBefore(startOfDay(date), startOfDay(minDate))) return;
    if (maxDate && isAfter(startOfDay(date), startOfDay(maxDate))) return;

    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(date);
      setTempEnd(null);
    } else {
      if (isBefore(date, tempStart)) {
        setTempStart(date);
      } else {
        setTempEnd(date);
      }
    }
  };

  const handleDone = () => {
    if (tempStart && tempEnd) {
      onChange(format(tempStart, 'yyyy-MM-dd'), format(tempEnd, 'yyyy-MM-dd'));
      closePicker();
    }
  };

  const navigateMonth = (direction: 'next' | 'prev') => {
    setViewDate(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [viewDate]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarContent = (
    <div className={isMobile ? 'date-picker-screen animate-slide-up isolate' : 'absolute mt-2 left-0 z-[70] rounded-2xl shadow-2xl border border-emerald-900/30 w-[320px] bg-[#041b0f] p-4 text-white animate-fade-in-scale'}>
      {isMobile && (
        <header className="flex items-center p-4 border-b border-white/10 bg-[#041b0f] sticky top-0 z-10 flex-shrink-0">
          <button onClick={closePicker} className="date-picker-btn p-3 -ml-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h2 className="ml-4 text-xl font-bold text-white tracking-tight">Select Date Range</h2>
        </header>
      )}

      <div className={isMobile ? 'flex-1 flex flex-col justify-between overflow-hidden' : ''}>
        <div className={isMobile ? 'flex-1 flex flex-col justify-center max-w-lg mx-auto w-full px-6' : ''}>
          <div className={`flex items-center justify-between px-1 flex-shrink-0 ${isMobile ? 'mb-8' : 'mb-6 pt-2'}`}>
            <button onClick={() => navigateMonth('prev')} className="date-picker-btn p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 scale-110">
              <ChevronLeft className={isMobile ? 'h-7 w-7' : 'h-5 w-5'} />
            </button>
            <div className={isMobile ? 'text-2xl font-black uppercase tracking-[0.15em] text-emerald-50' : 'text-base font-bold text-white'}>
              {format(viewDate, 'MMMM yyyy')}
            </div>
            <button onClick={() => navigateMonth('next')} className="date-picker-btn p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 scale-110">
              <ChevronRight className={isMobile ? 'h-7 w-7' : 'h-5 w-5'} />
            </button>
          </div>

          <div className="grid grid-cols-7 w-full mb-4 flex-shrink-0">
            {weekDays.map(day => <div key={day} className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500/40">{day}</div>)}
          </div>

          <div className="grid grid-cols-7 w-full gap-1 flex-shrink-0">
            {days.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, viewDate);
              const isSelectedStart = tempStart && isSameDay(day, tempStart);
              const isSelectedEnd = tempEnd && isSameDay(day, tempEnd);
              const isInRange = tempStart && tempEnd && isAfter(day, tempStart) && isBefore(day, tempEnd);
              const isTodayDay = isToday(day);
              const isDisabled = (minDate && isBefore(startOfDay(day), startOfDay(minDate))) || (maxDate && isAfter(startOfDay(day), startOfDay(maxDate)));

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDateClick(day)}
                  disabled={isDisabled}
                  className={`
                    date-picker-btn relative aspect-square text-sm font-bold transition-all duration-200
                    ${!isCurrentMonth ? 'text-white/5 opacity-20' : 'text-white'}
                    ${isDisabled ? 'opacity-5 cursor-not-allowed scale-90' : 'hover:bg-emerald-500/10'}
                    ${isSelectedStart || isSelectedEnd ? '!bg-emerald-500 !text-white z-10 rounded-full' : ''}
                    ${isInRange ? 'bg-emerald-500/20 text-emerald-300' : ''}
                    ${isTodayDay && !isSelectedStart && !isSelectedEnd ? 'ring-1 ring-emerald-500/30' : ''}
                  `}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>

        {isMobile && (
          <div className="p-10 pb-[40vh] flex justify-end flex-shrink-0 mt-8 mb-auto">
            <div className={`p-6 bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 flex flex-col items-center gap-4 transition-all duration-500 ${tempStart ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <div className="text-center space-y-1">
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Active Selection</span>
                <span className="block text-lg font-bold text-emerald-400 tabular-nums">
                  {tempStart ? format(tempStart, 'dd MMM') : '—'} 
                  {tempEnd ? ` - ${format(tempEnd, 'dd MMM, yyyy')}` : ' - Select end'}
                </span>
              </div>
              <button 
                onClick={handleDone}
                disabled={!tempStart || !tempEnd}
                className={`date-picker-btn bg-emerald-500 text-white px-8 py-3 text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 ${(!tempStart || !tempEnd) ? 'opacity-30' : ''}`}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div ref={pickerRef} className="w-full">
      {label && <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-emerald-500/60">{label}</label>}
      <div className="relative">
        <div className={`fo-input flex justify-between items-center cursor-pointer ${className || ''}`} onClick={openPicker}>
          <span className={startDate ? 'text-white' : 'text-white/30'}>
            {startDate ? `${format(parseISO(startDate), 'dd MMM')} - ${endDate ? format(parseISO(endDate), 'dd MMM, yyyy') : '...'}` : 'Select date range'}
          </span>
          <CalendarIcon className="h-4 w-4 text-emerald-500/50" />
        </div>
        {isOpen && (isMobile ? createPortal(calendarContent, document.body) : calendarContent)}
      </div>
      {error && <p className="mt-1.5 text-[10px] font-medium text-red-500 tracking-wide">{error}</p>}
    </div>
  );
};

export default DateRangePicker;
