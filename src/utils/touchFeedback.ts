import { useCallback, useEffect, useRef, useState } from 'react';

const TOUCH_FLASH_CLASS = 'ark-touch-flash';
const TOUCH_FLASH_MS = 230;
const HAPTIC_COOLDOWN_MS = 35;

const TACTILE_SELECTOR =
  'button, [role="button"], a[href], summary, [data-tactile="true"]';

const flashTimers = new WeakMap<HTMLElement, number>();
let hapticEnabled = true;
let lastHapticTimestamp = 0;

export function setHapticFeedbackEnabled(enabled: boolean): void {
  hapticEnabled = enabled !== false;
}

export function isHapticFeedbackEnabled(): boolean {
  return hapticEnabled;
}

export function isHapticSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  );
}

export function triggerHapticFeedback(durationMs = 10): void {
  if (!hapticEnabled) return;
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  ) {
    return;
  }
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastHapticTimestamp < HAPTIC_COOLDOWN_MS) return;
  lastHapticTimestamp = now;
  try {
    navigator.vibrate(durationMs);
  } catch {
    // Ignore restricted/unsupported vibration contexts
  }
}

function isElementDisabled(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled) return true;
  if (el.getAttribute('aria-disabled') === 'true') return true;
  if (el.getAttribute('data-no-tactile') === 'true') return true;
  return false;
}

export function flashTouchElement(el: HTMLElement | null | undefined): void {
  if (!el || isElementDisabled(el)) return;
  const existingTimer = flashTimers.get(el);
  if (existingTimer !== undefined) {
    window.clearTimeout(existingTimer);
    el.classList.remove(TOUCH_FLASH_CLASS);
    // Restart keyframe cleanly on rapid repeated taps
    void el.offsetWidth;
  }
  el.classList.add(TOUCH_FLASH_CLASS);
  const timerId = window.setTimeout(() => {
    el.classList.remove(TOUCH_FLASH_CLASS);
    if (flashTimers.get(el) === timerId) {
      flashTimers.delete(el);
    }
  }, TOUCH_FLASH_MS);
  flashTimers.set(el, timerId);
}

function shouldVibrateForTarget(el: HTMLElement): boolean {
  if (!hapticEnabled) return false;
  if (el.getAttribute('data-no-haptic') === 'true') return false;
  const tag = el.tagName;
  if (tag === 'BUTTON') return true;
  const role = el.getAttribute('role');
  if (role === 'button' || role === 'switch' || role === 'menuitem') return true;
  if (el.getAttribute('data-tactile') === 'true') return true;
  if (tag === 'A' && el.getAttribute('data-haptic') === 'true') return true;
  return false;
}

export function installGlobalTouchFeedback(): () => void {
  if (typeof document === 'undefined') return () => {};

  const handleClickCapture = (event: MouseEvent) => {
    const rawTarget = event.target;
    if (!(rawTarget instanceof Element)) return;
    const interactive = rawTarget.closest(TACTILE_SELECTOR);
    if (!(interactive instanceof HTMLElement)) return;
    if (isElementDisabled(interactive)) return;

    flashTouchElement(interactive);
    if (shouldVibrateForTarget(interactive)) {
      triggerHapticFeedback(10);
    }
  };

  document.addEventListener('click', handleClickCapture, { capture: true });
  return () => {
    document.removeEventListener('click', handleClickCapture, { capture: true });
  };
}

/**
 * Provides transient inline confirmation state (~1s) directly on quick-action buttons
 * (e.g. "✓ Đã lưu", "✓ Đã đeo", "✓ Đã dùng", "✓ Đã chép").
 */
export function useActionConfirmFeedback(defaultDurationMs = 1100) {
  const [confirmedKeys, setConfirmedKeys] = useState<Record<string, boolean>>(
    {},
  );
  const timersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      const timers = timersRef.current;
      for (const key of Object.keys(timers)) {
        window.clearTimeout(timers[key]);
      }
      timersRef.current = {};
    };
  }, []);

  const triggerConfirm = useCallback(
    (key: string, durationMs = defaultDurationMs) => {
      if (!key) return;
      const existing = timersRef.current[key];
      if (existing !== undefined) {
        window.clearTimeout(existing);
      }
      setConfirmedKeys((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
      timersRef.current[key] = window.setTimeout(() => {
        delete timersRef.current[key];
        setConfirmedKeys((prev) => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, durationMs);
    },
    [defaultDurationMs],
  );

  const isConfirmed = useCallback(
    (key: string) => Boolean(confirmedKeys[key]),
    [confirmedKeys],
  );

  return { isConfirmed, triggerConfirm };
}
