import type { Request, Response } from "express";
import express, { Router } from "express";
import { prisma } from "../db.js";
import {
  activateUserByEmail,
  billingMode,
  checkAdminKey,
  getManualBillingPublicInfo,
  manualPlanDays,
  manualPlanPrice,
  approveVoucherRequest,
  buildPixChargeForUser,
  getVoucherRequestForApprove,
  issueVoucherCodeByEmail,
  listPendingVoucherRequests,
  redeemVoucher,
  requestVoucherByEmail,
} from "../lib/manualBilling.js";
import { renderApprovePage } from "../lib/billingApprovePage.js";
import {
  activateSubscriptionFromCheckout,
  BILLING_PLANS,
  constructWebhookEvent,
  createCheckoutSession,
  isStripeConfigured,
  parseCheckoutMetadata,
  type BillingPlanId,
} from "../lib/stripeBilling.js";
import { subscriptionPayload, subscriptionUserSelect } from "../lib/subscription.js";
import { requireUser } from "../middleware/requireUser.js";

const router = Router();

router.get("/plans", (_req: Request, res: Response) => {
  const mode = billingMode();
  res.json({
    mode,
    plans: [
      {
        id: "monthly",
        title: "Atlas Invest — Plano Mensal",
        price: mode === "manual" ? manualPlanPrice() : BILLING_PLANS.monthly.price,
        days: mode === "manual" ? manualPlanDays() : BILLING_PLANS.monthly.days,
      },
    ],
    stripeConfigured: isStripeConfigured(),
    manual: mode === "manual" ? getManualBillingPublicInfo() : null,
  });
});

router.get("/status", requireUser, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: subscriptionUserSelect,
  });
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json({ subscription: subscriptionPayload(user) });
});

router.get("/pix-charge", requireUser, async (req: Request, res: Response) => {
  if (billingMode() !== "manual") {
    res.status(400).json({ error: "Indisponível neste modo de cobrança" });
    return;
  }
  const charge = await buildPixChargeForUser(req.userId!);
  if (!charge) {
    res.status(503).json({ error: "PIX não configurado (PIX_KEY no servidor)" });
    return;
  }
  res.json(charge);
});

router.post("/request-voucher-code", requireUser, async (req: Request, res: Response) => {
  if (billingMode() !== "manual") {
    res.status(400).json({ error: "Disponível apenas no modo PIX manual" });
    return;
  }
  const result = await requestVoucherByEmail(req.userId!);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

router.post("/redeem-voucher", requireUser, async (req: Request, res: Response) => {
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (!code.trim()) {
    res.status(400).json({ error: "Informe o código de liberação" });
    return;
  }
  const result = await redeemVoucher(req.userId!, code);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: subscriptionUserSelect,
  });
  res.json({
    ok: true,
    days: result.days,
    subscription: user ? subscriptionPayload(user) : null,
  });
});

/** Você ativa manualmente após conferir PIX (curl ou Postman) */
router.post("/admin/activate", async (req: Request, res: Response) => {
  const key = req.headers["x-admin-key"];
  if (!checkAdminKey(typeof key === "string" ? key : undefined)) {
    res.status(403).json({ error: "Não autorizado" });
    return;
  }
  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const days =
    typeof req.body?.days === "number" ? req.body.days : Number(req.body?.days) || undefined;
  if (!email.trim()) {
    res.status(400).json({ error: "Informe o e-mail do usuário" });
    return;
  }
  const result = await activateUserByEmail(email, days);
  if ("error" in result) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

/** Gera código único e envia por e-mail (após conferir PIX no banco) */
router.post("/admin/send-code", async (req: Request, res: Response) => {
  const key = req.headers["x-admin-key"];
  if (!checkAdminKey(typeof key === "string" ? key : undefined)) {
    res.status(403).json({ error: "Não autorizado" });
    return;
  }
  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const days =
    typeof req.body?.days === "number" ? req.body.days : Number(req.body?.days) || undefined;
  if (!email.trim()) {
    res.status(400).json({ error: "Informe o e-mail do usuário" });
    return;
  }
  const result = await issueVoucherCodeByEmail(email, days);
  if ("error" in result) {
    const status = result.error.includes("não encontrado") ? 404 : 503;
    res.status(status).json({ error: result.error });
    return;
  }
  res.json({ ok: true, emailSent: result.emailSent });
});

/** Página de confirmação (link no e-mail do admin) */
router.get("/admin/approve", async (req: Request, res: Response) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(400).type("html").send(renderApprovePage({
      token: "",
      email: "—",
      amountCents: null,
      error: "Link inválido",
    }));
    return;
  }
  const pending = await getVoucherRequestForApprove(token);
  if (!pending) {
    res.status(404).type("html").send(renderApprovePage({
      token,
      email: "—",
      amountCents: null,
      error: "Pedido não encontrado ou já aprovado.",
    }));
    return;
  }
  res.type("html").send(
    renderApprovePage({
      token: pending.approveToken!,
      email: pending.email,
      amountCents: pending.expectedAmountCents,
    })
  );
});

/** Confirma PIX e envia código ao cliente (formulário da página acima) */
router.post("/admin/approve", express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
  const token =
    typeof req.body?.token === "string"
      ? req.body.token
      : typeof req.query.token === "string"
        ? req.query.token
        : "";
  const pending = token ? await getVoucherRequestForApprove(token) : null;

  const result = await approveVoucherRequest(token);
  if ("error" in result) {
    res.status(400).type("html").send(
      renderApprovePage({
        token,
        email: pending?.email ?? "—",
        amountCents: pending?.expectedAmountCents ?? null,
        error: result.error,
      })
    );
    return;
  }
  res.type("html").send(
    renderApprovePage({
      token,
      email: result.email,
      amountCents: pending?.expectedAmountCents ?? null,
      success: `Código enviado para ${result.email}. O cliente pode ativar na aba Assinatura.`,
    })
  );
});

router.get("/admin/voucher-requests", async (req: Request, res: Response) => {
  const key = req.headers["x-admin-key"];
  if (!checkAdminKey(typeof key === "string" ? key : undefined)) {
    res.status(403).json({ error: "Não autorizado" });
    return;
  }
  const requests = await listPendingVoucherRequests();
  res.json({ requests });
});

const checkoutSchema = { planId: (v: unknown) => v === "monthly" || v === "yearly" };

router.post("/checkout", requireUser, async (req: Request, res: Response) => {
  if (billingMode() !== "stripe") {
    res.status(400).json({
      error: "Pagamento online desativado. Use PIX + código ou liberação manual.",
    });
    return;
  }
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
