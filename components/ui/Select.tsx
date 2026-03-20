import React, { useId } from 'react';
// Fix: Changed `import type` to inline `import { type ... }` for UseFormRegisterReturn to fix namespace-as-type error.
import { type UseFormRegisterReturn } from 'react-hook-form';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  labelClassName?: string;
  error?: string;
  registration?: UseFormRegisterReturn;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const Select: React.FC<SelectProps> = ({ label, labelClassName, id, error, registration, icon, children, ...props }) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const { className, ...otherProps } = props;
  
  const baseClass = 'form-input';
  const errorClass = 'form-input--error';
  const finalClassName = `${baseClass} ${error ? errorClass : ''} ${icon ? '!pl-10' : ''} ${className || ''}`;

  const selectElement = (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10">
          {icon}
        </div>
      )}
      <select
        id={selectId}
        name={props.name || registration?.name || selectId}
        className={finalClassName}
        style={icon ? { paddingLeft: '2.5rem' } : undefined}
        aria-invalid={!!error}
        {...registration}
        {...otherProps}
      >
        {children}
      </select>
    </div>
  );

  return (
    <div>
      {label && (
        <label htmlFor={selectId} className={labelClassName || "block text-sm font-medium text-muted"}>
          {label}
        </label>
      )}
      <div className={label ? "mt-1" : ""}>
        {selectElement}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default Select;