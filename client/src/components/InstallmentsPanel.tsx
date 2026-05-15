import { FormEvent, useEffect, useMemo, useState } from "react";
import type { InstallmentPlan } from "../types";
import { formatBRL } from "../lib/format";
import { formatISODateToBR } from "../lib/dateBR";
import { DateInputBR } from "./DateInputBR";
import { AnimatedNumber } from "./AnimatedNumber";
import {
  daysFromToday,
  nextUnpaidDueDate,
  nextUnpaidInstallmentNumber,
  remainingDebtAmount,
  remainingInstallmentsCount,
  totalRemainingDebtAllPlans,
  totalRemainingInstallmentsAllPlans,
  upcomingDueAlerts,
} from "../lib/installmentSchedule";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const NOTIFY_SESSION_KEY = "cf-installment-notify-day";

function firstUnpaidNumber(plan: InstallmentPlan): string {
  const paid = new Set(plan.paidInstallments.map((x) => x.number));
  for (let n = 1; n <= plan.totalInstallments; n++) {
    if (!paid.has(n)) return String(n);
  }
  return String(plan.totalInstallments);
}

function useBrowserDueNotifications(plans: InstallmentPlan[]) {
  const [perm, setPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  async function requestNotify() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
  }

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const alerts = upcomingDueAlerts(plans, 3);
    if (alerts.length === 0) return;
    const day = todayISO();
    if (sessionStorage.getItem(NOTIFY_SESSION_KEY) === day) return;
    const body = alerts
      .slice(0, 4)
      .map((a) => {
        const d = formatISODateToBR(a.dueDate);
        if (a.daysFromToday < 0) {
          return `${a.description}: ${a.installmentNumber}ª (${d}) — atrasada`;
        }
        if (a.daysFromToday === 0) {
          return `${a.description}: ${a.installmentNumber}ª vence hoje`;
        }
        return `${a.description}: ${a.installmentNumber}ª em ${d}`;
      })
      .join(" · ");
    try {
      new Notification("Parcelas — vencimento", { body, lang: "pt-BR" });
    } catch {
      /* ignore */
    }
    sessionStorage.setItem(NOTIFY_SESSION_KEY, day);
  }, [plans, perm]);

  return { perm, requestNotify };
}

