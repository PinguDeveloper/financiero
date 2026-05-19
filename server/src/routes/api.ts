import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { syncProventosForUser } from "../lib/dividendSync.js";
import { resolveMarketQuote } from "../lib/marketQuotes.js";
import {
  createPlannedExpense,
  deletePlannedExpense,
  listPlannedExpenses,
  updatePlannedExpense,
} from "../lib/plannedExpenses.js";
import {
  createSavingsBox,
  deleteSavingsBox,
  listSavingsBoxes,
  updateSavingsBox,
} from "../lib/savingsBoxes.js";
import { decimalToNumber, toISODate } from "../lib/serialize.js";
import { requireUser } from "../middleware/requireUser.js";

const router = Router();
router.use(requireUser);

async function serializeState(userId: string) {
  const [transactions, plans, investmentRows] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.installmentPlan.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.investmentEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const planIds = plans.map((p) => p.id);
  const instTxs =
    planIds.length === 0
      ? []
      : await prisma.transaction.findMany({
          where: { userId, installmentPlanId: { in: planIds } },
        });
  const byPlan = new Map<string, typeof instTxs>();
  for (const t of instTxs) {
    if (!t.installmentPlanId) continue;
    const arr = byPlan.get(t.installmentPlanId) ?? [];
    arr.push(t);
    byPlan.set(t.installmentPlanId, arr);
  }

  const installmentPlans = plans.map((p) => {
    const paid = (byPlan.get(p.id) ?? [])
      .filter((t) => t.installmentNumber != null && t.installmentOf != null)
      .map((t) => ({
        number: t.installmentNumber!,
        date: toISODate(t.date),
        transactionId: t.id,
      }))
      .sort((a, b) => a.number - b.number);
    return {
      id: p.id,
      description: p.description,
      category: p.category,
      totalInstallments: p.totalInstallments,
      installmentAmount: decimalToNumber(p.installmentAmount),
      firstDueDate: toISODate(p.firstDueDate),
      paidInstallments: paid,
      createdAt: p.createdAt.toISOString(),
    };
  });

  return {
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type as "income" | "expense",
      amount: decimalToNumber(t.amount),
      description: t.description,
      category: t.category,
      date: toISODate(t.date),
      createdAt: t.createdAt.toISOString(),
      installmentRef:
        t.installmentPlanId && t.installmentNumber && t.installmentOf
          ? {
              planId: t.installmentPlanId,
              installmentNumber: t.installmentNumber,
              of: t.installmentOf,
            }
          : undefined,
    })),
    installmentPlans,
    investmentEntries: investmentRows.map((e) => ({
      id: e.id,
      kind: e.kind as "aporte" | "resgate" | "dividendo" | "ajuste",
      amount: decimalToNumber(e.amount),
      date: toISODate(e.date),
      assetName: e.assetName,
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
      assetType: e.assetType ?? "Ações",
      quantity: e.quantity != null ? decimalToNumber(e.quantity) : null,
      unitPrice: e.unitPrice != null ? decimalToNumber(e.unitPrice) : null,
      otherCosts: decimalToNumber(e.otherCosts),
    })),
    savingsBoxes: await listSavingsBoxes(userId).catch(() => []),
    plannedExpenses: await listPlannedExpenses(userId).catch(() => []),
  };
}

router.get("/state", async (req: Request, res: Response) => {
  const userId = req.userId!;
  const state = await serializeState(userId);
  res.json(state);
});

const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive().finite(),
  description: z.string().min(1).max(500),
  category: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post("/transactions", async (req: Request, res: Response) => {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  const userId = req.userId!;
  const d = new Date(parsed.data.date + "T12:00:00.000Z");
  await prisma.transaction.create({
    data: {
      userId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      description: parsed.data.description,
      category: parsed.data.category,
      date: d,
    },
  });
  res.status(201).json(await serializeState(userId));
});

router.delete("/transactions/:id", async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const row = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!row) {
    res.status(404).json({ error: "Não encontrado" });
    return;
  }
  await prisma.transaction.delete({ where: { id } });
  res.json(await serializeState(userId));
});

