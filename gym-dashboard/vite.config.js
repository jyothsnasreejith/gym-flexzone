import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["recharts"],
  },
  server: {
    proxy: {
      "/api": "http://localhost:5000",
      "/supabase-api": {
        target: "https://qjkvvbuububgqgljsyjb.supabase.co",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/supabase-api/, ""),
      },
    },
  },
});
