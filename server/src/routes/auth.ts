import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { signUserToken, verifyUserToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

function authCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    secure: isProd,
    maxAge: 14 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

router.post("/register", async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "E-mail ou senha inválidos" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(409).json({ error: "E-mail já cadastrado" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  const token = signUserToken(user.id);
  res.cookie("token", token, authCookieOptions());
  res.status(201).json({ user: { id: user.id, email: user.email } });
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "E-mail ou senha inválidos" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }
  const token = signUserToken(user.id);
  res.cookie("token", token, authCookieOptions());
  res.json({ user: { id: user.id, email: user.email } });
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("token", { path: "/" });
  res.json({ ok: true });
});

router.get("/me", async (req: Request, res: Response) => {
  const token =
    (req.cookies as Record<string, string | undefined> | undefined)?.token ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined);
  if (!token) {
    res.json({ user: null });
    return;
  }
  try {
    const { sub } = verifyUserToken(token);
    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, email: true },
    });
    if (!user) {
      res.json({ user: null });
      return;
    }
    res.json({ user });
  } catch {
    res.json({ user: null });
  }
});

export const authRouter = router;
