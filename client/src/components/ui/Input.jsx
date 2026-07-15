/**
 * components/ui/Input.jsx
 * Reusable form input with label, error, and icon support.
 */
import { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  { label, error, icon: Icon, className = '', ...props },
  ref
) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
          {props.required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <input
          ref={ref}
          className={`w-full rounded-lg border bg-background py-2.5 text-sm outline-none transition
            placeholder:text-muted-foreground
            focus:border-primary focus:ring-2 focus:ring-primary/20
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? 'border-destructive focus:ring-destructive/20' : 'border-border'}
            ${Icon ? 'pl-10 pr-4' : 'px-3'}
            ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { label, error, className = '', children, ...props },
  ref
) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
          {props.required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      <select
        ref={ref}
        className={`w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition
          focus:border-primary focus:ring-2 focus:ring-primary/20
          disabled:cursor-not-allowed disabled:opacity-50
          ${error ? 'border-destructive' : 'border-border'}
          ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, className = '', ...props },
  ref
) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
          {props.required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={3}
        className={`w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition resize-none
          placeholder:text-muted-foreground
          focus:border-primary focus:ring-2 focus:ring-primary/20
          disabled:cursor-not-allowed disabled:opacity-50
          ${error ? 'border-destructive' : 'border-border'}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
});
