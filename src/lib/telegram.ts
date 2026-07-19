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
