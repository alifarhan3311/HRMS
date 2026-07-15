/**
 * components/common/Header.jsx
 * Top navigation bar with global search, theme toggle, notification bell,
 * and user profile menu.
 */
import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Moon, Sun, Search, LogOut, User, Settings,
  ChevronDown, CheckCircle2, Clock, Calendar, Wallet, X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { clearCredentials } from '../../features/auth/store/auth.slice';
import { useLogoutMutation } from '../../features/auth/api/auth.api';
import { getRoleLabel } from '../../config/navigation';
import { Avatar } from '../ui/Avatar';

// ─── Demo in-app notifications (replace with socket-driven data later) ────────
const DEMO_NOTIFS = [
  { id: '1', icon: CheckCircle2, color: 'text-emerald-500', title: 'Leave Approved',     time: '2h ago',  read: false },
  { id: '2', icon: Wallet,       color: 'text-blue-500',    title: 'Payslip Generated',  time: '1d ago',  read: false },
  { id: '3', icon: Clock,        color: 'text-amber-500',   title: 'Missing Punch Alert', time: '1d ago', read: false },
  { id: '4', icon: Calendar,     color: 'text-purple-500',  title: 'Holiday Tomorrow',    time: '2d ago', read: true  },
];

// ─── Search results helper ────────────────────────────────────────────────────
const QUICK_LINKS = [
  { label: 'Employees',   path: '/employees'   },
  { label: 'Attendance',  path: '/attendance'  },
  { label: 'Leaves',      path: '/leaves'      },
  { label: 'Payroll',     path: '/payroll'     },
  { label: 'Expenses',    path: '/expenses'    },
  { label: 'Reports',     path: '/reports'     },
  { label: 'Settings',    path: '/settings'    },
];

export default function Header() {
  const { user }            = useSelector(s => s.auth);
  const { theme, toggleTheme } = useTheme();
  const dispatch            = useDispatch();
  const navigate            = useNavigate();
  const [logout]            = useLogoutMutation();

  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [profileOpen,   setProfileOpen]   = useState(false);
  const [notifs, setNotifs]               = useState(DEMO_NOTIFS);

  const searchRef  = useRef(null);
  const notifRef   = useRef(null);
  const profileRef = useRef(null);

  const unread = notifs.filter(n => !n.read).length;

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current   && !notifRef.current.contains(e.target))   setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const handleLogout = async () => {
    try { await logout().unwrap(); } catch { /* expired */ }
    dispatch(clearCredentials());
    navigate('/login');
  };

  const filteredLinks = searchQuery.length >= 1
    ? QUICK_LINKS.filter(l => l.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : QUICK_LINKS;

  function handleSearchNav(path) {
    navigate(path);
    setSearchOpen(false);
    setSearchQuery('');
  }

  function markAllRead() { setNotifs(prev => prev.map(n => ({ ...n, read: true }))); }

  return (
    <header className="relative flex h-16 items-center justify-between border-b border-border bg-card/60 backdrop-blur-md px-5 shrink-0 z-30">

      {/* ── Global Search ────────────────────────────────────────────── */}
      <div className="relative flex-1 max-w-md">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 w-full rounded-lg border border-border bg-background/60 py-2 px-3 text-sm text-muted-foreground hover:border-primary/40 transition-colors"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>

        {/* Search dropdown */}
        <AnimatePresence>
          {searchOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/20" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-2 w-full z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search pages, employees..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    onKeyDown={e => {
                      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
                      if (e.key === 'Enter' && filteredLinks[0]) handleSearchNav(filteredLinks[0].path);
                    }}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="py-2">
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {searchQuery ? 'Results' : 'Quick Navigation'}
                  </p>
                  {filteredLinks.map(link => (
                    <button key={link.path} onClick={() => handleSearchNav(link.path)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left">
                      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary">{link.label[0]}</span>
                      </div>
                      {link.label}
                    </button>
                  ))}
                  {filteredLinks.length === 0 && (
                    <p className="px-3 py-4 text-sm text-muted-foreground text-center">No results found</p>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ── Right controls ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1 ml-3">

        {/* Theme toggle */}
        <button type="button" onClick={toggleTheme}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Toggle theme">
          {theme === 'dark'
            ? <Sun  className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
            : <Moon className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
          }
        </button>

        {/* Notifications bell */}
        <div className="relative" ref={notifRef}>
          <button type="button"
            className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Notifications"
            onClick={() => { setNotifOpen(v => !v); setProfileOpen(false); }}>
            <Bell style={{ height: 18, width: 18 }} />
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {unread}
              </motion.span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="font-semibold text-sm">Notifications</span>
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="divide-y divide-border max-h-80 overflow-y-auto">
                  {notifs.map(n => {
                    const Icon = n.icon;
                    return (
                      <div key={n.id}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer
                          ${!n.read ? 'bg-primary/5' : ''}`}
                        onClick={() => { setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x)); }}>
                        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${n.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {n.title}
                            {!n.read && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-2.5 border-t border-border">
                  <button
                    onClick={() => { navigate('/notifications'); setNotifOpen(false); }}
                    className="w-full text-xs text-center text-primary hover:underline">
                    View all notifications
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile menu */}
        <div className="relative ml-1" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); }}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-accent transition-colors"
          >
            <Avatar name={user?.fullName || 'User'} size="sm" />
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold leading-tight">{user?.fullName || 'User'}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{getRoleLabel(user?.role)}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" style={{ marginLeft: 2 }} />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold truncate">{user?.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email || getRoleLabel(user?.role)}</p>
                </div>
                <div className="py-1">
                  <MenuAction icon={User}     label="My Profile"  onClick={() => { navigate('/employees'); setProfileOpen(false); }} />
                  <MenuAction icon={Settings} label="Settings"    onClick={() => { navigate('/settings');  setProfileOpen(false); }} />
                  <div className="my-1 h-px bg-border" />
                  <MenuAction icon={LogOut}   label="Sign Out"    onClick={handleLogout} className="text-destructive hover:bg-destructive/10" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function MenuAction({ icon: Icon, label, onClick, className = '' }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-accent transition-colors ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
