import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      allow: [resolve(__dirname, "..")],
    },
  },
  build: {
    outDir: resolve(__dirname, "../public"),
    emptyOutDir: true,
  },
});
