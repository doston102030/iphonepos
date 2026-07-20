/**
 * Telegram Mini App bridge.
 *
 * The app must behave the same whether it is opened in a plain browser, added
 * to the home screen, or launched inside Telegram as a Mini App. Telegram's
 * webview has two habits that break a POS: a vertical swipe anywhere collapses
 * the whole app (deadly mid-sale, since every list here scrolls), and the
 * webview opens half-height until expand() is called. Both are fixed here once,
 * at boot, instead of being worked around per page.
 *
 * `window.Telegram.WebApp` exists whenever telegram-web-app.js has loaded —
 * even in a normal browser tab — so presence of the object proves nothing.
 * Only `initData`/`platform` distinguish a real Telegram session, and every
 * call below is a no-op outside one.
 */

interface TelegramWebApp {
  initData: string;
  platform: string;
  version: string;
  isExpanded: boolean;
  ready: () => void;
  expand: () => void;
  /** Bot API 7.7+ — older clients simply don't have the method. */
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  /** Bot API 7.10+ */
  setBottomBarColor?: (color: string) => void;
  /** Bot API 6.1+ */
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function insideTelegram(): boolean {
  const wa = window.Telegram?.WebApp;
  // `platform` is 'unknown' when the script runs outside a Telegram client.
  return !!wa && (wa.initData !== '' || (wa.platform !== '' && wa.platform !== 'unknown'));
}

/** Call once at boot, before React renders. Safe to call anywhere. */
export function initTelegram(): void {
  // Unconditional, not Telegram-only: iOS WebKit (Telegram webview AND
  // home-screen PWA) pans the whole window up to reveal a keyboard-covered
  // input even though this app has zero body scroll range — and often never
  // pans back after the keyboard closes, leaving the POS shifted with the dock
  // half off-screen and no way to drag it back. Restore the origin whenever
  // focus leaves form fields entirely; the delay lets focus land on the next
  // field first so tabbing between inputs doesn't jerk the page.
  window.addEventListener('focusout', () => {
    setTimeout(() => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !el.matches('input, textarea, select, [contenteditable]')) {
        window.scrollTo(0, 0);
      }
    }, 100);
  });

  if (!insideTelegram()) return;
  const wa = window.Telegram!.WebApp!;
  try {
    wa.ready();
    // Telegram opens mini apps at half height; a POS needs the whole screen.
    wa.expand();
    // A cashier flicking a product list must never accidentally close the app.
    wa.disableVerticalSwipes?.();
    document.documentElement.classList.add('tg-app');
  } catch {
    /* an old client missing a method must never take the app down */
  }
}

/**
 * Paints Telegram's own chrome (header, background, bottom bar) in the app's
 * background colour so the mini app reads as one surface, not a webpage in a
 * frame. Hexes mirror --background in src/index.css — Telegram accepts only
 * hex, not hsl() vars, so they are duplicated here on purpose.
 */
export function syncTelegramTheme(theme: 'light' | 'dark'): void {
  if (!insideTelegram()) return;
  const wa = window.Telegram!.WebApp!;
  const bg = theme === 'dark' ? '#111113' : '#f2f2f7';
  try {
    wa.setHeaderColor?.(bg);
    wa.setBackgroundColor?.(bg);
    wa.setBottomBarColor?.(bg);
  } catch {
    /* cosmetic only */
  }
}
