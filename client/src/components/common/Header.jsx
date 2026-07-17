import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, ChevronDown, LogOut, Moon, Search, Settings,
  Sun, User, Volume2, VolumeX, X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { clearCredentials } from '../../features/auth/store/auth.slice';
import { useLogoutMutation } from '../../features/auth/api/auth.api';
import {
  useListNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../../features/notifications/api/notifications.api';
import { getNavForRole, getRoleLabel } from '../../config/navigation';
import {
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
} from '../../services/notificationSound';
import { Avatar } from '../ui/Avatar';

function timeAgo(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function Header() {
  const { user } = useSelector(state => state.auth);
  const { theme, toggleTheme } = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [logout] = useLogoutMutation();
  const [markNotificationRead] = useMarkNotificationReadMutation();
  const [markAllNotificationsRead] = useMarkAllNotificationsReadMutation();
  const { data: notificationData } = useListNotificationsQuery(
    { limit: 5 },
    { skip: !user?.id, pollingInterval: 60000 },
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(isNotificationSoundEnabled);
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const notifications = notificationData?.items || [];
  const unread = notificationData?.unread || 0;
  const quickLinks = useMemo(
    () => getNavForRole(user?.role).filter(item => !item.comingSoon),
    [user?.role],
  );
  const filteredLinks = searchQuery
    ? quickLinks.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : quickLinks;

  useEffect(() => {
    function closeMenus(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', closeMenus);
    return () => document.removeEventListener('mousedown', closeMenus);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const syncSoundSetting = event => setSoundEnabled(Boolean(event.detail));
    window.addEventListener('notification:sound-setting', syncSoundSetting);
    return () => window.removeEventListener('notification:sound-setting', syncSoundSetting);
  }, []);

  async function handleLogout() {
    try { await logout().unwrap(); } catch { /* session may already be expired */ }
    dispatch(clearCredentials());
    navigate('/login');
  }

  function navigateFromSearch(path) {
    navigate(path);
    setSearchOpen(false);
    setSearchQuery('');
  }

  function openNotification(notification) {
    if (!notification.readAt) markNotificationRead(notification._id);
    setNotifOpen(false);
    if (notification.link) navigate(notification.link);
  }

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card/60 px-5 backdrop-blur-md">
      <div className="relative max-w-md flex-1">
        <button onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40">
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium sm:inline-flex">Ctrl K</kbd>
        </button>
        <AnimatePresence>
          {searchOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/20" onClick={() => setSearchOpen(false)} />
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input ref={searchRef} value={searchQuery} onChange={event => setSearchQuery(event.target.value)}
                    placeholder="Search available pages..." className="flex-1 bg-transparent text-sm outline-none"
                    onKeyDown={event => {
                      if (event.key === 'Escape') setSearchOpen(false);
                      if (event.key === 'Enter' && filteredLinks[0]) navigateFromSearch(filteredLinks[0].path);
                    }} />
                  {searchQuery && <button onClick={() => setSearchQuery('')}><X className="h-3.5 w-3.5" /></button>}
                </div>
                <div className="max-h-72 overflow-y-auto py-2">
                  {filteredLinks.map(item => (
                    <button key={item.path} onClick={() => navigateFromSearch(item.path)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent">
                      <item.icon className="h-4 w-4 text-primary" /> {item.label}
                    </button>
                  ))}
                  {filteredLinks.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No results found</p>}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div className="ml-3 flex items-center gap-1">
        <button type="button" onClick={toggleTheme} aria-label="Toggle theme"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <div className="relative" ref={notifRef}>
          <button type="button" aria-label="Notifications"
            onClick={() => { setNotifOpen(open => !open); setProfileOpen(false); }}
            className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute right-0.5 top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {unread > 99 ? '99+' : unread}
              </motion.span>
            )}
          </button>
          <AnimatePresence>
            {notifOpen && (
              <motion.div initial={{ opacity: 0, y: -8, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: .96 }}
                className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-sm font-semibold">Live Notifications</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setNotificationSoundEnabled(!soundEnabled)}
                      title={soundEnabled ? 'Mute notification sound' : 'Enable notification sound'}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                      {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </button>
                    {unread > 0 && <button onClick={() => markAllNotificationsRead()} className="text-xs text-primary hover:underline">Mark all read</button>}
                  </div>
                </div>
                <div className="max-h-80 divide-y divide-border overflow-y-auto">
                  {notifications.map(notification => (
                    <button key={notification._id} onClick={() => openNotification(notification)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 ${!notification.readAt ? 'bg-primary/5' : ''}`}>
                      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{notification.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{notification.message}</span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">{timeAgo(notification.createdAt)}</span>
                      </span>
                      {!notification.readAt && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" />}
                    </button>
                  ))}
                  {notifications.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications</p>}
                </div>
                <div className="border-t border-border px-4 py-2.5">
                  <button onClick={() => { navigate('/notifications'); setNotifOpen(false); }} className="w-full text-center text-xs text-primary hover:underline">View all notifications</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative ml-1" ref={profileRef}>
          <button onClick={() => { setProfileOpen(open => !open); setNotifOpen(false); }}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-accent">
            <Avatar name={user?.fullName || 'User'} size="sm" />
            <span className="hidden text-left sm:block">
              <span className="block text-xs font-semibold leading-tight">{user?.fullName || 'User'}</span>
              <span className="block text-[11px] leading-tight text-muted-foreground">{getRoleLabel(user?.role)}</span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
          </button>
          <AnimatePresence>
            {profileOpen && (
              <motion.div initial={{ opacity: 0, y: -8, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: .96 }}
                className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm font-semibold">{user?.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email || getRoleLabel(user?.role)}</p>
                </div>
                <div className="py-1">
                  <MenuAction icon={User} label="Dashboard" onClick={() => { navigate('/dashboard'); setProfileOpen(false); }} />
                  {quickLinks.some(item => item.path === '/settings') && (
                    <MenuAction icon={Settings} label="Settings" onClick={() => { navigate('/settings'); setProfileOpen(false); }} />
                  )}
                  <div className="my-1 h-px bg-border" />
                  <MenuAction icon={LogOut} label="Sign Out" onClick={handleLogout} className="text-destructive hover:bg-destructive/10" />
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
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-accent ${className}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
