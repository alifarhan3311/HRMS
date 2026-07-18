/**
 * components/common/Sidebar.jsx
 * Grouped, animated sidebar with collapse support, active link highlighting,
 * coming-soon badges, and smooth motion transitions.
 */
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getNavGroupsForRole } from '../../config/navigation';

const MotionNavLink = motion(NavLink);

export default function Sidebar({ mobileOpen = false, onMobileClose = () => {} }) {
  const { user }    = useSelector(s => s.auth);
  const location    = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const groups      = getNavGroupsForRole(user?.role || 'employee');

  // Auto-close the mobile drawer whenever the route changes
  useEffect(() => { onMobileClose(); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const content = (
    <motion.aside
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-full min-h-0 shrink-0 flex-col overflow-visible border-r border-sidebar-border bg-sidebar"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4 shrink-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-gradient text-primary-foreground shadow-gold animate-pulse-glow">
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
              <p className="font-serif text-base font-bold tracking-tight text-sidebar-foreground">HRMS</p>
              <p className="text-[11px] text-sidebar-foreground/55">Enterprise Suite</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation groups */}
      <nav className="sidebar-scrollbar min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-3">
        {groups.map(group => (
          <div key={group.label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {group.items.map((item, idx) => {
                const Icon    = item.icon;
                const isActive = location.pathname === item.path;
                const disabled = item.comingSoon;

                return (
                  <MotionNavLink
                    key={item.id}
                    to={disabled ? '#' : item.path}
                    onClick={e => disabled && e.preventDefault()}
                    title={collapsed ? item.label : undefined}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={!disabled ? { x: 3 } : {}}
                    whileTap={!disabled ? { scale: 0.97 } : {}}
                    className={() =>
                      `sidebar-link relative
                       ${isActive && !disabled ? 'sidebar-link-active' : ''}
                       ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`
                    }
                  >
                    <motion.span whileHover={!disabled ? { rotate: [0, -10, 10, 0] } : {}} transition={{ duration: 0.4 }}>
                      <Icon className="h-4 w-4 shrink-0" />
                    </motion.span>

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
                      <span className="ml-auto shrink-0 rounded-full bg-sidebar-foreground/10 px-1.5 py-0.5 text-[9px] font-medium text-sidebar-foreground/50">
                        Soon
                      </span>
                    )}

                    {/* Active indicator dot when collapsed */}
                    {collapsed && isActive && (
                      <motion.span
                        layoutId="sidebar-active-dot"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary"
                      />
                    )}
                  </MotionNavLink>
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
        className="absolute -right-3.5 top-20 z-10 hidden h-7 w-7 items-center justify-center rounded-full border border-primary/20 bg-card text-foreground shadow-soft transition-colors hover:border-primary/40 hover:bg-accent lg:flex"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed
          ? <ChevronRight className="h-3.5 w-3.5" />
          : <ChevronLeft  className="h-3.5 w-3.5" />
        }
      </button>
    </motion.aside>
  );

  return (
    <>
      {/* Desktop: always-visible sidebar */}
      <div className="relative z-30 hidden h-full shrink-0 overflow-visible lg:block">{content}</div>

      {/* Mobile: slide-in drawer with backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-[240px] lg:hidden"
            >
              {content}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