function PlanCard({
  plan,
  onRemovePlan,
  onPay,
}: {
  plan: InstallmentPlan;
  onRemovePlan: (planId: string) => void | Promise<void>;
  onPay: (planId: string, installmentNumber: number, paymentDate: string) => void | Promise<void>;
}) {
  const paidSet = useMemo(
    () => new Set(plan.paidInstallments.map((x) => x.number)),
    [plan.paidInstallments]
  );
  const [payNumberStr, setPayNumberStr] = useState(() => firstUnpaidNumber(plan));
  const [payDate, setPayDate] = useState(todayISO);

  const paidLen = plan.paidInstallments.length;
  useEffect(() => {
    setPayNumberStr(firstUnpaidNumber(plan));
  }, [plan.id, paidLen, plan.totalInstallments]);

  const paidCount = plan.paidInstallments.length;
  const pct = Math.round((paidCount / plan.totalInstallments) * 100);
  const allPaid = paidCount >= plan.totalInstallments;
  const remaining = remainingInstallmentsCount(plan);
  const debtLeft = remainingDebtAmount(plan);
  const nextDue = nextUnpaidDueDate(plan);
  const nextNum = nextUnpaidInstallmentNumber(plan);
  const urgency =
    nextDue == null
      ? null
      : (() => {
          const d = daysFromToday(nextDue);
          if (Number.isNaN(d)) return null;
          if (d < 0) return "overdue" as const;
          if (d <= 7) return "soon" as const;
          return "ok" as const;
        })();

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    if (allPaid) return;
    const n = Number.parseInt(payNumberStr, 10);
    if (!Number.isInteger(n) || n < 1 || n > plan.totalInstallments) return;
    if (paidSet.has(n)) return;
    try {
      await onPay(plan.id, n, payDate);
      setPayDate(todayISO());
    } catch {
      /* mantém formulário */
    }
  }

  return (
    <li className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-lg shadow-black/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{plan.category}</p>
          <h3 className="mt-1 font-display text-xl font-semibold text-white">{plan.description}</h3>
          <p className="mt-2 text-sm text-slate-400">
            {formatBRL(plan.installmentAmount)} × {plan.totalInstallments} parcelas · 1ª parcela (ref.):{" "}
            {formatISODateToBR(plan.firstDueDate)}
          </p>

          {!allPaid ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
                Faltam {remaining} {remaining === 1 ? "parcela" : "parcelas"}
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-sm font-medium text-slate-200">
                Dívida restante:{" "}
                <AnimatedNumber value={debtLeft} formatter={formatBRL} className="font-semibold text-white" />
              </span>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-surface px-3 py-1 text-sm font-medium text-slate-200">
              {paidCount}/{plan.totalInstallments} parcelas pagas
            </span>
            {!allPaid ? (
              <span className="text-sm text-slate-500">
                Total do plano:{" "}
                <span className="font-medium text-slate-300">
                  {formatBRL(plan.totalInstallments * plan.installmentAmount)}
                </span>
              </span>
            ) : null}
          </div>

          {!allPaid && nextDue && nextNum != null ? (
            <p
              className={`mt-3 text-sm font-medium ${
                urgency === "overdue"
                  ? "text-expense"
                  : urgency === "soon"
                    ? "text-amber-300"
                    : "text-slate-400"
              }`}
            >
              Próximo vencimento: {nextNum}ª parcela em {formatISODateToBR(nextDue)}
              {urgency === "overdue"
                ? " — atrasada"
                : urgency === "soon"
                  ? ` (${daysFromToday(nextDue) === 0 ? "hoje" : `em ${daysFromToday(nextDue)} dia(s)`})`
                  : null}
            </p>
          ) : null}

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          {paidCount > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Pagas:{" "}
              {[...plan.paidInstallments]
                .sort((a, b) => a.number - b.number)
                .map((x) => `${x.number}ª (${formatISODateToBR(x.date)})`)
                .join(" · ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={async () => {
            if (!confirm("Excluir este plano e remover as despesas de parcelas vinculadas a ele?")) {
              return;
            }
            try {
              await onRemovePlan(plan.id);
            } catch {
              /* ignore */
            }
          }}
          className="shrink-0 rounded-xl border border-surface-border px-3 py-2 text-xs text-slate-500 transition-colors duration-200 hover:border-expense/40 hover:text-expense"
        >
          Excluir plano
        </button>
      </div>

      <form
        onSubmit={handlePay}
        className="mt-5 flex flex-col gap-3 border-t border-surface-border pt-5 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="sm:w-44">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
            Paguei a parcela
          </label>
          <select
            value={payNumberStr}
            onChange={(e) => setPayNumberStr(e.target.value)}
            disabled={allPaid}
            className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 transition-colors duration-200 focus:border-accent focus:ring-2 disabled:opacity-50"
          >
            {Array.from({ length: plan.totalInstallments }, (_, i) => i + 1).map((n) => (
              <option key={n} value={String(n)} disabled={paidSet.has(n)}>
                {n}/{plan.totalInstallments}
                {paidSet.has(n) ? " (paga)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:w-44">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
            Data do pagamento
          </label>
          <DateInputBR
            value={payDate}
            onChange={setPayDate}
            disabled={allPaid}
            className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 transition-colors duration-200 focus:border-accent focus:ring-2 disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={allPaid || paidSet.has(Number.parseInt(payNumberStr, 10))}
          className="rounded-xl bg-income/90 px-4 py-2.5 text-sm font-semibold text-surface transition-all duration-200 hover:bg-income disabled:cursor-not-allowed disabled:opacity-40"
        >
          {allPaid ? "Todas pagas" : "Registrar pagamento"}
        </button>
      </form>
    </li>
  );
}

interface Props {
  categories: readonly string[];
  plans: InstallmentPlan[];
  onCreate: (input: Omit<InstallmentPlan, "id" | "createdAt" | "paidInstallments">) => void | Promise<void>;
  onRemovePlan: (planId: string) => void | Promise<void>;
  onPay: (planId: string, installmentNumber: number, paymentDate: string) => void | Promise<void>;
}

export function InstallmentsPanel({
  categories,
  plans,
  onCreate,
  onRemovePlan,
  onPay,
}: Props) {
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Outros");
  const [totalStr, setTotalStr] = useState("10");
  const [amountStr, setAmountStr] = useState("");
  const [firstDue, setFirstDue] = useState(todayISO);

  const { perm, requestNotify } = useBrowserDueNotifications(plans);

  const totals = useMemo(
    () => ({
      debt: totalRemainingDebtAllPlans(plans),
      installmentsLeft: totalRemainingInstallmentsAllPlans(plans),
    }),
    [plans]
  );

  const dueAlerts = useMemo(() => upcomingDueAlerts(plans, 14), [plans]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const total = Number.parseInt(totalStr, 10);
    const normalized = amountStr.replace(",", ".").trim();
    const installmentAmount = Number.parseFloat(normalized);
    if (!Number.isInteger(total) || total < 2 || total > 240) return;
    if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) return;
    try {
      await onCreate({
        description: desc.trim() || "Compra parcelada",
        category,
        totalInstallments: total,
        installmentAmount: Math.round(installmentAmount * 100) / 100,
        firstDueDate: firstDue,
      });
    } catch {
      return;
    }
    setDesc("");
    setAmountStr("");
    setTotalStr("10");
    setFirstDue(todayISO());
  }

  return (
    <div className="flex flex-col gap-10">
      {plans.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-lg shadow-black/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo da dívida</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-white">
              <AnimatedNumber value={totals.debt} formatter={formatBRL} />
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Soma do que ainda falta pagar em todos os planos ativos.
            </p>
          </div>
          <div className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-lg shadow-black/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parcelas em aberto</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-accent">
              <AnimatedNumber
                value={totals.installmentsLeft}
                formatter={(n) => Math.round(n).toLocaleString("pt-BR")}
              />
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Em todos os planos com parcelas ainda não pagas.
            </p>
          </div>
        </div>
      ) : null}

      {dueAlerts.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 shadow-inner">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-amber-200">Vencimentos nos próximos 14 dias</h3>
              <ul className="mt-3 space-y-2 text-sm text-amber-100/90">
                {dueAlerts.map((a) => (
                  <li key={`${a.planId}-${a.installmentNumber}`}>
                    <span className="font-medium text-white">{a.description}</span> — {a.installmentNumber}ª em{" "}
                    {formatISODateToBR(a.dueDate)}
                    {a.daysFromToday < 0 ? (
                      <span className="text-expense"> (atrasada)</span>
                    ) : a.daysFromToday === 0 ? (
                      <span className="text-amber-300"> (hoje)</span>
                    ) : (
                      <span className="text-slate-400"> (em {a.daysFromToday} dia(s))</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="shrink-0 rounded-xl border border-amber-500/20 bg-surface-raised/80 p-3 text-xs text-slate-400">
              {typeof Notification !== "undefined" && perm === "default" ? (
                <button
                  type="button"
                  onClick={() => void requestNotify()}
                  className="rounded-lg bg-amber-500/20 px-3 py-2 font-medium text-amber-100 transition hover:bg-amber-500/30"
                >
                  Ativar lembretes no navegador
                </button>
              ) : perm === "granted" ? (
                <p className="max-w-[200px] leading-relaxed">
                  Lembretes ativos: aviso uma vez por dia quando houver parcela em até 3 dias.
                </p>
              ) : perm === "denied" ? (
                <p className="max-w-[200px] text-slate-500">
                  Notificações bloqueadas. Ative nas configurações do navegador se quiser lembretes.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : typeof Notification !== "undefined" && perm === "default" ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void requestNotify()}
            className="rounded-xl border border-surface-border px-4 py-2 text-xs text-slate-400 transition hover:border-accent/40 hover:text-accent"
          >
            Ativar lembretes de vencimento no navegador
          </button>
        </div>
      ) : null}

      <section className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-lg shadow-black/10">
        <h2 className="font-display text-lg font-semibold text-white">Novo parcelamento</h2>
        <p className="mt-1 text-sm text-slate-400">
          Registre a compra (ex.: celular em 10x). Depois você informa qual parcela pagou; cada pagamento entra
          como despesa no mês da data escolhida.
        </p>
        <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Descrição</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Ex.: Celular, geladeira…"
              className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 transition-colors duration-200 focus:border-accent focus:ring-2"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 transition-colors duration-200 focus:border-accent focus:ring-2"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Nº de parcelas</label>
            <input
              required
              inputMode="numeric"
              min={2}
              max={240}
              value={totalStr}
              onChange={(e) => setTotalStr(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 transition-colors duration-200 focus:border-accent focus:ring-2"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
              Valor de cada parcela (R$)
            </label>
            <input
              required
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0,00"
              className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 transition-colors duration-200 focus:border-accent focus:ring-2"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
              1ª parcela (referência)
            </label>
            <DateInputBR
              value={firstDue}
              onChange={setFirstDue}
              className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 transition-colors duration-200 focus:border-accent focus:ring-2"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all duration-200 hover:bg-blue-500 hover:shadow-accent/35"
            >
              Criar plano
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold text-white">Planos ativos</h2>
        {plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-surface-border bg-surface-raised/50 p-10 text-center text-slate-400">
            Nenhum parcelamento cadastrado. Use o formulário acima para criar um plano (ex.: 10 parcelas).
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} onRemovePlan={onRemovePlan} onPay={onPay} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
