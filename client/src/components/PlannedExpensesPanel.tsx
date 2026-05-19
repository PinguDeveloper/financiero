import { FormEvent, useState } from "react";
import type { PlannedExpense } from "../types";
import { DEFAULT_CATEGORIES } from "../types";
import { formatBRL } from "../lib/format";
import { MotionCard } from "../lib/motion";

interface Props {
  expenses: PlannedExpense[];
  onAdd: (input: {
    description: string;
    amount: number;
    category: string;
    dayOfMonth: number;
  }) => Promise<void>;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export function PlannedExpensesPanel({ expenses, onAdd, onToggle, onRemove }: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORIES.expense[0] ?? "Outros");
  const [day, setDay] = useState("5");

  const activeTotal = expenses.filter((e) => e.active).reduce((s, e) => s + e.amount, 0);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const n = Number.parseFloat(amount.replace(",", "."));
    const d = Number.parseInt(day, 10);
    if (!description.trim() || !Number.isFinite(n) || n <= 0 || d < 1 || d > 28) return;
    await onAdd({
      description: description.trim(),
      amount: Math.round(n * 100) / 100,
      category,
      dayOfMonth: d,
    });
    setDescription("");
    setAmount("");
  }

  return (
    <section className="rounded-2xl border border-surface-border bg-surface-raised p-5">
      <h2 className="font-display text-lg font-semibold text-white">Gastos fixos / previstos</h2>
      <p className="mt-1 text-sm text-slate-400">Despesas mensais recorrentes para planejamento.</p>
      <p className="mt-3 text-sm text-slate-500">
        Total previsto (ativos):{" "}
        <span className="font-semibold text-expense">{formatBRL(activeTotal)}</span>
      </p>

      <ul className="mt-4 space-y-2">
        {expenses.map((item, i) => (
          <MotionCard
            key={item.id}
            delay={i * 0.04}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
              item.active ? "border-surface-border bg-surface" : "border-surface-border/50 opacity-60"
            }`}
          >
            <div>
              <p className="font-medium text-white">{item.description}</p>
              <p className="text-xs text-slate-500">
                Dia {item.dayOfMonth} · {item.category}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold tabular-nums text-expense">{formatBRL(item.amount)}</span>
              <button
                type="button"
                onClick={() => void onToggle(item.id, !item.active)}
                className="text-xs text-accent hover:underline"
              >
                {item.active ? "Pausar" : "Ativar"}
              </button>
              <button
                type="button"
                onClick={() => void onRemove(item.id)}
                className="text-xs text-slate-500 hover:text-expense"
              >
                Excluir
              </button>
            </div>
          </MotionCard>
        ))}
      </ul>

      <form onSubmit={(e) => void handleAdd(e)} className="mt-5 grid gap-3 sm:grid-cols-2">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição (ex.: Aluguel)"
          className="sm:col-span-2 rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-white"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Valor (R$)"
          inputMode="decimal"
          className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-white"
        />
        <input
          value={day}
          onChange={(e) => setDay(e.target.value)}
          placeholder="Dia do mês (1-28)"
          type="number"
          min={1}
          max={28}
          className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-white"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-white"
        >
          {DEFAULT_CATEGORIES.expense.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Adicionar gasto fixo
        </button>
      </form>
    </section>
  );
}
