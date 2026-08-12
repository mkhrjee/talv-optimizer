import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes asset paths relative so the build works when served from
// the local backend at any host/port, or opened via file://.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    // Dev server proxies API + SSE calls to the local backend.
    proxy: {
      "/api": {
        target: "http://localhost:5178",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
