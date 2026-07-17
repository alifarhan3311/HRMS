import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../../services/apiSlice';
import { getSocket, disconnectSocket } from '../../services/socket';
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
    if (!user?.id) {
      disconnectSocket();
      return undefined;
    }

    const socket = getSocket();
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
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('notification:new', onNewNotification);
      SYNC_EVENTS.forEach(event => socket.off(event, refreshNotifications));
      disconnectSocket();
    };
  }, [dispatch, user?.id]);

  return null;
}
