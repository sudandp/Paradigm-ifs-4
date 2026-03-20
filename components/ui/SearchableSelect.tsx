import React, { useState, useRef, useEffect, useId } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface SearchableSelectProps {
  label?: string;
  placeholder?: string;
  options: { id: string | number; name: string }[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
  labelClassName?: string;
  isMobile?: boolean;
  isLoading?: boolean;
  allowCustom?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  placeholder = "Search...",
  options,
  value,
  onChange,
  error,
  className = "",
  labelClassName = "",
  isMobile = false,
  isLoading = false,
  allowCustom = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    setSearchTerm(value || "");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (allowCustom) {
            // Keep the typed term if custom is allowed
            if (searchTerm !== value) {
                onChange(searchTerm);
            }
        } else {
            // Reset search term to current value if no selection was made
            setSearchTerm(value || "");
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, allowCustom, searchTerm, onChange]);

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (optionName: string) => {
    onChange(optionName);
    setSearchTerm(optionName);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (allowCustom) {
        onChange(val);
    }
    setIsOpen(true);
  };

  return (
    <div 
      className={`relative ${className}`} 
      ref={containerRef}
      style={{ zIndex: isOpen ? 100 : 0 }}
    >
      {label && (
        <label htmlFor={id} className={`block text-sm font-semibold mb-2 ${labelClassName}`}>
          {label}
        </label>
      )}
            <div className={`relative flex items-center ${isMobile ? 'public-form-input !p-0 overflow-visible' : 'form-input !p-0'} transition-all duration-200`}>
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/60 pointer-events-none z-10">
            <Search className="h-4 w-4" />
          </div>
          <input
            id={id}
            type="text"
            className={`w-full bg-transparent border-none focus:ring-0 pl-11 pr-10 py-[14px] text-sm outline-none transition-all duration-200 ${
              isMobile 
                ? 'text-white placeholder:text-white/40' 
                : 'text-primary-text placeholder:text-muted'
            }`}
            placeholder={isLoading ? "Loading..." : placeholder}
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={(e) => {
              setIsOpen(true);
              e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && allowCustom) {
                    setIsOpen(false);
                }
            }}
            disabled={isLoading}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
            {isLoading ? (
              <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full" />
            ) : (
              <>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-muted hover:text-white transition-colors p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <div 
                    className={`text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} cursor-pointer`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                  <ChevronDown className="h-4 w-4" />
                </div>
              </>
            )}
          </div>
        </div>

      {isOpen && (
        <div className={`absolute z-[9999] w-full mt-2 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border transition-all overflow-hidden ${
          isMobile 
            ? 'bg-[#0a2718]/98 backdrop-blur-xl border-white/20 max-h-[250px]' 
            : 'bg-white border-border max-h-[300px]'
        } overflow-y-auto no-scrollbar scroll-smooth`}>
          {filteredOptions.length > 0 ? (
            <div className="py-2">
              {filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`w-full text-left px-4 py-3.5 text-sm transition-all border-l-4 ${
                    isMobile
                      ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                      : 'text-primary-text hover:bg-page'
                  } ${value === option.name 
                    ? (isMobile ? 'bg-accent/30 text-accent-light font-extrabold border-accent' : 'bg-accent/5 text-accent font-bold border-accent') 
                    : 'border-transparent'}`}
                  onClick={() => handleSelect(option.name)}
                >
                  {option.name}
                </button>
              ))}
            </div>
          ) : (
            <div className={`px-4 py-8 text-center text-sm ${isMobile ? 'text-gray-500' : 'text-muted italic'}`}>
              No results found for "{searchTerm}"
              {allowCustom && (
                  <div className="mt-2 text-accent font-bold cursor-pointer" onClick={() => setIsOpen(false)}>
                      Use custom name
                  </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

export default SearchableSelect;
