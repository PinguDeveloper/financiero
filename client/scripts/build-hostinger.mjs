import { spawnSync } from "node:child_process";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").trim();

if (!apiBase && !process.env.RENDER) {
  console.error(
    "Defina NEXT_PUBLIC_API_BASE com a URL da API no Render antes de gerar o build estatico, ou use deploy no Render (mesmo dominio)."
  );
  process.exit(1);
}

const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NEXT_OUTPUT: "export",
  },
});

process.exit(result.status ?? 1);