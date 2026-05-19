import crypto from "node:crypto";
import { prisma } from "../db.js";
import { hashPassword } from "./password.js";
import { isEmailConfigured, sendPasswordResetEmail } from "./email.js";

const RESET_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function resetUrlForToken(rawToken: string): string {
  const base = (process.env.APP_PUBLIC_URL ?? "http://127.0.0.1:5180").replace(/\/$/, "");
  return `${base}/?reset=${rawToken}`;
}

export async function createPasswordResetToken(email: string): Promise<{
  ok: true;
  emailSent: boolean;
  /** Apenas em dev quando e-mail não está configurado */
  resetUrl?: string;
  /** Motivo da falha (dev ou RESET_EXPOSE_TOKEN) */
  emailError?: string;
}> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return { ok: true, emailSent: false };

  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  const resetUrl = resetUrlForToken(raw);

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const { sent, error } = await sendPasswordResetEmail(user.email, resetUrl);

  if (sent) {
    return { ok: true, emailSent: true };
  }

  const exposeDev =
    process.env.NODE_ENV !== "production" || process.env.RESET_EXPOSE_TOKEN === "1";
  if (exposeDev) {
    console.info(`[password-reset] E-mail não enviado (${error ?? "sem API"}). Link: ${resetUrl}`);
    return { ok: true, emailSent: false, resetUrl, emailError: error };
  }

  if (!isEmailConfigured()) {
    console.error("[password-reset] Configure RESEND_API_KEY e EMAIL_FROM no Render.");
  } else if (error) {
    console.error("[password-reset] Falha ao enviar:", error);
  }

  return { ok: true, emailSent: false };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ ok: true } | { error: string }> {
  const tokenHash = hashToken(token.trim());
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!row || row.expiresAt < new Date()) {
    return { error: "Link inválido ou expirado. Solicite um novo e-mail de redefinição." };
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
  ]);
  return { ok: true };
}
