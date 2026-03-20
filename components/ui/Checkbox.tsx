import React, { forwardRef, InputHTMLAttributes, useId } from 'react';

// Extend standard input props and add custom ones
interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  labelClassName?: string;
  inputClassName?: string;
  descriptionClassName?: string;
}

// Use forwardRef to allow react-hook-form to attach a ref
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ id, label, description, className, labelClassName, inputClassName, descriptionClassName, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || props.name || generatedId;

    return (
      <div className={`relative flex items-start ${className || ''}`}>
        <div className="flex h-6 items-center">
          <input
            id={inputId}
            name={props.name || inputId}
            aria-describedby={description ? `${inputId}-description` : undefined}
            type="checkbox"
            ref={ref}
            className={`h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer ${inputClassName || ''}`}
            {...props}
          />
        </div>
        <div className="ml-3 text-sm leading-6">
          <label htmlFor={inputId} className={`font-medium text-primary-text cursor-pointer ${labelClassName || ''}`}>
            {label}
          </label>
          {description && (
            <p id={`${inputId}-description`} className={`text-muted ${descriptionClassName || ''}`}>
              {description}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
