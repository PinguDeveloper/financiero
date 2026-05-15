import type { RequestHandler } from "express";
import { verifyUserToken } from "../lib/jwt.js";

function readToken(req: Parameters<RequestHandler>[0]): string | undefined {
  const c = req.cookies as Record<string, string | undefined> | undefined;
  if (c?.token) return c.token;
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return undefined;
}

export const requireUser: RequestHandler = (req, res, next) => {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  try {
    const { sub } = verifyUserToken(token);
    req.userId = sub;
    next();
  } catch {
    res.status(401).json({ error: "Sessão inválida ou expirada" });
  }
};
