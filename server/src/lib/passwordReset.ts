import crypto from "node:crypto";
import { prisma } from "../db.js";
import { hashPassword } from "./password.js";

const RESET_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(email: string): Promise<{
  ok: true;
  resetUrl?: string;
}> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return { ok: true };

  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const expose =
    process.env.NODE_ENV !== "production" || process.env.RESET_EXPOSE_TOKEN === "1";
  const base = (process.env.APP_PUBLIC_URL ?? "http://127.0.0.1:5180").replace(/\/$/, "");
  const resetUrl = expose ? `${base}/?reset=${raw}` : undefined;

  if (process.env.NODE_ENV !== "production") {
    console.info(`[password-reset] ${user.email} → ${resetUrl ?? "(configure e-mail em produção)"}`);
  }

  return { ok: true, resetUrl };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ ok: true } | { error: string }> {
  const tokenHash = hashToken(token.trim());
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!row || row.expiresAt < new Date()) {
    return { error: "Link inválido ou expirado. Solicite um novo." };
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
  ]);
  return { ok: true };
}
