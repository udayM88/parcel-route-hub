import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { generateStaticSeoPages } from "./scripts/generate-static-seo";

// https://vitejs.dev/config/
function staticSeoPlugin(): Plugin {
  let outDir = path.resolve(__dirname, "dist");
  return {
    name: "viasetu-static-seo",
    apply: "build",
    configResolved: (config) => {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle: () => generateStaticSeoPages(outDir),
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    staticSeoPlugin(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
