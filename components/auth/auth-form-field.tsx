'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AuthFormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  supportingText?: string;
  showPasswordToggle?: boolean;
}

export const AuthFormField = React.forwardRef<HTMLInputElement, AuthFormFieldProps>(
  (
    { label, error, id, className = '', showPasswordToggle, supportingText, type, ...props },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const inputId = id || `input-${label.replace(/\s+/g, '-').toLowerCase()}`;

    const resolvedType =
      showPasswordToggle && type === 'password' ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor={inputId} className="text-[14px] font-semibold text-[#091224]">
          {label}
        </label>
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            type={resolvedType}
            className={`
              h-[48px] w-full rounded-[10px] border bg-white px-4 text-[15px] font-medium text-[#091224]
              placeholder:text-slate-400 transition-colors duration-150
              focus:bg-white focus:border-[#0052FF] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/15
              ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15' : 'border-[#d0daf0] hover:border-[#a8bde0]'}
              ${showPasswordToggle ? 'pr-12' : ''}
              ${className}
            `}
            {...props}
          />
          {showPasswordToggle && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
        {supportingText && !error && (
          <p className="text-[12px] font-medium text-slate-400 pl-0.5">{supportingText}</p>
        )}
        {error && <p className="text-[12px] font-medium text-red-500 pl-0.5 mt-0.5">{error}</p>}
      </div>
    );
  }
);

AuthFormField.displayName = 'AuthFormField';
