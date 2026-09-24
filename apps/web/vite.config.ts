import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev server on 5174 (admin owns 5173).
//
// Multi page build: each extra input is a folder with its own index.html, so
// the static host serves /privacy and /terms as clean URLs with no rewrite
// rules (dist/privacy/index.html, dist/terms/index.html).
export default defineConfig({
  plugins: [react()],
  // Multi page, not a single page app: no history fallback to index.html, so
  // dev and preview resolve /privacy and /terms exactly like the static host.
  appType: "mpa",
  server: { port: 5174, host: true },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        privacy: "privacy/index.html",
        terms: "terms/index.html",
      },
    },
  },
});
