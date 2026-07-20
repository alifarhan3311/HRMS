import { useCallback, useEffect, useState } from 'react';

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readDraft(key, fallback) {
  if (!key || typeof window === 'undefined') return fallback;
  try {
    const stored = JSON.parse(window.localStorage.getItem(key));
    if (!stored?.savedAt || Date.now() - stored.savedAt > DRAFT_TTL_MS) {
      window.localStorage.removeItem(key);
      return fallback;
    }
    return { ...fallback, ...stored.data };
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

/** Auto-saves an unfinished form locally and restores it for seven days. */
export function useFormDraft(key, initialValue, { exclude = [] } = {}) {
  const [value, setValue] = useState(() => readDraft(key, initialValue));
  const excludedFields = exclude.join('\u0000');

  useEffect(() => {
    if (!key || typeof window === 'undefined') return undefined;
    const timer = window.setTimeout(() => {
      const safeValue = { ...value };
      excludedFields.split('\u0000').filter(Boolean).forEach((field) => delete safeValue[field]);
      window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data: safeValue }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [excludedFields, key, value]);

  const clearDraft = useCallback(() => {
    if (key && typeof window !== 'undefined') window.localStorage.removeItem(key);
  }, [key]);

  return [value, setValue, clearDraft];
}
