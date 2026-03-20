import React, { useId } from 'react';
// Fix: Changed `import type` to inline `import { type ... }` for UseFormRegisterReturn to fix namespace-as-type error.
import { type UseFormRegisterReturn } from 'react-hook-form';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelClassName?: string;
  error?: string;
  description?: string;
  registration?: UseFormRegisterReturn;
  icon?: React.ReactNode;
  autoCapitalizeCustom?: boolean;
  'aria-label'?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, labelClassName, id, error, description, registration, icon, autoCapitalizeCustom = true, ...props }, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const { className, ...otherProps } = props;
  
  const baseClass = 'form-input';
  const errorClass = 'form-input--error';
  const finalClassName = `${baseClass} ${error ? errorClass : ''} ${icon ? '!pl-16' : ''} ${className || ''}`;
  
  const inputElement = (
    <div className="relative">
      {icon && (
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
          {icon}
        </div>
      )}
      <input
        ref={ref}
        id={inputId}
        name={props.name || registration?.name || inputId}
        className={finalClassName}
        style={icon ? { paddingLeft: '3.5rem' } : undefined}
        aria-invalid={!!error}
        aria-label={props['aria-label'] || label}
        autoCapitalize={autoCapitalizeCustom ? "words" : undefined}
        {...registration}
        {...otherProps}
        onChange={(e) => {
          const isTextField = !props.type || props.type === 'text';
          if (autoCapitalizeCustom && isTextField) {
            const originalValue = e.target.value;
            // Capitalize first letter of each word for Names/Cities/Addresses
            const capitalizedValue = originalValue.replace(/\b\w/g, char => char.toUpperCase());
            if (originalValue !== capitalizedValue) {
                e.target.value = capitalizedValue;
            }
          }
          // Call registration.onChange if it exists
          if (registration?.onChange) {
            registration.onChange(e);
          }
          // Call props.onChange if it exists
          if (props.onChange) {
            props.onChange(e);
          }
        }}
      />
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