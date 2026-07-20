/**
 * One light tap for every tap. Wired once at boot as a capturing pointerdown
 * listener instead of per-component: every button, link, tab, keypad key and
 * switch in the app buzzes the same way, and new UI gets it for free.
 *
 * Inside Telegram the native HapticFeedback API is used — the only vibration
 * that works in Telegram on iOS. Elsewhere navigator.vibrate covers Android
 * browsers; iOS Safari outside Telegram has no vibration API at all, so the
 * listener quietly does nothing there.
 */

import { insideTelegram } from './telegram';

const INTERACTIVE =
  'button, a, [role="button"], [role="tab"], [role="menuitem"], [role="option"], ' +
  'input, select, textarea, label, [data-haptic]';

let lastBuzz = 0;

function buzz(): void {
  // A tap can surface as pointerdown on a child and again on the control
  // itself; one buzz per physical tap.
  const now = Date.now();
  if (now - lastBuzz < 80) return;
  lastBuzz = now;

  // Gate on a REAL Telegram session, not on the object: telegram-web-app.js
  // defines HapticFeedback in a plain browser tab too, where calling it does
  // nothing — and would swallow the vibration a phone browser can produce.
  if (insideTelegram()) {
    const haptic = window.Telegram?.WebApp?.HapticFeedback;
    if (haptic?.impactOccurred) {
      try {
        haptic.impactOccurred('light');
        return;
      } catch {
        /* an old client missing the method must never take the app down */
      }
    }
  }
  try {
    navigator.vibrate?.(10);
  } catch {
    /* some webviews expose vibrate but forbid calling it */
  }
}

/** Call once at boot, alongside initTelegram(). */
export function installHaptics(): void {
  document.addEventListener(
    'pointerdown',
    e => {
      const target = e.target;
      if (target instanceof Element && target.closest(INTERACTIVE)) buzz();
    },
    { capture: true, passive: true },
  );
}
