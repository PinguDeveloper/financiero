import type { RequestHandler } from "express";
import { readAuthTokenFromRequest } from "../lib/authCookie.js";
import { verifyUserToken } from "../lib/jwt.js";

function readToken(req: Parameters<RequestHandler>[0]): string | undefined {
  return readAuthTokenFromRequest(req);
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
