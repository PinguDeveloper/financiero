import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { apiRouter } from "./routes/api.js";
import { authRouter } from "./routes/auth.js";
import { billingRouter, handleStripeWebhook } from "./routes/billing.js";
import { publicMarketRouter } from "./routes/publicMarket.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        const raw =
          process.env.CLIENT_ORIGIN ??
          "http://localhost:5180,http://127.0.0.1:5180,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4000,http://127.0.0.1:4000";
        const allowed = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!origin || origin === "null") {
  callback(null, true);
  return;
}
        if (allowed.includes(origin)) {
          callback(null, true);
          return;
        }
        if (process.env.ALLOW_VERCEL_PREVIEWS === "1") {
          try {
            const host = new URL(origin).hostname;
            if (host.endsWith(".vercel.app")) {
              callback(null, true);
              return;
            }
          } catch {
            /* ignore */
          }
        }
        callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(cookieParser());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    handleStripeWebhook
  );

  app.use(express.json({ limit: "1mb" }));

  app.use("/auth", authRouter);
  app.use("/api/public", publicMarketRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api", apiRouter);

  const distRaw =
    process.env.CLIENT_DIST?.trim() || path.join(__dirname, "..", "static-app");
  const dist = path.isAbsolute(distRaw)
    ? distRaw
    : path.resolve(path.join(__dirname, ".."), distRaw);
  const indexHtml = path.join(dist, "index.html");
  if (fs.existsSync(indexHtml)) {
    console.log(`[static] Servindo interface em ${dist}`);
    app.use(express.static(dist));
    app.get(/^(?!\/api\/)(?!\/auth\/).*/, (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET") {
        next();
        return;
      }
      if (req.path.includes(".")) {
        next();
        return;
      }
      res.sendFile(indexHtml);
    });
  } else {
    console.warn(`[static] Interface não encontrada (${indexHtml}). Confira o build do client no deploy.`);
    app.get("/", (_req: Request, res: Response) => {
      res
        .status(503)
        .type("text/html; charset=utf-8")
        .send(
          `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Serviço</title></head><body style="font-family:system-ui;max-width:36rem;margin:2rem auto;line-height:1.6;padding:0 1rem">
<h1 style="font-size:1.25rem">Página em configuração</h1>
<p style="color:#444">A API está no ar, mas o <strong>build do site</strong> não foi publicado neste deploy.</p>
<p style="color:#666;font-size:0.875rem">No Render, use Build Command: <code>cd .. &amp;&amp; npm install --include=dev &amp;&amp; npm run build:hostinger -w client &amp;&amp; cd server &amp;&amp; npx prisma generate &amp;&amp; npm run db:migrate &amp;&amp; npm run build</code>. Remova <code>CLIENT_DIST</code> antigo ou use <code>static-app</code> dentro de server.</p>
<p><a href="/health">Verificar disponibilidade do serviço</a></p>
</body></html>`
        );
    });
  }

  return app;
}
