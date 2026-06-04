import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, "..");
const src = path.join(serverRoot, "..", "client", "out");
const dest = path.join(serverRoot, "static-app");
const indexHtml = path.join(src, "index.html");

if (!fs.existsSync(indexHtml)) {
  console.error(
    "[copy-client-out] Falta client/out/index.html. Rode antes: npm run build:hostinger -w client"
  );
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log("[copy-client-out] Copiado para", dest);
