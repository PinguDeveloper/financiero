import { FormEvent, useState } from "react";
import type { TransactionType } from "../types";
import { DateInputBR } from "./DateInputBR";

interface Props {
  categories: { income: readonly string[]; expense: readonly string[] };
  onAdd: (input: {
    type: TransactionType;
    amount: number;
    description: string;
    category: string;
    date: string;
  }) => void | Promise<void>;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function AddTransactionForm({ categories, onAdd }: Props) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories.expense[0] ?? "Outros");
  const [date, setDate] = useState(todayISO);

  const cats = type === "income" ? categories.income : categories.expense;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = amount.replace(",", ".").trim();
    const n = Number.parseFloat(normalized);
    if (!Number.isFinite(n) || n <= 0) return;
    try {
      await onAdd({
        type,
        amount: Math.round(n * 100) / 100,
        description: description.trim() || (type === "income" ? "Entrada" : "Despesa"),
        category,
        date,
      });
    } catch {
      return;
    }
    setAmount("");
    setDescription("");
    setDate(todayISO());
  }

  return (
    <section className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-5">
      <h2 className="font-display text-lg font-semibold text-white">Novo lançamento</h2>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
            Tipo
          </label>
          <div className="mt-1.5 flex rounded-xl border border-surface-border p-1">
            <button
              type="button"
              onClick={() => {
                setType("income");
                setCategory(categories.income[0] ?? "Outros");
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                type === "income"
                  ? "bg-income/20 text-income"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => {
                setType("expense");
                setCategory(categories.expense[0] ?? "Outros");
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                type === "expense"
                  ? "bg-expense/20 text-expense"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Saída
            </button>
          </div>
        </div>
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
            Valor (R$)
          </label>
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 focus:border-accent focus:ring-2"
          />
        </div>
        <div className="lg:col-span-3">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
            Descrição
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Supermercado, aluguel…"
            className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 focus:border-accent focus:ring-2"
          />
        </div>
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
            Categoria
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 focus:border-accent focus:ring-2"
          >
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
            Data
          </label>
          <DateInputBR
            value={date}
            onChange={setDate}
            required
            className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 focus:border-accent focus:ring-2"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-blue-500"
          >
            Adicionar
          </button>
        </div>
      </form>
    </section>
  );
}
