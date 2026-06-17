import type { User } from "../generated/prisma/client.js";

export type SubscriptionStatus = "trial" | "active" | "expired";

export function trialMinutes(): number {
  const n = Number(process.env.TRIAL_MINUTES ?? "10");
  return Number.isFinite(n) && n > 0 ? n : 10;
}

const DAY_MS = 24 * 60 * 60_000;

export const subscriptionUserSelect = {
  subscriptionStatus: true,
  trialEndsAt: true,
  subscriptionEndsAt: true,
  subscriptionStartedAt: true,
  createdAt: true,
} as const;

export function subscriptionPayload(
  user: Pick<
    User,
    | "subscriptionStatus"
    | "trialEndsAt"
    | "subscriptionEndsAt"
    | "subscriptionStartedAt"
    | "createdAt"
  >
) {
  const now = Date.now();
  const trialEnd = user.trialEndsAt?.getTime() ?? 0;
  const subEnd = user.subscriptionEndsAt?.getTime() ?? 0;

  let hasAccess = false;
  if (user.subscriptionStatus === "active") {
    hasAccess = !user.subscriptionEndsAt || subEnd > now;
  } else if (user.subscriptionStatus === "trial") {
    hasAccess = trialEnd > now;
  }

  const status: SubscriptionStatus = hasAccess
    ? user.subscriptionStatus === "active"
      ? "active"
      : "trial"
    : "expired";

  let planLabel = "Sem plano ativo";
  let accessStartedAt: Date | null = null;
  let accessEndsAt: Date | null = null;

  if (status === "trial" && user.trialEndsAt) {
    planLabel = "Teste grátis";
    accessEndsAt = user.trialEndsAt;
    accessStartedAt = new Date(trialEnd - trialMinutes() * 60_000);
  } else if (user.subscriptionStatus === "active") {
    planLabel = "Plano mensal";
    accessEndsAt = user.subscriptionEndsAt;
    accessStartedAt =
      user.subscriptionStartedAt ??
      (user.subscriptionEndsAt
        ? new Date(subEnd - 30 * DAY_MS)
        : user.createdAt);
  } else if (user.subscriptionEndsAt) {
    planLabel = "Plano mensal (expirado)";
    accessEndsAt = user.subscriptionEndsAt;
    accessStartedAt =
      user.subscriptionStartedAt ?? new Date(subEnd - 30 * DAY_MS);
  } else if (user.trialEndsAt) {
    planLabel = "Teste grátis (expirado)";
    accessEndsAt = user.trialEndsAt;
    accessStartedAt = new Date(trialEnd - trialMinutes() * 60_000);
  }

  const endsMs = accessEndsAt?.getTime() ?? 0;
  const daysRemaining =
    hasAccess && accessEndsAt && endsMs > now
      ? Math.max(0, Math.ceil((endsMs - now) / DAY_MS))
      : status === "expired" && accessEndsAt
        ? 0
        : null;

  const startMs = accessStartedAt?.getTime() ?? 0;
  const totalDays =
    accessStartedAt && accessEndsAt && endsMs > startMs
      ? Math.max(1, Math.ceil((endsMs - startMs) / DAY_MS))
      : status === "trial"
        ? 0
        : null;

  return {
    status,
    planLabel,
    trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
    subscriptionEndsAt: user.subscriptionEndsAt?.toISOString() ?? null,
    accessStartedAt: accessStartedAt?.toISOString() ?? null,
    accessEndsAt: accessEndsAt?.toISOString() ?? null,
    hasAccess,
    minutesLeft:
      status === "trial" && trialEnd > now
        ? Math.max(0, Math.ceil((trialEnd - now) / 60_000))
        : null,
    daysRemaining,
    totalDays,
  };
}

export function trialEndsAtFromNow(): Date {
  return new Date(Date.now() + trialMinutes() * 60_000);
}

export function extendSubscriptionDays(days: number): Date {
  const base = Date.now();
  return new Date(base + days * 24 * 60 * 60_000);
}
