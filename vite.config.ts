import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "path";

// Dev-only proxy target. Override with VITE_API_BASE_URL when pointing at a
// staging box or a locally running backend.
const API_TARGET = process.env.VITE_API_BASE_URL ?? "https://api.netdc.uz";

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        secure: true,
        configure(proxy) {
          // Without this, an unreachable backend (bad host, DNS failure, TLS
          // error) surfaces in the browser as a bare 500 with no explanation.
          proxy.on("error", (err, _req, res) => {
            console.error(`\n[proxy] ${API_TARGET} ga ulanib bo'lmadi: ${err.message}`);
            console.error("[proxy] VITE_API_BASE_URL ni tekshiring yoki .env da VITE_USE_MOCK=true qiling.\n");
            if ("writeHead" in res && !res.headersSent) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                message: `Backend (${API_TARGET}) javob bermayapti: ${err.message}`,
              }));
            }
          });
        },
      },
    },
  },
});
