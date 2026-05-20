import type { Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../db.js";
import {
  activateSubscriptionFromCheckout,
  BILLING_PLANS,
  constructWebhookEvent,
  createCheckoutSession,
  isStripeConfigured,
  parseCheckoutMetadata,
  type BillingPlanId,
} from "../lib/stripeBilling.js";
import { subscriptionPayload } from "../lib/subscription.js";
import { requireUser } from "../middleware/requireUser.js";

const router = Router();

router.get("/plans", (_req: Request, res: Response) => {
  res.json({
    plans: Object.entries(BILLING_PLANS).map(([id, p]) => ({
      id,
      title: p.title,
      price: p.price,
      days: p.days,
    })),
    stripeConfigured: isStripeConfigured(),
  });
});

router.get("/status", requireUser, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json({ subscription: subscriptionPayload(user) });
});

const checkoutSchema = { planId: (v: unknown) => v === "monthly" || v === "yearly" };

router.post("/checkout", requireUser, async (req: Request, res: Response) => {
  const planId = req.body?.planId as BillingPlanId;
  if (!checkoutSchema.planId(planId)) {
    res.status(400).json({ error: "Plano inválido" });
    return;
  }
  const result = await createCheckoutSession(req.userId!, planId);
  if ("error" in result) {
    res.status(503).json({ error: result.error });
    return;
  }
  res.json({ checkoutUrl: result.checkoutUrl });
});

/** Registrado em app.ts com express.raw — não usa JSON parser */
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];
  const payload = req.body as Buffer;
  if (!Buffer.isBuffer(payload)) {
    res.status(400).send("Invalid payload");
    return;
  }

  const event = constructWebhookEvent(payload, typeof sig === "string" ? sig : sig?.[0]);
  if (!event) {
    res.status(400).send("Invalid signature");
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const parsed = parseCheckoutMetadata(
      session.metadata,
      session.client_reference_id
    );
    if (parsed && session.payment_status === "paid") {
      await activateSubscriptionFromCheckout(parsed.userId, parsed.planId);
      console.info(
        `[billing] Stripe ativado user=${parsed.userId} plan=${parsed.planId}`
      );
    }
  }

  res.json({ received: true });
}

export const billingRouter = router;
