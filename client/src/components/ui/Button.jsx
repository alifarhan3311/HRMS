/**
 * components/ui/Button.jsx
 * Animated atomic Button — spring hover/tap physics via Framer Motion,
 * theme tokens only (dark-mode consistent).
 */
import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const VARIANT_CLASSES = {
  primary: 'bg-gold-gradient text-primary-foreground shadow-sm hover:shadow-gold font-semibold',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  danger: 'bg-destructive text-destructive-foreground hover:shadow-[0_0_20px_-4px_hsl(var(--destructive)/0.5)]',
  ghost: 'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
  outline: 'bg-transparent border border-primary/30 text-foreground hover:bg-accent hover:border-primary/60',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
  icon: 'p-2',
};

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, className = '', children, disabled, ...rest },
  ref
) {
  return (
    <motion.button
      ref={ref}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: 1.03, y: -1 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.96 } : {}}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={`inline-flex items-center justify-center rounded-lg font-medium
        transition-colors duration-150 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background
        ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
});

export default Button;
