import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev server on 5173 (matches the API's CORS allow-list + ADMIN_APP_URL default).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
});
