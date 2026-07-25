import { io } from 'socket.io-client';

let socket;

export function isRealtimeEnabled() {
  return import.meta.env.VITE_REALTIME_ENABLED !== 'false';
}

function getSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL.replace(/\/$/, '');
  const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const resolved = new URL(apiBase, window.location.origin);
  return `${resolved.protocol}//${resolved.host}`;
}

function getSocketPath() {
  const configuredPath = import.meta.env.VITE_SOCKET_PATH || '/socket.io';
  return `/${configuredPath.replace(/^\/+|\/+$/g, '')}`;
}

export function getSocket() {
  if (!isRealtimeEnabled()) return null;
  if (!socket) {
    socket = io(getSocketUrl(), {
      autoConnect: false,
      withCredentials: true,
      path: getSocketPath(),
      // Use one persistent upstream connection. Engine.IO polling stores its
      // `sid` in the memory of the pod that created it; without Kubernetes
      // sticky sessions, the next polling GET/POST can reach another pod and
      // be rejected with HTTP 400 ("Session ID unknown"). The production
      // Nginx route already forwards WebSocket Upgrade/Connection headers.
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });
  }
  return socket;
}

export function disconnectSocket() {
  // Also close a socket whose Engine.IO handshake is still in progress.
  // Checking only `connected` leaves an opening/reconnecting manager alive.
  if (socket) socket.disconnect();
}
