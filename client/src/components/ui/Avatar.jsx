/**
 * components/ui/Avatar.jsx
 * User avatar with fallback initials.
 */
const SIZE_CLASSES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
  '2xl': 'h-24 w-24 text-3xl',
};

const COLOR_MAP = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
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
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${SIZE_CLASSES[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${color} ${SIZE_CLASSES[size]} ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
