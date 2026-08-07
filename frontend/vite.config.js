import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes asset paths relative so the same build works on GitHub
// Pages (any subpath), when served by the local backend, or from file://.
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
