import { randomBytes } from "crypto";
import { prisma } from "../db.js";
import {
  isEmailConfigured,
  sendBillingAdminNotifyEmail,
  sendSubscriptionVoucherEmail,
} from "./email.js";
import { buildPixChargeForUser } from "./pixCharge.js";
import { extendSubscriptionDays } from "./subscription.js";
import { isStripeConfigured } from "./stripeBilling.js";

export type BillingMode = "manual" | "stripe";

export function billingMode(): BillingMode {
  if (process.env.SUBSCRIPTION_MODE === "stripe" && isStripeConfigured()) {
    return "stripe";
  }
  return "manual";
}

export function manualPlanPrice(): number {
  return Number(process.env.MANUAL_PLAN_PRICE ?? process.env.STRIPE_MONTHLY_PRICE ?? "5");
}

export function manualPlanDays(): number {
  return Number(process.env.MANUAL_PLAN_DAYS ?? "30") || 30;
}

export function getManualBillingPublicInfo() {
  return {
    mode: "manual" as const,
    price: manualPlanPrice(),
    days: manualPlanDays(),
    pixKey: process.env.PIX_KEY?.trim() || "",
    pixRecipient: process.env.PIX_RECIPIENT_NAME?.trim() || "Atlas Invest",
    contactUrl: process.env.SUBSCRIPTION_CONTACT_URL?.trim() || "",
    instructions:
      process.env.SUBSCRIPTION_PAYMENT_INSTRUCTIONS?.trim() ||
      "Escaneie o QR Code ou copie o PIX. Depois clique em «Já fiz o PIX» — enviaremos o código ao seu e-mail após confirmação.",
  };
}

function parseVouchers(): Map<string, number> {
  const raw = process.env.SUBSCRIPTION_VOUCHERS?.trim() ?? "";
  const map = new Map<string, number>();
  if (!raw) return map;
  for (const part of raw.split(",")) {
    const [code, daysStr] = part.split(":").map((s) => s.trim());
    if (!code) continue;
    const days = Number(daysStr ?? manualPlanDays());
    map.set(code.toUpperCase(), days > 0 ? days : manualPlanDays());
  }
  return map;
}

export async function activatePaidPlan(userId: string, days: number): Promise<void> {
  const endsAt = extendSubscriptionDays(days);
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: "active",
      subscriptionEndsAt: endsAt,
      subscriptionStartedAt: new Date(),
      trialEndsAt: null,
    },
  });
}

function appPublicUrl(): string {
  return (process.env.APP_PUBLIC_URL?.trim() || "http://127.0.0.1:5180").replace(/\/$/, "");
}

function generateSubscriptionCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

async function redeemCodeForUser(
  userId: string,
  normalized: string,
  days: number,
  markIssuedRedeemed: boolean
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.redeemedVoucher.create({ data: { code: normalized, userId } });
    if (markIssuedRedeemed) {
      await tx.issuedSubscriptionCode.update({
        where: { code: normalized },
        data: { redeemedAt: new Date(), redeemedByUserId: userId },
      });
    }
    await tx.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: "active",
        subscriptionEndsAt: extendSubscriptionDays(days),
        subscriptionStartedAt: new Date(),
        trialEndsAt: null,
      },
    });
  });
}

