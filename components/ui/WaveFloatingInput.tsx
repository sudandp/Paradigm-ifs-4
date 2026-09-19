import React, { useState, useId, useRef } from 'react';
import { type UseFormRegisterReturn } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';

export interface WaveFloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    id?: string;
    error?: string;
    icon?: React.ReactNode;
    registration?: UseFormRegisterReturn;
    variant?: 'dark' | 'light';
    containerClassName?: string;
}

export const WaveFloatingInput: React.FC<WaveFloatingInputProps> = ({
    label,
    id,
    type = 'text',
    error,
    icon,
    registration,
    variant = 'dark',
    containerClassName = '',
    className = '',
    value,
    defaultValue,
    onChange,
    onFocus,
    onBlur,
    disabled,
    ...rest
}) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [internalValue, setInternalValue] = useState<string>(
        (value as string) ?? (defaultValue as string) ?? ''
    );
    const inputRef = useRef<HTMLInputElement | null>(null);

    const isPassword = type === 'password';
    const computedType = isPassword ? (showPassword ? 'text' : 'password') : type;

    // The label floats if the field is focused OR has a non-empty value
    const hasContent = Boolean(
        (value !== undefined && value !== null && String(value).length > 0) ||
        internalValue.length > 0
    );
    const isFloating = isFocused || hasContent;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        setInternalValue(e.target.value);
        registration?.onBlur(e);
        onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInternalValue(e.target.value);
        registration?.onChange(e);
        onChange?.(e);
    };

    const isDark = variant === 'dark';

    return (
        <div className={`relative w-full pt-3.5 pb-0.5 ${containerClassName}`}>
            <div className="relative flex items-center group">
                {/* Optional Left Icon */}
                {icon && (
                    <div
                        className={`absolute left-0 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none ${
                            isFloating
                                ? isDark
                                    ? 'text-[#3eff99]'
                                    : 'text-emerald-600'
                                : isDark
                                ? 'text-white/40 group-hover:text-white/70'
                                : 'text-gray-400 group-hover:text-gray-600'
                        }`}
                    >
                        {icon}
                    </div>
                )}

                {/* Staggered Wave Floating Label */}
                <label
                    htmlFor={inputId}
                    className={`absolute pointer-events-none select-none transition-all duration-300 flex items-center ${
                        icon ? 'left-7' : 'left-0'
                    } ${
                        isFloating
                            ? '-top-2 text-[10px] font-bold tracking-wider uppercase'
                            : 'top-1/2 -translate-y-1/2 text-[13px] sm:text-[14px] font-medium'
                    }`}
                >
                    {label.split('').map((char, idx) => (
                        <span
                            key={idx}
                            style={{
                                transitionDelay: isFloating ? `${idx * 28}ms` : `${idx * 16}ms`,
                                transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                            }}
                            className={`inline-block transition-all duration-300 ${
                                isFloating
                                    ? isDark
                                        ? 'text-[#3eff99] translate-y-0 scale-95 drop-shadow-[0_0_8px_rgba(62,255,153,0.3)]'
                                        : 'text-emerald-600 translate-y-0 scale-95 font-semibold'
                                    : isDark
                                    ? 'text-white/50 group-hover:text-white/70'
                                    : 'text-gray-400 group-hover:text-gray-600'
                            }`}
                        >
                            {char === ' ' ? '\u00A0' : char}
                        </span>
                    ))}
                </label>

                {/* Native Input */}
                <input
                    {...rest}
                    {...registration}
                    ref={(el) => {
                        registration?.ref(el);
                        inputRef.current = el;
                    }}
                    id={inputId}
                    type={computedType}
                    disabled={disabled}
                    value={value}
                    defaultValue={defaultValue}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    className={`w-full bg-transparent border-0 border-b-2 py-1.5 font-medium text-[13px] sm:text-[14px] transition-all outline-none ${
                        icon ? 'pl-7' : 'pl-0'
                    } ${isPassword ? 'pr-7' : 'pr-0'} ${
                        isDark
                            ? 'text-white border-white/20 focus:border-[#3eff99] placeholder-transparent [color-scheme:dark]'
                            : 'text-gray-900 border-gray-200 focus:border-emerald-600 placeholder-transparent [color-scheme:light]'
                    } ${error ? '!border-red-500' : ''} ${className}`}
                />


                {/* Password Toggle Button */}
                {isPassword && (
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((prev) => !prev)}
                        className={`absolute right-0 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isDark
                                ? 'text-white/40 hover:text-white hover:bg-white/10'
                                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                )}
            </div>

            {/* Glowing Accent Underline when focused */}
            <div
                className={`absolute bottom-1 left-0 h-[2px] w-full transition-transform duration-300 origin-left pointer-events-none ${
                    isFocused ? 'scale-x-100' : 'scale-x-0'
                } ${
                    isDark
                        ? 'bg-[#3eff99] shadow-[0_0_10px_rgba(62,255,153,0.5)]'
                        : 'bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.3)]'
                }`}
            />

            {/* Inline Error Message */}
            {error && (
                <p className="mt-1.5 text-xs text-red-400 font-semibold flex items-center gap-1 animate-fadeIn">
                    <span>•</span> {error}
                </p>
            )}
        </div>
    );
};

export default WaveFloatingInput;
