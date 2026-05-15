import { formatBRL } from "../lib/format";
import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  income: number;
  expense: number;
  balance: number;
  /** Destaca o saldo (ex.: visão mensal). */
  highlightBalance?: boolean;
  sectionLabel?: string;
}

const cardBase =
  "card-interactive rounded-2xl border bg-surface-raised p-6 sm:p-7 shadow-lg shadow-black/20 ease-out";

export function StatCards({ income, expense, balance, highlightBalance, sectionLabel }: Props) {
  return (
    <div className="space-y-3">
      {sectionLabel ? (
        <p className="text-xs font-medium uppercase tracking-widest text-slate-600">{sectionLabel}</p>
      ) : null}
      <div
        className={`grid gap-5 ${highlightBalance ? "lg:grid-cols-[1fr_1fr_1.15fr]" : "sm:grid-cols-3"}`}
      >
        <article className={`${cardBase} border-surface-border hover:border-slate-600/50`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entradas</p>
          <p className="mt-3 font-display text-2xl font-semibold tracking-tight text-income sm:text-3xl tabular-nums">
            <AnimatedNumber value={income} formatter={formatBRL} />
          </p>
          <p className="mt-2 text-xs text-slate-600">Receitas no período</p>
        </article>
        <article className={`${cardBase} border-surface-border hover:border-slate-600/50`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saídas</p>
          <p className="mt-3 font-display text-2xl font-semibold tracking-tight text-expense sm:text-3xl tabular-nums">
            <AnimatedNumber value={expense} formatter={formatBRL} />
          </p>
          <p className="mt-2 text-xs text-slate-600">Despesas no período</p>
        </article>
        <article
          className={`${cardBase} border-surface-border ${
            highlightBalance
              ? "ring-1 ring-accent/35 lg:min-h-[160px] border-accent/20 bg-gradient-to-br from-surface-raised to-accent/[0.06]"
              : "hover:border-slate-600/50"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo</p>
          <p className="mt-1 text-[11px] text-slate-600">Entradas − saídas</p>
          <p
            className={`mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl tabular-nums ${
              balance >= 0 ? "text-income" : "text-expense"
            }`}
          >
            <AnimatedNumber value={balance} formatter={formatBRL} />
          </p>
        </article>
      </div>
    </div>
  );
}
