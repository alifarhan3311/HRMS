/**
 * utils/toast.js
 * Lightweight toast notification system using a global event bus.
 * Renders via the ToastContainer component placed in AppLayout.
 * No external dependencies required.
 */

const listeners = new Set();

function emit(toast) {
  listeners.forEach((fn) => fn(toast));
}

export const toast = {
  success: (message, options = {}) => emit({ id: Date.now(), type: 'success', message, ...options }),
  error: (message, options = {}) => emit({ id: Date.now(), type: 'error', message, ...options }),
  warning: (message, options = {}) => emit({ id: Date.now(), type: 'warning', message, ...options }),
  info: (message, options = {}) => emit({ id: Date.now(), type: 'info', message, ...options }),
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
