import type { InvestmentEntry, Transaction } from "../types";

export function yearMonthFromDate(date: string): string {
  return date.trim().slice(0, 7);
}

/** Totais do mês: transações + investimentos (aporte = saída; dividendo/resgate = entrada). */
export function summarizeMonthCash(
  transactions: readonly Transaction[],
  investmentEntries: readonly InvestmentEntry[],
  yearMonth: string
): { income: number; expense: number; balance: number } {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (yearMonthFromDate(t.date) !== yearMonth) continue;
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  for (const e of investmentEntries) {
    if (yearMonthFromDate(e.date) !== yearMonth) continue;
    if (e.kind === "aporte") expense += e.amount;
    else if (e.kind === "dividendo" || e.kind === "resgate") income += e.amount;
  }
  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    balance: Math.round((income - expense) * 100) / 100,
  };
}

const EXP_APORTES = "Investimentos (aportes)";
const INC_INVEST = "Investimentos (proventos e resgates)";

export function aggregateExpenseByCategoryMerged(
  transactions: readonly Transaction[],
  investmentEntries: readonly InvestmentEntry[],
  yearMonth: string
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    if (yearMonthFromDate(t.date) !== yearMonth) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  for (const e of investmentEntries) {
    if (e.kind !== "aporte") continue;
    if (yearMonthFromDate(e.date) !== yearMonth) continue;
    map.set(EXP_APORTES, (map.get(EXP_APORTES) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function aggregateIncomeByCategoryMerged(
  transactions: readonly Transaction[],
  investmentEntries: readonly InvestmentEntry[],
  yearMonth: string
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "income") continue;
    if (yearMonthFromDate(t.date) !== yearMonth) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  for (const e of investmentEntries) {
    if (e.kind !== "dividendo" && e.kind !== "resgate") continue;
    if (yearMonthFromDate(e.date) !== yearMonth) continue;
    map.set(INC_INVEST, (map.get(INC_INVEST) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

/** Fluxo diário no mês, incluindo aportes (despesa) e proventos/resgates (entrada) na data do lançamento. */
export function dailyFlowMerged(
  transactions: readonly Transaction[],
  investmentEntries: readonly InvestmentEntry[],
  yearMonth: string
): { day: string; income: number; expense: number }[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(y!, m!, 0).getDate();
  const byDay: { day: string; income: number; expense: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const day = `${yearMonth}-${String(d).padStart(2, "0")}`;
    byDay.push({ day: String(d), income: 0, expense: 0 });
    for (const t of transactions) {
      if (t.date !== day) continue;
      const slot = byDay[d - 1]!;
      if (t.type === "income") slot.income += t.amount;
      else slot.expense += t.amount;
    }
    for (const e of investmentEntries) {
      if (e.date !== day) continue;
      const slot = byDay[d - 1]!;
      if (e.kind === "aporte") slot.expense += e.amount;
      else if (e.kind === "dividendo" || e.kind === "resgate") slot.income += e.amount;
    }
    byDay[d - 1]!.income = Math.round(byDay[d - 1]!.income * 100) / 100;
    byDay[d - 1]!.expense = Math.round(byDay[d - 1]!.expense * 100) / 100;
  }
  return byDay;
}
