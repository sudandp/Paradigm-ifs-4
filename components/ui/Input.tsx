import React, { useId, useState } from 'react';
import { type UseFormRegisterReturn } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelClassName?: string;
  error?: string;
  description?: string;
  registration?: UseFormRegisterReturn;
  icon?: React.ReactNode;
  autoCapitalizeCustom?: boolean;
  forceUppercase?: boolean;
  pattern?: string; // e.g. "AAAAA9999A" (A=Alpha, 9=Digit, *=Any)
  onComplete?: () => void;
  'aria-label'?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ 
  label, labelClassName, id, error, description, registration, icon, 
  autoCapitalizeCustom = true, forceUppercase = false, pattern, onComplete, ...props 
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;
  const { className, ...otherProps } = props;
  
  const baseClass = 'form-input';
  const errorClass = 'form-input--error';
  
  const isPassword = props.type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : props.type;
  
  // Calculate dynamic inputMode based on pattern and current length
  const getDynamicInputMode = () => {
    if (props.inputMode) return props.inputMode;
    if (!pattern || !props.value) return undefined;
    
    const value = String(props.value);
    const pos = value.length;
    if (pos >= pattern.length) return undefined;
    
    const expected = pattern[pos];
    return expected === '9' ? 'numeric' : 'text';
  };

  const finalClassName = `${baseClass} ${error ? errorClass : ''} ${icon ? '!pl-16' : ''} ${isPassword ? '!pr-12' : ''} ${className || ''}`;
  
  const handlePatternChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    if (forceUppercase) {
      value = value.toUpperCase();
    }

    if (pattern) {
      // Strip invalid characters based on the pattern position
      let cleanedValue = '';
      for (let i = 0; i < value.length && i < pattern.length; i++) {
        const char = value[i];
        const rule = pattern[i];
        
        if (rule === 'A' && /[A-Z]/i.test(char)) cleanedValue += char.toUpperCase();
        else if (rule === '9' && /[0-9]/.test(char)) cleanedValue += char;
        else if (rule === '*') cleanedValue += char;
        // If it doesn't match, we stop or skip. For strictness, we stop processing the rest of the input string
        else break;
      }
      value = cleanedValue;
      e.target.value = value;
    }

    // Default auto-capitalize logic if no pattern and not forced uppercase
    if (!pattern && !forceUppercase && autoCapitalizeCustom && (!props.type || props.type === 'text')) {
      value = value.replace(/\b\w/g, char => char.toUpperCase());
      e.target.value = value;
    }

    // Call registration.onChange if it exists
    if (registration?.onChange) {
      registration.onChange(e);
    }
    // Call props.onChange if it exists
    if (props.onChange) {
      props.onChange(e);
    }

    // Auto-tab logic
    if (pattern && value.length === pattern.length) {
      if (onComplete) {
        onComplete();
      } else {
        // Generic auto-tab: find next input
        const form = e.target.form;
        if (form) {
          const index = Array.prototype.indexOf.call(form, e.target);
          const next = form.elements[index + 1] as HTMLElement;
          if (next && typeof next.focus === 'function') {
            next.focus();
          }
        }
      }
    }
  };
  
  const inputElement = (
    <div className="relative">
      <input
        ref={ref}
        id={inputId}
        name={props.name || registration?.name || inputId}
        className={finalClassName}
        style={icon ? { paddingLeft: '3.5rem' } : undefined}
        aria-invalid={!!error}
        aria-label={props['aria-label'] || label}
        autoCapitalize={forceUppercase ? "characters" : (autoCapitalizeCustom ? "words" : undefined)}
        inputMode={getDynamicInputMode()}
        {...registration}
        {...otherProps}
        type={inputType}
        onChange={handlePatternChange}
      />

      {icon && (
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted z-10 pointer-events-none flex items-center justify-center">
          {icon}
        </div>
      )}
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-emerald-400 transition-all focus:outline-none btn-icon !bg-transparent !border-none !shadow-none password-toggle"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
        </button>
      )}
    </div>
  );

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className={labelClassName || "block text-sm font-medium text-muted"}>
          {label}
        </label>
      )}
      {description && <p className="text-xs text-muted mb-1">{description}</p>}
      <div className={label ? "mt-1" : ""}>
        {inputElement}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;