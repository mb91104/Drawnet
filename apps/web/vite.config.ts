import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const pkg = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@drawnet/schema": pkg("../../packages/schema/src/index.ts"),
      "@drawnet/models": pkg("../../packages/models/src/index.ts"),
      "@drawnet/engine": pkg("../../packages/engine/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
});
