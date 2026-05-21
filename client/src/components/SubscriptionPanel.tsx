import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { SubscriptionInfo } from "../lib/api";
import * as api from "../lib/api";
import { formatDateTime } from "../lib/format";
import { ManualSubscriptionPayment } from "./ManualSubscriptionPayment";

const STATUS_LABEL: Record<SubscriptionInfo["status"], string> = {
  trial: "Teste grátis",
  active: "Ativo",
  expired: "Expirado",
};

const STATUS_STYLE: Record<SubscriptionInfo["status"], string> = {
  trial: "border-accent/40 bg-accent/10 text-accent",
  active: "border-income/40 bg-income/10 text-income",
  expired: "border-expense/40 bg-expense/10 text-expense",
};

function progressPercent(sub: SubscriptionInfo): number {
  if (!sub.accessStartedAt || !sub.accessEndsAt || !sub.totalDays) return 0;
  const start = new Date(sub.accessStartedAt).getTime();
  const end = new Date(sub.accessEndsAt).getTime();
  const now = Date.now();
  if (end <= start) return 100;
  const elapsed = Math.min(end, now) - start;
  return Math.min(100, Math.max(0, Math.round((elapsed / (end - start)) * 100)));
}

export function SubscriptionPanel({
  subscription,
  email,
  onRefresh,
}: {
  subscription: SubscriptionInfo | null;
  email: string;
  onRefresh: () => Promise<void>;
}) {
  const [billingMode, setBillingMode] = useState<"manual" | "stripe">("manual");

  useEffect(() => {
    api.billingPlans().then((r) => setBillingMode(r.mode));
  }, []);

  if (!subscription) {
    return (
      <p className="text-sm text-slate-400">Carregando informações da assinatura…</p>
    );
  }

  const pct = progressPercent(subscription);
  const timeLeft =
    subscription.status === "trial" && subscription.minutesLeft != null
      ? `${subscription.minutesLeft} minuto${subscription.minutesLeft === 1 ? "" : "s"}`
      : subscription.daysRemaining != null
        ? `${subscription.daysRemaining} dia${subscription.daysRemaining === 1 ? "" : "s"}`
        : "—";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-slate-500">
          Sua assinatura
        </h2>
        <p className="mt-1 text-xs text-slate-600">Conta: {email}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Plano</p>
            <p className="mt-1 font-display text-xl font-bold text-white">
              {subscription.planLabel}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLE[subscription.status]}`}
          >
            {STATUS_LABEL[subscription.status]}
          </span>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-surface-border bg-surface px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Início</dt>
            <dd className="mt-1 text-sm font-medium text-white">
              {subscription.accessStartedAt
                ? formatDateTime(subscription.accessStartedAt)
                : "—"}
            </dd>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface px-4 py-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              {subscription.hasAccess ? "Válido até" : "Encerrou em"}
            </dt>
            <dd className="mt-1 text-sm font-medium text-white">
              {subscription.accessEndsAt
                ? formatDateTime(subscription.accessEndsAt)
                : "—"}
            </dd>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface px-4 py-3 sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Tempo restante</dt>
            <dd className="mt-1 font-display text-2xl font-bold text-accent">{timeLeft}</dd>
          </div>
        </dl>

        {subscription.hasAccess && subscription.accessEndsAt ? (
          <div className="mt-6">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Progresso do período</span>
              <span>{pct}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void onRefresh()}
          className="mt-6 rounded-xl border border-surface-border px-6 py-2.5 text-sm font-medium text-slate-400 hover:border-slate-500 hover:text-white"
        >
          Atualizar
        </button>
      </motion.div>

      {!subscription.hasAccess || subscription.status === "trial" ? (
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-slate-500">
            {subscription.hasAccess ? "Renovar antes do fim do teste" : "Assinar plano"}
          </h3>
          <div className="mt-4">
            {billingMode === "manual" ? (
              <ManualSubscriptionPayment onSuccess={onRefresh} compact />
            ) : (
              <p className="text-sm text-slate-500">Pagamento online indisponível.</p>
            )}
          </div>
        </div>
      ) : null}

      <p className="text-xs text-slate-600">
        Pagamento via PIX. Após confirmar, use o código de liberação na aba Assinatura.
      </p>
    </div>
  );
}
