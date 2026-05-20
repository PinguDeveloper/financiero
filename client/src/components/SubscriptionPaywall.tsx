import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import * as api from "../lib/api";
import type { SubscriptionInfo } from "../lib/api";

type Plan = { id: string; title: string; price: number; days: number };

export function SubscriptionPaywall({
  subscription,
  onRefresh,
}: {
  subscription: SubscriptionInfo | null;
  onRefresh: () => Promise<void>;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .billingPlans()
      .then((r) => setPlans(r.plans.filter((p) => p.id !== "trial")))
      .catch(() => setPlans([]));
  }, []);

  async function checkout(planId: string) {
    setBusy(planId);
    setError(null);
    try {
      const { checkoutUrl } = await api.billingCheckout(planId);
      window.location.href = checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao abrir pagamento");
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-8 shadow-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Assinatura</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-white">
          {subscription?.status === "trial"
            ? "Seu teste gratuito terminou"
            : "Continue usando o Atlas Invest"}
        </h2>
        <p className="mt-3 text-sm text-slate-400">
          O plano gratuito libera o painel por 10 minutos. Escolha um plano pago para seguir
          organizando suas finanças — pagamento seguro via Stripe.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">
            {error}
          </p>
        )}

        <div className="mt-8 space-y-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void checkout(plan.id)}
              className="flex w-full items-center justify-between rounded-xl border border-surface-border bg-surface px-5 py-4 text-left transition hover:border-accent/50 disabled:opacity-60"
            >
              <span>
                <span className="block font-semibold text-white">{plan.title}</span>
                <span className="text-xs text-slate-500">{plan.days} dias de acesso</span>
              </span>
              <span className="font-display text-lg font-bold text-accent">
                R$ {plan.price.toFixed(2).replace(".", ",")}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void onRefresh()}
          className="mt-6 w-full text-center text-sm text-slate-500 hover:text-accent"
        >
          Já paguei — atualizar status
        </button>
      </motion.div>
    </div>
  );
}
