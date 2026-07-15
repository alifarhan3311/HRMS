/**
 * features/notifications/pages/NotificationsPage.jsx
 * In-app notifications center — lists all system notifications with mark-as-read.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCircle2, Clock, Calendar, Wallet, Receipt,
  Users, AlertCircle, Info, Check, Trash2,
} from 'lucide-react';
import Button from '../../../components/ui/Button';

// Sample notification types mapped to icons + colors
const TYPE_MAP = {
  leave_approved:   { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  leave_rejected:   { icon: AlertCircle,  color: 'text-red-500',     bg: 'bg-red-100 dark:bg-red-900/30'     },
  salary_generated: { icon: Wallet,       color: 'text-blue-500',    bg: 'bg-blue-100 dark:bg-blue-900/30'    },
  attendance:       { icon: Clock,        color: 'text-amber-500',   bg: 'bg-amber-100 dark:bg-amber-900/30'  },
  birthday:         { icon: Users,        color: 'text-pink-500',    bg: 'bg-pink-100 dark:bg-pink-900/30'    },
  holiday:          { icon: Calendar,     color: 'text-purple-500',  bg: 'bg-purple-100 dark:bg-purple-900/30'},
  expense:          { icon: Receipt,      color: 'text-orange-500',  bg: 'bg-orange-100 dark:bg-orange-900/30'},
  general:          { icon: Info,         color: 'text-indigo-500',  bg: 'bg-indigo-100 dark:bg-indigo-900/30'},
};

// Seed demo notifications since the notification backend isn't yet connected
const DEMO_NOTIFICATIONS = [
  { id:'1', type:'leave_approved',   title:'Leave Approved',         message:'Your casual leave for Jul 20–22 has been approved by HR.', time:'2 hours ago',   read: false },
  { id:'2', type:'salary_generated', title:'Payslip Ready',          message:'Your salary slip for June 2026 has been generated.',        time:'1 day ago',     read: false },
  { id:'3', type:'attendance',       title:'Missing Punch',          message:'You have a missing sign-out on July 14, 2026.',             time:'1 day ago',     read: false },
  { id:'4', type:'birthday',         title:'Birthday Tomorrow',      message:"Tomorrow is Sara HR's birthday. Don't forget to wish!",     time:'2 days ago',    read: true  },
  { id:'5', type:'holiday',          title:'Upcoming Holiday',       message:'Independence Day holiday on August 14, 2026.',              time:'3 days ago',    read: true  },
  { id:'6', type:'leave_rejected',   title:'Leave Rejected',         message:'Your sick leave request for Jul 10 was rejected.',          time:'5 days ago',    read: true  },
  { id:'7', type:'expense',          title:'Expense Approved',       message:'Your travel expense of PKR 5,000 has been approved.',       time:'1 week ago',    read: true  },
  { id:'8', type:'general',          title:'System Announcement',    message:'The HRMS will undergo maintenance on July 20, 2026.',       time:'1 week ago',    read: true  },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(DEMO_NOTIFICATIONS);
  const [filter, setFilter] = useState('all');

  const unreadCount = notifications.filter(n => !n.read).length;

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }
  function markRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }
  function remove(id) {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }
  function clearAll() {
    setNotifications([]);
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
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
            {unreadCount} unread · {notifications.length} total
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={markAllRead}>
              <Check className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearAll}>
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </Button>
          )}
        </div>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {[{ id:'all', label:'All' }, { id:'unread', label:`Unread (${unreadCount})` }].map(tab => (
          <button key={tab.id} onClick={() => setFilter(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
              ${filter === tab.id ? 'bg-card shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="glass-card py-20 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="font-medium text-muted-foreground">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </p>
            </motion.div>
          ) : (
            filtered.map((notif, i) => {
              const t = TYPE_MAP[notif.type] || TYPE_MAP.general;
              const Icon = t.icon;
              return (
                <motion.div key={notif.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`glass-card flex items-start gap-4 px-5 py-4 cursor-pointer group transition-all
                    ${!notif.read ? 'border-l-4 border-l-primary' : ''}`}
                  onClick={() => markRead(notif.id)}>
                  <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${t.bg}`}>
                    <Icon className={`h-5 w-5 ${t.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!notif.read ? '' : 'text-muted-foreground'}`}>
                        {notif.title}
                        {!notif.read && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />}
                      </p>
                      <span className="text-[11px] text-muted-foreground shrink-0">{notif.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); remove(notif.id); }}
                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all">
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
