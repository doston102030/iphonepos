import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import "./index.css";

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,
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
