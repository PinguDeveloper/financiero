import type { InvestmentEntry, Transaction } from "../types";
import { formatMonthLabel } from "./format";

export function addCalendarMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1 + delta, 1);
  return d.toISOString().slice(0, 7);
}

/** Saldo acumulado (soma mensal de entradas − saídas) ao longo do tempo — fluxo de caixa, não patrimônio contábil. */
export function cumulativeMonthlyBalance(
  transactions: Transaction[],
  investmentEntries: readonly InvestmentEntry[] = []
): {
  month: string;
  label: string;
  balance: number;
}[] {
  const byMonth = new Map<string, { inc: number; exp: number }>();
  for (const t of transactions) {
    const mk = t.date.slice(0, 7);
    const slot = byMonth.get(mk) ?? { inc: 0, exp: 0 };
    if (t.type === "income") slot.inc += t.amount;
    else slot.exp += t.amount;
    byMonth.set(mk, slot);
  }
  for (const e of investmentEntries) {
    const mk = e.date.slice(0, 7);
    const slot = byMonth.get(mk) ?? { inc: 0, exp: 0 };
    if (e.kind === "aporte") slot.exp += e.amount;
    else if (e.kind === "dividendo" || e.kind === "resgate") slot.inc += e.amount;
    byMonth.set(mk, slot);
  }
  const months = [...byMonth.keys()].sort();
  let cum = 0;
  return months.map((m) => {
    const s = byMonth.get(m)!;
    cum += s.inc - s.exp;
    return {
      month: m,
      label: formatMonthLabel(m).replace(/\s+de\s+/i, "/").slice(0, 8),
      balance: Math.round(cum * 100) / 100,
    };
  });
}

export function aportesByMonth(entries: InvestmentEntry[]): {
  month: string;
  label: string;
  aportes: number;
}[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.kind !== "aporte") continue;
    const m = e.date.slice(0, 7);
    map.set(m, (map.get(m) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, aportes]) => ({
      month,
      label: formatMonthLabel(month).replace(/\s+de\s+/i, "/").slice(0, 8),
      aportes: Math.round(aportes * 100) / 100,
    }));
}

export function dividendsByMonth(entries: InvestmentEntry[]): {
  month: string;
  label: string;
  total: number;
}[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.kind !== "dividendo") continue;
    const m = e.date.slice(0, 7);
    map.set(m, (map.get(m) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, total]) => ({
      month,
      label: formatMonthLabel(month).replace(/\s+de\s+/i, "/").slice(0, 8),
      total: Math.round(total * 100) / 100,
    }));
}

export function investmentAportesByAssetType(entries: InvestmentEntry[]): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.kind !== "aporte") continue;
    map.set(e.assetType, (map.get(e.assetType) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}
