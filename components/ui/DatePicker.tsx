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
  setMonth, 
  setYear, 
  isBefore, 
  isAfter, 
  startOfDay, 
  parseISO, 
  isValid 
} from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: React.ReactNode;
  id: string;
  error?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  maxDate?: Date | string;
  minDate?: Date | string;
  requiredIndicator?: boolean;
  labelClassName?: string;
  description?: string;
}

// Convert any input format (YYYY-MM-DD, ISO, DD/MM/YYYY) to DD/MM/YYYY for text display
export const formatToDDMMYYYY = (val?: string | null): string => {
  if (!val) return '';
  const trimmed = val.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.split('T')[0].split('-');
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // Handle DD-MM-YYYY or DD.MM.YYYY
  if (/^\d{2}[-.]\d{2}[-.]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[-.]/);
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
  }

  try {
    const parsed = new Date(trimmed);
    if (isValid(parsed) && !isNaN(parsed.getTime())) {
      return format(parsed, 'dd/MM/yyyy');
    }
  } catch {
    // fallback
  }
  return '';
};

// Convert DD/MM/YYYY or typed string to YYYY-MM-DD ISO string if valid date
export const parseToYYYYMMDD = (input: string): string | null => {
  if (!input) return null;
  const trimmed = input.trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const testDate = new Date(y, m - 1, d);
    if (testDate.getFullYear() === y && testDate.getMonth() === m - 1 && testDate.getDate() === d) {
      return trimmed;
    }
    return null;
  }

  // Extract digits
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length !== 8) return null;

  // Assume DDMMYYYY
  const d = parseInt(digits.slice(0, 2), 10);
  const m = parseInt(digits.slice(2, 4), 10);
  const y = parseInt(digits.slice(4, 8), 10);

  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;

  const testDate = new Date(y, m - 1, d);
  if (
    testDate.getFullYear() !== y ||
    testDate.getMonth() !== m - 1 ||
    testDate.getDate() !== d
  ) {
    return null;
  }

  const dayStr = String(d).padStart(2, '0');
  const monthStr = String(m).padStart(2, '0');
  return `${y}-${monthStr}-${dayStr}`;
};

