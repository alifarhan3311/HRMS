import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCircle2, Clock, Calendar, Wallet, Receipt,
  Users, AlertCircle, Info, Check, Trash2,
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import { toast } from '../../../utils/toast';
import {
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useClearNotificationsMutation,
} from '../api/notifications.api';

const TYPE_MAP = {
  leave_approved: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  leave_rejected: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
  leave_balance_updated: { icon: Calendar, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  pending_leave_application: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  salary_generated: { icon: Wallet, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  attendance: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  birthday: { icon: Users, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  holiday: { icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  expense: { icon: Receipt, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  general: { icon: Info, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
};

function relativeTime(value) {
  const minutes = Math.max(Math.floor((Date.now() - new Date(value).getTime()) / 60000), 0);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState('all');
  const { data, isLoading, isError } = useListNotificationsQuery({ limit: 100 });
  const [markNotificationRead] = useMarkNotificationReadMutation();
  const [markAllNotificationsRead] = useMarkAllNotificationsReadMutation();
  const [deleteNotification] = useDeleteNotificationMutation();
  const [clearNotifications] = useClearNotificationsMutation();

  const notifications = data?.items || [];
  const unreadCount = data?.unread ?? notifications.filter((item) => !item.readAt).length;
  const filtered = filter === 'unread'
    ? notifications.filter((item) => !item.readAt)
    : notifications;

  async function runAction(action, fallbackMessage) {
    try {
      await action().unwrap();
    } catch (error) {
      toast.error(error?.data?.error?.message || fallbackMessage);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6" /> Notifications
            {unreadCount > 0 && (
              <span className="ml-1 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount} unread - {notifications.length} total
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => runAction(markAllNotificationsRead, 'Unable to mark notifications as read.')}
            >
              <Check className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => runAction(clearNotifications, 'Unable to clear notifications.')}
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </Button>
          )}
        </div>
      </motion.div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {[
          { id: 'all', label: 'All' },
          { id: 'unread', label: `Unread (${unreadCount})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === tab.id
                ? 'bg-card shadow-soft text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading && (
          <div className="glass-card py-16 text-center text-sm text-muted-foreground">
            Loading notifications...
          </div>
        )}
        {isError && (
          <div className="glass-card py-16 text-center text-sm text-destructive">
            Failed to load notifications.
          </div>
        )}
        <AnimatePresence>
          {!isLoading && !isError && filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass-card py-20 text-center"
            >
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="font-medium text-muted-foreground">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </p>
            </motion.div>
          ) : (
            filtered.map((notification, index) => {
              const type = TYPE_MAP[notification.type] || TYPE_MAP.general;
              const Icon = type.icon;
              return (
                <motion.div
                  key={notification._id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`glass-card flex items-start gap-4 px-5 py-4 cursor-pointer group transition-all ${
                    !notification.readAt ? 'border-l-4 border-l-primary' : ''
                  }`}
                  onClick={() => !notification.readAt && runAction(
                    () => markNotificationRead(notification._id),
                    'Unable to update notification.'
                  )}
                >
                  <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${type.bg}`}>
                    <Icon className={`h-5 w-5 ${type.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${notification.readAt ? 'text-muted-foreground' : ''}`}>
                        {notification.title}
                        {!notification.readAt && (
                          <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
                        )}
                      </p>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {relativeTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      runAction(() => deleteNotification(notification._id), 'Unable to delete notification.');
                    }}
                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
