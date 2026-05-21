import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  clearAuthCookies,
  readAuthTokenFromRequest,
  setAuthCookie,
} from "../lib/authCookie.js";
import { signUserToken, verifyUserToken } from "../lib/jwt.js";
import { verifyPassword } from "../lib/password.js";
import { isEmailConfigured } from "../lib/email.js";
import { startRegistration, verifyRegistrationAndCreateUser } from "../lib/emailVerification.js";
import { createPasswordResetToken, resetPasswordWithToken } from "../lib/passwordReset.js";
import { subscriptionPayload, subscriptionUserSelect } from "../lib/subscription.js";

function emailErrorForClient(error?: string): string | undefined {
  if (!error) return undefined;
  if (error.includes("RESEND_API_KEY")) return error;
  if (error.includes("only send testing emails")) {
    return "Modo teste Resend: só envia para o e-mail da sua conta Resend. Cadastre-se no app com esse e-mail ou verifique um domínio em resend.com/domains.";
  }
  const lower = error.toLowerCase();
  if (
    lower.includes("domain") ||
    lower.includes("not verified") ||
    lower.includes("from") ||
    lower.includes("sender")
  ) {
    return `Remetente inválido ou domínio não verificado na Resend. Use EMAIL_FROM com @atlasinvest.site após o domínio ficar Verified. Detalhe: ${error}`;
  }
  return process.env.NODE_ENV !== "production" ? error : undefined;
}

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const verifyCodeSchema = z.object({
  email: z.string().email().max(255),
  code: z.string().min(4).max(8),
});

router.post("/register-start", async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "E-mail ou senha inválidos" });
    return;
  }
  const result = await startRegistration(parsed.data.email, parsed.data.password);
  if ("error" in result) {
    res.status(409).json({ error: result.error });
    return;
  }
  res.status(201).json({
    ok: true,
    email: parsed.data.email.trim().toLowerCase(),
    emailSent: result.emailSent,
    emailError: emailErrorForClient(result.emailError),
    devCode: result.devCode,
  });
});

router.post("/register-verify", async (req: Request, res: Response) => {
  const parsed = verifyCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Código ou e-mail inválidos" });
    return;
  }
  const result = await verifyRegistrationAndCreateUser(parsed.data.email, parsed.data.code);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  setAuthCookie(res, result.accessToken);
  const user = await prisma.user.findUnique({
    where: { id: result.user.id },
    select: {
      id: true,
      email: true,
      ...subscriptionUserSelect,
    },
  });
  res.status(201).json({
    user: { id: result.user.id, email: result.user.email },
    accessToken: result.accessToken,
    subscription: user ? subscriptionPayload(user) : null,
  });
});

/** Legado — use register-start + register-verify */
router.post("/register", async (_req: Request, res: Response) => {
  res.status(410).json({
    error: "Cadastro em duas etapas: solicite o código em /auth/register-start e confirme em /auth/register-verify.",
  });
});

const forgotSchema = z.object({ email: z.string().email().max(255) });
const resetSchema = z.object({
  token: z.string().min(16).max(128),
  password: z.string().min(8).max(128),
});

router.post("/forgot-password", async (req: Request, res: Response) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "E-mail inválido" });
    return;
  }
  const result = await createPasswordResetToken(parsed.data.email);
  const message = result.emailSent
    ? "Enviamos um e-mail com o link para redefinir sua senha. Confira também a pasta de spam."
    : "Se o e-mail estiver cadastrado, você receberá as instruções em instantes.";
  res.json({
    ok: true,
    message,
    emailSent: result.emailSent,
    emailConfigured: result.emailConfigured ?? isEmailConfigured(),
    resetUrl: result.resetUrl,
    emailError: emailErrorForClient(result.emailError),
  });
});

router.post("/reset-password", async (req: Request, res: Response) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  const result = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "E-mail ou senha inválidos" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      ...subscriptionUserSelect,
    },
  });
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
  setAuthCookie(res, token);
  res.json({
    user: { id: user.id, email: user.email },
    accessToken: token,
    subscription: subscriptionPayload(user),
  });
});

router.post("/logout", (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

router.get("/me", async (req: Request, res: Response) => {
  const token = readAuthTokenFromRequest(req);
  if (!token) {
    res.json({ user: null });
    return;
  }
  try {
    const { sub } = verifyUserToken(token);
    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: {
        id: true,
        email: true,
        ...subscriptionUserSelect,
      },
    });
    if (!user) {
      res.json({ user: null });
      return;
    }
    res.json({
      user: { id: user.id, email: user.email },
      subscription: subscriptionPayload(user),
    });
  } catch {
    res.json({ user: null });
  }
});

export const authRouter = router;
