import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: React.ReactNode;
  id: string;
  error?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  maxDate?: Date;
  minDate?: Date;
}

// Convert YYYY-MM-DD (or ISO date string) to DD/MM/YYYY for input display
const formatToDDMMYYYY = (val?: string | null): string => {
  if (!val) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return val;
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    const [y, m, d] = val.split('T')[0].split('-');
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  try {
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    }
  } catch {
    // fallback
  }
  return '';
};

// Convert DD/MM/YYYY to YYYY-MM-DD ISO string if valid date
const formatToYYYYMMDD = (ddmmyyyy: string): string | null => {
  const digits = ddmmyyyy.replace(/\D/g, '');
  if (digits.length !== 8) return null;
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

const DatePicker: React.FC<DatePickerProps> = ({
  label,
  id,
  error,
  value,
  onChange,
  maxDate,
  minDate,
  ...props
}) => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [displayValue, setDisplayValue] = useState<string>(() => formatToDDMMYYYY(value));

  // Sync external value changes to displayValue
  useEffect(() => {
    const formatted = formatToDDMMYYYY(value);
    setDisplayValue(formatted);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '').slice(0, 8);

    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    setDisplayValue(formatted);

    if (digits.length === 8) {
      const isoDate = formatToYYYYMMDD(formatted);
      if (isoDate && onChange) {
        onChange(isoDate);
      } else if (!isoDate && onChange) {
        onChange('');
      }
    } else if (digits.length === 0 && onChange) {
      onChange('');
    }
  };

  const baseClass = isMobile ? 'fo-input' : 'form-input';
  const errorClass = isMobile ? 'fo-input--error' : 'form-input--error';
  const finalClassName = `${baseClass} ${error ? errorClass : ''} pr-10 ${props.className || ''}`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-muted mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          {...props}
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/YYYY"
          maxLength={10}
          value={displayValue}
          onChange={handleChange}
          className={finalClassName}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
          <CalendarIcon className="h-4 w-4 text-emerald-500/50" />
        </div>
      </div>
      {error && <p className="mt-1.5 text-[10px] font-medium text-red-500 tracking-wide">{error}</p>}
    </div>
  );
};

export default DatePicker;