import Stripe from "stripe";

export type BillingPlanId = "monthly" | "yearly";

export const BILLING_PLANS: Record<
  BillingPlanId,
  { title: string; price: number; days: number }
> = {
  monthly: {
    title: "Atlas Invest — Plano Mensal",
    price: Number(process.env.STRIPE_MONTHLY_PRICE ?? "5"),
    days: 30,
  },
  yearly: {
    title: "Atlas Invest — Plano Anual",
    price: Number(process.env.STRIPE_YEARLY_PRICE ?? "249.9"),
    days: 365,
  },
};

function publicAppUrl(): string {
  return (process.env.APP_PUBLIC_URL ?? "http://127.0.0.1:5180").replace(/\/$/, "");
}

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export async function createCheckoutSession(
  userId: string,
  planId: BillingPlanId
): Promise<{ checkoutUrl: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe não configurado no servidor" };

  const plan = BILLING_PLANS[planId];
  if (!plan?.price || plan.price <= 0) {
    return { error: "Plano inválido" };
  }

  const appUrl = publicAppUrl();
  const amountCents = Math.round(plan.price * 100);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: amountCents,
            product_data: {
              name: plan.title,
              description: `${plan.days} dias de acesso ao Atlas Invest`,
            },
          },
        },
      ],
      success_url: `${appUrl}/app?payment=success`,
      cancel_url: `${appUrl}/app?payment=cancel`,
      client_reference_id: `${userId}:${planId}`,
      metadata: {
        userId,
        planId,
      },
    });

    if (!session.url) return { error: "Não foi possível criar o checkout" };
    return { checkoutUrl: session.url };
  } catch (e) {
    console.error("[stripe] checkout", e);
    return { error: "Falha ao criar pagamento" };
  }
}

export function parseCheckoutMetadata(
  metadata: Stripe.Metadata | null | undefined,
  clientReferenceId?: string | null
): { userId: string; planId: BillingPlanId } | null {
  const userId = metadata?.userId;
  const planId = metadata?.planId as BillingPlanId | undefined;
  if (userId && (planId === "monthly" || planId === "yearly")) {
    return { userId, planId };
  }
  if (clientReferenceId?.includes(":")) {
    const [uid, pid] = clientReferenceId.split(":");
    if (uid && (pid === "monthly" || pid === "yearly")) {
      return { userId: uid, planId: pid };
    }
  }
  return null;
}

export async function activateSubscriptionFromCheckout(
  userId: string,
  planId: BillingPlanId
): Promise<void> {
  const { prisma } = await import("../db.js");
  const { extendSubscriptionDays } = await import("./subscription.js");
  const plan = BILLING_PLANS[planId];
  const endsAt = extendSubscriptionDays(plan.days);

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: "active",
      subscriptionEndsAt: endsAt,
      trialEndsAt: null,
    },
  });
}

export function constructWebhookEvent(
  payload: Buffer,
  signature: string | undefined
): Stripe.Event | null {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret || !signature) return null;
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (e) {
    console.error("[stripe] webhook signature", e);
    return null;
  }
}
