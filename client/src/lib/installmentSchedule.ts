import type { InstallmentPlan } from "../types";

/** Soma meses a uma data ISO `yyyy-mm-dd` (calendário local). */
export function addMonthsToISODate(iso: string, months: number): string {
  const [y, m, d] = iso.trim().split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1 + months, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function dueDateForInstallment(plan: InstallmentPlan, installmentNumber: number): string {
  return addMonthsToISODate(plan.firstDueDate, installmentNumber - 1);
}

const paidSet = (plan: InstallmentPlan) => new Set(plan.paidInstallments.map((p) => p.number));

/** Primeira parcela ainda não paga (1-based), ou `null` se todas pagas. */
export function nextUnpaidInstallmentNumber(plan: InstallmentPlan): number | null {
  const s = paidSet(plan);
  for (let n = 1; n <= plan.totalInstallments; n++) {
    if (!s.has(n)) return n;
  }
  return null;
}

export function nextUnpaidDueDate(plan: InstallmentPlan): string | null {
  const n = nextUnpaidInstallmentNumber(plan);
  if (n == null) return null;
  return dueDateForInstallment(plan, n);
}

/** Dias até a data (negativo = atrasado). Meia-noite local. */
export function daysFromToday(isoDate: string): number {
  const [y, m, d] = isoDate.trim().split("-").map(Number);
  if (!y || !m || !d) return NaN;
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - t.getTime()) / 86400000);
}

export function remainingInstallmentsCount(plan: InstallmentPlan): number {
  return plan.totalInstallments - plan.paidInstallments.length;
}

export function remainingDebtAmount(plan: InstallmentPlan): number {
  return remainingInstallmentsCount(plan) * plan.installmentAmount;
}

export type InstallmentDueAlert = {
  planId: string;
  description: string;
  installmentNumber: number;
  dueDate: string;
  daysFromToday: number;
};

/** Próximo vencimento por plano com saldo; só inclui se vence em até `withinDays` ou já passou. */
export function upcomingDueAlerts(
  plans: readonly InstallmentPlan[],
  withinDays = 14
): InstallmentDueAlert[] {
  const out: InstallmentDueAlert[] = [];
  for (const plan of plans) {
    const n = nextUnpaidInstallmentNumber(plan);
    if (n == null) continue;
    const due = dueDateForInstallment(plan, n);
    const days = daysFromToday(due);
    if (Number.isNaN(days)) continue;
    if (days > withinDays) continue;
    out.push({
      planId: plan.id,
      description: plan.description,
      installmentNumber: n,
      dueDate: due,
      daysFromToday: days,
    });
  }
  return out.sort((a, b) => a.daysFromToday - b.daysFromToday || a.dueDate.localeCompare(b.dueDate));
}

export function totalRemainingDebtAllPlans(plans: readonly InstallmentPlan[]): number {
  let s = 0;
  for (const p of plans) {
    s += remainingDebtAmount(p);
  }
  return Math.round(s * 100) / 100;
}

export function totalRemainingInstallmentsAllPlans(plans: readonly InstallmentPlan[]): number {
  let n = 0;
  for (const p of plans) {
    n += remainingInstallmentsCount(p);
  }
  return n;
}
