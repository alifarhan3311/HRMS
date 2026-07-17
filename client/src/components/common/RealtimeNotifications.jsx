import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../../services/apiSlice';
import axiosInstance from '../../utils/axios';
import { getSocket, disconnectSocket, isRealtimeEnabled } from '../../services/socket';
import { playNotificationSound, unlockNotificationSound } from '../../services/notificationSound';
import { toast } from '../../utils/toast';

const SYNC_EVENTS = [
  'notification:read',
  'notification:read-all',
  'notification:deleted',
  'notification:cleared',
];

export default function RealtimeNotifications() {
  const user = useSelector(state => state.auth.user);
  const dispatch = useDispatch();

  useEffect(() => {
    const unlock = () => unlockNotificationSound().catch(() => {});
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

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
    const onNewNotification = notification => {
      refreshNotifications();
      playNotificationSound();
      toast.info(notification.title || 'New notification', { duration: 5000 });

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

    socket.on('notification:new', onNewNotification);
    SYNC_EVENTS.forEach(event => socket.on(event, refreshNotifications));

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
      SYNC_EVENTS.forEach(event => socket.off(event, refreshNotifications));
      disconnectSocket();
    };
  }, [dispatch, user?.id]);

  return null;
}
