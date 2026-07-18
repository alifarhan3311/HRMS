/**
 * components/ui/Badge.jsx
 * Atomic status badge component.
 */
const VARIANT_CLASSES = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  purple: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  gray: 'bg-secondary text-secondary-foreground',
  indigo: 'bg-primary/15 text-primary dark:bg-primary/20',
};

export function Badge({ variant = 'gray', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-200 hover:scale-105 ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const MAP = {
    active: { label: 'Active', variant: 'green' },
    inactive: { label: 'Inactive', variant: 'red' },
    on_leave: { label: 'On Leave', variant: 'yellow' },
    resigned: { label: 'Resigned', variant: 'gray' },
  };
  const { label, variant } = MAP[status] || { label: status, variant: 'gray' };
  return <Badge variant={variant}>{label}</Badge>;
}

export function RoleBadge({ role }) {
  const MAP = {
    super_admin: { label: 'Super Admin', variant: 'purple' },
    admin: { label: 'Admin', variant: 'indigo' },
    hr: { label: 'HR', variant: 'blue' },
    manager: { label: 'Manager', variant: 'yellow' },
    team_lead: { label: 'Team Lead', variant: 'blue' },
    employee: { label: 'Employee', variant: 'gray' },
  };
  const { label, variant } = MAP[role] || { label: role, variant: 'gray' };
  return <Badge variant={variant}>{label}</Badge>;
}
