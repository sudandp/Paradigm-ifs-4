import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check, Plus } from 'lucide-react';

export interface BottomSheetOption {
    value: string;
    label: string;
    badge?: string;
    subtitle?: string;
}

interface MobileBottomSheetSelectProps {
    label?: string;
    placeholder?: string;
    options: BottomSheetOption[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    error?: string;
    icon?: React.ReactNode;
    sheetTitle?: string;
    searchable?: boolean;
    allowManual?: boolean;
    onManualClick?: () => void;
    manualLabel?: string;
    className?: string;
    id?: string;
}

const MobileBottomSheetSelect: React.FC<MobileBottomSheetSelectProps> = ({
    label,
    placeholder = 'Select an option',
    options,
    value,
    onChange,
    disabled = false,
    error,
    icon,
    sheetTitle,
    searchable,
    allowManual = false,
    onManualClick,
    manualLabel = "Can't find what you need? Add manually",
    className = '',
    id,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Selected option display text
    const selectedOption = useMemo(
        () => options.find(o => String(o.value) === String(value)),
        [options, value]
    );

    // Search filter
    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) return options;
        const term = searchTerm.toLowerCase();
        return options.filter(
            o => o.label.toLowerCase().includes(term) ||
                 (o.subtitle && o.subtitle.toLowerCase().includes(term)) ||
                 (o.badge && o.badge.toLowerCase().includes(term))
        );
    }, [options, searchTerm]);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            setSearchTerm('');
            // Focus search input after slide-in
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 150);
            return () => {
                document.body.style.overflow = originalOverflow;
                clearTimeout(timer);
            };
        }
    }, [isOpen]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    const isSearchNeeded = searchable !== undefined ? searchable : options.length > 5;

    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label
                    htmlFor={id}
                    className="block text-xs font-bold text-slate-400 dark:text-white/70 uppercase tracking-wider"
                >
                    {label}
                </label>
            )}

            {/* Trigger Button */}
            <button
                type="button"
                id={id}
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(true)}
                className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between gap-2.5 transition-all duration-200 border ${
                    disabled
                        ? 'bg-black/20 dark:bg-black/30 border-white/5 opacity-50 cursor-not-allowed'
                        : error
                        ? 'bg-[#041b0f] border-red-500/80 focus:border-red-500'
                        : isOpen
                        ? 'bg-[#041b0f] border-[#44D62C] shadow-[0_0_15px_rgba(68,214,44,0.15)] ring-1 ring-[#44D62C]/50'
                        : 'bg-[#041b0f] hover:bg-[#072415] border-[#134426] active:scale-[0.99]'
                }`}
            >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {icon && (
                        <div className="text-emerald-400 dark:text-[#44D62C] flex-shrink-0">
                            {icon}
                        </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                        {selectedOption ? (
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-bold text-white truncate">
                                    {selectedOption.label}
                                </span>
                                {selectedOption.badge && (
                                    <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-md bg-[#44D62C]/20 text-[#44D62C] border border-[#44D62C]/30 flex-shrink-0">
                                        {selectedOption.badge}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="text-sm font-medium text-slate-400 dark:text-white/40 truncate">
                                {placeholder}
                            </span>
                        )}
                        {selectedOption?.subtitle && (
                            <span className="text-[11px] text-slate-400 dark:text-white/50 truncate">
                                {selectedOption.subtitle}
                            </span>
                        )}
                    </div>
                </div>

                <ChevronDown
                    className={`w-4 h-4 text-slate-400 dark:text-emerald-400 flex-shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#44D62C]' : ''
                    }`}
                />
            </button>

            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

            {/* Bottom Sheet Drawer Modal (Rendered via Portal to escape parent containers) */}
            {isOpen &&
                createPortal(
                    <div className="fixed inset-0 z-[99999] flex flex-col justify-end">
                        {/* Backdrop with Blur */}
                        <div
                            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-200"
                            onClick={() => setIsOpen(false)}
                            aria-hidden="true"
                        />

                        {/* Bottom Sheet Surface */}
                        <div
                            className="relative w-full max-h-[85vh] bg-[#041b0f] border-t border-[#134426] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] flex flex-col z-10 animate-in slide-in-from-bottom duration-200"
                            role="dialog"
                            aria-modal="true"
                        >
                            {/* Grab bar */}
                            <div className="pt-3 pb-1 flex justify-center flex-shrink-0">
                                <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                            </div>

                            {/* Header */}
                            <div className="px-5 py-3 flex items-center justify-between border-b border-[#134426]/60 flex-shrink-0">
                                <div className="flex items-center gap-2 min-w-0">
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider truncate">
                                        {sheetTitle || label || 'Select Option'}
                                    </h3>
                                    <span className="text-xs text-slate-400 dark:text-white/50 font-medium">
                                        ({options.length})
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                                    aria-label="Close sheet"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Optional Search Bar */}
                            {isSearchNeeded && (
                                <div className="px-4 py-2.5 border-b border-[#134426]/40 flex-shrink-0">
                                    <div className="relative flex items-center">
                                        <Search className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-white/40 pointer-events-none" />
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            placeholder="Search options..."
                                            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white/5 border border-[#134426] text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#44D62C] transition-colors"
                                        />
                                        {searchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchTerm('')}
                                                className="absolute right-3 text-slate-400 hover:text-white p-0.5"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Options List */}
                            <div className="flex-1 overflow-y-auto overscroll-contain py-1 divide-y divide-white/5">
                                {filteredOptions.length > 0 ? (
                                    filteredOptions.map(option => {
                                        const isSelected = String(option.value) === String(value);
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => handleSelect(option.value)}
                                                className={`w-full min-h-[50px] px-5 py-3 flex items-center justify-between text-left transition-all ${
                                                    isSelected
                                                        ? 'bg-[#44D62C]/15 border-l-4 border-[#44D62C]'
                                                        : 'hover:bg-white/5 active:bg-[#44D62C]/10 border-l-4 border-transparent'
                                                }`}
                                            >
                                                <div className="flex flex-col min-w-0 pr-3">
                                                    <span
                                                        className={`text-sm ${
                                                            isSelected
                                                                ? 'font-bold text-[#44D62C]'
                                                                : 'font-medium text-slate-100'
                                                        } truncate`}
                                                    >
                                                        {option.label}
                                                    </span>
                                                    {option.subtitle && (
                                                        <span className="text-[11px] text-slate-400 dark:text-white/50 truncate mt-0.5">
                                                            {option.subtitle}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {option.badge && (
                                                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white/10 text-slate-200 border border-white/10">
                                                            {option.badge}
                                                        </span>
                                                    )}
                                                    {isSelected && (
                                                        <div className="w-6 h-6 rounded-full bg-[#44D62C] text-black flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
                                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="py-12 px-4 text-center">
                                        <p className="text-sm text-slate-400 dark:text-white/50">
                                            No options found matching "{searchTerm}"
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Manual Entry Fallback Button (e.g. for Sites or Designations) */}
                            {allowManual && onManualClick && (
                                <div className="p-3 border-t border-[#134426] bg-[#021008] flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsOpen(false);
                                            onManualClick();
                                        }}
                                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#44D62C]/40 text-[#44D62C] hover:bg-[#44D62C]/10 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>{manualLabel}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default MobileBottomSheetSelect;
