import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

interface MultiSelectProps {
  label?: string;
  placeholder?: string;
  options: { id: string | number; name: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  className?: string;
  id?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  placeholder = "Select options...",
  options,
  value,
  onChange,
  error,
  className = "",
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id || generatedId;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (optionId: string) => {
    const newValue = value.includes(optionId)
      ? value.filter(v => v !== optionId)
      : [...value, optionId];
    onChange(newValue);
  };

  const removeOption = (e: React.MouseEvent, optionId: string) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optionId));
  };

  const selectedOptions = options.filter(o => value.includes(o.id.toString()));

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] px-3 py-2 bg-white border ${error ? 'border-red-500' : 'border-gray-300'} rounded-lg focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 outline-none transition-shadow cursor-pointer flex flex-wrap gap-1 items-center pr-10`}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-gray-400 text-sm">{placeholder}</span>
        ) : (
          selectedOptions.map(opt => (
            <span key={opt.id} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-md border border-emerald-200">
              {opt.name}
              <button type="button" onClick={(e) => removeOption(e, opt.id.toString())} className="hover:text-emerald-900 focus:outline-none">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {value.length > 0 && (
             <button type="button" onClick={(e) => { e.stopPropagation(); onChange([]); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
             </button>
          )}
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">No options available</div>
          ) : (
            <ul className="py-1">
              {options.map((option) => {
                const isSelected = value.includes(option.id.toString());
                return (
                  <li
                    key={option.id}
                    onClick={() => toggleOption(option.id.toString())}
                    className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${isSelected ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span>{option.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-emerald-600" />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default MultiSelect;
