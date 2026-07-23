import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../../services/apiSlice';
import axiosInstance from '../../utils/axios';
import { getSocket, disconnectSocket, isRealtimeEnabled } from '../../services/socket';
import { playNotificationSound, unlockNotificationSound } from '../../services/notificationSound';
import { useListNotificationsQuery } from '../../features/notifications/api/notifications.api';

const SYNC_EVENTS = [
  'notification:read',
  'notification:read-all',
  'notification:deleted',
  'notification:cleared',
];

const DATA_SYNC_EVENTS = {
  'leave:updated': ['Leaves', 'Employees', 'Dashboard'],
};

const ALL_LIVE_TAGS = [
  'Dashboard', 'Employees', 'Attendance', 'Leaves', 'Payroll', 'Expenses',
  'ExpenseCategories', 'Projects', 'Holidays', 'Shifts', 'Notifications',
  'Settings', 'Reports',
];

export default function RealtimeNotifications() {
  const user = useSelector(state => state.auth.user);
  const dispatch = useDispatch();
  const seenNotificationIds = useRef(new Set());
  const pollingInitialized = useRef(false);
  const socketReadyOnce = useRef(false);
  const { data: pollingData } = useListNotificationsQuery(
    { limit: 5 },
    { skip: !user?.id, pollingInterval: 30000, refetchOnFocus: true },
  );

  useEffect(() => {
    const unlock = async () => {
      const success = await unlockNotificationSound().catch(() => false);
      if (success) {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      }
    };
    unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const items = pollingData?.items || [];
    if (!pollingInitialized.current) {
      items.forEach(item => seenNotificationIds.current.add(String(item._id)));
      pollingInitialized.current = true;
      return;
    }
    const newItems = items.filter(item => !seenNotificationIds.current.has(String(item._id)));
    newItems.forEach(item => seenNotificationIds.current.add(String(item._id)));
    if (newItems.length) {
      playNotificationSound().catch(() => {});
    }
  }, [pollingData]);

  useEffect(() => {
    if (!user?.id || !isRealtimeEnabled()) {
      disconnectSocket();
      return undefined;
    }

    const socket = getSocket();
    if (!socket) return undefined;
    const refreshNotifications = () => {
      dispatch(api.util.invalidateTags(['Notifications', 'Dashboard']));
    };
    const onSocketReady = () => {
      // Pull anything created during a temporary disconnect immediately.
      refreshNotifications();
      // Initial page queries are already loading. Only a later reconnect
      // needs a broad catch-up refresh for changes missed while disconnected.
      if (socketReadyOnce.current) dispatch(api.util.invalidateTags(ALL_LIVE_TAGS));
      socketReadyOnce.current = true;
    };
    const onConnectError = (error) => {
      if (import.meta.env.DEV) {
        console.warn('[realtime] Socket connection failed; polling fallback remains active.', error.message);
      }
    };
    const onSessionRevoked = () => {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    };
    const onNewNotification = notification => {
      seenNotificationIds.current.add(String(notification._id));
      refreshNotifications();
      playNotificationSound().catch(() => {});

      if (document.hidden && window.Notification?.permission === 'granted') {
        const browserNotification = new window.Notification(notification.title || 'HRMS notification', {
          body: notification.message || '',
          tag: notification._id,
        });
        browserNotification.onclick = () => {
          window.focus();
          if (notification.link) window.location.assign(notification.link);
          browserNotification.close();
        };
      }
    };
    const dataSyncHandlers = Object.fromEntries(
      Object.entries(DATA_SYNC_EVENTS).map(([event, tags]) => [
        event,
        () => dispatch(api.util.invalidateTags(tags)),
      ]),
    );
    const onDataChanged = payload => {
      // The initiating browser already refreshes immediately through the
      // mutation's invalidation tags. Socket sync is for other active users.
      if (String(payload?.actorId || '') === String(user.id)) return;
      const tags = Array.isArray(payload?.tags) && payload.tags.length
        ? payload.tags
        : ALL_LIVE_TAGS;
      dispatch(api.util.invalidateTags(tags));
    };

    socket.on('notification:new', onNewNotification);
    socket.on('socket:ready', onSocketReady);
    socket.on('connect_error', onConnectError);
    socket.on('session:revoked', onSessionRevoked);
    socket.on('data:changed', onDataChanged);
    SYNC_EVENTS.forEach(event => socket.on(event, refreshNotifications));
    Object.entries(dataSyncHandlers).forEach(([event, handler]) => socket.on(event, handler));

    let cancelled = false;
    let tokenRefreshTimer;
    const connectWithFreshToken = async () => {
      try {
        const response = await axiosInstance.post('/auth/socket-token');
        if (cancelled) return;
        socket.auth = { token: response.data.data.token };
        if (!socket.connected) socket.connect();
        tokenRefreshTimer = window.setTimeout(connectWithFreshToken, 10 * 60 * 1000);
      } catch {
        // The notifications API polling fallback remains active.
      }
    };
    connectWithFreshToken();

    return () => {
      cancelled = true;
      window.clearTimeout(tokenRefreshTimer);
      socket.off('notification:new', onNewNotification);
      socket.off('socket:ready', onSocketReady);
      socket.off('connect_error', onConnectError);
      socket.off('session:revoked', onSessionRevoked);
      socket.off('data:changed', onDataChanged);
      SYNC_EVENTS.forEach(event => socket.off(event, refreshNotifications));
      Object.entries(dataSyncHandlers).forEach(([event, handler]) => socket.off(event, handler));
      disconnectSocket();
    };
  }, [dispatch, user?.id]);

  return null;
}
