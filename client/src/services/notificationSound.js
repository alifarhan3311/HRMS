const STORAGE_KEY = 'hrms.notificationSoundEnabled';
let audioContext;
let unlocked = false;

export function isNotificationSoundEnabled() {
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

export function setNotificationSoundEnabled(enabled) {
  localStorage.setItem(STORAGE_KEY, String(Boolean(enabled)));
  window.dispatchEvent(new CustomEvent('notification:sound-setting', { detail: Boolean(enabled) }));
  if (enabled) unlockNotificationSound().catch(() => {});
}

export async function unlockNotificationSound() {
  if (!isNotificationSoundEnabled()) return false;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return false;
  audioContext ||= new AudioContext();
  if (audioContext.state === 'suspended') await audioContext.resume();
  unlocked = audioContext.state === 'running';
  return unlocked;
}

export function playNotificationSound() {
  if (!isNotificationSoundEnabled() || !unlocked || !audioContext) return false;

  const start = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
  gain.connect(audioContext.destination);

  [784, 1046.5].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start + index * 0.08);
    oscillator.connect(gain);
    oscillator.start(start + index * 0.08);
    oscillator.stop(start + 0.34 + index * 0.08);
  });
  return true;
}
