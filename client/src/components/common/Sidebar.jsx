/**
 * components/common/Sidebar.jsx
 * Grouped, animated sidebar with collapse support, active link highlighting,
 * coming-soon badges, and smooth motion transitions.
 */
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { getNavGroupsForRole } from '../../config/navigation';

export default function Sidebar() {
  const { user }    = useSelector(s => s.auth);
  const location    = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const groups      = getNavGroupsForRole(user?.role || 'employee');

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-full flex-col border-r border-sidebar-border bg-sidebar overflow-hidden shrink-0"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4 shrink-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
          <Building2 className="h-5 w-5" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <p className="text-sm font-bold tracking-tight">HRMS</p>
              <p className="text-[11px] text-muted-foreground">Enterprise Suite</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
        {groups.map(group => (
          <div key={group.label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const Icon    = item.icon;
                const isActive = location.pathname === item.path;
                const disabled = item.comingSoon;

                return (
                  <NavLink
                    key={item.id}
                    to={disabled ? '#' : item.path}
                    onClick={e => disabled && e.preventDefault()}
                    title={collapsed ? item.label : undefined}
                    className={() =>
                      `sidebar-link relative
                       ${isActive && !disabled ? 'sidebar-link-active' : ''}
                       ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />

                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex-1 truncate text-sm overflow-hidden whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Coming soon badge */}
                    {!collapsed && disabled && (
                      <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                        Soon
                      </span>
                    )}

                    {/* Active indicator dot when collapsed */}
                    {collapsed && isActive && (
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="absolute -right-3.5 top-20 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card shadow-soft hover:bg-accent transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed
          ? <ChevronRight className="h-3.5 w-3.5" />
          : <ChevronLeft  className="h-3.5 w-3.5" />
        }
      </button>
    </motion.aside>
  );
}
