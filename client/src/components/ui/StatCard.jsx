/**
 * components/ui/StatCard.jsx
 * Animated stat card — spring entrance, count-up numeric values,
 * icon micro-interaction on hover.
 */
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';

function AnimatedNumber({ value }) {
  const numeric = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  const isNumeric = !Number.isNaN(numeric) && String(value).trim() !== '' && /^[^a-zA-Z]*$/.test(String(value));
  const prefix = isNumeric ? String(value).match(/^[^0-9.-]*/)?.[0] || '' : '';
  const suffix = isNumeric ? String(value).match(/[^0-9.-]*$/)?.[0] || '' : '';

  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, latest => Math.round(latest));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isNumeric) return;
    const controls = animate(motionVal, numeric, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    const unsub = rounded.on('change', v => setDisplay(v));
    return () => { controls.stop(); unsub(); };
  }, [numeric, isNumeric]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isNumeric) return <>{value}</>;
  return <>{prefix}{display.toLocaleString()}{suffix}</>;
}

export default function StatCard({ title, value, subtitle, icon: Icon, trend, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`stat-card group cursor-default ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">
            <AnimatedNumber value={value} />
          </p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <motion.p
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.3 }}
              className={`text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}
            >
              {trend.label}
            </motion.p>
          )}
        </div>
        {Icon && (
          <motion.div
            whileHover={{ rotate: 12, scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="rounded-lg bg-primary/10 p-2.5 text-primary transition-colors duration-300 group-hover:bg-primary/20"
          >
            <Icon className="h-5 w-5" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
