import type { Transaction } from "../types";
import { formatBRL } from "../lib/format";
import { formatISODateToBR } from "../lib/dateBR";

interface Props {
  rows: Transaction[];
  onRemove: (id: string) => void | Promise<void>;
}

export function TransactionTable({ rows, onRemove }: Props) {
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-surface-border bg-surface-raised/50 p-10 text-center">
        <p className="text-slate-400">
          Nenhum lançamento neste período. Use o formulário acima para registrar entradas e saídas.
        </p>
      </section>
    );
  }

  return (
    <section className="card-interactive overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-lg shadow-black/10">
      <div className="border-b border-surface-border px-6 py-5">
        <h2 className="font-display text-lg font-semibold text-white">Lançamentos</h2>
        <p className="text-sm text-slate-500">Do mais recente ao mais antigo</p>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {rows.map((t, i) => (
          <article
            key={t.id}
            style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
            className="animate-fade-in rounded-xl border border-surface-border bg-surface/50 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  t.type === "income" ? "bg-income/15 text-income" : "bg-expense/15 text-expense"
                }`}
              >
                {t.type === "income" ? "Entrada" : "Saída"}
              </span>
              <span className="text-xs text-slate-500">
                {formatISODateToBR(t.date)}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-white">{t.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{t.category}</span>
              {t.installmentRef ? (
                <span className="rounded-md bg-accent/20 px-1.5 py-0.5 font-semibold text-accent">
                  {t.installmentRef.installmentNumber}/{t.installmentRef.of}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3">
              <span
                className={`text-base font-semibold tabular-nums ${
                  t.type === "income" ? "text-income" : "text-expense"
                }`}
              >
                {t.type === "expense" ? "− " : "+ "}
                {formatBRL(t.amount)}
              </span>
              <button
                type="button"
                onClick={() => void onRemove(t.id)}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-500 transition hover:bg-expense/10 hover:text-expense"
              >
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface/80 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Data</th>
              <th className="px-6 py-3 font-medium">Tipo</th>
              <th className="px-6 py-3 font-medium">Descrição</th>
              <th className="px-6 py-3 font-medium">Categoria</th>
              <th className="px-6 py-3 text-right font-medium">Valor</th>
              <th className="px-6 py-3 text-right font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {rows.map((t) => (
              <tr key={t.id} className="transition-colors duration-150 hover:bg-surface/45">
                <td className="whitespace-nowrap px-6 py-4 text-slate-300">
                  {formatISODateToBR(t.date)}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      t.type === "income" ? "bg-income/15 text-income" : "bg-expense/15 text-expense"
                    }`}
                  >
                    {t.type === "income" ? "Entrada" : "Saída"}
                  </span>
                </td>
                <td className="max-w-[280px] px-6 py-4 text-white">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate">{t.description}</span>
                    {t.installmentRef ? (
                      <span className="inline-flex shrink-0 rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                        {t.installmentRef.installmentNumber}/{t.installmentRef.of}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-400">{t.category}</td>
                <td
                  className={`whitespace-nowrap px-6 py-4 text-right font-medium tabular-nums ${
                    t.type === "income" ? "text-income" : "text-expense"
                  }`}
                >
                  {t.type === "expense" ? "− " : "+ "}
                  {formatBRL(t.amount)}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => void onRemove(t.id)}
                    className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-expense/10 hover:text-expense"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
