import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, "..");
const repoRoot = path.join(serverRoot, "..");
const dest = path.join(serverRoot, "node_modules", "@prisma", "client");

function hasPackage(dir) {
  return fs.existsSync(path.join(dir, "package.json"));
}

if (hasPackage(dest)) {
  process.exit(0);
}

const sources = [
  path.join(serverRoot, "node_modules", "@prisma", "client"),
  path.join(repoRoot, "node_modules", "@prisma", "client"),
  path.join(repoRoot, "node_modules", "controle-financeiro-server", "node_modules", "@prisma", "client"),
];

const src = sources.find(hasPackage);
if (!src) {
  console.error(
    "[ensure-prisma-client] @prisma/client not found. Run npm install at the repo root first."
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true, force: true });
console.log("[ensure-prisma-client] Prepared", dest);
