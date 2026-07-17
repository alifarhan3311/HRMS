import { io } from 'socket.io-client';

let socket;

export function isRealtimeEnabled() {
  return import.meta.env.VITE_REALTIME_ENABLED !== 'false';
}

function getSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const resolved = new URL(apiBase, window.location.origin);
  return `${resolved.protocol}//${resolved.host}`;
}

export function getSocket() {
  if (!isRealtimeEnabled()) return null;
  if (!socket) {
    socket = io(getSocketUrl(), {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
