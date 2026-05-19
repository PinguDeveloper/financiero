import { FormEvent, useState } from "react";
import type { SavingsBox } from "../types";
import { formatBRL } from "../lib/format";
import { MotionCard } from "../lib/motion";

interface Props {
  boxes: SavingsBox[];
  onAdd: (input: { name: string; balance: number }) => Promise<void>;
  onDeposit: (id: string, amount: number) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

function parseAmount(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export function SavingsBoxesPanel({ boxes, onAdd, onDeposit, onRemove }: Props) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [depositById, setDepositById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const total = boxes.reduce((s, b) => s + b.balance, 0);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const n = parseAmount(balance);
    if (!name.trim() || n == null) return;
    await onAdd({ name: name.trim(), balance: n });
    setName("");
    setBalance("");
  }

  async function handleDeposit(boxId: string) {
    const amount = parseAmount(depositById[boxId] ?? "");
    if (amount == null) return;
    setBusyId(boxId);
    try {
      await onDeposit(boxId, amount);
      setDepositById((prev) => ({ ...prev, [boxId]: "" }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-surface-border bg-surface-raised p-5">
      <h2 className="font-display text-lg font-semibold text-white">Caixinhas</h2>
      <p className="mt-1 text-sm text-slate-400">
        Reservas separadas (Nubank, Inter, poupança…). Depois de criar, use &quot;Adicionar valor&quot; para
        incrementar o saldo.
      </p>
      <p className="mt-3 text-sm text-slate-500">
        Total nas caixinhas:{" "}
        <span className="font-semibold text-income">{formatBRL(total)}</span>
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {boxes.map((box, i) => (
          <MotionCard
            key={box.id}
            delay={i * 0.05}
            className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface p-4"
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
            <div className="flex gap-2 border-t border-surface-border pt-3">
              <input
                value={depositById[box.id] ?? ""}
                onChange={(e) =>
                  setDepositById((prev) => ({ ...prev, [box.id]: e.target.value }))
                }
                placeholder="Valor a adicionar"
                inputMode="decimal"
                className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                disabled={busyId === box.id}
                onClick={() => void handleDeposit(box.id)}
                className="shrink-0 rounded-lg bg-accent/90 px-3 py-2 text-xs font-semibold text-white hover:bg-accent disabled:opacity-50"
              >
                {busyId === box.id ? "…" : "+ Adicionar"}
              </button>
            </div>
          </MotionCard>
        ))}
      </div>

      <form onSubmit={(e) => void handleAdd(e)} className="mt-5 flex flex-wrap gap-3 border-t border-surface-border pt-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da nova caixinha"
          className="min-w-[140px] flex-1 rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-white"
        />
        <input
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="Saldo inicial (R$)"
          inputMode="decimal"
          className="w-36 rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-white"
        />
        <button
          type="submit"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Criar caixinha
        </button>
      </form>
    </section>
  );
}
