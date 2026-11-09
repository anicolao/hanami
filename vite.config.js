import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.PUBLIC_BASE_PATH || "/",
  server: { host: "127.0.0.1", port: 5191, strictPort: true },
});
