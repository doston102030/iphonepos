import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { initTelegram } from "./lib/telegram";
import { installHaptics } from "./lib/haptics";
import "./index.css";

// Before render: inside Telegram the webview opens half-height and closes on a
// vertical swipe — both must be fixed before the first paint, not after.
initTelegram();
installHaptics();

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,

  // Only report from a real deployment. A crash on a developer's machine is
  // already in the console, and sending it would bury the cashiers' real crashes
  // under noise from every hot reload.
  enabled: import.meta.env.PROD,

  // Errors, not performance. This runs on cheap phones over shop wifi; tracing
  // every request would cost bandwidth and tell us nothing we need.
  tracesSampleRate: 0,

  // Noise that is never actionable: a cashier walking out of wifi range, or the
  // browser tearing down a request when they navigate away mid-load.
  ignoreErrors: [
    "Server bilan bog'lanib bo'lmadi. Internet aloqasini tekshiring.",
    'Failed to fetch',
    'NetworkError',
    'Load failed',
    'AbortError',
    'ResizeObserver loop limit exceeded',
  ],
});

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={
      <div style={{ padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <p>Dasturda xatolik yuz berdi. Sahifani yangilab ko'ring.</p>
      </div>
    }
  >
    <AppWrapper>
      <App />
    </AppWrapper>
  </Sentry.ErrorBoundary>
);
