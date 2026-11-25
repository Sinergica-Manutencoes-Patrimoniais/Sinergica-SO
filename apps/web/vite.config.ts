import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: resolve(__dirname, "../.."),
  plugins: [react(), tailwindcss()],
  // E00-S29 — vendors pesados em chunks próprios. `pdf-lib`, `@xyflow/react`, `@zip.js` e
  // `qrcode` servem a uma tela cada; sem isto os quatro viajavam no chunk de entrada de todo
  // mundo, inclusive do síndico que só abre o Portal.
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router"],
          "vendor-dados": ["@tanstack/react-query", "@supabase/supabase-js"],
          "vendor-pdf": ["pdf-lib"],
          "vendor-arquivo": ["@zip.js/zip.js", "@xmldom/xmldom"],
          "vendor-qrcode": ["qrcode"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@sinergica/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@sinergica/ui": resolve(__dirname, "../../packages/ui/src/index.ts"),
      "@sinergica/portal-core": resolve(__dirname, "../../packages/portal-core/src/index.ts"),
    },
  },
});
