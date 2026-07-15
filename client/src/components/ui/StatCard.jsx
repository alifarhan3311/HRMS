/**
 * components/ui/StatCard.jsx
 */
import { motion } from 'framer-motion';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`stat-card ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
