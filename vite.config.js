import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["recharts", "html2canvas", "react-pdf"],
    exclude: ["fs", "path", "crypto", "os"],
  },
  build: {
    ssr: false,
    minify: "terser",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: [
        "fs",
        "path",
        "crypto",
        "os",
        "events",
        "util",
        "buffer",
        "stream",
      ],
      output: {
        manualChunks: {
          recharts: ["recharts"],
          html2canvas: ["html2canvas"],
          pdfrenderer: ["react-pdf"],
        },
      },
      onwarn(warning) {
        // Suppress specific warnings
        if (warning.code === "EXTERNAL_NO_RESOLVABLE_ID") {
          return;
        }
        console.warn(warning.message);
      },
    },
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
