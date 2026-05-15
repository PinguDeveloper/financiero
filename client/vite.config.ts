import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Sempre a pasta `client/`, mesmo se o Vite for invocado com cwd na raiz do monorepo */
const clientRoot = path.dirname(fileURLToPath(import.meta.url));

const apiTarget = process.env.VITE_DEV_API_PROXY ?? "http://127.0.0.1:4000";
/** 5180 evita conflito com outros programas que costumam ocupar 5173 e devolver 404 (não é o Vite). */
const devPort = Number(process.env.VITE_DEV_PORT ?? "5180") || 5180;

export default defineConfig({
  root: clientRoot,
  appType: "spa",
  plugins: [react()],
  server: {
    /** 127.0.0.1 evita ambiguidade localhost (IPv4 vs IPv6) em alguns ambientes Windows + Firefox */
    host: process.env.VITE_DEV_BIND?.trim() || "127.0.0.1",
    port: devPort,
    /** Se a porta estiver ocupada, o Vite encerra com erro (evita subir em outra porta sem você perceber). */
    strictPort: true,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/auth": { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false,
  },
});
