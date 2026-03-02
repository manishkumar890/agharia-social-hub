import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
    allowedHosts: [
      "agharia-hub.cluster-0.preview.emergentcf.cloud",
      ".emergentagent.com",
      ".emergentcf.cloud",
      "localhost"
    ],
    hmr: {
      overlay: false,
    },
  },
  build: {
    target: ['es2015', 'chrome63', 'firefox68', 'safari11', 'edge79'],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
    force: true,
  },
}));
