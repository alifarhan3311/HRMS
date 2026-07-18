/**
 * components/ui/Avatar.jsx
 * User avatar with fallback initials + subtle hover scale.
 */
import { motion } from 'framer-motion';

const SIZE_CLASSES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
  '2xl': 'h-24 w-24 text-3xl',
};

const COLOR_MAP = [
  'bg-gradient-to-br from-amber-500 to-yellow-600',
  'bg-gradient-to-br from-yellow-600 to-amber-700',
  'bg-gradient-to-br from-orange-500 to-amber-600',
  'bg-gradient-to-br from-amber-600 to-orange-700',
  'bg-gradient-to-br from-yellow-500 to-orange-600',
  'bg-gradient-to-br from-stone-600 to-stone-800',
  'bg-gradient-to-br from-amber-700 to-yellow-800',
  'bg-gradient-to-br from-orange-600 to-red-700',
];

function getInitials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function getColor(name = '') {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return COLOR_MAP[sum % COLOR_MAP.length];
}

export function Avatar({ name, src, size = 'md', className = '' }) {
  const initials = getInitials(name);
  const color = getColor(name);

  if (src) {
    return (
      <motion.img
        whileHover={{ scale: 1.08 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        src={src}
        alt={name}
        className={`rounded-full object-cover ${SIZE_CLASSES[size]} ${className}`}
      />
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.08 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${color} ${SIZE_CLASSES[size]} ${className}`}
      aria-label={name}
    >
      {initials}
    </motion.div>
  );
}
