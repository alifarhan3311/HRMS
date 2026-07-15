/**
 * components/ui/Button.jsx
 * Atomic Button — the pattern every other ui/ primitive (Input, Badge,
 * Select, etc.) should follow: variant/size props, forwardRef, Tailwind
 * only (no compiler-dependent classes).
 */
import { forwardRef } from 'react';

const VARIANT_CLASSES = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className = '', children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export default Button;
