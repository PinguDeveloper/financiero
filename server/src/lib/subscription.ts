import type { User } from "@prisma/client";

export type SubscriptionStatus = "trial" | "active" | "expired";

export function trialMinutes(): number {
  const n = Number(process.env.TRIAL_MINUTES ?? "10");
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export function subscriptionPayload(user: Pick<
  User,
  "subscriptionStatus" | "trialEndsAt" | "subscriptionEndsAt"
>) {
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

  return {
    status,
    trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
    subscriptionEndsAt: user.subscriptionEndsAt?.toISOString() ?? null,
    hasAccess,
    minutesLeft:
      status === "trial" && trialEnd > now
        ? Math.max(0, Math.ceil((trialEnd - now) / 60_000))
        : null,
  };
}

export function trialEndsAtFromNow(): Date {
  return new Date(Date.now() + trialMinutes() * 60_000);
}

export function extendSubscriptionDays(days: number): Date {
  const base = Date.now();
  return new Date(base + days * 24 * 60 * 60_000);
}
