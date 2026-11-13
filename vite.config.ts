import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { "@": path.resolve(dirname, "src") } },
  build: { target: "es2022", cssCodeSplit: false, assetsInlineLimit: 1024 * 1024 },
  server: { host: "0.0.0.0", port: 5173, allowedHosts: true }
});
