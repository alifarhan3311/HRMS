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
      // Start with HTTP polling, which works through standard Kubernetes/
      // cloud ingress, then upgrade to WebSocket when the proxy supports it.
      // A WebSocket-only first attempt can reconnect forever without ever
      // reaching the working polling transport.
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: false,
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
  if (socket?.connected) socket.disconnect();
}
