import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

if (!process.env.NEXT_PUBLIC_API_BASE) {
  console.error(
    "Defina NEXT_PUBLIC_API_BASE com a URL da API no Render antes de gerar o build estatico."
  );
  process.exit(1);
}

const nextBin = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);

if (!existsSync(nextBin)) {
  console.error("Next.js nao encontrado. Rode npm install antes do build.");
  process.exit(1);
}

const result = spawnSync(nextBin, ["build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_OUTPUT: "export",
  },
});

process.exit(result.status ?? 1);
