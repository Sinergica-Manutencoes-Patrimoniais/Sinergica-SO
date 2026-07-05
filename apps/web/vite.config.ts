import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: resolve(__dirname, "../.."),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@sinergica/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@sinergica/ui": resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
});
