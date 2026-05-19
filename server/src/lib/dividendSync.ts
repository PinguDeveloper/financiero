import { prisma } from "../db.js";
import { decimalToNumber, toISODate } from "./serialize.js";
import { fetchUpcomingDividends, type UpcomingDividend } from "./marketDividends.js";

type OpenPosition = { ticker: string; qty: number; assetType: string };

function openPositionsFromEntries(
  rows: { assetName: string; assetType: string; kind: string; quantity: unknown; date: Date; notes: string }[]
): OpenPosition[] {
  const map = new Map<string, { qty: number; assetType: string }>();
  for (const e of rows) {
    const ticker = e.assetName.trim().toUpperCase();
    if (!ticker) continue;
    const cur = map.get(ticker) ?? { qty: 0, assetType: e.assetType ?? "Ações" };
    if (e.kind === "aporte" && e.quantity != null) {
      cur.qty += decimalToNumber(e.quantity as never);
    } else if (e.kind === "resgate" && e.quantity != null) {
      cur.qty -= decimalToNumber(e.quantity as never);
    }
    map.set(ticker, cur);
  }
  return [...map.entries()]
    .filter(([, v]) => v.qty > 0.000001)
    .map(([ticker, v]) => ({ ticker, qty: v.qty, assetType: v.assetType }));
}

function dedupeKey(ticker: string, paymentDate: string): string {
  return `auto-div:${ticker}:${paymentDate}`;
}

/** Busca proventos futuros e registra proventos do dia quando ainda não existirem. */
export async function syncProventosForUser(userId: string): Promise<{
  upcoming: UpcomingDividend[];
  created: number;
}> {
  const rows = await prisma.investmentEntry.findMany({
    where: { userId },
    select: {
      assetName: true,
      assetType: true,
      kind: true,
      quantity: true,
      date: true,
      notes: true,
    },
  });

  const positions = openPositionsFromEntries(rows);
  const upcoming: UpcomingDividend[] = [];
  const today = new Date().toISOString().slice(0, 10);
  let created = 0;

  for (const pos of positions.slice(0, 12)) {
    const list = await fetchUpcomingDividends(pos.ticker);
    upcoming.push(...list);

    for (const d of list) {
      if (d.paymentDate > today) continue;
      const key = dedupeKey(d.ticker, d.paymentDate);
      const already = rows.some(
        (r) =>
          r.kind === "dividendo" &&
          r.assetName.toUpperCase() === d.ticker &&
          toISODate(r.date) === d.paymentDate
      );
      if (already) continue;
      if (rows.some((r) => r.notes.includes(key))) continue;

      const amount = Math.round(d.amountPerShare * pos.qty * 100) / 100;
      if (amount <= 0) continue;

      await prisma.investmentEntry.create({
        data: {
          userId,
          kind: "dividendo",
          amount,
          date: new Date(d.paymentDate + "T12:00:00.000Z"),
          assetName: d.ticker,
          notes: `${key} — ${d.label} (automático)`,
          assetType: pos.assetType,
          quantity: null,
          unitPrice: d.amountPerShare,
          otherCosts: 0,
        },
      });
      created++;
    }
  }

  return { upcoming, created };
}
