import crypto from "node:crypto";
import { prisma } from "../db.js";
import { hashPassword } from "./password.js";
import { sendVerificationCodeEmail } from "./email.js";
import { signUserToken } from "./jwt.js";
import { trialEndsAtFromNow } from "./subscription.js";

const CODE_TTL_MS = 15 * 60 * 1000;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code.trim()).digest("hex");
}

function generateCode(): string {
  return String(crypto.randomInt(100_000, 1_000_000));
}

export async function startRegistration(
  email: string,
  password: string
): Promise<
  | { ok: true; emailSent: boolean; emailError?: string; devCode?: string }
  | { error: string }
> {
  const normalized = email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email: normalized } });
  if (exists) return { error: "E-mail já cadastrado" };

  const code = generateCode();
  const passwordHash = await hashPassword(password);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.pendingRegistration.upsert({
    where: { email: normalized },
    create: {
      email: normalized,
      passwordHash,
      codeHash: hashCode(code),
      expiresAt,
    },
    update: {
      passwordHash,
      codeHash: hashCode(code),
      expiresAt,
    },
  });

  const { sent, error } = await sendVerificationCodeEmail(normalized, code);
  const exposeDev =
    process.env.NODE_ENV !== "production" || process.env.RESET_EXPOSE_TOKEN === "1";

  if (sent) return { ok: true, emailSent: true };
  if (exposeDev) return { ok: true, emailSent: false, emailError: error, devCode: code };
  return { ok: true, emailSent: false, emailError: error };
}

export async function verifyRegistrationAndCreateUser(
  email: string,
  code: string
): Promise<
  | { user: { id: string; email: string }; accessToken: string }
  | { error: string }
> {
  const normalized = email.trim().toLowerCase();
  const pending = await prisma.pendingRegistration.findUnique({
    where: { email: normalized },
  });
  if (!pending || pending.expiresAt < new Date()) {
    return { error: "Código inválido ou expirado. Solicite um novo código." };
  }
  if (pending.codeHash !== hashCode(code)) {
    return { error: "Código incorreto." };
  }

  const exists = await prisma.user.findUnique({ where: { email: normalized } });
  if (exists) {
    await prisma.pendingRegistration.delete({ where: { email: normalized } });
    return { error: "E-mail já cadastrado. Faça login." };
  }

  const trialEndsAt = trialEndsAtFromNow();
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: normalized,
        passwordHash: pending.passwordHash,
        emailVerifiedAt: new Date(),
        subscriptionStatus: "trial",
        trialEndsAt,
      },
    });
    await tx.pendingRegistration.delete({ where: { email: normalized } });
    return created;
  });

  const accessToken = signUserToken(user.id);
  return { user: { id: user.id, email: user.email }, accessToken };
}