export async function redeemVoucher(
  userId: string,
  code: string
): Promise<{ ok: true; days: number } | { error: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { error: "Informe o código de liberação" };
  }

  const used = await prisma.redeemedVoucher.findUnique({ where: { code: normalized } });
  if (used) {
    return { error: "Este código já foi utilizado." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return { error: "Usuário não encontrado" };

  const issued = await prisma.issuedSubscriptionCode.findUnique({ where: { code: normalized } });
  if (issued) {
    if (issued.redeemedAt) {
      return { error: "Este código já foi utilizado." };
    }
    if (issued.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return { error: "Este código foi enviado para outro e-mail. Entre com a conta correta." };
    }
    await redeemCodeForUser(userId, normalized, issued.days, true);
    console.info(`[billing] Código emitido ${normalized} usado por user=${userId}`);
    return { ok: true, days: issued.days };
  }

  const vouchers = parseVouchers();
  const days = vouchers.get(normalized);
  if (!days) {
    return { error: "Código inválido. Confira o e-mail ou com quem liberou seu acesso." };
  }

  await redeemCodeForUser(userId, normalized, days, false);
  console.info(`[billing] Voucher ${normalized} usado por user=${userId} (+${days}d)`);
  return { ok: true, days };
}

export async function requestVoucherByEmail(
  userId: string
): Promise<{ ok: true; message: string } | { error: string }> {
  if (!isEmailConfigured()) {
    return { error: "Envio por e-mail indisponível no momento. Tente mais tarde." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, subscriptionStatus: true, subscriptionEndsAt: true },
  });
  if (!user) return { error: "Usuário não encontrado" };

  const now = new Date();
  if (
    user.subscriptionStatus === "active" &&
    user.subscriptionEndsAt &&
    user.subscriptionEndsAt > now
  ) {
    return { error: "Sua assinatura já está ativa." };
  }

  const adminNotify = process.env.BILLING_ADMIN_NOTIFY_EMAIL?.trim();
  if (!adminNotify) {
    return {
      error:
        "Aprovação por e-mail não está configurada no servidor. Entre em contato com o suporte.",
    };
  }

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentPending = await prisma.voucherCodeRequest.findFirst({
    where: {
      userId,
      status: "pending",
      createdAt: { gte: dayAgo },
    },
  });
  if (recentPending) {
    return {
      ok: true,
      message:
        "Já registramos seu pedido. Assim que o pagamento for confirmado, o código chegará no seu e-mail.",
    };
  }

  const charge = await buildPixChargeForUser(userId);
  const approveToken = randomBytes(24).toString("hex");
  const expectedAmountCents = charge?.amountCents ?? null;

  await prisma.voucherCodeRequest.create({
    data: {
      userId,
      email: user.email,
      status: "pending",
      approveToken,
      expectedAmountCents,
    },
  });

  const amountLabel = charge
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(charge.amount)
    : `R$ ${manualPlanPrice().toFixed(2)}`;

  const approveUrl = `${appPublicUrl()}/api/billing/admin/approve?token=${approveToken}`;
  const mail = await sendBillingAdminNotifyEmail(
    adminNotify,
    user.email,
    approveUrl,
    amountLabel
  );

  if (!mail.sent) {
    console.error("[billing] Falha e-mail admin:", mail.error);
  }

  console.info(`[billing] Pedido PIX ${user.email} (${amountLabel}) token=${approveToken.slice(0, 8)}…`);

  return {
    ok: true,
    message:
      "Pedido enviado! Confira seu e-mail em alguns minutos — enviaremos o código após confirmarmos o PIX.",
  };
}

export async function approveVoucherRequest(
  approveToken: string
): Promise<{ ok: true; email: string } | { error: string }> {
  const token = approveToken.trim();
  if (!token) return { error: "Link inválido" };

  const pending = await prisma.voucherCodeRequest.findFirst({
    where: { approveToken: token, status: "pending" },
  });
  if (!pending) {
    return { error: "Pedido não encontrado ou já foi processado." };
  }

  const result = await issueVoucherCodeByEmail(pending.email);
  if ("error" in result) return { error: result.error };

  await prisma.voucherCodeRequest.update({
    where: { id: pending.id },
    data: { status: "fulfilled", fulfilledAt: new Date() },
  });

  console.info(`[billing] Aprovado via link: ${pending.email}`);
  return { ok: true, email: pending.email };
}

export async function getVoucherRequestForApprove(approveToken: string) {
  return prisma.voucherCodeRequest.findFirst({
    where: { approveToken: approveToken.trim(), status: "pending" },
    select: { email: true, expectedAmountCents: true, approveToken: true },
  });
}

export async function issueVoucherCodeByEmail(
  email: string,
  days?: number
): Promise<{ ok: true; code: string; emailSent: boolean } | { error: string }> {
  if (!isEmailConfigured()) {
    return { error: "RESEND_API_KEY / EMAIL_FROM não configurados" };
  }

  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return { error: "Usuário não encontrado com esse e-mail" };

  const planDays = days ?? manualPlanDays();
  let code = generateSubscriptionCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await prisma.issuedSubscriptionCode.findUnique({ where: { code } });
    if (!exists) break;
    code = generateSubscriptionCode();
  }

  await prisma.issuedSubscriptionCode.create({
    data: { code, email: normalized, days: planDays },
  });

  const mail = await sendSubscriptionVoucherEmail(
    normalized,
    code,
    planDays,
    appPublicUrl()
  );

  await prisma.voucherCodeRequest.updateMany({
    where: { email: normalized, status: "pending" },
    data: { status: "fulfilled", fulfilledAt: new Date() },
  });

  console.info(`[billing] Código ${code} emitido para ${normalized} (email=${mail.sent})`);
  if (!mail.sent) {
    return { error: mail.error ?? "Falha ao enviar e-mail" };
  }

  return { ok: true, code, emailSent: true };
}

export async function listPendingVoucherRequests() {
  return prisma.voucherCodeRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      email: true,
      createdAt: true,
      expectedAmountCents: true,
    },
  });
}

export { buildPixChargeForUser };

export function checkAdminKey(header: string | undefined): boolean {
  const expected = process.env.ADMIN_API_KEY?.trim();
  if (!expected) return false;
  return header === expected;
}

export async function activateUserByEmail(
  email: string,
  days?: number
): Promise<{ ok: true } | { error: string }> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return { error: "Usuário não encontrado" };
  await activatePaidPlan(user.id, days ?? manualPlanDays());
  console.info(`[billing] Admin ativou ${normalized} por ${days ?? manualPlanDays()} dias`);
  return { ok: true };
}