const planSchema = z.object({
  description: z.string().min(1).max(500),
  category: z.string().min(1).max(120),
  totalInstallments: z.number().int().min(2).max(240),
  installmentAmount: z.number().positive().finite(),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post("/installment-plans", async (req: Request, res: Response) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  const userId = req.userId!;
  await prisma.installmentPlan.create({
    data: {
      userId,
      description: parsed.data.description,
      category: parsed.data.category,
      totalInstallments: parsed.data.totalInstallments,
      installmentAmount: parsed.data.installmentAmount,
      firstDueDate: new Date(parsed.data.firstDueDate + "T12:00:00.000Z"),
    },
  });
  res.status(201).json(await serializeState(userId));
});

router.delete("/installment-plans/:id", async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const plan = await prisma.installmentPlan.findFirst({ where: { id, userId } });
  if (!plan) {
    res.status(404).json({ error: "Não encontrado" });
    return;
  }
  await prisma.installmentPlan.delete({ where: { id } });
  res.json(await serializeState(userId));
});

const paySchema = z.object({
  installmentNumber: z.number().int().min(1),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post("/installment-plans/:id/payments", async (req: Request, res: Response) => {
  const userId = req.userId!;
  const planId = req.params.id;
  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  const plan = await prisma.installmentPlan.findFirst({ where: { id: planId, userId } });
  if (!plan) {
    res.status(404).json({ error: "Plano não encontrado" });
    return;
  }
  const n = parsed.data.installmentNumber;
  if (n > plan.totalInstallments) {
    res.status(400).json({ error: "Parcela fora do intervalo" });
    return;
  }
  const existing = await prisma.transaction.findFirst({
    where: { userId, installmentPlanId: planId, installmentNumber: n },
  });
  if (existing) {
    res.status(409).json({ error: "Parcela já registrada como paga" });
    return;
  }
  const payDate = new Date(parsed.data.paymentDate + "T12:00:00.000Z");
  await prisma.transaction.create({
    data: {
      userId,
      type: "expense",
      amount: plan.installmentAmount,
      description: plan.description,
      category: plan.category,
      date: payDate,
      installmentPlanId: planId,
      installmentNumber: n,
      installmentOf: plan.totalInstallments,
    },
  });
  res.status(201).json(await serializeState(userId));
});

const investmentSchema = z.object({
  kind: z.enum(["aporte", "resgate", "dividendo", "ajuste"]),
  amount: z.number().positive().finite(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assetName: z.string().min(1).max(200),
  notes: z.string().max(2000).optional().default(""),
  assetType: z.string().max(80).optional().default("Ações"),
  quantity: z.number().positive().finite().optional().nullable(),
  unitPrice: z.number().nonnegative().finite().optional().nullable(),
  otherCosts: z.number().nonnegative().finite().optional().default(0),
});

router.post("/investments", async (req: Request, res: Response) => {
  const parsed = investmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  const userId = req.userId!;
  const b = parsed.data;
  let amount = b.amount;
  if (
    (b.kind === "aporte" || b.kind === "resgate") &&
    b.quantity != null &&
    b.unitPrice != null
  ) {
    amount = Math.round((b.quantity * b.unitPrice + (b.otherCosts ?? 0)) * 100) / 100;
  }
  try {
    await prisma.investmentEntry.create({
      data: {
        userId,
        kind: b.kind,
        amount,
        date: new Date(b.date + "T12:00:00.000Z"),
        assetName: b.assetName,
        notes: b.notes ?? "",
        assetType: b.assetType ?? "Ações",
        quantity: b.quantity ?? null,
        unitPrice: b.unitPrice ?? null,
        otherCosts: b.otherCosts ?? 0,
      },
    });
    res.status(201).json(await serializeState(userId));
  } catch (e) {
    console.error("[POST /investments]", e);
    const msg =
      e instanceof Error && /no such column|does not exist|Unknown column/i.test(e.message)
        ? "O banco de dados está desatualizado. Na pasta do projeto, execute: npm run db:push"
        : "Não foi possível salvar o lançamento. Tente de novo ou reinicie a API após rodar db:push.";
    res.status(500).json({ error: msg });
  }
});

router.delete("/investments/:id", async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const row = await prisma.investmentEntry.findFirst({ where: { id, userId } });
  if (!row) {
    res.status(404).json({ error: "Não encontrado" });
    return;
  }
  await prisma.investmentEntry.delete({ where: { id } });
  res.json(await serializeState(userId));
});

const savingsSchema = z.object({
  name: z.string().min(1).max(120),
  balance: z.number().nonnegative().finite().optional(),
});

router.post("/savings-boxes", async (req: Request, res: Response) => {
  const parsed = savingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  const userId = req.userId!;
  await createSavingsBox(userId, parsed.data);
  res.status(201).json(await serializeState(userId));
});

router.patch("/savings-boxes/:id", async (req: Request, res: Response) => {
  const userId = req.userId!;
  const updated = await updateSavingsBox(userId, req.params.id!, req.body);
  if (!updated) {
    res.status(404).json({ error: "Não encontrado" });
    return;
  }
  res.json(await serializeState(userId));
});

router.delete("/savings-boxes/:id", async (req: Request, res: Response) => {
  const userId = req.userId!;
  const ok = await deleteSavingsBox(userId, req.params.id!);
  if (!ok) {
    res.status(404).json({ error: "Não encontrado" });
    return;
  }
  res.json(await serializeState(userId));
});

const plannedSchema = z.object({
  description: z.string().min(1).max(500),
  amount: z.number().positive().finite(),
  category: z.string().min(1).max(120),
  dayOfMonth: z.number().int().min(1).max(28),
  active: z.boolean().optional(),
});

router.post("/planned-expenses", async (req: Request, res: Response) => {
  const parsed = plannedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  const userId = req.userId!;
  await createPlannedExpense(userId, parsed.data);
  res.status(201).json(await serializeState(userId));
});

router.patch("/planned-expenses/:id", async (req: Request, res: Response) => {
  const userId = req.userId!;
  const updated = await updatePlannedExpense(userId, req.params.id!, req.body);
  if (!updated) {
    res.status(404).json({ error: "Não encontrado" });
    return;
  }
  res.json(await serializeState(userId));
});

router.delete("/planned-expenses/:id", async (req: Request, res: Response) => {
  const userId = req.userId!;
  const ok = await deletePlannedExpense(userId, req.params.id!);
  if (!ok) {
    res.status(404).json({ error: "Não encontrado" });
    return;
  }
  res.json(await serializeState(userId));
});

router.post("/investments/sync-proventos", async (req: Request, res: Response) => {
  const userId = req.userId!;
  const result = await syncProventosForUser(userId);
  res.json({ ...result, state: await serializeState(userId) });
});

const quotesBodySchema = z.object({
  tickers: z.array(z.string().min(1).max(12)).min(1).max(24),
});

router.post("/market/quotes", async (req: Request, res: Response) => {
  const parsed = quotesBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Lista de tickers inválida" });
    return;
  }
  const quotes: Record<string, Awaited<ReturnType<typeof resolveMarketQuote>>> = {};
  const failed: string[] = [];
  for (const raw of parsed.data.tickers) {
    const ticker = raw.trim().toUpperCase();
    const q = await resolveMarketQuote(ticker);
    if (q) quotes[ticker] = q;
    else failed.push(ticker);
  }
  res.json({ quotes, failed });
});

router.get("/market/quote", async (req: Request, res: Response) => {
  const raw = typeof req.query.ticker === "string" ? req.query.ticker : "";
  const ticker = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!ticker || ticker.length > 12 || !/^[A-Z0-9]+$/.test(ticker)) {
    res.status(400).json({ error: "Informe um ticker válido (letras e números, ex.: PETR4 ou HGLG11)." });
    return;
  }
  try {
    const quote = await resolveMarketQuote(ticker);
    if (!quote) {
      res.status(404).json({
        error:
          "Não encontramos cotação para este ticker. Confira a sigla na B3 (ex.: PETR4, VALE3, HGLG11) e tente de novo.",
      });
      return;
    }
    res.json(quote);
  } catch {
    res.status(503).json({
      error: "Não foi possível consultar a cotação no momento. Tente novamente em instantes.",
    });
  }
});

export const apiRouter = router;
