
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: false,
    hmr: {
      port: 24678
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
    },
  },
});
