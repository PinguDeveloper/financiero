import { FormEvent, useState } from "react";
import type { SavingsBox } from "../types";
import { formatBRL } from "../lib/format";
import { MotionCard } from "../lib/motion";

interface Props {
  boxes: SavingsBox[];
  onAdd: (input: { name: string; balance: number }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export function SavingsBoxesPanel({ boxes, onAdd, onRemove }: Props) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const total = boxes.reduce((s, b) => s + b.balance, 0);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const n = Number.parseFloat(balance.replace(",", "."));
    if (!name.trim() || !Number.isFinite(n) || n < 0) return;
    await onAdd({ name: name.trim(), balance: Math.round(n * 100) / 100 });
    setName("");
    setBalance("");
  }

  return (
    <section className="rounded-2xl border border-surface-border bg-surface-raised p-5">
      <h2 className="font-display text-lg font-semibold text-white">Caixinhas</h2>
      <p className="mt-1 text-sm text-slate-400">Reservas separadas (Nubank, Inter, poupança…).</p>
      <p className="mt-3 text-sm text-slate-500">
        Total nas caixinhas:{" "}
        <span className="font-semibold text-income">{formatBRL(total)}</span>
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {boxes.map((box, i) => (
          <MotionCard
            key={box.id}
            delay={i * 0.05}
            className="rounded-xl border border-surface-border bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-white">{box.name}</p>
                <p className="mt-1 font-display text-xl font-bold tabular-nums text-income">
                  {formatBRL(box.balance)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onRemove(box.id)}
                className="text-xs text-slate-500 hover:text-expense"
              >
                Remover
              </button>
            </div>
          </MotionCard>
        ))}
      </div>

      <form onSubmit={(e) => void handleAdd(e)} className="mt-5 flex flex-wrap gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da caixinha"
          className="min-w-[140px] flex-1 rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-white"
        />
        <input
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="Saldo (R$)"
          inputMode="decimal"
          className="w-32 rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-white"
        />
        <button
          type="submit"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Adicionar
        </button>
      </form>
    </section>
  );
}
