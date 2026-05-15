import type { InvestmentEntry, Transaction } from "../types";
import { aggregateExpenseByCategoryMerged, summarizeMonthCash } from "../lib/investmentCashFlow";
import { formatBRL, formatMonthLabel } from "../lib/format";
import { addCalendarMonth } from "../lib/dashboardSeries";

interface MonthSlice {
  income: number;
  expense: number;
  balance: number;
}

interface Props {
  transactions: Transaction[];
  investmentEntries: InvestmentEntry[];
  effectiveMonth: string;
  monthSummary: MonthSlice;
}

function Delta({ cur, prev, inverse }: { cur: number; prev: number; inverse?: boolean }) {
  const d = cur - prev;
  const good = inverse ? d <= 0 : d >= 0;
  const cls = d === 0 ? "text-slate-400" : good ? "text-income" : "text-expense";
  const sign = d > 0 ? "+" : "";
  return <span className={`text-sm font-semibold tabular-nums ${cls}`}>{sign}{formatBRL(d)}</span>;
}

const card =
  "card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-lg shadow-black/15";

export function DashboardInsights({
  transactions,
  investmentEntries,
  effectiveMonth,
  monthSummary,
}: Props) {
  const prevYm = addCalendarMonth(effectiveMonth, -1);
  const prev = summarizeMonthCash(transactions, investmentEntries, prevYm);

  const filtered = transactions.filter((t) => t.date.slice(0, 7) === effectiveMonth);
  const expenses = filtered.filter((t) => t.type === "expense");
  const byCat = aggregateExpenseByCategoryMerged(transactions, investmentEntries, effectiveMonth);

  const biggestExpense =
    expenses.length === 0
      ? null
      : expenses.reduce((a, b) => (a.amount >= b.amount ? a : b), expenses[0]!);

  const topCat = byCat[0] ?? null;

  const monthLabel = formatMonthLabel(effectiveMonth);
  const prevLabel = formatMonthLabel(prevYm);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-white">Indicadores do mês</h2>
        <p className="mt-1 text-sm text-slate-500">
          {monthLabel} · comparação com {prevLabel}
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <article className={card}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Maior despesa (lançamento)</p>
          {biggestExpense ? (
            <>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-200">{biggestExpense.description}</p>
              <p className="mt-2 font-display text-xl font-semibold text-expense tabular-nums">
                {formatBRL(biggestExpense.amount)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{biggestExpense.category}</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Sem despesas neste mês.</p>
          )}
        </article>

        <article className={card}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Categoria com maior despesa</p>
          {topCat ? (
            <>
              <p className="mt-2 text-sm font-medium text-slate-200">{topCat.name}</p>
              <p className="mt-2 font-display text-xl font-semibold text-expense tabular-nums">
                {formatBRL(topCat.value)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Soma no mês</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Sem despesas categorizadas.</p>
          )}
        </article>

        <article className={card}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Entradas vs. mês anterior</p>
          <p className="mt-2 font-display text-xl font-semibold text-income tabular-nums">
            {formatBRL(monthSummary.income)}
          </p>
          <p className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>Variação</span>
            <Delta cur={monthSummary.income} prev={prev.income} />
          </p>
        </article>

        <article className={card}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Saldo do mês vs. anterior</p>
          <p
            className={`mt-2 font-display text-xl font-semibold tabular-nums ${
              monthSummary.balance >= 0 ? "text-income" : "text-expense"
            }`}
          >
            {formatBRL(monthSummary.balance)}
          </p>
          <p className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>Variação</span>
            <Delta cur={monthSummary.balance} prev={prev.balance} />
          </p>
          <p className="mt-3 border-t border-surface-border pt-3 text-xs text-slate-500">
            Saídas no mês: <span className="text-expense">{formatBRL(monthSummary.expense)}</span>
            <span className="mx-1 text-slate-600">·</span>
            <span className="text-slate-400">vs. {formatBRL(prev.expense)}</span>{" "}
            <Delta cur={monthSummary.expense} prev={prev.expense} inverse />
          </p>
        </article>
      </div>
    </section>
  );
}