// Convert Date or string to Date object
const toDateObject = (val?: Date | string | null): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
      const parsed = parseISO(val.split('T')[0]);
      return isValid(parsed) ? parsed : null;
    }
    if (/^\d{2}\/\d{2}\/\d{4}/.test(val)) {
      const [d, m, y] = val.split('/').map(Number);
      const dt = new Date(y, m - 1, d);
      return isValid(dt) ? dt : null;
    }
    const d = new Date(val);
    return isValid(d) ? d : null;
  }
  return null;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const DatePicker: React.FC<DatePickerProps> = ({
  label,
  id,
  error,
  value,
  onChange,
  maxDate,
  minDate,
  requiredIndicator,
  labelClassName,
  description,
  disabled,
  readOnly,
  className,
  placeholder = 'DD/MM/YYYY',
  ...props
}) => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState<string>(() => formatToDDMMYYYY(value));
  
  // Selected date as Date object
  const selectedDate = useMemo(() => toDateObject(value), [value]);

  // View date for calendar navigation
  const [viewDate, setViewDate] = useState<Date>(() => selectedDate || new Date());

  const minDateObj = useMemo(() => toDateObject(minDate), [minDate]);
  const maxDateObj = useMemo(() => toDateObject(maxDate), [maxDate]);

  // Sync external value to displayValue and calendar view
  useEffect(() => {
    const formatted = formatToDDMMYYYY(value);
    setDisplayValue(formatted);
    const parsed = toDateObject(value);
    if (parsed) {
      setViewDate(parsed);
    }
  }, [value]);

  // Close calendar popup on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Format typing with intelligent mask without jumping cursor
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Allow user to clear completely
    if (!raw.trim()) {
      setDisplayValue('');
      if (onChange) onChange('');
      return;
    }

    // Keep only digits and slashes
    const cleaned = raw.replace(/[^\d/]/g, '');
    const digitsOnly = cleaned.replace(/\D/g, '').slice(0, 8);

    // Auto format as DD/MM/YYYY
    let formatted = digitsOnly;
    if (digitsOnly.length > 4) {
      formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`;
    } else if (digitsOnly.length > 2) {
      formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
    }

    setDisplayValue(formatted);

    // If 8 digits typed, check validity and emit ISO string
    if (digitsOnly.length === 8) {
      const iso = parseToYYYYMMDD(formatted);
      if (iso) {
        const parsed = toDateObject(iso);
        if (parsed) {
          setViewDate(parsed);
        }
        if (onChange) onChange(iso);
      }
    }
  };

  // Handle paste events (e.g. pasting YYYY-MM-DD or DD/MM/YYYY)
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;

    const formatted = formatToDDMMYYYY(pasted);
    if (formatted) {
      setDisplayValue(formatted);
      const iso = parseToYYYYMMDD(formatted);
      if (iso && onChange) {
        const parsed = toDateObject(iso);
        if (parsed) setViewDate(parsed);
        onChange(iso);
      }
    } else {
      // Fallback to plain digits
      const digits = pasted.replace(/\D/g, '').slice(0, 8);
      let formattedDigits = digits;
      if (digits.length > 4) {
        formattedDigits = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
      } else if (digits.length > 2) {
        formattedDigits = `${digits.slice(0, 2)}/${digits.slice(2)}`;
      }
      setDisplayValue(formattedDigits);
      if (digits.length === 8) {
        const iso = parseToYYYYMMDD(formattedDigits);
        if (iso && onChange) {
          const parsed = toDateObject(iso);
          if (parsed) setViewDate(parsed);
          onChange(iso);
        }
      }
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (props.onBlur) props.onBlur(e);
    
    // On blur, if incomplete or invalid, try to restore or sanitize
    if (displayValue && displayValue.replace(/\D/g, '').length < 8) {
      // Incomplete date
      if (value) {
        setDisplayValue(formatToDDMMYYYY(value));
      }
    } else if (displayValue) {
      const iso = parseToYYYYMMDD(displayValue);
      if (iso) {
        setDisplayValue(formatToDDMMYYYY(iso));
        if (onChange) onChange(iso);
      } else if (value) {
        setDisplayValue(formatToDDMMYYYY(value));
      }
    }
  };

  // Calendar navigation
  const handlePrevMonth = () => {
    setViewDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setViewDate(prev => addMonths(prev, 1));
  };

  const handleMonthSelect = (mIndex: number) => {
    setViewDate(prev => setMonth(prev, mIndex));
  };

  const handleYearSelect = (year: number) => {
    setViewDate(prev => setYear(prev, year));
  };

  // Select date from calendar
  const handleDateSelect = (date: Date) => {
    if (disabled || readOnly) return;
    if (minDateObj && isBefore(startOfDay(date), startOfDay(minDateObj))) return;
    if (maxDateObj && isAfter(startOfDay(date), startOfDay(maxDateObj))) return;

    const iso = format(date, 'yyyy-MM-dd');
    const formatted = format(date, 'dd/MM/yyyy');
    setDisplayValue(formatted);
    setViewDate(date);
    setIsOpen(false);
    if (onChange) {
      onChange(iso);
    }
    inputRef.current?.focus();
  };

  const handleSelectToday = () => {
    const today = new Date();
    handleDateSelect(today);
  };

  const handleClear = () => {
    setDisplayValue('');
    setIsOpen(false);
    if (onChange) {
      onChange('');
    }
    inputRef.current?.focus();
  };

  // Calendar days calculation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const start = startOfWeek(monthStart, { weekStartsOn: 0 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  // Year options list for fast jumping (e.g. 1920 to 2040)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const minYear = minDateObj ? minDateObj.getFullYear() : 1920;
    const maxYear = maxDateObj ? maxDateObj.getFullYear() : currentYear + 20;
    const years: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      years.push(y);
    }
    return years;
  }, [minDateObj, maxDateObj]);

  const baseClass = isMobile ? 'fo-input' : 'form-input';
  const errorClass = isMobile ? 'fo-input--error' : 'form-input--error';
  const finalClassName = `${baseClass} ${error ? errorClass : ''} pr-10 ${className || ''}`;

  return (
    <div ref={containerRef} className="w-full relative">
      {label && (
        <label htmlFor={id} className={labelClassName || "block text-sm font-medium text-muted mb-1.5"}>
          {label}
          {(requiredIndicator || props.required) && <span className="text-red-500 ml-1 font-bold">*</span>}
        </label>
      )}
      {description && <p className="text-xs text-muted mb-1">{description}</p>}

      <div className="relative">
        <input
          {...props}
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          maxLength={10}
          value={displayValue}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onBlur={handleBlur}
          disabled={disabled}
          readOnly={readOnly}
          className={finalClassName}
          autoComplete="off"
        />

        {/* Toggle Calendar Button */}
        <button
          type="button"
          onClick={() => {
            if (!disabled && !readOnly) {
              setIsOpen(prev => !prev);
            }
          }}
          disabled={disabled || readOnly}
          title="Open calendar"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-emerald-500/70 hover:text-emerald-400 hover:bg-emerald-500/10 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>

        {/* Calendar Popover */}
        {isOpen && (
          <div 
            className="absolute left-0 top-[calc(100%+6px)] z-[100] w-[310px] sm:w-[320px] p-3.5 rounded-2xl shadow-2xl border border-emerald-500/20 bg-[#061e12] text-white backdrop-blur-xl animate-fade-in"
            style={{ boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(16, 185, 129, 0.15)' }}
          >
            {/* Header: Month & Year Selectors with Prev/Next */}
            <div className="flex items-center justify-between gap-1.5 mb-3 pb-2 border-b border-emerald-500/15">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1.5">
                {/* Month Dropdown */}
                <select
                  value={viewDate.getMonth()}
                  onChange={(e) => handleMonthSelect(parseInt(e.target.value, 10))}
                  className="bg-[#04150c] text-xs font-bold text-white border border-emerald-500/20 rounded-lg px-2 py-1 outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  {MONTH_NAMES.map((name, index) => (
                    <option key={name} value={index} className="bg-[#061e12] text-white">
                      {name}
                    </option>
                  ))}
                </select>

                {/* Year Dropdown */}
                <select
                  value={viewDate.getFullYear()}
                  onChange={(e) => handleYearSelect(parseInt(e.target.value, 10))}
                  className="bg-[#04150c] text-xs font-bold text-white border border-emerald-500/20 rounded-lg px-2 py-1 outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y} className="bg-[#061e12] text-white">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEK_DAYS.map(day => (
                <span key={day} className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-wider py-0.5">
                  {day}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const inMonth = isSameMonth(day, viewDate);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDay = isToday(day);
                const isPastMin = minDateObj ? isBefore(startOfDay(day), startOfDay(minDateObj)) : false;
                const isAfterMax = maxDateObj ? isAfter(startOfDay(day), startOfDay(maxDateObj)) : false;
                const isDisabledDay = isPastMin || isAfterMax;

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isDisabledDay}
                    onClick={() => handleDateSelect(day)}
                    className={`
                      h-8 w-full rounded-lg text-xs font-medium transition-all flex items-center justify-center relative
                      ${!inMonth ? 'text-white/20' : 'text-white/90'}
                      ${isDisabledDay ? 'opacity-20 cursor-not-allowed' : 'hover:bg-emerald-500/20 hover:text-white cursor-pointer'}
                      ${isSelected ? '!bg-emerald-500 !text-white font-bold shadow-md shadow-emerald-500/30 ring-1 ring-emerald-400' : ''}
                      ${isTodayDay && !isSelected ? 'border border-emerald-400/50 font-bold text-emerald-300' : ''}
                    `}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            {/* Bottom Quick Action Footer */}
            <div className="mt-3 pt-2.5 border-t border-emerald-500/15 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSelectToday}
                className="px-2.5 py-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md font-semibold transition-colors"
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-1.5 text-[10px] font-medium text-red-500 tracking-wide">{error}</p>}
    </div>
  );
};

export default DatePicker;